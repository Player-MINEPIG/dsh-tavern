// Runtime-owned browser dependencies stay at the DSH loader boundary.
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { configureRenderingTooltip } from './rendering-settings.js'
import { conversationPhase } from '@deepseek-ai/dsh-client-ui-conversation'
import { apply as installClient } from './index.js'

export { name, inject } from './index.js'

export function apply(ctx) {
  configureRenderingTooltip(Tooltip)
  return installClient(ctx, { conversationPhase })
}
