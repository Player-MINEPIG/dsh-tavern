import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('new candidate packaging refuses the frozen advanced addon before building', () => {
  const result = spawnSync(process.execPath, ['scripts/pack-release.mjs', '--with-core'], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Usage: npm run pack:release/)
})
