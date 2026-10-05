import type { Exchange } from '../types'

export type RailItem = { index: number; prompt: string; tools: number; requestId: string | undefined }

// Pairs each prompt with the UserMessage row that drew it: the nth prompt of a
// given text takes the nth row seen with that text.
export const toItems = (list: readonly Exchange[], rowIds: ReadonlyMap<string, readonly string[]>): RailItem[] => {
  const seen = new Map<string, number>()
  return list.map((x, index) => {
    const nth = seen.get(x.prompt) ?? 0
    seen.set(x.prompt, nth + 1)
    const ids = rowIds.get(x.prompt) ?? []
    return { index, prompt: x.prompt, tools: x.tools, requestId: ids[nth] ?? ids.at(-1) }
  })
}

// Where the person is: the last prompt the viewport shows; failing that, the
// one last seen on screen; failing that, the newest.
export const currentIndex = (
  items: readonly RailItem[],
  visible: ReadonlySet<string>,
  lastSeen: string | undefined,
): number => {
  for (let i = items.length - 1; i >= 0; i--) {
    const id = items[i]?.requestId
    if (id !== undefined && visible.has(id)) return i
  }
  const at = items.findIndex(x => x.requestId !== undefined && x.requestId === lastSeen)
  return at >= 0 ? at : items.length - 1
}

export const oneLine = (text: string, width: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > width ? flat.slice(0, Math.max(1, width - 1)) + '…' : flat
}

// The newest prompts that fit in `width` one-cell bars, oldest first.
export const barWindow = (count: number, width: number, current: number): number[] => {
  const fit = Math.max(1, width)
  let start = Math.max(0, count - fit)
  if (current < start) start = current
  const end = Math.min(count, start + fit)
  return Array.from({ length: end - start }, (_, k) => start + k)
}

// The selection as a markdown quote, ready to answer under.
export const quote = (text: string) =>
  text
    .replace(/\s+$/, '')
    .split('\n')
    .map(line => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n')

// The draft with the quote put on top, a blank line between.
export const withQuote = (text: string, draft: string) => {
  const q = quote(text)
  return draft.trim() === '' ? `${q}\n\n` : `${q}\n\n${draft}`
}
