import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_V1, CLIENT_REFRESH_EVENT } from '../../../identity.js'
import { tavernFetch } from '../api-fetch.js'
import { translate as t } from '../i18n.js'
import { useClientUiSettings } from '../i18n/use-ui-settings.js'
import { ConversationPresentation, MessageBubble, characterAvatarUrl } from './presentation.js'
import { Greeting, installPlayChatStyles } from './chat.js'
import { adjacentGreetingIndex, applyDisplayNameMacros, projectGreeting } from './chat-model.js'
import { getRegexDocument, applyGreetingDisplayRegex, resourceRegexRules } from './regex.js'
import { readRenderingWorkspace, identifyRenderingSources, renderingInventory } from './rendering-sources.js'
import { useRestoredRenderingDisplay } from './rendering-display.js'
import { createComposerAdapter } from './card-composer.js'
import { parsePlaythroughImport } from './import.js'

async function resource(path) {
  const response = await tavernFetch(`${API_V1}/${path}`, { cache: 'no-store' }), result = await response.json()
  if (!response.ok) throw Error(result.error ?? `HTTP ${response.status}`)
  return result
}
export async function loadDraftDisplay(client, draft, playthrough) {
  const selection = draft.selection
  const [characterResponse, presetResponse, userResponse, regex, timeline] = await Promise.all([
    client.getCharacter(selection.characterCardId),
    selection.presetId ? client.getPreset(selection.presetId) : null,
    selection.userId ? resource(`users/${encodeURIComponent(selection.userId)}`) : null,
    readRenderingWorkspace(client, () => getRegexDocument(client)), client.getTimeline(playthrough),
  ])
  const character = characterResponse.character, preset = presetResponse?.preset, user = userResponse?.user
  const bindings = { characterId: selection.characterCardId, presetId: selection.presetId }
  const macros = { user: user?.name || 'User', character: character?.data?.nickname || character?.name || 'Assistant' }
  const rules = [...regex.resource.rules, ...resourceRegexRules(preset, { kind: 'preset', resourceId: selection.presetId }), ...resourceRegexRules(character, { kind: 'character', resourceId: selection.characterCardId })]
  const greeting = projectGreeting({ openingCharacterId: selection.characterCardId, selectionResponse: { selection }, characterResponse })
  const expanded = greeting ? applyDisplayNameMacros(greeting.text, macros) : ''
  const renderingSources = await identifyRenderingSources([...renderingInventory(character, { kind: 'character', resourceId: selection.characterCardId }), ...renderingInventory(preset, { kind: 'preset', resourceId: selection.presetId })])
  const imported = draft.importContextRef ? JSON.parse((await client.getFile(draft.importContextRef.path)).content) : null
  return { timeline, turns: [], importContext: imported, greeting: greeting ? { ...greeting, ...applyGreetingDisplayRegex(expanded, rules, bindings, { depth: 0 }), sourceText: expanded, messageCount: 1 } : null,
    avatars: { user: user?.avatar ?? null, assistant: characterAvatarUrl(selection.characterCardId) },
    display: { rules, bindings, macros, globalRenderingOwner: regex.owner, renderingSources } }
}

