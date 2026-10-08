import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { TAVERN_HISTORY_FRAGMENT_PRESETS } from '../packages/history-policy/index.js'

const root = process.env.DSH_HISTORY_ASSEMBLER_ROOT

test('Tavern MVU preset is opt-in, removes only the selected assistant wrapper, and preserves human quotations', { skip: !root }, async () => {
  const { filterHistory, DEFAULT_HISTORY_POLICY } = await import(pathToFileURL(join(resolve(root), 'src/history-policy.js')))
  const text = 'RP before.\n<UpdateVariable>\n<Analysis>fixture</Analysis>\n<JSONPatch>[]</JSONPatch>\n</UpdateVariable>\nRP after.'
  const messages = [
    { id: 'u', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] },
    { id: 'a', role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text }] },
  ]
  const original = structuredClone(messages)
  const events = messages.map((message, seq) => ({ seq, type: `${message.role}/message`, data: message.role === 'user' ? message : { message } }))
  const fragments = TAVERN_HISTORY_FRAGMENT_PRESETS.map(preset => structuredClone(preset.rule))
  const policy = { ...structuredClone(DEFAULT_HISTORY_POLICY), enabled: true, fragments }
  assert.deepEqual(filterHistory({ messages, events, policy }).messages, messages, 'adding the example does not silently enable deletion')
  policy.fragments[0].enabled = true
  const result = filterHistory({ messages, events, policy })
  assert.deepEqual(result.messages[0], original[0])
  assert.equal(result.messages[1].content[0].text, 'RP before.\nRP after.')
  assert.deepEqual(messages, original)
  assert.deepEqual(result.audit.decisions[1].blocks[0].ranges[0].ruleIds, ['tavern-mvu-update'])
})
