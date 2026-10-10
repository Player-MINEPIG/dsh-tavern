import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { installCompanion } from '../packages/companion.js'

async function settle(ctx) {
  for (let i = 0; i < 8; i++) {
    await Promise.all([...ctx.registry.values()].flatMap(r => [...r.fibers].map(f => f.await())))
    await new Promise(resolve => setImmediate(resolve))
  }
}
for (const order of ['tavern-only', 'independent-first', 'tavern-first', 'simultaneous']) {
  test(`Cordis companion hands off without duplicate services/effects: ${order}`, async t => {
    const ctx = new Context(), live = new Set(), calls = []
    t.after(() => ctx.fiber.dispose())
    const companion = { name: 'example-companion', apply(scope, config) {
      assert.equal(live.size, 0, 'previous instance effects released before new apply')
      live.add(scope.fiber)
      scope.effect(() => () => live.delete(scope.fiber))
      scope.provide('exampleCompanion', { config })
      scope.on('example/request', () => calls.push(config.owner))
    } }
    const owner = { name: 'example-owner', apply: scope => installCompanion(scope, companion, { owner: 'bundled' }, { service: 'exampleCompanion' }) }
    let bundled, independent
    if (order === 'independent-first') { independent = ctx.plugin(companion, { owner: 'independent' }); await independent }
    bundled = ctx.plugin(owner)
    if (order === 'simultaneous') independent = ctx.plugin(companion, { owner: 'independent' })
    await bundled
    if (order === 'tavern-first') { independent = ctx.plugin(companion, { owner: 'independent' }); await independent }
    await settle(ctx)
    assert.equal(live.size, 1)
    ctx.emit('example/request')
    assert.deepEqual(calls, [independent ? 'independent' : 'bundled'])
    if (independent) {
      await bundled.dispose(); await settle(ctx)
      assert.equal(live.size, 1, 'removing Tavern retains independent effects')
      ctx.emit('example/request'); assert.equal(calls.at(-1), 'independent')
      bundled = ctx.plugin(owner); await bundled
      await independent.dispose(); await settle(ctx)
      assert.equal(live.size, 1, 'removing independent owner restores bundled instance')
      ctx.emit('example/request'); assert.equal(calls.at(-1), 'bundled')
    }
    await bundled.dispose(); await settle(ctx)
    assert.equal(live.size, 0)
    assert.equal(ctx.get('exampleCompanion'), undefined)
  })
}
test('disposing both owners together does not resurrect a companion', async () => {
  const ctx = new Context()
  const plugin = { name: 'example-companion', apply: scope => scope.provide('exampleCompanion', {}) }
  const owner = ctx.plugin({ name: 'owner', apply: scope => installCompanion(scope, plugin, {}, { service: 'exampleCompanion' }) }); await owner
  const independent = ctx.plugin(plugin); await independent
  await Promise.all([owner.dispose(), independent.dispose()]); await settle(ctx)
  assert.equal(ctx.get('exampleCompanion'), undefined)
  await ctx.fiber.dispose()
})