const css = `.dtv-draft-opening{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}.dtv-draft-opening>header{display:flex;align-items:center;gap:12px;padding:14px 72px 14px 18px;border-bottom:1px solid var(--dsw-alias-border-l3)}.dtv-draft-opening>header strong{flex:1}.dtv-draft-opening>header small{color:var(--dsw-alias-label-tertiary)}.dtv-draft-body{flex:1;min-height:0;overflow:auto;padding:20px max(16px,calc((100% - 1040px)/2))}.dtv-draft-opening .dtv-play-chat-bubble{max-width:100%}.dtv-draft-settings{margin:18px 0;border-top:1px solid var(--dsw-alias-border-l3);padding-top:16px}.dtv-draft-settings fieldset{border:0;margin:16px 0;padding:16px 0 0;border-top:1px solid var(--dsw-alias-border-l3)}.dtv-draft-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}.dtv-draft-opening label{display:grid;gap:8px}.dtv-draft-opening select,.dtv-draft-opening textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:10px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit}.dtv-draft-opening button{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 12px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;cursor:pointer}.dtv-draft-opening button:disabled{opacity:.5;cursor:default}.dtv-draft-books{display:flex;gap:16px;flex-wrap:wrap}.dtv-draft-books label{display:flex;align-items:center;gap:8px}.dtv-draft-composer{flex:none;padding:14px max(16px,calc((100% - 1040px)/2));border-top:1px solid var(--dsw-alias-border-l3)}.dtv-draft-composer>div{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px}.dtv-draft-composer textarea{resize:vertical;min-height:80px}.dtv-draft-opening [role=alert]{color:var(--dsw-alias-state-error);overflow-wrap:anywhere}.dtv-draft-settings>summary{cursor:pointer;font-weight:600}.dtv-draft-notice{margin:10px 0;font-size:12px;color:var(--dsw-alias-label-tertiary)}`
function styles() { installPlayChatStyles(); if (document.querySelector('style[data-dtv-drafts]')) return; const node = document.createElement('style'); node.dataset.dtvDrafts = ''; node.textContent = css; document.head.append(node) }

