import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as tavern from '../packages/tavern-loader/src/bundle.js'

test('Tavern waits for the independent Assembler without starting a private instance', async () => {
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'tavern-shared-'))
  try {
    ctx.provide('systemPrompt', { assemble() {}, section() {} })
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(tavern, { storageDir: join(directory, 'tavern') })
    for (let i = 0; i < 8; i++) {
      await Promise.all([...ctx.registry.values()].flatMap(r => [...r.fibers].map(f => f.await())))
      await new Promise(resolve => setImmediate(resolve))
    }
    assert.equal(Boolean(ctx.get('dshPromptAssembler')), false)
    assert.equal([...ctx.registry.values()].flatMap(r => [...r.fibers]).filter(f => f.runtime.name === 'dsh-prompt-assembler').length, 0)
  } finally {
    await ctx.fiber.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})
