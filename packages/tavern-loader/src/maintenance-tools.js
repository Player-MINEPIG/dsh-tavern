import { httpError } from '../../play/src/http.js'
import { parseCatalogJson, validatePlayDocument } from '../../play/src/timeline.js'
import { createContractOperation } from '../../play/src/operation-contract.js'

export const MAINTENANCE_TOOL = 'tavern_cleanup_invalid_playthroughs'

function input(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['action', 'ids', 'workspaceScope'].includes(key))) {
    throw new TypeError('Expected action, ids and workspaceScope')
  }
  const action = value.action ?? 'preview'
  if (!['preview', 'clean', 'restore'].includes(action)) throw new TypeError('Unknown cleanup action')
  if (action === 'preview') {
    if (value.ids !== undefined || value.workspaceScope !== undefined) throw new TypeError('Preview takes no targets')
    return { action }
  }
  if (typeof value.workspaceScope !== 'string' || value.workspaceScope === ''
    || !Array.isArray(value.ids) || value.ids.length === 0 || value.ids.length > 100
    || value.ids.some(id => typeof id !== 'string' || id.trim() === '' || id.length > 200)) {
    throw new TypeError('Mutations require workspaceScope from preview and 1–100 exact target IDs')
  }
  return { action, workspaceScope: value.workspaceScope, ids: [...new Set(value.ids)] }
}

export function createMaintenanceTool({ workspaceStore, maintenance, cleanup, operationJournal, logger }) {
  const scope = () => {
    const binding = workspaceStore.get()
    return JSON.stringify([binding.workspaceId ?? null, binding.rootPath ?? null])
  }
  const assertScope = expected => {
    if (scope() !== expected) throw httpError(409, 'RP workspace changed; preview again', 'PLAY_CLEANUP_CONFLICT')
  }
  return {
    name: MAINTENANCE_TOOL,
    description: 'Optional Tavern maintenance. Default action preview reads the bound RP workspace and lists invalid playthroughs and recovery backups. clean requires exact playthrough ids and workspaceScope from preview; it rechecks that every saved DSH session is missing, removes only Tavern catalog entries and moves dedicated playthrough files into recoverable .tavern-trash backups. Never deletes or archives DSH sessions. restore takes backup ids and merges original Tavern metadata without overwriting files. Request user intent before clean or restore.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['preview', 'clean', 'restore'] },
        ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100 },
        workspaceScope: { type: 'string' },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, execution) {
      const parsed = input(args)
      const signal = execution?.signal
      signal?.throwIfAborted()
      const workspaceScope = scope()
      if (parsed.action === 'preview') {
        const lease = workspaceStore.captureMutationLease()
        let catalog
        try { catalog = parseCatalogJson(workspaceStore.readFile('catalog.json', { validate: validatePlayDocument }).content) } catch (error) {
          if (error.code !== 'PLAY_PATH_NOT_FOUND') throw error
          catalog = { playthroughs: [] }
        }
        const items = []
        for (const row of catalog.playthroughs) {
          signal?.throwIfAborted()
          assertScope(workspaceScope)
          items.push(await maintenance.inspect(row.id, { signal, includeArchived: true }))
        }
        assertScope(workspaceScope)
        if (!lease()) throw httpError(409, 'Workspace changed during preview; retry', 'PLAY_CLEANUP_CONFLICT')
        return { action: 'preview', workspaceScope, items, backups: cleanup.list() }
      }
      assertScope(parsed.workspaceScope)
      const results = []
      for (const id of parsed.ids) {
        signal?.throwIfAborted()
        assertScope(parsed.workspaceScope)
        const operation = createContractOperation({ operation: `playthrough.${parsed.action}`, journal: operationJournal, logger,
          meta: parsed.action === 'clean' ? { playthroughId: id } : {} })
        operation.start()
        try {
          const result = parsed.action === 'clean'
            ? await cleanup.clean(id, { signal, expectedWorkspaceScope: parsed.workspaceScope })
            : cleanup.restore(id, { signal })
          assertScope(parsed.workspaceScope)
          operation.success('completed')
          results.push(result)
        } catch (error) {
          operation.failure(error)
          signal?.throwIfAborted()
          assertScope(parsed.workspaceScope)
          results.push({ id, status: 'failed', code: error.code ?? 'PLAY_CLEANUP_FAILED' })
        }
      }
      return { action: parsed.action, workspaceScope, results }
    },
  }
}

export function installMaintenanceTools(ctx, dependencies) {
  return ctx.inject(['tools'], scope => {
    scope.tools.register(createMaintenanceTool(dependencies))
  })
}
