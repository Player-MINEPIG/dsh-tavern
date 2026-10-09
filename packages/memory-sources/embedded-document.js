import { hash } from './policy.js'
import { parseCharacterBook } from '../world-book/src/index.js'
/** Same stable document and revision input for catalog, activation and dependency use. */
export function embeddedWorldBookDocument(character) {
  const raw = character?.data?.characterBook
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const name = character.name || character.data?.name || '角色卡世界书'
  return JSON.parse(JSON.stringify({ id: `character:${character.id}:embedded-world-book`, name, ownerCharacterId: character.id, ownerRevision: hash({id:character.id,name:character.name,updatedAt:character.updatedAt,data:character.data}), kind: 'embedded-character-book', book: parseCharacterBook(raw, { name }) }))
}
