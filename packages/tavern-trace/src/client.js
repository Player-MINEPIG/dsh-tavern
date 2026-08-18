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

const h = createLocalizedElement(createElement)

const TRACE_API = '/dsh-tavern/api/traces'

const css = `
.dttrace-root{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dttrace-toolbar{min-height:48px;box-sizing:border-box;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;gap:10px;flex:none;zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1))}.dttrace-title{font-size:16px;font-weight:680;flex:1}.dttrace-button{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:inherit;padding:7px 10px;font-size:13px;cursor:pointer}.dttrace-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dttrace-body{flex:1;min-height:0;overflow:auto;padding:12px max(14px,calc((100% - 880px)/2)) 28px}.dttrace-scale{zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1));display:flex;flex-direction:column;gap:10px;padding-bottom:8px}.dttrace-note,.dttrace-status{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dttrace-status{padding:9px 10px;border-radius:8px;background:var(--dsw-specific-tip)}.dttrace-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dttrace-record{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);overflow:visible}.dttrace-record>summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;align-items:center;gap:8px;border-radius:10px}.dttrace-record[open]>summary{border-radius:10px 10px 0 0}.dttrace-record>summary::-webkit-details-marker{display:none}.dttrace-round{font-size:14px;font-weight:670}.dttrace-time{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-left:auto}.dttrace-badge{border-radius:999px;padding:2px 7px;font-size:11px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}.dttrace-badge[data-ok=true]{background:color-mix(in srgb,var(--dsw-alias-state-success,#2fa36b) 18%,transparent);color:var(--dsw-alias-state-success,#2fa36b)}
.dttrace-content{border-top:1px solid var(--dsw-alias-border-l1);padding:11px 12px 16px;display:flex;flex-direction:column;gap:10px}.dttrace-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dttrace-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;min-width:0}.dttrace-label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}.dttrace-value{font-size:13px;font-weight:620;margin-top:3px;overflow-wrap:anywhere}.dttrace-meta{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-tertiary);margin-top:3px;overflow-wrap:anywhere}
.dttrace-section{display:flex;flex-direction:column;gap:6px}.dttrace-section-title{font-size:14px;font-weight:670}.dttrace-book{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dttrace-decision{display:grid;grid-template-columns:76px minmax(110px,.7fr) minmax(160px,1.5fr);gap:7px;padding:6px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.45}.dttrace-decision:first-of-type{border-top:0}.dttrace-decision-state{font-weight:650}.dttrace-decision[data-included=true] .dttrace-decision-state{color:var(--dsw-alias-state-success,#2fa36b)}.dttrace-keywords{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.dttrace-list{margin:0;padding-left:18px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
@media(max-width:760px){.dttrace-grid{grid-template-columns:1fr}.dttrace-decision{grid-template-columns:70px 1fr}.dttrace-keywords{grid-column:1/-1}}
`

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

