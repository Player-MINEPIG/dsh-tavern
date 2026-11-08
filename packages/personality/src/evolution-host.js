import { completedHumanTurn, requestAssessment, evidenceHash, readOriginalTurn } from './turn-assessment.js'
import { validateChange } from './evolution.js'
import { evolutionAssessmentSystem } from './evolution-prompt.js'

// This only wakes the assessor; it never authorizes a personality write.
export function urgentSelfCorrection(turn) {
  return /记住.{0,12}(?:这个|这次|这条)?教训|重新(?:认识|理解).{0,12}(?:自己|职责|责任|能力|局限)|你(?:对自己|的).{0,12}(?:职责|责任|能力边界|自我定位)|不要把自信.{0,12}(?:有用|可靠)|remember (?:this|the) lesson|(?:rethink|revise|change) your (?:responsibility|self-understanding|limits|role)/i.test(turn.users.join('\n'))
}

export function validateEvolutionAssessment(answer, evidence) {
  const fail = () => { throw Object.assign(new Error('Self-revision requires grounded human, tool or external evidence and explicit counterevidence'), { code: 'PERSONALITY_ASSESSMENT_SCHEMA' }) }
  if (!answer || !Object.hasOwn(answer, 'change')) fail()
  if (answer.change === null) return null
  const basis = answer.basis
  if (['fact', 'user-preference', 'task-rule', 'mood', 'model-claim'].includes(basis?.kind)) return null
  if (basis?.kind !== 'self-understanding' || !Array.isArray(basis.supports) || !basis.supports.length || basis.supports.length > evidence.length * 5 ||
    typeof basis.counterevidence !== 'string' || !basis.counterevidence.trim() || basis.counterevidence.length > 1200) fail()
  const indices = new Set()
  for (const support of basis.supports) {
    const key = JSON.stringify([support?.index, support?.toolSeq ?? null])
    if (!Number.isSafeInteger(support?.index) || support.index < 1 || support.index > evidence.length || indices.has(key) ||
      typeof support.quote !== 'string' || !/[\p{L}\p{N}]/u.test(support.quote) || support.quote.length > 600) fail()
    const item = evidence[support.index - 1]
    const tool = support.toolSeq === undefined ? null : item.text.tools?.find(tool => tool.seq === support.toolSeq)
    if (support.toolSeq !== undefined && (!Number.isSafeInteger(support.toolSeq) || !tool || item.reference.kind !== 'original')) fail()
    const text = item.reference.kind === 'external' ? item.text : tool ? tool.text : item.text.users.join('\n')
    if (!text.includes(support.quote)) fail()
    indices.add(key)
  }
  return { ...validateChange(answer.change), evidenceSupports: basis.supports.map(({ index, toolSeq }) => ({ index, ...(toolSeq === undefined ? {} : { toolSeq }) })) }
}

async function readAssessmentEvidence(sources, referenceSource, id, turn, signal, session) {
  if (referenceSource === 'original') {
    return { reference: turn.origin, text: { users: turn.users, assistant: turn.assistant, ...(turn.tools ? { tools: turn.tools } : {}) }, checkCurrent: () => readOriginalTurn(session, turn.origin) !== null }
  }
  const adapter = sources.get(referenceSource)
  if (!adapter || (adapter.supports && adapter.supports(id) !== true)) return null
  const result = await adapter.resolve({ personalityId: id, origin: structuredClone(turn.origin), signal })
  const version = result?.version
  const validVersion = Number.isSafeInteger(version) || (typeof version === 'string' && version.trim() && version.length <= 512)
  if (!result || !validVersion || typeof result.id !== 'string' || !result.id.trim() || result.id.length > 512 ||
    typeof result.text !== 'string' || !result.text.trim() || result.text.length > 24000 || typeof result.checkCurrent !== 'function') return null
  return {
    reference: { kind: 'external', source: referenceSource, id: result.id, version, textHash: evidenceHash(result.text), origin: turn.origin },
    text: result.text,
    revalidate: typeof result.revalidate === 'function' ? () => result.revalidate() : null,
    checkCurrent: () => sources.get(referenceSource) === adapter && (!adapter.supports || adapter.supports(id) === true) && result.checkCurrent() === true,
  }
}

