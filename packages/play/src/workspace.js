import {
  existsSync,
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { httpError, readBoundedJson, sendJson } from './http.js'
import { assertNoLink, assertSafeRoot, isSystemDiskPath, posixPlayPath, resolvePlayPath, splitRelativeSegments } from './paths.js'

const BINDING_FILE = 'play-workspace.json'
const MAX_BINDING_BYTES = 8 * 1024
const MAX_FILE_BYTES = 1 * 1024 * 1024
const CONTRACT_VERSION = 1
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

  readFile(relativePath) {
    const root = requireRoot(this.binding)
    const posix = posixPlayPath(relativePath)
    const absolute = resolvePlayPath(root, posix, { mustExist: true })
    if (!statSync(absolute).isFile()) {
      throw httpError(400, 'path is not a file', 'PLAY_PATH_INVALID')
    }
    if (statSync(absolute).size > MAX_FILE_BYTES) {
      throw httpError(413, 'file exceeds the read limit', 'PLAY_FILE_TOO_LARGE')
    }
    return {
      ok: true,
      path: posix,
      content: readFileSync(absolute, 'utf8'),
    }
  }

  writeFile(relativePath, content, { validate } = {}) {
    const root = requireRoot(this.binding)
    if (typeof content !== 'string') throw httpError(400, 'content must be a string', 'PLAY_FILE_INVALID')
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) {
      throw httpError(413, 'file exceeds the storage limit', 'PLAY_FILE_TOO_LARGE')
    }
    const posix = posixPlayPath(relativePath)
    if (typeof validate === 'function') validate(posix, content)
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
      const temporary = absolute + '.' + process.pid + '.' + Math.random().toString(36).slice(2) + '.tmp'
      let descriptor = null
      try {
        descriptor = openSync(temporary, 'wx', 0o600)
        writeSync(descriptor, content, null, 'utf8')
        closeSync(descriptor)
        descriptor = null
        if (typeof this.beforeRename === 'function') this.beforeRename({ absolute, parent })
        const verifiedParent = parentSegments.length === 0
          ? assertSafeRoot(root)
          : resolvePlayPath(root, posixPlayPath(parentSegments), { mustExist: true })
        if (verifiedParent !== parent) throw httpError(403, 'path parent changed during write', 'PLAY_PATH_RACE')
        assertNoLink(absolute, 'target')
        renameSync(temporary, absolute)
      } catch (error) {
        if (descriptor !== null) { try { closeSync(descriptor) } catch {} }
        try { unlinkSync(temporary) } catch {}
        throw error
      }
      if (basename(posix) === 'timeline.json') this.setActiveTimelinePath(posix)
      return { ok: true, path: posix }
    })
  }
}

export function createWorkspaceApiHandler(store, { validateFile } = {}) {
  return {
    async getWorkspace(_req, res) {
      return sendJson(res, 200, store.view())
    },
    async putWorkspace(req, res) {
      const body = await readBoundedJson(req, MAX_BINDING_BYTES)
      return sendJson(res, 200, await store.bindRoot(body?.path))
    },
    async postDirs(req, res) {
      const body = await readBoundedJson(req, MAX_BINDING_BYTES)
      return sendJson(res, 200, await store.createDir(body?.path))
    },
    async files(req, res, { method, searchParams }) {
      const list = searchParams.get('list')
      if (method === 'GET' && list !== null) return sendJson(res, 200, store.list(list === '' ? undefined : list))
      const path = searchParams.get('path')
      if (method === 'GET') {
        const file = store.readFile(path)
        if (typeof validateFile === 'function') validateFile(file.path, file.content)
        return sendJson(res, 200, file)
      }
      if (method === 'PUT') {
        const body = await readBoundedJson(req, MAX_FILE_BYTES + 1024)
        return sendJson(res, 200, store.writeFile(path, body?.content, { validate: validateFile }))
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
