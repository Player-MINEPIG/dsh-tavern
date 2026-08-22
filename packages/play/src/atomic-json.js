import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

export function atomicJson(path, value, maxBytes) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  if (Buffer.byteLength(text) > maxBytes) {
    const error = new TypeError('JSON exceeds the storage limit')
    error.code = 'PLAY_STORAGE_LIMIT'
    throw error
  }
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, text, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

export function readJsonFile(path, maxBytes) {
  if (statSync(path).size > maxBytes) {
    const error = new Error('Persisted JSON exceeds the read limit')
    error.code = 'PLAY_STORAGE_LIMIT'
    throw error
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}
