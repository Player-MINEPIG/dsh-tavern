import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

test('official plugin admission accepts the target without an exemption and rejects unverified runtimes', { skip: !runtimeRoot }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const { evaluatePluginCompatibility, getDshRuntimeVersion } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')).href)
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const target = manifest.peerDependencies['@deepseek-ai/dsh-util-crypto']
  assert.equal(getDshRuntimeVersion(), target)
  assert.equal(evaluatePluginCompatibility(manifest), undefined)

  const previous = { ...manifest, peerDependencies: { ...manifest.peerDependencies, '@deepseek-ai/dsh-util-crypto': '0.1.7-alpha.2' } }
  const denied = evaluatePluginCompatibility(previous)
  assert.equal(denied.exempted, false)
  assert.deepEqual(denied.peers, { '@deepseek-ai/dsh-util-crypto': '0.1.7-alpha.2' })
  assert.equal(evaluatePluginCompatibility(manifest, {}, '0.1.7-rc.2').exempted, false)
})
