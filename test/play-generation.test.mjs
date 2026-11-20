import { Readable } from 'node:stream'
import { createPlayApiHandler } from '../packages/play/src/server.js'
import { createLivePlayClient } from '../packages/client/src/play/live.js'
import { loadCurrentPlaythrough } from '../packages/client/src/play/chat-model.js'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createGenerationService } from '../packages/play/src/generation.js'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'
import { createPlayNodeController } from '../packages/client/src/play/nodes.js'
import { restorePendingGeneration } from '../packages/client/src/play/generation.js'
import { pendingSwipeForSession } from '../packages/client/src/play/pending-swipe.js'

function turn(text, { turn = 1, rpcId, stopped = false } = {}) {
  return [
    { type: 'turn/start', data: { turn } },
    { type: 'user/message', data: { id: 'u-' + turn, role: 'user', source: { kind: 'user', rpcId }, content: [{ type: 'text', text }] } },
    { type: 'assistant/message', data: { message: { id: 'a-' + turn, role: 'assistant', content: [{ type: stopped ? 'reasoning' : 'text', text: 'body' }] } } },
    { type: 'turn/end', data: { turn, reason: { kind: stopped ? 'aborted' : 'completed' } } },
  ]
}

async function fixture(t, { retry = false, later = false, atomic = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'play-generation-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const root = join(dir, 'rp'), storage = join(dir, 'storage')
  mkdirSync(root)
  const store = new PlayWorkspaceStore(storage)
  await store.bindRoot(root)
  const row = { id: 'p', path: 'p/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'old' } } }
  const put = (path, value, expectedRevision = null) => store.writeFile(path, JSON.stringify(value), { expectedRevisionPresent: true, expectedRevision })
  put('catalog.json', { playthroughs: [row] })
  const seq = events => events.map((e, seq) => ({ ...e, seq }))
  const original = seq([...(later ? turn('prefix') : []), ...turn('prompt', { turn: 2, stopped: retry })])
  const node = (id, user, end, parentVariantId) => ({ id, parentVariantId, kind: 'qa', adoptedVariantId: id + '-v',
    variants: [{ id: id + '-v', sessionId: 'old', startEventId: user, endEventId: end, ext: { pmpDshTavern: { sessionFormatVersion: 4 } } }] })
  const nodes = [...(later ? [node('first', 1, 2, null)] : []), ...(retry ? [] : [node('target', later ? 5 : 1, later ? 6 : 2, later ? 'first-v' : null)])]
  const last = nodes.at(-1)
  const timeline = { nodes, ...(last ? { head: { nodeId: last.id, variantId: last.adoptedVariantId, sessionId: 'old' } } : {}) }
  const { revision } = put(row.path, timeline)
  const request = { action: 'start', kind: retry ? 'request-retry' : 'reply-swipe',
    ...(retry ? { sessionId: 'old', userEventId: later ? 5 : 1 } : { nodeId: 'target' }),
    operationKey: 'generation-one', expectedWorkspaceScope: JSON.stringify([null, root]), expectedRevision: revision }
  const checkpoint = () => {
    if (atomic) {
      const record = store.checkpoints.get(row.id, request.expectedWorkspaceScope)
      assert.equal(record.owner, 'tavern.generation')
      return record.data
    }
    const directory = join(storage, 'playthrough-generations')
    return JSON.parse(readFileSync(join(directory, readdirSync(directory)[0]), 'utf8'))
  }
  let childEvents = [], creates = 0, sends = 0, rpcId
  const calls = []
  const host = {
    coordinates: async () => ({ sessionFormatVersion: 4 }),
    history: async ({sessionId}) => {
      const events = sessionId === 'old' ? original : seq(childEvents)
      return { sessionFormatVersion: 4, events, throughSeq: events.length - 1 }
    },
    inspectSession: async id => ({ meta: { id, version: 4 }, inheritedEventCount: id === 'new' && later ? 3 : 0,
      events: id === 'old' ? original : seq(childEvents) }),
    async createSession(args, { operation }) {
      creates++; assert.equal(checkpoint().stage, 'creating')
      calls.push(['create', args.stateSource]); operation.checkpoint('session.created', { sessionId: 'new' })
      return { sessionId: 'new' }
    },
    async forkSession(args, { operation }) {
      creates++; assert.equal(checkpoint().stage, 'creating')
      calls.push(['fork', args.atSeq, args.sessionFormatVersion, args.stateSource]); childEvents = original.slice(0, args.atSeq + 1)
      operation.checkpoint('session.created', { sessionId: 'new' })
      return { sessionId: 'new' }
    },
    getImportContextBinding: async () => ({ path: 'imports/context' }),
    prepareImportContext: async value => value,
    bindImportContext: async (id, ref) => calls.push(['bind', id, ref.path]),
    copySelection: async () => calls.push('copy-selection'),
    copyImportContextLineage: async () => calls.push('copy-lineage'),
    async promptSession({ sessionId, requestId, text }) {
      sends++; assert.equal(checkpoint().stage, 'sending'); assert.equal(checkpoint().requestId, requestId)
      assert.equal(sessionId, 'new'); assert.equal(text, 'prompt'); rpcId = requestId
    },
  }
  const service = createGenerationService(store, host)
  const run = (action, other = {}) => service.run('p', { ...request, action, ...other })
  const append = events => { childEvents.push(...events) }
  return { store, row, host, run, service, checkpoint, append, request, calls, timeline, put, storage,
    counts: () => [creates, sends], rpc: () => rpcId, reload: () => createGenerationService(new PlayWorkspaceStore(storage), host),
    settle: () => new Promise(resolve => setImmediate(resolve)),
  }
}

for (const retry of [false, true]) for (const later of [false, true]) test('restart recovers one ' + (later ? 'forked ' : 'root ') + (retry ? 'stopped-request retry' : 'reply swipe'), async t => {
  const f = await fixture(t, { retry, later })
  await f.run('start'); await f.settle()
  const resumed = f.reload(), call = action => resumed.run('p', { ...f.request, action })
  assert.equal((await call('start')).sessionId, 'new')
  assert.deepEqual(f.counts(), [1,1])
  assert.equal(f.checkpoint().stage, 'accepted')
  assert.equal((await call('status')).state, 'waiting')
  const stateSource = { sessionId: 'old', ...(retry ? { beforeUserEventId: later ? 5 : 1 } : { beforeReplyEventId: later ? 6 : 2 }) }
  assert.deepEqual(f.calls, later ? [['fork', 2, 4, stateSource], 'copy-selection', 'copy-lineage']
    : [['create', stateSource], ['bind', 'new', 'imports/context'], 'copy-selection'])
  const events = turn('prompt', { rpcId: f.rpc(), turn: 3 })
  f.append(events.slice(0,3))
  assert.equal((await call('status')).state, 'running')
  assert.equal((await resumed.repair(f.row, {})).remaining[0].reason, 'turn-in-progress')
  f.append(events.slice(3))
  assert.equal((await call('status')).state, 'ready')
  const initial = f.store.readFile(f.row.path)
  const preview = await resumed.repair(f.row, { apply: false })
  assert.equal(preview.changes[0].kind, 'generation-recovered')
  assert.equal(f.store.readFile(f.row.path).content, initial.content)
  const backups = []
  assert.deepEqual((await resumed.repair(f.row, { apply: true, beforeWrite: (file, path) => backups.push([path, file.content]) })).remaining, [])
  assert.deepEqual(backups, [[f.row.path, initial.content]])
  const result = await call('finish'), node = result.timeline.nodes.at(-1)
  assert.deepEqual(result.timeline.head, { nodeId: result.nodeId, sessionId: 'new', variantId: result.variantId })
  assert.equal(node.variants.length, retry ? 1 : 2)
  assert.equal(node.variants.at(-1).startEventId, later ? 4 : 1)
  assert.equal(node.variants.at(-1).endEventId, later ? 5 : 2)
  assert.deepEqual(f.counts(), [1,1])
  assert.equal(await resumed.repair(f.row, { apply: true }), null)
})

test('unknown fork outcome and scope or key mismatch cannot create a second child', async t => {
  const f = await fixture(t, { later: true })
  let calls = 0
  f.host.forkSession = async () => { calls++; throw Error('lost native reply') }
  await assert.rejects(f.run('start'), /lost native reply/)
  const restart = f.reload()
  const call = (action, extra) => restart.run('p', {...f.request, action, ...extra})
  assert.equal((await call('status')).state, 'uncertain')
  await assert.rejects(call('start'), {code:'PLAY_GENERATION_PENDING'})
  await assert.rejects(call('start', {operationKey:'other'}), {code:'PLAY_GENERATION_PENDING'})
  assert.equal((await restart.repair(f.row, {apply:true})).remaining[0].stage, 'creating')
  await assert.rejects(call('dismiss', {operationKey:'wrong'}), {code:'PLAY_GENERATION_CONFLICT'})
  await assert.rejects(call('dismiss', {expectedWorkspaceScope:'other'}), {code:'PLAY_WORKSPACE_CHANGED'})
  assert.equal((await call('dismiss')).ok, true)
  assert.equal(calls,1)
})

test('native admission error can still have a durable reply; never resend or pair a different prompt', async t => {
  const f = await fixture(t)
  let dispatched, count = 0
  f.host.promptSession = async req => { dispatched = req; count++; throw Error('transport lost') }
  await f.run('start'); await f.settle()
  assert.equal((await f.run('status')).state,'uncertain')
  f.append(turn('prompt',{rpcId:'unrelated',turn:2}))
  assert.equal((await f.run('status')).state,'uncertain')
  f.append(turn('prompt',{rpcId:dispatched.requestId,turn:3}))
  assert.equal((await f.run('finish')).timeline.nodes[0].variants.at(-1).startEventId,5)
  assert.equal(count,1)
})

test('status, repair and finish preserve a separately selected head', async t => {
  const f = await fixture(t, { later: true })
  await f.run('start'); await f.settle()
  f.append(turn('prompt',{rpcId:f.rpc(),turn:3}))
  const changed = {...f.timeline,head:{sessionId:'old',nodeId:'first',variantId:'first-v'}}
  f.put(f.row.path, changed, f.request.expectedRevision)
  assert.equal((await f.run('status')).code, 'PLAY_GENERATION_CONFLICT')
  await assert.rejects(f.run('finish'), {code:'PLAY_GENERATION_CONFLICT'})
  const report = await f.reload().repair(f.row, {apply:true})
  assert.equal(report.remaining[0].code, 'PLAY_GENERATION_CONFLICT')
  assert.deepEqual(JSON.parse(f.store.readFile(f.row.path).content),changed)
})

test('refresh restores pending child navigation and finalizes after a failed metadata write', async t => {
  const f = await fixture(t)
  await f.run('start'); await f.settle()
  const client = { generation: (_row, req) => f.service.run('p',req) }
  const options = { sessionId: 'new',expectedWorkspaceScope:f.request.expectedWorkspaceScope }
  assert.equal(await restorePendingGeneration(client, f.row, f.timeline, {...options,sessionId:'other'}),null)
  assert.equal((await restorePendingGeneration(client, f.row, f.timeline, options)).sessionId,'new')
  assert.ok(pendingSwipeForSession(client,'new'))
  f.append(turn('prompt',{rpcId:f.rpc(),turn:3}))
  f.store.beforeRename = () => {throw Error('disk full')}
  await assert.rejects(restorePendingGeneration(client, f.row, f.timeline,options),/disk full/)
  f.store.beforeRename = null
  assert.equal((await restorePendingGeneration(client, f.row, f.timeline,options)).timeline.head.sessionId,'new')
  assert.equal(pendingSwipeForSession(client,'new'),null)
  assert.deepEqual(f.counts(),[1,1])
})

test('the live controller opens once, keeps polling for an open native turn and commits through the Host', async t => {
  const f = await fixture(t), opened = []
  const client = {
    generation: (_row, req) => f.service.run('p',{...req,expectedRevision:f.request.expectedRevision}),
    getTimeline: async () => f.timeline, getWorkspace: async () => f.store.get(),
  }
  let polls = 0
  const controller = createPlayNodeController(client,{maxPolls:2,delay:async()=>{
    polls++; if (polls === 1) f.append(turn('prompt',{rpcId:f.rpc(),turn:2}).slice(0,2))
    if (polls === 5) f.append(turn('prompt',{rpcId:f.rpc(),turn:2}).slice(2))
  }})
  const result = await controller.createReplySwipe(f.row,'target',{onStarted:entry=>opened.push(entry.sessionId)})
  assert.equal(result.timeline.head.sessionId,'new')
  assert.deepEqual(opened,['new']); assert.equal(polls,5)
  assert.deepEqual(f.counts(),[1,1])
})

test('a hung preflight releases the reservation and cannot resume into a second fork or send', async t => {
  const f = await fixture(t)
  const deferred = Promise.withResolvers()
  const coordinates = f.host.coordinates
  f.host.coordinates = () => deferred.promise
  const short = createGenerationService(f.store, f.host, {waitMs:25})
  const keepAlive = setInterval(() => {}, 100)
  t.after(() => clearInterval(keepAlive))
  await assert.rejects(short.run('p',f.request), {code:'PLAY_GENERATION_TIMEOUT'})
  assert.deepEqual(f.counts(),[0,0])
  f.host.coordinates = coordinates
  await short.run('p',{...f.request,operationKey:'next'})
  deferred.resolve({sessionFormatVersion:4}); await f.settle()
  assert.equal(f.checkpoint().operationKey,'next')
  assert.deepEqual(f.counts(),[1,1])
})

test('a late fork can record its identity after timeout but cannot send or move the playthrough',async t=>{
  const f=await fixture(t,{later:true}), entered=Promise.withResolvers(), finish=Promise.withResolvers()
  const service=createGenerationService(f.store,f.host,{waitMs:25})
  const keepAlive=setInterval(()=>{},100); t.after(()=>clearInterval(keepAlive))
  f.host.forkSession=async()=>{entered.resolve();return finish.promise}
  const task=service.run('p',f.request); await entered.promise
  await assert.rejects(task,{code:'PLAY_GENERATION_TIMEOUT'})
  assert.equal(f.checkpoint().stage,'creating')
  finish.resolve({sessionId:'late'});await f.settle()
  assert.equal(f.checkpoint().sessionId,'late')
  assert.equal(f.checkpoint().stage,'created')
  assert.deepEqual(f.counts(),[0,0]);assert.deepEqual(JSON.parse(f.store.readFile(f.row.path).content),f.timeline)
  assert.equal((await service.repair(f.row,{apply:true})).remaining[0].code,'PLAY_GENERATION_PENDING')
})

test('durable generation guards release on dismissal and allow display edits throughout the wait', async t => {
  const f=await fixture(t,{later:true})
  await f.run('start');await f.settle()
  const guards=f.reload()
  assert.equal(guards.hasPending(f.row),true)
  guards.guardTimelineWrite(f.row, f.timeline, {...f.timeline,nodes:f.timeline.nodes.map(n=>({...n,displayOverride:'edit'}))})
  assert.throws(()=>guards.guardTimelineWrite(f.row,f.timeline,{...f.timeline,head:{nodeId:'first',variantId:'first-v',sessionId:'old'}},'guessed'),{code:'PLAY_GENERATION_PENDING'})
  assert.throws(()=>guards.guardPathChange(f.row),{code:'PLAY_GENERATION_PENDING'})
  guards.guardCatalogChange(f.row,{...f.row,title:'new'})
  assert.throws(()=>guards.guardCatalogChange(f.row,null),{code:'PLAY_GENERATION_PENDING'})
  await f.run('dismiss');assert.equal(guards.hasPending(f.row),false)
  guards.guardPathChange(f.row)
})

test('a stalled final inspection cannot publish a late reply after its deadline',async t=>{
  const f=await fixture(t)
  await f.run('start');await f.settle()
  f.append(turn('prompt',{rpcId:f.rpc(),turn:3}))
  const inspect=f.host.inspectSession, result=await inspect('new'), gate=Promise.withResolvers()
  f.host.inspectSession=()=>gate.promise
  const service=createGenerationService(f.store,f.host,{waitMs:20})
  const keepAlive=setInterval(()=>{},100);t.after(()=>clearInterval(keepAlive))
  const report=await service.repair(f.row,{apply:true})
  assert.equal(report.remaining[0].code,'PLAY_GENERATION_TIMEOUT')
  gate.resolve(result);await f.settle()
  assert.deepEqual(JSON.parse(f.store.readFile(f.row.path).content),f.timeline)
})

test('a stale visible swipe is rejected before native work, and a running turn cannot be dismissed',async t=>{
  const f=await fixture(t)
  await assert.rejects(f.run('start',{variantId:'older-visible-variant'}),{code:'PLAY_GENERATION_CONFLICT'})
  assert.deepEqual(f.counts(),[0,0])
  await f.run('start');await f.settle()
  f.append(turn('prompt',{rpcId:f.rpc(),turn:3}).slice(0,2))
  await assert.rejects(f.run('dismiss'),{code:'PLAY_GENERATION_BUSY'})
})

test('reopened service observes the admitted RPC in the durable inbox before user/message is written', async t => {
  const f=await fixture(t), admission=Promise.withResolvers()
  f.host.promptSession=async({requestId})=>{
    f.append([{type:'agent/inbox/spliced',data:{target:'next-turn',start:0,inserted:[{role:'user',source:{kind:'user',rpcId:requestId}}]}}])
    await admission.promise
  }
  await f.run('start')
  const reopened=f.reload(), status=()=>reopened.run('p',{...f.request,action:'status'})
  try {
    assert.equal((await status()).state,'waiting')
    f.append([{type:'turn/start',data:{turn:2}}])
    assert.equal((await status()).state,'running')
    f.append([{type:'turn/end',data:{turn:2,reason:{kind:'aborted'}}}])
    assert.equal((await status()).state,'uncertain')
  } finally {admission.resolve();await f.settle()}
})

for (const retry of [false, true]) for (const later of [false, true]) {
  const scenario = (later ? 'later' : 'opening') + (retry ? ' stopped request' : ' reply')
  test('two live clients recover the ' + scenario + ' through public primitives after remount', async t => {
    const f = await fixture(t, { retry, later, atomic: true })
    const calls = []
    const connect = store => {
      const api = createPlayApiHandler({ workspaceStore: store, host: f.host, chromeStore: {} })
      return () => createLivePlayClient({ fetchImpl: async (url, options) => {
        const { pathname } = new URL(url, 'http://localhost')
        calls.push({ method: options.method, path: pathname, body: options.body && JSON.parse(options.body) })
        const req = Readable.from(options.body ? [Buffer.from(options.body)] : [])
        Object.assign(req, { url, method: options.method })
        const res = { setHeader() {}, end(body) { this.body = body } }
        await api(req, res)
        return new Response(res.body, { status: res.statusCode })
      } })
    }
    const first = connect(f.store)()
    const opened = await first.generation(f.row, f.request)
    assert.equal(opened.sessionId, 'new')
    await f.settle()
    const afterRestart = connect(new PlayWorkspaceStore(f.storage))
    const second = afterRestart()
    if (later && !retry) {
      await assert.rejects(second.rollbackPlaythrough(f.row, 'first', 'first-v'), { code: 'PLAY_BRANCH_PENDING' })
      await assert.rejects(second.updateTimeline(f.row, timeline => ({
        ...timeline, head: { sessionId: 'old', nodeId: 'first', variantId: 'first-v' },
      })), { code: 'PLAY_CHECKPOINT_CONFLICT' })
    }
    if (f.timeline.nodes.length) {
      await second.updateTimeline(f.row, timeline => ({
        ...timeline, nodes: timeline.nodes.map(node => ({ ...node, displayOverride: 'display edit' })),
      }))
    }
    f.append(turn('prompt', { rpcId: f.rpc(), turn: 3 }))
    const reopened = await loadCurrentPlaythrough(afterRestart(), { id: 'new', cwd: f.store.get().rootPath })
    assert.equal(reopened.playthrough.id, f.row.id)
    assert.equal(reopened.timeline.head.sessionId, 'new')
    if (f.timeline.nodes.length) assert.equal(reopened.timeline.nodes[0].displayOverride, 'display edit')
    assert.deepEqual(f.counts(), [1, 1])
    assert.ok(!calls.some(call => /\/playthroughs\/[^/]+\/(?:rollback|fork|generation)$/.test(call.path)))
    assert.ok(calls.some(call => call.method === 'PUT' && call.path.endsWith('/workspace/checkpoints/p') && call.body.expectedRevision === null))
    const mutations = calls.filter(call => call.method === 'POST')
    assert.deepEqual(mutations.map(call => call.path.split('/sessions').at(-1)), [later ? '/old/branch' : '', '/new/user-message'])
    assert.ok(mutations.every(call => call.body.operationKey && call.body.checkpointKey === f.request.operationKey && call.body.checkpointId === 'p'))
    assert.ok(calls.some(call => call.method === 'GET' && call.path.includes('/operation-receipts/')))
    assert.ok(calls.some(call => call.method === 'PUT' && call.path.endsWith('/workspace/files') && call.body.checkpointKey === f.request.operationKey))
    assert.equal((await second.getCheckpoint(f.row, f.request.expectedWorkspaceScope)).released, true)
  })
}
