import {
  createElement as h,
  useCallback,
  useEffect,
  useState,
} from 'react'

const TRACE_API = '/dsh-tavern/api/traces'

const css = `
.dttrace-root{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dttrace-toolbar{min-height:48px;box-sizing:border-box;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;gap:10px;flex:none}.dttrace-title{font-size:16px;font-weight:680;flex:1}.dttrace-button{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:inherit;padding:7px 10px;font-size:13px;cursor:pointer}.dttrace-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dttrace-body{min-height:0;overflow:auto;padding:12px max(14px,calc((100% - 880px)/2));display:flex;flex-direction:column;gap:10px}.dttrace-note,.dttrace-status{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dttrace-status{padding:9px 10px;border-radius:8px;background:var(--dsw-specific-tip)}.dttrace-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dttrace-record{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);overflow:hidden}.dttrace-record>summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;align-items:center;gap:8px}.dttrace-record>summary::-webkit-details-marker{display:none}.dttrace-round{font-size:14px;font-weight:670}.dttrace-time{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-left:auto}.dttrace-badge{border-radius:999px;padding:2px 7px;font-size:11px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}.dttrace-badge[data-ok=true]{background:color-mix(in srgb,var(--dsw-alias-state-success,#2fa36b) 18%,transparent);color:var(--dsw-alias-state-success,#2fa36b)}
.dttrace-content{border-top:1px solid var(--dsw-alias-border-l1);padding:11px 12px;display:flex;flex-direction:column;gap:10px}.dttrace-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dttrace-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;min-width:0}.dttrace-label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}.dttrace-value{font-size:13px;font-weight:620;margin-top:3px;overflow-wrap:anywhere}.dttrace-meta{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-tertiary);margin-top:3px;overflow-wrap:anywhere}
.dttrace-section{display:flex;flex-direction:column;gap:6px}.dttrace-section-title{font-size:14px;font-weight:670}.dttrace-book{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dttrace-decision{display:grid;grid-template-columns:76px minmax(110px,.7fr) minmax(160px,1.5fr);gap:7px;padding:6px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.45}.dttrace-decision:first-of-type{border-top:0}.dttrace-decision-state{font-weight:650}.dttrace-decision[data-included=true] .dttrace-decision-state{color:var(--dsw-alias-state-success,#2fa36b)}.dttrace-keywords{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.dttrace-list{margin:0;padding-left:18px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
@media(max-width:760px){.dttrace-grid{grid-template-columns:1fr}.dttrace-decision{grid-template-columns:70px 1fr}.dttrace-keywords{grid-column:1/-1}}
`

