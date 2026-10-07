import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import {stateSourceTarget} from '../../play/src/stopped-request.js'
import { mapHostError } from '../../play/src/host.js'
import { httpError } from '../../play/src/http.js'
import { sessionCoordinates, requireCoordinates } from '../../play/src/session-coordinates.js'

function missing(name) {
  return httpError(501, `Host ${name} is unavailable`, 'PLAY_HOST_UNAVAILABLE')
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

async function callSessionCreation(controller, method, request, operation) {
  try {
    return await callController(`session.${method}`, controller, method, request)
  } catch (error) {
    if (error.code === 'PLAY_WORKSPACE_ATTACH_FAILED' && error.createdSessionId) {
      operation?.checkpoint('session.created', { sessionId: error.createdSessionId })
    }
    throw error
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
  stateSeeds,
  drafts,
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

    async createSession({ workspaceId, cwd, title, stateSource }, { operation } = {}) {
      const payload = workspaceId ? { workspaceId } : { cwd }
      const source = stateSeeds?.()
      // Public DSH create accepts an explicit id. Persist the target intent before creating it.
      const targetId = stateSource ? `session-${randomUUID()}` : null
      const ticket = stateSource ? await source?.captureSessionSeed({ ...stateSourceTarget(stateSource), sessionId: stateSource.sessionId, targetSessionId: targetId }) : null
      if (targetId) payload.sessionId = targetId
      const value = await callSessionCreation(sessionController, 'create', payload, operation)
      const sessionId = value?.sessionId
      if (typeof sessionId !== 'string' || sessionId === '') throw missing('session.create')
      operation?.checkpoint('session.created', { sessionId })
      if (targetId && sessionId !== targetId) throw httpError(502, 'Host creation returned a different state target', 'PLAY_STATE_TARGET_MISMATCH')
      if (ticket) await source.installSessionSeed({ ticket, sessionId })
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

    async forkSession({ sessionId, atSeq, sessionFormatVersion, stateSource }, { operation } = {}) {
      try {
        const coordinates = await this.coordinates(sessionId)
        requireCoordinates(sessionFormatVersion, coordinates)
        importContexts?.()?.ensureCoordinates?.(sessionId, coordinates)
        const source = stateSeeds?.(), ticket = await source?.captureSessionSeed(stateSource
          ? { ...stateSourceTarget(stateSource), sessionId, prefixEndEventId: atSeq }
          : { kind: 'fork', sessionId, atEventId: atSeq })
        if (typeof sessionController?.resolveAgent !== 'function') throw missing('session.resolveAgent')
        const value = await callSessionCreation(sessionController, 'fork', { sessionId, atSeq }, operation)
        if (typeof value?.sessionId !== 'string' || value.sessionId === '') throw missing('session.fork')
        operation?.checkpoint('session.created', { sessionId: value.sessionId })
        if (ticket) await source.installSessionSeed({ ticket, sessionId: value.sessionId })
        try {
          const resolved = await callController('session.resolveAgent', sessionController, 'resolveAgent', value.sessionId)
          if (resolved?.error !== undefined) throw resolved.error
          const agent = resolved?.agent
          const inbox = agent?.inbox
          if (agent?.id !== value.sessionId || agent.status !== 'idle'
            || !Array.isArray(inbox?.nextTurn) || !Array.isArray(inbox?.nextStep)
            || typeof inbox.clear !== 'function') {
            throw new Error('Forked session has no idle, readable inbox')
          }
          // DSH may seed between-turn inbox splices past the requested reply.
          // Use its public durable cancellation command, preserving inherited seqs
          // and the source session. No caller input has been sent to this child yet.
          if (inbox.nextTurn.length > 0 || inbox.nextStep.length > 0) inbox.clear()
          if (agent.status !== 'idle' || inbox.nextTurn.length > 0 || inbox.nextStep.length > 0) {
            throw new Error('Forked session still has pending input')
          }
        } catch (error) {
          const failure = httpError(502, 'Fork succeeded but pending input could not be cleared', 'PLAY_BRANCH_INPUT_RESET_FAILED')
          failure.cause = error
          throw failure
        }
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

    async promptSession({ sessionId, text, mode = 'queue', requestId = randomUUID() }) {
      const draftService = drafts?.()
      const admit = () => callController('session.prompt', sessionController, 'prompt', {
        requestId,
        sessionId,
        mode,
        content: [{ type: 'text', text }],
      }, new AbortController().signal)
      if (draftService) await draftService.admitPrompt({ sessionId, text, requestId }, admit)
      else await admit()
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

    async copySelection(fromSessionId, toSessionId) {
      if (selections === undefined) return
      selections.set(toSessionId, selections.get(fromSessionId))
      await onSelectionCopied?.(toSessionId, fromSessionId)
    },
  }
}
