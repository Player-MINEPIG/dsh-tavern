import { createElement as h, useEffect, useState } from 'react'
import { CLIENT_REFRESH_EVENT } from '../../identity.js'
import { translate as t } from './i18n.js'
import { resourceApi } from './resource-api.js'
import { DEFAULT_EVOLUTION_INSTRUCTIONS, evolutionAssessmentSystem } from '../../personality/src/evolution-prompt.js'

function Evidence({ path, revision, evidence }) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  if (!evidence) return null
  const load = async () => {
    setBusy(true)
    try {
      const data = await resourceApi(`${path}/${revision}/evidence`)
      setResult(data.evidence)
    } catch (error) { setResult({ available: false, reason: error.message }) }
    finally { setBusy(false) }
  }
  const reasonLabels = {
    'no-evidence': 'personality.noEvidence',
    'session-unavailable': 'personality.sessionUnavailable',
    'source-unavailable': 'personality.sourceUnavailable',
    'source-version-unavailable': 'personality.sourceVersionUnavailable',
  }
  const refs = evidence.items?.length ? evidence.items : [evidence]
  return h('div', { className: 'dcc-note' },
    refs.map((ref, index) => {
      const origin = ref.kind === 'external' ? ref.origin : ref
      return h('div', { key: index },
        ref.kind === 'external' && h('p', null, t('personality.externalEvidence', { source: ref.source, id: ref.id, version: ref.version ?? '—' })),
        origin && h('p', null, t('personality.originalEvidence', { session: origin.sessionId, start: origin.startSeq, end: origin.endSeq })))
    }),
    h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: load }, t('personality.readEvidence')),
    result && h('p', { className: 'dcc-status', style: { whiteSpace: 'pre-wrap' }, role: 'status' }, result.available ? result.text : t('personality.evidenceUnavailable', { reason: reasonLabels[result.reason] ? t(reasonLabels[result.reason]) : result.reason || '—' })))
}

