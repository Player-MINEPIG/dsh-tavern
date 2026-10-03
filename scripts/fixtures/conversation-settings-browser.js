import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ConversationSettingsPanel } from '../../packages/client/src/conversation-panel.js'
import { setClientUiSettings } from '../../packages/client/src/i18n.js'
import { BUBBLE_STYLES } from '../../packages/presentation/bubble-style.js'

const results = []
const check = (name, pass) => results.push({ name, pass: Boolean(pass) })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function run() {
  setClientUiSettings({ locale: 'en' })
  const host = document.createElement('section'); document.body.append(host)
  const root = createRoot(host)
  const updates = []
  const preference = { entries: [{ id: 'synthetic-preserved-preference', enabled: false }] }
  let settings = { textScale: 1, actionScale: 1, interactiveCards: true, scriptEnablement: preference, bubbleStyle: BUBBLE_STYLES[0] }
  const client = { getFile: async () => ({ content: '{"schemaVersion":1,"rules":[]}' }) }
  const mount = () => flushSync(() => root.render(h(ConversationSettingsPanel, {
    settings, client, close() {}, update(value) { updates.push(value) }, busy: false,
  })))
  mount(); await tick()
  const tabs = [...host.querySelectorAll('[role=tab]')]
  const panels = [...host.querySelectorAll('[role=tabpanel]')]
  const active = index => tabs.every((tab, i) => tab.getAttribute('aria-selected') === String(i === index) && tab.tabIndex === (i === index ? 0 : -1)) && panels.every((panel, i) => panel.hidden === (i !== index))
  check('tabs label and control their unique panels', tabs.every((tab, i) => tab.getAttribute('aria-controls') === panels[i].id && panels[i].getAttribute('aria-labelledby') === tab.id) && new Set(tabs.map(tab => tab.id)).size === 3)
  check('one initial active tab and panel', active(0))
  const key = async (index, key) => { await act(async () => { tabs[index].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); await tick() }) }
  tabs[0].focus()
  await key(0, 'ArrowLeft'); check('left wraps and moves focus to last tab', active(2) && document.activeElement === tabs[2])
  await key(2, 'ArrowRight'); check('right wraps and moves focus to first tab', active(0) && document.activeElement === tabs[0])
  await key(0, 'End'); check('End selects last tab', active(2) && document.activeElement === tabs[2])
  await key(2, 'Home'); check('Home selects first tab', active(0) && document.activeElement === tabs[0])
  const input = [...host.querySelectorAll('label')].find(el => el.textContent === 'Style name').querySelector('input')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Unsaved synthetic style')
    input.dispatchEvent(new Event('input', { bubbles: true })); await tick()
  })
  await act(async () => { tabs[1].click(); await tick(); tabs[2].click(); await tick() })
  settings = { ...settings, interactiveCards: false }
  mount(); await tick()
  await act(async () => { tabs[0].click(); await tick() })
  check('tab switching and unrelated settings updates preserve appearance draft', input.value === 'Unsaved synthetic style')
  const button = name => [...host.querySelectorAll('button')].find(el => el.textContent === name)
  await act(async () => { button('Apply and save').click(); await tick() })
  check('appearance save uses latest master value and preserves other settings', updates.at(-1)?.interactiveCards === false && updates.at(-1)?.scriptEnablement === preference && updates.at(-1)?.bubbleStyle.name === 'Unsaved synthetic style')
  const oldConfirm = window.confirm
  window.confirm = () => false
  await act(async () => { button('Restore conversation display defaults').click(); await tick() })
  check('canceling dirty appearance reset makes no update', updates.length === 1)
  window.confirm = () => true
  await act(async () => { button('Restore conversation display defaults').click(); await tick() })
  check('appearance reset preserves script settings and resets only display fields', updates.length === 2 && updates[1].interactiveCards === false && updates[1].scriptEnablement === preference && updates[1].bubbleStyle === undefined && updates[1].textScale === 1 && updates[1].actionScale === 1)
  window.confirm = oldConfirm
  flushSync(() => root.unmount())
}
run().catch(error => check(`unexpected: ${error.message}`, false)).finally(() => {
  const report = document.createElement('pre'); report.id = 'results'; report.textContent = JSON.stringify(results); document.body.append(report)
})
