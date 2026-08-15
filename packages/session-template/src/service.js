import { normalizeTemplateSelection } from './model.js'

function diagnostic(code, field, resourceId, message) {
  return { code, field, resourceId, message }
}

function sourceOf(value) {
  if (value?.mode === 'current') {
    if (typeof value.sessionId !== 'string' || value.sessionId === '') throw new TypeError('Current-settings source requires sessionId')
    return { mode: 'current', sessionId: value.sessionId }
  }
  if (value?.mode === 'template') {
    if (typeof value.templateId !== 'string' || value.templateId === '') throw new TypeError('Template source requires templateId')
    return { mode: 'template', templateId: value.templateId }
  }
  throw new TypeError('Session configuration source mode must be current or template')
}

export class SessionConfigurationError extends Error {
  constructor(diagnostics) {
    super('Session configuration refers to missing or invalid Tavern resources')
    this.name = 'SessionConfigurationError'
    this.code = 'SESSION_CONFIGURATION_UNAVAILABLE'
    this.status = 409
    this.diagnostics = structuredClone(diagnostics)
  }
}

export class SessionConfigurationService {
  constructor({ templates, selections, presets, characters, users, worldBooks }) {
    this.templates = templates
    this.selections = selections
    this.presets = presets
    this.characters = characters
    this.users = users
    this.worldBooks = worldBooks
  }

  selection(source) {
    const normalized = sourceOf(source)
    return normalized.mode === 'current'
      ? this.selections.get(normalized.sessionId)
      : this.templates.get(normalized.templateId).selection
  }

  diagnostics(selection) {
    const value = normalizeTemplateSelection(selection)
    const diagnostics = []
    if (value.presetId !== null) {
      try { this.presets.get(value.presetId) } catch {
        diagnostics.push(diagnostic(
          'SESSION_CONFIGURATION_PRESET_MISSING',
          'presetId',
          value.presetId,
          `预设已缺失或被删除：${value.presetId}`,
        ))
      }
    }
    if (value.characterCardId !== null) {
      try {
        this.characters.normalizeSelection(value.characterCardId, value)
      } catch {
        diagnostics.push(diagnostic(
          'SESSION_CONFIGURATION_CHARACTER_MISSING_OR_INVALID',
          'characterCardId',
          value.characterCardId,
          `角色卡已缺失、被删除或 greeting 选择已失效：${value.characterCardId}`,
        ))
      }
    }
    if (value.userId !== null) {
      try { this.users.get(value.userId) } catch {
        diagnostics.push(diagnostic(
          'SESSION_CONFIGURATION_USER_MISSING',
          'userId',
          value.userId,
          `用户资源已缺失或被删除：${value.userId}`,
        ))
      }
    }
    for (const id of value.worldBookIds) {
      try { this.worldBooks.get(id) } catch {
        diagnostics.push(diagnostic(
          'SESSION_CONFIGURATION_WORLD_BOOK_MISSING',
          'worldBookIds',
          id,
          `独立世界书已缺失或被删除：${id}`,
        ))
      }
    }
    return diagnostics
  }

  preview(source) {
    const selection = normalizeTemplateSelection(this.selection(source))
    const diagnostics = this.diagnostics(selection)
    return { selection, diagnostics, available: diagnostics.length === 0 }
  }

  apply(targetSessionId, source) {
    const preview = this.preview(source)
    if (!preview.available) throw new SessionConfigurationError(preview.diagnostics)
    const selection = this.selections.set(targetSessionId, preview.selection)
    return { selection, diagnostics: [] }
  }

  createTemplate(name, sourceSessionId) {
    return this.templates.create({ name, selection: this.selections.get(sourceSessionId) })
  }

  updateTemplate(id, patch = {}) {
    const next = {}
    if (Object.hasOwn(patch, 'name')) next.name = patch.name
    if (Object.hasOwn(patch, 'sourceSessionId')) {
      if (typeof patch.sourceSessionId !== 'string' || patch.sourceSessionId === '') throw new TypeError('sourceSessionId must be a non-empty string')
      next.selection = this.selections.get(patch.sourceSessionId)
    }
    return this.templates.update(id, next)
  }
}
