import {
  createElement,
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  createLocalizedElement,
  getClientUiSettings,
  rawText,
  translate,
  uiMessage,
  unwrapText,
} from '../../client/src/i18n.js'
import { API_V3, CLIENT_UI_SETTINGS_EVENT, PLUGIN_ID } from '../../identity.js'

const h = createLocalizedElement(createElement)

const TRACE_API = `${API_V3}/sessions`

const css = `
.dttrace-root{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dttrace-toolbar{min-height:48px;box-sizing:border-box;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;gap:10px;flex:none;zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1))}.dttrace-title{font-size:16px;font-weight:680;flex:1}.dttrace-button{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:inherit;padding:7px 10px;font-size:13px;cursor:pointer}.dttrace-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dttrace-body{flex:1;min-height:0;overflow:auto;padding:12px max(14px,calc((100% - 880px)/2)) 180px}.dttrace-scale{zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1));display:flex;flex-direction:column;gap:10px;padding-bottom:8px}.dttrace-note,.dttrace-status{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dttrace-status{padding:9px 10px;border-radius:8px;background:var(--dsw-specific-tip)}.dttrace-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dttrace-record{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);overflow:visible}.dttrace-record>summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;align-items:center;gap:8px;border-radius:10px}.dttrace-record[open]>summary{border-radius:10px 10px 0 0}.dttrace-record>summary::-webkit-details-marker{display:none}.dttrace-round{font-size:14px;font-weight:670}.dttrace-time{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-left:auto}.dttrace-badge{border-radius:999px;padding:2px 7px;font-size:11px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}.dttrace-badge[data-ok=true]{background:color-mix(in srgb,var(--dsw-alias-state-success,#2fa36b) 18%,transparent);color:var(--dsw-alias-state-success,#2fa36b)}
.dttrace-content{border-top:1px solid var(--dsw-alias-border-l1);padding:11px 12px 16px;display:flex;flex-direction:column;gap:10px}.dttrace-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dttrace-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;min-width:0}.dttrace-label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}.dttrace-value{font-size:13px;font-weight:620;margin-top:3px;overflow-wrap:anywhere}.dttrace-meta{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-tertiary);margin-top:3px;overflow-wrap:anywhere}
.dttrace-section{display:flex;flex-direction:column;gap:6px}.dttrace-section-title{font-size:14px;font-weight:670}.dttrace-book>summary{overflow-wrap:anywhere}.dttrace-book{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dttrace-decision{display:grid;grid-template-columns:76px minmax(110px,.7fr) minmax(160px,1.5fr);gap:7px;padding:6px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.45}.dttrace-decision:first-of-type{border-top:0}.dttrace-decision-state{font-weight:650}.dttrace-decision[data-included=true] .dttrace-decision-state{color:var(--dsw-alias-state-success,#2fa36b)}.dttrace-keywords{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.dttrace-list{margin:0;padding-left:18px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
.dttrace-disclosure{border-top:1px solid var(--dsw-alias-border-l1);padding-top:10px;margin-top:4px}.dttrace-disclosure>summary{cursor:pointer;font-size:14px;font-weight:650}.dttrace-disclosure-body{display:flex;flex-direction:column;gap:10px;padding-top:10px}.dttrace-card .dttrace-label{text-transform:none;letter-spacing:0}
@media(max-width:760px){.dttrace-grid{grid-template-columns:1fr}.dttrace-decision{grid-template-columns:70px 1fr}.dttrace-keywords{grid-column:1/-1}}
`

const statusLabels = Object.freeze({
  "assembled": "trace.v3.status.assembled",
  "request-observed": "trace.v3.status.request-observed",
  "request-unconfirmed": "trace.v3.status.request-unconfirmed",
  "request-failed-before-observation": "trace.v3.status.request-failed-before-observation",
  "assembly-or-preparation-failed": "trace.v3.status.assembly-or-preparation-failed",
  "superseded-unconfirmed": "trace.v3.status.superseded-unconfirmed",
  "unloaded-unconfirmed": "trace.v3.status.unloaded-unconfirmed",
  "legacy-metadata-only": "trace.v3.status.legacy-metadata-only"
})

