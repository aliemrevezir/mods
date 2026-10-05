import { expect, test } from 'claude-code/testing'

import { barWindow, currentIndex, oneLine, toItems, withQuote } from '../hooks/rail'

const LIST = [
  { prompt: 'a', answer: '', tools: 0 },
  { prompt: 'b', answer: '', tools: 2 },
  { prompt: 'a', answer: '', tools: 0 },
]
const IDS = new Map([['a', ['r1', 'r3']], ['b', ['r2']]])

test('pairs repeated prompts with their own rows', async () => {
  expect(toItems(LIST, IDS).map(x => x.requestId)).toEqual(['r1', 'r2', 'r3'])
})

test('the last prompt on screen is where you are, else the last seen, else the newest', async () => {
  const items = toItems(LIST, IDS)
  expect(currentIndex(items, new Set(['r1', 'r2']), undefined)).toBe(1)
  expect(currentIndex(items, new Set(), 'r1')).toBe(0)
  expect(currentIndex(items, new Set(), undefined)).toBe(2)
})

test('bars keep the newest that fit, and the current one', async () => {
  expect(barWindow(10, 4, 9)).toEqual([6, 7, 8, 9])
  expect(barWindow(10, 4, 2)).toEqual([2, 3, 4, 5])
  expect(oneLine('Compare  debounce\nand throttle', 10)).toBe('Compare d…')
})

test('a reply puts the selection on top of the draft as a quote', async () => {
  expect(withQuote('first line\n\nsecond', '')).toBe('> first line\n>\n> second\n\n')
  expect(withQuote('quoted', 'fix this')).toBe('> quoted\n\nfix this')
})
