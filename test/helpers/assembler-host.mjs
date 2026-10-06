import assembler from 'dsh-prompt-assembler/plugin'
import { join } from 'node:path'
export async function installIndependentAssembler(ctx, storageDir) {
  return ctx.plugin(assembler, { storageDir: join(storageDir, 'independent-assembler') })
}
