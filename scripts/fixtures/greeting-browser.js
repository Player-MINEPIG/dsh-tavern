import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Greeting, loadChatState } from '../../packages/client/src/play/chat.js'
import { RichText } from '../../packages/client/src/play/rich-text.js'
import { greetingDisplayFixture } from './greeting-display.js'

const results = []
const check = (name, condition) => results.push({ name, pass: Boolean(condition) })
function roots(element) {
  return [element, ...Array.from(element.querySelectorAll('*')).flatMap(child => child.shadowRoot ? roots(child.shadowRoot) : [])]
}
const find = (element, selector) => roots(element).flatMap(root => [...root.querySelectorAll(selector)])

async function run() {
  const f = greetingDisplayFixture()
  const host = document.createElement('main')
  document.body.append(host)
  const root = createRoot(host)
  const render = state => flushSync(() => root.render(h('div', null,
    h('section', { id: 'rp' }, h(Greeting, { greeting: state.greeting, busy: false, change() {} })),
    h('section', { id: 'dock' }, h(RichText, { text: state.greeting.text, className: 'dtv-play-opening-body' })),
  )))
  try {
    let state = await loadChatState(f.client, 'session', f.playthrough)
    render(state)
    for (const id of ['rp', 'dock']) {
      const target = host.querySelector(`#${id}`)
      const details = find(target, 'details')[0]
      const panel = find(target, '.greeting-status')[0]
      check(`${id}: greeting variable updates are collapsed by default`, details && !details.open && details.querySelector('summary')?.textContent === 'Variable updates')
      details?.querySelector('summary').click()
      check(`${id}: variable updates can be expanded`, details?.open && details.textContent.includes('replace'))
      check(`${id}: status panel and isolated styles render`, panel && getComputedStyle(panel).display === 'grid' && panel.getBoundingClientRect().height > 0)
    }
    const savedDetails = find(host.querySelector('#rp'), 'details')[0]
    render(state)
    check('unchanged greeting keeps expanded DOM', savedDetails.isConnected && savedDetails.open)
    f.selection.character.greetingIndex = 1
    state = await loadChatState(f.client, 'session', f.playthrough)
    render(state)
    check('alternate greeting replaces prior variables and retains panel', find(host, 'details').length === 0 && find(host, '.greeting-status').length === 2 && roots(host).some(item => item.textContent.includes('Alternate Guide')))

    // Optional local card copy stays outside the public fixture/repository.
    if (globalThis.__regexFixture?.character) {
      const external = globalThis.__regexFixture
      f.client.getCharacter = async () => ({ character: external.character })
      f.selection.characterCardId = external.character.id
      f.selection.character.greetingIndex = external.greetingIndex ?? 0
      f.playthrough.ext.pmpDshTavern.characterId = external.character.id
      state = await loadChatState(f.client, 'session', f.playthrough)
      render(state)
      check('local card greeting renders variable summary', find(host, 'summary').some(item => item.textContent.includes(external.summary)))
      check('local card greeting renders status panel', roots(host).some(item => item.textContent.includes(external.panelText)))
      check('local card scripts stay inert', !find(host, 'script').length && !find(host, 'iframe').length)
    }
  } finally {
    flushSync(() => root.unmount())
  }
}
run().catch(error => check(`fixture error: ${error.message}`, false)).finally(() => {
  const output = document.createElement('pre')
  output.id = 'results'
  output.textContent = JSON.stringify(results)
  document.body.append(output)
})
