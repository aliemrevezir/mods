import { expect, test } from 'claude-code/testing'

import {
  encodeProjectDir,
  looksLikeRoot,
  matchProject,
  matchSession,
  paginate,
  parentOf,
  parseProjects,
  parseGit,
  parseSessions,
  spinnerFrame,
  withGit,
} from '../hooks/scan'

const F = '\x1e'

test('folders sort by last activity, unused ones last by name', () => {
  const out = [`zeta${F}0${F}0${F}1`, `poms${F}200${F}12${F}1`, `alpha${F}0${F}0${F}0`, `web${F}900${F}3${F}1`, ''].join('\n')
  const projects = parseProjects('/p/', out)
  expect(projects.map(p => p.name)).toEqual(['web', 'poms', 'alpha', 'zeta'])
  expect(projects[0]?.path).toBe('/p/web')
  expect(looksLikeRoot(projects, false)).toBe(true)
  expect(looksLikeRoot(projects, true)).toBe(false)
})

test('repositories get their branch and a dirty mark', () => {
  const projects = parseProjects('/p', [`mods${F}9${F}1${F}1`, `notes${F}0${F}0${F}0`].join('\n'))
  const git = parseGit([`mods${F}main${F}1`, `broken${F}${F}0`, `cloned${F}dev${F}2`, ''].join('\n'))
  expect([...git.keys()]).toEqual(['mods', 'cloned'])
  expect(git.get('cloned')).toEqual({ branch: 'dev', dirty: false, unchecked: true })
  const merged = withGit(projects, git)
  expect(merged[0]?.git).toEqual({ branch: 'main', dirty: true })
  expect(merged[1]?.git).toBeUndefined()
  expect(spinnerFrame(0)).toBe('⠋')
  expect(spinnerFrame(10)).toBe('⠋')
})

test('a session is titled by its custom title, else its last prompt, else left out', () => {
  const titled = JSON.stringify({ type: 'custom-title', customTitle: 'Barcode layout' })
  const prompt = JSON.stringify({ type: 'last-prompt', lastPrompt: 'where does\nthis number come from' })
  const out = [`a${F}10${F}${titled}${F}${prompt}`, `b${F}9${F}${F}${prompt}`, `c${F}8${F}${F}`].join('\n')
  expect(parseSessions(out)).toEqual([
    { id: 'a', mtime: 10, title: 'Barcode layout' },
    { id: 'b', mtime: 9, title: 'where does this number come from' },
  ])
})

test('typed lines pick by a single word, sentences go to the model', () => {
  const all = parseProjects('/p', [`isler-poms${F}3${F}1${F}1`, `isler-stok${F}2${F}1${F}1`, `mods${F}1${F}1${F}1`].join('\n'))
  expect(matchProject('2', all)).toEqual({ kind: 'none' })
  expect(matchProject('mods', all)).toEqual({ kind: 'project', project: all[2]! })
  expect(matchProject('stok', all)).toEqual({ kind: 'project', project: all[1]! })
  expect(matchProject('isler', all)).toEqual({ kind: 'filter', filter: 'isler' })
  expect(matchProject('which project is oldest', all)).toEqual({ kind: 'none' })
  expect(matchProject('9', all)).toEqual({ kind: 'none' })
})

test('session picks', () => {
  const sessions = [{ id: 's1', mtime: 2, title: 'a' }, { id: 's2', mtime: 1, title: 'b' }]
  expect(matchSession('n', sessions)).toEqual({ kind: 'new' })
  expect(matchSession('c', sessions)).toEqual({ kind: 'resume', id: 's1' })
  expect(matchSession('2', sessions)).toEqual({ kind: 'resume', id: 's2' })
  expect(matchSession('b', sessions)).toEqual({ kind: 'back' })
  expect(matchSession('neden', sessions)).toEqual({ kind: 'none' })
})

test('pages clamp into range', () => {
  const rows = [1, 2, 3, 4, 5, 6, 7]
  expect(paginate(rows, 3, 0)).toEqual({ at: 0, pages: 3, start: 0, rows: [1, 2, 3] })
  expect(paginate(rows, 3, 2).rows).toEqual([7])
  expect(paginate(rows, 3, 9).at).toBe(2)
  expect(paginate(rows, 3, -1).at).toBe(0)
  expect(paginate(rows, 3, Number.NaN).at).toBe(0)
})

test('paths', () => {
  expect(encodeProjectDir('/Users/a/projects/aliemre.dev')).toBe('-Users-a-projects-aliemre-dev')
  expect(parentOf('/Users/a/projects/mods/')).toBe('/Users/a/projects')
})
