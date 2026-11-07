import { createElement as h, useEffect, useRef, useState } from 'react'
import { translate as t } from './i18n.js'
import { resourceApi } from './resource-api.js'
import { CLIENT_REFRESH_EVENT } from '../../identity.js'

const empty = Object.freeze({ feeling: '', intensity: 3, reason: '' })

export function PersonalityMood({ sessionId, personalityId }) {
  const [state, setState] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const writes = useRef(0)
  const read = signal => resourceApi(`/personality-mood?sessionId=${encodeURIComponent(sessionId)}`, { signal })
  const receive = result => {
    if (result.personalityId !== personalityId) { setState(null); setError(t('personality.bindingChanged')); return }
    setState(result); setDraft(result.mood ?? empty)
  }
  useEffect(() => {
    const controller = new AbortController()
    let timer, request = 0, initialized = false
    setState(null); setError('')
    const refresh = async () => {
      clearTimeout(timer)
      if (document.hidden) return
      const current = ++request
      const generation = writes.current
      try {
        const result = await read(controller.signal)
        if (controller.signal.aborted || request !== current || generation !== writes.current) return
        if (!initialized) { receive(result); initialized = true }
        else if (result.personalityId === personalityId) setState(result)
        else { setState(null); setError(t('personality.bindingChanged')) }
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message) }
      if (!controller.signal.aborted) timer = setTimeout(refresh, 3000)
    }
    refresh()
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort(); clearTimeout(timer)
      window.removeEventListener(CLIENT_REFRESH_EVENT, refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [sessionId, personalityId])
  async function commit(fields) {
    writes.current++
    setBusy(true); setError('')
    try {
      const result = await resourceApi('/personality-mood', { method: 'POST', body: JSON.stringify({ sessionId, personalityId, expectedRevision: state.revision, expectedReplyRevision: state.reply?.revision, ...fields }) })
      if (Object.hasOwn(fields, 'skipNextReply') && result.personalityId === personalityId) setState(result)
      else receive(result)
    } catch (failure) {
      if (failure.status === 409) {
        try {
          const latest = await read()
          if (latest.personalityId === personalityId) setState(latest)
          else setState(null)
        } catch { setState(null) }
      }
      setError(failure.message)
    } finally { setBusy(false) }
  }
  return h('section', { className: 'dcc-card' },
    error && h('p', { role: 'alert', className: 'dcc-status', 'data-error': true }, error),
    state ? h('div', { className: 'dcc-detail-body' },
      h('p', { className: 'dcc-meta' }, state.mood ? t('personality.currentMood', { feeling: state.mood.feeling, intensity: state.mood.intensity }) : t('personality.noMood')),
      h('p', { className: 'dcc-note' }, t('personality.moodScope')),
      state.reply && h('div', { className: 'dcc-detail-body' },
        h('p', { role: 'status', className: 'dcc-note' }, t(state.reply.status === 'active' ? 'personality.moodReplyActive' : state.reply.skipNextReply ? 'personality.moodReplyPending' : 'personality.moodReplyScope')),
        h('button', { type: 'button', className: 'dcc-button', disabled: busy || state.reply.status === 'active', onClick: () => commit({ skipNextReply: !state.reply.skipNextReply }) }, t(state.reply.status === 'active' ? 'personality.skipMoodActive' : state.reply.skipNextReply ? 'personality.cancelSkipMood' : 'personality.skipMoodReply'))),
      h('label', { className: 'dcc-field' }, t('personality.feeling'), h('input', { className: 'dcc-input', maxLength: 80, disabled: busy, value: draft.feeling, onChange: event => setDraft({ ...draft, feeling: event.target.value }) })),
      h('label', { className: 'dcc-field' }, t('personality.intensity', { intensity: draft.intensity }), h('input', { type: 'range', min: 1, max: 5, disabled: busy, value: draft.intensity, onChange: event => setDraft({ ...draft, intensity: Number(event.target.value) }) })),
      h('label', { className: 'dcc-field' }, t('personality.moodReason'), h('textarea', { className: 'dcc-textarea', maxLength: 500, disabled: busy, value: draft.reason, onChange: event => setDraft({ ...draft, reason: event.target.value }) })),
      h('div', { className: 'dcc-actions' },
        h('button', { className: 'dcc-button dcc-primary', disabled: busy || !draft.feeling.trim() || !draft.reason.trim(), onClick: () => commit({ mood: { feeling: draft.feeling.trim(), intensity: draft.intensity, reason: draft.reason.trim() } }) }, t('personality.setMood')),
        h('button', { className: 'dcc-button', disabled: busy || !state.mood, onClick: () => commit({ mood: null }) }, t('personality.clearMood'))),
      h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: state.automatic, disabled: busy, onChange: event => commit({ automatic: event.target.checked }) }), t('personality.automaticMood')))
      : !error && h('p', { role: 'status' }, t('common.loading')))
}