const reasonLabels = Object.freeze({
  constant: '常驻条目',
  'primary-key-match': '主关键词命中',
  'primary-key-miss': '主关键词未命中',
  'secondary-and_any-match': '附加关键词任一命中',
  'secondary-and_any-miss': '附加关键词均未命中',
  'secondary-and_all-match': '附加关键词全部命中',
  'secondary-and_all-miss': '附加关键词未全部命中',
  'secondary-not_any-match': '附加关键词排除条件通过',
  'secondary-not_any-miss': '附加关键词触发排除',
  'secondary-not_all-match': '附加关键词非全中条件通过',
  'secondary-not_all-miss': '附加关键词全中而排除',
  disabled: '条目已禁用',
  'external-vector-match-required': '需要外部向量匹配',
  'inclusion-group-loser': '互斥组未胜出',
  'probability-failed': '概率检查拒绝',
  'budget-exceeded': '超出 token 预算',
  'empty-content': '正文为空，未插入',
  'outlet-unsupported': 'Outlet 无稳定插入 seam',
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
  const parts = [`总计最多 ${formatBytes(storage.maxTotalBytes)}`]
  if (Number.isSafeInteger(storage.maxRecordsPerSession)) parts.push(`每会话最多 ${storage.maxRecordsPerSession} 条`)
  if (Number.isSafeInteger(storage.maxSessions)) parts.push(`最多 ${storage.maxSessions} 个会话`)
  if (Number.isSafeInteger(storage.maxRecordBytes)) parts.push(`单条最多 ${formatBytes(storage.maxRecordBytes)}`)
  return `插件有界存储：${parts.join('、')}；刷新或宿主重启后可恢复。`
}

function resourceCard(label, value) {
  return h('div', { className: 'dttrace-card', key: label },
    h('div', { className: 'dttrace-label' }, label),
    h('div', { className: 'dttrace-value' }, value?.name || '未使用'),
    value?.id ? h('div', { className: 'dttrace-meta' }, value.id) : null,
  )
}

function userInjectionText(value) {
  if (value?.selected !== true) return '未选择用户资源，因此没有用户描述插入。'
  if (value.descriptionAvailable !== true) return '已选择用户资源；描述为空，因此没有描述正文需要插入。用户名称仍写入 Tavern profile 头，并参与 {{user}} 宏替换。'
  const placement = String(value.descriptionPlacement ?? 'none')
  const label = placement === 'fallback'
    ? '预设没有启用用户描述位置，使用稳定回退位置'
    : placement.startsWith('preset-marker:')
      ? `预设标记 ${placement.slice('preset-marker:'.length)}`
      : placement.startsWith('preset-macro:')
        ? `预设 prompt ${placement.slice('preset-macro:'.length)} 内的 {{persona}} 宏`
        : '未找到插入位置'
  return `用户描述：${value.descriptionCharacters} 个源字符，插入 ${value.descriptionInsertions} 次；位置：${label}。{{user}} 只替换名称，不会再次插入用户描述。`
}

function keywords(decision) {
  const primary = decision.primaryMatches ?? []
  const secondary = decision.secondaryMatches ?? []
  const parts = []
  if (primary.length > 0) parts.push(`主：${primary.join('、')}`)
  if (secondary.length > 0) parts.push(`附加：${secondary.join('、')}`)
  return parts.length === 0 ? '无命中关键词' : parts.join(' · ')
}

function decisionMeta(value) {
  const parts = []
  if (value.secondaryLogic) parts.push(`secondary=${value.secondaryLogic}`)
  if (value.groupName) parts.push(`组 ${value.groupName}${value.groupOverride ? ' / override' : value.groupWeight === null ? '' : ` / weight ${value.groupWeight}`}`)
  if (value.probability !== null) {
    parts.push(`概率 ${value.probability}%${value.probabilityRoll === null ? '' : ` / roll ${(value.probabilityRoll * 100).toFixed(2)}%`}`)
  }
  if (value.tokenCost !== null) parts.push(`预算 ${value.tokenCost} tokens`)
  if (value.requestedPosition) {
    parts.push(`位置 ${value.requestedPosition}${value.appliedPosition ? ` → ${value.appliedPosition}${value.approximatePosition ? '（近似）' : ''}` : ' → 未插入'}`)
  }
  return parts.join(' · ')
}

function WorldBookAudit({ book }) {
  const name = book.resource?.name || book.resource?.id || '世界书'
  return h('div', { className: 'dttrace-book' },
    h('div', { className: 'dttrace-section-title' }, name),
    h('div', { className: 'dttrace-meta' }, `预算：${book.budget.used}${book.budget.limit === null ? '' : ` / ${book.budget.limit}`} tokens · ${book.decisions.length} 条决策`),
    ...book.decisions.map((item, index) => h('div', {
      className: 'dttrace-decision',
      'data-included': item.decision === 'included',
      key: `${item.entryId ?? 'entry'}-${index}`,
    },
    h('div', { className: 'dttrace-decision-state' }, item.decision === 'included' ? '已插入' : '已拒绝'),
    h('div', null,
      h('div', null, item.entryName || `条目 ${String(item.entryId ?? index + 1)}`),
      h('div', { className: 'dttrace-meta' }, reasonLabels[item.reason] ?? item.reason),
    ),
    h('div', { className: 'dttrace-keywords' },
      h('div', null, keywords(item)),
      h('div', { className: 'dttrace-meta' }, decisionMeta(item)),
    ))),
  )
}

function TraceRecord({ record, latest }) {
  const authority = record.authority ?? {}
  const linked = authority.headerEventSeq !== null
  return h('details', { className: 'dttrace-record', open: latest },
    h('summary', null,
      h('span', { className: 'dttrace-round' }, `轮次 ${record.turn} · 步骤 ${record.step}${record.attempt > 1 ? ` · 尝试 ${record.attempt}` : ''}`),
      h('span', { className: 'dttrace-badge', 'data-ok': linked || undefined }, linked ? `request/header #${authority.headerEventSeq}` : '等待权威 header'),
      h('span', { className: 'dttrace-time' }, formatTime(record.recordedAt)),
    ),
    h('div', { className: 'dttrace-content' },
      h('div', { className: 'dttrace-status' }, linked
        ? `该记录已对齐 DSH request/header #${authority.headerEventSeq}${authority.headerReused ? '（沿用上一份 header）' : ''}。Tavern profile 校验：${authority.tavernProfilePresent === false ? '未找到' : authority.tavernProfilePresent === true ? '一致' : '本轮无 profile'}；采样字段：${authority.tavernCallConfigApplied === false ? '不一致' : '一致或无字段'}。`
        : '尚未观察到可对齐的 DSH request/header；这不代表请求已经发送。刷新后仍会保留该待确认记录。'),
      h('div', { className: 'dttrace-grid' },
        resourceCard('Preset', record.resources?.preset),
        resourceCard('Character', record.resources?.characterCard),
        resourceCard('User', record.resources?.userProfile),
      ),
      h('div', { className: 'dttrace-section' },
        h('div', { className: 'dttrace-section-title' }, '组合与插入'),
        h('div', { className: 'dttrace-meta' }, `${record.assembly.profileSection} · order ${record.assembly.profileOrder} · ${record.assembly.systemPromptMode} · ${record.assembly.systemCharacters} characters · call config: ${Object.keys(record.assembly.callConfig ?? {}).join(', ') || '无'}`),
        h('div', { className: 'dttrace-meta' }, userInjectionText(record.assembly.userInjection)),
      ),
      record.worldBooks?.length > 0 ? h('div', { className: 'dttrace-section' },
        h('div', { className: 'dttrace-section-title' }, '世界书匹配决策'),
        ...record.worldBooks.map((book, index) => h(WorldBookAudit, { book, key: `${book.resource?.id ?? 'book'}-${index}` })),
      ) : h('div', { className: 'dttrace-note' }, '本轮没有可审计的世界书匹配来源。'),
      record.diagnostics?.length > 0 ? h('div', { className: 'dttrace-section' },
        h('div', { className: 'dttrace-section-title' }, `诊断（${record.diagnostics.length}）`),
        h('ul', { className: 'dttrace-list' }, ...record.diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, `${item.code}: ${item.message}`))),
      ) : null,
      h('p', { className: 'dttrace-note' }, '隐私边界：这里只保存资源摘要、命中关键词、决策原因、位置、预算和 SHA-256 摘要；不保存 preset/角色/user/世界书正文、完整 system、聊天历史、header 内容或 tool payload。'),
    ),
  )
}

