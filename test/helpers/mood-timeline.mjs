import { installMoodHost } from '../../packages/personality/src/mood-host.js'
import { PersonalityMood } from '../../packages/personality/src/mood.js'

export function createMoodTimeline(directory, judge, { personality = 'Careful and collaborative.', description = '' } = {}) {
  let time = 0, turnNumber = 0, seq = 0, handler
  const events = [], calls = [], errors = [], effects = []
  const moods = new PersonalityMood(directory, { now: () => time })
  moods.change('p', 's', { expectedRevision: 0, automatic: true })
  const session = { id: 's', header: { id: 's', createdAt: 0 }, inheritedEventCount: 0, snapshotEvents: () => events }
  const llm = { async *stream(request) {
    const input = JSON.parse(request.messages[0].content[0].text)
    calls.push({ input, system: request.system })
    const answer = await judge(input)
    yield { type: 'block-end', block: { type: 'text', text: JSON.stringify(answer) } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } }
  const ctx = { effect: fn => effects.push(fn()), get: key => key === 'llm' ? llm : null, on: (_, fn) => { handler = fn } }
  const cards = { selection: () => ({ characterCardId: 'p' }), bindingLease: () => () => true,
    get: () => ({ data: { personality, description } }) }
  const host = installMoodHost(ctx, { cards, moods, nativeLease: () => () => true, notify() {}, report: error => errors.push(error) })
  const add = (type, data) => { const event = { seq: ++seq, type, data }; events.push(event); handler(session, event); return event }
  return { moods, calls, errors, host, session,
    tick(ms) { time += ms },
    read() { return moods.read('p', 's') },
    manual(mood) { return moods.change('p', 's', { expectedRevision: moods.read('p', 's').revision, mood }) },
    async turn(text, { failure, assistant = 'Completed the requested step.' } = {}) {
      const turn = ++turnNumber
      add('turn/start', { turn })
      add('request/header', { header: { config: { provider: 'offline', model: 'test' } } })
      add('user/message', { message: { source: { kind: 'user' }, content: [{ type: 'text', text }] } })
      if (failure) {
        add('tool/call', { turn, callId: 'call-' + turn, name: 'check' })
        add('tool/result', { turn, error: { code: 'CHECK_FAILED', reason: failure }, message: { isError: true, source: { callId: 'call-' + turn }, content: [] } })
      }
      add('assistant/message', { turn, message: { content: [{ type: 'text', text: assistant }] } })
      add('turn/end', { turn, reason: { kind: 'completed' } })
      await host.idle()
      return moods.read('p', 's')
    },
    dispose() { for (const effect of effects) effect?.() },
  }
}
