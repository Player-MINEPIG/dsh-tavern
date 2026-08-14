import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import {
  createBlankPreset,
  editPreset,
  parseSillyTavernPreset,
} from '../../tavern-format/src/index.js'

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/

function validateId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new TypeError('Invalid preset id')
  return id
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}

function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

function summary(preset) {
  return {
    id: preset.id,
    name: preset.name,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    sourceFormat: preset.source?.format ?? 'unknown',
    promptCount: Array.isArray(preset.prompts) ? preset.prompts.length : 0,
    enabledPromptCount: Array.isArray(preset.prompts)
      ? preset.prompts.filter((prompt) => prompt.enabled === true && prompt.marker !== true).length
      : 0,
  }
}

export class PresetStore {
  constructor(storageDir) {
    this.storageDir = resolve(storageDir)
    this.presetsDir = join(this.storageDir, 'presets')
    this.statePath = join(this.storageDir, 'state.json')
    mkdirSync(this.presetsDir, { recursive: true })
    this.state = readJson(this.statePath, { schemaVersion: 1, selectedId: null })
  }

  presetPath(id) {
    return join(this.presetsDir, `${validateId(id)}.json`)
  }

  list() {
    return readdirSync(this.presetsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .flatMap((entry) => {
        try {
          return [summary(readJson(join(this.presetsDir, entry.name)))]
        } catch {
          return []
        }
      })
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  get(id) {
    const preset = readJson(this.presetPath(id))
    if (preset === undefined) {
      const error = new Error(`Preset "${id}" not found`)
      error.code = 'PRESET_NOT_FOUND'
      throw error
    }
    return preset
  }

  save(preset) {
    validateId(preset?.id)
    atomicJson(this.presetPath(preset.id), preset)
    return preset
  }

  importSillyTavern(content, options = {}) {
    const preset = parseSillyTavernPreset(content, options)
    return this.save(preset)
  }

  create(options = {}) {
    return this.save(createBlankPreset(options))
  }

  update(id, patch, options = {}) {
    return this.save(editPreset(this.get(id), patch, options))
  }

  delete(id) {
    const path = this.presetPath(id)
    try {
      unlinkSync(path)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    if (this.state.selectedId === id) this.select(null)
  }

  select(id) {
    if (id !== null) this.get(validateId(id))
    this.state = { schemaVersion: 1, selectedId: id }
    atomicJson(this.statePath, this.state)
    return this.selected()
  }

  selected() {
    if (typeof this.state.selectedId !== 'string') return null
    try {
      return this.get(this.state.selectedId)
    } catch (error) {
      if (error?.code !== 'PRESET_NOT_FOUND') throw error
      return null
    }
  }

  selectedSummary() {
    const preset = this.selected()
    return preset === null ? null : summary(preset)
  }

}
