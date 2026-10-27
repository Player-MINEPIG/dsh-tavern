import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('the bundle Host declaration also exposes its client to official DSH discovery', { skip: !runtimeRoot }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
  const { Context } = await load('cordis')
  const { loadOverlayPatches } = await load('dsh-app-boot')
  const { ClientModuleRegistry } = await load('dsh-client-modules')
  const patch = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
  const [row] = loadOverlayPatches('dsh', patch)[0].insert
  const ctx = new Context()
  ctx.provide('loader', { entries: () => [{ options: row, fiber: {}, parent: { tree: { ctx: { baseUrl: pathToFileURL(patch).href } } } }] })
  try {
    await ctx.plugin(ClientModuleRegistry)
    assert.ok(ctx.get('clientModules').graph().entries.some(entry => entry.id === 'pmp-dsh-tavern'), 'running Tavern Host must advertise its browser bundle')
  } finally {
    await ctx.fiber.dispose()
  }
})
