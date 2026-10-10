import { dirname, join } from 'node:path'
import assembler from 'dsh-prompt-assembler/plugin'
import * as tavern from './index.js'
import { installCompanion } from '../../companion.js'
export * from './index.js'

export const name = tavern.name
export const inject = assembler.inject

export async function apply(ctx, config = {}) {
  const storageDir = config.assemblerStorageDir
    ?? ctx.get('dshHomePath')?.('dsh-prompt-assembler')
    ?? (config.storageDir && join(dirname(config.storageDir), 'dsh-prompt-assembler'))
  if (!storageDir) throw new TypeError('Assembler storageDir is required')
  await installCompanion(ctx, assembler, { storageDir, security: config.security }, { service: 'dshPromptAssembler' })
  await ctx.plugin({ ...tavern, name: `${name}-runtime` }, config)
}
