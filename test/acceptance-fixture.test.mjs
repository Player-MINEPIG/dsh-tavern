import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { parseSillyTavernPreset } from '../packages/tavern-format/src/index.js'
import { compilePresetForDsh } from '../packages/tavern-loader/src/profile-compiler.js'

const fixturePath = 'D:\\AI\\deepseek-harness\\夏瑾 天琴座 Beta 1.0.json'

test('acceptance fixture parses in place without repository copies or text snapshots', {
  skip: !existsSync(fixturePath),
}, () => {
  const preset = parseSillyTavernPreset(readFileSync(fixturePath, 'utf8'), {
    id: 'acceptance-in-place',
    name: 'Acceptance fixture',
  })
  const compiled = compilePresetForDsh(preset, { random: () => 0.5 })

  assert.equal(preset.source.format, 'sillytavern-chat-completion')
  assert.equal(preset.source.selectedOrderCharacterId, 100001)
  assert.ok(preset.prompts.length > 100)
  assert.ok(preset.prompts.some((prompt) => prompt.enabled && prompt.content.length > 0))
  assert.ok(compiled.length > 1000)
  assert.doesNotMatch(compiled, /\{\{[\s\S]*?\}\}/)
})
