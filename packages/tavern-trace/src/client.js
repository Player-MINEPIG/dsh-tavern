import { installTavernStyle } from '../../client-style.js'
import { MvuRoundSection, mvuStyles } from './mvu-view.js'
import { worldBookRequestOutcome } from './world-book-request.js'
import { recordedMessageNodes, recordedPersonalityLoadState, recordedRequestResult, recordedSystemModules } from './request-view.js'
import { isPersonalitySource } from './personality-source.js'
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
${mvuStyles}
.dttrace-root{--dttrace-success:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-state-success,#2fa36b)) 60%,var(--dsw-alias-label-primary));height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family),sans-serif;font-size:13px;line-height:1.5}
.dttrace-root ::selection{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 22%,transparent)}
.dttrace-root :is(button,summary,input):focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}
.dttrace-toolbar{min-height:48px;box-sizing:border-box;padding:8px 18px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;gap:12px;flex:none;zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1))}
.dttrace-title{font-size:15px;font-weight:650;flex:1}.dttrace-button{border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:inherit;padding:6px 12px;min-height:32px;font:inherit;cursor:pointer}.dttrace-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dttrace-button:active{background:var(--dsw-specific-tip)}
.dttrace-body{flex:1;min-height:0;overflow:auto;padding:16px max(20px,calc((100% - 1040px)/2)) 180px;scrollbar-color:var(--dsw-alias-border-l2) transparent}
.dttrace-scale{zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1));display:flex;flex-direction:column;gap:14px;padding-bottom:8px}
.dttrace-note,.dttrace-status{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0}.dttrace-status{padding:12px 14px;border-radius:8px;background:var(--dsw-specific-tip)}.dttrace-status[data-error=true]{color:var(--dsw-alias-state-error)}.dttrace-help{font-size:12px;color:var(--dsw-alias-label-secondary)}.dttrace-help>summary{cursor:pointer}.dttrace-help p{max-width:72ch;margin:8px 0 0}
.dttrace-record{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);min-width:0;overflow:visible}.dttrace-record>summary{list-style:none;cursor:pointer;padding:13px 16px;display:flex;align-items:center;gap:10px;border-radius:12px}.dttrace-record>summary:hover{background:var(--dsw-alias-interactive-bg-hover)}.dttrace-record[open]>summary{border-radius:12px 12px 0 0}.dttrace-record>summary::-webkit-details-marker{display:none}.dttrace-record>summary:before{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);flex:none;margin-right:3px}.dttrace-record[open]>summary:before{transform:rotate(45deg);margin-top:-3px}
.dttrace-round{font-size:14px;font-weight:650}.dttrace-time{font-size:12px;color:var(--dsw-alias-label-secondary);margin-left:auto;font-variant-numeric:tabular-nums}.dttrace-badge{border-radius:4px;padding:2px 6px;font-size:11px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}.dttrace-badge[data-ok=true]{color:var(--dttrace-success);background:color-mix(in srgb,var(--dttrace-success) 10%,transparent)}
.dttrace-content{border-top:1px solid var(--dsw-alias-border-l1);padding:16px;display:flex;flex-direction:column;gap:12px}.dttrace-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:28px;row-gap:0;margin-bottom:4px}.dttrace-card{display:grid;grid-template-columns:minmax(76px,.65fr) minmax(0,1.6fr);align-content:start;column-gap:12px;padding:9px 0;min-width:0;border-bottom:1px solid var(--dsw-alias-border-l1)}.dttrace-label{font-size:12px;color:var(--dsw-alias-label-secondary)}.dttrace-value{font-size:13px;font-weight:550;overflow-wrap:anywhere;min-width:0}.dttrace-meta{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.dttrace-card .dttrace-meta{grid-column:2;font-size:11px;margin-top:2px}.dttrace-personality[data-state=loaded] .dttrace-value{color:var(--dttrace-success)}
.dttrace-section{display:flex;flex-direction:column;gap:10px;min-width:0}.dttrace-section-title{font-size:13px;font-weight:650}.dttrace-book{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;min-width:0}.dttrace-book>summary{overflow-wrap:anywhere;cursor:pointer}.dttrace-book>summary~*{margin-top:8px}.dttrace-decision{display:grid;grid-template-columns:90px minmax(110px,.7fr) minmax(160px,1.5fr);gap:10px;padding:9px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.5}.dttrace-decision:first-of-type{border-top:0}.dttrace-decision-state{font-weight:600}.dttrace-decision[data-included=true] .dttrace-decision-state{color:var(--dttrace-success)}.dttrace-keywords{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.dttrace-list{margin:0;padding-left:18px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.dttrace-disclosure{border-top:1px solid var(--dsw-alias-border-l1);margin-top:4px}.dttrace-disclosure>summary{cursor:pointer;font-size:13px;font-weight:600;padding:12px 0;min-height:20px}.dttrace-disclosure>summary:hover{color:var(--dsw-alias-state-business-primary)}.dttrace-disclosure-body{display:flex;flex-direction:column;gap:12px;padding:0 0 12px}.dttrace-content pre{font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;max-height:440px;overflow:auto;padding:12px;background:var(--dsw-specific-tip);border-radius:6px;tab-size:2}
.dttrace-messages{display:flex;flex-direction:column;gap:8px}.dttrace-message>summary{font-weight:600}.dttrace-message-sources{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary);margin-top:4px}.dttrace-message[open]>summary{margin-bottom:8px}.dttrace-message>.dttrace-disclosure{margin-top:8px}.dttrace-message .dttrace-section-title{font-variant-numeric:tabular-nums}.dttrace-system-modules{display:flex;flex-direction:column;gap:0;margin-top:8px}.dttrace-system-group{display:flex;flex-direction:column;gap:6px}.dttrace-system-modules .dttrace-book{border:0;border-top:1px solid var(--dsw-alias-border-l1);border-radius:0;padding:8px 0}.dttrace-system-modules .dttrace-book>summary{font-size:12px}.dttrace-loading{display:flex;flex-direction:column;gap:10px;padding:12px 0;color:var(--dsw-alias-label-secondary)}.dttrace-loading:after{content:"";height:44px;border-radius:6px;background:var(--dsw-specific-tip)}
@media(max-width:760px){.dttrace-body{padding:12px 14px 180px}.dttrace-record>summary{flex-wrap:wrap;gap:7px 8px;padding:12px}.dttrace-time{flex-basis:100%;padding-left:18px}.dttrace-content{padding:12px}.dttrace-grid{column-gap:20px}.dttrace-card{grid-template-columns:1fr;gap:3px}.dttrace-card .dttrace-meta{grid-column:1}.dttrace-decision{grid-template-columns:80px 1fr}.dttrace-keywords{grid-column:1/-1}}
@media(max-width:440px){.dttrace-grid{grid-template-columns:1fr}.dttrace-card{grid-template-columns:92px minmax(0,1fr);column-gap:12px}.dttrace-card .dttrace-meta{grid-column:2}.dttrace-toolbar{padding-inline:14px}.dttrace-record>summary .dttrace-badge{max-width:100%;overflow-wrap:anywhere}}

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
  const limits = parts.join(translate('common.listSeparator'))
  return storage.kind === 'bounded-assembly-references'
    ? uiMessage('trace.v4.storageSummary', { limits })
    : uiMessage('trace.storage.summary', { limits })
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

function WorldBookAudit({ book, record }) {
  const outcome = worldBookRequestOutcome(record, book)
  const name = book.resource?.name || book.resource?.id
  const decisionCount = translate(book.decisions.length === 1 ? 'trace.decisionCount.one' : 'trace.decisionCount.other', { count: book.decisions.length })
  return h('div', { className: 'dttrace-book' },
    h('div', { className: 'dttrace-section-title' }, name ? rawText(name) : uiMessage('nav.worldBook')),
    h('div', { className: 'dttrace-meta' }, uiMessage('trace.bookBudget', { used: book.budget.used, limit: book.budget.limit === null ? '' : ` / ${book.budget.limit}`, decisionCount })),
    h('div', { className: 'dttrace-meta', 'data-worldbook-request': outcome?.applied ? 'applied' : outcome?.skipped ? 'skipped' : 'unrecorded' },
      uiMessage('trace.worldBook.request'), ' ',
      outcome?.applied ? uiMessage('trace.worldBook.applied') : outcome?.skipped ? null : uiMessage('trace.worldBook.unrecorded'),
      outcome?.skipped ? h('span', null, outcome.applied ? ' · ' : '', uiMessage('trace.worldBook.policySkipped'), ' · ',
        rawText(outcome.reasons.map(reason => reason ?? translate('trace.worldBook.reasonUnrecorded')).join(' / '))) : null),
    ...book.decisions.map((item, index) => {
      const keywordState = keywords(item)
      return h('div', {
      className: 'dttrace-decision',
      'data-included': item.decision === 'included',
      key: `${item.entryId ?? 'entry'}-${index}`,
    },
    h('div', { className: 'dttrace-decision-state' }, item.decision === 'included' ? uiMessage('trace.worldBook.candidate') : uiMessage('trace.rejected')),
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

const referenceReasons = Object.freeze({
  'history-unavailable': 'trace.v4.reason.historyUnavailable',
  'history-read-failed': 'trace.v4.reason.historyReadFailed',
  'format-mismatch': 'trace.v4.reason.formatMismatch',
  'session-mismatch': 'trace.v4.reason.sessionMismatch',
  'cut-unavailable': 'trace.v4.reason.cutUnavailable',
  'event-unavailable': 'trace.v4.reason.eventUnavailable',
  'identity-mismatch': 'trace.v4.reason.identityMismatch',
  'hash-mismatch': 'trace.v4.reason.hashMismatch',
  'range-mismatch': 'trace.v4.reason.rangeMismatch',
  unverified: 'trace.v4.reason.unverified',
})

function referenceReason(code) {
  return referenceReasons[code]
    ? uiMessage(referenceReasons[code])
    : uiMessage('trace.v4.reason.unverified')
}

function bodyStatusNotice(value) {
  const key = value === 'available'
    ? 'trace.v4.status.available'
    : value === 'partially-available'
      ? 'trace.v4.status.partial'
      : value === 'reference-unavailable'
        ? 'trace.v4.status.unavailable'
        : value === 'reference-only'
          ? 'trace.v4.status.referenceOnly'
          : null
  return key === null ? null : uiMessage(key)
}

function sourceSummary(source) {
  return [source.kind, `(${source.relationship ?? 'input'})`, source.resourceId ?? '—', source.field]
    .filter(value => value !== undefined && value !== null && value !== '')
    .join(' / ')
}

function sourceMetadata(source) {
  const values = [unwrapText(uiMessage('trace.v3.sourceCount', { count: source.characters }))]
  if (source.hash) values.push(unwrapText(uiMessage('trace.v4.sourceHash', { hash: source.hash })))
  if (source.resourceRevision) values.push(source.resourceRevision)
  const identity = [
    source.identifier === undefined || source.identifier === null ? null : `identifier=${source.identifier}`,
    source.entryId === undefined || source.entryId === null ? null : `entry=${source.entryId}`,
  ].filter(Boolean).join(' · ')
  if (identity) values.push(unwrapText(uiMessage('trace.v4.sourceIdentity', { value: identity })))
  return rawText(values.join(' · '))
}

function segments(items, kind, legacySnapshot) {
  return (items ?? []).filter(part => !part.sources?.some(isPersonalitySource)).map((part, index) => h('details', { key: `${kind}-${index}`, className: 'dttrace-book' },
    h('summary', null, uiMessage('trace.v3.part', { index: part.index + 1, name: part.name, count: part.characters })),
    h('div', { className: 'dttrace-meta' }, rawText(`SHA-256 ${part.hash} · UTF-16 ${part.offsetUtf16 ?? '—'} · ${part.provenance}`)),
    legacySnapshot && typeof part.text === 'string'
      ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v4.legacySnapshot')) : null,
    typeof part.text === 'string'
      ? h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 } }, rawText(part.text))
      : h('p', { className: 'dttrace-note' }, uiMessage('trace.v4.bodyUnavailable', {
        reason: unwrapText(referenceReason(part.referenceError)),
      })),
    ...(part.sources ?? []).map((source, i) => h('details', { key: i },
      h('summary', null, rawText(sourceSummary(source))),
      h('div', { className: 'dttrace-meta' }, sourceMetadata(source)),
      source.requestedRole !== undefined && source.requestedRole !== null || source.role !== undefined && source.role !== null
        ? h('div', { className: 'dttrace-meta' }, uiMessage('trace.v4.requestedRole', { role: source.requestedRole ?? source.role })) : null,
      source.textStatus === 'not-stored'
        ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v4.sourceNotStored')) : null,
      legacySnapshot && typeof source.text === 'string'
        ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v4.legacySnapshot')) : null,
      typeof source.text === 'string'
        ? h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, rawText(source.text)) : null,
    )),
  ))
}

const nodeLabels = { 'source-unrecorded': 'trace.assembler.sourceUnrecorded',
  'historical-system-update': 'trace.assembler.historicalSystem', 'native-context-framing': 'trace.assembler.contextFraming',
  system: 'trace.assembler.system', user: 'trace.assembler.user', assistant: 'trace.assembler.assistant', tool: 'trace.assembler.tool' }
const sourceStatusLabels = { 'name-unrecorded': 'trace.assembler.nameUnrecorded', 'current-name': 'trace.assembler.nameCurrent',
  'section-only': 'trace.assembler.fieldsUnrecorded', unrecorded: 'trace.assembler.sourceUnrecorded' }
const preStyle = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }
function requestNodeTitle(node, index) {
  if (node.source?.module === 'character' && node.source.field === 'personality')
    return uiMessage('trace.resource.characterPersonality')
  const named = ['recorded', 'current-name'].includes(node.sourceStatus)
  if (!named && nodeLabels[node.name]) return uiMessage(nodeLabels[node.name])
  if (node.sourceStatus === 'name-unrecorded' || !named && /^(preset|worldbook):/.test(node.name ?? '')) {
    return uiMessage('trace.assembler.unnamedItem', { index: index + 1 })
  }
  return rawText(node.name || translate('trace.assembler.sourceUnrecorded'))
}
function publicRequestNodes(nodes) {
  return (nodes ?? []).filter(node => !isPersonalitySource(node.source)).map(node => ({ ...node, children: publicRequestNodes(node.children) }))
}
function requestNodes(nodes) {
  return (nodes ?? []).map((node, index) => h('details', { className: 'dttrace-book', key: `${node.id}:${index}` },
    h('summary', null, requestNodeTitle(node, index),
    rawText(` · ${node.role ?? '—'}`),
    sourceStatusLabels[node.sourceStatus] ? h('span', { className: 'dttrace-note', style: { display: 'block' } }, uiMessage(sourceStatusLabels[node.sourceStatus])) : null),
    h('div', { className: 'dttrace-meta' }, rawText(Object.entries(node.source ?? {}).map(([key, value]) => `${key}=${value}`).join(' · '))),
    typeof node.text === 'string' ? h('pre', { style: preStyle }, rawText(node.text)) : null,
    ...requestNodes(node.children),
  ))
}
function systemModuleCards(nodes) {
  return (nodes ?? []).map((node, index) => node.children?.length
    ? h('div', { className: 'dttrace-system-group', key: `${node.id}:${index}` },
      h('div', { className: 'dttrace-meta' }, requestNodeTitle(node, index)), ...systemModuleCards(node.children))
    : h('details', { className: 'dttrace-book', key: `${node.id}:${index}`, 'data-system-module': node.id },
      h('summary', null, requestNodeTitle(node, index),
        sourceStatusLabels[node.sourceStatus] ? h('span', { className: 'dttrace-note' }, ' · ', uiMessage(sourceStatusLabels[node.sourceStatus])) : null),
      h('div', { className: 'dttrace-meta' }, rawText(Object.entries(node.source ?? {}).map(([key, value]) => `${key}=${value}`).join(' · '))),
      typeof node.text === 'string' ? h('pre', { style: preStyle }, rawText(node.text)) : null))
}
function RecordedRequest({ result: recorded }) {
  const result = recorded ? { ...recorded, nodes: publicRequestNodes(recorded.nodes) } : null
  return h('div', { className: 'dttrace-section', 'data-trace-request': result ? 'available' : 'unavailable' },
    h('p', { className: 'dttrace-note' }, uiMessage(result ? 'trace.assembler.recorded' : 'trace.assembler.unavailable')),
    result ? h('div', { className: 'dttrace-messages' },
      h('div', { className: 'dttrace-section-title' }, uiMessage('trace.assembler.messages', { count: result.messages.length })),
      ...result.messages.map((message, index) => {
        const content = (message.content ?? []).map(block => block.type === 'text' ? block.text : JSON.stringify(block)).join('\n')
        if (message.role === 'system') {
          const modules = recordedSystemModules(result, message, index)
          return h('div', { className: 'dttrace-book dttrace-message', key: index, 'data-role': message.role, 'data-message-index': index },
            h('div', { className: 'dttrace-section-title' }, rawText(`${index + 1} · ${message.role}`)),
            modules.length ? h('div', { className: 'dttrace-system-modules' }, ...systemModuleCards(modules))
              : h('p', { className: 'dttrace-note' }, uiMessage('trace.assembler.modulesUnrecorded')),
            h('details', { className: 'dttrace-disclosure' }, h('summary', null, uiMessage('trace.assembler.systemRaw')),
              h('pre', { style: preStyle }, rawText(content))))
        }
        const sources = recordedMessageNodes(result, message, index)
        return h('details', { className: 'dttrace-book dttrace-message', key: index, 'data-role': message.role, 'data-message-index': index },
          h('summary', null, rawText(`${index + 1} · ${message.role}`),
            sources.length ? h('span', { className: 'dttrace-message-sources' },
              ...sources.map((node, i) => h('span', { key: i }, requestNodeTitle(node, result.nodes.indexOf(node)),
                sourceStatusLabels[node.sourceStatus] ? h('span', { className: 'dttrace-note' }, ' · ', uiMessage(sourceStatusLabels[node.sourceStatus])) : null))) : null),
          h('pre', { style: preStyle }, rawText(content)),
        )
      })) : null,
    result ? h('details', null, h('summary', null, uiMessage('trace.assembler.sources')), ...requestNodes(result.nodes)) : null,
    result?.historyPolicy ? h('details', null, h('summary', null, uiMessage('trace.assembler.historyPolicy')),
      h('pre', { style: preStyle }, rawText(JSON.stringify(result.historyPolicy, null, 2)))) : null,
    result && !result.historyPolicy ? h('p', { className: 'dttrace-note' }, uiMessage('trace.assembler.historyUnrecorded')) : null,
    result?.diagnostics.length ? h('details', null, h('summary', null, uiMessage('trace.assembler.diagnostics')),
      h('pre', { style: preStyle }, rawText(JSON.stringify(result.diagnostics, null, 2)))) : null,
  )
}

// Configuration uses captured fields; provenance labels any current-name fallback.
export function TraceRecordContent({ record, sessionId, turn, latest = false, running = false, lastVisibleSeq }) {
  const audit = record.audit ?? {}
  const resources = audit.resources ?? {}
  const selection = record.selection ?? audit.selection ?? {}
  const books = audit.worldBooks
  const bookResources = resources.worldBooks ?? books?.map(book => book.resource).filter(Boolean)
  const config = audit.assembly?.callConfig
  const mode = audit.assembly?.systemPromptMode
  const referenceBacked = record.schemaVersion >= 4 || record.bodyStorage === 'official-session'
  const legacySnapshot = record.schemaVersion === 3 && record.bodyStorage === undefined
  const contentNotice = referenceBacked
    ? bodyStatusNotice(record.contentStatus)
    : record.contentStatus && record.contentStatus !== 'available'
      ? rawText(record.contentStatus)
      : null
  const unavailable = () => uiMessage('trace.v3.notRecorded')
  const resourceKnown = (key, selectionKey) => Object.hasOwn(resources, key) || Object.hasOwn(selection, selectionKey)
  const result = recordedRequestResult(record)
  const personalityState = recordedPersonalityLoadState(record, result)
  return h('div', { className: 'dttrace-section' },
    h('div', { className: 'dttrace-section-title' }, uiMessage('trace.v3.configuration')),
    h('div', { className: 'dttrace-grid' },
      resourceCard('trace.resource.preset', resources.preset, selection.presetId, resourceKnown('preset', 'presetId')),
      resourceCard('trace.resource.character', resources.characterCard, selection.characterCardId, resourceKnown('characterCard', 'characterCardId')),
      h('div', { className: 'dttrace-card dttrace-personality', 'data-personality-state': personalityState, 'data-state': personalityState },
        h('div', { className: 'dttrace-label' }, uiMessage('trace.resource.personality')),
        h('div', { className: 'dttrace-value' }, uiMessage(`trace.personality.${personalityState}`))),
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
    record.parameters?.fallbacks?.some(item => item.code === 'DSH_MODEL_SELECTION_OWNS_EFFORT')
      ? h('p', { className: 'dttrace-note' }, uiMessage('preset.reasoningEffortNative')) : null,
    record.parameters ? h('details', { className: 'dttrace-disclosure' },
      h('summary', null, uiMessage('trace.parameters.title')),
      h('div', { className: 'dttrace-disclosure-body' },
        ...['requested', 'effective', 'fallbacks'].map(key => h('div', { key },
          h('strong', null, uiMessage(`trace.parameters.${key}`)),
          h('pre', null, rawText(JSON.stringify(record.parameters[key], null, 2))))))) : null,
    contentNotice && record.contentStatus !== 'available'
      ? h('p', { className: 'dttrace-note' }, record.contentStatus === 'available' ? null : uiMessage('trace.v3.contentUnavailable'), ' ', contentNotice,
        referenceBacked && record.referenceError ? rawText(` · ${unwrapText(referenceReason(record.referenceError))}`) : null) : null,
    h('details', { className: 'dttrace-disclosure' },
      h('summary', null, uiMessage('trace.v3.worldBookDetails')),
      h('div', { className: 'dttrace-disclosure-body' },
        h('p', { className: 'dttrace-note' }, uiMessage('trace.worldBook.activationNote')),
        audit.activation ? h('div', { className: 'dttrace-meta' }, audit.activation.pendingMessageCount > 0
          ? uiMessage('trace.activationPending', { included: audit.activation.includedPendingMessageCount,
            pending: audit.activation.pendingMessageCount, truncated: audit.activation.truncated ? translate('trace.truncated') : '' })
          : uiMessage('trace.historyOnly')) : null,
        books === undefined ? h('p', { className: 'dttrace-note' }, unavailable())
          : books.length ? books.map((book, index) => h(WorldBookAudit, { book, record, key: index }))
            : h('p', { className: 'dttrace-note' }, uiMessage('trace.noSource')),
      ),
    ),
    sessionId && Number.isSafeInteger(turn) ? h(MvuRoundSection, { sessionId, turn, latest, running, lastVisibleSeq }) : null,
    h('details', { className: 'dttrace-disclosure' },
      h('summary', null, uiMessage('trace.v3.loaderDetails')),
      h('div', { className: 'dttrace-disclosure-body' },
        h(RecordedRequest, { result }),
        h('details', { className: 'dttrace-book' },
          h('summary', null, uiMessage('trace.assembler.materials')),
          h('p', { className: 'dttrace-note' }, uiMessage('trace.assembler.materialsNote')),
          record.contentStatus === 'available' && contentNotice ? h('p', { className: 'dttrace-note' }, contentNotice) : null,
          referenceBacked ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v4.metadataRetention')) : null,
          h('p', { className: 'dttrace-note' }, uiMessage(record.delivery?.assemblyVerified ? 'trace.v3.verified' : 'trace.v3.unverified')),
          record.sections ? h('div', { className: 'dttrace-section-title' }, uiMessage('trace.v3.sections')) : null,
          ...segments(record.sections, 'system', legacySnapshot),
          record.contexts ? h('div', { className: 'dttrace-section-title' }, uiMessage('trace.v3.contexts')) : null,
          ...segments(record.contexts, 'context', legacySnapshot),
          !record.sections ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v3.noAssembly')) : null,
          record.systemMessages ? h('details', null,
            h('summary', null, uiMessage('trace.v3.actual')),
            legacySnapshot ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v4.legacySnapshot')) : null,
            ...record.systemMessages.map((text, i) => h('pre', { key: i, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, rawText(text))),
          ) : null,
          referenceBacked && !Array.isArray(record.systemMessages)
            ? h('p', { className: 'dttrace-note' }, uiMessage('trace.v4.systemMessagesUnavailable')) : null,
        ),
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

function AssemblyRecord({ summary, sessionId, latest, running, lastVisibleSeq }) {
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
      h('span', { className: 'dttrace-badge', title: summary.status, 'data-ok': summary.status === 'request-observed' }, statusLabels[summary.status] ? uiMessage(statusLabels[summary.status]) : rawText(summary.status)),

      h('span', { className: 'dttrace-time' }, rawText(formatTime(summary.recordedAt))),
    ),
    h('div', { className: 'dttrace-content' },
      error ? h('p', { className: 'dttrace-status', 'data-error': true }, rawText(error)) : null,
      record ? h(TraceRecordContent, { record, sessionId, turn: summary.turn, latest, running, lastVisibleSeq }) : h('div', { className: 'dttrace-loading', role: 'status' }, uiMessage('trace.reading')),
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
        h('details', { className: 'dttrace-help' },
          h('summary', null, uiMessage('trace.v3.terms')),
          h('p', null, uiMessage('trace.v3.intro')),
          h('p', null, uiMessage('trace.v3.termsText')),
          data !== null ? h('p', null, storageStatus(data.storage)) : null),
        error ? h('div', { className: 'dttrace-status', 'data-error': true, role: 'alert' }, rawText(error)) : null,
        data === null && !error ? h('div', { className: 'dttrace-loading', role: 'status' }, uiMessage('trace.reading')) : null,
        records.length === 0 && data !== null ? h('div', { className: 'dttrace-status' }, uiMessage('trace.empty')) : null,
        ...records.map((record, index) => h(AssemblyRecord, { summary: record, sessionId, latest: index === 0, running, lastVisibleSeq, key: `${sessionId}:${record.id}` })),
      ),
    ),
  )
}

export function installTavernTraceStyles() {
  installTavernStyle(`${PLUGIN_ID}-trace`, css)
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
