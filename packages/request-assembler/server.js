import { createAssemblyApi as create, isAssemblyApiPath as match } from 'dsh-prompt-assembler/server'
import { API_V1 } from '../identity.js'
const root = `${API_V1}/assembly-presets`
export const createAssemblyApi = options => create({ ...options, root })
export const isAssemblyApiPath = url => match(url, root)
