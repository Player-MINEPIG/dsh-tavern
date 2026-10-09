import test from 'node:test'
import assert from 'node:assert/strict'
import {parseHTML} from 'linkedom'
import {applyCardUserAliases} from '../packages/client/src/play/display-name-macros.js'
import { applyDisplayNameMacros } from '../packages/client/src/play/chat-model.js'
import { applyTurnDisplayRegex, loadChatState } from '../packages/client/src/play/chat.js'

test('prose user aliases use the supplied current name alongside existing name macros', () => {
  const source = 'Hello <user>, <USER> and {{user}}; {{char}} is waiting.'
  assert.equal(applyDisplayNameMacros(source, { user: 'Reader', character: 'Guide' }), 'Hello Reader, Reader and Reader; Guide is waiting.')
  assert.equal(applyDisplayNameMacros(source, { user: 'Next', character: 'Guide' }), 'Hello Next, Next and Next; Guide is waiting.')
  assert.equal(applyDisplayNameMacros('<user>', { user: '' }), 'User')
  assert.equal(source, 'Hello <user>, <USER> and {{user}}; {{char}} is waiting.')
})

test('angle aliases preserve code, escaped literals, attributes and role wrappers', () => {
  for (const literal of [
    '`<user>`', '``before `<user>` after``',
    '```text\n<user>\n```', '~~~\n<user>\n~~~', '```\n<user>',
    '    <user>\n', '\t<user>\n', '\\<user>',
    '<!-- <user> -->', '<span title="<user>">literal</span>',
    '<code><user></code>', '<pre>literal <user></pre>',
    '<script>const text="<user>"</script>', '<style>/* <user> */</style>',
    '<html><body><user></body></html>', '<textarea><user></textarea>',
    '<user>literal</user>', '<USER role="user">literal <user>nested</user></USER>',
    '<user />', '<user name="literal">text</user>',
  ]) assert.equal(applyDisplayNameMacros(literal, { user: 'Reader' }), literal, literal)
  assert.equal(applyDisplayNameMacros('Hi <user>. <user>role data</user> Bye <user>.', { user: 'Reader' }), 'Hi Reader. <user>role data</user> Bye Reader.')
  assert.equal(applyDisplayNameMacros('<p>Hello <user>.</p>', { user: 'Reader' }), '<p>Hello Reader.</p>')
})

test('inserted names are literal and are not recursively interpreted as another placeholder', () => {
  const name = '<user> & {{user}}'
  assert.equal(applyDisplayNameMacros('<user> / {{user}}', { user: name }), '&lt;user&gt; &amp; {{user}} / <user> & {{user}}')
})

test('live display expands completed aliases and keeps existing manual display overrides frozen', () => {
  const display = { rules: [], bindings: {}, macros: { user: 'Reader' } }
  const source = { id: 'live', userText: '<user> asks', assistantText: 'Hello <user>' }
  assert.equal(applyTurnDisplayRegex(source, display).assistantText, 'Hello Reader')
  assert.equal(applyTurnDisplayRegex({ ...source, assistantText: 'Hello <user' }, display).assistantText, 'Hello <user')
  assert.equal(source.assistantText, 'Hello <user>')
  assert.equal(applyTurnDisplayRegex({ ...source, displayOverridden: true }, display).assistantText, 'Hello <user>')
})

test('reloading the same historical conversation follows the current user without name snapshots', async () => {
  let userName = 'Reader', timeline = { nodes: [] }
  const source = {
    incompleteTurn: false,
    messages: [
      { id: 'u', role: 'user', seq: 1, content: [], text: '<user> asks' },
      { id: 'a', role: 'assistant', seq: 3, content: [], text: 'Hello <user> and {{user}}' },
    ],
  }
  const original = structuredClone(source)
  const client = {
    getMessages: async () => source,
    getTimeline: async () => timeline,
    putTimeline: async (_playthrough, next) => { timeline = next; return next },
    getCharacterSelection: async () => ({ selection: { characterCardId: 'card', character: { greetingIndex: 0 } } }),
    getCharacter: async () => ({ character: { id: 'card', name: 'Guide', data: { firstMessage: 'Welcome <user>.' } } }),
    getUserSelection: async () => ({ user: { name: userName } }),
  }
  const playthrough = { path: 'timeline.json', ext: { pmpDshTavern: { rootSessionId: 'session', characterId: 'card' } } }
  const first = await loadChatState(client, 'session', playthrough)
  const persisted = structuredClone(timeline)
  assert.equal(first.turns[0].assistantText, 'Hello Reader and Reader')
  assert.equal(first.greeting.text, 'Welcome Reader.')
  userName = 'Next'
  const second = await loadChatState(client, 'session', playthrough)
  assert.equal(second.turns[0].userText, 'Next asks')
  assert.equal(second.turns[0].assistantText, 'Hello Next and Next')
  assert.equal(second.greeting.text, 'Welcome Next.')
  assert.deepEqual(source, original)
  assert.deepEqual(timeline, persisted)
  assert.doesNotMatch(JSON.stringify(timeline), /Reader|Next/)
})


test('MVU status text expands on the display copy without changing variables, markup or controls', () => {
  const variables = {stat_data:{note:'Invite <user> to the meeting.'}}
  const {document} = parseHTML('<html><body></body></html>')
  const original = document.createElement('div')
  original.innerHTML = '<p id="note" data-dtv-node="2" title="<user>"></p><pre>&lt;user&gt;</pre><code>&lt;user&gt;</code><textarea>&lt;user&gt;</textarea><select><option>&lt;user&gt;</option></select><input value="<user>"><style>/* <user> */</style><p contenteditable="true">&lt;user&gt;</p>'
  original.querySelector('#note').textContent = variables.stat_data.note
  const html = original.innerHTML, display = original.cloneNode(true)
  applyCardUserAliases(display, 'Reader <img src=x> & {{user}}')
  assert.equal(display.querySelector('#note').textContent, 'Invite Reader <img src=x> & {{user}} to the meeting.')
  assert.equal(display.querySelector('#note').getAttribute('title'), '<user>')
  assert.equal(display.querySelector('#note').getAttribute('data-dtv-node'), '2')
  assert.equal(display.querySelector('img'), null, 'names are text, not HTML')
  for (const selector of ['pre','code','textarea','option','[contenteditable]']) assert.equal(display.querySelector(selector).textContent, original.querySelector(selector).textContent)
  assert.equal(display.querySelector('input').getAttribute('value'), '<user>')
  assert.equal(display.querySelector('style').textContent, '/* <user> */')
  assert.equal(original.innerHTML, html, 'Worker/source DOM is untouched')
  assert.equal(variables.stat_data.note, 'Invite <user> to the meeting.')
  const next = original.cloneNode(true)
  applyCardUserAliases(next, 'Next')
  assert.equal(next.querySelector('#note').textContent, 'Invite Next to the meeting.')
})

test('dynamic display aliases keep literal code and role wrappers and do not recursively expand names', () => {
  const {document} = parseHTML('<html><body></body></html>')
  const root = document.createElement('div')
  root.textContent = 'Hi <user>. <user>role data</user> `literal <user>`'
  applyCardUserAliases(root, '<user> & Reader')
  assert.equal(root.textContent, 'Hi <user> & Reader. <user>role data</user> `literal <user>`')
})
