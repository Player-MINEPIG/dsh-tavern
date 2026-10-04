import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { compileMvuSchema, applyMvuSchema, applyMvuUpdate, parseMvuUpdate, MvuService } from '../packages/mvu-adapter/src/index.js'

const helper = 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js'
const register = (expression, url = helper) => `import {registerMvuSchema} from '${url}'; const Schema=${expression}; $(()=>{registerMvuSchema(Schema);});`
const state = (source, stat_data, version = 2) => ({ stat_data, schema: { type: 'object', properties: {}, extensible: true, strictSet: true }, mvu_schema: { ...compileMvuSchema(source), interpreterVersion: version } })
const commands = (source, data, text, version) => applyMvuUpdate(state(source, data, version), parseMvuUpdate(text))

test('fixed registration loosens only the direct root object; nested strict objects retain their own rules', () => {
  const definition = compileMvuSchema(register('z.object({hp:z.number(),child:z.strictObject({hp:z.number()})}).strict()'))
  assert.equal(definition.interpreterVersion, 2)
  assert.deepEqual(applyMvuSchema({ hp: 10, new: true, child: { hp: 2 } }, definition), { hp: 10, new: true, child: { hp: 2 } })
  assert.throws(() => applyMvuSchema({ hp: 10, child: { hp: 2, new: true } }, definition), { code: 'MVU_SCHEMA' })
})
test('Zod object refinements retain object identity at registration; transformed and wrapped roots are not objects', () => {
  const refined = compileMvuSchema(register("z.object({hp:z.number()}).superRefine((v,ctx)=>{ctx.addIssue({code:'custom'});})"))
  assert.deepEqual(applyMvuSchema({ hp: 1, extra: 2 }, refined), { hp: 1, extra: 2 })
  for (const expression of ['z.object({hp:z.number()}).strict().transform(v=>v)', 'z.object({hp:z.number()}).strict().prefault({hp:1})', 'z.object({hp:z.number()}).strict().optional()']) {
    assert.throws(() => applyMvuSchema({ hp: 1, extra: 2 }, compileMvuSchema(register(expression))), { code: 'MVU_SCHEMA' })
  }
  assert.deepEqual(applyMvuSchema([1], compileMvuSchema(register('z.array(z.number())'))), [1])
  assert.throws(() => applyMvuSchema({ a: 1, extra: 2 }, compileMvuSchema(register("z.record(z.enum(['a']),z.number())"))), { code: 'MVU_SCHEMA' })
})
test('automatic root loose requires exact fixed import and registration, not a suffix, query or generic declaration', () => {
  assert.throws(() => compileMvuSchema(register('z.object({hp:z.number()}).strict()', helper + '?other=1')), { code: 'MVU_SCHEMA_CODE' })
  for (const url of ['https://example.invalid/mvu_zod.js']) {
    assert.throws(() => applyMvuSchema({ hp: 1, extra: 2 }, compileMvuSchema(register('z.object({hp:z.number()}).strict()', url))), { code: 'MVU_SCHEMA' })
  }
  const definition = compileMvuSchema(`import {registerMvuSchema} from '${helper}'; const Schema=z.object({hp:z.number()}).strict();`)
  assert.throws(() => applyMvuSchema({ hp: 1, extra: 2 }, definition), { code: 'MVU_SCHEMA' })
})
test('looseObject, strictObject and default object distinguish retention, rejection and stripping', () => {
  assert.deepEqual(applyMvuSchema({ hp: 1, extra: 2 }, compileMvuSchema('const Schema=z.looseObject({hp:z.number()});')), { hp: 1, extra: 2 })
  assert.deepEqual(applyMvuSchema({ hp: 1, extra: 2 }, compileMvuSchema('const Schema=z.object({hp:z.number()});')), { hp: 1 })
  assert.throws(() => applyMvuSchema({ hp: 1, extra: 2 }, compileMvuSchema('const Schema=z.strictObject({hp:z.number()});')), { code: 'MVU_SCHEMA' })
})
test('new Zod set creates missing dictionary members and intermediate paths, then validates the whole candidate', () => {
  const source = 'const Schema=z.object({groups:z.record(z.string(),z.object({people:z.record(z.string(),z.strictObject({hp:z.number()}))}))});'
  const before = { groups: {} }, result = commands(source, before, "_.set('groups.new.people.Ada.hp',10);")
  assert.deepEqual(result.stat_data, { groups: { new: { people: { Ada: { hp: 10 } } } } })
  assert.deepEqual(before, { groups: {} })
  const rejected = commands(source, result.stat_data, "_.set('groups.new.people.Ada.extra',10);")
  assert.deepEqual(rejected.stat_data, result.stat_data); assert.equal(rejected.update_diagnostics[0].code, 'MVU_SCHEMA')
})
test('new Zod insert creates missing dictionaries or arrays with object-first schema validation', () => {
  const source = 'const Schema=z.object({people:z.record(z.string(),z.strictObject({hp:z.number()})).optional(),bag:z.array(z.strictObject({name:z.string()})).optional()});'
  const result = commands(source, {}, "_.insert('people','Ada',{hp:10});_.insert('bag',{name:'rope'});_.insert('bag','-',{name:'potion'});")
  assert.deepEqual(result.stat_data, { people: { Ada: { hp: 10 } }, bag: [{ name: 'rope' }, { name: 'potion' }] })
  assert.deepEqual(result.update_diagnostics, [])
})
test('insert shallow assignment and selected candidate transforms execute once', () => {
  const source = 'const Schema=z.object({bag:z.array(z.object({ticks:z.number()})).optional()}).transform(v=>{for(const item of v.bag){item.ticks+=1;}return v;});'
  const result = commands(source, {}, "_.insert('bag',{ticks:0});")
  assert.equal(result.stat_data.bag[0].ticks, 1)
  const merged = commands('const Schema=z.object({obj:z.record(z.string(),z.record(z.string(),z.number()))});', { obj: { old: { a: 1, b: 2 } } }, "_.insert('obj',{old:{a:3}});")
  assert.deepEqual(merged.stat_data, { obj: { old: { a: 3 } } })
})
test('Zod validation governs numeric set coercion; add still requires an existing numeric source', () => {
  const strict = commands('const Schema=z.object({hp:z.number()});', { hp: 1 }, "_.set('hp','2');")
  assert.deepEqual(strict.stat_data, { hp: 1 }); assert.equal(strict.update_diagnostics[0].code, 'MVU_SCHEMA')
  assert.equal(commands('const Schema=z.object({hp:z.coerce.number()});', { hp: 1 }, "_.set('hp','2');").stat_data.hp, 2)
  const absent = commands('const Schema=z.object({hp:z.number().optional()});', {}, "_.add('hp',2);")
  assert.deepEqual(absent.stat_data, {}); assert.equal(absent.update_diagnostics[0].code, 'MVU_PATH_MISSING')
})
test('JSON, prototype, dense array and envelope budgets still refuse new path candidates', () => {
  const source = 'const Schema=z.looseObject({});'
  for (const path of ['new.__proto__.x', 'new.constructor.x', 'new.prototype.x']) assert.throws(() => commands(source, {}, `_.set('${path}',1);`), { code: 'MVU_PATH' })
  assert.throws(() => commands('const Schema=z.object({xs:z.array(z.number())});', { xs: [] }, "_.set('xs.1000000000',1);"), { code: 'MVU_PATH' })
  assert.throws(() => applyMvuUpdate(state(source, {}), [{ op: 'set', path: ['large'], value: 'x'.repeat(1100 * 1024) }]), { code: 'MVU_LIMIT' })
  assert.throws(() => applyMvuUpdate(state(source, {}), [{ op: 'set', path: ['number'], value: Infinity }]), { code: 'MVU_JSON' })
})
test('v1 descriptors keep root strictness, old path requirements and exact source without automatic conversion', async t => {
  const legacyParameters = { mvuSchema: 1, interpreterVersion: 1, source: "const Schema=z.object({hp:z.number()}, {error:'anonymous'});" }
  assert.deepEqual(applyMvuSchema({hp:1},legacyParameters),{hp:1})
  const source = register('z.object({hp:z.number(),people:z.record(z.string(),z.object({hp:z.number()}))}).strict()')
  const variables = state(source, { hp: 10, people: {} }, 1)
  assert.throws(() => applyMvuSchema({ ...variables.stat_data, extra: 2 }, variables.mvu_schema), { code: 'MVU_SCHEMA' })
  assert.equal(applyMvuUpdate(variables, parseMvuUpdate("_.set('people.Ada.hp',1);")).update_diagnostics[0].code, 'MVU_PATH_MISSING')
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-zod-legacy-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const options = { storageDir, resources: [{ sharing: 'shared', id: 'mvu:old', sessionIds: ['s'], managementMode: 'managed', initial: variables }] }
  let service = new MvuService(options); const path = join(storageDir, 'mvu-instances.json'), bytes = readFileSync(path)
  compileMvuSchema(source); service.dispose(); service = new MvuService(options); t.after(() => service.dispose())
  assert.deepEqual(readFileSync(path), bytes)
  const row = await service.read({ id: 'mvu:old', scope: { sessionId: 's' } }); assert.equal(row.content.mvu_schema.interpreterVersion, 1)
  await assert.rejects(service.update({ id: row.id, scope: row.scope, expectedRevision: 0, operationId: 'old', content: { stat_data: { ...row.content.stat_data, extra: 2 } } }), { code: 'MVU_SCHEMA' })
  assert.deepEqual(readFileSync(path), bytes)
})
test('new source edits preserve descriptor authority, CAS and immutable operation receipts', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-zod-edit-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const service = new MvuService({ storageDir, resources: [{ sharing: 'shared', id: 'mvu:new', sessionIds: ['s'], initial: { stat_data: { hp: 10, child: { hp: 1 } } }, schemaSource: register('z.object({hp:z.number(),child:z.strictObject({hp:z.number()})}).strict()') }] }); t.after(() => service.dispose())
  const scope = { sessionId: 's' }, input = { id: 'mvu:new', scope, expectedRevision: 0, operationId: 'new', content: { stat_data: { hp: 10, child: { hp: 1 }, extra: 2 }, mvu_schema: { source: 'guest' } } }
  await assert.rejects(service.update(input), { code: 'MVU_SCHEMA_CODE' }); delete input.content.mvu_schema
  const result = await service.update(input); assert.equal(result.content.stat_data.extra, 2); assert.equal(result.content.mvu_schema.interpreterVersion, 2)
  assert.deepEqual(await service.update(input), result)
  await assert.rejects(service.update({ ...input, operationId: 'stale' }), { code: 'REVISION_CONFLICT' })
  await assert.rejects(service.update({ ...input, expectedRevision: 1, operationId: 'nested', content: { stat_data: { hp: 10, child: { hp: 1, extra: 2 } } } }), { code: 'MVU_SCHEMA' })
  assert.equal((await service.read({ id: 'mvu:new', scope })).revision, 1)
})
