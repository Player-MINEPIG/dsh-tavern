import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { requireAssemblerVersion, requireSharedAssembler } from '../packages/tavern-loader/src/assembler-compatibility.js'

test('only compatible stable shared Assembler implementations are admitted', () => {
  for (const version of ['1.1.3', '1.1.4', '1.1.99']) assert.doesNotThrow(() => requireAssemblerVersion(version, 'test'))
  for (const version of [undefined, '', '1.1.2', '1.1.3-rc.1', '1.2.0', '2.0.0', 'invalid']) {
    assert.throws(() => requireAssemblerVersion(version, 'test'), error => error.code === 'TAVERN_ASSEMBLER_INCOMPATIBLE' && error.message.includes('releases/download/v1.1.3'))
  }
})

test('legacy Assembler configuration is rejected before choosing a different store', () => {
  assert.throws(() => requireSharedAssembler(undefined, { assemblerStorageDir: 'custom-store' }), { code: 'TAVERN_ASSEMBLER_CONFIG_MOVED' })
})

test('a matching version without the required public service fails admission', () => {
  assert.throws(() => requireSharedAssembler({ version: '1.1.3' }), { code: 'TAVERN_ASSEMBLER_INCOMPATIBLE' })
})

function isolatedHost(t, version) {
  const root = mkdtempSync(join(tmpdir(), 'tavern-peer-admission-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const path of ['package.json', 'packages/identity.js', 'packages/tavern-loader/src/host.js', 'packages/tavern-loader/src/assembler-compatibility.js']) {
    const target = join(root, path)
    mkdirSync(join(target, '..'), { recursive: true })
    cpSync(new URL('../' + path, import.meta.url), target)
  }
  if (version) {
    const peer = join(root, 'node_modules/dsh-prompt-assembler')
    mkdirSync(peer, { recursive: true })
    writeFileSync(join(peer, 'package.json'), JSON.stringify({ name: 'dsh-prompt-assembler', version, exports: { './package.json': './package.json' } }))
  }
  return pathToFileURL(join(root, 'packages/tavern-loader/src/host.js')).href
}

test('the installed Host entry explains a missing independent peer without importing the SDK', async t => {
  await assert.rejects(import(isolatedHost(t)), error => error.code === 'TAVERN_ASSEMBLER_MISSING' && error.message.includes('Install and enable') && error.message.includes('releases/download/v1.1.3'))
})

test('Host admission rejects an old SDK even when a different compatible service might exist', async t => {
  await assert.rejects(import(isolatedHost(t, '1.1.2')), { code: 'TAVERN_ASSEMBLER_INCOMPATIBLE' })
})

test('matching SDK metadata does not admit an older running service', async t => {
  const host = await import(isolatedHost(t, '1.1.3'))
  assert.ok(host.inject.includes('dshPromptAssembler'))
  await assert.rejects(host.apply({ get: () => ({ version: '1.1.2' }) }), { code: 'TAVERN_ASSEMBLER_INCOMPATIBLE' })
})
