import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import assembler from 'dsh-prompt-assembler/plugin'
import * as bundle from '../packages/tavern-loader/src/host.js'

async function settle(ctx) {
  for (let i = 0; i < 8; i++) {
    await Promise.all([...ctx.registry.values()].flatMap(r => [...r.fibers].map(f => f.await())))
    await new Promise(resolve => setImmediate(resolve))
  }
}
for (const order of ['assembler-first', 'tavern-first', 'simultaneous']) {
  test(`Tavern consumes the independent Assembler without owning its lifetime: ${order}`, async t => {
    const dir = mkdtempSync(join(tmpdir(), 'tavern-bundle-')), ctx = new Context(), routes = new Map()
    t.after(async () => { await ctx.fiber.dispose(); rmSync(dir, { recursive: true, force: true }) })
    const server = createServer((req, res) => {
      const route = [...routes.values()].find(r => req.url.startsWith(r.path))
      if (route) return route.handler(req, res)
      res.writeHead(404); res.end()
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    ctx.provide('systemPrompt', { assemble() {}, section() {} })
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    ctx.provide('connection', { admit: () => ({ peer: { principal: { kind: 'owner' } } }) })
    ctx.provide('webServer', { register(route) {
      assert.ok(!routes.has(route.path), `duplicate HTTP route: ${route.path}`)
      routes.set(route.path, route)
      return () => routes.delete(route.path)
    } })
    const mount = () => ctx.plugin(bundle, { storageDir: join(dir, 'tavern') })
    const mountAssembler = () => ctx.plugin(assembler, { storageDir: join(dir, 'assembler') })
    let standalone
    if (order === 'assembler-first') { standalone = mountAssembler(); await standalone }
    let tavern = mount()
    if (order !== 'assembler-first') standalone = mountAssembler()
    await Promise.all([tavern, standalone]); await settle(ctx)
    const face = ctx.get('dshPromptAssembler')
    assert.ok(face)
    assert.equal([...ctx.registry.values()].flatMap(r => [...r.fibers]).filter(f => f.runtime.name === assembler.name && f.state === 2).length, 1)
    const strategy = face.store.save({ ...face.store.get('builtin-native-slots'), name: 'Retained strategy' })
    face.store.apply('session-test', strategy.id)
    const origin = `http://127.0.0.1:${server.address().port}`
    const read = path => fetch(origin + path, { headers: { Origin: origin } })
    assert.equal((await read('/pmp-dsh-tavern/api/v1/presets')).status, 200)
    assert.equal((await read('/dsh-prompt-assembler/api/v1/assembly-presets')).status, 200)
    await tavern.dispose(); await settle(ctx)
    assert.equal(ctx.get('dshPromptAssembler'), face)
    assert.equal(face.store.selection('session-test').id, strategy.id)
    assert.equal((await read('/pmp-dsh-tavern/api/v1/presets')).status, 404)
    assert.equal((await read('/dsh-prompt-assembler/api/v1/assembly-presets')).status, 200)
    tavern = mount(); await tavern; await settle(ctx)
    await standalone.dispose(); await settle(ctx)
    assert.equal(Boolean(ctx.get('dshPromptAssembler')), false)
    assert.equal(routes.size, 0)
    standalone = mountAssembler(); await standalone; await settle(ctx)
    assert.equal(ctx.get('dshPromptAssembler').store.selection('session-test').id, strategy.id)
    assert.equal((await read('/pmp-dsh-tavern/api/v1/presets')).status, 200)
  })
}