/** A main.conversation occurrence without any Session-scoped hooks or fake history. */
export function DraftOpening({ draftId, playClient, openSession, switchToNative }) {
  styles()
  const [loaded, setLoaded] = useState(null), [display, setDisplay] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [text, setText] = useState(''), [variableText, setVariableText] = useState('')
  const settings = useClientUiSettings(), current = useRef(null), generation = useRef(0), sending = useRef(null), input = useRef({ draft: '', draftRev: 0, phase: 'plain', attachmentIds: [], occurrences: [] })
  const variableRevision = useRef(null), inputHydrated = useRef(false)
  const recovering = useRef(null)
  const life = useRef(true), file = useRef(null), operation = useRef(null)
  current.current = { loaded, display, busy }
  const report = useCallback(value => setError(value), [])
  useRestoredRenderingDisplay(display?.display, settings, report)
  const refresh = useCallback(async () => {
    const epoch = ++generation.current
    let next = await playClient.getDraft(draftId)
    if (!inputHydrated.current) { inputHydrated.current = true; input.current.draft = next.draft.claim?.text ?? next.draft.lastInput ?? ''; input.current.draftRev++; setText(input.current.draft) }
    if (next.draft.claim && next.draft.phase !== 'started' && !sending.current) {
      // Recover an interrupted first send before exposing editable controls.
      const retained = next.draft.claim.text
      input.current.draft = retained; input.current.draftRev++; setText(retained)
      if (!recovering.current) { const pending = playClient.cancelDraft(draftId); recovering.current = pending; pending.finally(() => { if (recovering.current === pending) recovering.current = null }).catch(() => {}) }
      const result = await recovering.current
      if (!life.current || epoch !== generation.current) return
      if (result.sessionId) { openSession(result.sessionId, next.playthrough); return }
      operation.current = null; input.current.draft = retained; input.current.draftRev++; setText(retained)
      next = await playClient.getDraft(draftId)
    }
    if (!life.current || epoch !== generation.current) return
    if (next.draft.phase === 'started') { openSession(next.draft.claim.sessionId, next.playthrough); return }
    const projection = await loadDraftDisplay(playClient, next.draft, next.playthrough)
    if (!life.current || epoch !== generation.current) return
    setLoaded(next); setDisplay(projection); if (variableRevision.current !== next.draft.variableRevision) { variableRevision.current = next.draft.variableRevision; setVariableText(JSON.stringify(next.draft.variables?.stat_data ?? {}, null, 2)) }
    if (next.draft.claim) { operation.current = next.draft.claim.operationId; input.current.draft = next.draft.claim.text; input.current.draftRev++; setText(input.current.draft) }
  }, [draftId, playClient, openSession])
  useEffect(() => {
    life.current = true; void refresh().catch(reason => { if (life.current) setError(reason.message) })
    const onRefresh = event => { if (event.detail?.source !== 'draft-opening') void refresh().catch(reason => { if (life.current) setError(reason.message) }) }
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    return () => { window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh); life.current = false; generation.current++; sending.current?.abort() }
  }, [refresh])
  const change = useCallback(async patch => {
    if (current.current.busy || sending.current) return
    setBusy(true); setError('')
    try { const fresh = await playClient.getDraft(draftId); await playClient.putDraft(draftId, { ...patch, expectedRevision: fresh.draft.revision }); await refresh(); window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT, { detail: { source: 'draft-opening' } })) }
    catch (reason) { if (life.current) setError(reason.message) }
    finally { if (life.current) setBusy(false) }
  }, [draftId, playClient, refresh])
  const send = useCallback(async (value, { signal } = {}) => {
    if (sending.current || current.current.busy) throw Error(t('play.draft.busy'))
    const controller = new AbortController(), abort = () => controller.abort()
    input.current.draft = value; input.current.draftRev++; setText(value)
    signal?.throwIfAborted(); signal?.addEventListener('abort', abort, { once: true }); sending.current = controller; setBusy(true); setError('')
    try {
      const fresh = await playClient.getDraft(draftId, { signal: controller.signal })
      operation.current = fresh.draft.claim?.operationId ?? operation.current ?? crypto.randomUUID()
      const prepared = await playClient.materializeDraft(draftId, { expectedRevision: fresh.draft.revision, operationId: operation.current, text: value }, { signal: controller.signal })
      controller.signal.throwIfAborted()
      if (!prepared.accepted) await playClient.postUserMessage(prepared.sessionId, value, { requestId: prepared.requestId, signal: controller.signal })
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
      // The card's accepted-send continuation can settle before its view exits.
      setTimeout(() => { if (life.current) openSession(prepared.sessionId, fresh.playthrough) }, 0)
      return { accepted: true }
    } catch (reason) {
      // Reconcile admission before undoing bindings: a lost response must not
      // discard an input already accepted into authoritative DSH history.
      try {
        const observed = await playClient.getDraft(draftId)
        if (observed.draft.phase === 'started') { if (life.current) openSession(observed.draft.claim.sessionId, observed.playthrough); return { accepted: true } }
        const result = await playClient.cancelDraft(draftId)
        if (life.current && result.sessionId) { openSession(result.sessionId, current.current.loaded.playthrough); return { accepted: true } }
        operation.current = null
        await refresh()
      } catch (rollback) { if (life.current) setError(t('play.draft.sendFailed', { message: rollback.message })); throw rollback }
      if (life.current) setError(reason.name === 'AbortError' ? t('play.draft.cancelled') : t('play.draft.sendFailed', { message: reason.message }))
      throw reason
    }
    finally { signal?.removeEventListener('abort', abort); if (sending.current === controller) sending.current = null; if (life.current) setBusy(false) }
  }, [draftId, openSession, playClient, refresh])
  const cancel = useCallback(async () => {
    if (sending.current) { sending.current.abort(); return }
    setBusy(true)
    try {
      const result = await playClient.cancelDraft(draftId)
      if (!life.current) return
      if (result.sessionId) openSession(result.sessionId, current.current.loaded.playthrough)
      else { operation.current = null; await refresh(); setError(t('play.draft.cancelled')) }
    } catch (reason) { if (life.current) { setError(reason.message); await refresh().catch(() => {}) } }
    finally { if (life.current) setBusy(false) }
  }, [draftId, playClient, openSession, refresh])
  const composer = useMemo(() => createComposerAdapter({
    inputActions: { captureInsertion: () => ({ draftRev: input.current.draftRev }), insertText: (value, range) => { if (input.current.draftRev !== range.draftRev) return false; input.current.draft = value; input.current.draftRev++; setText(value); return true } },
    getState: () => input.current, isCurrent: () => life.current && current.current.loaded?.draft.id === draftId, isReady: () => !current.current.busy && !sending.current, send,
  }), [draftId, send])
  const draft = loaded?.draft, playthrough = loaded?.playthrough, locked = busy || draft?.phase !== 'draft'
  return h('section', { className: 'dtv-draft-opening', 'data-dtv-draft': draftId },
    h('header', null, h('strong', null, playthrough?.title ?? t('play.draft.opening')), h('small', null, t('play.draft.notStarted')), h('button', { onClick: switchToNative }, t('play.opening.native'))),
    h('div', { className: 'dtv-draft-body' },
      !display ? h('p', null, t('common.loading')) : h(ConversationPresentation, { state: display, playthrough, playClient, sessionId: null, busy, disabled: draft.phase !== 'draft', changed: () => {}, composer, sendMessage: send },
        display.importContext ? h('section', null,
          display.importContext.greeting && h(MessageBubble, { text: display.importContext.greeting, editable: false, messageKey: 'draft-import-greeting' }),
          ...(display.importContext.qa ?? []).map((qa, index) => h('div', { key: index }, h(MessageBubble, { text: qa.user, role: 'user', editable: false, messageKey: `draft-import-u-${index}` }), h(MessageBubble, { text: qa.assistant, editable: false, messageKey: `draft-import-a-${index}` }))))
          : h(Greeting, { greeting: display.greeting, busy, locked: draft.phase !== 'draft', change: direction => { const index = adjacentGreetingIndex(display.greeting, direction); if (index !== null) void change({ selection: { ...draft.selection, character: { ...draft.selection.character, greetingIndex: index } } }) } })),
      draft && h('details', { className: 'dtv-draft-settings' }, h('summary', null, t('play.draft.settings')),
        h('p', { className: 'dtv-draft-notice' }, t('play.draft.launcherHint')),
        draft.variables && h('fieldset', { disabled: locked }, h('legend', null, t('play.draft.variables')), h('p', { className: 'dtv-draft-notice' }, t('play.draft.variablesHint')),
          h('textarea', { rows: 7, value: variableText, 'aria-label': t('play.draft.variables'), onChange: event => setVariableText(event.target.value) }),
          h('button', { onClick: () => { try { void change({ variables: { stat_data: JSON.parse(variableText) } }) } catch (reason) { setError(reason.message) } } }, t('play.draft.saveVariables')),
          h('button', { onClick: () => change({ resetVariables: true }) }, t('play.draft.resetVariables'))),
        h('fieldset', { disabled: locked }, h('legend', null, t('play.draft.import')), h('input', { type: 'file', hidden: true, accept: '.jsonl', ref: file, onChange: async event => {
          const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return
          try { if (selected.size > 2 * 1024 * 1024) throw Error(t('play.draft.importLimit')); const document = parsePlaythroughImport(await selected.text(), selected.name), path = `${playthrough.path.slice(0, -'timeline.json'.length)}import-context-${crypto.randomUUID()}.json`; await playClient.putFile(path, JSON.stringify(document)); await change({ importContextRef: { path } }) } catch (reason) { setError(reason.message) }
        } }), h('button', { onClick: () => file.current.click() }, t('play.draft.importFile')), draft.importContextRef && h('button', { onClick: () => change({ importContextRef: null }) }, t('play.draft.removeImport')))),
      error && h('p', { role: 'alert' }, error)),
    h('form', { className: 'dtv-draft-composer', onSubmit: event => { event.preventDefault(); void send(input.current.draft).catch(() => {}) } },
      h('textarea', { value: text, readOnly: locked, 'aria-label': t('play.draft.input'), placeholder: t('play.draft.input'), onChange: event => { input.current.draft = event.target.value; input.current.draftRev++; setText(event.target.value) } }),
      h('div', null, h('small', { className: 'dtv-draft-notice' }, t('play.draft.sendHint')),
        busy ? h('button', { type: 'button', onClick: cancel }, t('play.draft.cancel')) : h('button', { type: 'submit', disabled: locked || !text.trim() }, t('play.draft.send')))))
}
