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
  getRegexDocument,
  importRegexDocument,
  normalizeRegexRule,
  putRegexDocument,
} from './regex.js'

const h = createLocalizedElement(createElement)
const EMPTY_DOCUMENT = Object.freeze({ schemaVersion: 1, rules: Object.freeze([]) })
const SCOPE_KINDS = Object.freeze(['global', 'preset', 'character'])

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

function downloadJson(document) {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = 'regex.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function Field({ labelKey, children }) {
  return h('label', { className: 'dtv-field' },
    h('span', { className: 'dtv-label' }, uiMessage(labelKey)),
    children,
  )
}

function RuleEditor({ rule, busy, update, remove }) {
  const set = patch => update({ ...rule, ...patch })
  const setScope = patch => set({ scope: { ...rule.scope, ...patch } })
  const stateLabel = uiMessage(rule.enabled ? 'common.enabled' : 'common.disabled')
  return h('details', { className: 'dtv-entry dtv-regex-rule', 'data-enabled': rule.enabled },
    h('summary', null,
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
          disabled: busy,
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
          disabled: busy,
          onChange: event => setScope({ resourceId: event.target.value || null }),
        })),
      ),
      h('div', { className: 'dtv-entry-actions' }, h('button', {
        className: 'dtv-button dtv-danger',
        type: 'button',
        disabled: busy,
        onClick: remove,
      }, uiMessage('common.delete'))),
    ),
  )
}

export function RegexPanel({ client, activeSnapshot, close }) {
  const [document, setDocument] = useState(EMPTY_DOCUMENT)
  const [savedDocument, setSavedDocument] = useState(EMPTY_DOCUMENT)
  const [scopeKind, setScopeKind] = useState('global')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ text: uiMessage('common.loading'), error: false })
  const fileInput = useRef(null)
  const bindings = activeRegexBindings(activeSnapshot)
  const dirty = JSON.stringify(document) !== JSON.stringify(savedDocument)

  const load = async () => {
    setBusy(true)
    try {
      const next = await getRegexDocument(client)
      setDocument(next)
      setSavedDocument(next)
      setStatus({ text: uiMessage('regex.loaded', { count: next.rules.length }), error: false })
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [client])

  const persist = async next => {
    setBusy(true)
    try {
      const saved = await putRegexDocument(client, next)
      setDocument(saved)
      setSavedDocument(saved)
      setStatus({ text: uiMessage('regex.saved', { count: saved.rules.length }), error: false })
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

  const addRule = () => {
    const rule = normalizeRegexRule({
      name: unwrapText(uiMessage('regex.newRule')),
      enabled: true,
      find: '',
      replace: '',
      flags: 'g',
      target: 'assistant',
    }, { scope: scopeFor(scopeKind, bindings) })
    setDocument(current => ({ ...current, rules: [...current.rules, rule] }))
  }

  const updateRule = next => setDocument(current => ({
    ...current,
    rules: current.rules.map(rule => rule.id === next.id ? next : rule),
  }))

  const removeRule = id => setDocument(current => ({
    ...current,
    rules: current.rules.filter(rule => rule.id !== id),
  }))

  const importFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const imported = importRegexDocument(JSON.parse(await file.text()), {
        scope: scopeFor(scopeKind, bindings),
      })
      await persist({ ...document, rules: [...document.rules, ...imported] })
      setStatus({ text: uiMessage('regex.imported', { count: imported.length }), error: false })
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true })
      setBusy(false)
    }
  }

  const visibleRules = document.rules.filter(rule => rule.scope.kind === scopeKind)
  const title = uiMessage('regex.title')
  const closeLabel = uiMessage('panel.close', { title: unwrapText(title) })
  return h('div', { className: 'dtv-panel dtv-regex-panel' },
    h('div', { className: 'dtv-header' },
      h('div', { className: 'dtv-title' }, title),
      h('button', { className: 'dtv-close', type: 'button', title: closeLabel, 'aria-label': closeLabel, onClick: guardedClose }, '✕'),
    ),
    h('div', { className: 'dtv-body' },
      h('p', { className: 'dtv-note' }, uiMessage('regex.displayOnlyNote')),
      h('div', { className: 'dtv-regex-scopes', role: 'tablist', 'aria-label': uiMessage('regex.scopes') },
        ...SCOPE_KINDS.map(kind => h('button', {
          className: 'dtv-button',
          type: 'button',
          role: 'tab',
          key: kind,
          'aria-selected': scopeKind === kind,
          'data-selected': scopeKind === kind,
          onClick: () => setScopeKind(kind),
        }, uiMessage(`regex.scope.${kind}`))),
      ),
      scopeKind === 'preset' && bindings.presetId === null
        ? h('p', { className: 'dtv-note' }, uiMessage('regex.noPreset'))
        : scopeKind === 'character' && bindings.characterId === null
          ? h('p', { className: 'dtv-note' }, uiMessage('regex.noCharacter'))
          : null,
      h('div', { className: 'dtv-book-toolbar' },
        h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: addRule }, uiMessage('regex.add')),
        h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: () => fileInput.current?.click() }, uiMessage('common.importJson')),
        h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: () => downloadJson(document) }, uiMessage('common.exportJson')),
      ),
      h('input', { ref: fileInput, type: 'file', accept: 'application/json,.json', hidden: true, onChange: importFile }),
      visibleRules.length === 0
        ? h('p', { className: 'dtv-note' }, uiMessage('regex.emptyScope'))
        : visibleRules.map(rule => h(RuleEditor, {
          key: rule.id,
          rule,
          busy,
          update: updateRule,
          remove: () => removeRule(rule.id),
        })),
      h('div', { className: 'dtv-status', 'data-error': status.error }, status.text),
      h('div', { className: 'dtv-regex-footer' },
        h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: guardedLoad }, uiMessage('common.reload')),
        h('button', { className: 'dtv-button dtv-primary', type: 'button', disabled: busy || !dirty, onClick: () => persist(document) }, busy ? uiMessage('common.working') : uiMessage('common.saveChanges')),
      ),
    ),
  )
}
