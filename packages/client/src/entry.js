// Runtime-owned browser dependencies stay at the DSH loader boundary.
import { conversationPhase } from '@deepseek-ai/dsh-client-ui-conversation'
import { apply as installClient } from './index.js'

export { name, inject } from './index.js'

export function apply(ctx) {
  return installClient(ctx, { conversationPhase })
}
