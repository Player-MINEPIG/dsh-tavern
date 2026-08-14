import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('internal packages keep one-way format to preset to loader boundaries', () => {
  const format = read('../packages/tavern-format/src/index.js')
  const store = read('../packages/preset/src/store.js')
  const loader = read('../packages/tavern-loader/src/index.js')

  assert.doesNotMatch(format, /from ['"]node:(?:fs|path)|@deepseek-ai|systemPrompt\.section|agent\/request/)
  assert.doesNotMatch(store, /tavern-loader|systemPrompt\.section|agent\/request/)
  assert.match(store, /tavern-format/)
  assert.match(loader, /preset\/src/)
  assert.match(loader, /systemPrompt/)
  assert.match(loader, /agent\/request/)
})
