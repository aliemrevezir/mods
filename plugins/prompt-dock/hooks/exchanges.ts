import type { SessionMessage } from 'claude-code'

import type { Exchange } from '../types'

// Engine-injected user rows (reminders, command records, notifications) are not prompts.
const isPrompt = (m: SessionMessage) => {
  if (m.role !== 'user' || (m.toolResults?.length ?? 0) > 0) return false
  const text = m.text.trim()
  return text !== '' && !text.startsWith('<') && !text.startsWith('[Request interrupted')
}

const toolLine = (tool: string, input: Record<string, unknown>) => {
  const hint = [input.description, input.file_path, input.command, input.pattern, input.prompt]
    .find(v => typeof v === 'string') as string | undefined
  const short = hint ? hint.replace(/\s+/g, ' ').slice(0, 80) : ''
  return `> 🔧 **${tool.replace(/^mcp__/, '')}**${short ? ` · ${short}` : ''}`
}

export const toExchanges = (messages: readonly SessionMessage[]): Exchange[] => {
  const out: Exchange[] = []
  let parts: string[] = []
  for (const m of messages) {
    if (isPrompt(m)) {
      parts = []
      out.push({ prompt: m.text.trim(), answer: '', tools: 0 })
      continue
    }
    const current = out.at(-1)
    if (current === undefined || m.role !== 'assistant') continue
    if (m.text.trim() !== '') parts.push(m.text.trim())
    for (const use of m.toolUses) parts.push(toolLine(use.tool, use.input))
    current.tools += m.toolUses.length
    current.answer = parts.join('\n\n')
  }
  return out
}