const reasonLabels = Object.freeze({
  constant: 'trace.reason.constant',
  'primary-key-match': 'trace.reason.primary-key-match',
  'primary-key-miss': 'trace.reason.primary-key-miss',
  'secondary-and_any-match': 'trace.reason.secondary-and_any-match',
  'secondary-and_any-miss': 'trace.reason.secondary-and_any-miss',
  'secondary-and_all-match': 'trace.reason.secondary-and_all-match',
  'secondary-and_all-miss': 'trace.reason.secondary-and_all-miss',
  'secondary-not_any-match': 'trace.reason.secondary-not_any-match',
  'secondary-not_any-miss': 'trace.reason.secondary-not_any-miss',
  'secondary-not_all-match': 'trace.reason.secondary-not_all-match',
  'secondary-not_all-miss': 'trace.reason.secondary-not_all-miss',
  disabled: 'trace.reason.disabled',
  'external-vector-match-required': 'trace.reason.external-vector-match-required',
  'inclusion-group-loser': 'trace.reason.inclusion-group-loser',
  'probability-failed': 'trace.reason.probability-failed',
  'budget-exceeded': 'trace.reason.budget-exceeded',
  'empty-content': 'trace.reason.empty-content',
  'outlet-unsupported': 'trace.reason.outlet-unsupported',
})

function formatTime(value) {
  try { return new Date(value).toLocaleString() } catch { return '' }
}

function formatBytes(value) {
  return value >= 1024 * 1024
    ? `${Math.round(value / 1024 / 1024)} MiB`
    : `${Math.round(value / 1024)} KiB`
}

function storageStatus(storage) {
  const parts = [translate('trace.storage.total', { value: formatBytes(storage.maxTotalBytes) })]
  if (Number.isSafeInteger(storage.maxRecordsPerSession)) parts.push(translate('trace.storage.perSession', { value: storage.maxRecordsPerSession }))
  if (Number.isSafeInteger(storage.maxSessions)) parts.push(translate('trace.storage.sessions', { value: storage.maxSessions }))
  if (Number.isSafeInteger(storage.maxRecordBytes)) parts.push(translate('trace.storage.perRecord', { value: formatBytes(storage.maxRecordBytes) }))
  return uiMessage('trace.storage.summary', { limits: parts.join(translate('common.listSeparator')) })
}

function keywords(decision) {
  const configuredPrimary = decision.primaryKeys ?? []
  const configuredSecondary = decision.secondaryKeys ?? []
  const primary = decision.primaryMatches ?? []
  const secondary = decision.secondaryMatches ?? []
  const separator = translate('common.listSeparator')
  const configured = [
    configuredPrimary.length > 0 ? translate('trace.keywords.primary', { values: configuredPrimary.map(value => JSON.stringify(value)).join(separator) }) : null,
    configuredSecondary.length > 0 ? translate('trace.keywords.secondary', { values: configuredSecondary.map(value => JSON.stringify(value)).join(separator) }) : null,
  ].filter(Boolean).join(' · ') || translate('trace.noConfiguredKeywords')
  const matched = [
    primary.length > 0 ? translate('trace.keywords.primary', { values: primary.map(value => JSON.stringify(value)).join(separator) }) : null,
    secondary.length > 0 ? translate('trace.keywords.secondary', { values: secondary.map(value => JSON.stringify(value)).join(separator) }) : null,
  ].filter(Boolean).join(' · ') || translate('trace.noKeywordMatches')
  return { configured: rawText(configured), matched: rawText(matched) }
}

function decisionMeta(value) {
  const parts = []
  if (value.secondaryLogic) parts.push(`secondary=${value.secondaryLogic}`)
  if (value.groupName) parts.push(unwrapText(uiMessage('trace.decision.group', { name: value.groupName, detail: value.groupOverride ? ' / override' : value.groupWeight === null ? '' : ` / weight ${value.groupWeight}` })))
  if (value.probability !== null) {
    parts.push(unwrapText(uiMessage('trace.decision.probability', { value: value.probability, roll: value.probabilityRoll === null ? '' : ` / roll ${(value.probabilityRoll * 100).toFixed(2)}%` })))
  }
  if (value.tokenCost !== null) parts.push(unwrapText(uiMessage('trace.decision.budget', { value: value.tokenCost })))
  if (value.requestedPosition) {
    parts.push(unwrapText(uiMessage('trace.decision.position', {
      requested: value.requestedPosition,
      result: value.appliedPosition
        ? translate('trace.position.applied', {
          position: value.appliedPosition,
          approximate: value.approximatePosition ? translate('trace.position.approximate') : '',
        })
        : translate('trace.position.notInserted'),
    })))
  }
  return rawText(parts.join(' · '))
}

