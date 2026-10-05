import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { SourcePolicy } from '../packages/memory-sources/policy.js'
import { compileTemplate, renderTemplate } from '../packages/prompt-template/runtime.js'

function policy(t) {
  const root = mkdtempSync(join(tmpdir(), 'template-policy-regression-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return new SourcePolicy(join(root, 'policy.json'), 'world-book')
}
const allow = () => ({ enabled: true, strategy: [{ operation: 'worldbook.activate' }, { operation: 'worldbook.emit' }], checkCurrent: () => true })
const row = managementMode => ({ id: 'world-book:fixture', revision: 'same', managementMode })
const dependency = { sessionId: 's', dependencyEvent: { usage: 'prompt-template-dependency' } }

test('stale usage disposer cannot remove a replacement managed allow registration', async t => {
  const source = policy(t), old = source.registerUsage(allow, { providerId: 'dsh-memory-manager' })
  old()
  const stop = source.registerUsage(allow, { providerId: 'dsh-memory-manager' })
  const before = await source.decision(row('managed'), dependency, () => 'same')
  assert.equal(before.enabled, true)
  old()
  assert.equal(before.checkCurrent(), true)
  assert.equal((await source.decision(row('managed'), dependency, () => 'same')).enabled, true)
  stop()
  assert.equal(before.checkCurrent(), false)
  assert.equal((await source.decision(row('managed'), dependency, () => 'same')).enabled, true)
})

test('stale usage disposer cannot turn a replacement native dependency deny into allow', async t => {
  const source = policy(t), deny = () => ({ enabled: false }), old = source.registerUsage(deny)
  old()
  const stop = source.registerUsage(deny)
  assert.equal((await source.decision(row('native'), dependency, () => 'same')).enabled, false)
  old()
  assert.equal((await source.decision(row('native'), dependency, () => 'same')).enabled, false)
  stop()
  assert.equal((await source.decision(row('native'), dependency, () => 'same')).enabled, true)
})

test('same callback registrations have independent lifetimes', async t => {
  const source = policy(t), first = source.registerUsage(allow, { providerId: 'dsh-memory-manager' }), second = source.registerUsage(allow, { providerId: 'dsh-memory-manager' })
  const before = await source.decision(row('managed'), dependency, () => 'same')
  first()
  assert.equal(before.checkCurrent(), false)
  const after = await source.decision(row('managed'), dependency, () => 'same')
  assert.equal(after.enabled, true)
  first()
  assert.equal(after.checkCurrent(), true)
  second()
  assert.equal(after.checkCurrent(), false)
})

test('quoted variable keys retain dots, brackets, empty keys and escaped quotes', async () => {
  const variables = { root: { 'a.b': 'literal-key', a: { b: 'nested-key' }, 'x]y': 2, '': 3, 'say"hi': 4, "it's": 5, 'back\\slash': 6 }, list: [{ n: 7 }] }
  for (const [path, expected] of [['root["a.b"]', 'literal-key'], ["root['a.b']", 'literal-key'], ['root.a.b', 'nested-key'], ['root["x]y"]', '2'], ['root[""]', '3'], ['root["say\\"hi"]', '4'], ["root['it\\'s']", '5'], ['root["back\\\\slash"]', '6'], ['list[0].n', '7']]) {
    assert.equal(await renderTemplate(`<%- getvar(${JSON.stringify(path)}) %>`, { variables }), expected, path)
  }
  for (const path of ['root["constructor"]', 'root["__proto__"]', 'root["prototype"]', 'root["unterminated]', 'root..a', 'root[0]suffix']) {
    await assert.rejects(renderTemplate(`<%- getvar(${JSON.stringify(path)}) %>`, { variables }), /path/i)
  }
})

test('maximum unmatched delimiter input is rejected within a bounded compiler subprocess', () => {
  const url = new URL('../packages/prompt-template/runtime.js', import.meta.url).href
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import {compileTemplate} from ${JSON.stringify(url)}; try {compileTemplate('<%'.repeat(65536));process.exitCode=2} catch(e) {if(e.message!=='Unclosed template tag')throw e}`], { timeout: 1500, encoding: 'utf8' })
  assert.equal(child.error, undefined)
  assert.equal(child.status, 0, child.stderr)
})

test('forward tag scanning preserves supported modifiers and rejects unmatched delimiters', async () => {
  await assert.rejects(renderTemplate('plain text', {}, { timeLimit: 0 }), { code: 'TEMPLATE_EXECUTION_LIMIT' })
  assert.equal(await renderTemplate('a  <%_ const n=2; _%> \n <%= "<&" %>|<%- n %>|<%# comment %><%% literal %>'), 'a&lt;&amp;|2|<% literal %>')
  assert.equal(await renderTemplate('a<% -%>\r\nb'), 'ab')
  assert.equal(await renderTemplate('a<% %>\r\nb'), 'a\r\nb')
  assert.equal(compileTemplate('<%'.repeat(20) + '%>').length > 0, true)
  assert.throws(() => compileTemplate('valid<%# comment %>trailing<%'), /Unclosed/)
})
