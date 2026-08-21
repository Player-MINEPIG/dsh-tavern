export function workspaceIdForSession(workspaces, sessionId) {
  if (!Array.isArray(workspaces) || typeof sessionId !== 'string' || sessionId === '') return null
  return workspaces.find(item => Array.isArray(item?.sessionIds) && item.sessionIds.includes(sessionId))?.workspaceId ?? null
}

export function workspaceTargetId(workspaceState, sessionId) {
  if (typeof sessionId === 'string' && sessionId !== '') {
    return workspaceIdForSession(workspaceState?.items, sessionId)
  }
  return typeof workspaceState?.recentWorkspaceId === 'string' && workspaceState.recentWorkspaceId !== ''
    ? workspaceState.recentWorkspaceId
    : null
}

export class SessionConfigurationUnavailableError extends Error {
  constructor(diagnostics = []) {
    super(diagnostics[0]?.message ?? '当前配置包含缺失或无效资源，无法创建新会话')
    this.name = 'SessionConfigurationUnavailableError'
    this.diagnostics = structuredClone(diagnostics)
  }
}

export class SessionConfigurationCharacterRequiredError extends Error {
  constructor() {
    super('Mowan playthrough configuration requires a character card')
    this.name = 'SessionConfigurationCharacterRequiredError'
    this.uiKey = 'template.error.needCharacter'
  }
}

/**
 * Runs only through DSH's public WorkspaceRuntime and SessionRuntime faces.
 * Tavern selection persistence is the sole plugin-owned commit and occurs
 * after Host session creation but before navigation.
 */
export async function createCleanSessionWorkflow({
  workspaceId,
  source,
  preview,
  connectWorkspace,
  applySelection,
  openSession,
  refresh,
}) {
  if (workspaceId === null || workspaceId === undefined || workspaceId === '') {
    throw new Error('当前会话不属于 DSH 工作区；请先把会话加入工作区，再创建干净会话')
  }
  const checked = await preview(source)
  if (checked?.available !== true) throw new SessionConfigurationUnavailableError(checked?.diagnostics)
  const targetSessionId = await connectWorkspace(workspaceId)
  await applySelection(targetSessionId, source)
  openSession(targetSessionId)
  refresh()
  return targetSessionId
}

export async function createConfiguredPlaythroughWorkflow({
  source,
  preview,
  applySelection,
  playthroughController,
  openSession,
  refresh,
}) {
  const checked = await preview(source)
  if (checked?.available !== true) throw new SessionConfigurationUnavailableError(checked?.diagnostics)
  const characterId = checked?.selection?.characterCardId
  if (typeof characterId !== 'string' || characterId === '') {
    throw new SessionConfigurationCharacterRequiredError()
  }
  const result = await playthroughController.create({
    character: {
      id: characterId,
      name: checked?.contents?.characterCard?.name || characterId,
    },
    selectionFromSessionId: source?.mode === 'current' ? source.sessionId : null,
    configureSession: targetSessionId => applySelection(targetSessionId, source),
  })
  openSession(result.sessionId)
  refresh()
  return result.sessionId
}
