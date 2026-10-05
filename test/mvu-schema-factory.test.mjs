import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileMvuSchema, applyMvuSchema, MvuService, createCharacterDiscovery, characterMvuId } from '../packages/mvu-adapter/src/index.js'

// Original synthetic declarations: no private card source or profile is embedded.
const factory = `import {registerMvuSchema} from 'https://example.invalid/mvu_zod.js';
const make = function make(z, options = {}) {
  const object = shape => options?.stripUnknown ? z.object(shape).strip() : z.object(shape).strict();
  const score = (initial = 3) => z.coerce.number().prefault(initial).transform(v => Math.max(0, Math.trunc(v)));
  const item = object({mode:z.enum(['basic','pro']).prefault('basic'),extra:z.number().optional(),score:score()}).superRefine((value,ctx) => {
    const forbidden = ['extra'];
    const reject = (path,message) => ctx.addIssue({code:z.ZodIssueCode.custom,path,message});
    if(value.mode === 'basic') {
      for(const key of forbidden) {
        if(Object.prototype.hasOwnProperty.call(value,key)) reject([key],'Field requires pro mode');
      }
    }
  }).prefault({});
  return object({item,time:z.string().regex(/^([0-1]\\d|2[0-3]):[0-5]\\d$/).prefault('08:15')});
};
export const Schema = make(z);
$(() => registerMvuSchema(Schema));`
const run = (source, value) => applyMvuSchema(value, compileMvuSchema(source))

