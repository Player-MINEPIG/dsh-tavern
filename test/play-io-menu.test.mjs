import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../packages/client/src/play/io-menu.js', import.meta.url), 'utf8')

test('sidebar IO menu does not own the empty-playthrough import input', () => {
  assert.doesNotMatch(source, /importPlaythrough|bindPlaythroughImport|type: 'file'|play\.io\.import/)
})

test('sidebar IO menu sizes to its content within the narrow sidebar budget', () => {
  assert.match(source, /data-placement=sidebar[^}]*width:max-content;min-width:0;max-width:168px/)
  assert.match(source, /data-placement=sidebar[^}]*\.dtv-play-io-item\{white-space:nowrap\}/)
})
