import { basename, isAbsolute, relative, resolve, sep } from 'node:path'

export const RP_SECRET_BASENAME_PATTERN = /^(?:\.env(?:\..*)?|\.credentials\.ya?ml|credentials\.json|secrets\.json|\.netrc|id_rsa|id_dsa|id_ecdsa|id_ed25519|.+\.(?:pem|key|p12|pfx))$/i

export function isRpSecretBasename(name) {
  return typeof name === 'string' && name !== '' && RP_SECRET_BASENAME_PATTERN.test(name)
}

function normalizeAbs(pathValue) {
  const abs = resolve(pathValue)
  return process.platform === 'win32' ? abs.toLowerCase() : abs
}

export function isInsideWorkspace(target, workspaceRoot) {
  if (typeof target !== 'string' || target === '' || typeof workspaceRoot !== 'string' || workspaceRoot === '') return false
  const rel = relative(normalizeAbs(workspaceRoot), normalizeAbs(target))
  if (rel === '') return true
  if (isAbsolute(rel)) return false
  return rel !== '..' && !rel.startsWith(`..${sep}`)
}

export function resolveRpReadTarget(filePath, workspaceRoot) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return { ok: false, inside: false, secret: false }
  }
  if (typeof workspaceRoot !== 'string' || workspaceRoot.trim() === '') {
    return { ok: false, inside: false, secret: false }
  }
  const abs = resolve(workspaceRoot, filePath)
  return {
    ok: true,
    abs,
    inside: isInsideWorkspace(abs, workspaceRoot),
    secret: isRpSecretBasename(basename(abs)),
  }
}
