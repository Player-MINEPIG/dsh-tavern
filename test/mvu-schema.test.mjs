import test from 'node:test'
import assert from 'node:assert/strict'
import { compileMvuSchema, applyMvuSchema, parseCommandValue, parseMvuData, applyMvuUpdate, parseMvuUpdate } from '../packages/mvu-adapter/src/index.js'

test('reviewed data parsers accept JSON5/YAML and finite arithmetic without JS evaluation', () => {
  assert.deepEqual(parseCommandValue('{list:[1,2,], enabled:true}'), { list: [1, 2], enabled: true })
  assert.deepEqual(parseMvuData('player:\n  hp: 100\n  inventory: []'), { player: { hp: 100, inventory: [] } })
  assert.equal(parseCommandValue('Math.floor(10 / 3) + sqrt(16)'), 7)
  assert.equal(parseCommandValue('2 ^ 3'), 8)
  assert.equal(parseCommandValue('`literal ${name}`'), 'literal ${name}')
  assert.throws(() => parseCommandValue('process.exit()'))
  assert.throws(() => parseMvuData('!!js/function function() {}'))
  assert.throws(() => parseMvuData('x: &x [*x]'))
})
test('Zod-shaped declarations support coerce, prefault, enum, array, record and transform rules', () => {
  const source = `import { registerMvuSchema } from 'https://example.invalid/mvu_zod.js';
  const tier = v => { if (v < 50) return 'low'; return 'high'; };
  const item = z.object({ score:z.coerce.number().transform(v => _.clamp(v,0,100)).prefault(0), label:z.string().prefault('') }).transform(obj => ({...obj,label:tier(obj.score)}));
  export const Schema = z.object({
    world:z.object({day:z.coerce.number().prefault(1),weather:z.enum(['clear','rain']).prefault('clear')}).prefault({}),
    items:z.record(z.string(),item).prefault({}),
    player:z.object({level:z.number().prefault(1),xp:z.number().prefault(0)}).prefault({}).transform(p=>{if(p.xp>=100){const gain=Math.floor(p.xp/100);p.level+=gain;p.xp=p.xp%100;} return p;}),
    names:z.record(z.enum(['A','B']),z.string().or(z.literal(null)).prefault(null)).prefault({}),
    bag:z.array(z.string()).prefault([])
  }); $(()=>{registerMvuSchema(Schema);});`
  const definition = compileMvuSchema(source)
  const value = applyMvuSchema({ items: { a: { score: '150' } }, player: { xp: 230 } }, definition)
  assert.deepEqual(value, { world: { day: 1, weather: 'clear' }, items: { a: { score: 100, label: 'high' } }, player: { level: 3, xp: 30 }, names: { A: null, B: null }, bag: [] })
  const initial = { stat_data: value, schema: { type: 'object', properties: {}, extensible: true, strictSet: true }, mvu_schema: definition }
  const updated = applyMvuUpdate(initial, parseMvuUpdate("_.set('items.a.score', -1); _.add('player.xp', 80);"))
  assert.equal(updated.stat_data.items.a.score, 0)
  assert.equal(updated.stat_data.items.a.label, 'low')
  assert.equal(updated.stat_data.player.level, 4)
  assert.throws(() => applyMvuSchema({ world: { weather: 'unknown' } }, definition), /enum/)
})
test('schema parser has no import, global object, filesystem, eval, loop or prototype capabilities', () => {
  for (const source of [
    "import x from 'node:fs'; const Schema=z.object({});",
    'const Schema=process.exit();',
    'const Schema=z.object({x:z.number().transform(v=>globalThis.process.exit())});',
    'const Schema=z.object({x:z.number().transform(v=>{while(true){} return v;})});',
  ]) {
    assert.throws(() => { const definition = compileMvuSchema(source); applyMvuSchema({ x: 1 }, definition) })
  }
  assert.throws(() => compileMvuSchema('const Schema=z.object({__proto__:z.string()});'))
})
