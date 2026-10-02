// Bounded synthetic review probes. No real cards, profiles, providers or network.
// Run: node --test test/mvu-independent-schema.test.mjs

import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const src = join(root, 'packages/mvu-adapter/src')
const files = ['schema.js', 'data.js', 'value.js', 'updates.js']
const hashes = () => Object.fromEntries(files.map(name => [name, createHash('sha256').update(readFileSync(join(src, name))).digest('hex')]))
const beforeHashes = hashes()
const { compileMvuSchema, applyMvuSchema } = await import(pathToFileURL(join(src, 'schema.js')).href)
const { applyMvuUpdate, parseMvuUpdate } = await import(pathToFileURL(join(src, 'updates.js')).href)
const { parseMvuData, parseCommandValue } = await import(pathToFileURL(join(src, 'data.js')).href)
const results = [], observations = []
function check(name, run) {
  test(name, run)
}
const variables = (stat_data, mvu_schema) => ({ stat_data, mvu_schema, schema: { type: 'object', properties: {}, extensible: true, strictSet: true } })

check('pure requested record/union/literal/clamp/floor/arithmetic/spread', () => {
  const d = compileMvuSchema("const Schema=z.object({kind:z.union([z.literal('a'),z.literal('b')]),stats:z.record(z.string(),z.number()),x:z.number()}).transform(v=>({...v,x:v.x>0?_.clamp(Math.floor(v.x+1),0,10):0}));")
  assert.deepEqual(applyMvuSchema({ kind: 'a', stats: { score: 2 }, x: 9.8 }, d), { kind: 'a', stats: { score: 2 }, x: 10 })
})
check('dynamic prototype key is denied', () => {
  assert.throws(() => applyMvuSchema({}, compileMvuSchema("const Schema=z.any().transform(v=>v['__'+'proto__']);")))
})
check('YAML aliases and executable tags are denied', () => {
  assert.throws(() => parseMvuData('x: &x [*x]'))
  assert.throws(() => parseMvuData('!!js/function function() {}'))
})
check('JSON5 non-finite data is denied', () => {
  assert.throws(() => parseCommandValue('{value:Infinity}'))
})
check('captured state cannot change repeated results', () => {
  let d
  try { d = compileMvuSchema('const counter={n:0}; const Schema=z.number().transform(v=>{counter.n+=1;return v+counter.n;});') }
  catch (error) { if (error.code === 'MVU_SCHEMA_CODE') return; throw error }
  const first = applyMvuSchema(10, d)
  assert.equal(applyMvuSchema(10, d), first)
})
check('array max is enforced', () => {
  const d = compileMvuSchema('const Schema=z.array(z.number()).max(1);')
  assert.throws(() => applyMvuSchema([1, 2], d))
})
check('ordinary builtin-named data remains ordinary data', () => {
  const d = compileMvuSchema('const Schema=z.any().transform(v=>v.floor);')
  assert.equal(applyMvuSchema({ builtin: 'Math', floor: 7 }, d), 7)
})
check('forged unsupported schema kind is denied', () => {
  assert.throws(() => applyMvuSchema({ hp: 'wrong' }, compileMvuSchema("const Schema={mvuSchema:1,kind:'unsupported'};")))
})
const counterSchema = compileMvuSchema('const Schema=z.object({ticks:z.number(),hp:z.number()}).transform(v=>({...v,ticks:v.ticks+1}));')
check('zero commands do not run transform', () => {
  assert.deepEqual(applyMvuUpdate(variables({ ticks: 0, hp: 10 }, counterSchema), []).stat_data, { ticks: 0, hp: 10 })
})
check('one accepted command runs transform once', () => {
  assert.deepEqual(applyMvuUpdate(variables({ ticks: 0, hp: 10 }, counterSchema), parseMvuUpdate("_.set('hp',9);")).stat_data, { ticks: 1, hp: 9 })
})
check('ordinary rejected command is skipped and next valid command continues', () => {
  const d = compileMvuSchema('const Schema=z.object({hp:z.number().min(0)});')
  const input = variables({ hp: 10 }, d)
  const out = applyMvuUpdate(input, parseMvuUpdate("_.set('hp',9);_.set('hp',-1);_.set('hp',8);"))
  assert.equal(out.stat_data.hp, 8)
  assert.equal(out.update_diagnostics.length, 1)
  assert.equal(input.stat_data.hp, 10)
})
// <= 10,020 small numeric entries. Do not increase this probe.
check('schema traversal exhaustion is a fatal MVU_LIMIT', () => {
  const d = compileMvuSchema('const Schema=z.array(z.number());')
  assert.throws(() => applyMvuSchema(Array(10020).fill(1), d), { code: 'MVU_LIMIT' })
})
check('fatal schema budget exhaustion does not return partially accepted state', () => {
  const d = compileMvuSchema('const Schema=z.object({hp:z.number(),bag:z.array(z.number())});')
  const input = variables({ hp: 10, bag: [] }, d)
  assert.throws(() => applyMvuUpdate(input, [{ op: 'set', path: ['hp'], value: 9 }, { op: 'set', path: ['bag'], value: Array(10020).fill(1) }]), { code: 'MVU_LIMIT' })
  assert.equal(input.stat_data.hp, 10)
})
check('array length cannot be changed as an MVU field', () => {
  const input = { stat_data: { bag: [] } }
  // A safe bounded sample; never substitute a large array length here.
  try {
    const out = applyMvuUpdate(input, parseMvuUpdate("_.set('bag.length',20000);"))
    observations.push({ name: 'array-length-output', arrayLength: out.stat_data.bag.length, jsonBytes: JSON.stringify(out).length })
    assert.equal(out.stat_data.bag.length, 0)
  } catch (error) {
    if (['MVU_PATH', 'MVU_UNSUPPORTED', 'MVU_SCHEMA', 'MVU_LIMIT'].includes(error.code)) return
    throw error
  }
})
// Small output-growth measurements only; deliberately stop at eight captures.
for (const n of [4, 6, 8]) {
  let source = 'const f0=x=>x;\n'
  for (let i = 1; i <= n; i++) source += `const f${i}=x=>x;\n`
  source += `const Schema=z.number().transform(f${n});`
  try { observations.push({ name: 'closure-serialization-growth', previousFunctions: n, sourceBytes: source.length, outputBytes: JSON.stringify(compileMvuSchema(source)).length }) }
  catch (error) { observations.push({ name: 'closure-serialization-growth', previousFunctions: n, error: error.code ?? error.name }) }
}

test('schema serialization grows with source, not captured environment graphs', () => { for (const item of observations.filter(x => x.name === 'closure-serialization-growth')) assert.ok(item.error === 'MVU_LIMIT' || item.outputBytes < item.sourceBytes * 3) })
