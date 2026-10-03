import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
export const SCOPE_CATALOG_SERVICE = 'tavernScopeCatalog'
const fields = ['characterId', 'presetId', 'userId']
const fail = (code, message) => { throw Object.assign(new Error(message), { code }) }
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function scope(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'sessionId')) fail('SCOPE_CATALOG_INVALID', 'Only an optional sessionId is accepted')
  if (value.sessionId !== undefined && (typeof value.sessionId !== 'string' || !value.sessionId || value.sessionId.length > 200)) fail('SCOPE_CATALOG_INVALID', 'Invalid sessionId')
  return value.sessionId === undefined ? {} : { sessionId: value.sessionId }
}
/** Host-only current facts. The caller never supplies character/persona/preset identity claims. */
export function createScopeCatalog({ sources, getSelection, getSelectionRevision, getSession,
  isVisible = () => true, getVisibilityRevision = () => 'local-trusted-host' }) {
  if ([getSelection, getSelectionRevision, getSession].some(value => typeof value !== 'function')) throw TypeError('Trusted session selection and lifetime providers are required')
  const secret = randomBytes(32)
  let disposed = false
  const available = () => { if (disposed) fail('SCOPE_CATALOG_UNAVAILABLE', 'Scope catalog is unloaded') }
  const signature = text => createHmac('sha256', secret).update(text).digest()
  const encode = data => { const text = Buffer.from(JSON.stringify(data)).toString('base64url'); return `${text}.${signature(text).toString('base64url')}` }
  const decode = cursor => {
    if (typeof cursor !== 'string' || cursor.length > 2048) fail('SCOPE_CATALOG_CURSOR', 'Invalid cursor')
    const [text, mac, extra] = cursor.split('.'), expected = signature(text ?? ''), actual = Buffer.from(mac ?? '', 'base64url')
    if (extra !== undefined || actual.length !== expected.length || actual.toString('base64url') !== mac || !timingSafeEqual(actual, expected)) fail('SCOPE_CATALOG_CURSOR', 'Invalid cursor')
    try { return JSON.parse(Buffer.from(text, 'base64url').toString('utf8')) } catch { fail('SCOPE_CATALOG_CURSOR', 'Invalid cursor') }
  }
  const snapshot = (field, boundary) => {
    const source = sources[field]
    if (!source?.scopeMetadata) fail('SCOPE_CATALOG_UNAVAILABLE', `No metadata source for ${field}`)
    const rows = source.scopeMetadata(), visibility = hash(getVisibilityRevision(boundary))
    return { ...rows, visibility, items: rows.items.filter(row => isVisible(field, row, boundary) === true),
      checkCurrent: () => !disposed && rows.checkCurrent() === true && hash(getVisibilityRevision(boundary)) === visibility }
  }
  return { protocolVersion: 1, authority: 'local',
    async searchScopes({ field, query = '', cursor = null, limit = 50, scope: inputScope, signal } = {}) {
      signal?.throwIfAborted(); available()
      if (!fields.includes(field) || typeof query !== 'string' || query.length > 200 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) fail('SCOPE_CATALOG_INVALID', 'Invalid field, query or limit')
      const boundary = scope(inputScope), normalized = query.trim().toLocaleLowerCase('en-US'), rows = snapshot(field, boundary)
      const identity = { field, query: normalized, boundary, generation: rows.generation, visibility: rows.visibility }
      let after = null
      if (cursor !== null) {
        const data = decode(cursor)
        if (hash(data.identity) !== hash(identity) || typeof data.after !== 'string') fail('SCOPE_CATALOG_CURSOR', 'Cursor scope or source generation changed')
        after = data.after
      }
      const matched = rows.items.filter(row => (after === null || row.id > after) && (!normalized || row.name.toLocaleLowerCase('en-US').includes(normalized) || row.id.toLocaleLowerCase('en-US').includes(normalized)))
      const items = matched.slice(0, limit).map(({ id, name }) => ({ id, name }))
      signal?.throwIfAborted()
      if (!rows.checkCurrent()) fail('SCOPE_CATALOG_CHANGED', 'Source visibility changed during paging')
      return { items, nextCursor: matched.length > limit ? encode({ identity, after: items.at(-1).id }) : null }
    },
    async resolveScopeContext({ sessionId, signal } = {}) {
      signal?.throwIfAborted(); available()
      const boundary = scope({ sessionId })
      if (!boundary.sessionId) fail('SCOPE_CATALOG_INVALID', 'sessionId is required')
      const session = getSession(sessionId)
      if (!session) fail('SCOPE_CATALOG_NOT_FOUND', 'Session is unavailable')
      const selection = getSelection(sessionId), token = getSelectionRevision(sessionId)
      const snapshots = Object.fromEntries(fields.map(field => [field, snapshot(field, boundary)]))
      const requested = { characterId: selection.characterCardId ?? null, presetId: selection.presetId ?? null, userId: selection.userId ?? null }
      const resolved = Object.fromEntries(fields.map(field => [field, snapshots[field].items.some(row => row.id === requested[field]) ? requested[field] : null]))
      const resultScope = { sessionId, ...resolved }, revision = hash([resultScope, token, fields.map(field => [snapshots[field].generation, snapshots[field].visibility])])
      const checkCurrent = () => {
        try { return !disposed && getSession(sessionId) === session && getSelectionRevision(sessionId) === token
          && hash([getSelection(sessionId).characterCardId ?? null, getSelection(sessionId).presetId ?? null, getSelection(sessionId).userId ?? null]) === hash(fields.map(field => requested[field]))
          && fields.every(field => snapshots[field].checkCurrent()) } catch { return false }
      }
      signal?.throwIfAborted()
      if (!checkCurrent()) fail('SCOPE_CATALOG_CHANGED', 'Scope changed during resolution')
      return { scope: resultScope, revision, checkCurrent }
    },
    dispose() { disposed = true },
  }
}
export function installScopeCatalog(ctx, catalog) {
  ctx.provide(SCOPE_CATALOG_SERVICE, catalog)
  ctx.effect(() => () => catalog.dispose())
}