export function TavernTraceView({ sessionId, useSession }) {
  const lastVisibleSeq = useSession(snapshot => snapshot.nodes.at(-1)?.seq ?? -1)
  const running = useSession(snapshot => snapshot.running)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

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

  const records = [...(data?.records ?? [])].reverse()
  return h('div', { className: 'dttrace-root' },
    h('div', { className: 'dttrace-toolbar' },
      h('div', { className: 'dttrace-title' }, 'Tavern Trace'),
      h('button', { className: 'dttrace-button', type: 'button', onClick: refresh }, '刷新'),
    ),
    h('div', { className: 'dttrace-body' },
      h('p', { className: 'dttrace-note' }, '与 Conversation / Trajectory 并列的 loader 审计视图。DSH request/header 始终是最终发送 system、tools 与生效 config 的权威。'),
      error ? h('div', { className: 'dttrace-status', 'data-error': true }, error) : null,
      data === null && !error ? h('div', { className: 'dttrace-status' }, '正在读取审计记录…') : null,
      data !== null ? h('div', { className: 'dttrace-status' }, storageStatus(data.storage)) : null,
      records.length === 0 && data !== null ? h('div', { className: 'dttrace-status' }, '此会话还没有 Tavern 请求审计记录。发送下一条消息后再查看。') : null,
      ...records.map((record, index) => h(TraceRecord, { record, latest: index === 0, key: record.id })),
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
    label: 'Tavern Trace',
    inject: () => ({}),
  }, TavernTraceView))
}