function WorldBookAudit({ book }) {
  const name = book.resource?.name || book.resource?.id
  const decisionCount = translate(book.decisions.length === 1 ? 'trace.decisionCount.one' : 'trace.decisionCount.other', { count: book.decisions.length })
  return h('div', { className: 'dttrace-book' },
    h('div', { className: 'dttrace-section-title' }, name ? rawText(name) : uiMessage('nav.worldBook')),
    h('div', { className: 'dttrace-meta' }, uiMessage('trace.bookBudget', { used: book.budget.used, limit: book.budget.limit === null ? '' : ` / ${book.budget.limit}`, decisionCount })),
    ...book.decisions.map((item, index) => {
      const keywordState = keywords(item)
      return h('div', {
      className: 'dttrace-decision',
      'data-included': item.decision === 'included',
      key: `${item.entryId ?? 'entry'}-${index}`,
    },
    h('div', { className: 'dttrace-decision-state' }, item.decision === 'included' ? uiMessage('trace.inserted') : uiMessage('trace.rejected')),
    h('div', null,
      h('div', null, item.entryName ? rawText(item.entryName) : uiMessage('world.entry.fallback', { id: String(item.entryId ?? index + 1) })),
      h('div', { className: 'dttrace-meta' }, reasonLabels[item.reason] ? uiMessage(reasonLabels[item.reason]) : rawText(item.reason)),
    ),
    h('div', { className: 'dttrace-keywords' },
      h('div', null, uiMessage('trace.keywords.configured', { value: unwrapText(keywordState.configured) })),
      h('div', null, uiMessage('trace.keywords.matched', { value: unwrapText(keywordState.matched) })),
      h('div', { className: 'dttrace-meta' }, decisionMeta(item)),
    ))}),
  )
}

function resourceCard(labelKey, value, id, known) {
  return h('div', { className: 'dttrace-card', key: labelKey },
    h('div', { className: 'dttrace-label' }, uiMessage(labelKey)),
    h('div', { className: 'dttrace-value' }, value?.name || value?.id || id
      ? rawText(value?.name || value?.id || id)
      : uiMessage(known ? 'trace.unused' : 'trace.v3.notRecorded')),
    value?.id || id ? h('div', { className: 'dttrace-meta' }, rawText(value?.id || id)) : null,
  )
}

function summaryCard(labelKey, value) {
  return h('div', { className: 'dttrace-card' },
    h('div', { className: 'dttrace-label' }, uiMessage(labelKey)),
    h('div', { className: 'dttrace-value' }, value),
  )
}

function segments(items, kind) {
  return (items ?? []).map((part, index) => h('details', { key: `${kind}-${index}`, className: 'dttrace-book' },
    h('summary', null, uiMessage('trace.v3.part', { index: part.index + 1, name: part.name, count: part.characters })),
    h('div', { className: 'dttrace-meta' }, rawText(`SHA-256 ${part.hash} · UTF-16 ${part.offsetUtf16 ?? '—'} · ${part.provenance}`)),
    h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 } }, rawText(part.text)),
    ...(part.sources ?? []).map((source, i) => h('details', { key: i },
      h('summary', null, rawText(`${source.kind} (${source.relationship ?? 'input'}) / ${source.resourceId ?? '—'} / ${source.field}`)),
      h('div', { className: 'dttrace-meta' }, uiMessage('trace.v3.sourceCount', { count: source.characters }), ' · ', rawText(source.resourceRevision ?? '')),
      h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, rawText(source.text)),
    )),
  ))
}

