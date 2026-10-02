// Independent bounded synthetic review. Never reads profiles, cards, or providers.
// Run: node --test test/mvu-schema-adversarial.test.mjs
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const names = ['schema.js', 'value.js', 'data.js', 'updates.js']
const hashes = async () => Object.fromEntries(await Promise.all(names.map(async name => [name, createHash('sha256').update(await readFile(`${root}/packages/mvu-adapter/src/${name}`)).digest('hex')])))
const before = await hashes()
const { compileMvuSchema, applyMvuSchema } = await import(pathToFileURL(`${root}/packages/mvu-adapter/src/schema.js`))
const { parseMvuUpdate, applyMvuUpdate } = await import(pathToFileURL(`${root}/packages/mvu-adapter/src/updates.js`))
const run = (source, value) => applyMvuSchema(value, compileMvuSchema(source))
const results = []
function check(name, fn) { test(name, fn) }
function expectCode(fn, code) { assert.throws(fn, error => error.code === code) }

const bagVariables = () => ({ stat_data: { bag: ['rope', 'potion'] }, schema: { type: 'object', extensible: true, properties: { bag: { type: 'array', extensible: true, elementType: { type: 'any' } } } } })
check('JSONPatch remove length/noninteger reject without deleting first item', () => {
  for (const key of ['length', '-1', '0.5', '01']) {
    const initial = bagVariables()
    expectCode(() => applyMvuUpdate(initial, parseMvuUpdate(`<jsonpatch>[{"op":"remove","path":"/bag/${key}"}]</jsonpatch>`)), 'MVU_PATH')
    assert.deepEqual(initial.stat_data.bag, ['rope', 'potion'])
  }
})
check('missing sparse-index removal is skipped and existing removal works', () => {
  const initial = bagVariables()
  const absent = applyMvuUpdate(initial, parseMvuUpdate('<jsonpatch>[{"op":"remove","path":"/bag/99"}]</jsonpatch>'))
  assert.deepEqual(absent.stat_data.bag, ['rope', 'potion'])
  assert.deepEqual(absent.update_diagnostics, [{ command: 0, code: 'MVU_PATH_MISSING' }])
  const existing = applyMvuUpdate(initial, parseMvuUpdate('<jsonpatch>[{"op":"remove","path":"/bag/0"}]</jsonpatch>'))
  assert.deepEqual(existing.stat_data.bag, ['potion'])
})
check('sparse insertion cannot create holes', () => {
  const initial = bagVariables()
  expectCode(() => applyMvuUpdate(initial, parseMvuUpdate('<jsonpatch>[{"op":"insert","path":"/bag/99","value":"x"}]</jsonpatch>')), 'MVU_PATH')
  assert.deepEqual(initial.stat_data.bag, ['rope', 'potion'])
})

check('captured object is immutable even through a local alias', () => {
  expectCode(() => run('const state={n:0}; const Schema=z.number().transform(v=>{const alias=state; alias.n+=1; return v+alias.n;});', 1), 'MVU_SCHEMA_CODE')
})
check('allocated local object remains mutable', () => {
  assert.equal(run('const Schema=z.number().transform(v=>{const out={n:v}; out.n+=1; return out.n;});', 1), 2)
})
check('block const shadow does not overwrite outer const', () => {
  assert.equal(run('const Schema=z.number().transform(v=>{const n=1; if(v>0){const n=2;} return n;});', 1), 1)
})
check('optional own-field nullish fallback works on absent data', () => {
  assert.deepEqual(run('const Schema=z.object({n:z.number().optional()}).transform(v=>({...v,n:v.n??0}));', {}), { n: 0 })
})
check('strict null comparison is a permitted scalar conditional', () => {
  assert.equal(run('const Schema=z.number().nullable().transform(v=>v===null?0:v);', null), 0)
})
check('repeated min and max retain earlier constraints', () => {
  expectCode(() => run('const Schema=z.number().min(5).min(2);', 3), 'MVU_SCHEMA')
  expectCode(() => run('const Schema=z.number().max(2).max(5);', 3), 'MVU_SCHEMA')
})
check('record uses the transformed key', () => {
  assert.deepEqual(run('const Schema=z.record(z.string().transform(k=>"prefix_"+k),z.number());', { a: 1 }), { prefix_a: 1 })
})
check('nonfinite unary intermediate is rejected even if later hidden', () => {
  expectCode(() => run('const Schema=z.string().transform(v=>+v>0?1:0);', '1e400'), 'MVU_LIMIT')
})
check('long-key output is rejected before oversize JSON serialization', () => {
  // 2 KiB key * 2048 shared leaves = about 4 MiB, safely bounded under 96 MiB.
  // Observe serialization, without replacing parsing, arithmetic, or validation.
  const input = { ['k'.repeat(2048)]: 0 }
  const source = 'const Schema=z.unknown().transform(v=>{' + Array.from({ length: 11 }, (_, i) => `const x${i}={l:${i ? `x${i-1}` : 'v'},r:${i ? `x${i-1}` : 'v'}};`).join('') + 'return x10;});'
  const stringify = JSON.stringify
  let largestSerialized = 0
  JSON.stringify = function (value, ...args) { const text = stringify.call(this, value, ...args); if (typeof text === 'string') largestSerialized = Math.max(largestSerialized, text.length); return text }
  try { expectCode(() => run(source, input), 'MVU_LIMIT') } finally { JSON.stringify = stringify }
  assert.ok(largestSerialized <= 2 * 1024 * 1024, `serialized ${largestSerialized} characters before rejecting the 2 MiB budget`)
  return { largestSerialized }
})
const after = await hashes()
const stable = names.every(name => before[name] === after[name])
