import {
  existsSync,
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { httpError, readBoundedJson, sendJson } from './http.js'
import { parseTimelineJson } from './timeline.js'
import { validateTimelineCoordinates } from './session-coordinates.js'
import { assertInsideRoot, assertNoLink, assertSafeRoot, isSystemDiskPath, posixPlayPath, resolvePlayPath, splitRelativeSegments } from './paths.js'

const BINDING_FILE = 'play-workspace.json'
const MAX_BINDING_BYTES = 8 * 1024
const MAX_FILE_BYTES = 1 * 1024 * 1024
const CONTRACT_VERSION = 1
const REVISION_PATTERN = /^[0-9a-f]{64}$/
const DEFAULT_BINDING = Object.freeze({
  schemaVersion: 1,
  rootPath: null,
  workspaceId: null,
  boundAt: null,
  firstSelectedAt: null,
  activeTimelinePath: null,
})

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneDefault() {
  return { ...DEFAULT_BINDING }
}

function readBinding(path) {
  try {
    const parsed = readJsonFile(path, MAX_BINDING_BYTES)
    if (!isRecord(parsed)) return cloneDefault()
    return {
      schemaVersion: 1,
      rootPath: typeof parsed.rootPath === 'string' && parsed.rootPath !== '' ? parsed.rootPath : null,
      workspaceId: typeof parsed.workspaceId === 'string' && parsed.workspaceId !== '' ? parsed.workspaceId : null,
      boundAt: typeof parsed.boundAt === 'string' ? parsed.boundAt : null,
      firstSelectedAt: typeof parsed.firstSelectedAt === 'string' ? parsed.firstSelectedAt : null,
      activeTimelinePath: typeof parsed.activeTimelinePath === 'string' ? parsed.activeTimelinePath : null,
    }
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError || error instanceof TypeError) return cloneDefault()
    throw error
  }
}

function requireRoot(binding) {
  if (typeof binding.rootPath !== 'string' || binding.rootPath === '') {
    throw httpError(409, 'play workspace root is not bound', 'PLAY_WORKSPACE_UNBOUND')
  }
  assertSafeRoot(binding.rootPath)
  return binding.rootPath
}

function isManagedDocument(relativePath) {
  const base = basename(relativePath)
  return base === 'catalog.json' || base === 'timeline.json'
}

function revisionOf(content) {
  return createHash('sha256').update(content).digest('hex')
}

function revisionConflict(message = 'managed file revision does not match') {
  throw httpError(409, message, 'PLAY_FILE_REVISION_CONFLICT')
}

function assertExpectedRevision(value, present) {
  if (!present) throw httpError(400, 'expectedRevision is required for catalog.json and timeline.json', 'PLAY_FILE_REVISION_REQUIRED')
  if (value !== null && (typeof value !== 'string' || !REVISION_PATTERN.test(value))) {
    throw httpError(400, 'expectedRevision must be null or a 64-character lowercase SHA-256 hex string', 'PLAY_FILE_REVISION_INVALID')
  }
}

function safeOperationPath(value) {
  if (typeof value !== 'string' || value === '') return undefined
  try {
    return posixPlayPath(value)
  } catch {
    return undefined
  }
}

export function writeAllSync(descriptor, content, write = writeSync) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  let offset = 0
  while (offset < bytes.length) {
    const written = write(descriptor, bytes, offset, bytes.length - offset)
    if (!Number.isInteger(written) || written <= 0) {
      throw httpError(500, 'temporary file write made no progress', 'PLAY_FILE_WRITE_FAILED')
    }
    offset += written
  }
  return offset
}

export function workspaceWarnings(rootPath, { firstSelection = false } = {}) {
  const warnings = [
    {
      code: 'SWIPE_DISK',
      message: 'Swipe and import create extra DSH session logs. Put the play workspace on a disk with spare space.',
    },
  ]
  if (isSystemDiskPath(rootPath)) {
    warnings.push({
      code: 'SYSTEM_DISK',
      message: 'Do not put the play workspace on the system disk (especially C:\\ on Windows).',
    })
  }
  return { firstSelection, warnings }
}