// Only captured fields are displayed; never resolve old IDs against current resources.
export function TraceRecordContent({ record }) {
  const audit = record.audit ?? {}
  const resources = audit.resources ?? {}
  const selection = record.selection ?? audit.selection ?? {}
  const books = audit.worldBooks
  const bookResources = resources.worldBooks ?? books?.map(book => book.resource).filter(Boolean)
  const config = audit.assembly?.callConfig
  const mode = audit.assembly?.systemPromptMode
  const unavailable = () => uiMessage('trace.v3.notRecorded')
  const resourceKnown = (key, selectionKey) => Object.hasOwn(resources, key) || Object.hasOwn(selection, selectionKey)
  return h('div', { className: 'dttrace-section' },
    h('div', { className: 'dttrace-section-title' }, uiMessage('trace.v3.configuration')),
    h('div', { className: 'dttrace-grid' },
      resourceCard('trace.resource.preset', resources.preset, selection.presetId, resourceKnown('preset', 'presetId')),
      resourceCard('trace.resource.character', resources.characterCard, selection.characterCardId, resourceKnown('characterCard', 'characterCardId')),
      resourceCard('trace.resource.user', resources.userProfile, selection.userId ?? selection.userProfileId,
        resourceKnown('userProfile', 'userId') || Object.hasOwn(selection, 'userProfileId')),
      summaryCard('trace.v3.worldBooks', bookResources === undefined ? unavailable() : bookResources.length
        ? rawText(bookResources.map(book => book.name || book.id).join(translate('common.listSeparator'))) : uiMessage('trace.unused')),
      summaryCard('trace.v3.mode', mode === 'append' ? uiMessage('trace.v3.append') : mode === 'replace' ? uiMessage('trace.v3.replace') : unavailable()),
      summaryCard('trace.v3.model', record.delivery?.model
        ? rawText([record.delivery.provider, record.delivery.model].filter(Boolean).join(' / ')) : unavailable()),
    ),
    Number.isSafeInteger(selection.character?.greetingIndex)
      ? h('div', { className: 'dttrace-meta' }, uiMessage('trace.v3.greeting', { index: selection.character.greetingIndex })) : null,
    h('div', { className: 'dttrace-meta' }, uiMessage('trace.v3.sampling'), ' ', config === undefined ? unavailable()
      : Object.keys(config).length ? rawText(Object.entries(config).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(' · ')) : uiMessage('trace.v3.noSampling')),
    record.contentStatus && record.contentStatus !== 'available'
      ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v3.contentUnavailable'), ' ', rawText(record.contentStatus)) : null,
    h('details', { className: 'dttrace-disclosure' },
      h('summary', null, uiMessage('trace.v3.worldBookDetails')),
      h('div', { className: 'dttrace-disclosure-body' },
        audit.activation ? h('div', { className: 'dttrace-meta' }, audit.activation.pendingMessageCount > 0
          ? uiMessage('trace.activationPending', { included: audit.activation.includedPendingMessageCount,
            pending: audit.activation.pendingMessageCount, truncated: audit.activation.truncated ? translate('trace.truncated') : '' })
          : uiMessage('trace.historyOnly')) : null,
        books === undefined ? h('p', { className: 'dttrace-note' }, unavailable())
          : books.length ? books.map((book, index) => h(WorldBookAudit, { book, key: index }))
            : h('p', { className: 'dttrace-note' }, uiMessage('trace.noSource')),
      ),
    ),
    h('details', { className: 'dttrace-disclosure' },
      h('summary', null, uiMessage('trace.v3.loaderDetails')),
      h('div', { className: 'dttrace-disclosure-body' },
        h('p', { className: 'dttrace-note' }, uiMessage(record.delivery?.assemblyVerified ? 'trace.v3.verified' : 'trace.v3.unverified')),
        record.sections ? h('div', { className: 'dttrace-section-title' }, uiMessage('trace.v3.sections')) : null,
        ...segments(record.sections, 'system'),
        record.contexts ? h('div', { className: 'dttrace-section-title' }, uiMessage('trace.v3.contexts')) : null,
        ...segments(record.contexts, 'context'),
        !record.sections ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v3.noAssembly')) : null,
        record.systemMessages ? h('details', null,
          h('summary', null, uiMessage('trace.v3.actual')),
          ...record.systemMessages.map((text, i) => h('pre', { key: i, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, rawText(text))),
        ) : null,
        record.selection ? h('details', null, h('summary', null, uiMessage('trace.v3.bindings')),
          h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, rawText(JSON.stringify(record.selection, null, 2)))) : null,
        audit.diagnostics?.length ? h('details', null,
          h('summary', null, uiMessage('trace.diagnostics', { count: audit.diagnostics.length })),
          h('ul', { className: 'dttrace-list' }, ...audit.diagnostics.map((item, index) => h('li', { key: index }, rawText(`${item.code}: ${item.message}`)))),
        ) : null,
      ),
    ),
  )
}

