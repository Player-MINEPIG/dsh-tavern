import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'

// Exercise the installed official serializer, with no credentials, Files store,
// network transport or provider-side generation. Synthetic SSE settles the call.
export async function withDeepSeekWire(root, run, { inHistory = true } = {}) {
  const require = createRequire(join(resolve(root), 'package.json'))
  const { DeepSeekAdapter, resolveAdapterOptions } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm-deepseek')).href)
  const options = resolveAdapterOptions({ baseURL: 'http://offline.invalid', models: [{ id: 'offline', ...(inHistory ? { systemPromptUpdate: 'in-history' } : {}) }] })
  const adapter = new DeepSeekAdapter({ options: () => options, resolveAuth: async () => ({ headers: {} }), resolveUserId: () => 'offline',
    resolveFiles: () => ({}), prepareExtensions: async () => ({ fields: {}, accept: async () => {} }) })
  const bodies = [], originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (url !== 'http://offline.invalid/v1/messages') throw new Error('Unexpected offline request')
    bodies.push(JSON.parse(init.body))
    const events = [
      { type: 'message_start', message: { id: 'offline', model: 'offline', usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ANSWER' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }, { type: 'message_stop' },
    ]
    return new Response(events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } })
  }
  try { return await run({ adapter, bodies, send: async messages => { for await (const _ of adapter.stream({ provider: 'offline', model: 'offline', messages })) {} return bodies.at(-1) } }) }
  finally { globalThis.fetch = originalFetch }
}
