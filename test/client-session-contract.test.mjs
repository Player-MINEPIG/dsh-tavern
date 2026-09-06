import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MowanChatView } from '../packages/client/src/play/chat.js'
import { TavernTraceView } from '../packages/tavern-trace/src/client.js'
import { PlaySessionDock } from '../packages/client/src/play/notice.js'
import { getClientUiSettings, setClientUiSettings } from '../packages/client/src/i18n.js'

// Exercise the component selectors against the split 0.1.2 contract. Effects
// are deliberately not run here; real mounting and streaming are browser gates.
function renderSelectors(component, props) {
  const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher
  const previous = dispatcher.current
  dispatcher.current = {
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: current => ({ current }),
    useEffect() {},
    useLayoutEffect() {},
    useCallback: callback => callback,
  }
  const previousDocument = globalThis.document
  globalThis.document = { querySelector: () => ({}) }
  try { return component(props) } finally {
    dispatcher.current = previous
    globalThis.document = previousDocument
  }
}

test('RP displays one localized Host alert, clears on progress, and isolates session snapshots', () => {
  const previousSettings = getClientUiSettings()
  const failedTurn = { end: { data: { reason: { kind: 'error', error: { message: 'PRIVATE PROVIDER DETAIL' } } } } }
  const failedChat = {
    legacy: { nodes: [], partial: null },
    timeline: { turnOrder: [1], turns: new Map([[1, failedTurn]]) },
  }
  const normal = {
    running: false, blank: false, promptError: null, lastAgentError: null, openError: null,
    awaitingFirstTurn: false, pendingSubmissions: [],
  }
  const render = (session, chat = failedChat, sessionId = 'failed') => renderSelectors(MowanChatView, {
    sessionId, playClient: {}, playthrough: null,
    useSession: select => select(session), useChat: select => select(chat),
  }).props.children[0]
  try {
    setClientUiSettings({ locale: 'zh-CN' }, { announce: false })
    const chinese = render(normal)
    assert.equal(chinese.props.role, 'alert')
    assert.equal(chinese.props.children, '出现错误，请切换到「对话」视图查看更多信息。')
    assert.equal(JSON.stringify(chinese).includes('PRIVATE PROVIDER DETAIL'), false)
    setClientUiSettings({ locale: 'en' }, { announce: false })
    assert.equal(render(normal).props.children, 'An error occurred. Switch to the Chat view for more information.')
    for (const busy of [{ running: true }, { pendingSubmissions: [{}] }, { awaitingFirstTurn: true }]) {
      assert.equal(render({ ...normal, ...busy }), null)
    }
    // A send/stop/open error must remain visible even if the lifecycle still says busy.
    for (const error of [{ promptError: { op: 'send' } }, { promptError: { op: 'stop' } }, { openError: {} }, { lastAgentError: '' }]) {
      assert.equal(render({ ...normal, running: true, ...error }).props.role, 'alert')
    }
    const emptyChat = { ...failedChat, timeline: { turnOrder: [], turns: new Map() } }
    assert.equal(render(normal, emptyChat, 'other-session'), null)
    assert.equal(render(normal).props.role, 'alert') // returning to the failed session still explains its state
  } finally {
    setClientUiSettings(previousSettings, { announce: false })
  }
})

test('opening dock derives phase from the public Conversation function and split snapshots', () => {
  const conversation = { activeTargets: new Set() }
  const session = new Proxy({ sessionId: 's', blank: true }, {
    get(target, key) {
      assert.notEqual(key, 'composerPhase')
      return target[key]
    },
  })
  let calls = 0
  renderSelectors(PlaySessionDock, {
    session,
    useSessions: select => select({ byId: {} }),
    useConversation: select => select(conversation),
    conversationPhase(s, c) {
      assert.equal(s, session)
      assert.equal(c, conversation)
      calls += 1
      return 'blank'
    },
  })
  assert.equal(calls, 1)
})

for (const component of [MowanChatView, TavernTraceView]) {
  test(`${component.name} reads Chat data without asking Session for removed fields`, () => {
    const session = new Proxy({
      running: true, blank: false, promptError: null, lastAgentError: null, openError: null,
      awaitingFirstTurn: false, pendingSubmissions: [],
    }, {
      get(target, key) {
        assert.ok(key in target, `removed Session field: ${String(key)}`)
        return target[key]
      },
    })
    const nodes = [{ kind: 'user', seq: 8, content: [{ type: 'text', text: 'hello' }] }]
    const partial = { turn: 1, step: 1, blocks: [{ kind: 'text', text: 'partial reply' }] }
    const selected = []
    renderSelectors(component, {
      sessionId: 's', playClient: {}, playthrough: null,
      useSession: select => select(session),
      useChat: select => {
        const result = select({
          nodes: { get() {} }, legacy: { nodes, partial },
          timeline: { turnOrder: [], turns: new Map() },
        })
        selected.push(result)
        return result
      },
    })
    assert.ok(selected.length > 0)
    if (component === MowanChatView) {
      assert.ok(selected.includes(nodes))
      assert.ok(selected.includes(partial))
    } else assert.ok(selected.includes(8))
  })
}
