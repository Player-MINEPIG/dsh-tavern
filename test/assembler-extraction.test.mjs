import { MODULE_ORDER } from './fixtures/assembly-references.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve, join } from 'node:path'
import { assembleRequest, BUILTINS, textOf } from '../packages/request-assembler/index.js'
import { projectSystemSnapshots } from 'dsh-prompt-assembler'
import { defaultAssemblyFailureInput } from './fixtures/default-assembly-failure.mjs'
const baseline = process.env.DSH_TAVERN_ASSEMBLY_BASELINE
const node = ({ module, role, text, depth, lifetime, source, name, locked, lockReason, children = [] }) => ({ module, role, text, depth, lifetime, source, name, locked, lockReason, children: children.map(node) })
const normalize = result => ({
  messages: result.messages.map(({ role, content, source }) => ({ role, content, source })),
  nodes: result.nodes.map(node),
  diagnostics: result.diagnostics,
  snapshots: result.snapshots.map(({ ruleId, depth, hash, nativeAfterId, messages }) => ({ ruleId, depth, hash, nativeAfterId, messages: messages.map(({ role, content }) => ({ role, content })) })),
})
test('extracted Tavern adapter preserves pre-split assembly and projection over all built-in strategies', { skip: !baseline }, async () => {
  const before = await import(pathToFileURL(join(resolve(baseline), 'packages/request-assembler/index.js')).href)
  const beforeProject = (await import(pathToFileURL(join(resolve(baseline), 'packages/request-assembler/system-snapshots.js')).href)).projectSystemSnapshots
  for (const base of BUILTINS) {
    for (const greeting of [true, false]) {
      const input = defaultAssemblyFailureInput(); input.assets.includeGreetingReference = greeting
      input.assets.officialSections = [{name:'native:section',text:'CORE'}, {name:'rp:policy',text:'ROLEPLAY'}, {name:'pmp-dsh-tavern:assets',text:'ASSETS'}, {name:'native:provider',text:'PROVIDER',plugin:'example.provider'}]
      const options = { ...input, preset: base, preview: true }
      const old = before.assembleRequest(options), current = assembleRequest(options)
      assert.deepEqual(normalize(current), normalize(old), `${base.id}, greeting=${greeting}`)
      assert.deepEqual(normalize(projectSystemSnapshots(current, input.nativeMessages, undefined, { preview: true })), normalize(beforeProject(old, input.nativeMessages, undefined, { preview: true })))
    }
  }
})
test('DSH custom source and parser mode are discoverable through the compatibility catalog', () => {
  const p = { ...MODULE_ORDER, rules: [...MODULE_ORDER.rules, { id: 'dsh-text', kind: 'dsh.text', inputMode: 'text', text: 'Model {{model}}', role: 'user' }] }
  const result = assembleRequest({ preset: p, assets: { nativeVariables: { model: 'test' } } })
  assert.deepEqual(result.messages.map(textOf), ['Model test'])
  assert.equal(result.nodes[0].source.plugin, 'DSH')
  assert.ok(result.sources.find(s => s.id === 'dsh.text').acceptsText)
})