test('named schema factory handles defaults, captured parameters and expression registration', () => {
  const definition = compileMvuSchema(factory)
  assert.equal(definition.source, factory)
  assert.deepEqual(applyMvuSchema({}, definition), { item: { mode: 'basic', score: 3 }, time: '08:15' })
  const input = { item: { mode: 'pro', extra: 9, score: '-2.5' }, time: '23:59' }
  assert.deepEqual(applyMvuSchema(input, definition), { item: { mode: 'pro', extra: 9, score: 0 }, time: '23:59' })
  assert.equal(input.item.score, '-2.5')
  assert.deepEqual(applyMvuSchema({}, definition), applyMvuSchema({}, definition))
})
test('strip and strict honor factory options and the last object mode', () => {
  assert.throws(() => run(factory, { unknown: 1 }), { code: 'MVU_SCHEMA' })
  assert.deepEqual(run(factory.replace('make(z);', 'make(z,{stripUnknown:true});'), { unknown: 1, item: { unknown: 2 } }), { item: { mode: 'basic', score: 3 }, time: '08:15' })
  assert.deepEqual(run('const Schema=z.object({n:z.number()}).strict().passthrough().strip();', { n: 1, x: 2 }), { n: 1 })
})
test('callbacks ignore extra arguments and defaults retain parameter initialization order', () => {
  for (const fn of ['()=>{}', 'v=>{}', 'function(v){}']) assert.equal(run(`const Schema=z.number().superRefine(${fn});`, 1), 1)
  assert.equal(run('const make=(x=1,f=()=>x)=>z.literal(f());const Schema=make();', 1), 1)
  assert.equal(run('const make=(f=()=>x,x=1)=>z.literal(f());const Schema=make();', 1), 1)
  assert.equal(run('const f=()=>x;const x=7;const Schema=z.literal(f());', 7), 7)
  assert.equal(run('const make=function(){const f=()=>x;const x=7;return z.literal(f());};const Schema=make();', 7), 7)
  for (const source of ['const x=9;const make=(x=x)=>z.literal(x);const Schema=make();', 'const y=9;const make=(x=y,y=1)=>z.literal(x);const Schema=make();']) assert.throws(() => compileMvuSchema(source), { code: 'MVU_SCHEMA_CODE' })
})
test('refinement collects custom own-field issues and does not mutate the caller', () => {
  const input = { item: { extra: 9 } }
  assert.throws(() => run(factory, input), error => error.code === 'MVU_SCHEMA' && error.issues[0].path[0] === 'extra')
  assert.deepEqual(input, { item: { extra: 9 } })
  assert.throws(() => run('const Schema=z.object({n:z.number()}).superRefine((v,ctx)=>{v.n=99;});', { n: 1 }), { code: 'MVU_SCHEMA_CODE' })
  assert.throws(() => run('const Schema=z.number().superRefine((v,ctx)=>ctx.addIssue({code:"custom",path:["__proto__"]}));', 1))
  assert.throws(() => run('const Schema=z.number().superRefine((v,ctx)=>ctx.addIssue({code:"custom",unexpected:1}));', 1), { code: 'MVU_SCHEMA_CODE' })
  assert.deepEqual(run('const Schema=z.object({n:z.number().optional().superRefine(v=>{})});', {}), {})
  assert.equal(run('const Schema=z.number().superRefine((v,ctx)=>{if(v>0)return;ctx.addIssue({code:"custom"});});', 1), 1)
  assert.throws(() => run('const Schema=z.number().superRefine((v,ctx)=>{if(v>0)return;ctx.addIssue({code:"custom"});});', 0), { code: 'MVU_SCHEMA' })
})
test('optional chains short-circuit own fields without evaluating a missing key', () => {
  assert.equal(run('const Schema=z.unknown().transform(v=>v?.a.b??0);', null), 0)
  assert.equal(run('const Schema=z.unknown().transform(v=>v?.[v.missing.bad]??0);', null), 0)
  assert.throws(() => run('const Schema=z.unknown().transform(v=>v?.a.b);', {}), { code: 'MVU_SCHEMA_CODE' })
  assert.throws(() => run('const Schema=z.unknown().transform(v=>v?.["__"+"proto__"]);', {}))
})
test('finite regex accepts alternatives/ranges/repetitions and rejects invalid values', () => {
  const source = 'const Schema=z.string().regex(/^(ab|c){1,2}[0-9]?$/);'
  for (const value of ['ab', 'c', 'abc', 'cc9']) assert.equal(run(source, value), value)
  for (const value of ['', 'ababc', 'abx', 'cc99']) assert.throws(() => run(source, value), { code: 'MVU_SCHEMA' })
  for (const time of ['24:00', '2:00', '12:60', '12:00x']) assert.throws(() => run(factory, { time }), { code: 'MVU_SCHEMA' })
})
test('regex literals cannot request unbounded matching, lookarounds, backreferences or flags', () => {
  for (const pattern of ['/^(a+)+$/', '/^(a*)$/', '/^(a)\\1$/', '/^(?=a)a$/', '/a/', '/^a$/i', '/^a{65}$/', '/^.$/', '/^a|b$/']) assert.throws(() => compileMvuSchema(`const Schema=z.string().regex(${pattern});`))
  assert.throws(() => compileMvuSchema('const Schema=z.string().regex({states:[]});'), { code: 'MVU_SCHEMA_CODE' })
  assert.throws(() => compileMvuSchema('const Schema=z.string().regex(/^(a{64}){64}$/);'), { code: 'MVU_LIMIT' })
  assert.throws(() => run('const Schema=z.array(z.string().regex(/^a{64}$/));', Array(100).fill('a'.repeat(64))), { code: 'MVU_LIMIT' })
})
test('repeated regex construction shares one schema graph budget', () => {
  const keys = Array.from({ length: 200 }, (_, i) => `"field${i}"`).join(',')
  const source = `const make=function(){const shape={};for(const key of [${keys}]){shape[key]=z.string().regex(/^(a{32}){32}$/);}return z.object(shape);};const Schema=make();`
  assert.throws(() => compileMvuSchema(source), { code: 'MVU_LIMIT' })
})
test('parameter bindings and loop environment copies consume shared fuel', () => {
  const params = Array.from({ length: 100 }, (_, i) => `p${i}`).join(',')
  const values = Array(100).fill('1').join(',')
  assert.throws(() => compileMvuSchema(`const f=function(${params}){return z.number();};const make=function(){for(const n of [${values}]){f();}return z.number();};const Schema=make();`), { code: 'MVU_LIMIT' })
  const bindings = Array.from({ length: 100 }, (_, i) => `const c${i}=1;`).join('')
  assert.throws(() => compileMvuSchema(`const make=function(){${bindings}for(const n of [${values}]){}return z.number();};const Schema=make();`), { code: 'MVU_LIMIT' })
})
test('array iteration is finite, shares fuel and cannot introduce other loops', () => {
  const source = 'const Schema=z.array(z.number()).superRefine((xs,ctx)=>{for(const n of xs){if(n<0)ctx.addIssue({code:"custom"});}});'
  assert.deepEqual(run(source, [1, 2]), [1, 2])
  assert.throws(() => run(source, [-1]), { code: 'MVU_SCHEMA' })
  assert.throws(() => run(source, Array(1001).fill(1)), { code: 'MVU_LIMIT' })
  for (const body of ['for(;;){}', 'while(true){}', 'for(const n in v){}', 'for(let n of v){}']) assert.throws(() => run(`const Schema=z.unknown().transform(v=>{${body}return v;});`, [1]))
  assert.throws(() => compileMvuSchema('const make=function(){const items=["x"];const shape={};for(const items of items){shape[items]=z.number();}return z.object(shape);};const Schema=make();'), { code: 'MVU_SCHEMA_CODE' })
})
test('interpreter functions, cells and AST remain opaque data capabilities', () => {
  for (const source of [
    'const Schema=z.number().transform(v=>{const captured={n:1};const f=()=>captured.n;const cell=f.env.captured;cell.value={n:99};return f();});',
    'const Schema=z.number().transform(v=>{const x=3;const f=()=>x;return f.env.x;});',
    'const tweak=f=>{const ast=f.body;ast.value=99;return f;};const Schema=z.number().transform(tweak(()=>1));',
    'const tweak=f=>({...f});const Schema=z.number().transform(v=>tweak(()=>1));',
    'const Schema=z.unknown().transform(v=>({nested:/^a$/}));',
    'const Schema=z.unknown().transform(v=>({nested:()=>1}));',
    'const Schema=z.unknown().transform(v=>({nested:z.number()}));',
    'const Object={};const Schema=z.unknown().transform(v=>Object.prototype.hasOwnProperty.call(v,"x"));',
  ]) assert.throws(() => run(source, source.includes('Schema=z.number()') ? 1 : { x: 1 }), { code: 'MVU_SCHEMA_CODE' })
})
test('functions retain the isolation boundary for dead code, captures and prototype capabilities', () => {
  for (const body of ['this', 'arguments', 'globalThis', 'fetch(v)', 'new Date()', 'Object.prototype', 'Object.prototype.hasOwnProperty.call(v,"constructor")']) assert.throws(() => run(`const Schema=z.unknown().transform(function(v){return ${body};});`, {}))
  for (const fn of ['async function(v){return v;}', 'function*(v){yield v;}', 'function(...v){return v;}', 'function({n}){return n;}', 'function(v=fetch()){return v;}']) assert.throws(() => compileMvuSchema(`const Schema=z.number().transform(${fn});`))
  assert.throws(() => compileMvuSchema('const make=function(){const capture={n:0};return z.number().transform(v=>{capture.n+=1;return v;});};const Schema=make();'), { code: 'MVU_SCHEMA_CODE' })
  assert.throws(() => compileMvuSchema('const make=function recur(z){return recur(z);};const Schema=make(z);'), { code: 'MVU_LIMIT' })
  assert.throws(() => compileMvuSchema('const Schema=z.any(); $(function(){registerMvuSchema(Schema);fetch();});'))
})
test('invalid refined edits leave durable state and revision unchanged', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-factory-edit-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const service = new MvuService({ storageDir, resources: [{ sharing: 'shared', id: 'mvu:factory', sessionIds: ['s'], initial: { stat_data: {} }, schemaSource: factory }] })
  t.after(() => service.dispose())
  const before = await service.read({ id: 'mvu:factory', scope: { sessionId: 's' } })
  await service.update({ id: before.id, content: before.content, expectedRevision: before.revision, operationId: 'materialize', scope: { sessionId: 's' } })
  const current = await service.read({ id: before.id, scope: { sessionId: 's' } }), path = join(storageDir, 'mvu-instances.json'), bytes = readFileSync(path)
  const content = structuredClone(current.content); content.stat_data.item.extra = 9
  await assert.rejects(service.update({ id: before.id, content, expectedRevision: current.revision, operationId: 'invalid', scope: { sessionId: 's' } }), { code: 'MVU_SCHEMA' })
  assert.deepEqual(readFileSync(path), bytes)
  assert.equal((await service.read({ id: before.id, scope: { sessionId: 's' } })).revision, current.revision)
})
test('failed schema discovery repairs the same resource without changing management or replaying history', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-factory-discovery-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const id = characterMvuId('synthetic-factory-card'), events = [{ seq: 0, type: 'sandbox/mode', data: { mode: 'read-only' } }]
  let service
  const card = { data: { character_book: { entries: [{ comment: '[initvar]', content: '{}' }] }, extensions: { tavern_helper: { scripts: [{ content: factory }] } } } }
  const refresh = createCharacterDiscovery({ characters: { list: () => [{ id: 'synthetic-factory-card', name: 'Factory fixture' }], get: () => card }, selections: { get: sessionId => ({ characterCardId: sessionId === 's' ? 'synthetic-factory-card' : null }) }, service: () => service })
  const options = { storageDir, refresh, inspect: async () => ({ header: { id: 's', version: 4, createdAt: 1 }, events }) }
  service = new MvuService(options)
  await service.discover({ definition: { id, characterId: 'synthetic-factory-card', discovered: true, managementMode: 'managed', sessionIds: ['s'], sourceError: 'MVU_SCHEMA_CODE', initial: { stat_data: {} } } })
  await refresh('s')
  const [record] = await service.list({ scope: { sessionId: 's' } })
  assert.equal(record.templateId, id); const instanceId = record.id; assert.equal(record.sourceError, undefined); assert.equal(record.managementMode, 'native')
  assert.equal(record.content.mvu_schema.source, factory)
  assert.deepEqual(record.content.stat_data, { item: { mode: 'basic', score: 3 }, time: '08:15' })
  assert.equal(service.resources[0].activationSeqs.s, 1)
  assert.equal((await service.resolveRequest({ sessionId: 's' })).blocks.length, 1)
  await assert.rejects(service.read({ id: instanceId, scope: { sessionId: 'other' } }), { code: 'SCOPE_MISMATCH' })
  service.dispose(); service = new MvuService(options)
  t.after(() => service.dispose())
  assert.equal((await service.read({ id: instanceId, scope: { sessionId: 's' } })).id, instanceId)
})