export class PlayWorkspaceStore {
  constructor(storageDir, { host, now = () => new Date().toISOString(), beforeRename = null } = {}) {
    this.storageDir = resolve(storageDir)
    this.path = join(this.storageDir, BINDING_FILE)
    this.host = host ?? {}
    this.now = now
    this.targetGuards = new Set()
    this.beforeRename = beforeRename
    mkdirSync(this.storageDir, { recursive: true })
    this.binding = readBinding(this.path)
  }

  get() {
    return { ...this.binding }
  }

  persist(next) {
    atomicJson(this.path, next, MAX_BINDING_BYTES)
    this.binding = next
    return this.get()
  }

  view() {
    const binding = this.get()
    const selected = typeof binding.rootPath === 'string' && binding.rootPath !== ''
    return {
      ok: true,
      selected,
      rootPath: binding.rootPath,
      workspaceId: binding.workspaceId,
      contractVersion: CONTRACT_VERSION,
      activeTimelinePath: binding.activeTimelinePath,
      ...(selected ? workspaceWarnings(binding.rootPath, { firstSelection: false }) : { warnings: [] }),
    }
  }

  setActiveTimelinePath(relativePath) {
    return this.persist({ ...this.get(), activeTimelinePath: relativePath })
  }

  async bindRoot(rootPath) {
    if (typeof rootPath !== 'string' || rootPath.trim() === '') {
      throw httpError(400, 'path must be an existing directory', 'PLAY_WORKSPACE_INVALID')
    }
    const resolved = resolve(rootPath)
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      throw httpError(400, 'path must be an existing directory', 'PLAY_WORKSPACE_INVALID')
    }
    assertNoLink(resolved, 'play workspace root')
    const previous = this.get()
    const firstSelection = previous.rootPath !== resolved
    let workspaceId = previous.rootPath === resolved ? previous.workspaceId : null
    if (typeof this.host.createWorkspace === 'function') {
      const created = await this.host.createWorkspace({ path: resolved })
      workspaceId = created?.workspaceId ?? created?.workspace?.workspaceId ?? workspaceId
    }
    const now = this.now()
    const next = {
      schemaVersion: 1,
      rootPath: resolved,
      workspaceId,
      boundAt: now,
      firstSelectedAt: firstSelection ? now : previous.firstSelectedAt ?? now,
      activeTimelinePath: firstSelection ? null : previous.activeTimelinePath,
    }
    this.persist(next)
    return {
      ok: true,
      selected: true,
      rootPath: next.rootPath,
      workspaceId: next.workspaceId,
      contractVersion: CONTRACT_VERSION,
      ...workspaceWarnings(resolved, { firstSelection }),
    }
  }

  async createDir(relativePath) {
    const root = requireRoot(this.binding)
    const segments = splitRelativeSegments(relativePath)
    const posix = posixPlayPath(segments)
    return this.withTargetGuard(posix, () => {
      let current = assertSafeRoot(root)
      const parentRelative = []
      for (const name of segments) {
        const childRelative = [...parentRelative, name]
        const childAbs = join(current, name)
        let stat = assertNoLink(childAbs, 'path segment "' + name + '"')
        if (stat === null) {
          try { mkdirSync(childAbs) } catch (error) {
            if (error?.code !== 'EEXIST') throw error
          }
          stat = assertNoLink(childAbs, 'path segment "' + name + '"')
          if (stat === null) throw httpError(409, 'directory creation did not persist', 'PLAY_PATH_CONFLICT')
        }
        if (!stat.isDirectory()) {
          throw httpError(409, 'path exists and is not a directory', 'PLAY_PATH_CONFLICT')
        }
        current = resolvePlayPath(root, posixPlayPath(childRelative), { mustExist: true })
        parentRelative.push(name)
      }
      return { ok: true, path: posix }
    })
  }

  /**
   * Move one file or directory subtree inside the workspace root.
   *
   * Playthrough deletion parks a directory in the workspace trash before its
   * catalog entry disappears. A same-volume `rename` is atomic and needs no byte
   * copy, which matters because archive trees can exceed the file read limit. The
   * destination parent is created on demand; an existing destination is a conflict
   * rather than a silent merge.
   *
   * @param fromRelative - POSIX relative source path under the workspace root.
   * @param toRelative - POSIX relative destination path under the workspace root.
   * @returns `{ ok, from, to }`.
   */
  move(fromRelative, toRelative) {
    const root = requireRoot(this.binding)
    const from = posixPlayPath(fromRelative)
    const to = posixPlayPath(toRelative)
    if (from === to) throw httpError(400, 'move source and destination are identical', 'PLAY_PATH_INVALID')
    return this.withTargetGuard(from, () => {
      const rootReal = assertSafeRoot(root)
      const sourceAbs = resolvePlayPath(root, from, { mustExist: true })
      const targetAbs = resolvePlayPath(root, to)
      if (existsSync(targetAbs)) {
        throw httpError(409, 'move destination already exists', 'PLAY_PATH_CONFLICT')
      }
      assertInsideRoot(rootReal, targetAbs)
      const parent = dirname(targetAbs)
      mkdirSync(parent, { recursive: true })
      assertNoLink(parent, 'move destination parent')
      renameSync(sourceAbs, targetAbs)
      return { ok: true, from, to }
    })
  }

  /**
   * Remove one file or directory subtree under the workspace root.
   *
   * The walk is explicit — `readdir` then `unlink`/`rmdir`, deepest first — so the
   * result reports exactly which entries are gone even when a later entry fails,
   * and a per-entry `ENOENT` is tolerated the same way `CharacterStore.delete`
   * tolerates it. No recursive removal helper is used, so a partially removed tree
   * is always reported instead of being silently discarded.
   *
   * @param relativePath - POSIX relative path under the workspace root.
   * @returns `{ ok, path, removedFiles, removedDirectories }` (relative paths).
   */
  removeTree(relativePath) {
    const root = requireRoot(this.binding)
    const posix = posixPlayPath(relativePath)
    return this.withTargetGuard(posix, () => {
      const absolute = resolvePlayPath(root, posix, { mustExist: true })
      const removedFiles = []
      const removedDirectories = []
      const relativeOf = value => (value === root ? '' : value.slice(root.length + 1).split(sep).join('/'))
      const walk = dir => {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const child = join(dir, entry.name)
          assertNoLink(child, `path segment "${entry.name}"`)
          if (entry.isDirectory()) continue
          try { unlinkSync(child) } catch (error) { if (error?.code !== 'ENOENT') throw error }
          removedFiles.push(relativeOf(child))
        }
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const child = join(dir, entry.name)
          walk(child)
          rmdirSync(child)
          removedDirectories.push(relativeOf(child))
        }
      }
      if (statSync(absolute).isDirectory()) {
        walk(absolute)
        rmdirSync(absolute)
        removedDirectories.push(relativeOf(absolute))
      } else {
        try { unlinkSync(absolute) } catch (error) { if (error?.code !== 'ENOENT') throw error }
        removedFiles.push(relativeOf(absolute))
      }
      return { ok: true, path: posix, removedFiles, removedDirectories }
    })
  }

  withTargetGuard(relativePath, operation) {
    const key = (this.binding.rootPath ?? '') + '\\0' + posixPlayPath(relativePath)
    if (this.targetGuards.has(key)) throw httpError(409, 'path target is busy', 'PLAY_PATH_BUSY')
    this.targetGuards.add(key)
    try { return operation() } finally { this.targetGuards.delete(key) }
  }

  list(prefix) {
    const root = requireRoot(this.binding)
    const hasPrefix = typeof prefix === 'string' && prefix !== '' && prefix !== '.'
    const start = hasPrefix ? resolvePlayPath(root, prefix, { mustExist: true }) : root
    if (!statSync(start).isDirectory()) {
      throw httpError(400, 'list prefix must be a directory', 'PLAY_PATH_INVALID')
    }
    const prefixPosix = hasPrefix ? posixPlayPath(prefix) : ''
    const entries = readdirSync(start, { withFileTypes: true }).map(entry => ({
      path: prefixPosix === '' ? entry.name : prefixPosix + '/' + entry.name,
      type: entry.isDirectory() ? 'dir' : 'file',
    })).sort((left, right) => left.path.localeCompare(right.path))
    return { ok: true, list: entries }
  }

  readFile(relativePath, { validate } = {}) {
    const root = requireRoot(this.binding)
    const posix = posixPlayPath(relativePath)
    const managed = isManagedDocument(posix)
    const operation = () => {
      const absolute = resolvePlayPath(root, posix, { mustExist: true })
      if (!statSync(absolute).isFile()) {
        throw httpError(400, 'path is not a file', 'PLAY_PATH_INVALID')
      }
      if (statSync(absolute).size > MAX_FILE_BYTES) {
        throw httpError(413, 'file exceeds the read limit', 'PLAY_FILE_TOO_LARGE')
      }
      const bytes = readFileSync(absolute)
      const content = bytes.toString('utf8')
      if (typeof validate === 'function') validate(posix, content)
      return {
        ok: true,
        path: posix,
        content,
        ...(managed ? { revision: revisionOf(bytes) } : {}),
      }
    }
    return managed ? this.withTargetGuard(posix, operation) : operation()
  }

  writeFile(relativePath, content, { validate, expectedRevision, expectedRevisionPresent = false } = {}) {
    const root = requireRoot(this.binding)
    if (typeof content !== 'string') throw httpError(400, 'content must be a string', 'PLAY_FILE_INVALID')
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) {
      throw httpError(413, 'file exceeds the storage limit', 'PLAY_FILE_TOO_LARGE')
    }
    const posix = posixPlayPath(relativePath)
    const managed = isManagedDocument(posix)
    if (managed) assertExpectedRevision(expectedRevision, expectedRevisionPresent)
    return this.withTargetGuard(posix, () => {
      const segments = splitRelativeSegments(posix)
      const fileName = segments.pop()
      let parent = assertSafeRoot(root)
      const parentSegments = []
      for (const name of segments) {
        const child = join(parent, name)
        let stat = assertNoLink(child, 'path segment "' + name + '"')
        if (stat === null) {
          try { mkdirSync(child) } catch (error) {
            if (error?.code !== 'EEXIST') throw error
          }
          stat = assertNoLink(child, 'path segment "' + name + '"')
        }
        if (stat === null || !stat.isDirectory()) {
          throw httpError(409, 'path exists and is not a directory', 'PLAY_PATH_CONFLICT')
        }
        parentSegments.push(name)
        parent = resolvePlayPath(root, posixPlayPath(parentSegments), { mustExist: true })
      }
      parent = parentSegments.length === 0
        ? assertSafeRoot(root)
        : resolvePlayPath(root, posixPlayPath(parentSegments), { mustExist: true })
      const absolute = join(parent, fileName)
      const existing = assertNoLink(absolute, 'target')
      if (existing !== null && !existing.isFile()) {
        throw httpError(409, 'path exists and is not a file', 'PLAY_PATH_CONFLICT')
      }
      if (managed) {
        const currentRevision = existing === null ? null : revisionOf(readFileSync(absolute))
        if (expectedRevision === null ? currentRevision !== null : currentRevision !== expectedRevision) {
          revisionConflict()
        }
      }
      if (typeof validate === 'function') validate(posix, content)
      const temporary = absolute + '.' + process.pid + '.' + Math.random().toString(36).slice(2) + '.tmp'
      let descriptor = null
      try {
        descriptor = openSync(temporary, 'wx', 0o600)
        writeAllSync(descriptor, content)
        closeSync(descriptor)
        descriptor = null
        if (typeof this.beforeRename === 'function') this.beforeRename({ absolute, parent })
        const verifiedParent = parentSegments.length === 0
          ? assertSafeRoot(root)
          : resolvePlayPath(root, posixPlayPath(parentSegments), { mustExist: true })
        if (verifiedParent !== parent) throw httpError(403, 'path parent changed during write', 'PLAY_PATH_RACE')
        const currentTarget = assertNoLink(absolute, 'target')
        if (managed) {
          const currentRevision = currentTarget === null ? null : revisionOf(readFileSync(absolute))
          if (expectedRevision === null ? currentRevision !== null : currentRevision !== expectedRevision) {
            revisionConflict()
          }
        }
        renameSync(temporary, absolute)
      } catch (error) {
        if (descriptor !== null) { try { closeSync(descriptor) } catch {} }
        try { unlinkSync(temporary) } catch {}
        throw error
      }
      return {
        ok: true,
        path: posix,
        ...(managed ? { revision: revisionOf(Buffer.from(content, 'utf8')) } : {}),
      }
    })
  }

}

