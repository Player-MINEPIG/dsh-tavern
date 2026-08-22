import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { httpError } from './http.js'

const MAX_RELATIVE_PATH_CHARACTERS = 512

function isRecordSep(ch) {
  return ch === '/' || ch === '\\'
}

export function splitRelativeSegments(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    throw httpError(400, 'path must be a non-empty relative path', 'PLAY_PATH_INVALID')
  }
  if (relativePath.length > MAX_RELATIVE_PATH_CHARACTERS) {
    throw httpError(400, 'path exceeds the length limit', 'PLAY_PATH_INVALID')
  }
  if (relativePath.includes('\0')) {
    throw httpError(400, 'path must not contain NUL', 'PLAY_PATH_INVALID')
  }
  if (isAbsolute(relativePath) || /^[A-Za-z]:[\\/]/.test(relativePath) || relativePath.startsWith('\\\\')) {
    throw httpError(400, 'path must be relative to the play workspace root', 'PLAY_PATH_ESCAPE')
  }
  const segments = []
  for (const part of relativePath.split(/[/\\]+/)) {
    if (part === '' || part === '.') continue
    if (part === '..') throw httpError(400, 'path must not contain ".."', 'PLAY_PATH_ESCAPE')
    segments.push(part)
  }
  if (segments.length === 0) {
    throw httpError(400, 'path must be a non-empty relative path', 'PLAY_PATH_INVALID')
  }
  return segments
}

export function assertInsideRoot(rootReal, candidate) {
  const relativePath = relative(rootReal, candidate)
  if (relativePath === '') return
  if (isAbsolute(relativePath) || relativePath.split(/[/\\]/).includes('..')) {
    throw httpError(403, 'path escapes the play workspace root', 'PLAY_PATH_ESCAPE')
  }
}

function isLinkLike(stat) {
  return stat.isSymbolicLink()
}

export function assertNoLink(path, label = 'path') {
  let stat
  try { stat = lstatSync(path) } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  if (isLinkLike(stat)) {
    throw httpError(403, `${label} must not contain a symlink or junction`, 'PLAY_PATH_LINK')
  }
  return stat
}

export function assertSafeRoot(rootPath) {
  const stat = assertNoLink(rootPath, 'play workspace root')
  if (stat === null || !stat.isDirectory()) {
    throw httpError(409, 'play workspace root is not bound', 'PLAY_WORKSPACE_UNBOUND')
  }
  const rootReal = realpathSync(rootPath)
  assertInsideRoot(rootReal, rootReal)
  return rootReal
}

export function resolvePlayPath(rootPath, relativePath, { mustExist = false } = {}) {
  if (typeof rootPath !== 'string' || rootPath.trim() === '') {
    throw httpError(409, 'play workspace root is not bound', 'PLAY_WORKSPACE_UNBOUND')
  }
  const rootReal = assertSafeRoot(rootPath)
  const segments = splitRelativeSegments(relativePath)
  let current = rootReal
  for (let index = 0; index < segments.length; index += 1) {
    const next = join(current, segments[index])
    const stat = assertNoLink(next, `path segment "${segments[index]}"`)
    const real = stat === null ? null : realpathSync(next)
    if (real !== null) {
      assertInsideRoot(rootReal, real)
      current = real
      continue
    }
    if (mustExist) throw httpError(404, `path not found: ${segments.join('/')}`, 'PLAY_PATH_NOT_FOUND')
    const remainder = join(next, ...segments.slice(index + 1))
    assertInsideRoot(rootReal, remainder)
    return remainder
  }
  if (mustExist && !existsSync(current)) {
    throw httpError(404, `path not found: ${segments.join('/')}`, 'PLAY_PATH_NOT_FOUND')
  }
  assertInsideRoot(rootReal, current)
  return current
}

export function posixPlayPath(segmentsOrPath) {
  if (Array.isArray(segmentsOrPath)) return segmentsOrPath.join('/')
  return splitRelativeSegments(segmentsOrPath).join('/')
}

export function isSystemDiskPath(rootPath) {
  const resolved = resolve(rootPath)
  if (process.platform === 'win32') return /^[cC]:\\/.test(resolved)
  return resolved === '/' || resolved.startsWith('/System') || resolved.startsWith('/usr')
}

export const playPathConstants = Object.freeze({
  maxRelativePathCharacters: MAX_RELATIVE_PATH_CHARACTERS,
  sep,
  isRecordSep,
})
