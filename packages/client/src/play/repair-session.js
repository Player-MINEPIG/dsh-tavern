import { CLIENT_REFRESH_EVENT } from '../../../identity.js'
import { isSafeCatalogSegment } from '../../../play/src/timeline.js'
import { translate } from '../i18n.js'
import { playthroughDisplayTitle } from './title.js'

export async function openRepairSession(ctx, playClient, switchToNative, workspace, playthrough) {
  const current = await playClient.getWorkspace()
  if (!workspace?.workspaceId || current.workspaceId !== workspace.workspaceId || current.rootPath !== workspace.rootPath
    || !isSafeCatalogSegment(playthrough.id)) throw new Error(translate('play.io.repairSelectionChanged'))

  const command = `/tavern-repair assist ${playthrough.id}`
  const id = await ctx.sessions.create({ workspaceId: workspace.workspaceId })
  try {
    await switchToNative()
    await ctx.uiWorkspace.openSession(id)
    await ctx.sessions.using(id, { source: 'controllerOperation' }, async ref => {
      const { session } = await ref.ready
      // A title is optional when the Host cannot persist it.
      await session.rename(translate('play.io.repairSessionTitle', { title: playthroughDisplayTitle(playthrough) }).slice(0, 120)).catch(() => {})
      const result = await session.command(command)
      if (!result.ok || !result.value.matched) throw new Error(result.error?.message ?? command)
    })
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  } catch (error) {
    window.alert(translate('play.io.repairDispatchFailed', { id, command, error: error.message }))
  }
}
