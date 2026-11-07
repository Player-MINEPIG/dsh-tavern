import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { installIndependentAssembler } from './helpers/assembler-host.mjs'
import * as tavern from '../packages/tavern-loader/src/index.js'

const compat = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('stock AgentLoop mood judges an actual tool failure once across reworded retries, resolves it, and discards a late judgment', { skip: !compat, timeout: 15000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'tavern-mood-host-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const require = createRequire(join(resolve(compat), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve('@deepseek-ai/' + name)))
  const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm')
  const root = new Context(), judgments = [], errors = []
  let triggerTool = false, callNumber = 0, blocked
  try {
    for (const name of ['sessionController','workspaceController','directoryPickerController']) root.provide(name, {})
    await root.plugin(SystemPrompt, { personaPrefix: 'HOST' })
    for (const suffix of ['session','agent','session-projection','llm','tools','tool-executor-native','agent-loop']) {
      const module = await load('dsh-' + suffix)
      await root.plugin(module.default ?? module, suffix === 'agent-loop' ? { agents: [] } : {})
    }
    root.on('agent/error', e => errors.push(e.error))
    root.tools.register({ name: 'probe', description: 'A deliberately unavailable probe', parameters: { type: 'object', properties: {} },
      output: { schema: { type: 'string' }, render: (_, value) => [{ type:'text', text:value }] },
      execute: async () => { throw new Error('Probe offline') } })
    class Adapter extends llm.LlmAdapter {
      async *stream(req) {
        let text = 'Completed task'
        if (req.purpose === 'tavern-personality-mood') {
          const input = JSON.parse(req.messages[0].content[0].text)
          judgments.push(input)
          if (blocked) { blocked.entered(); await blocked.wait }
          text = JSON.stringify(input.eventKind === 'repair-or-clarification'
            ? { resolution: 'current', mood: null }
            : { mood: { feeling: 'concerned', intensity: 3, reason: 'The unavailable probe check could not complete.' } })
        } else if (triggerTool) {
          triggerTool = false
          const block = { type:'tool-call', id:'probe-'+(++callNumber), name:'probe', arguments:'{}' }
          yield { type:'block-start', index:0, blockType:'tool-call' }
          yield { type:'block-end', index:0, block }
          yield { type:'finish', reason:{ kind:'tool-calls' } }
          return
        }
        yield { type:'block-start', index:0, blockType:'text' }
        yield { type:'block-end', index:0, block:{ type:'text', text } }
        yield { type:'finish', reason:{ kind:'stop' } }
      }
    }
    root.llm.registerAdapter(['offline'], new Adapter())
    await installIndependentAssembler(root, dir)
    let store
    await root.plugin({ name:tavern.name, inject:tavern.inject, apply(ctx) { store=tavern.apply(ctx,{storageDir:dir}) } })
    const {agent} = await root.agents.create({sessionId:'mood-work',agentOptions:{provider:'offline',model:'test'}})
    const card = store.personalityStore.create({ name:'Carry' }), id = card.id
    store.personalityStore.select(agent.id,{characterCardId:id})
    store.personalityEvolution.mutate(id,'config',{operationId:'mood-isolation',expectedRevision:0,enabled:false})
    const moods = store.personalityMood
    moods.change(id,agent.id,{expectedRevision:0,automatic:true})
    const turn = async (text,fail=false) => {
      triggerTool = fail
      agent.followup(llm.createUserMessage({content:[{type:'text',text}],source:{kind:'user'}}))
      await agent.whenIdle()
      assert.deepEqual(errors,[])
    }
    const barrier = () => {
      let entered, release
      const ready = new Promise(r => { entered=r }), wait = new Promise(r => { release=r })
      blocked={entered,wait,release}
      return { ready, release:()=>{ release(); blocked=null } }
    }
    await turn('Read the headings.')
    await store.personalityMoodHost.idle()
    assert.equal(judgments.length,0)
    const first = barrier()
    await turn('Check the headings.',true)
    await first.ready
    await turn('Try checking once more.',true)
    first.release()
    await store.personalityMoodHost.idle()
    assert.equal(judgments.length,1)
    assert.equal(judgments[0].toolFailed,true)
    assert.equal(moods.read(id,agent.id).mood.source,'event')
    await turn('The unavailable probe issue is resolved.')
    await store.personalityMoodHost.idle()
    assert.equal(judgments.length,2)
    assert.equal(moods.read(id,agent.id).mood,null)
    const late = barrier()
    await turn('我有些担心这份承诺。')
    await late.ready
    const {revision} = moods.read(id,agent.id)
    moods.change(id,agent.id,{expectedRevision:revision,mood:{feeling:'calm',intensity:2,reason:'Manual choice'}})
    late.release()
    await store.personalityMoodHost.idle()
    assert.equal(moods.read(id,agent.id).mood.feeling,'calm')
    assert.equal(judgments.length,3)
    assert.equal(agent.session.snapshotEvents().filter(e => e.type==='tool/result' && e.data.message.isError).length,2)
  } finally { blocked?.release(); await root.fiber.dispose() }
})
