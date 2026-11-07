import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { CharacterStore } from '../packages/character/src/store.js'
import { assembleRequest, configurePosition, positionRows } from 'dsh-prompt-assembler'
import { BUILTINS as CORE_BUILTINS, createDefaultRegistry, NATIVE_BUILTINS } from 'dsh-prompt-assembler/adapters/tavern'
import { reconcilePersonalityPreview, registerPersonalitySource, withPersonalityRule, orderPersonalityDynamicTail } from '../packages/tavern-loader/src/personality-source.js'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { TavernProfileLoader } from '../packages/tavern-loader/src/profile-loader.js'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { installIndependentAssembler } from './helpers/assembler-host.mjs'
import { createNativeRequestReader } from '../packages/tavern-trace/src/native-request-reader.js'
import { recordedPersonalityLoadState } from '../packages/tavern-trace/src/request-view.js'

const input = { spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Aster', description: '{{char}} works with {{user}}', personality: 'Economical with words', scenario: 'Working together', mes_example: '{{user}}: Question? {{char}}: Evidence first.', first_mes: 'GREETING', alternate_greetings: ['ALT GREETING'], creator_notes: 'EDITOR ONLY', system_prompt: 'GIVE STEPS', post_history_instructions: 'CHECK CLAIMS' } }
const cardFields = ['name', 'system_prompt', 'description', 'personality', 'scenario', 'mes_example', 'first_mes', 'post_history_instructions']
function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(), 'personality-assembly-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}
test('a per-session personality supplies independent static CCv2 fields and selection flags', t => {
  const cards = new CharacterStore(temporary(t)), card = cards.import(JSON.stringify(input))
  cards.select('A', { characterCardId: card.id, character: { greetingIndex: 1, preferCharacterPostHistory: false } })
  const runtime = new TavernProfileLoader({ presetStore: {}, personalityStore: cards,
    selections: { get: () => ({ presetId: null, worldBookIds: [], character: {} }) } })
  assert.deepEqual(runtime.compile({ sessionId: 'B' }).personalitySections, [])
  const result = runtime.compile({ sessionId: 'A' })
  const sections = result.personalitySections
  assert.equal(result.audit.sessionSelection.personalityCardId, card.id)
  assert.ok(sections.some(s => s.text.includes('Aster works with User')))
  assert.ok(sections.some(s => s.sources[0].field === 'alternate_greetings/0' && s.text.includes('ALT GREETING')))
  assert.ok(sections.some(s => s.sources[0].field === 'system_prompt' && s.text.includes('GIVE STEPS')))
  assert.ok(!sections.some(s => /CHECK CLAIMS|EDITOR ONLY/.test(s.text)))
})

test('effective self revisions stay literal while mood expression keeps raw provenance off wire', t => {
  const cards = new CharacterStore(temporary(t)), card = cards.import(JSON.stringify(input))
  cards.select('work', { characterCardId: card.id })
  let active = { revision: 3, after: 'I can change my mind', behavior: 'Say {{user}} verbatim.', boundary: 'While reviewing evidence' }
  let mood = { feeling: 'concerned', intensity: 2, reason: '{{do_not_expand}}' }
  const runtime = new TavernProfileLoader({ presetStore: {}, personalityStore: cards,
    personalityEvolution: { current(id) { assert.equal(id, card.id); return active } },
    personalityMood: { read(id, sessionId) { assert.equal(id, card.id); assert.equal(sessionId, 'work'); return { revision: 5, mood } } },
    selections: { get: () => ({ presetId: null, worldBookIds: [], character: {} }) } })
  const frozen = runtime.compile({ sessionId: 'work' }).personalitySections
  assert.ok(frozen.some(s => s.sources[0].field === 'evolution/behavior' && s.text.includes('{{user}}') && s.interpolate === false && s.sources[0].resourceRevision === 3))
  assert.ok(frozen.some(s => s.sources[0].field === 'mood' && !s.text.includes('{{do_not_expand}}') && s.sources[0].text.includes('{{do_not_expand}}') && s.sources[0].resourceRevision === 5))
  active = null; mood = null
  assert.deepEqual(runtime.compile({ sessionId: 'other' }).personalitySections, [])
  assert.ok(!runtime.compile({ sessionId: 'work' }).personalitySections.some(s => /my mind|do_not_expand/.test(s.text)))
  assert.ok(frozen.some(s => s.text.includes('I can change my mind')))
})

test('Assembler resource positions resolve personality literals independently of RP macros and disappear on unload', t => {
  const cards = new PersonalityStore(temporary(t))
  const card = cards.import(JSON.stringify(input))
  cards.select('work', { characterCardId: card.id })
  const registry = createDefaultRegistry()
  const unregister = registerPersonalitySource(registry, cards)
  assert.equal(registry.list({ sessionId:'unbound' }).find(source => source.id === 'tavern.personality').moduleAvailable, false)
  const runtime = new TavernProfileLoader({ presetStore: {}, personalityStore: cards,
    personalityMood: { read: () => ({ revision:1, mood:{ feeling:'curious', intensity:3, reason:'Keep {{description}} literal' } }) },
    selections: { get:() => ({ presetId:null, worldBookIds:[], character:{} }) } })
  const {assemblyInput} = runtime.compile({sessionId:'work'})
  const assets = { ...assemblyInput, character:{id:'RP',data:{name:'RP',description:'RP description'}} }
  for (const preset of [NATIVE_BUILTINS[0], CORE_BUILTINS[0]]) {
    const result = assembleRequest({ registry, assets, sessionId:'work', preset:withPersonalityRule(preset), preview:true })
    const nodes = result.nodes.filter(node => node.module === 'tavern.personality')
    const mood = nodes.find(node => node.positionId === 'mood')
    assert.ok(!mood.text.includes('Keep {{description}} literal'))
    assert.ok(assets.personalitySections.find(s => s.sources[0].field === 'mood').sources[0].text.includes('Keep {{description}} literal'))
    assert.ok(mood.text.includes('engaged and exploratory'))
    assert.equal(nodes.find(node => node.source.field === 'personality').name, '人格卡 · 性格 / Personality traits')
    assert.equal(nodes.find(node => node.source.field === 'description').name, '人格卡 · 描述 / Personality description')
    assert.ok(nodes.every(node => node.name.startsWith('人格卡 · ')))
    assert.ok(result.nodes.some(node => node.module === 'character' && node.text === 'RP description'))
  }
  unregister()
  assert.ok(!registry.list().some(source => source.id === 'tavern.personality'))
})

test('personality field positions preserve default order, selected openings and legacy whole-card controls', t => {
  const cards = new PersonalityStore(temporary(t)), card = cards.import(JSON.stringify(input))
  cards.select('work', { characterCardId: card.id, character: { greetingIndex: 1 } })
  const registry = createDefaultRegistry()
  registerPersonalitySource(registry, cards)
  registry.register({ id: 'external', pluginId: 'external', name: 'External source',
    resolve: () => ({ blocks: [{ type: 'text', id: 'external', text: 'EXTERNAL', role: 'system' }] }) })
  const runtime = new TavernProfileLoader({ presetStore: {}, personalityStore: cards,
    personalityEvolution: { current: () => ({ revision: 1, after: 'EVOLVED' }) },
    personalityMood: { read: () => ({ revision: 1, mood: { feeling: 'curious', intensity: 3, reason: 'MOOD' } }) },
    selections: { get: () => ({ presetId: null, worldBookIds: [], character: {} }) } })
  const { assemblyInput: assets } = runtime.compile({ sessionId: 'work' })
  for (const builtin of [NATIVE_BUILTINS[0], CORE_BUILTINS[0]]) {
    const preset = withPersonalityRule(builtin), sources = registry.list({ sessionId: 'work' })
    const assemble = candidate => assembleRequest({ registry, assets, sessionId: 'work', preset: candidate, preview: true, afterAssembly: orderPersonalityDynamicTail })
    const nodes = candidate => assemble(candidate).nodes.filter(node => node.module === 'tavern.personality')
    const baseline = nodes(preset)
    assert.deepEqual(baseline.map(node => node.source.field), [...cardFields.map(field => field === 'first_mes' ? 'alternate_greetings/0' : field), 'evolution/after', 'mood'])
    assert.deepEqual(baseline.map(node => node.positionId), [...cardFields, 'evolution', 'mood'])
    assert.deepEqual(baseline.map(node => node.text), assets.personalitySections.map(section => section.text))
    const update = (candidate, field, patch, before) => configurePosition(candidate, sources, `tavern.personality#${field}`, patch, before)
    const fieldOff = update(preset, 'description', { enabled: false })
    assert.ok(!nodes(fieldOff).some(node => node.source.field === 'description'))
    assert.deepEqual(nodes(fieldOff).map(node => node.positionId), [...cardFields.filter(field => field !== 'description'), 'evolution', 'mood'])
    const movedField = update(preset, 'personality', {}, 'tavern.personality#name')
    assert.deepEqual(nodes(movedField).slice(0, 2).map(node => node.source.field), ['personality', 'name'])
    // A saved old card row has no fine positions. Editing any other row writes
    // every new descriptor back; the old whole-card switch must still win.
    const legacy = { ...preset, layout: { version: 1, source: 'preset-slots', identity: 'preserve', fallback: 'error', overrides: [],
      priority: ['preset', 'resource', 'default'], positions: [{ sourceId: 'tavern.personality', positionId: 'card', enabled: false, placement: 'source' }] } }
    const unrelatedEdit = update(legacy, 'mood', { enabled: false })
    assert.deepEqual(nodes(unrelatedEdit).map(node => node.source.field), ['evolution/after'])
    const restore = update(unrelatedEdit, 'card', { enabled: true })
    assert.equal(nodes(restore).filter(node => cardFields.includes(node.positionId)).length, cardFields.length)
    // The old group remains a usable placement anchor, while individual
    // fields can be disabled or moved out of its inherited location.
    const group = update(preset, 'card', {}, 'tavern.personality#mood')
    assert.deepEqual(nodes(group).filter(node => node.positionId === 'card').map(node => node.text), baseline.slice(0, cardFields.length).map(node => node.text))
    const mixed = update(update(group, 'description', { enabled: false }), 'personality', {}, 'tavern.personality#card')
    const mixedNodes = nodes(mixed)
    assert.ok(!mixedNodes.some(node => node.source.field === 'description'))
    assert.equal(mixedNodes.find(node => node.source.field === 'personality').positionId, 'personality')
    assert.ok(mixedNodes.findIndex(node => node.source.field === 'personality') < mixedNodes.findIndex(node => node.positionId === 'card'))
    assert.equal(mixedNodes.filter(node => node.positionId === 'card').length, cardFields.length - 2)
    const anchored = update(preset, 'mood', {}, 'tavern.personality#card')
    const anchoredNodes = nodes(anchored)
    assert.equal(anchoredNodes[0].positionId, 'mood')
    assert.equal(anchoredNodes.filter(node => node.positionId === 'card').length, cardFields.length)
    assert.ok(!assemble(anchored).diagnostics.some(row => row.code === 'POSITION_SOURCE_MISSING'))
    for (const side of ['before', 'after']) {
      const withExternal = configurePosition(group, sources, 'external#content', { enabled: true }, 'tavern.personality#description')
      const strict = { ...withExternal, layout: { ...withExternal.layout, source: 'manual', fallback: 'error', positions: withExternal.layout.positions.map(row => row.sourceId === 'external'
        ? { ...row, anchor: { sourceId: 'tavern.personality', positionId: 'description', side } } : row) } }
      const result = assemble(strict), description = result.nodes.findIndex(node => node.source.module === 'tavern.personality' && node.source.field === 'description')
      const external = result.nodes.findIndex(node => node.source.module === 'external')
      assert.equal(external - description, side === 'before' ? -1 : 1)
      assert.equal(result.nodes[description].positionId, 'description')
      assert.ok(!result.diagnostics.some(row => ['POSITION_SOURCE_MISSING', 'POSITION_ANCHOR_MISSING'].includes(row.code)))
    }
    const absent = { ...preset, rules: preset.rules.filter(rule => rule.kind !== 'tavern.personality') }
    const enabledField = update(absent, 'personality', { enabled: true })
    assert.equal(enabledField.rules.find(rule => rule.kind === 'tavern.personality').enabled, true)
    assert.equal(nodes(enabledField).length, 0, 'the generated disabled master switch still controls card fields')
    assert.deepEqual(nodes(update(enabledField, 'card', { enabled: true })).map(node => node.source.field), ['personality'])
    const disabled = { ...preset, rules: preset.rules.map(rule => rule.kind === 'tavern.personality' ? { ...rule, enabled: false } : rule) }
    for (const [candidate, preview, expected] of [[disabled, false, true], [disabled, true, false], [absent, false, false], [preset, false, false]]) {
      const result = assembleRequest({ registry, assets, sessionId: 'work', preset: candidate, preview, afterAssembly: reconcilePersonalityPreview })
      assert.equal(result.diagnostics.some(row => row.code === 'TAVERN_PERSONALITY_POLICY_DISABLED'), expected)
    }
    const enabledFromDisabled = update(disabled, 'personality', { enabled: true })
    assert.equal(nodes(enabledFromDisabled).length, 0)
    assert.deepEqual(nodes(update(enabledFromDisabled, 'card', { enabled: true })).map(node => node.source.field), ['personality'])
  }
})

test('a read-only preview never pins growth; live snapshots refresh at successful compaction, rollback or rebinding', t => {
  const cards = new PersonalityStore(temporary(t)), card = cards.import(JSON.stringify(input))
  const session = { id: 'work', header: {}, deriveMessages: () => [] }, agent = { id: session.id, session }
  cards.select(session.id, { characterCardId: card.id })
  let after = 'initial', generation = 0
  const state = { config: { refreshMode: 'session-compaction' }, get generation() { return generation } }
  const runtime = new TavernProfileLoader({ presetStore: {}, personalityStore: cards,
    personalityEvolution: { current: () => after && { after, revision: 1 }, record: () => state }, sessionFor: () => session,
    selections: { get: () => ({ presetId: null, worldBookIds: [], character: {} }), ensureAgent() { return this.get() } } })
  const text = result => result.personalitySections.find(p => p.sources[0].field === 'evolution/after')?.text
  const assemble = () => text(runtime.forAssembleContext({ agent }))
  const preview = () => text(runtime.forAssembleContext({ agent, tavernAssemblyPreview: true, dshAssemblerRaw: true }))
  assert.match(preview(), /initial/)
  after = 'first live version'
  assert.match(assemble(), /first live version/)
  after = 'learned later'
  assert.match(preview(), /first live version/)
  assert.match(text(runtime.compile({ sessionId: 'work' })), /first live version/)
  runtime.observeCompaction(session, { type: 'compaction/end', data: { error: 'interrupted' } })
  assert.match(assemble(), /first live version/)
  runtime.observeCompaction(session, { type: 'compaction/end', data: {} })
  assert.match(assemble(), /learned later/)
  cards.select(session.id, null)
  cards.select(session.id, { characterCardId: card.id })
  after = 'reselected'
  assert.match(assemble(), /reselected/)
  after = null
  generation++
  assert.equal(assemble(), undefined)
})

test('static personality fields get their share of the legacy profile budget before ranked lore', t => {
  const cards = new CharacterStore(temporary(t)), card = cards.import(JSON.stringify({ ...input, data: { name: 'Short', personality: 'precise' } }))
  cards.select('work', { characterCardId: card.id })
  const runtime = new TavernProfileLoader({ presetStore: {}, personalityStore: cards, maxProfileBytes: 140,
    selections: { get: () => ({ presetId: null, worldBookIds: [], character: {} }) } })
  runtime.registerWorldBookAdapter({ resolve: () => ({ loreEntries: [
    { id: 'small', content: 'x'.repeat(45) }, { id: 'large', content: 'y'.repeat(70) },
  ] }) })
  const result = runtime.compile({ sessionId: 'work' })
  assert.ok(Buffer.byteLength(result.systemText) <= 140)
  assert.match(result.systemText, /precise/)
  assert.deepEqual(result.activeLoreEntries, ['small'])
})

const compat = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('stock DSH sends one personality with native instructions and records its fields before and after a policy change', { skip: !compat, timeout: 30000 }, async t => {
  const require = createRequire(join(resolve(compat), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve('@deepseek-ai/' + name)))
  const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm')
  const root = new Context(), directory = temporary(t), requests = [], errors = []
  try {
    for (const name of ['sessionController','workspaceController','directoryPickerController']) root.provide(name,{})
    await root.plugin(SystemPrompt, { personaPrefix: 'HOST BASE' })
    for (const suffix of ['session','agent','session-projection','llm','tools','tool-executor-native','agent-loop']) {
      const module = await load('dsh-' + suffix)
      await root.plugin(module.default ?? module, suffix === 'agent-loop' ? { agents: [] } : {})
    }
    root.on('agent/error', event => errors.push(event.error))
    let revisedAgain = false
    class Adapter extends llm.LlmAdapter {
      async *stream(request) {
        let text = 'ANSWER'
        if (request.purpose === 'tavern-personality-evolution') {
          text = JSON.stringify({ change: requests.length === 1 || revisedAgain ? {
            before:'I valued quick answers', after: revisedAgain ? 'I distinguish observed and inferred facts' : 'I value verifiable answers', behavior:'I check before I claim', boundary:'When a claim is testable', reason:'A counterexample disproved the quick answer'
          } : null, basis: { kind: 'self-understanding', supports: [{ index: 1, quote: JSON.parse(request.messages[0].content[0].text).evidence.users[0].slice(0, 80) }], counterevidence: 'No contrary evidence was supplied.' } })
          revisedAgain = false
        } else if (request.purpose === 'compaction') {
          text = 'Checkpoint.'
        } else {
          requests.push(request.messages.filter(m => m.role === 'system').at(-1).content.map(b => b.text ?? '').join(''))
        }
        yield { type:'block-start', index:0, blockType:'text' }
        yield { type:'block-end', index:0, block:{ type:'text',text } }
        yield { type:'finish', reason:{ kind:'stop' } }
      }
    }
    root.llm.registerAdapter(['offline'],new Adapter())
    await installIndependentAssembler(root,directory)
    let store
    await root.plugin({ name:tavern.name, inject:tavern.inject, apply(ctx) { store = tavern.apply(ctx,{storageDir:directory}) } })
    const {agent} = await root.agents.create({sessionId:'work',meta:{cwd:directory},agentOptions:{provider:'offline',model:'test'}})
    const cards = store.personalityStore, card = cards.import(JSON.stringify(input))
    store.personalityEvolution.mutate(card.id, 'config', { operationId: 'immediate-assessment-test', expectedRevision: 0, enabled: true, assessmentInterval: 1 })
    cards.select(agent.id, {characterCardId:card.id})
    async function turn(current = agent, prompt = 'A counterexample disproved the quick answer.') {
      current.followup(llm.createUserMessage({content:[{type:'text',text:prompt}], source:{kind:'user'}}))
      await current.whenIdle()
      assert.deepEqual(errors,[])
    }
    await turn()
    await store.personalityEvolutionHost.idle()
    assert.equal(store.personalityEvolution.current(card.id)?.after, 'I value verifiable answers')
    store.personalityMood.change(card.id, agent.id, { expectedRevision: 0, mood: { feeling: 'curious', intensity: 2, reason: 'New counterexample' } })
    const face = root.get('dshPromptAssembler')
    face.store.apply(agent.id,'builtin-native-slots')
    await turn()
    for (const [index, sys] of requests.entries()) {
      assert.equal(sys.split('Economical with words').length,2)
      assert.ok(sys.includes('Aster works with User'))
      assert.ok(sys.includes('HOST BASE'))
      assert.ok(sys.includes('CHECK CLAIMS'))
      assert.equal(sys.includes('GREETING'),index === 0)
      assert.equal(sys.includes('I value verifiable answers'),index === 1)
      assert.equal(sys.includes('engaged and exploratory'),index === 1)
      const summary = store.assemblyStore.list(agent.id)[index], trace = store.assemblyStore.get(agent.id,summary.id)
      assert.equal(trace.delivery.assemblyVerified,true)
      assert.ok(trace.sections.some(s => s.sources?.some(source => source.kind === 'personality' && source.field === 'description' && source.resourceId === card.id && source.resourceRevision)))
      if (index === 1) {
        const recorded = trace.nativeSourceRefs.find(ref => ref.source?.module === 'tavern.personality' && ref.source?.field === 'description')
        assert.equal(recorded?.name, '人格卡 · 描述 / Personality description')
        assert.equal(recorded.source.resourceId, card.id)
      }
    }
    assert.equal(requests.length,2)
    const fresh = (await root.agents.create({sessionId:'another-workspace',agentOptions:{provider:'offline',model:'test'}})).agent
    cards.select(fresh.id, {characterCardId:card.id})
    await turn(fresh)
    assert.ok(requests.at(-1).includes('I value verifiable answers'), 'a new session can use the committed personality without the original conversation')
    assert.ok(requests.at(-1).includes('engaged and exploratory'), 'manual mood travels with the personality')
    await store.personalityEvolutionHost.idle()
    const ledger = store.personalityEvolution
    ledger.mutate(card.id, 'config', { enabled: true, refreshMode: 'session-compaction', expectedRevision: ledger.view(card.id).revision, operationId: 'freeze' })
    revisedAgain = true
    await turn(agent, 'Evidence '.repeat(500))
    await store.personalityEvolutionHost.idle()
    assert.equal(ledger.current(card.id).after, 'I distinguish observed and inferred facts')
    await turn()
    assert.ok(requests.at(-1).includes('I value verifiable answers'), 'active session keeps its previous snapshot')
    await root.plugin((await load('dsh-token-meter')).default)
    await root.plugin((await load('dsh-compaction-basic')).default, { auto: false })
    const compact = await root.compaction.compactNow(agent,new AbortController().signal)
    assert.ok(compact, 'public DSH compaction completed')
    await turn()
    assert.ok(requests.at(-1).includes('I distinguish observed and inferred facts'), 'real compaction end admits the newer revision')
    const stablePrefix = text => text.split(/Current self-understanding|Current mood/)[0]
    assert.equal(stablePrefix(requests[1]), stablePrefix(requests.at(-1)), 'growth refresh leaves the static personality/Host prefix unchanged')
    t.diagnostic(JSON.stringify({ stableSystemPrefixBytesAcrossGrowthRefresh: Buffer.byteLength(stablePrefix(requests[1])), refreshModes: ['immediate', 'session-compaction'], includesProviderCacheEvidence: false }))
    store.personalityMood.change(card.id, agent.id, { expectedRevision: store.personalityMood.read(card.id,agent.id).revision,
      mood: { feeling:'focused', intensity:4, reason:'WORKSPACE ONLY' } }, 'event')
    for (const [id,cwd,same] of [['cold-work',directory,true],['cold-other',join(directory,'other'),false]]) {
      const session = root.sessions.prepare(id,{meta:{ ...agent.session.header, id, cwd },seed:[],eventState:'detached'})
      cards.select(id,{characterCardId:card.id})
      const view = await face.runtime.preview({ agent:{id,session},sessionId:id,preset:face.store.get('builtin-native-slots') })
      const system = view.messages.filter(m => m.role === 'system').map(m => m.content[0].text).join('\n')
      const snapshot = await face.runtime.sessionReads.run(session, () => face.runtime.resources.compile({ agent: { id, session }, sessionId: id, resolveOnly: true }))
      const raw = snapshot.assemblyInput.personalitySections.find(section => section.sources[0].field === 'mood').sources[0].text
      assert.equal(JSON.parse(raw).reason === 'WORKSPACE ONLY', same)
      assert.ok(view.nodes.some(node => node.module === 'tavern.personality' && node.positionId === 'mood'))
      assert.ok(system.includes('Current mood'))
      assert.ok(!system.includes('WORKSPACE ONLY'), 'raw mood reasons remain source data rather than instructions')
      assert.equal(root.sessions.get(id),undefined, 'preview did not activate the detached session')
    }
    const reader = createNativeRequestReader({ assemblies: store.assemblyStore, sessions: () => root.sessions,
      sessionController: { inspect: async () => ({ meta: agent.session.header, events: agent.session.snapshotEvents() }) } })
    const sourceList = face.runtime.sources(agent.id)
    const preset = face.store.get('builtin-native-slots')
    assert.deepEqual(positionRows(preset, sourceList).filter(row => row.sourceId === 'tavern.personality')
      .map(({positionId, enabled}) => [positionId, enabled]), ['card', ...cardFields, 'evolution', 'mood'].map(id => [id, true]))
    const descriptor = sourceList.find(source => source.id === 'tavern.personality')
    assert.equal(descriptor.moduleAvailable, true)
    assert.equal(descriptor.name, '人格卡 / Personality card')
    const off = { ...preset, rules: preset.rules.map(rule => rule.kind === 'tavern.personality' ? { ...rule, enabled: false } : rule) }
    const old = { ...preset, rules: preset.rules.filter(rule => rule.kind !== 'tavern.personality') }
    const onlyCard = configurePosition(configurePosition(preset,sourceList,'tavern.personality#mood',{ enabled:false }),
      sourceList,'tavern.personality#evolution',{ enabled:false })
    const beforeBase = configurePosition(preset, sourceList, 'tavern.personality#card', {}, 'native-system#content')
    const positionPreview = async candidate => {
      const preview = await face.runtime.preview({ agent, sessionId:agent.id, preset:candidate })
      return { preview, text:preview.messages.filter(m => m.role === 'system').flatMap(m => m.content.map(b => b.text)).join('\n') }
    }
    // Draft previews follow their own rules when the currently applied policy differs.
    face.store.applySnapshot(agent.id, old)
    for (const [candidate, expected] of [[old,1],[off,0],[preset,1]]) {
      const {text,preview} = await positionPreview(candidate)
      assert.equal(text.split('Economical with words').length - 1,expected)
      assert.equal(preview.nodes.filter(node => node.source.module === 'tavern.personality' && node.source.field === 'personality').length, candidate === preset ? 1 : 0)
    }
    for (const [candidate, expected] of [[face.store.get('builtin-native'),1],[old,1],[off,0],[onlyCard,1],[beforeBase,1]]) {
      face.store.applySnapshot(agent.id, candidate)
      await turn()
      const delivered = requests.at(-1)
      assert.equal(delivered.split('Economical with words').length - 1, expected)
      const captured = store.assemblyStore.get(agent.id, store.assemblyStore.list(agent.id).at(-1).id)
      const detail = await reader.readBodies(captured)
      assert.equal(recordedPersonalityLoadState(detail), expected ? 'loaded' : 'notLoaded', 'Trace reads actual stock native delivery')
      if (candidate === off) {
        assert.ok(captured.nativePersonalityExclusion)
        assert.equal(detail.nativeProvenance.personalityExcluded, true)
        const old = structuredClone(captured); delete old.nativePersonalityExclusion
        assert.equal(recordedPersonalityLoadState(await reader.readBodies(old)), 'unverifiable', 'old absent evidence remains unknown')
        const lost = structuredClone(captured); lost.nativeRequestRef.messagesHash = 'unavailable'
        assert.equal(recordedPersonalityLoadState(await reader.readBodies(lost)), 'unverifiable', 'exclusion needs the matching historical request body')
      }
      assert.ok(delivered.includes('HOST BASE'))
      if (candidate === onlyCard) {
        assert.ok(!delivered.includes('emotional color recognizable'))
        assert.ok(!delivered.includes('I distinguish observed and inferred facts'))
      }
      if (candidate === beforeBase) assert.ok(delivered.indexOf('Economical with words') < delivered.indexOf('HOST BASE'))
    }
    const descriptionOff = configurePosition(preset,sourceList,'tavern.personality#description',{ enabled:false })
    const cardOff = configurePosition(preset,sourceList,'tavern.personality#card',{ enabled:false })
    const cardOffAfterOtherEdit = configurePosition(cardOff,sourceList,'tavern.personality#personality',{ enabled:true })
    const movedTraits = configurePosition(preset,sourceList,'tavern.personality#personality',{},'native-system#content')
    for (const candidate of [descriptionOff,cardOffAfterOtherEdit,movedTraits]) {
      const {text} = await positionPreview(candidate)
      face.store.applySnapshot(agent.id,candidate)
      await turn()
      const delivered = requests.at(-1)
      assert.ok(delivered.includes('HOST BASE'))
      for (const actual of [text,delivered]) {
        assert.equal(actual.includes('Aster works with User'),candidate === movedTraits)
        assert.equal(actual.split('Economical with words').length - 1,candidate === cardOffAfterOtherEdit ? 0 : 1)
        if (candidate === movedTraits) assert.ok(actual.indexOf('Economical with words') < actual.indexOf('HOST BASE'))
      }
      const summary = store.assemblyStore.list(agent.id).at(-1), trace = store.assemblyStore.get(agent.id,summary.id)
      assert.equal(trace.delivery.assemblyVerified,true)
    }
    cards.select(agent.id,null)
    await turn()
    assert.ok(!requests.at(-1).includes('Economical with words'))
    assert.ok(requests.at(-1).includes('HOST BASE'))
    const unbound = store.assemblyStore.get(agent.id, store.assemblyStore.list(agent.id).at(-1).id)
    assert.equal(recordedPersonalityLoadState(await reader.readBodies(unbound)), 'notLoaded')
  } finally { await root.fiber.dispose() }
})
