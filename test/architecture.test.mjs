import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('internal packages keep one-way format to preset to loader boundaries', () => {
  const format = read('../packages/tavern-format/src/index.js')
  const worldBookFormat = read('../packages/world-book/src/format.js')
  const worldBookPolicy = read('../packages/world-book/src/policy.js')
  const worldBookBridge = read('../packages/world-book/src/loader-bridge.js')
  const store = read('../packages/preset/src/store.js')
  const loader = read('../packages/tavern-loader/src/index.js')

  assert.doesNotMatch(format, /from ['"]node:(?:fs|path)|@deepseek-ai|systemPrompt\.section|agent\/request/)
  assert.doesNotMatch(worldBookFormat, /from ['"]node:|@deepseek-ai|tavern-loader|systemPrompt|agent\/request|fetch\(/)
  assert.doesNotMatch(worldBookPolicy, /from ['"]node:|@deepseek-ai|tavern-loader|systemPrompt|agent\/request|fetch\(|Math\.random/)
  assert.doesNotMatch(worldBookBridge, /from ['"]node:|@deepseek-ai|tavern-loader|systemPrompt|agent\/request|fetch\(|Math\.random|sessionId|\bagent\b/)
  assert.doesNotMatch(store, /tavern-loader|systemPrompt\.section|agent\/request/)
  assert.match(store, /tavern-format/)
  assert.match(loader, /preset\/src/)
  assert.match(loader, /systemPrompt/)
  assert.match(loader, /agent\/request/)
})

test('character adapter and use-case expose resources without becoming a runtime loader', () => {
  const format = [
    read('../packages/tavern-format/src/character.js'),
    read('../packages/tavern-format/src/png-card.js'),
  ].join('\n')
  const character = [
    read('../packages/character/src/index.js'),
    read('../packages/character/src/store.js'),
    read('../packages/character/src/server.js'),
    read('../packages/character/src/resource.js'),
  ].join('\n')

  assert.doesNotMatch(format, /from ['"]node:|@deepseek-ai|systemPrompt\.section|ctx\.systemPrompt|agent\/request/)
  assert.doesNotMatch(character, /tavern-loader|systemPrompt\.section|system-prompt\/assemble|agent\/request/)
  assert.match(character, /tavern-format/)
  assert.match(character, /character-selection/)
})
