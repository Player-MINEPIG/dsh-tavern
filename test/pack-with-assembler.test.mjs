import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('new candidate packaging refuses the frozen advanced addon before building', () => {
  const result = spawnSync(process.execPath, ['scripts/pack-with-assembler.mjs', '--with-core'], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Advanced core packaging is frozen at Assembler 1\.1\.0 \/ DSH 0\.2\.0-rc\.2/)
})
