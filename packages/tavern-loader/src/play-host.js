import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mapHostError } from '../../play/src/host.js'
import { httpError } from '../../play/src/http.js'
import { sessionCoordinates, requireCoordinates } from '../../play/src/session-coordinates.js'

function missing(name) {
  return httpError(501, `Host ${name} is unavailable`, 'PLAY_HOST_UNAVAILABLE')
}

/** Name of the OPTIONAL hand-written config file inside the Tavern storage dir. */
const AGENT_PRESET_FILE = 'agent-preset.json'

/**
 * Which DSH agent preset a NEW 周目 should be created with.
 *
 * Upstream Tavern calls `sessionController.create({ workspaceId | cwd })` and never names a
 * preset, so every new 周目 lands on the deployment default (`standard`). A blank session is
 * the only moment a preset may still be chosen, so this has to be decided HERE, in-band.
 *
 * The value comes from an OPTIONAL file in the Tavern storage dir:
 *   `<storageDir>/agent-preset.json`  →  `{ "agentPreset": "roleplay" }`
 * Absent, unreadable, or empty ⇒ `undefined` ⇒ **exactly the upstream behaviour**.
 * Deleting that one file is the whole rollback.
 *
 * It is read on every create on purpose, so the file can be added, changed, or deleted without
 * restarting the host. A file that exists but cannot be used is reported once and ignored:
 * silently treating a typo as "not configured" is the failure users cannot diagnose.
 *
 * @param storageDir - Tavern storage directory, or undefined in embeddings that supply none.
 * @param logger - optional Cordis logger, used only to report an unusable config file.
 * @returns the preset id to request, or undefined to let the deployment default apply.
 */
export function configuredAgentPreset(storageDir, logger) {
  if (typeof storageDir !== 'string' || storageDir === '') return undefined
  let raw
  try {
    // A leading UTF-8 BOM (Notepad, PowerShell `Out-File`) makes JSON.parse throw, which would
    // otherwise read as "not configured" with nothing to go on.
    raw = readFileSync(join(storageDir, AGENT_PRESET_FILE), 'utf8').replace(/^\uFEFF/, '')
  } catch (error) {
    // Absent is the normal case and stays silent; unreadable is worth a line.
    if (error?.code !== 'ENOENT') {
      logger?.warn?.(`dsh-tavern: cannot read ${AGENT_PRESET_FILE} (${String(error?.code ?? error?.message)}); ignoring it.`)
    }
    return undefined
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    logger?.warn?.(`dsh-tavern: ${AGENT_PRESET_FILE} is not valid JSON (${String(error?.message)}); ignoring it.`)
    return undefined
  }
  const id = parsed?.agentPreset
  if (typeof id !== 'string' || id.trim() === '') return undefined
  const value = id.trim()
  // The id becomes a directory name under <dshHome>/.agent-presets/<id>/, so refuse anything that
  // could escape it. Deliberately a deny-list rather than the official character set: a filter
  // stricter than the platform's would silently ignore a legitimate id instead of reporting it.
  if (value.includes('/') || value.includes('\\') || value.includes('..') || value.startsWith('.')) {
    logger?.warn?.(`dsh-tavern: ${AGENT_PRESET_FILE} agentPreset "${value}" is not a usable preset id; ignoring it.`)
    return undefined
  }
  return value
}
async function callController(name, controller, method, ...args) {
  const operation = controller?.[method]
  if (typeof operation !== 'function') throw missing(name)
  try {
    return await operation.apply(controller, args)
  } catch (error) {
    if (error?.status !== undefined) throw error
    throw mapHostError(error)
  }
}

