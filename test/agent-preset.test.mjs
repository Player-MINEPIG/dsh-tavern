// Covers the optional <storageDir>/agent-preset.json seam on the playthrough create path.
//
// `createPlayHost().createSession` had no coverage at all before this file, and the whole point of
// the seam is that a misconfigured file must never cost the player their playthrough — which is a
// promise only a test can hold.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configuredAgentPreset, createPlayHost } from '../packages/tavern-loader/src/play-host.js'

const PRESET_FILE = 'agent-preset.json'

/** A fake session controller that records payloads and can fail the first create. */
function fakeController({ failFirst = false } = {}) {
  const created = []
  const renamed = []
  return {
    created,
    renamed,
    async create(payload) {
      created.push(payload)
      if (failFirst && created.length === 1) {
        const error = new Error('preset rejected by the host')
        error.status = 404
        throw error
      }
      return { sessionId: 'session-test-1' }
    },
    async rename(args) {
      renamed.push(args)
    },
  }
}

/** Run one create against a temp storage dir holding `content` (or nothing when undefined). */
async function withStorage(content, run) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-agent-preset-'))
  try {
    if (content !== undefined) writeFileSync(join(directory, PRESET_FILE), content, 'utf8')
    return await run(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const hostFor = (controller, storageDir) => createPlayHost({ sessionController: controller }, { storageDir })

test('a configured preset is named on the create payload', async () => {
  await withStorage(JSON.stringify({ agentPreset: 'roleplay' }), async (storageDir) => {
    const controller = fakeController()
    const result = await hostFor(controller, storageDir).createSession({ workspaceId: 'ws-1' })
    assert.equal(result.sessionId, 'session-test-1')
    assert.equal(controller.created.length, 1)
    assert.equal(controller.created[0].agentPreset, 'roleplay')
    assert.equal(controller.created[0].workspaceId, 'ws-1')
  })
})

test('a refused preset is retried without it, and the title still lands', async () => {
  await withStorage(JSON.stringify({ agentPreset: 'ghost' }), async (storageDir) => {
    const controller = fakeController({ failFirst: true })
    const warned = []
    const host = createPlayHost(
      { sessionController: controller },
      { storageDir, logger: { warn: (line) => warned.push(String(line)) } },
    )
    const result = await host.createSession({ workspaceId: 'ws-1', title: '第 1 周目' })
    assert.equal(result.sessionId, 'session-test-1')
    assert.equal(controller.created.length, 2)
    assert.equal(controller.created[0].agentPreset, 'ghost')
    assert.equal('agentPreset' in controller.created[1], false)
    assert.deepEqual(controller.renamed, [{ sessionId: 'session-test-1', title: '第 1 周目' }])
    // The refusal is reported, not swallowed.
    assert.equal(warned.length, 1)
    assert.match(warned[0], /retrying without it/)
    assert.match(warned[0], /404/)
  })
})

test('an absent or unusable file reproduces the upstream payload exactly', async () => {
  for (const content of [undefined, '', '{ not json', JSON.stringify({ agentPreset: '' }), JSON.stringify({ agentPreset: 42 })]) {
    await withStorage(content, async (storageDir) => {
      const controller = fakeController()
      await hostFor(controller, storageDir).createSession({ workspaceId: 'ws-1' })
      assert.equal(controller.created.length, 1)
      assert.deepEqual(controller.created[0], { workspaceId: 'ws-1' })
    })
  }
})

test('without a configuration the original create error propagates untouched', async () => {
  await withStorage(undefined, async (storageDir) => {
    const controller = fakeController({ failFirst: true })
    await assert.rejects(
      () => hostFor(controller, storageDir).createSession({ workspaceId: 'ws-1' }),
      /preset rejected by the host/,
    )
    assert.equal(controller.created.length, 1)
  })
})

test('configuredAgentPreset tolerates a BOM and reports what it ignores', async () => {
  const warned = []
  const logger = { warn: (line) => warned.push(String(line)) }

  await withStorage('\uFEFF' + JSON.stringify({ agentPreset: 'roleplay' }), async (storageDir) => {
    assert.equal(configuredAgentPreset(storageDir, logger), 'roleplay')
  })

  // Path-like values never reach the host; they are reported instead of silently dropped.
  for (const value of ['../roleplay', 'a/b', 'a\\b', '.hidden']) {
    await withStorage(JSON.stringify({ agentPreset: value }), async (storageDir) => {
      assert.equal(configuredAgentPreset(storageDir, logger), undefined)
    })
  }
  assert.equal(warned.length, 4)
  assert.ok(warned.every((line) => line.includes('not a usable preset id')))

  await withStorage('{ not json', async (storageDir) => {
    assert.equal(configuredAgentPreset(storageDir, logger), undefined)
  })
  assert.match(warned.at(-1), /not valid JSON/)

  // Absent stays silent: that is the normal case, not a problem to report.
  const before = warned.length
  await withStorage(undefined, async (storageDir) => {
    assert.equal(configuredAgentPreset(storageDir, logger), undefined)
  })
  assert.equal(warned.length, before)

  // A deployment that supplies no storage dir (embeddings) is not configured, not an error.
  assert.equal(configuredAgentPreset(undefined, logger), undefined)
  assert.equal(configuredAgentPreset('', logger), undefined)
  assert.equal(warned.length, before)
})
