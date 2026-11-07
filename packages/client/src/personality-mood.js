import { createElement as h, useEffect, useState } from 'react'
import { translate as t } from './i18n.js'
import { resourceApi } from './resource-api.js'

const empty = Object.freeze({ feeling: '', intensity: 3, reason: '' })

export function PersonalityMood({ sessionId, personalityId }) {
  const [state, setState] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const read = signal => resourceApi(`/personality-mood?sessionId=${encodeURIComponent(sessionId)}`, { signal })
  const receive = result => {
    if (result.personalityId !== personalityId) { setState(null); setError(t('personality.bindingChanged')); return }
    setState(result); setDraft(result.mood ?? empty)
  }
  useEffect(() => {
    const controller = new AbortController()
    read(controller.signal).then(result => { if (!controller.signal.aborted) receive(result) },
      failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [sessionId, personalityId])
  async function commit(fields) {
    setBusy(true); setError('')
    try {
      const result = await resourceApi('/personality-mood', { method: 'POST', body: JSON.stringify({ sessionId, personalityId, expectedRevision: state.revision, ...fields }) })
      receive(result)
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
      h('label', { className: 'dcc-field' }, t('personality.feeling'), h('input', { className: 'dcc-input', maxLength: 80, disabled: busy, value: draft.feeling, onChange: event => setDraft({ ...draft, feeling: event.target.value }) })),
      h('label', { className: 'dcc-field' }, t('personality.intensity', { intensity: draft.intensity }), h('input', { type: 'range', min: 1, max: 5, disabled: busy, value: draft.intensity, onChange: event => setDraft({ ...draft, intensity: Number(event.target.value) }) })),
      h('label', { className: 'dcc-field' }, t('personality.moodReason'), h('textarea', { className: 'dcc-textarea', maxLength: 500, disabled: busy, value: draft.reason, onChange: event => setDraft({ ...draft, reason: event.target.value }) })),
      h('div', { className: 'dcc-actions' },
        h('button', { className: 'dcc-button dcc-primary', disabled: busy || !draft.feeling.trim() || !draft.reason.trim(), onClick: () => commit({ mood: { feeling: draft.feeling.trim(), intensity: draft.intensity, reason: draft.reason.trim() } }) }, t('personality.setMood')),
        h('button', { className: 'dcc-button', disabled: busy || !state.mood, onClick: () => commit({ mood: null }) }, t('personality.clearMood'))),
      h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: state.automatic, disabled: busy, onChange: event => commit({ automatic: event.target.checked }) }), t('personality.automaticMood')))
      : !error && h('p', { role: 'status' }, t('common.loading')))
}