function resourceCard(labelKey, value) {
  return h('div', { className: 'dttrace-card', key: labelKey },
    h('div', { className: 'dttrace-label' }, uiMessage(labelKey)),
    h('div', { className: 'dttrace-value' }, value?.name ? rawText(value.name) : uiMessage('trace.unused')),
    value?.id ? h('div', { className: 'dttrace-meta' }, rawText(value.id)) : null,
  )
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

function TraceRecord({ record, latest }) {
  const authority = record.authority ?? {}
  const linked = authority.headerEventSeq !== null
  const reusedHeader = authority.headerReused ? translate('trace.reusedHeader') : ''
  const profileStatus = translate(authority.tavernProfilePresent === false
    ? 'trace.profile.missing'
    : authority.tavernProfilePresent === true ? 'trace.profile.consistent' : 'trace.profile.absent')
  const configStatus = translate(authority.tavernCallConfigApplied === false ? 'trace.config.inconsistent' : 'trace.config.consistent')
  return h('details', { className: 'dttrace-record', open: latest },
    h('summary', null,
      h('span', { className: 'dttrace-round' }, uiMessage(record.attempt > 1 ? 'trace.roundAttempt' : 'trace.round', { turn: record.turn, step: record.step, attempt: record.attempt })),
      h('span', { className: 'dttrace-badge', 'data-ok': linked || undefined }, linked ? rawText(`request/header #${authority.headerEventSeq}`) : uiMessage('trace.waitingHeader')),
      h('span', { className: 'dttrace-time' }, rawText(formatTime(record.recordedAt))),
    ),
    h('div', { className: 'dttrace-content' },
      h('div', { className: 'dttrace-status' }, linked
        ? uiMessage('trace.recordAligned', { sequence: authority.headerEventSeq, reused: reusedHeader, profile: profileStatus, config: configStatus })
        : uiMessage('trace.pendingHeader')),
      h('div', { className: 'dttrace-grid' },
        resourceCard('trace.resource.preset', record.resources?.preset),
        resourceCard('trace.resource.character', record.resources?.characterCard),
        resourceCard('trace.resource.user', record.resources?.userProfile),
      ),
      h('div', { className: 'dttrace-section' },
        h('div', { className: 'dttrace-section-title' }, uiMessage('trace.assembly')),
        h('div', { className: 'dttrace-meta' }, uiMessage('trace.assemblyMeta', {
          section: record.assembly.profileSection,
          order: record.assembly.profileOrder,
          mode: record.assembly.systemPromptMode,
          characters: record.assembly.systemCharacters,
          config: Object.keys(record.assembly.callConfig ?? {}).join(', ') || translate('common.none'),
        })),
      ),
      record.worldBooks?.length > 0 ? h('div', { className: 'dttrace-section' },
        h('div', { className: 'dttrace-section-title' }, uiMessage('trace.worldBookDecisions')),
        h('div', { className: 'dttrace-meta' }, record.activation?.pendingMessageCount > 0
          ? uiMessage('trace.activationPending', {
            included: record.activation.includedPendingMessageCount,
            pending: record.activation.pendingMessageCount,
            truncated: record.activation.truncated ? translate('trace.truncated') : '',
          })
          : uiMessage('trace.historyOnly')),
        ...record.worldBooks.map((book, index) => h(WorldBookAudit, { book, key: `${book.resource?.id ?? 'book'}-${index}` })),
      ) : h('div', { className: 'dttrace-note' }, uiMessage('trace.noSource')),
      record.diagnostics?.length > 0 ? h('div', { className: 'dttrace-section' },
        h('div', { className: 'dttrace-section-title' }, uiMessage('trace.diagnostics', { count: record.diagnostics.length })),
        h('ul', { className: 'dttrace-list' }, ...record.diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, rawText(`${item.code}: ${item.message}`)))),
      ) : null,
      h('p', { className: 'dttrace-note' }, uiMessage('trace.privacy')),
    ),
  )
}

export function TavernTraceView({ sessionId, useSession }) {
  const lastVisibleSeq = useSession(snapshot => snapshot.nodes.at(-1)?.seq ?? -1)
  const running = useSession(snapshot => snapshot.running)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [uiSettings, setUiSettings] = useState(getClientUiSettings)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${TRACE_API}?sessionId=${encodeURIComponent(sessionId)}`)
      const next = await response.json().catch(() => null)
      if (!response.ok || next?.ok === false) throw new Error(next?.error ?? `HTTP ${response.status}`)
      setData(next)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [sessionId])

  useEffect(() => { refresh() }, [refresh, lastVisibleSeq, running])
  useEffect(() => {
    const onSettings = event => setUiSettings(event.detail ?? getClientUiSettings())
    window.addEventListener('dsh-tavern:ui-settings', onSettings)
    return () => window.removeEventListener('dsh-tavern:ui-settings', onSettings)
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
        h('p', { className: 'dttrace-note' }, uiMessage('trace.intro')),
        error ? h('div', { className: 'dttrace-status', 'data-error': true }, rawText(error)) : null,
        data === null && !error ? h('div', { className: 'dttrace-status' }, uiMessage('trace.reading')) : null,
        data !== null ? h('div', { className: 'dttrace-status' }, storageStatus(data.storage)) : null,
        records.length === 0 && data !== null ? h('div', { className: 'dttrace-status' }, uiMessage('trace.empty')) : null,
        ...records.map((record, index) => h(TraceRecord, { record, latest: index === 0, key: record.id })),
      ),
    ),
  )
}

export function installTavernTraceStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-trace"]') !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = 'dsh-tavern-trace'
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
