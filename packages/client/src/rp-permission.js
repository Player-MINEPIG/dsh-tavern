import { createElement as h, useCallback, useEffect, useMemo, useState } from 'react'
import { API_V1, CLIENT_REFRESH_EVENT } from '../../identity.js'
import { tavernFetch } from './api-fetch.js'
import { translate as t } from './i18n.js'

export const RP_PERMISSION = 'tavern-rp'
const SLOT = 'conversation.input.permission'

export function withRpPermission(catalog) {
  return catalog ? { ...catalog, options: [{ value: RP_PERMISSION, name: t('rp.permission.name'), description: t('rp.permission.description') }, ...catalog.options] } : catalog
}

async function rpRequest(sessionId, body) {
  const response = await tavernFetch(`${API_V1}/rp-mode?sessionId=${encodeURIComponent(sessionId)}`, body ? { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, ...body }) } : { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw Error(result.error ?? `HTTP ${response.status}`)
  return result
}

function RpPermissionSelect({ Native, sessionId, useSession, useProjection, usePermissionCatalog, ...props }) {
  const [rp, setRp] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const session = useSession(value => value), permission = useProjection('permissions')
  const catalog = usePermissionCatalog(state => state.value)
  const combinedCatalog = useMemo(() => withRpPermission(catalog), [catalog, props.t])
  const refresh = useCallback(() => rpRequest(sessionId), [sessionId])
  useEffect(() => {
    let active = true, sequence = 0
    const read = () => { const epoch = ++sequence; void refresh().then(value => { if (active && epoch === sequence) { setRp(value); setError('') } }, reason => { if (active && epoch === sequence) setError(reason.message) }) }
    read()
    window.addEventListener(CLIENT_REFRESH_EVENT, read)
    return () => { active = false; window.removeEventListener(CLIENT_REFRESH_EVENT, read) }
  }, [refresh, session.running, permission?.currentValue])
  const active = (rp?.pending ?? rp?.rp)?.active === true
  const selection = permission ? { currentValue: active ? RP_PERMISSION : rp?.pendingPermissionPreset ?? permission.currentValue } : undefined
  return h('div', { className: 'dtv-rp-permission' }, h(Native, {
    ...props, locked: props.locked || busy || rp === null,
    useProjection: () => selection,
    usePermissionCatalog: selector => selector({ value: combinedCatalog }),
    select: async preset => {
      setBusy(true); setError('')
      try {
        const result = await rpRequest(sessionId, preset === RP_PERMISSION ? { active: true } : { active: false, permissionPreset: preset })
        setRp(result); window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT)); return true
      } catch (reason) { setError(reason.message); return false }
      finally { setBusy(false) }
    },
  }), rp?.pending && h('small', { role: 'status' }, t('rp.permission.pending')), error && h('small', { role: 'alert' }, error))
}

export function installRpPermission(ctx) {
  let dispose = null, original = null
  const sync = () => {
    const next = ctx.slots.entries(SLOT).find(entry => entry.component !== RpPermissionSelect)
    if (next === original) return
    original = next
    const previous = dispose; dispose = null; previous?.()
    if (!next) return
    dispose = ctx.slots.register({ name: SLOT, priority: -100, locale: next.locale, inject: sessionId => ({ ...next.inject(sessionId), Native: next.component, sessionId }) }, RpPermissionSelect)
  }
  const stop = ctx.slots.subscribe(SLOT, sync)
  sync()
  ctx.effect(() => () => { stop(); dispose?.() }, 'Tavern: RP permission selector')
}

export const isNativePermissionEntry = entry => entry.component !== RpPermissionSelect
