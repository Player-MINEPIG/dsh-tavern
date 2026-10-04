import { json } from './value.js'

const select = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value ?? {}, key)).map(key => [key, value[key]]))

/** Detach only the durable facts MVU consumes. Trace/provider bodies stay in DSH. */
export function snapshotMvuSession(session) {
  const events = session.snapshotEvents(), header = json(select(session.header, ['id', 'version', 'createdAt', 'origin', 'parentSession', 'isSeeded']))
  return { id: session.id, header, inheritedEventCount: session.inheritedEventCount, events: events.map(event => {
    const result = json(select(event, ['seq', 'type'])), data = event.data ?? {}
    if (['turn/start', 'turn/end', 'user/message', 'assistant/message'].includes(event.type)) {
      result.data = json(select(data, ['turn', 'step', 'interrupted']))
      if (event.type === 'turn/end' && data.reason) result.data.reason = json(select(data.reason, ['kind']))
      if (event.type === 'user/message') {
        const message = data.message ?? data // Official V4 user/message payload is the message itself.
        if (message && typeof message === 'object') {
          result.data.message = message.source ? { source: json(select(message.source, ['kind'])) } : {}
          // Command gates consume only this turn's bounded text. Do not retain
          // media/trace bodies, truncate an operation block or exceed state budgets.
          let text = '', available = true
          for (const block of message.content ?? []) if (block.type === 'text') {
            if (typeof block.text !== 'string' || text.length + block.text.length + 1 > 64 * 1024) { available = false; break }
            text += (text ? '\n' : '') + block.text
          }
          if (available && text) result.data.message.content = [{ type: 'text', text }]
        }
        if (data.source) result.data.source = json(select(data.source, ['kind']))
      }
      if (event.type === 'assistant/message' && data.message) {
        const content = data.message.content ?? []
        result.data.message = { ...json(select(data.message, ['id'])), content: [{ type: 'text', text: content.filter(block => block.type === 'text').map(block => block.text).join('\n') }] }
        if (content.some(block => block.type === 'tool-call')) result.data.message.content.push({ type: 'tool-call' })
      }
    }
    return result
  }) }
}

// A variables object has the original 2 MiB/structure budget. Collections are
// bounded by the 32 MiB durable ledger, not by one variables object's budget.
export function cloneMvuReceipt(receipt) {
  const { variables, content, ...metadata } = receipt, result = json(metadata)
  if (Object.hasOwn(receipt, 'variables')) result.variables = json(variables)
  if (Object.hasOwn(receipt, 'content')) result.content = json(content)
  return result
}
export function cloneMvuVersion(version) {
  const { variables, result, ...metadata } = version, copy = json(metadata)
  if (Object.hasOwn(version, 'variables')) copy.variables = json(variables)
  if (Object.hasOwn(version, 'result')) copy.result = cloneMvuReceipt(result)
  return copy
}
export function cloneMvuCheckpoint(checkpoint) {
  const { variables, ...metadata } = checkpoint
  return { ...json(metadata), variables: json(variables) }
}
