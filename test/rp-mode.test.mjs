import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'
import {
  DEFAULT_RP_SECTION,
  DEFAULT_RP_STATE,
  RpModeController,
  createRpModeApiHandler,
  foldSandboxMode,
  hasOpenTurn,
  normalizeRpState,
  resolveRpConfig,
} from '../packages/tavern-loader/src/rp-mode.js'

function createAgent(id, events = []) {
  const session = {
    id,
    header: { id },
    events,
    append(type, data) {
      const event = { type, seq: this.events.length, time: 1, data }
      this.events.push(event)
      return event
    },
  }
  return { id, session }
}

function fixture(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-rp-'))
  const selections = new SessionSelectionStore(directory)
  const agents = new Map()
  const controller = new RpModeController({
    selections,
    uiSettings: { get: () => ({ rpFollowCharacter: options.follow !== false }) },
    agents: () => ({ get: id => agents.get(id) }),
    sandboxDefault: () => options.sandboxDefault ?? 'workspace-write',
  })
  return { directory, selections, agents, controller }
}

async function invoke(handler, { method = 'GET', url = '/dsh-tavern/api/rp-mode?sessionId=session-a', body } = {}) {
  const content = body === undefined ? '' : JSON.stringify(body)
  const req = Readable.from(content === '' ? [] : [Buffer.from(content)])
  req.method = method
  req.url = url
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      end(payload = '') {
        resolve({
          status: res.statusCode,
          body: payload === '' ? null : JSON.parse(String(payload)),
        })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('RP config requires a non-empty section and rejects unknown keys', () => {
  assert.equal(resolveRpConfig().section, DEFAULT_RP_SECTION)
  assert.throws(() => resolveRpConfig({ section: '' }), /non-empty/)
  assert.throws(() => resolveRpConfig({ section: 1 }), /string/)
  assert.throws(() => resolveRpConfig({ section: 'ok', extra: true }), /unknown/)
})

test('RP state normalizes unknown fields and folds sandbox last-wins', () => {
  assert.deepEqual(normalizeRpState({ active: 'yes', source: 'nope', injected: 1 }), DEFAULT_RP_STATE)
  assert.deepEqual(normalizeRpState({ active: true, source: 'command', sandboxBefore: 'workspace-write' }), {
    active: true,
    source: 'command',
    followSuppressed: false,
    sandboxBefore: 'workspace-write',
  })
  assert.equal(foldSandboxMode([
    { type: 'sandbox/mode', data: { mode: 'read-only' } },
    { type: 'sandbox/mode', data: { mode: 'danger-full-access' } },
  ]), 'danger-full-access')
  assert.equal(hasOpenTurn([{ type: 'turn/start' }]), true)
  assert.equal(hasOpenTurn([{ type: 'turn/start' }, { type: 'turn/end' }]), false)
})

test('idle RP entry switches sandbox to read-only and leave restores the previous mode', () => {
  const { directory, agents, controller } = fixture()
  try {
    const agent = createAgent('session-a', [{ type: 'sandbox/mode', data: { mode: 'workspace-write' } }])
    agents.set(agent.id, agent)
    assert.equal(controller.set(agent, true), 'committed')
    assert.equal(controller.stored(agent.id).active, true)
    assert.equal(controller.stored(agent.id).sandboxBefore, 'workspace-write')
    assert.equal(foldSandboxMode(agent.session.events), 'read-only')
    assert.equal(controller.isActive(agent), true)
    assert.equal(controller.set(agent, false, { followSuppressed: true }), 'committed')
    assert.equal(controller.stored(agent.id).active, false)
    assert.equal(controller.stored(agent.id).followSuppressed, true)
    assert.equal(foldSandboxMode(agent.session.events), 'workspace-write')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('RP leave does not clobber a sandbox the user changed while roleplay was active', () => {
  const { directory, agents, controller } = fixture()
  try {
    const agent = createAgent('session-a', [{ type: 'sandbox/mode', data: { mode: 'workspace-write' } }])
    agents.set(agent.id, agent)
    controller.set(agent, true)
    agent.session.append('sandbox/mode', { mode: 'danger-full-access' })
    controller.set(agent, false)
    assert.equal(foldSandboxMode(agent.session.events), 'danger-full-access')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('open-turn RP selection stays pending until the next accepted pre-step', () => {
  const { directory, agents, controller } = fixture()
  try {
    const agent = createAgent('session-a', [{ type: 'turn/start' }])
    agents.set(agent.id, agent)
    assert.equal(controller.set(agent, true), 'queued')
    assert.equal(controller.stored(agent.id).active, false)
    assert.equal(controller.isActive(agent), true)
    controller.onBoundary(agent)
    assert.equal(controller.stored(agent.id).active, true)
    assert.equal(foldSandboxMode(agent.session.events), 'read-only')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('binding a character follows into RP and unbinding always leaves', () => {
  const { directory, agents, controller, selections } = fixture()
  try {
    const agent = createAgent('session-a')
    agents.set(agent.id, agent)
    selections.set(agent.id, { characterCardId: 'card-a' })
    controller.followCharacterChange(agent.id, { previousId: null, nextId: 'card-a' })
    assert.equal(controller.stored(agent.id).active, true)
    assert.equal(controller.stored(agent.id).source, 'character-follow')
    controller.followCharacterChange(agent.id, { previousId: 'card-a', nextId: null })
    assert.equal(controller.stored(agent.id).active, false)
    assert.equal(foldSandboxMode(agent.session.events), 'workspace-write')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('manually leaving RP while a card is bound does not auto-reenter until a new bind', () => {
  const { directory, agents, controller, selections } = fixture()
  try {
    const agent = createAgent('session-a')
    agents.set(agent.id, agent)
    selections.set(agent.id, { characterCardId: 'card-a' })
    controller.followCharacterChange(agent.id, { previousId: null, nextId: 'card-a' })
    controller.set(agent, false, { followSuppressed: true })
    controller.onSessionStart(agent)
    assert.equal(controller.stored(agent.id).active, false)
    controller.followCharacterChange(agent.id, { previousId: 'card-a', nextId: 'card-b' })
    assert.equal(controller.stored(agent.id).active, true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('follow can be disabled without blocking an explicit /rp command', () => {
  const { directory, agents, controller } = fixture({ follow: false })
  try {
    const agent = createAgent('session-a')
    agents.set(agent.id, agent)
    controller.followCharacterChange(agent.id, { previousId: null, nextId: 'card-a' })
    assert.equal(controller.stored(agent.id).active, false)
    assert.equal(controller.set(agent, true, { source: 'command' }), 'committed')
    assert.equal(controller.stored(agent.id).source, 'command')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('RP HTTP API reads and writes session collaboration state', async () => {
  const { directory, agents, controller } = fixture()
  try {
    const agent = createAgent('session-a')
    agents.set(agent.id, agent)
    const handler = createRpModeApiHandler(controller)
    const initial = await invoke(handler)
    assert.equal(initial.body.rp.active, false)
    const updated = await invoke(handler, {
      method: 'PUT',
      url: '/dsh-tavern/api/rp-mode',
      body: { sessionId: 'session-a', active: true },
    })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.rp.active, true)
    assert.equal(controller.stored('session-a').source, 'command')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