export function createPlayHost({
  sessionController,
  workspaceController,
  directoryPickerController,
  sessions,
} = {}, {
  selections,
  characters,
  importContexts,
  onSelectionCopied,
  logger,
  storageDir,
} = {}) {
  return {
    async coordinates(sessionId) {
      return sessionCoordinates(await callController('session.inspect', sessionController, 'inspect', sessionId))
    },
    async createWorkspace({ path }) {
      const value = await callController('workspace.create', workspaceController, 'create', { path })
      return {
        workspaceId: value?.workspace?.workspaceId ?? null,
        workspace: value?.workspace ?? null,
        created: value?.created,
      }
    },

    async createDirectory({ path, name }) {
      return callController('directoryPicker.createDirectory', directoryPickerController, 'createDirectory', path, name)
    },

    async createSession({ workspaceId, cwd, title }) {
      const agentPreset = configuredAgentPreset(storageDir, logger)
      const payload = {
        ...(workspaceId ? { workspaceId } : { cwd }),
        ...(agentPreset === undefined ? {} : { agentPreset }),
      }
      let value
      try {
        value = await callController('session.create', sessionController, 'create', payload)
      } catch (error) {
        // A configured preset the host refuses must not cost the player their 周目: fall back to
        // the deployment default and let the session be created anyway.
        // NOTE: this covers what `session.create` itself reports — an unknown or invalid preset id
        // is rejected before any session exists. A preset that resolves but then fails LATER, in
        // its activation callback, is not covered here (see the README note).
        if (agentPreset === undefined) throw error
        const detail = error?.status ?? error?.code ?? (error instanceof Error ? error.message : String(error))
        logger?.warn?.(
          `dsh-tavern: session.create with agent preset "${agentPreset}" failed (${detail});`
          + ' retrying without it. Fix or delete <storageDir>/agent-preset.json.',
        )
        value = await callController('session.create', sessionController, 'create', workspaceId ? { workspaceId } : { cwd })
      }
      const sessionId = value?.sessionId
      if (typeof sessionId !== 'string' || sessionId === '') throw missing('session.create')
      if (typeof title === 'string' && title !== '' && typeof sessionController?.rename === 'function') {
        try {
          await sessionController.rename({ sessionId, title })
        } catch {
          // Title is best-effort; the session itself is already created.
        }
      }
      if (workspaceId && typeof workspaceController?.insertSessionBefore === 'function') {
        await callController('workspace.insertSessionBefore', workspaceController, 'insertSessionBefore', { workspaceId, sessionId })
      }
      return { sessionId }
    },

    async forkSession({ sessionId, atSeq, sessionFormatVersion }) {
      try {
        const coordinates = await this.coordinates(sessionId)
        requireCoordinates(sessionFormatVersion, coordinates)
        importContexts?.()?.ensureCoordinates?.(sessionId, coordinates)
        const value = await callController('session.fork', sessionController, 'fork', { sessionId, atSeq })
        return { sessionId: value.sessionId }
      } catch (error) {
        throw mapHostError(error)
      }
    },

    copyImportContextLineage(fromSessionId, toSessionId, atSeq) {
      const runtime = importContexts?.()
      if (runtime === null || runtime === undefined) return null
      return runtime.copyLineageForBranch(fromSessionId, toSessionId, atSeq)
    },

    async promptSession({ sessionId, text, mode = 'queue' }) {
      await callController('session.prompt', sessionController, 'prompt', {
        requestId: randomUUID(),
        sessionId,
        mode,
        content: [{ type: 'text', text }],
      }, new AbortController().signal)
      return { accepted: true }
    },

    async history({ sessionId, throughSeq: requestedThroughSeq, beforeSeq, maxMessages }) {
      const inspection = requestedThroughSeq === undefined
        ? await callController('session.inspect', sessionController, 'inspect', sessionId) : null
      const throughSeq = requestedThroughSeq === undefined
        ? inspection?.events?.at(-1)?.seq ?? -1
        : requestedThroughSeq
      const page = await callController('session.page', sessionController, 'page', {
        address: { kind: 'session', sessionId },
        throughSeq,
        ...(beforeSeq === undefined ? {} : { beforeSeq }),
        ...(maxMessages === undefined ? {} : { maxMessages }),
      }, new AbortController().signal)
      return {
        events: page?.records ?? [],
        hasMore: page?.hasMore === true,
        throughSeq,
        ...(Number.isSafeInteger(inspection?.meta?.version) ? sessionCoordinates(inspection) : {}),
      }
    },

    async deriveMessages({ sessionId }) {
      const session = sessions?.get?.(sessionId)
      if (typeof session?.deriveMessages === 'function') return session.deriveMessages()
      return null
    },

    prepareImportContext(reference) {
      const runtime = importContexts?.()
      if (runtime === null || runtime === undefined) throw missing('import context')
      return runtime.prepare(reference)
    },

    bindImportContext(sessionId, prepared) {
      const runtime = importContexts?.()
      if (runtime === null || runtime === undefined) throw missing('import context')
      return runtime.bind(sessionId, prepared)
    },

    getImportContextBinding(sessionId) {
      const runtime = importContexts?.()
      if (runtime === null || runtime === undefined) throw missing('import context')
      return runtime.binding(sessionId)
    },

    unbindImportContext(sessionId) {
      const runtime = importContexts?.()
      if (runtime === null || runtime === undefined) throw missing('import context')
      return runtime.unbind(sessionId)
    },

    characterName(sessionId) {
      if (characters === undefined || selections === undefined) return null
      const characterId = selections.get(sessionId ?? null)?.characterCardId
      if (typeof characterId !== 'string' || characterId === '') return null
      try {
        return characters.get(characterId)?.name ?? null
      } catch {
        return null
      }
    },

    copySelection(fromSessionId, toSessionId) {
      if (selections === undefined) return
      selections.set(toSessionId, selections.get(fromSessionId))
      onSelectionCopied?.(toSessionId)
    },
  }
}
