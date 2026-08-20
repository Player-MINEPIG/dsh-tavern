import test from 'node:test'
import assert from 'node:assert/strict'
import {
  readNativeRegexScripts,
  replaceNativeRegexScripts,
} from '../packages/tavern-format/src/index.js'

test('native regex adapter preserves an existing source path and unknown rule fields', () => {
  const resource = {
    updatedAt: 'before',
    source: {
      format: 'sillytavern-chat-completion',
      raw: {
        extensions: {
          kept: true,
          regex_scripts: [{ id: 'old', unknown: { nested: true } }],
        },
      },
    },
  }
  const scripts = readNativeRegexScripts(resource)
  scripts[0].unknown.nested = false
  assert.equal(resource.source.raw.extensions.regex_scripts[0].unknown.nested, true)

  const replacement = [{ id: 'new', unknown: { future: 1 } }]
  const next = replaceNativeRegexScripts(resource, replacement, {
    kind: 'preset',
    now: 'after',
  })
  assert.deepEqual(next.source.raw.extensions.regex_scripts, replacement)
  assert.equal(next.source.raw.extensions.kept, true)
  assert.equal(next.updatedAt, 'after')
  assert.equal(resource.updatedAt, 'before')
})

test('native regex adapter creates canonical preset and character paths when absent', () => {
  const preset = replaceNativeRegexScripts({ source: { format: 'dsh-tavern' } }, [], {
    kind: 'preset',
    now: 'now',
  })
  assert.deepEqual(preset.source.raw.extensions.regex_scripts, [])

  const character = replaceNativeRegexScripts({ source: { format: 'sillytavern-v2', raw: { data: { name: 'Card' } } } }, [], {
    kind: 'character',
    now: 'now',
  })
  assert.deepEqual(character.source.raw.data.extensions.regex_scripts, [])
  assert.equal(character.source.raw.data.name, 'Card')
})
