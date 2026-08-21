import {
  createElement,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CLIENT_REFRESH_EVENT } from '../../../identity.js'
import {
  createLocalizedElement,
  rawText,
  uiMessage,
  unwrapText,
} from '../i18n.js'
import {
  exportNativeRegexScripts,
  getRegexDocument,
  importRegexDocument,
  nativeRegexScript,
  normalizeRegexRule,
  putRegexDocument,
  resourceRegexInventory,
} from './regex.js'

const h = createLocalizedElement(createElement)
const EMPTY_DOCUMENT = Object.freeze({ schemaVersion: 1, rules: Object.freeze([]) })
const SCOPE_KINDS = Object.freeze(['global', 'preset', 'character'])
const REGEX_DRAG_TYPE = 'application/x-pmp-dsh-tavern-regex-index'

export function reorderRegexRules(rules, fromIndex, toIndex) {
  if (!Array.isArray(rules)) throw new TypeError('regex rules must be an array')
  if (!Number.isSafeInteger(fromIndex) || !Number.isSafeInteger(toIndex)
    || fromIndex < 0 || toIndex < 0 || fromIndex >= rules.length || toIndex >= rules.length
    || fromIndex === toIndex) return [...rules]
  const next = [...rules]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function reorderRegexScope(rules, kind, fromIndex, toIndex) {
  const indexes = rules
    .map((rule, index) => rule?.scope?.kind === kind ? index : -1)
    .filter(index => index >= 0)
  const reordered = reorderRegexRules(indexes.map(index => rules[index]), fromIndex, toIndex)
  const next = [...rules]
  indexes.forEach((index, orderedIndex) => { next[index] = reordered[orderedIndex] })
  return next
}

export function activeRegexBindings(snapshot) {
  return {
    presetId: typeof snapshot?.selection?.presetId === 'string' ? snapshot.selection.presetId : null,
    characterId: typeof snapshot?.selection?.characterCardId === 'string'
      ? snapshot.selection.characterCardId
      : typeof snapshot?.selection?.characterId === 'string'
        ? snapshot.selection.characterId
        : null,
  }
}

function scopeFor(kind, bindings) {
  return {
    kind,
    resourceId: kind === 'global' ? null : kind === 'preset' ? bindings.presetId : bindings.characterId,
  }
}

function downloadRegexScripts(rules, kind) {
  const scripts = exportNativeRegexScripts(rules)
  const blob = new Blob([JSON.stringify(scripts, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `regex-${kind}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function Field({ labelKey, children }) {
  return h('label', { className: 'dtv-field' },
    h('span', { className: 'dtv-label' }, uiMessage(labelKey)),
    children,
  )
}

export async function activeResourceRegexRules(client, bindings) {
  const [presetResponse, characterResponse] = await Promise.all([
    typeof bindings.presetId === 'string' && typeof client.getPresetRegexScripts === 'function'
      ? client.getPresetRegexScripts(bindings.presetId)
      : typeof bindings.presetId === 'string' && typeof client.getPreset === 'function'
        ? client.getPreset(bindings.presetId)
        : null,
    typeof bindings.characterId === 'string' && typeof client.getCharacterRegexScripts === 'function'
      ? client.getCharacterRegexScripts(bindings.characterId)
      : typeof bindings.characterId === 'string' && typeof client.getCharacter === 'function'
        ? client.getCharacter(bindings.characterId)
        : null,
  ])
  return {
    preset: resourceRegexInventory(presetResponse?.regexScripts ?? presetResponse?.preset ?? presetResponse, {
      kind: 'preset',
      resourceId: bindings.presetId,
    }),
    character: resourceRegexInventory(characterResponse?.regexScripts ?? characterResponse?.character ?? characterResponse, {
      kind: 'character',
      resourceId: bindings.characterId,
    }),
  }
}

async function putActiveResourceRegexRules(client, kind, resourceId, rules) {
  if (typeof resourceId !== 'string') throw new TypeError(`${kind} regex resource is not bound`)
  const method = kind === 'preset' ? client.putPresetRegexScripts : client.putCharacterRegexScripts
  if (typeof method !== 'function') throw new TypeError(`${kind} regex resource API is unavailable`)
  const response = await method.call(client, resourceId, rules.map(nativeRegexScript))
  return resourceRegexInventory(response?.regexScripts ?? [], { kind, resourceId })
}

function resourceEditableRule(rule) {
  return {
    ...rule,
    sourceDisplayEligible: true,
  }
}

export function stageLegacyScopedRegexRules(document, resourceRules, bindings) {
  const nextDocument = {
    ...document,
    rules: [...document.rules],
  }
  const nextResourceRules = {
    preset: [...resourceRules.preset],
    character: [...resourceRules.character],
  }
  let migrated = 0
  for (const [kind, resourceId] of [
    ['preset', bindings.presetId],
    ['character', bindings.characterId],
  ]) {
    if (typeof resourceId !== 'string') continue
    const local = nextDocument.rules.filter(rule => (
      rule.scope.kind === kind && rule.scope.resourceId === resourceId
    ))
    if (local.length === 0) continue
    const existingIds = new Set(nextResourceRules[kind].map(rule => rule.id))
    for (const rule of local) {
      if (!existingIds.has(rule.id)) {
        nextResourceRules[kind].push(resourceEditableRule(rule))
        existingIds.add(rule.id)
      }
    }
    nextDocument.rules = nextDocument.rules.filter(rule => !(
      rule.scope.kind === kind && rule.scope.resourceId === resourceId
    ))
    migrated += local.length
  }
  return { document: nextDocument, resourceRules: nextResourceRules, migrated }
}

function RuleEditor({ rule, busy, update, remove, sourceOwned = false, dragKind, dragIndex, move }) {
  const set = patch => update({ ...rule, ...patch })
  const setScope = patch => set({ scope: { ...rule.scope, ...patch } })
  const stateLabel = uiMessage(rule.enabled ? 'common.enabled' : 'common.disabled')
  return h('details', {
    className: 'dtv-entry dtv-regex-rule',
    'data-enabled': rule.enabled,
    onDragOver: event => {
      if (busy) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    },
    onDrop: event => {
      if (busy) return
      event.preventDefault()
      event.stopPropagation()
      try {
        const source = JSON.parse(event.dataTransfer.getData(REGEX_DRAG_TYPE))
        if (source?.kind === dragKind) move(source.index, dragIndex)
      } catch {}
    },
  },
    h('summary', null,
      h('span', {
        className: 'dtv-regex-drag',
        role: 'button',
        tabIndex: busy ? -1 : 0,
        draggable: !busy,
        title: uiMessage('regex.dragToReorder'),
        'aria-label': uiMessage('regex.dragToReorder'),
        onDragStart: event => {
          event.stopPropagation()
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(REGEX_DRAG_TYPE, JSON.stringify({ kind: dragKind, index: dragIndex }))
        },
      }, '☰'),
      h('span', { className: 'dtv-entry-dot', 'aria-hidden': 'true' }),
      h('span', { className: 'dtv-entry-name' }, rawText(rule.name || unwrapText(uiMessage('regex.unnamed')))),
      h('span', { className: 'dtv-entry-state' }, stateLabel),
    ),
    h('div', { className: 'dtv-entry-body' },
      h('label', { className: 'dtv-check' },
        h('input', {
          type: 'checkbox',
          checked: rule.enabled,
          disabled: busy,
          onChange: event => set({ enabled: event.target.checked }),
        }),
        uiMessage('regex.enabled'),
      ),
      h(Field, { labelKey: 'regex.name' }, h('input', {
        className: 'dtv-input',
        value: rule.name,
        disabled: busy,
        onChange: event => set({ name: event.target.value }),
      })),
      h(Field, { labelKey: 'regex.find' }, h('textarea', {
        className: 'dtv-textarea dtv-regex-expression',
        value: rule.find,
        disabled: busy,
        spellCheck: false,
        onChange: event => set({ find: event.target.value }),
      })),
      h(Field, { labelKey: 'regex.replace' }, h('textarea', {
        className: 'dtv-textarea dtv-regex-expression',
        value: rule.replace,
        disabled: busy,
        spellCheck: false,
        onChange: event => set({ replace: event.target.value }),
      })),
      h('div', { className: 'dtv-entry-grid' },
        h(Field, { labelKey: 'regex.flags' }, h('input', {
          className: 'dtv-input',
          value: rule.flags,
          disabled: busy,
          spellCheck: false,
          onChange: event => set({ flags: event.target.value }),
        })),
        h(Field, { labelKey: 'regex.target' }, h('select', {
          className: 'dtv-select',
          value: rule.target,
          disabled: busy,
          onChange: event => set({ target: event.target.value }),
        },
        h('option', { value: 'assistant' }, uiMessage('regex.target.assistant')),
        h('option', { value: 'user' }, uiMessage('regex.target.user')),
        h('option', { value: 'both' }, uiMessage('regex.target.both')),
        )),
      ),
      h('div', { className: 'dtv-entry-grid' },
        h(Field, { labelKey: 'regex.scope' }, h('select', {
          className: 'dtv-select',
          value: rule.scope.kind,
          disabled: true,
          onChange: event => setScope({
            kind: event.target.value,
            resourceId: event.target.value === 'global' ? null : rule.scope.resourceId,
          }),
        },
        ...SCOPE_KINDS.map(kind => h('option', { key: kind, value: kind }, uiMessage(`regex.scope.${kind}`))),
        )),
        rule.scope.kind === 'global' ? null : h(Field, { labelKey: 'regex.resourceId' }, h('input', {
          className: 'dtv-input',
          value: rule.scope.resourceId ?? '',
          disabled: true,
          onChange: event => setScope({ resourceId: event.target.value || null }),
        })),
      ),
      sourceOwned
        ? h('p', { className: 'dtv-note' }, uiMessage(rule.sourceDisplayEligible ? 'regex.sourceOwnedDisplay' : 'regex.sourceOwnedPromptOnly'))
        : null,
      h('div', { className: 'dtv-entry-actions' }, h('button', {
          className: 'dtv-button dtv-danger',
          type: 'button',
          disabled: busy,
          onClick: remove,
        }, uiMessage('common.delete'))),
    ),
  )
}

function RegexScopeSection({
  kind,
  bindings,
  editableRules,
  sourceRules,
  busy,
  add,
  importJson,
  exportJson,
  update,
  remove,
  updateSource,
  removeSource,
  move,
}) {
  const rules = [...editableRules, ...sourceRules]
  const unbound = kind === 'preset' && bindings.presetId === null
    ? uiMessage('regex.noPreset')
    : kind === 'character' && bindings.characterId === null
      ? uiMessage('regex.noCharacter')
      : null
  const actionsDisabled = busy || unbound !== null
  return h('section', { className: 'dtv-resource dtv-regex-section', 'data-scope': kind },
    h('div', { className: 'dtv-regex-section-title' },
      h('div', { className: 'dtv-resource-title' }, uiMessage(`regex.scope.${kind}`)),
      h('span', { className: 'dtv-item-count' }, rawText(String(rules.length))),
    ),
    unbound === null ? null : h('p', { className: 'dtv-note' }, unbound),
    h('div', { className: 'dtv-book-toolbar' },
      h('button', { className: 'dtv-button', type: 'button', disabled: actionsDisabled, onClick: add }, uiMessage('regex.add')),
      h('button', { className: 'dtv-button', type: 'button', disabled: actionsDisabled, onClick: importJson }, uiMessage('common.importJson')),
      h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: () => exportJson(rules) }, uiMessage('common.exportJson')),
    ),
    rules.length === 0
      ? h('p', { className: 'dtv-note' }, uiMessage('regex.emptyScope'))
      : [
          ...editableRules.map((rule, index) => h(RuleEditor, {
            key: `${kind}-editable-${rule.id}-${index}`,
            rule,
            busy,
            dragKind: kind,
            dragIndex: index,
            move,
            update,
            remove: () => remove(rule.id),
          })),
          ...sourceRules.map((rule, index) => h(RuleEditor, {
            key: `${kind}-source-${rule.id}-${index}`,
            rule,
            busy,
            sourceOwned: true,
            dragKind: kind,
            dragIndex: index,
            move,
            update: next => updateSource(index, next),
            remove: () => removeSource(index),
          })),
        ],
  )
}

export function RegexPanel({ client, activeSnapshot, close }) {
  const [document, setDocument] = useState(EMPTY_DOCUMENT)
  const [savedDocument, setSavedDocument] = useState(EMPTY_DOCUMENT)
  const [resourceRules, setResourceRules] = useState({ preset: [], character: [] })
  const [savedResourceRules, setSavedResourceRules] = useState({ preset: [], character: [] })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ text: uiMessage('common.loading'), error: false })
  const fileInput = useRef(null)
  const importScope = useRef('global')
  const bindings = activeRegexBindings(activeSnapshot)
  const dirty = JSON.stringify(document) !== JSON.stringify(savedDocument)
    || JSON.stringify(resourceRules) !== JSON.stringify(savedResourceRules)

  const load = async () => {
    setBusy(true)
    try {
      const [next, nextResourceRules] = await Promise.all([
        getRegexDocument(client),
        activeResourceRegexRules(client, bindings),
      ])
      const staged = stageLegacyScopedRegexRules(next, nextResourceRules, bindings)
      setDocument(staged.document)
      setSavedDocument(next)
      setResourceRules(staged.resourceRules)
      setSavedResourceRules(nextResourceRules)
      const count = staged.document.rules.length + staged.resourceRules.preset.length + staged.resourceRules.character.length
      setStatus({
        text: staged.migrated > 0
          ? uiMessage('regex.legacyMigrationPending', { count: staged.migrated })
          : uiMessage('regex.loaded', { count }),
        error: false,
      })
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [client, bindings.presetId, bindings.characterId])

  const persist = async (next, nextResourceRules = resourceRules) => {
    setBusy(true)
    try {
      const [saved, savedPresetRules, savedCharacterRules] = await Promise.all([
        JSON.stringify(next) === JSON.stringify(savedDocument)
          ? next
          : putRegexDocument(client, next),
        JSON.stringify(nextResourceRules.preset) === JSON.stringify(savedResourceRules.preset)
          ? nextResourceRules.preset
          : putActiveResourceRegexRules(client, 'preset', bindings.presetId, nextResourceRules.preset),
        JSON.stringify(nextResourceRules.character) === JSON.stringify(savedResourceRules.character)
          ? nextResourceRules.character
          : putActiveResourceRegexRules(client, 'character', bindings.characterId, nextResourceRules.character),
      ])
      const savedResources = { preset: savedPresetRules, character: savedCharacterRules }
      setDocument(saved)
      setSavedDocument(saved)
      setResourceRules(savedResources)
      setSavedResourceRules(savedResources)
      const count = saved.rules.length + savedPresetRules.length + savedCharacterRules.length
      setStatus({ text: uiMessage('regex.saved', { count }), error: false })
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true })
    } finally {
      setBusy(false)
    }
  }

  const guardedLoad = () => {
    if (dirty && !window.confirm(unwrapText(uiMessage('regex.confirmReload')))) return
    load()
  }

  const guardedClose = () => {
    if (dirty && !window.confirm(unwrapText(uiMessage('regex.confirmClose')))) return
    close()
  }

  const addRule = kind => {
    const rule = normalizeRegexRule({
      name: unwrapText(uiMessage('regex.newRule')),
      enabled: true,
      find: '',
      replace: '',
      flags: 'g',
      target: 'assistant',
    }, { scope: scopeFor(kind, bindings) })
    if (kind === 'global') {
      setDocument(current => ({ ...current, rules: [...current.rules, rule] }))
      return
    }
    setResourceRules(current => ({
      ...current,
      [kind]: [...current[kind], resourceEditableRule(rule)],
    }))
  }

  const updateRule = next => setDocument(current => ({
    ...current,
    rules: current.rules.map(rule => rule.id === next.id ? next : rule),
  }))

  const removeRule = id => setDocument(current => ({
    ...current,
    rules: current.rules.filter(rule => rule.id !== id),
  }))

  const updateSourceRule = (kind, index, next) => setResourceRules(current => ({
    ...current,
    [kind]: current[kind].map((rule, ruleIndex) => ruleIndex === index ? next : rule),
  }))

  const removeSourceRule = (kind, index) => setResourceRules(current => ({
    ...current,
    [kind]: current[kind].filter((_rule, ruleIndex) => ruleIndex !== index),
  }))

  const moveRule = (kind, fromIndex, toIndex) => {
    if (kind === 'global') {
      setDocument(current => ({
        ...current,
        rules: reorderRegexScope(current.rules, kind, fromIndex, toIndex),
      }))
      return
    }
    setResourceRules(current => ({
      ...current,
      [kind]: reorderRegexRules(current[kind], fromIndex, toIndex),
    }))
  }

  const importFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const imported = importRegexDocument(JSON.parse(await file.text()), {
        scope: scopeFor(importScope.current, bindings),
      })
      if (importScope.current === 'global') {
        await persist({ ...document, rules: [...document.rules, ...imported] })
      } else {
        const nextResourceRules = {
          ...resourceRules,
          [importScope.current]: [
            ...resourceRules[importScope.current],
            ...imported.map(resourceEditableRule),
          ],
        }
        await persist(document, nextResourceRules)
      }
      setStatus({ text: uiMessage('regex.imported', { count: imported.length }), error: false })
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true })
      setBusy(false)
    }
  }

  const title = uiMessage('regex.title')
  const closeLabel = uiMessage('panel.close', { title: unwrapText(title) })
  return h('div', { className: 'dtv-panel dtv-regex-panel' },
    h('div', { className: 'dtv-header' },
      h('div', { className: 'dtv-title' }, title),
      h('button', { className: 'dtv-close', type: 'button', title: closeLabel, 'aria-label': closeLabel, onClick: guardedClose }, '✕'),
    ),
    h('div', { className: 'dtv-body' },
      h('p', { className: 'dtv-note' }, uiMessage('regex.displayOnlyNote')),
      h('input', { ref: fileInput, type: 'file', accept: 'application/json,.json', hidden: true, onChange: importFile }),
      ...SCOPE_KINDS.map(kind => h(RegexScopeSection, {
        key: kind,
        kind,
        bindings,
        editableRules: kind === 'global' ? document.rules.filter(rule => rule.scope.kind === 'global') : [],
        sourceRules: kind === 'preset' ? resourceRules.preset : kind === 'character' ? resourceRules.character : [],
        busy,
        add: () => addRule(kind),
        importJson: () => {
          importScope.current = kind
          fileInput.current?.click()
        },
        exportJson: rules => downloadRegexScripts(rules, kind),
        update: updateRule,
        remove: removeRule,
        updateSource: (index, next) => updateSourceRule(kind, index, next),
        removeSource: index => removeSourceRule(kind, index),
        move: (fromIndex, toIndex) => moveRule(kind, fromIndex, toIndex),
      })),
      h('div', { className: 'dtv-status', 'data-error': status.error }, status.text),
      h('div', { className: 'dtv-regex-footer' },
        h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: guardedLoad }, uiMessage('common.reload')),
        h('button', { className: 'dtv-button dtv-primary', type: 'button', disabled: busy || !dirty, onClick: () => persist(document) }, busy ? uiMessage('common.working') : uiMessage('common.saveChanges')),
      ),
    ),
  )
}
