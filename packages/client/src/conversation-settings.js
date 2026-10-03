import { normalizeScriptEnablement } from '../../presentation/script-enablement.js'
import { normalizeRenderingAdapters } from '../../presentation/rendering-adapters.js'
import { renderingTrust } from './play/rendering-trust.js'
import { normalizeBubbleStyle } from '../../presentation/bubble-style.js'
import { CLIENT_CONVERSATION_SETTINGS_EVENT } from '../../identity.js'

export const DEFAULT_CONVERSATION_SETTINGS = Object.freeze({ textScale: 1, actionScale: 1 })
export const CONVERSATION_SCALE_OPTIONS = Object.freeze([0.75, 0.85, 1, 1.15, 1.25, 1.5])

let current = { ...DEFAULT_CONVERSATION_SETTINGS }

function boundedScale(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0.75 && numeric <= 1.5
    ? Number(numeric.toFixed(2))
    : fallback
}

export function getClientConversationSettings() {
  return structuredClone(current)
}

export function normalizeClientConversationSettings(value) {
  return {
    ...(value?.scriptEnablement === undefined ? {} : { scriptEnablement: normalizeScriptEnablement(value.scriptEnablement) }),
    ...(value?.renderingAdapters === undefined ? {} : { renderingAdapters: normalizeRenderingAdapters(value.renderingAdapters) }),
    ...(value?.bubbleStyle ? { bubbleStyle: normalizeBubbleStyle(value.bubbleStyle) } : {}),
    ...(value?.interactiveCards === undefined ? {} : { interactiveCards: value.interactiveCards === true }),
    textScale: boundedScale(value?.textScale, DEFAULT_CONVERSATION_SETTINGS.textScale),
    actionScale: boundedScale(value?.actionScale, DEFAULT_CONVERSATION_SETTINGS.actionScale),
  }
}

export function setClientConversationSettings(value, { announce = true } = {}) {
  current = normalizeClientConversationSettings(value)
  renderingTrust.setEnablement(current.scriptEnablement)
  renderingTrust.setAdapterIntents(current.renderingAdapters)
  if (announce && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLIENT_CONVERSATION_SETTINGS_EVENT, {
      detail: getClientConversationSettings(),
    }))
  }
  return getClientConversationSettings()
}

// One authority for initial reads and subsequent writes. Only the latest live
// request may publish settings or status; persisted changes are never optimistic.
export function createConversationSettingsPersistence({request,apply,status,busy}) {
  let generation=0, active=true
  async function run(method, value) {
    const ticket=++generation, writing=method!=='GET'
    const current=()=>active&&ticket===generation
    busy(true)
    if(writing)status('saving')
    try {
      const body=method==='PUT'?normalizeClientConversationSettings(value):undefined
      const result=await request(method,body)
      if(!current())return
      apply(result);status('saved')
    }catch(error){
      if(current())status(writing?'saveError':'loadError',error)
    }finally{
      if(current())busy(false)
    }
  }
  return {
    load(){active=true;return run('GET')},
    save(value){return run('PUT',value)},
    reset(){return run('DELETE')},
    dispose(){active=false;generation++},
  }
}
