import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Exchange } from '../types'
import { toExchanges } from './exchanges'
import type { RailItem } from './rail'
import { barWindow, currentIndex, oneLine, toItems, withQuote } from './rail'

const PANE = 'prompt-dock'
const TITLE = 'Prompts'
const DOCK_COLUMNS = 30

const mode = atom({ plugin: 'prompt-dock', key: 'mode' } as const, 'rail')
const tick = atom({ plugin: 'prompt-dock', key: 'tick' } as const, 0)

const scope = (i: number) => `prompt-dock-${i}`

const preview = (x: RailItem) => `#${x.index + 1} ${x.prompt}${x.tools > 0 ? ` · ${x.tools} tool${x.tools === 1 ? '' : 's'}` : ''}`

function bump($: EngineInterface) {
  return update($, tick, n => (n ?? 0) + 1)
}

async function dock($: EngineInterface) {
  await update($, mode, () => 'dock')
  return $.ui.open({ id: PANE, title: TITLE, columns: DOCK_COLUMNS })
}

async function rail($: EngineInterface) {
  await update($, mode, () => 'rail')
  await $.ui.close({ id: PANE })
}

// UserMessage request ids in transcript order, keyed by prompt text, so a
// prompt can be scrolled into view in the transcript.
const rowIds = new Map<string, string[]>()
// Prompt rows the transcript's viewport shows now, and the last one it did.
const visible = new Set<string>()
let lastSeen: string | undefined
// Reading the whole transcript on every redraw is slow; once per new message.
let cache: { tick: number; list: Exchange[] } | undefined

async function items($: EngineInterface) {
  const t = await read($, tick)
  if (cache?.tick !== t) cache = { tick: t, list: toExchanges(await $.session.messages()) }
  const list = toItems(cache.list, rowIds)
  return { list, current: currentIndex(list, visible, lastSeen) }
}

async function jump($: EngineInterface, x: RailItem) {
  if (x.requestId === undefined) return
  lastSeen = x.requestId
  await $.ui.scroll({ to: { requestId: x.requestId }, block: 'start' })
  $.ui.invalidate('ui.render')
}

// Reads the selection only when asked: polling it every half second got in
// the way of pasting images into the prompt. The terminal copies a selection
// on its own and may take the highlight down, so the clipboard backs it up.
const PASTE_COMMANDS = [['pbpaste'], ['wl-paste', '--no-newline'], ['xclip', '-o', '-selection', 'clipboard']]

async function selectedText($: EngineInterface) {
  const selected = (await $.ui.selection())?.text.trim()
  if (selected) return selected
  for (const argv of PASTE_COMMANDS) {
    const pasted = await $.process.run(argv).catch(() => undefined)
    if (pasted?.exitCode === 0 && pasted.stdout.trim() !== '') return pasted.stdout.trim()
  }
  return ''
}

