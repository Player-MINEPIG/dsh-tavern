import {boundGreetingView} from './bound-greeting.js'
import {initialCardScope,greetingCardScope,writeGrantScope} from './mvu-scope.js'
import { createMvuCardBinding } from './mvu-bridge.js'
import { createElement as h, createContext, useContext, useState, useEffect, useMemo } from 'react'
import { API_V1 } from '../../../identity.js'
import { avatarFor, editAvatar } from '../../../presentation/avatar.js'
import { AvatarInput } from '../avatar-input.js'
import { translate } from '../i18n.js'
import { updateTimeline } from './mutations.js'
import { useConversationDisplaySettings } from './display-settings.js'
import { MessageContent } from './scripted-content.js'
import { MessageRow, messageAvatarStyle, messageBubbleStyle } from './message-layout.js'
import {CardDiagnosticBoundary} from './card-diagnostics.js'

const Presentation = createContext(null)
export function ConversationPresentation({ state, playthrough, playClient, sessionId, disabled, busy, changed, composer, children }) {
  return h(Presentation.Provider, { value: { state, playthrough, playClient, sessionId, disabled, busy, changed, composer } }, children)
}
export function messageAvatarKey(turn, role, index = 0) {
  return role === 'user' ? `${turn.id}:user` : `${turn.id}:${turn.variant?.id ?? 'live'}:assistant:${index}`
}
export function MessageBubble({ text, role = 'assistant', messageKey, editable = true, streaming = false, variableScope, initialBinding = false, greetingBinding = false }) {
  const context = useContext(Presentation)
  const settings = useConversationDisplaySettings()
  const coordinate = {playthrough:context?.playthrough,sessionId:context?.sessionId,characterId:context?.state?.display?.bindings?.characterId,timeline:context?.state?.timeline,turns:context?.state?.turns,greetingIndex:context?.state?.greeting?.index}
  const messageScope = variableScope && context?.playthrough?.id ? {...variableScope,playthroughId:context.playthrough.id} : null
  const boundScope = messageScope ?? ((greetingBinding||initialBinding)&&!context?.disabled ? greetingCardScope(coordinate) : null)
  const writeScope = messageScope ?? (initialBinding&&!context?.disabled&&!context?.busy ? initialCardScope(coordinate) : null)
  const [editing, setEditing] = useState(false)
  const [avatar, setAvatar] = useState(null)
  const [failedImage, setFailedImage] = useState(null)
  const [scope, setScope] = useState('message')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setEditing(false); setError('') }, [context?.playthrough?.id, messageKey])
  const appearance = context?.state?.timeline?.ext?.pmpDshTavern?.appearance
  const defaults = context?.state?.avatars ?? {}
  let image = null
  try { image = avatarFor(appearance, role, messageKey, defaults) } catch { /* corrupted display metadata cannot execute */ }
  const disabled = !context || context.disabled || !editable
  async function save(action = scope) {
    setBusy(true); setError('')
    try {
      await updateTimeline(context.playClient, context.playthrough, timeline => editAvatar(timeline, { role, key: messageKey, scope: action, avatar }))
      context.changed?.(); setEditing(false)
    } catch (reason) { setError(reason.message) } finally { setBusy(false) }
  }
  const name = context?.state?.display?.macros?.[role === 'user' ? 'user' : 'character'] ?? (role === 'user' ? 'User' : 'Assistant')
  const textBubbleStyle=useMemo(()=>messageBubbleStyle(settings.bubbleStyle,role),[settings.bubbleStyle,role])
  return h(MessageRow, { role, className: `dtv-message dtv-message-${role}`,
    avatar: h('button', { className: 'dtv-message-avatar', type: 'button', disabled, title: translate('appearance.editAvatar'), 'aria-label': `${translate('appearance.editAvatar')} · ${name}`, style: { ...messageAvatarStyle, cursor: disabled ? 'default' : 'pointer' }, onClick: () => { setAvatar(image?.startsWith('data:') ? image : null); setEditing(true) } },
      image && failedImage !== image ? h('img', { src: image, alt: name, width: 42, height: 42, style: { objectFit: 'cover' }, onError: () => setFailedImage(image) }) : name.slice(0, 1)),
    },
    h(CardDiagnosticBoundary,null,h('div', { className: `dtv-play-chat-bubble dtv-play-chat-${role}`, style: textBubbleStyle },
      h('div', { style: { textAlign: role === 'user' ? 'right' : 'left', font: '600 11px system-ui', opacity: 0.65, marginBottom: 6 } }, name),
      h(MessageContent, { text, writeScope, composer: disabled || context?.busy ? null : context?.composer, createBinding: boundScope ? (signal,writeGrant) => createMvuCardBinding({client:context.playClient,scope:writeGrant?writeGrantScope(writeScope,writeGrant):boundScope,signal,writeGrant}) : undefined, owners: [context?.state?.display?.globalRenderingOwner,...Object.entries(context?.state?.display?.bindings??{}).filter(([,id])=>typeof id==='string'&&id).map(([kind,id])=>`${kind==='characterId'?'character':'preset'}:${id}`)].filter(Boolean), helpers: (context?.state?.display?.renderingSources ?? []).filter(item=>item.kind==='helper'), enabled: settings.interactiveCards !== false && !context?.disabled && !streaming, scopeKey: JSON.stringify([context?.playthrough?.id,context?.sessionId,messageKey,boundScope,writeScope]), context: { version: 1, role, userName: context?.state?.display?.macros?.user ?? 'User', characterName: context?.state?.display?.macros?.character ?? 'Assistant', boundGreeting: greetingBinding ? boundGreetingView({state:context?.state,scope:boundScope,disabled:context?.disabled}) : null }, onSend: disabled || context?.busy ? undefined : async (text,options) => { await context.playClient.postUserMessage(context.sessionId, text,options); context.changed?.() } }),
    )),
    editing ? h('dialog', { className: 'dtv-avatar-dialog', ref: element => { if (element && !element.open) element.showModal() }, onCancel: event => { event.preventDefault(); if (!busy) setEditing(false) }, role: 'dialog', 'aria-modal': true, 'aria-label': translate('appearance.editAvatar'), style: { position: 'fixed', inset: 0, width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none', margin: 0, border: 0, boxSizing: 'border-box', zIndex: 2147483500, background: '#0008', display: 'grid', placeItems: 'center' }, onKeyDown: event => { if (event.key === 'Escape' && !busy) setEditing(false) } },
      h('div', { style: { width: 'min(420px,90vw)', maxHeight: '85vh', overflow: 'auto', padding: 22, borderRadius: 16, background: 'var(--dsw-alias-bg-base,#fff)', color: 'var(--dsw-alias-label-primary,#222)', display: 'grid', gap: 12 } },
        h('h3', null, translate('appearance.editAvatar')),
        h('p', null, translate('appearance.avatarScopeHint')),
        h(AvatarInput, { value: avatar, onChange: setAvatar, disabled: busy }),
        h('select', { 'aria-label': translate('appearance.scope'), value: scope, disabled: busy, onChange: event => setScope(event.target.value) }, h('option', { value: 'message' }, translate('appearance.single')), h('option', { value: 'playthrough' }, translate(role === 'user' ? 'appearance.allUsers' : 'appearance.allCharacters'))),
        h('button', { type: 'button', disabled: busy || !avatar, onClick: () => save() }, translate('appearance.apply')),
        h('button', { type: 'button', disabled: busy, onClick: () => save('reset-message') }, translate('appearance.resetMessage')),
        h('button', { type: 'button', disabled: busy, onClick: () => save('reset-playthrough') }, translate('appearance.resetPlaythrough')),
        h('button', { type: 'button', disabled: busy, onClick: () => setEditing(false) }, translate('appearance.close')),
        error ? h('p', { role: 'alert' }, error) : null)) : null,
  )
}

export function characterAvatarUrl(id) { return id ? `${API_V1}/characters/${encodeURIComponent(id)}/png` : null }
