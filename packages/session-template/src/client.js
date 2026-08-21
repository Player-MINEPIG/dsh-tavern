import {
  createElement,
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  createLocalizedElement,
  rawText,
  statusText,
  translate,
  uiError,
  uiMessage,
  unwrapText,
} from '../../client/src/i18n.js'
import { API_V1 as API_ROOT, CLIENT_REFRESH_EVENT } from '../../identity.js'

const h = createLocalizedElement(createElement)

async function api(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: options.body === undefined
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`)
    error.diagnostics = data?.error?.diagnostics ?? []
    throw error
  }
  return data
}

function PreviewRow({ label, value, missing = false }) {
  return h('div', { className: 'dtv-preview-row', 'data-missing': missing || undefined },
    h('span', { className: 'dtv-preview-label' }, label),
    h('span', { className: 'dtv-preview-value' }, value),
  )
}

function resourceValue(resource, emptyKey) {
  return resource === null || resource === undefined
    ? uiMessage(emptyKey)
    : rawText(resource.name || resource.id)
}

function TemplatePreview({ template }) {
  const contents = template?.contents ?? {}
  const character = template?.selection?.character ?? contents.character ?? {}
  const books = Array.isArray(contents.worldBooks) ? contents.worldBooks : []
  const enabledLabel = character.preferCharacterSystemPrompt === false ? translate('common.disabled') : translate('common.enabled')
  const postHistoryLabel = character.preferCharacterPostHistory === false ? translate('common.disabled') : translate('common.enabled')
  return h('div', { className: 'dtv-preview' },
    h('div', { className: 'dtv-preview-title' }, uiMessage('template.preview.title')),
    h(PreviewRow, { label: uiMessage('nav.preset'), value: resourceValue(contents.preset, 'nav.preset.empty'), missing: contents.preset?.missing }),
    h(PreviewRow, { label: uiMessage('nav.character'), value: resourceValue(contents.characterCard, 'nav.character.empty'), missing: contents.characterCard?.missing }),
    contents.characterCard === null || contents.characterCard === undefined ? null : h('div', { className: 'dtv-preview-options' },
      h('span', null, uiMessage('template.preview.greeting', { value: Number(character.greetingIndex ?? 0) + 1 })),
      h('span', null, uiMessage('template.preview.systemPrompt', { value: enabledLabel })),
      h('span', null, uiMessage('template.preview.postHistory', { value: postHistoryLabel })),
    ),
    h(PreviewRow, { label: uiMessage('nav.user'), value: resourceValue(contents.user, 'nav.user.empty'), missing: contents.user?.missing }),
    h('div', { className: 'dtv-preview-row dtv-preview-books' },
      h('span', { className: 'dtv-preview-label' }, uiMessage('template.preview.worldBooks')),
      books.length === 0
        ? h('span', { className: 'dtv-preview-value' }, uiMessage('nav.worldBook.empty'))
        : h('ol', { className: 'dtv-preview-list' }, ...books.map(book => h('li', { key: book.id, 'data-missing': book.missing || undefined }, rawText(book.name || book.id)))),
    ),
  )
}

export function SessionTemplatePanel({ sessionId, workspaceId, chromeMode = 'native', createCleanSession, createConfiguredPlaythrough, close }) {
  const [templates, setTemplates] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [name, setName] = useState(() => translate('template.defaultName'))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ error: false, key: 'template.ready' })

  const selected = templates.find(item => item.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    const data = await api('/session-templates')
    setTemplates(data.templates)
    setSelectedId(data.selectedId)
    const active = data.templates.find(item => item.id === data.selectedId)
    if (active !== undefined) setName(active.name)
  }, [])

  useEffect(() => {
    refresh().catch(reason => setStatus({
      error: true,
      key: reason.uiKey,
      values: reason.uiValues,
      text: reason instanceof Error ? reason.message : String(reason),
    }))
    const onRefresh = () => refresh().catch(reason => setStatus({
      error: true,
      key: reason.uiKey,
      values: reason.uiValues,
      text: reason instanceof Error ? reason.message : String(reason),
    }))
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh)
  }, [refresh])

  const run = useCallback(async (operation, success) => {
    setBusy(true)
    try {
      const result = await operation()
      const next = typeof success === 'function' ? success(result) : success
      setStatus(typeof next === 'string' ? { error: false, key: next } : { error: false, ...next })
      await refresh()
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
      return result
    } catch (reason) {
      const diagnostics = Array.isArray(reason?.diagnostics) ? reason.diagnostics : []
      setStatus({
        error: true,
        key: reason.uiKey,
        values: reason.uiValues,
        text: diagnostics[0]?.message ?? (reason instanceof Error ? reason.message : String(reason)),
      })
      return null
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const select = event => run(async () => {
    const id = event.target.value || null
    const data = await api('/session-templates/select', {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
    setSelectedId(data.selectedId)
    if (data.template !== null) setName(data.template.name)
  }, 'template.status.selected')

  const create = () => run(async () => {
    if (!sessionId) throw uiError('template.error.needSessionToSave')
    return api('/session-templates', {
      method: 'POST',
      body: JSON.stringify({ name, sourceSessionId: sessionId }),
    })
  }, result => ({ key: 'template.status.created', values: { name: result.template.name } }))

  const rename = () => run(async () => {
    if (selectedId === null) throw uiError('template.error.needTemplate')
    return api(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  }, result => ({ key: 'template.status.renamed', values: { name: result.template.name } }))

  const update = () => run(async () => {
    if (!sessionId || selectedId === null) throw uiError('template.error.needSessionAndTemplate')
    return api(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, sourceSessionId: sessionId }),
    })
  }, result => ({ key: 'template.status.updated', values: { name: result.template.name } }))

  const remove = () => {
    if (selectedId === null || !window.confirm(unwrapText(uiMessage('template.confirmDelete', { name: selected?.name ?? selectedId })))) return
    run(() => api(`/session-templates/${encodeURIComponent(selectedId)}`, { method: 'DELETE', body: JSON.stringify({}) }), 'template.status.deleted')
  }

  const start = mode => run(async () => {
    if (mode === 'current' && !sessionId) throw uiError('template.error.needSourceSession')
    const source = mode === 'current'
      ? { mode: 'current', sessionId }
      : { mode: 'template', templateId: selectedId }
    if (mode === 'template' && selectedId === null) throw uiError('template.error.needTemplate')
    if (chromeMode === 'play') return createConfiguredPlaythrough({ source })
    if (workspaceId === null) throw uiError('template.error.needWorkspace')
    return createCleanSession({ workspaceId, source })
  }, id => ({ key: chromeMode === 'play' ? 'template.status.playthroughStarted' : 'template.status.switched', values: { id } }))

  const diagnostics = Array.isArray(selected?.diagnostics) ? selected.diagnostics : []
  const closeLabel = uiMessage('panel.close', { title: unwrapText(uiMessage('template.title')) })

  return h('div', { className: 'dtv-panel' },
    h('div', { className: 'dtv-header' },
      h('div', { className: 'dtv-title' }, uiMessage('template.title')),
      h('button', { className: 'dtv-close', type: 'button', title: closeLabel, 'aria-label': closeLabel, onClick: close }, '✕'),
    ),
    h('div', { className: 'dtv-body' },
      h('div', { className: 'dtv-template-toolbar' },
        h('button', { className: 'dtv-button', type: 'button', disabled: busy || !sessionId, onClick: create }, uiMessage('template.createFromCurrent')),
        h('button', {
          className: 'dtv-button dtv-primary',
          type: 'button',
          disabled: busy || !sessionId || (chromeMode !== 'play' && workspaceId === null),
          onClick: () => start('current'),
        }, uiMessage(chromeMode === 'play' ? 'template.startCurrentPlaythrough' : 'template.startCurrent')),
      ),
      h('label', { className: 'dtv-field' },
        h('span', { className: 'dtv-label' }, uiMessage('template.selected')),
        h('select', { className: 'dtv-select', value: selectedId ?? '', disabled: busy, onChange: select },
          h('option', { value: '' }, uiMessage('template.noneSelected')),
          ...templates.map(template => h('option', { key: template.id, value: template.id }, rawText(template.name))),
        ),
      ),
      h('p', { className: 'dtv-note' }, uiMessage('template.inheritNote')),
      chromeMode !== 'play' && workspaceId === null
        ? h('div', { className: 'dtv-status', 'data-error': true }, uiMessage('template.noWorkspace'))
        : null,
      h('div', { className: 'dtv-status', 'data-error': status.error || undefined, role: 'status' }, statusText(status)),
      h('p', { className: 'dtv-note' }, uiMessage('template.blankSessionNote')),
      h('div', { className: 'dtv-resource' },
        h('div', { className: 'dtv-resource-title' }, uiMessage('template.listTitle', { count: templates.length })),
        h('label', { className: 'dtv-field' },
          h('span', { className: 'dtv-label' }, uiMessage('template.name')),
          h('div', { className: 'dtv-template-name' },
            h('input', { className: 'dtv-input', value: name, maxLength: 120, disabled: busy, onChange: event => setName(event.target.value) }),
            h('button', { className: 'dtv-button', type: 'button', disabled: busy || selectedId === null, onClick: rename }, uiMessage('template.saveNameOnly')),
          ),
        ),
        h('p', { className: 'dtv-note' }, uiMessage('template.currentSettingsReminder')),
        selected === null ? null : h(TemplatePreview, { template: selected }),
        diagnostics.length === 0 ? null : h('div', { className: 'dtv-status', 'data-error': true },
          h('div', null, uiMessage('template.unusable')),
          h('ul', { className: 'dtv-list' }, ...diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, rawText(item.message)))),
        ),
        h('button', {
          className: 'dtv-button dtv-primary',
          type: 'button',
          disabled: busy || selectedId === null || diagnostics.length > 0 || (chromeMode !== 'play' && workspaceId === null),
          onClick: () => start('template'),
        }, uiMessage(chromeMode === 'play' ? 'template.startPlaythroughFromTemplate' : 'template.startFromTemplate')),
      ),
      h('div', { className: 'dtv-template-footer' },
        h('button', { className: 'dtv-button dtv-primary', type: 'button', disabled: busy || !sessionId || selectedId === null, onClick: update }, uiMessage('template.updateFromCurrent')),
        h('button', { className: 'dtv-button dtv-danger', type: 'button', disabled: busy || selectedId === null, onClick: remove }, uiMessage('template.delete')),
      ),
    ),
  )
}
