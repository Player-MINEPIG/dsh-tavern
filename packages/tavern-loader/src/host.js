import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { PLUGIN_ID } from '../../identity.js'
import { ASSEMBLER_INSTALL_URL, requireAssemblerVersion, requireSharedAssembler } from './assembler-compatibility.js'

const require = createRequire(import.meta.url)
let peer
try {
  peer = require.resolve('dsh-prompt-assembler/package.json')
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error
  throw Object.assign(new Error(`Tavern requires the independent Assembler. Install and enable it first / 请先安装并启用独立 Assembler: ${ASSEMBLER_INSTALL_URL}`, { cause: error }), { code: 'TAVERN_ASSEMBLER_MISSING' })
}
requireAssemblerVersion(JSON.parse(readFileSync(peer)).version, 'SDK package / SDK 软件包')

export const name = PLUGIN_ID
export const inject = ['systemPrompt', 'sessionController', 'workspaceController', 'directoryPickerController', 'dshPromptAssembler']

export async function apply(ctx, config = {}) {
  requireSharedAssembler(ctx.get('dshPromptAssembler'), config)
  const runtime = await import('./index.js')
  runtime.apply(ctx, config)
}