export function PersonalityEvolution({ personalityId, focusRevision, observedRevision, loadModels }) {
  const path = `/personalities/${encodeURIComponent(personalityId)}/evolution`
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(focusRevision ?? null)
  const [refresh, setRefresh] = useState(0)
  const [models, setModels] = useState(null)
  const [modelError, setModelError] = useState('')
  const [instructions, setInstructions] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    resourceApi(path, { signal: controller.signal }).then(({ evolution }) => {
      if (!controller.signal.aborted) setSnapshot(evolution)
    }, failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [path, refresh, focusRevision, observedRevision])
  useEffect(() => { setSelected(focusRevision ?? null) }, [focusRevision])
  useEffect(() => { if (snapshot) setInstructions(snapshot.config.assessmentInstructions || DEFAULT_EVOLUTION_INSTRUCTIONS) }, [snapshot?.config.assessmentInstructions])
  useEffect(() => {
    let active = true
    setModels(null); setModelError('')
    if (loadModels) Promise.resolve().then(loadModels).then(result => {
      if (!result.ok) throw new Error(result.error.message)
      if (active) { setModels(result.value); if (result.value.failures?.length) setModelError(t('personality.judgeCatalogPartial')) }
    }).catch(failure => { if (active) setModelError(failure.message) })
    return () => { active = false }
  }, [loadModels, refresh])
  const modify = async (op, payload) => {
    setBusy(true); setError('')
    try {
      const { evolution } = await resourceApi(op ? `${path}/${op}` : path, {
        method: op ? 'POST' : 'PUT',
        body: JSON.stringify({ ...payload, expectedRevision: snapshot.revision, operationId: [...crypto.getRandomValues(new Uint32Array(4))].map(n => n.toString(16).padStart(8, '0')).join('') }),
      })
      setSnapshot(evolution); setSelected(null)
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    } catch (failure) {
      setError(failure.message); setRefresh(value => value + 1)
    } finally { setBusy(false) }
  }
  if (!snapshot) return h('p', { role: error ? 'alert' : 'status' }, error || t('common.loading'))
  const history = snapshot.history
  const row = history.find(item => item.revision === selected) ?? history.at(-1)
  const currentRevision = history.at(-1)?.revision
  const originLabel = id => id === 'original' ? t('personality.original')
    : snapshot.availableSources.includes(id) ? id : t('personality.unavailableProvider', { source: id })
  const configure = fields => modify(null, { ...snapshot.config, ...fields })
  const modelValue = snapshot.config.assessmentModel ? JSON.stringify(snapshot.config.assessmentModel) : ''
  const modelOptions = (models?.groups ?? []).flatMap(group => group.models.map(model => ({ value: JSON.stringify({ provider: group.id, model: model.id }), label: `${group.name} · ${model.name}` })))
  const missingModel = modelValue && !modelOptions.some(option => option.value === modelValue)
  const savedInstructions = snapshot.config.assessmentInstructions || DEFAULT_EVOLUTION_INSTRUCTIONS
  return h('div', { className: 'dcc-card' },
    h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: snapshot.config.enabled, disabled: busy, onChange: event => configure({ enabled: event.target.checked }) }), t('personality.learning')),
    h('label', { className: 'dcc-field' }, t('personality.reference'),
      h('select', { className: 'dcc-select', value: snapshot.config.referenceSource, disabled: busy, onChange: event => configure({ referenceSource: event.target.value }) },
        [...new Set([...snapshot.availableSources, snapshot.config.referenceSource])].map(source => h('option', { key: source, value: source }, originLabel(source))))),
    h('label', { className: 'dcc-field' }, t('personality.interval'),
      h('select', { className: 'dcc-select', value: snapshot.config.assessmentInterval ?? 4, disabled: busy, onChange: event => configure({ assessmentInterval: Number(event.target.value) }) },
        Array.from({ length: 8 }, (_, i) => h('option', { key: i, value: i + 1 }, String(i + 1))))),
    h('label', { className: 'dcc-field' }, t('personality.refreshMode'),
      h('select', { className: 'dcc-select', value: snapshot.config.refreshMode ?? 'immediate', disabled: busy, onChange: event => configure({ refreshMode: event.target.value }) },
        h('option', { value: 'immediate' }, t('personality.immediate')),
        h('option', { value: 'session-compaction' }, t('personality.compaction')))),
    h('label', { className: 'dcc-field' }, t('personality.judgeModel'),
      h('select', { className: 'dcc-select', value: modelValue, disabled: busy, onChange: event => configure({ assessmentModel: event.target.value ? JSON.parse(event.target.value) : null }) },
        h('option', { value: '' }, t('personality.judgeFollowTurn')),
        missingModel && h('option', { value: modelValue, disabled: true }, t('personality.judgeUnavailable', snapshot.config.assessmentModel)),
        modelOptions.map(option => h('option', { key: option.value, value: option.value }, option.label)))),
    h('p', { className: 'dcc-note' }, t('personality.judgeModelHelp')),
    (!loadModels || modelError || (!models && loadModels)) && h('p', { className: 'dcc-note', role: 'status' }, modelError || t(loadModels ? 'common.loading' : 'personality.judgeCatalogUnavailable')),
    h('label', { className: 'dcc-field' }, t('personality.judgeInstructions'),
      h('textarea', { className: 'dcc-textarea', rows: 10, maxLength: 6000, value: instructions, disabled: busy, onChange: event => setInstructions(event.target.value) })),
    h('p', { className: 'dcc-note' }, t('personality.judgeInstructionsHelp')),
    h('div', { className: 'dcc-actions' },
      h('button', { className: 'dcc-button', type: 'button', disabled: busy || instructions === savedInstructions, onClick: () => { const value = instructions.trim(); setInstructions(value || DEFAULT_EVOLUTION_INSTRUCTIONS); configure({ assessmentInstructions: value === DEFAULT_EVOLUTION_INSTRUCTIONS ? '' : value }) } }, t('personality.judgeSave')),
      h('button', { className: 'dcc-button', type: 'button', disabled: busy || (!snapshot.config.assessmentInstructions && instructions === DEFAULT_EVOLUTION_INSTRUCTIONS), onClick: () => { setInstructions(DEFAULT_EVOLUTION_INSTRUCTIONS); configure({ assessmentInstructions: '' }) } }, t('personality.judgeReset'))),
    h('details', { className: 'dcc-note' }, h('summary', null, t('personality.judgeActualPrompt')),
      h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, evolutionAssessmentSystem(snapshot.config.assessmentInstructions))),
    h('p', { className: 'dcc-note' }, t('personality.pendingCount', { count: snapshot.pendingCount ?? 0 }),
      snapshot.deferredCount > 0 && ' · ' + t('personality.deferredCount', { count: snapshot.deferredCount })),
    h('p', { className: 'dcc-note' }, t('personality.learningScope')),
    h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: () => setRefresh(value => value + 1) }, t('common.refresh')),
    error && h('p', { role: 'alert', className: 'dcc-status', 'data-error': true }, error),
    row ? h('section', { className: 'dcc-card' },
      h('label', { className: 'dcc-field' }, t('personality.history'),
        h('select', { className: 'dcc-select', value: row.revision, disabled: busy, onChange: event => setSelected(Number(event.target.value)) },
          history.toReversed().map(item => h('option', { key: item.revision, value: item.revision }, t(item.kind === 'rollback' ? 'personality.historyRollback' : 'personality.historyRevision', { version: item.revision }))))),
      ...[['before','personality.before'],['after','personality.after'],['behavior','personality.behavior'],['boundary','personality.boundary'],['reason','personality.reason']]
        .filter(([key]) => row[key]).map(([key,label]) => h('div', { key, className: 'dcc-field' }, h('strong', { className: 'dcc-label' }, t(label)), h('span', { className: 'dcc-note' }, row[key]))),
      h(Evidence, { key: row.revision, path, revision: row.revision, evidence: row.evidence }),
      h('div', { className: 'dcc-actions' },
        h('button', { className: 'dcc-button', disabled: busy || row.revision === currentRevision, onClick: () => modify('rollback', { targetRevision: row.revision }) }, t('personality.restoreRevision')),
        h('button', { className: 'dcc-button', disabled: busy || snapshot.current === null, onClick: () => modify('rollback', { targetRevision: 0 }) }, t('personality.restoreBaseline'))))
      : h('p', { className: 'dcc-note' }, t('personality.baseline')))
}