export function createWorkspaceApiHandler(store, { validateFile, coordinates } = {}) {
  const checkCoordinates = async (path, content) => {
    if (typeof path === 'string' && path.split('/').at(-1) === 'timeline.json' && typeof coordinates === 'function') {
      await validateTimelineCoordinates(parseTimelineJson(content), coordinates)
    }
  }
  return {
    async getWorkspace(_req, res) {
      return sendJson(res, 200, store.view())
    },
    async putWorkspace(req, res, { operation } = {}) {
      const body = await readBoundedJson(req, MAX_BINDING_BYTES)
      operation?.stage('request.validated')
      operation?.stage('mutation.begin', { path: 'workspace' })
      const result = await store.bindRoot(body?.path)
      operation?.stage('mutation.committed', { path: 'workspace' })
      return sendJson(res, 200, result)
    },
    async postDirs(req, res, { operation } = {}) {
      const body = await readBoundedJson(req, MAX_BINDING_BYTES)
      const path = safeOperationPath(body?.path)
      operation?.stage('request.validated', path === undefined ? {} : { path })
      operation?.stage('mutation.begin', path === undefined ? {} : { path })
      const result = await store.createDir(body?.path)
      operation?.stage('mutation.committed', { path: result.path })
      return sendJson(res, 200, result)
    },
    async files(req, res, { method, searchParams, operation } = {}) {
      const list = searchParams.get('list')
      if (method === 'GET' && list !== null) return sendJson(res, 200, store.list(list === '' ? undefined : list))
      const path = searchParams.get('path')
      if (method === 'GET') {
        const file = store.readFile(path, { validate: validateFile })
        await checkCoordinates(path, file.content)
        return sendJson(res, 200, file)
      }
      if (method === 'PUT') {
        const body = await readBoundedJson(req, MAX_FILE_BYTES + 1024)
        const normalizedPath = safeOperationPath(path)
        await checkCoordinates(normalizedPath, body?.content)
        operation?.stage('request.validated', normalizedPath === undefined ? {} : { path: normalizedPath })
        operation?.stage('mutation.begin', normalizedPath === undefined ? {} : { path: normalizedPath })
        const managed = isManagedDocument(posixPlayPath(path))
        const validate = typeof validateFile !== 'function'
          ? validateFile
          : (filePath, content) => {
              const result = validateFile(filePath, content)
              operation?.stage('payload.validated', { path: filePath })
              return result
            }
        const result = store.writeFile(path, body?.content, {
          validate,
          expectedRevision: body?.expectedRevision,
          expectedRevisionPresent: managed && Object.hasOwn(body ?? {}, 'expectedRevision'),
        })
        operation?.stage('mutation.committed', { path: result.path })
        return sendJson(res, 200, result)
      }
      throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
    },
  }
}

export const playWorkspaceConstants = Object.freeze({
  contractVersion: CONTRACT_VERSION,
  maxBindingBytes: MAX_BINDING_BYTES,
  maxFileBytes: MAX_FILE_BYTES,
  fileName: BINDING_FILE,
})
