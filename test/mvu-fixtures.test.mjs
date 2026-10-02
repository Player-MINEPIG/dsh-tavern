import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MvuService, mvuResourceFromCharacter, parseMvuUpdate, applyMvuUpdate } from '../packages/mvu-adapter/src/index.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/mvu/upstream-literals.json', import.meta.url)))
for (const [index, row] of fixture.cases.entries()) test(`fixed upstream MIT update fixture ${index + 1}`, () => {
  const value = applyMvuUpdate({ stat_data: row.initial, schema: { type: 'object', properties: {}, extensible: true, strictSet: true } }, parseMvuUpdate(row.input))
  assert.deepEqual(value.stat_data, row.expected)
})
test('character InitVar YAML and recognized declarative schema initialize without external code execution', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-init-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const data = { character_book: { entries: [{ comment: '[initvar] disabled initialization', disable: true, content: 'world:\n  day: 1\nplayer:\n  hp: 80' }] }, extensions: { tavern_helper: [['scripts', [{ content: "import {registerMvuSchema} from 'https://example.invalid/mvu_zod.js'; const Schema=z.object({world:z.object({day:z.number()}),player:z.object({hp:z.number(),name:z.string().prefault('Player')})}); $(()=>{registerMvuSchema(Schema);});" }]], ['variables', {}]] } }
  const resource = mvuResourceFromCharacter({ data }, { id: 'mvu:card', sessionIds: ['s'] })
  const service = new MvuService({ storageDir, resources: [resource] })
  assert.deepEqual((await service.read({ id: resource.id, scope: { sessionId: 's' } })).content.stat_data, { world: { day: 1 }, player: { hp: 80, name: 'Player' } })
  data.character_book.entries[0].content = 'world:\n  day: 1  weather: clear'
  assert.throws(() => mvuResourceFromCharacter({ data }, { id: 'mvu:broken', sessionIds: ['s'] }), { code: 'MVU_INITIALIZATION_INVALID' })
  // A synthetic repaired copy, not a mutation of any imported user card.
  data.character_book.entries[0].content = 'world:\n  day: 1\n  weather: clear\nplayer:\n  hp: 80'
  const fixed = mvuResourceFromCharacter({ data }, { id: 'mvu:fixed', sessionIds: ['s'] })
  const fixedService = new MvuService({ storageDir, resources: [fixed] })
  assert.equal((await fixedService.read({ id: fixed.id, scope: { sessionId: 's' } })).content.stat_data.world.day, 1)
})
