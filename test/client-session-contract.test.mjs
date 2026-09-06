import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MowanChatView } from '../packages/client/src/play/chat.js'
import { TavernTraceView } from '../packages/tavern-trace/src/client.js'

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

for (const component of [MowanChatView, TavernTraceView]) {
  test(`${component.name} reads Chat data without asking Session for removed fields`, () => {
    const session = new Proxy({ running: true, blank: false }, {
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
        const result = select({ nodes: { get() {} }, legacy: { nodes, partial } })
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
