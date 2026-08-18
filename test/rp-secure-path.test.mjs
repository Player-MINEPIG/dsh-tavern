import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  isInsideWorkspace,
  isRpSecretBasename,
  resolveRpReadTarget,
} from '../packages/tavern-loader/src/rp-secure-path.js'

test('secret basename detection covers dotenv and key material, not ordinary lore files', () => {
  assert.equal(isRpSecretBasename('.env'), true)
  assert.equal(isRpSecretBasename('.env.local'), true)
  assert.equal(isRpSecretBasename('.credentials.yaml'), true)
  assert.equal(isRpSecretBasename('id_ed25519'), true)
  assert.equal(isRpSecretBasename('tls.pem'), true)
  assert.equal(isRpSecretBasename('lore.md'), false)
  assert.equal(isRpSecretBasename('art.png'), false)
})

test('workspace membership rejects parent-directory escape', () => {
  const workspace = join(tmpdir(), 'dsh-tavern-rp-ws')
  const inside = resolveRpReadTarget('notes/lore.md', workspace)
  assert.equal(inside.ok, true)
  assert.equal(inside.inside, true)
  assert.equal(inside.secret, false)
  const secret = resolveRpReadTarget('.env', workspace)
  assert.equal(secret.inside, true)
  assert.equal(secret.secret, true)
  const outside = resolveRpReadTarget(join('..', 'outside.md'), workspace)
  assert.equal(outside.inside, false)
  assert.equal(isInsideWorkspace(workspace, workspace), true)
})