async function reply($: EngineInterface) {
  const text = await selectedText($)
  if (!text) {
    $.ui.toast('Select some text with the mouse first.')
    return false
  }
  const { text: draft } = await $.prompt.read()
  const filled = await $.prompt.fill({ text: withQuote(text, draft), mode: 'replace' })
  $.ui.toast(
    filled.isFilled
      ? `Quoted: "${oneLine(text, 40)}"`
      : `Could not write to the prompt${filled.refusal === undefined ? '' : ` (${filled.refusal})`}.`,
  )
  return filled.isFilled
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'prompts',
      description: 'Move your prompt list between the rail above the input and a dock beside the transcript',
    })
    await $.command.register({
      name: 'reply',
      description: 'Quote the text you selected at the top of the prompt',
    })
    if ((await read($, mode)) === 'dock') void dock($)
    return next(e)
  })

  on('command.run', { command: 'prompts' }, async $ => {
    await bump($)
    if ((await read($, mode)) === 'dock') {
      await rail($)
      return { text: 'Prompt list moved back to the rail above the input.' }
    }
    const opened = await dock($)
    return { text: opened.isPlaced ? 'Prompt list docked beside the transcript.' : 'The dock could not be placed; widen the terminal.' }
  })

  on('command.run', { command: 'reply' }, async $ => {
    return { text: (await reply($)) ? 'Selection quoted in the prompt.' : 'Select some text with the mouse first.' }
  })

  on('prompt.submit', async ($, e, next) => {
    const ran = await next(e)
    lastSeen = undefined
    await bump($)
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    await bump($)
    return ran
  })

  // A person closing the dock sends the list back to the rail.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') await update($, mode, () => 'rail')
    return next(e)
  })

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    const text = e.props.text.trim()
    const ids = rowIds.get(text) ?? []
    if (!ids.includes(e.requestId)) rowIds.set(text, [...ids, e.requestId])
    const onScreen = e.props.onScreen
    if (onScreen !== undefined) {
      const was = visible.has(e.requestId)
      if (onScreen === null) visible.delete(e.requestId)
      else {
        visible.add(e.requestId)
        lastSeen = e.requestId
      }
      if (was !== (onScreen !== null)) $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // Rail: a row of ticks above the prompt, one per prompt, the thick one where
  // you are; hovering a tick previews its prompt in the line above.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    if ((await read($, mode)) === 'dock') return next(e)
    const { list, current } = await items($)
    if (list.length === 0) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(10, e.props.bodyColumns - 16)
    const shown = barWindow(list.length, width, current)
    const here = list[current]

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row">
          <Box flexGrow={1} flexShrink={1} position="relative">
            <Text dimColor wrap="truncate-end">
              {here === undefined ? '' : oneLine(preview(here), width)}
            </Text>
            {shown.map(i => {
              const x = list[i]
              if (x === undefined) return null
              return (
                <Box
                  key={`peek-${i}`}
                  position="absolute"
                  top={0}
                  left={0}
                  display="none"
                  hover={{ display: 'flex', scope: scope(i) }}
                >
                  <Text bold wrap="truncate-end">
                    {oneLine(preview(x), width).padEnd(width, ' ')}
                  </Text>
                </Box>
              )
            })}
          </Box>
          <Box key="reply-box" marginRight={1}>
            <Button key="reply" plain dimColor label="↩ Reply" hover={{ dimColor: false }} onPress={() => reply($)} />
          </Box>
          <Box key="to-dock-box">
            <Button key="to-dock" plain dimColor label="[–]" hover={{ dimColor: false }} onPress={() => dock($)} />
          </Box>
        </Box>
        <Box flexDirection="row">
          {shown.map(i => {
            const x = list[i]
            if (x === undefined) return null
            const isHere = i === current
            return (
              <Button
                key={`bar-${i}`}
                plain
                dimColor={!isHere}
                label={isHere ? '┃' : '│'}
                hover={{ scope: scope(i), dimColor: false, bold: true }}
                onPress={() => jump($, x)}
              />
            )
          })}
        </Box>
      </Box>
    )
  })

  // Dock: the same list standing beside the transcript, one line a prompt.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { list, current } = await items($)
    const width = Math.max(8, e.props.bodyColumns - 4)

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row">
          <Box flexGrow={1}>
            <Text dimColor>{list.length} prompt{list.length === 1 ? '' : 's'}</Text>
          </Box>
          <Box key="reply-box" marginRight={1}>
            <Button key="reply" plain dimColor label="↩" hover={{ dimColor: false }} onPress={() => reply($)} />
          </Box>
          <Box key="to-rail-box">
            <Button key="to-rail" plain dimColor label="×" hover={{ dimColor: false }} onPress={() => rail($)} />
          </Box>
        </Box>
        {list.length === 0 && <Text dimColor>No prompts yet.</Text>}
        {list.map((x, i) => {
          const isHere = i === current
          return (
            <Box key={`row-box-${i}`}>
              <Button
                key={`row-${i}`}
                plain
                dimColor={!isHere}
                label={`${isHere ? '━' : '─'} ${oneLine(x.prompt, width - 2)}`}
                hover={{ dimColor: false }}
                onPress={() => jump($, x)}
              />
            </Box>
          )
        })}
      </Box>
    )
  })
}
