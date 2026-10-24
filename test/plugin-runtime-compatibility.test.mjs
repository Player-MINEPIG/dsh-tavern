import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

test('official plugin admission accepts the 0.2.1 RC series and rejects versions outside its boundary', { skip: !runtimeRoot }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const { satisfies } = require('semver')
  const { evaluatePluginCompatibility } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')).href)
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(evaluatePluginCompatibility(manifest), undefined)
  const assembler = JSON.parse(readFileSync(new URL('../node_modules/dsh-prompt-assembler/package.json', import.meta.url), 'utf8'))
  for (const plugin of [manifest, assembler]) {
    for (const version of ['0.2.1-rc.2', '0.2.1-rc.3', '0.2.1-rc.99', '0.2.1']) {
      assert.equal(evaluatePluginCompatibility(plugin, {}, version), undefined, `${plugin.name} on ${version}`)
      for (const [name, range] of Object.entries(plugin.peerDependencies).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))) {
        assert.ok(satisfies(version, range), `${name} peer on ${version}`)
      }
    }
    for (const version of ['0.1.7-rc.1', '0.2.0-rc.2', '0.2.1-alpha.5', '0.2.1-rc.1', '0.2.2-alpha.1', '0.2.2-rc.1', '0.2.2', '0.3.0']) {
      assert.equal(evaluatePluginCompatibility(plugin, {}, version).exempted, false, `${plugin.name} on ${version}`)
      for (const [name, range] of Object.entries(plugin.peerDependencies).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))) {
        assert.equal(satisfies(version, range), false, `${name} peer on ${version}`)
      }
    }
  }

  const previous = { ...manifest, engines: { ...manifest.engines, dsh: '0.2.0-rc.2' } }
  const denied = evaluatePluginCompatibility(previous)
  assert.equal(denied.exempted, false)
  assert.deepEqual(denied.requirements, { 'engines.dsh': '0.2.0-rc.2' })
})
