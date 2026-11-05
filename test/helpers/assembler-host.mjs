import assembler from 'dsh-prompt-assembler/plugin'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
// Historical optional core fixtures require their own explicitly supplied runtime.
export function installSessionInspection() {}
export async function installCoreExtension(ctx) {
  const coreExtension = process.env.DSH_ASSEMBLER_CORE_EXTENSION_ROOT
    ? await import(pathToFileURL(join(process.env.DSH_ASSEMBLER_CORE_EXTENSION_ROOT, 'src/plugin.js')))
    : await import('dsh-prompt-assembler-core')
  await ctx.plugin(coreExtension.default)
}
export async function installIndependentAssembler(ctx, storageDir) {
  const installed = ctx.plugin(assembler, { storageDir: join(storageDir, 'independent-assembler') })
  await installed
  return installed
}
