import { createHash } from 'node:crypto'
import { personalityFieldName } from '../../personality/src/field-name.js'
import { PERSONALITY_SOURCE_ID } from '../../identity.js'
import { includePersonalitySections } from './profile-loader.js'
import { renderOfficialSections } from 'dsh-prompt-assembler/native-backend'

const cardPositions = [
  ['name', '名称', 'Name'],
  ['system_prompt', '行为指引', 'Behavior guidance'],
  ['description', '描述', 'Description'],
  ['personality', '性格', 'Traits'],
  ['scenario', '情境', 'Scenario'],
  ['mes_example', '对话示例', 'Dialogue examples'],
  ['first_mes', '开场参考', 'Opening reference'],
  ['post_history_instructions', '补充指引', 'Additional guidance'],
].map(([id, zh, en]) => ({ id, name: [`人格卡 · ${zh}`, `Personality · ${en}`],
  note: ['关闭仅排除本字段。未单独拖动或用作锚点时，继承整张卡面的自定义位置；整张卡面关闭时本字段也被排除。',
    'Turning this off excludes this field. Unless moved separately or used as an anchor, it inherits a custom whole-card position. Turning the whole card off also excludes this field.'] }))

function cardPosition(field, preset) {
  const positionId = field.startsWith('alternate_greetings/') ? 'first_mes' : field
  const positions = preset.layout?.positions ?? []
  const card = positions.find(row => row.sourceId === PERSONALITY_SOURCE_ID && row.positionId === 'card')
  // The legacy row remains a master switch. Assembler serializes every row
  // when any position changes, so an ordinary enabled/source row is not a move.
  if (card?.enabled === false) return 'card'
  const own = positions.find(row => row.sourceId === PERSONALITY_SOURCE_ID && row.positionId === positionId)
  const isAnchor = id => positions.some(row => row.enabled && row.placement === 'list' && row.anchor?.sourceId === PERSONALITY_SOURCE_ID && row.anchor.positionId === id)
  if (own?.enabled === false || own?.placement === 'list' || isAnchor(positionId)) return positionId
  return card?.placement === 'list' || isAnchor('card') ? 'card' : positionId
}

// The independent Assembler reads position descriptors without loading a card.
export function registerPersonalitySource(registry, cards) {
  return registry.register({
    id: PERSONALITY_SOURCE_ID, pluginId: 'pmp-dsh-tavern', name: '人格卡 / Personality card',
    roles: ['preserve', 'system'], lifetimes: ['request'], depth: false, stability: 'conversation',
    positions: [
      { id: 'card', name: ['整张卡面（兼容）', 'Whole card (compatibility)'],
        note: ['启用卡面字段也须启用此总开关；拖动设置未单独拖动或用作锚点字段的共同位置。自我修订和心情独立。',
          'Enable this master switch as well as the desired card fields. Moving it sets the shared position of fields that have not been moved separately or used as anchors. Self-revisions and mood remain independent.'] },
      ...cardPositions,
      { id: 'evolution', name: ['自我修订', 'Self-revisions'] },
      { id: 'mood', name: ['当前心情', 'Current mood'] },
    ],
    contentGuide: {
      contains: ['卡面、已生效的自我修订和当前心情。', 'Card fields, effective self-revisions and current mood.'],
      origin: ['当前会话绑定的人格。', 'The personality bound to this session.'],
      editable: ['按卡面字段调整位置、启停；整张卡面保留兼容总开关与共同位置。自我修订和心情独立配置。', 'Configure placement and inclusion per card field. The whole-card position retains a compatibility master switch and shared placement. Configure self-revisions and mood independently.'],
      editAt: ['DT → 人格卡。', 'DT → Personality cards.'],
    },
    moduleAvailable: ({ sessionId }) => Boolean(sessionId && cards.binding(sessionId)?.characterCardId),
    resolve: ({ assets, preset }) => ({ blocks: (assets.personalitySections ?? []).map(({ text, sources }) => {
      const { field, resourceId } = sources[0]
      const positionId = field === 'mood' ? 'mood' : field.startsWith('evolution/') ? 'evolution' : cardPosition(field, preset)
      // The card already applied its own macro scope. Assembler scans block.text
      // for cross-source references before renderText, even for literal state.
      return { type: 'text', id: field, name: personalityFieldName(field), positionId, role: 'system', text: field,
        renderedText: text, source: { field, resourceId } }
    }) }),
    renderText: ({ block }) => block.renderedText,
  })
}

export function hasPersonalityRule(preset) {
  return preset?.rules.some(rule => rule.kind === PERSONALITY_SOURCE_ID) === true
}

export function withPersonalityRule(preset) {
  const rules = [...preset.rules]
  rules.splice(rules.findIndex(rule => rule.kind === 'character') + 1, 0,
    { id: 'personality-card', kind: PERSONALITY_SOURCE_ID, enabled: true, role: 'system' })
  return { ...preset, rules }
}

// The raw DSH preview does not receive the candidate policy. It includes the
// legacy official sections so an old candidate can reproduce an old request.
// The public post-assembly callback now has the actual candidate's rules.
export function reconcilePersonalityPreview(result, context) {
  const personalityRules = context.preset.rules.filter(rule => rule.kind === PERSONALITY_SOURCE_ID)
  if (!context.preview && personalityRules.length && personalityRules.every(rule => !rule.enabled)) {
    result.diagnostics.push({ code: 'TAVERN_PERSONALITY_POLICY_DISABLED', sourceId: PERSONALITY_SOURCE_ID })
  }
  if (!context.preview) return
  if (!hasPersonalityRule(context.preset)) {
    const sections = context.assets.personalitySections ?? []
    if (result.nodes.some(node => node.source?.module === 'native-system') && sections.length) {
      includePersonalitySections('', sections, context.assets.maxProfileBytes)
    }
    return
  }
  const names = new Map((context.assets.personalitySections ?? []).map(section => [section.name, section.text]))
  const original = context.assets.officialSections ?? []
  const keep = original.filter(section => !names.has(section.name) || names.get(section.name) !== section.text)
  if (keep.length === original.length) return
  const text = renderOfficialSections({ sections: keep, variables: context.assets.nativeVariables })
  const native = result.nodes.find(node => node.source?.module === 'native-system')
  if (!native) return
  const messageId = native.requestMessageIds[0]
  const messageIndex = result.messages.findIndex(message => message.id === messageId)
  const layout = result.resourceLayout
  if (!text) {
    result.messages.splice(messageIndex, 1)
    result.nodes = result.nodes.filter(node => node !== native)
    for (const node of result.nodes) if (node.start > messageIndex) node.start--
    layout.blocks = layout.blocks.filter(block => !block.nodeIds.includes(native.id))
    layout.positionDecisions = layout.positionDecisions.filter(row => row.nodeId !== native.id)
    return
  }
  const message = { ...result.messages[messageIndex], content: [{ type: 'text', text }] }
  result.messages[messageIndex] = message
  native.text = text
  native.children = native.children.filter(child => names.get(child.name) !== child.text || !names.has(child.name))
  native.hash = createHash('sha256').update(JSON.stringify([message])).digest('hex')
  for (const block of layout.blocks) for (const item of block.entries) {
    if (item.id === native.id) Object.assign(item, { text, children: native.children })
  }
}
