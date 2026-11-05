// Runtime-owned browser dependencies stay at the DSH loader boundary.
import { Tooltip, Menu, IconPlusOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import { configureDraftComposer } from './play/draft-native-controls.js'
import { configureRenderingTooltip } from './rendering-settings.js'
import { conversationPhase } from '@deepseek-ai/dsh-client-ui-conversation'
import { apply as installClient } from './index.js'

export { name, inject } from './index.js'

export async function apply(ctx) {
  configureRenderingTooltip(Tooltip)
  configureDraftComposer({ Menu, IconPlusOutlineMedium })
  return installClient(ctx, { conversationPhase })
}