function uniqueEvidence(items) {
  const result = [], external = new Map()
  for (const item of items) {
    const ref = item.reference
    if (ref.kind !== 'external') { result.push(item); continue }
    const key = JSON.stringify([ref.source, ref.id, ref.version])
    const prior = external.get(key)
    if (prior) {
      if (prior.reference.textHash !== ref.textHash) return null
      prior.reference.origins ??= [prior.reference.origin]
      prior.reference.origins.push(ref.origin)
      continue
    }
    external.set(key, item)
    result.push(item)
  }
  return result
}

export function installEvolutionHost(ctx, { cards, evolution, nativeLease, notify, report }) {
  const turns = new WeakMap()
  const queues = new Map()
  const manualRuns = new Map()
  const stop = new AbortController()
  ctx.effect(() => () => stop.abort())
  ctx.provide('tavernPersonalityEvidence', evolution.sources)
  const run = async (session, task, turn) => {
    const { id, generation, lease, manual } = task
    const current = () => !stop.signal.aborted && lease() && evolution.record(id).generation === generation &&
      (evolution.record(id).config.enabled || evolution.allowsManual(id, manual, turn.origin))
    const urgent = !!manual || urgentSelfCorrection(turn)
    const schedule = evolution.batch(id, turn.origin, { urgent, manual })
    const ready = []
    const outcome = { assessed: 0, changed: 0, reasons: new Set() }
    let calls = 0
    for (const origin of schedule) {
      if (!current()) return
      if (calls >= 2) return outcome
      const state = evolution.record(id)
      const verified = readOriginalTurn(session, origin)
      let item
      let reason = 'reference-unavailable'
      if (verified) {
        try {
          item = await readAssessmentEvidence(evolution.sources, state.config.referenceSource, id, verified, stop.signal, session)
          if (item && !item.checkCurrent()) item = null
        } catch (error) {
          if (!current()) return
          reason = 'source-error'
          report(error, session.id)
        }
      } else reason = 'original-unavailable'
      if (!current()) return
      if (!item) {
        evolution.defer(id, origin, reason)
        outcome.reasons.add(reason)
        continue
      }
      if (evolution.hasEvidence(id, item.reference)) {
        evolution.finish(id, state.revision, [origin], item.reference, null, { partial: true, manual })
        continue
      }
      ready.push({ origin, item })
    }
    for (let offset = 0; offset < ready.length;) {
      if (!current()) return
      if (calls >= 2) return outcome
      const state = evolution.record(id)
      const group = []
      while (offset < ready.length && group.length < state.config.assessmentInterval) {
        const entry = ready[offset++]
        if (evolution.hasEvidence(id, entry.item.reference)) {
          evolution.finish(id, state.revision, [entry.origin], entry.item.reference, null, { partial: true, manual })
        } else group.push(entry)
      }
      if (!group.length || (group.length < state.config.assessmentInterval && !urgent)) continue
      group.sort((a,b) => a.origin.endSeq - b.origin.endSeq)
      const evidence = group.map(entry => entry.item)
      const stale = group.filter(entry => !entry.item.checkCurrent())
      if (stale.length) {
        for (const entry of stale) evolution.defer(id, entry.origin, 'source-version-unavailable')
        outcome.reasons.add('source-version-unavailable')
        continue
      }
      const batch = group.map(entry => entry.origin)
      const distinct = uniqueEvidence(evidence)
      if (!distinct) {
        for (const ref of batch) evolution.defer(id, ref, 'source-version-unavailable')
        outcome.reasons.add('source-version-unavailable')
        continue
      }
      calls++
      const data = cards.get(id).data
      const card = { name: data.name, description: data.description.slice(0, 6000), personality: data.personality.slice(0, 6000) }
      const input = { card, selfUnderstanding: evolution.current(id)?.after ?? null,
        evidence: distinct.length === 1 ? distinct[0].text : distinct.map(item => item.text) }
      let change
      try {
        const system = evolutionAssessmentSystem(state.config.assessmentInstructions)
        const answer = await requestAssessment(ctx.get('llm'), { turn, system, input, signal: stop.signal, purpose: 'tavern-personality-evolution', modelSelection: state.config.assessmentModel })
        change = validateEvolutionAssessment(answer, distinct)
      } catch (error) {
        if (!current()) return
        for (const ref of batch) evolution.defer(id, ref, 'assessment-rejected')
        outcome.reasons.add('assessment-rejected')
        report(error, session.id)
        continue
      }
      if (!current() || state.revision !== evolution.record(id).revision) return
      let revoked = false
      for (const { origin: ref, item } of group) {
        let valid = false
        try { valid = (!item.revalidate || await item.revalidate() === true) && item.checkCurrent() }
        catch (error) { if (current()) report(error, session.id) }
        if (!current() || state.revision !== evolution.record(id).revision) return
        if (!valid) { evolution.defer(id, ref, 'source-version-unavailable'); outcome.reasons.add('source-version-unavailable'); revoked = true }
      }
      if (revoked || !evidence.every(item => item.checkCurrent())) continue
      const cited = change ? [...new Set(change.evidenceSupports.map(support => support.index))].map(index => {
        const ref = distinct[index - 1].reference
        const toolEvidence = ref.toolEvidence?.filter(tool => change.evidenceSupports.some(support => support.index === index && support.toolSeq === tool.seq))
        return { ...ref, ...(ref.kind === 'original' ? { toolEvidence: toolEvidence ?? [] } : {}) }
      }) : distinct.map(item => item.reference)
      const reference = cited.length === 1 ? cited[0] : {
        ...cited.at(-1), items: cited,
      }
      const reviewed = distinct.map(item => item.reference)
      if (evolution.finish(id, state.revision, batch, reference, change, { partial: urgent, reviewed, manual })) { outcome.changed++; notify() }
      outcome.assessed++
    }
    return outcome
  }
  const queue = (session, task, turn) => {
    const job = (queues.get(task.id) ?? Promise.resolve()).then(() => run(session, task, turn)).catch(error => {
      if (!stop.signal.aborted) report(error, session.id)
    })
    queues.set(task.id, job)
    void job.finally(() => { if (queues.get(task.id) === job) queues.delete(task.id) })
    return job
  }
  const grow = (session, { status = false } = {}) => {
    if (!session) return { kind: 'error', text: '无法读取当前会话 / Current session unavailable.' }
    const selected = cards.selectedCharacter(session.id)
    if (!selected) return { kind: 'error', text: '请先选择人格卡 / Select a personality first.' }
    const id = selected.character.id, key = JSON.stringify([id, session.id, session.header.createdAt])
    const prior = manualRuns.get(key)
    if (status) return prior?.result ?? { kind: 'success', text: '尚未手动评估 / No manual assessment in this session.' }
    if (prior?.pending) return { kind: 'success', text: '成长评估正在进行；/grow status 查看结果 / Assessment in progress; use /grow status.' }
    if (manualRuns.size >= 128) {
      const expired = [...manualRuns].find(([, entry]) => !entry.pending)
      if (expired) manualRuns.delete(expired[0])
      else return { kind: 'error', text: '成长评估繁忙，请稍后重试 / Growth assessments are busy; retry later.' }
    }
    const native = nativeLease(session)
    if (!native) return { kind: 'error', text: '仅普通 DSH 会话可触发人格成长 / Growth requires a native DSH session.' }
    const origin = evolution.authorizedTurn(id, session)
    const turn = origin && readOriginalTurn(session, origin)
    if (!turn) return { kind: 'error', text: '没有可核验的本人格完整真人回合；请先完成一次对话 / Complete a human turn with this personality first.' }
    const manual = evolution.manualAuthorization(id, origin)
    if (!manual) return { kind: 'error', text: '成长证据授权已失效 / Evidence authorization expired.' }
    const state = evolution.record(id), generation = state.generation
    const binding = cards.bindingLease(session.id, id)
    const task = { id, generation, manual, lease: () => native() && binding() }
    evolution.enqueue(id, origin, { manual })
    if (!evolution.batch(id, origin, { urgent: true, manual }).length) {
      evolution.revokeManual(manual)
      return { kind: 'success', text: '没有未评估的新证据；不会重复学习 / No unreviewed evidence; nothing was assessed again.' }
    }
    const result = { kind: 'success', text: '已排队评估成长；不会修改自动开关。/grow status 查看结果 / Growth assessment queued; use /grow status.' }
    const entry = { pending: true, result }
    manualRuns.set(key, entry)
    void queue(session, task, turn).then(outcome => {
      entry.pending = false
      const latest = evolution.record(id)
      entry.result = !task.lease() || latest.generation !== generation || stop.signal.aborted
        ? { kind: 'error', text: '人格或会话已改变，本次评估已停止 / Assessment stopped because its context changed.' }
        : !outcome
          ? { kind: 'error', text: '成长评估未完成；请检查诊断 / Assessment did not complete; check diagnostics.' }
        : outcome.reasons.has('assessment-rejected')
          ? { kind: 'error', text: '模型评估失败或回复不合格；人格未按该证据修改 / Model assessment failed or was rejected; that evidence did not revise the personality.' }
        : outcome.reasons.size
          ? { kind: 'error', text: '证据来源暂不可查或已改变；请稍后重试 / Evidence source unavailable or changed; retry later.' }
        : outcome.changed
          ? { kind: 'success', text: '成长评估完成，已保存有证据支持的新理解 / Assessment complete; a grounded revision was saved.' }
          : evolution.batch(id, origin, { urgent: true, manual }).length
            ? { kind: 'error', text: '部分证据仍待评估；请检查成长面板的延后原因 / Evidence remains pending; check deferred reasons in Growth.' }
            : !outcome.assessed
              ? { kind: 'success', text: '证据已由先前任务处理，本次未重复评估 / Evidence already reviewed; no duplicate assessment.' }
            : { kind: 'success', text: '成长评估完成，没有足够依据修订自我理解 / Assessment complete; no grounded revision was needed.' }
      evolution.revokeManual(manual)
      notify()
    }).catch(error => {
      evolution.revokeManual(manual)
      entry.pending = false
      entry.result = { kind: 'error', text: '成长评估已停止，请检查人格与会话 / Assessment stopped; check the personality and session.' }
      if (!stop.signal.aborted) report(error, session.id)
    })
    return result
  }
  if (typeof ctx.inject === 'function') ctx.inject(['commands'], commandCtx => {
    commandCtx.commands.register({
      name: 'grow', description: '手动评估人格成长 / Assess personality growth now', input: { hint: '[status]' },
      handler: ({ agent, rawInput }) => {
        const input = String(rawInput ?? '').trim()
        if (input && input !== 'status') return { kind: 'error', text: '用法 / Usage: /grow [status]' }
        return grow(agent?.session, { status: input === 'status' })
      },
    })
  })
  ctx.on('session/event', (session, event) => {
    try {
      if (event.type === 'turn/start') {
        turns.delete(session)
        const selected = cards.selectedCharacter(session.id)
        if (!selected) return
        const card = selected.character, state = evolution.record(card.id)
        const native = nativeLease(session)
        const binding = cards.bindingLease(session.id, card.id)
        if (native) turns.set(session, { turn: event.data.turn, id: card.id, generation: state.generation, lease: () => native() && binding() })
      }
      if (event.type === 'turn/end') {
        const task = turns.get(session)
        turns.delete(session)
        if (!task || task.turn !== event.data.turn) return
        const turn = completedHumanTurn(session, event)
        if (!turn || !task.lease() || evolution.record(task.id).generation !== task.generation) return
        if (!evolution.record(task.id).config.enabled) { evolution.authorize(task.id, turn.origin); return }
        evolution.enqueue(task.id, turn.origin)
        // Serialize work per personality across sessions so simultaneous valid experiences can both contribute.
        queue(session, task, turn)
      }
    } catch (error) { report(error, session.id) }
  })
  return { grow, async idle() { await Promise.all(queues.values()) } }
}
