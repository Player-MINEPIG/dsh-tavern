import { isSafeCatalogSegment } from '../../play/src/timeline.js'
import { repairPlaythroughs } from './playthrough-repair.js'

export const REPAIR_TOOL = 'tavern_repair_playthroughs'
const hint = '[preview] [v3-v4 <周目ID>]'
const usage = '/tavern-repair ' + hint
const reasons = {
  'unknown-coordinate-origin': '坐标缺少版本。确认该周目的坐标仅来自 V3/V4 后，可执行 /tavern-repair v3-v4 <周目ID>',
  'possible-v3-offset': '事件编号可能已移动，需核对原问答或旧日志',
  'unverified-message-range': '日志无法核实提问和回复的位置',
  'import-coordinates': '导入上下文引用需要离线迁移',
  'earlier-format': '发现早于 V3 的历史证据，需用原日志迁移',
  'missing-session-log': '会话事件不完整，无法核对坐标',
  'session-unavailable': 'Host 未能提供完整会话',
  'repair-unavailable': '读取或校验周目失败，请检查时间线文件及 Host 状态',
  PLAY_HOST_UNAVAILABLE: 'Host 会话服务暂时不可用',
  'shared-timeline': '多个周目共用时间线，需确认归属',
  'pending-draft': '草稿尚未完成',
  'turn-in-progress': '回复正在生成，完成后可重试',
  'backup-conflict': '已有同名备份但内容不同，请核对备份后重试',
  'character-unavailable': '角色卡读取失败，请检查资源库',
  'unverified-turn': '待同步的消息缺少完整结束证据，请核对原会话',
  'session-changed': '检查期间会话有更新，请重试',
  archived: '周目已归档',
  CHARACTER_NOT_FOUND: '角色卡缺失，需选择要重新关联的角色',
  PLAY_PATH_NOT_FOUND: '时间线文件缺失，需恢复备份',
  PLAY_SESSION_NOT_FOUND: '原生会话缺失，请核对 DSH 数据目录或备份',
  PLAY_COORDINATES_MIGRATION_REQUIRED: '引用版本不匹配，需使用旧日志迁移',
  PLAY_COORDINATES_UNAVAILABLE: 'Host 未提供会话格式，请稍后重试',
  PLAY_TIMELINE_INVALID: '时间线格式损坏，需核对备份',
  PLAY_FILE_REVISION_CONFLICT: '检查期间文件已更新，请重试',
}

function formatReport(result) {
  const changed = result.items.filter(item => item.changes.length).length
  const lines = [`已检查 ${result.checked} 个周目，${result.applied ? '已修复' : '可修复'} ${changed} 个。`]
  for (const item of result.items) {
    const details = []
    const stamps = item.changes.filter(change => change.kind === 'format-marker').length
    if (stamps) details.push(`补齐 ${stamps} 个版本标记`)
    const turns = item.changes.find(change => change.kind === 'reconcile-turns')
    if (turns?.added) details.push(`补回 ${turns.added} 个问答楼层`)
    if (turns?.extended) details.push('将续写接回原楼层')
    if (turns?.removed) details.push('移除误记为回复的取消楼层')
    for (const problem of item.remaining) {
      const target = [problem.sessionId, problem.nodeId, problem.variantId, problem.characterId].filter(Boolean).join(' / ')
      const explanation = reasons[problem.reason] ?? problem.reason
      details.push(target ? target + ' · ' + explanation : explanation)
    }
    if (item.backup) details.push(`备份 ${item.backup}`)
    lines.push(`${item.id} · ${details.join('；')}`)
  }
  return lines.join('\n')
}

export function installRepairCommand(ctx, dependencies, { enableTool, blocksWrites }) {
  if (typeof ctx.inject !== 'function') return
  ctx.inject(['commands'], scope => {
    scope.commands.register({
      name: 'tavern-repair',
      description: '检查绑定的 RP 工作区，备份并修复可核实的周目记录',
      input: { hint },
      async handler({ agent, rawInput, signal }) {
        const args = String(rawInput ?? '').trim().split(/\s+/).filter(Boolean)
        const preview = args[0] === 'preview'
        if (preview) args.shift()
        const v3v4 = args.length === 2 && args[0] === 'v3-v4' && isSafeCatalogSegment(args[1])
        if (args.length && !v3v4) return { kind: 'error', text: usage }
        const report = await repairPlaythroughs(dependencies, { agent, signal, apply: !preview, v3v4, id: args[1] })
        return { kind: 'success', text: formatReport(report) }
      },
    })
  })
  if (!enableTool) return
  ctx.inject(['tools'], scope => {
    scope.tools.register({
      name: REPAIR_TOOL,
      description: 'Check Tavern playthrough metadata in the bound RP workspace. Preview by default. Apply on user request. Report unresolved references and backup paths. Set knownV3V4 only with a playthrough ID and explicit user confirmation that its coordinates come exclusively from V3/V4.',
      parameters: { type: 'object', additionalProperties: false, properties: {
        action: { type: 'string', enum: ['preview', 'apply'] },
        id: { type: 'string', description: 'Exact playthrough ID. Omit to scan the catalog.' },
        knownV3V4: { type: 'boolean' },
      } },
      output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute(args, { agent, signal }) {
        if (!args || typeof args !== 'object' || Array.isArray(args)
          || Object.keys(args).some(key => !['action', 'id', 'knownV3V4'].includes(key))
          || (args.id !== undefined && !isSafeCatalogSegment(args.id))
          || (args.knownV3V4 !== undefined && typeof args.knownV3V4 !== 'boolean')
          || (args.knownV3V4 && !args.id)
          || (args.action !== undefined && !['preview', 'apply'].includes(args.action))) throw new TypeError('Invalid repair arguments')
        if (args.action === 'apply' && blocksWrites(agent)) throw new Error('Agent writes are restricted. Use /tavern-repair in the chat.')
        return repairPlaythroughs(dependencies, { agent, signal, apply: args.action === 'apply', id: args.id, v3v4: args.knownV3V4 })
      },
    })
  })
}
