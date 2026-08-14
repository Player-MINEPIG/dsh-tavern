import { apply as applyPresetClient } from '../../preset/src/client.js'
import { applyCharacterClient } from '../../character/src/client.js'

export const name = 'dsh-tavern'
export const inject = ['slots', 'layout']

export function apply(ctx) {
  applyPresetClient(ctx)
  applyCharacterClient(ctx)
}
