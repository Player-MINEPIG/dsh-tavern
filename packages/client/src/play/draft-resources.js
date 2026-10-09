import { API_V1, API_V2, CLIENT_REFRESH_EVENT } from '../../../identity.js'
import { tavernFetch } from '../api-fetch.js'

/** An explicit resource-selection target. It never impersonates a DSH Session. */
export function createDraftResourceTarget({ client, draftId, label, fetcher = tavernFetch }) {
  let current
  const resource = async (path, options) => {
    const response = await fetcher(path.startsWith(API_V2) ? path : `${API_V1}${path}`, { ...options, ...(options?.body ? { headers: { 'Content-Type': 'application/json', ...options.headers } } : {}) }), data = await response.json()
    if (!response.ok || data?.ok === false) throw new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`)
    return data
  }
  const read = async () => { current = await client.getDraft(draftId); return current.draft }
  const patch = async (draft, value) => {
    current = await client.putDraft(draftId, { ...value, expectedRevision: draft.revision })
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    return current.draft
  }
  const active = async () => {
    const draft = await read(), selection = draft.selection
    const [preset, character, user, books, userBooks, presetBooks, characterBooks] = await Promise.all([
      selection.presetId ? resource(`/presets/${encodeURIComponent(selection.presetId)}`) : null,
      resource(`/characters/${encodeURIComponent(selection.characterCardId)}`),
      selection.userId ? resource(`/users/${encodeURIComponent(selection.userId)}`) : null,
      resource('/world-books'), selection.userId ? resource(`/users/${encodeURIComponent(selection.userId)}/world-books`) : null,
      selection.presetId ? resource(`/presets/${encodeURIComponent(selection.presetId)}/world-books`) : null,
      resource(`/characters/${encodeURIComponent(selection.characterCardId)}/world-books`),
    ])
    const userBoundIds = userBooks?.binding?.worldBookIds ?? [], presetBoundIds = presetBooks?.binding?.worldBookIds ?? [], characterBoundIds = characterBooks?.binding?.worldBookIds ?? []
    // Describe selected sources, including ones whose entries have not triggered.
    // Keep inherited bindings distinct from editable playthrough selections.
    const effectiveIds = [...new Set([...selection.worldBookIds, ...userBoundIds, ...presetBoundIds, ...characterBoundIds])]
    const worldBooks = effectiveIds.map(id => books.worldBooks.find(book => book.id === id) ?? { id, name: id })
    const card = character.character, embedded = card?.data?.characterBook
    if (embedded && typeof embedded === 'object' && !Array.isArray(embedded)) worldBooks.push({
      id: `character:${card.id}:embedded-world-book`, name: card.name || card.data?.name || '角色卡世界书',
      ownerCharacterId: card.id, kind: 'embedded-character-book',
    })
    return {
      selection: { ...selection, worldBookIds: effectiveIds }, sessionSelection: selection,
      resources: { preset: preset?.preset ?? null, characterCard: card, user: user?.user ?? null, worldBooks },
      worldBookSelection: { explicitIds: selection.worldBookIds, userBoundIds, presetBoundIds, characterBoundIds, effectiveIds },
      catalog: { worldBooks: books.worldBooks },
    }
  }
  return {
    id: draftId,
    get label() { return current?.playthrough?.title ? `${label} · ${current.playthrough.title}` : label },
    get editable() { return !current || current.draft.phase === 'draft' },
    read, active,
    async getSelection() { return (await read()).assembly },
    async previewAssembly(preset) {
      const draft = await read()
      return resource(`${API_V2}/drafts/${encodeURIComponent(draftId)}/preview`, { method: 'POST', body: JSON.stringify({ expectedRevision: draft.revision, preset }) })
    },
    async applyAssembly(id) { const draft = await patch(await read(), { assemblyPresetId: id }); return { selection: draft.assembly } },
    async request(path, options = {}) {
      const route = path.split('?')[0], method = options.method ?? 'GET'
      if (route === '/active') return active()
      if (route === '/presets' && method === 'GET') { const [data, draft] = await Promise.all([resource('/presets'), read()]); return { ...data, selectedId: draft.selection.presetId } }
      if (['/select', '/user-selection', '/world-book-selection', '/character-selection', '/rp-mode'].includes(route)) {
        const draft = await read(), selection = { ...draft.selection }, body = options.body ? JSON.parse(options.body) : {}
        if (method !== 'GET') {
          if (route === '/select') selection.presetId = body.id
          if (route === '/user-selection') selection.userId = body.userId
          if (route === '/world-book-selection') selection.worldBookIds = body.worldBookIds
          if (route === '/character-selection') {
            if (body.characterCardId !== selection.characterCardId) throw new Error('Start a new playthrough to change its character')
            selection.character = body.character
          }
          if (route === '/rp-mode') throw new Error('Opening drafts are RP playthroughs')
          await patch(draft, { selection })
        }
        if (route === '/character-selection') return { selection: { characterCardId: selection.characterCardId, character: selection.character } }
        if (route === '/rp-mode') return { rp: { active: true } }
        return { selection }
      }
      return resource(path, options)
    },
  }
}
