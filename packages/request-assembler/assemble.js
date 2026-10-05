import { assembleRequest as sync, assembleRequestAsync as async } from 'dsh-prompt-assembler'
import { createDefaultRegistry, diagnoseTavernAssembly } from 'dsh-prompt-assembler/adapters/tavern'
export { insertionIndex, textOf } from 'dsh-prompt-assembler/assemble'
export const assembleRequest = options => sync({ ...options, afterAssembly: diagnoseTavernAssembly, registry: options.registry ?? createDefaultRegistry() })
export const assembleRequestAsync = options => async({ ...options, afterAssembly: diagnoseTavernAssembly, registry: options.registry ?? createDefaultRegistry() })