function AssemblyRecord({ summary, sessionId, latest }) {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const [opened, setOpened] = useState(latest)
  useEffect(() => {
    if (!opened) return
    const controller = new AbortController()
    fetch(`${TRACE_API}/${encodeURIComponent(sessionId)}/assemblies/${encodeURIComponent(summary.id)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.record })
      .then(value => { if (!controller.signal.aborted) { setRecord(value); setError('') } })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => controller.abort()
  }, [opened, sessionId, summary.id, summary.status])
  return h('details', { className: 'dttrace-record', open: opened, onToggle: e => setOpened(e.currentTarget.open) },
    h('summary', null,
      h('span', { className: 'dttrace-round', title: translate('trace.v3.termsText') }, uiMessage(summary.attempt > 1 ? 'trace.roundAttempt' : 'trace.round', { turn: summary.turn, step: summary.step, attempt: summary.attempt })),
      h('span', { className: 'dttrace-badge', title: summary.status }, statusLabels[summary.status] ? uiMessage(statusLabels[summary.status]) : rawText(summary.status)),
      h('span', { className: 'dttrace-time' }, rawText(formatTime(summary.recordedAt))),
    ),
    h('div', { className: 'dttrace-content' },
      error ? h('p', { className: 'dttrace-status', 'data-error': true }, rawText(error)) : null,
      record ? h(TraceRecordContent, { record }) : h('p', null, uiMessage('trace.reading')),
    ),
  )
}

export function TavernTraceView({ sessionId, useSession, useChat }) {
  const lastVisibleSeq = useChat(snapshot => snapshot.legacy.nodes.at(-1)?.seq ?? -1)
  const running = useSession(snapshot => snapshot.running)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [uiSettings, setUiSettings] = useState(getClientUiSettings)

  const [refreshVersion, setRefreshVersion] = useState(0)
  const refresh = useCallback(() => setRefreshVersion(v => v + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    const load = async () => {
      try {
        const response = await fetch(`${TRACE_API}/${encodeURIComponent(sessionId)}/assemblies`, { signal: controller.signal, cache: 'no-store' })
        const next = await response.json()
        if (!response.ok) throw new Error(next.error ?? `HTTP ${response.status}`)
        if (!controller.signal.aborted) { setData(next); setError('') }
      } catch (e) { if (!controller.signal.aborted) setError(e.message) }
    }
    let timer
    const poll = async () => { await load(); if (!controller.signal.aborted && running) timer = setTimeout(poll, 1500) }
    poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [sessionId, lastVisibleSeq, running, refreshVersion])
  useEffect(() => {
    const onSettings = event => setUiSettings(event.detail ?? getClientUiSettings())
    window.addEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings)
    return () => window.removeEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings)
  }, [])

  const records = [...(data?.records ?? [])].reverse()
  return h('div', {
    className: 'dttrace-root',
    lang: uiSettings.locale,
    style: { '--dtv-trace-scale': String(uiSettings.scale) },
  },
    h('div', { className: 'dttrace-toolbar' },
      h('div', { className: 'dttrace-title' }, uiMessage('trace.title')),
      h('button', { className: 'dttrace-button', type: 'button', onClick: refresh }, uiMessage('common.refresh')),
    ),
    h('div', { className: 'dttrace-body' },
      h('div', { className: 'dttrace-scale' },
        h('p', { className: 'dttrace-note' }, uiMessage('trace.v3.intro')),
        h('details', { className: 'dttrace-note' },
          h('summary', null, uiMessage('trace.v3.terms')),
          h('p', null, uiMessage('trace.v3.termsText'))),
        error ? h('div', { className: 'dttrace-status', 'data-error': true }, rawText(error)) : null,
        data === null && !error ? h('div', { className: 'dttrace-status' }, uiMessage('trace.reading')) : null,
        records.length === 0 && data !== null ? h('div', { className: 'dttrace-status' }, uiMessage('trace.empty')) : null,
        ...records.map((record, index) => h(AssemblyRecord, { summary: record, sessionId, latest: index === 0, key: `${sessionId}:${record.id}` })),
        data !== null ? h('p', { className: 'dttrace-note' }, storageStatus(data.storage)) : null,
      ),
    ),
  )
}

export function installTavernTraceStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-trace"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-trace`
  style.textContent = css
  document.head.append(style)
}

export function registerTavernTraceView(ctx) {
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'tavern-trace',
    order: 20,
    label: translate('trace.title'),
    inject: () => ({}),
  }, TavernTraceView))
}
