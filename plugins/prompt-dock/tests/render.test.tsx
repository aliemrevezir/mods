import { expect, test } from 'claude-code/testing'

const MESSAGES = [
  { role: 'user', text: 'first prompt', toolUses: [] },
  { role: 'assistant', text: 'answer', toolUses: [] },
]

test('dock pane draws its header on every surface', async ($, on) => {
  on('session.messages', () => ({ value: [
    { role: 'user', text: 'first prompt', toolUses: [] },
    { role: 'assistant', text: 'answer', toolUses: [] },
  ] }) as never)
  on('ui.render', () => undefined as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'prompt-dock',
      surface,
      component: 'Pane',
      requestId: 'prompt-dock',
      props: { bodyColumns: 30 } as never,
    } as never)
    expect(await ui.find({ key: 'to-rail' })).toBeDefined()
    expect(await ui.find({ key: 'row-0' })).toBeDefined()
    await ui.unmount()
  }
})

test('rail band draws a bar per prompt on every surface', async ($, on) => {
  on('session.messages', () => ({ value: MESSAGES }) as never)
  on('ui.render', () => undefined as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'prompt-dock',
      surface,
      component: 'AbovePrompt',
      props: { bodyColumns: 80, hasSurvey: false, isWorking: false, maxRows: 10 } as never,
    } as never)
    expect(await ui.find({ key: 'to-dock' })).toBeDefined()
    expect(await ui.find({ key: 'bar-0' })).toBeDefined()
    await ui.unmount()
  }
})
