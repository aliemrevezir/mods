import { expect, test } from 'claude-code/testing'
import type { SessionMessage } from 'claude-code'

import { toExchanges } from '../hooks/exchanges'

const ROWS: SessionMessage[] = [
  { role: 'user', text: '<system-reminder>hidden</system-reminder>', toolUses: [] },
  { role: 'user', text: 'delete the build folder', toolUses: [] },
  {
    role: 'assistant',
    text: 'Deleting it.',
    toolUses: [{ tool_use_id: 't1', tool: 'Bash', input: { command: 'rm -rf build' } }],
  },
  { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 't1', text: 'ok', isError: false, result: undefined }] as never },
  { role: 'assistant', text: 'Folder deleted.', toolUses: [] },
  { role: 'user', text: 'now write me a mod', toolUses: [] },
]

test('pairs each typed prompt with the replies that followed it', async () => {
  const list = toExchanges(ROWS)
  expect(list.length).toBe(2)
  expect(list[0]?.prompt).toBe('delete the build folder')
  expect(list[0]?.tools).toBe(1)
  expect(list[0]?.answer).toContain('Deleting it.')
  expect(list[0]?.answer).toContain('**Bash** · rm -rf build')
  expect(list[0]?.answer).toContain('Folder deleted.')
  expect(list[1]?.answer).toBe('')
})
