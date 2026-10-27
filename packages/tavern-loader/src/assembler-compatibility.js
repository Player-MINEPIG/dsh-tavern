import { createRequire } from 'node:module'

const manifest = createRequire(import.meta.url)('../../../package.json')

export const ASSEMBLER_RANGE = manifest.peerDependencies['dsh-prompt-assembler']
export const ASSEMBLER_INSTALL_URL = 'https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz'

export function requireAssemblerVersion(version, subject) {
  const expected = /^~(\d+)\.(\d+)\.(\d+)$/.exec(ASSEMBLER_RANGE)
  const actual = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '')
  if (!expected || !actual || actual[1] !== expected[1] || actual[2] !== expected[2] || Number(actual[3]) < Number(expected[3])) {
    throw Object.assign(new Error(`${subject}: Assembler ${version ?? 'unknown'} is incompatible; Tavern requires ${ASSEMBLER_RANGE}. Install and enable the independent Assembler / 请安装并启用独立 Assembler: ${ASSEMBLER_INSTALL_URL}`), { code: 'TAVERN_ASSEMBLER_INCOMPATIBLE' })
  }
}

export function requireSharedAssembler(service, config = {}) {
  if (config.assemblerStorageDir !== undefined) {
    throw Object.assign(new Error('Move Tavern assemblerStorageDir to the independent Assembler storageDir, then remove assemblerStorageDir from Tavern / 请将旧路径迁至独立 Assembler 的 storageDir，并移除 Tavern 的 assemblerStorageDir。Existing files are retained / 原有文件保留。'), { code: 'TAVERN_ASSEMBLER_CONFIG_MOVED' })
  }
  requireAssemblerVersion(service?.version, 'Running service / 运行服务')
  if (typeof service.registry?.register !== 'function' || typeof service.store?.applySnapshot !== 'function' || typeof service.attachTavern !== 'function') {
    throw Object.assign(new Error(`Assembler ${ASSEMBLER_RANGE} public services are required / 需要完整的独立 Assembler 公共服务: ${ASSEMBLER_INSTALL_URL}`), { code: 'TAVERN_ASSEMBLER_INCOMPATIBLE' })
  }
  return service
}
