import { createHash } from 'node:crypto'
import { personalityFieldName } from '../../personality/src/field-name.js'
import { PERSONALITY_SOURCE_ID } from '../../identity.js'
import { includePersonalitySections } from './profile-loader.js'
import { renderOfficialSections } from 'dsh-prompt-assembler/native-backend'

// The independent Assembler reads position descriptors without loading a card.
export function registerPersonalitySource(registry, cards) {
  return registry.register({
    id: PERSONALITY_SOURCE_ID, pluginId: 'pmp-dsh-tavern', name: '人格卡 / Personality card',
    roles: ['preserve', 'system'], lifetimes: ['request'], depth: false, stability: 'conversation',
    positions: [
      { id: 'card', name: ['人格卡面', 'Personality card'] },
      { id: 'evolution', name: ['自我修订', 'Self-revisions'] },
      { id: 'mood', name: ['当前心情', 'Current mood'] },
    ],
    contentGuide: {
      contains: ['卡面、已生效的自我修订和当前心情。', 'Card fields, effective self-revisions and current mood.'],
      origin: ['当前会话绑定的人格。', 'The personality bound to this session.'],
      editable: ['可以调整三个资源位置。', 'The three resource positions can be configured.'],
      editAt: ['DT → 人格卡。', 'DT → Personality cards.'],
    },
    moduleAvailable: ({ sessionId }) => Boolean(sessionId && cards.binding(sessionId)?.characterCardId),
    resolve: ({ assets }) => ({ blocks: (assets.personalitySections ?? []).map(({ text, sources }) => {
      const { field, resourceId } = sources[0]
      const positionId = field === 'mood' ? 'mood' : field.startsWith('evolution/') ? 'evolution' : 'card'
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
