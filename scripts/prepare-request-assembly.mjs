import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'

// Produces a separate, reviewable core build. Never edits an installed runtime.
const [sourceArg, outputArg] = process.argv.slice(2)
if (!sourceArg || !outputArg) throw new Error('Usage: node scripts/prepare-request-assembly.mjs <DSH 0.2.0-rc.2 source> <output>')
const source = resolve(sourceArg), output = resolve(outputArg)
if (source === output || source.startsWith(`${output}/`) || output.startsWith(`${source}/`)) throw new Error('Output must be separate from source')
const sourceDigests = { session: 'dcdb1b24e30ffe293398279441de3ff1172dc22312a2011a0637caade4e99850', 'agent-loop': 'c1b3c5edf5e393c6a47e16e380f00d020bdf322845debe3e168cf48314c28bd4' }
for (const name of ['session', 'agent-loop']) {
  const root = join(source, 'packages/core', name)
  if (JSON.parse(readFileSync(join(root, 'package.json'))).version !== '0.2.0-rc.2') throw new Error('Unsupported core version')
  const digest = createHash('sha256')
  for (const file of readdirSync(join(root, 'src'), { recursive: true }).filter(f => f.endsWith('.ts')).sort()) digest.update(`${file}\0`).update(readFileSync(join(root, 'src', file)))
  if (digest.digest('hex') !== sourceDigests[name]) throw new Error(`Source differs from pinned core: ${name}`)
  mkdirSync(join(output, name), { recursive: true })
  cpSync(join(root, 'src'), join(output, name, 'src'), { recursive: true })
}
function edit(name, from, to) {
  const file = join(output, name), text = readFileSync(file, 'utf8')
  if (text.split(from).length !== 2) throw new Error(`Source does not match pinned core: ${name}`)
  writeFileSync(file, text.replace(from, to))
}
edit('session/src/types.ts', '  AssistantMessage,', '  Message,\n  AssistantMessage,')
edit('session/src/types.ts', "export interface SessionEventMap {", `export interface SessionEventMap {
  /** Log-only request snapshot. Does not change native history or future requests. */
  'request/assembly': { turn: number; step: number; nativeHash: string; messages: Message[]; metadata: JsonValue }
`)
edit('session/src/index.ts', '      data: dataSnapshot,', "      data: dataSnapshot,\n      ...(type === 'request/assembly' ? { ignorable: true as const } : {}),")
edit('agent-loop/src/index.ts', 'export class AgentLoop extends Service implements AgentFactory {', 'export class AgentLoop extends Service implements AgentFactory {\n  /** Supported pre-freeze assembly protocol. */\n  readonly requestAssemblyVersion = 1\n')
edit('agent-loop/src/agent.ts', 'const request = this.buildRequest(', 'const request = await this.buildRequest(')
edit('agent-loop/src/agent.ts', '  private buildRequest(', '  private async buildRequest(')
edit('agent-loop/src/agent.ts', '  ): GenerateOptions {', '  ): Promise<GenerateOptions> {')
edit('agent-loop/src/agent.ts', "import { executeToolCalls } from './tool-calls.ts'", "import { executeToolCalls } from './tool-calls.ts'\nimport { createHash } from 'node:crypto'\nimport type {} from './request-assembly.ts'")
edit('agent-loop/src/agent.ts', '    const boundaryMessages = session.deriveMessages()', `    const nativeMessages = session.deriveMessages()
    const assembled = await this.dispatch.waterfall('agent/assemble-request', {
      ...position, messages: nativeMessages, tools: header.tools ?? [], config: header.config, signal,
    }, async () => ({ messages: nativeMessages, metadata: null }))
    signal.throwIfAborted()
    // Store a detached snapshot before dispatch, outside the model-visible surface.
    // Snapshotting the complete result keeps random macros and removed plugins replayable.
    const nativeHash = createHash('sha256').update(JSON.stringify(nativeMessages)).digest('hex')
    const recorded = session.append('request/assembly', { ...position, ...assembled, nativeHash })
    const boundaryMessages = [...recorded.data.messages]`)
writeFileSync(join(output, 'agent-loop/src/request-assembly.ts'), `/** Pre-freeze request composition, independent of provider serialization. */
import type { Scoped } from '@deepseek-ai/dsh-scope'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Message, ToolSchema, LlmCallConfig } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
export interface RequestAssembly { messages: Message[]; metadata: JsonValue }
declare module '@deepseek-ai/cordis' {
  interface Events {
    'agent/assemble-request'(this: Scoped<Agent>, payload: { agent: Agent; turn: number; step: number; messages: Message[]; tools: ToolSchema[]; config: LlmCallConfig; signal: AbortSignal }, next: () => Promise<RequestAssembly>): Promise<RequestAssembly>
  }
}
`)
edit('agent-loop/src/invariant.ts', "import type { Context } from '@deepseek-ai/cordis'", "import type { Context } from '@deepseek-ai/cordis'\nimport { createHash } from 'node:crypto'")
edit('agent-loop/src/invariant.ts', '    const expected = session.deriveMessages()', `    const last = events.findLast(event => event.type === 'request/assembly')
    const step = events.findLast(event => event.type === 'step/start')
    if (!last || last.seq < step!.seq || last.data.turn !== step!.data.turn || last.data.step !== step!.data.step) return fail('request assembly must match the current step')
    const nativeHash = createHash('sha256').update(JSON.stringify(session.deriveMessages())).digest('hex')
    if (last.data.nativeHash !== nativeHash) return fail('native surface changed after request assembly')
    const expected = last.data.messages`)
for (const [name, entry] of [['session', 'index'], ['session', 'invariant'], ['agent-loop', 'index'], ['agent-loop', 'invariant']]) {
  await build({ entryPoints: [join(output, name, 'src', `${entry}.ts`)], outfile: join(output, name, 'lib', `${entry}.js`), bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'es2024', sourcemap: true,
    // Cordis publishes this const enum only in declarations; values match the pinned source.
    plugins: [{ name: 'pinned-cordis-const-enum', setup(builder) {
      builder.onLoad({ filter: /agent-loop\/src\/index\.ts$/ }, args => ({ loader: 'ts', contents: readFileSync(args.path, 'utf8').replace('Context, FiberState, Service', 'Context, Service').replaceAll('FiberState.UNLOADING', '5').replaceAll('FiberState.DISPOSED', '4').replaceAll('FiberState.FAILED', '3') }))
    } }],
  })
}
writeFileSync(join(output, 'receipt.json'), JSON.stringify({ sourceVersion: '0.2.0-rc.2', sourceDigests, requestAssemblyVersion: 1, packages: ['dsh-session', 'dsh-agent-loop'] }, null, 2))
console.log(`Prepared request assembly core at ${output}`)
