// Runtime-owned browser dependencies stay at the DSH loader boundary.
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { configureRenderingTooltip } from './rendering-settings.js'
import { conversationPhase } from '@deepseek-ai/dsh-client-ui-conversation'
import { apply as installClient } from './index.js'
import * as assemblerClient from 'dsh-prompt-assembler/plugin-client'
import { installCompanion } from '../../companion.js'

export { name, inject } from './index.js'

export async function apply(ctx) {
  await installCompanion(ctx, assemblerClient)
  configureRenderingTooltip(Tooltip)
  return installClient(ctx, { conversationPhase })
}
