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
  RP_WRITE_BLOCK_REASON,
  RpModeController,
  createRpModeApiHandler,
  foldSandboxMode,
  hasOpenTurn,
  normalizeRpState,
  resolveRpConfig,
  rpHighRiskGuardReason,
  rpWorkspaceReadGuardReason,
  rpWriteGuardReason,
} from '../packages/tavern-loader/src/rp-mode.js'

function createAgent(id, events = [], header = {}) {
  const session = {
    id,
    header: { ...header, id },
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
    workspaceRoot: () => options.workspaceRoot ?? directory,
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
  assert.ok(DEFAULT_RP_SECTION.length < 220)
  assert.match(DEFAULT_RP_SECTION, /read-only|blocked/)
  assert.doesNotMatch(DEFAULT_RP_SECTION, /Stay in character|coding assistant|planner/)
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

test('RP pins the file sandbox to read-only if the chat permission chip changes', () => {
  const { directory, agents, controller } = fixture()
  try {
    const agent = createAgent('session-a', [{ type: 'sandbox/mode', data: { mode: 'workspace-write' } }])
    agents.set(agent.id, agent)
    controller.set(agent, true)
    agent.session.append('sandbox/mode', { mode: 'danger-full-access' })
    assert.equal(controller.enforceReadOnly(agent.session), true)
    assert.equal(foldSandboxMode(agent.session.events), 'read-only')
    controller.set(agent, false)
    assert.equal(foldSandboxMode(agent.session.events), 'workspace-write')
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

test('queued RP leave still blocks writes until the next pre-step commits', () => {
  const { directory, agents, controller } = fixture()
  try {
    const agent = createAgent('session-a')
    agents.set(agent.id, agent)
    controller.set(agent, true)
    agent.session.append('turn/start', {})
    assert.equal(controller.set(agent, false, { followSuppressed: true }), 'queued')
    assert.equal(controller.stored(agent.id).active, true)
    assert.equal(controller.blocksWrites(agent), true)
    assert.equal(controller.enforceReadOnly(agent.session), false)
    controller.onBoundary(agent)
    assert.equal(controller.stored(agent.id).active, false)
    assert.equal(controller.blocksWrites(agent), false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('RP write guard denies mutating file tools, shell, fetch, and sandbox escalation, but not reads', () => {
  assert.equal(rpWriteGuardReason({ name: 'write', arguments: { file_path: 'a.md' } }), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWriteGuardReason({ name: 'edit', arguments: { file_path: 'a.md' } }), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWriteGuardReason({ name: 'str_replace_editor', arguments: {} }), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWriteGuardReason({ name: 'pwsh', arguments: { sandbox_permissions: 'danger-full-access' } }), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWriteGuardReason({ name: 'pwsh', arguments: { command: 'Get-ChildItem' } }), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWriteGuardReason({ name: 'bash', arguments: { command: 'curl https://example.test' } }), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWriteGuardReason({ name: 'run_code', arguments: {} }), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWriteGuardReason({ name: 'web_fetch', arguments: { url: 'https://example.test' } }), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWriteGuardReason({ name: 'read', arguments: { file_path: 'a.md' } }), undefined)
  assert.equal(rpWriteGuardReason({ name: 'web_search', arguments: { query: 'weather' } }), undefined)
  assert.equal(rpWriteGuardReason({ name: 'subagent', arguments: { description: 'play' } }), undefined)
})

test('RP read guard stays inside the workspace and refuses secret files and grep', () => {
  const workspace = join(tmpdir(), 'dsh-tavern-rp-ws')
  assert.equal(rpWorkspaceReadGuardReason({ name: 'read', arguments: { file_path: 'a.md' } }, workspace), undefined)
  assert.equal(rpWorkspaceReadGuardReason({ name: 'read_image', arguments: { file_path: 'art.png' } }, workspace), undefined)
  assert.equal(rpWorkspaceReadGuardReason({ name: 'glob', arguments: { pattern: '*.md' } }, workspace), undefined)
  assert.equal(rpWorkspaceReadGuardReason({ name: 'read', arguments: { file_path: '.env' } }, workspace), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWorkspaceReadGuardReason({ name: 'read', arguments: { file_path: '.env.local' } }, workspace), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWorkspaceReadGuardReason({ name: 'read', arguments: { file_path: join('..', 'outside.md') } }, workspace), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWorkspaceReadGuardReason({ name: 'grep', arguments: { pattern: 'API_KEY' } }, workspace), RP_WRITE_BLOCK_REASON)
  assert.equal(rpWorkspaceReadGuardReason({ name: 'glob', arguments: { pattern: '*', path: join('..', 'other') } }, workspace), RP_WRITE_BLOCK_REASON)
  assert.equal(rpHighRiskGuardReason({ name: 'web_search', arguments: { query: 'weather' } }, workspace), undefined)
  assert.equal(rpHighRiskGuardReason({ name: 'subagent', arguments: {} }, workspace), undefined)
})

test('RP high-risk block records an alert and cancels the running agent', async () => {
  const { directory, agents, controller } = fixture()
  try {
    const cancelled = []
    const agent = createAgent('session-a')
    agent.cancel = (cause, options) => cancelled.push({ cause, options })
    agents.set(agent.id, agent)
    controller.set(agent, true)
    assert.equal(controller.interruptHighRisk({ name: 'bash', arguments: { command: 'curl https://example.test' }, agent: createAgent('other') }), undefined)
    assert.equal(controller.interruptHighRisk({ name: 'read', arguments: { file_path: 'a.md' }, agent }), undefined)
    assert.equal(controller.peekHighRiskAlert('session-a'), null)
    const reason = controller.interruptHighRisk({
      name: 'bash',
      arguments: { command: 'curl https://example.test' },
      agent,
    })
    assert.equal(reason, RP_WRITE_BLOCK_REASON)
    const alert = controller.peekHighRiskAlert('session-a')
    assert.equal(alert.toolName, 'bash')
    assert.equal(
      controller.interruptHighRisk({ name: 'write', arguments: { file_path: 'a.md' }, agent }),
      RP_WRITE_BLOCK_REASON,
    )
    const coalesced = controller.peekHighRiskAlert('session-a')
    assert.equal(coalesced.id, alert.id)
    assert.equal(coalesced.toolName, 'write')
    await Promise.resolve()
    assert.equal(cancelled.length, 2)
    assert.deepEqual(cancelled[0], {
      cause: { kind: 'hook', reason: 'rp-high-risk-block' },
      options: { keepInbox: true },
    })
    const handler = createRpModeApiHandler(controller)
    const peeked = await invoke(handler, { url: '/dsh-tavern/api/rp-alert?sessionId=session-a' })
    assert.equal(peeked.body.alert.toolName, 'write')
    const acked = await invoke(handler, {
      method: 'DELETE',
      url: `/dsh-tavern/api/rp-alert?sessionId=session-a&id=${peeked.body.alert.id}`,
    })
    assert.equal(acked.body.alert.toolName, 'write')
    const empty = await invoke(handler, { url: '/dsh-tavern/api/rp-alert?sessionId=session-a' })
    assert.equal(empty.body.alert, null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('RP lock applies to subagents while still allowing the parent to spawn them', async () => {
  const { directory, agents, controller } = fixture()
  try {
    const cancelled = []
    const parent = createAgent('session-a')
    const child = createAgent('child', [], { parentSession: 'session-a', delegationDepth: 1 })
    child.cancel = (cause, options) => cancelled.push({ cause, options })
    agents.set(parent.id, parent)
    agents.set(child.id, child)
    controller.set(parent, true)
    assert.equal(controller.interruptHighRisk({ name: 'subagent', arguments: { description: 'npc' }, agent: parent }), undefined)
    assert.equal(controller.blocksWrites(child), true)
    assert.equal(controller.interruptHighRisk({ name: 'read', arguments: { file_path: 'lore.md' }, agent: child }), undefined)
    assert.equal(
      controller.interruptHighRisk({ name: 'bash', arguments: { command: 'curl https://example.test' }, agent: child }),
      RP_WRITE_BLOCK_REASON,
    )
    assert.equal(controller.peekHighRiskAlert('session-a').toolName, 'bash')
    assert.equal(controller.peekHighRiskAlert('child'), null)
    await Promise.resolve()
    assert.equal(cancelled.length, 1)
    controller.onSessionStart(child)
    assert.equal(controller.stored('child').active, true)
    assert.equal(foldSandboxMode(child.session.events), 'read-only')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
