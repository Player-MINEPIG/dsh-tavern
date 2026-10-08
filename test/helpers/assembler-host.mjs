import assembler from 'dsh-prompt-assembler/plugin'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
export function installSessionInspection(ctx) {
  const controller = ctx.get('sessionController')
  controller.inspect ??= async id => {
    const session = ctx.sessions.get(id)
    if (!session) throw Object.assign(new Error('Session not found'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' })
    return { events: session.snapshotEvents(), meta: session.header }
  }
}
export async function installCoreExtension(ctx) {
  installSessionInspection(ctx)
  const coreExtension = process.env.DSH_ASSEMBLER_CORE_EXTENSION_ROOT
    ? await import(pathToFileURL(join(process.env.DSH_ASSEMBLER_CORE_EXTENSION_ROOT, 'src/plugin.js')))
    : await import('dsh-prompt-assembler-core')
  await ctx.plugin(coreExtension.default)
}
export async function installIndependentAssembler(ctx, storageDir) {
  installSessionInspection(ctx)
  const installed = ctx.plugin(assembler, { storageDir: join(storageDir, 'independent-assembler') })
  await installed
  await installCoreExtension(ctx)
  return installed
}
