import { expect, test } from 'claude-code/testing'

const F = '\x1e'
const BAND = { component: 'AbovePrompt', props: { bodyColumns: 100, hasSurvey: false, isWorking: false, maxRows: 10 } }
const run = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

test('/projects draws the folders, pressing one opens it, the band lists its sessions', async ($, on) => {
  const title = JSON.stringify({ type: 'custom-title', customTitle: 'Barkod yapısı' })
  on('process.run', (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    return (argv.length > 5
      ? run(Array.from({ length: 12 }, (_, i) => `s${i}${F}100${F}${title}${F}`).join('\n'))
      : run(`isler-poms${F}100${F}2${F}1\nmods${F}50${F}1${F}1\n`)) as never
  })
  on('clock.now', () => ({ value: 200_000 }) as never)
  on('ui.render', ($$, e) => { const { Box } = $$.ui.resolve(e); return <Box key="engine" /> })

  await $.command.run({ command: 'projects', args: '/p' } as never)
  const ui = await $.ui.mount({ plugin: 'project-hop', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ key: 'project-0' })).toBeDefined()
  expect(await ui.find({ key: 'project-1' })).toBeDefined()

  await ui.press({ key: 'project-0' })
  expect(await ui.find({ key: 'new' })).toBeDefined()
  expect(await ui.find({ key: 'session-0' })).toBeDefined()
  expect(await ui.find({ key: 'session-8' })).toBeUndefined()

  await ui.press({ key: 'next' })
  expect(await ui.find({ key: 'session-8' })).toBeDefined()
  expect(await ui.find({ key: 'session-0' })).toBeUndefined()

  await ui.press({ key: 'close' })
  expect(await ui.find({ key: 'new' })).toBeUndefined()
  expect(await ui.find({ key: 'engine' })).toBeDefined()
  await ui.unmount()
})
