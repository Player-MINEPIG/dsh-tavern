import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { mapHostError } from '../../play/src/host.js'
import { httpError } from '../../play/src/http.js'

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
} = {}) {
  return {
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
      const payload = workspaceId ? { workspaceId } : { cwd }
      const value = await callController('session.create', sessionController, 'create', payload)
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

    async forkSession({ sessionId, atSeq }) {
      try {
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

    async history({ sessionId, beforeSeq, maxMessages }) {
      const inspection = await callController('session.inspect', sessionController, 'inspect', sessionId)
      const throughSeq = inspection?.events?.at(-1)?.seq ?? -1
      const page = await callController('session.page', sessionController, 'page', {
        address: { kind: 'session', sessionId },
        throughSeq,
        ...(beforeSeq === undefined ? {} : { beforeSeq }),
        ...(maxMessages === undefined ? {} : { maxMessages }),
      }, new AbortController().signal)
      return {
        events: page?.records ?? [],
        hasMore: page?.hasMore === true,
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
