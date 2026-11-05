import { createElement as h, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { translate as t } from '../i18n.js'
import { RP_PERMISSION, withRpPermission, isNativePermissionEntry } from '../rp-permission.js'

const MODEL = 'conversation.input.model', PERMISSION = 'conversation.input.permission'
const noSubscription = () => () => {}
let primitives = null
export function configureDraftComposer(value) { primitives = value }

function useEntry(slots, name) {
  const entries = useSyncExternalStore(useCallback(fn => slots.subscribe(name, fn), [slots, name]), () => slots.entries(name))
  return entries.find(entry => name !== PERMISSION || isNativePermissionEntry(entry))
}

/** Reuse the public slot contributions with draft-owned values and writers. */
export function DraftNativeControls({ native, draft, locked, change, report, primary, onMore }) {
  const modelEntry = useEntry(native.slots, MODEL), permissionEntry = useEntry(native.slots, PERMISSION)
  const [catalog, setCatalog] = useState(null), [permissions, setPermissions] = useState(null), [error, setError] = useState(null)
  const [loading, setLoading] = useState(true), [reload, setReload] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([native.remote.session.modelCatalog(), native.remote.permissionPresets.catalog()]).then(([models, permission]) => {
      if (!models.ok) throw Error(models.error.message)
      if (!permission.ok) throw Error(permission.error.message)
      if (active) { setCatalog(models.value); setPermissions(permission.value); setError(null) }
    }).catch(reason => { if (active) { setError(reason.message); report(reason.message) } }).finally(() => { if (active) setLoading(false) })
    const invalidate = () => { if (active) { setCatalog(null); setPermissions(null); setReload(value => value + 1) } }
    const stops = ['llm/adapters-updated', 'llm/models-updated', 'permission-presets/catalog-changed', 'settings/document-updated'].map(event => native.remote.$on(event, invalidate))
    const stopConnection = native.on('connection/reset', invalidate)
    return () => { active = false; for (const stop of stops) stop?.(); stopConnection?.() }
  }, [native, reload, report])
  const snapshot = useMemo(() => ({ current: draft.modelSelection ?? catalog?.default ?? null, groups: catalog?.groups ?? [], failures: catalog?.failures ?? [], status: loading ? 'loading' : error ? 'error' : 'ready', pending: null, error, routable: null }), [draft.modelSelection, catalog, loading, error])
  const directory = useMemo(() => ({ getSnapshot: () => snapshot, subscribe: noSubscription }), [snapshot])
  const selection = { currentValue: draft.permissionPreset ?? RP_PERMISSION }
  return h('div', { className: 'dtv-draft-native-controls' },
    h('div', { className: 'dtv-draft-tools' },
      primitives && h(primitives.Menu, { open: moreOpen, onClose: () => setMoreOpen(false), side: 'top', portal: true,
        items: [{ id: 'settings', label: t('play.draft.settings') }, { id: 'import', label: t('play.draft.importFile') }],
        onSelect: id => { setMoreOpen(false); onMore(id) },
        anchor: h('button', { className: 'dtv-draft-add', type: 'button', disabled: locked, 'aria-label': t('play.draft.more'), 'aria-haspopup': 'menu', 'aria-expanded': moreOpen, onClick: () => setMoreOpen(!moreOpen) }, h(primitives.IconPlusOutlineMedium, { size: 14 })),
      }),
      permissionEntry && h(permissionEntry.component, {
        locked, t: native.locale.bind(permissionEntry.locale),
        useProjection: () => permissions ? selection : undefined,
        usePermissionCatalog: selector => selector({ value: withRpPermission(permissions) }),
        select: permissionPreset => change({ permissionPreset }),
      })),
    h('div', { className: 'dtv-draft-trailing' },
    modelEntry && h(modelEntry.component, {
      locked, available: true, directory, load: () => setReload(value => value + 1),
      resolveText: value => native.locale.resolveText(value), t: native.locale.bind(modelEntry.locale),
      renderSlot: (_name, _owner, options) => options?.fallback ?? null,
      select: async modelSelection => await change({ modelSelection }) ? { ok: true } : { ok: false, error: { code: 'draft/update', message: t('play.draft.configurationFailed') } },
    }), primary),
    (!modelEntry || !permissionEntry) && h('small', { role: 'status' }, t('play.draft.nativeUnavailable')))
}
