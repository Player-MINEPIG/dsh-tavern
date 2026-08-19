import { callHost, mapHostError } from '../../play/src/host.js'
import { httpError } from '../../play/src/http.js'

function missing(name) {
  return httpError(501, `Host ${name} is unavailable`, 'PLAY_HOST_UNAVAILABLE')
}

export function createPlayHost(ctx, { selections, characters, importContexts } = {}) {
  const api = () => ctx.get('apiProxy')
  const clientWorkspaces = () => ctx.get('workspaces')

  return {
    async createWorkspace({ path }) {
      const proxy = api()
      if (typeof proxy?.workspace?.create === 'function') {
        const value = await callHost(payload => proxy.workspace.create(payload), { path })
        return {
          workspaceId: value?.workspace?.workspaceId ?? value?.workspaceId ?? null,
          workspace: value?.workspace ?? value,
          created: value?.created,
        }
      }
      const workspaces = clientWorkspaces()
      if (typeof workspaces?.create === 'function') {
        const workspace = await workspaces.create({ path })
        return {
          workspaceId: workspace?.workspaceId ?? workspace?.id ?? null,
          workspace,
        }
      }
      return { workspaceId: null }
    },

    async createDirectory({ path, name }) {
      const proxy = api()
      if (typeof proxy?.host?.createDirectory === 'function') {
        const value = await callHost(payload => proxy.host.createDirectory(payload), { path, name })
        return value?.path ?? value
      }
      const workspaces = clientWorkspaces()
      if (typeof workspaces?.createDirectory === 'function') {
        return workspaces.createDirectory(path, name)
      }
      throw missing('createDirectory')
    },

    async createSession({ workspaceId, cwd, title }) {
      const proxy = api()
      if (typeof proxy?.sessions?.create !== 'function') throw missing('session.create')
      const payload = workspaceId ? { workspaceId } : { cwd }
      const value = await callHost(request => proxy.sessions.create(request), payload)
      const sessionId = value?.sessionId
      if (typeof sessionId !== 'string' || sessionId === '') throw missing('session.create')
      if (typeof title === 'string' && title !== '' && typeof proxy.sessions.rename === 'function') {
        try {
          await callHost(request => proxy.sessions.rename(request), { sessionId, title })
        } catch {
          // Title is best-effort; the session itself is already created.
        }
      }
      if (workspaceId && typeof proxy.workspace?.insertSessionBefore === 'function') {
        await callHost(request => proxy.workspace.insertSessionBefore(request), { workspaceId, sessionId })
      }
      return { sessionId }
    },

    async forkSession({ sessionId, atSeq }) {
      const proxy = api()
      if (typeof proxy?.sessions?.fork !== 'function') throw missing('session.fork')
      try {
        const value = await callHost(request => proxy.sessions.fork(request), { sessionId, atSeq })
        return { sessionId: value.sessionId }
      } catch (error) {
        throw mapHostError(error)
      }
    },

    async promptSession({ sessionId, text, mode = 'queue' }) {
      const proxy = api()
      if (typeof proxy?.sessions?.prompt !== 'function') throw missing('session.prompt')
      await callHost(request => proxy.sessions.prompt(request), {
        sessionId,
        mode,
        content: [{ type: 'text', text }],
      })
      return { accepted: true }
    },

    async history({ sessionId, beforeSeq, maxMessages }) {
      const proxy = api()
      if (typeof proxy?.sessions?.history !== 'function') throw missing('session.history')
      return callHost(request => proxy.sessions.history(request), {
        sessionId,
        ...(beforeSeq === undefined ? {} : { beforeSeq }),
        ...(maxMessages === undefined ? {} : { maxMessages }),
      })
    },

    async deriveMessages({ sessionId }) {
      const session = ctx.get('sessions')?.get?.(sessionId)
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
    },
  }
}

export { rpcRequest, unwrapRpc } from '../../play/src/host.js'
