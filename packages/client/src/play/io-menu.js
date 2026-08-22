import {
  createElement,
  useEffect,
  useRef,
  useState,
} from 'react'
import { PLUGIN_ID } from '../../../identity.js'
import {
  createLocalizedElement,
  rawText,
  uiMessage,
  unwrapText,
} from '../i18n.js'
import {
  loadPlaythroughExport,
  playthroughExportDocument,
} from './export.js'

import { renamePlaythrough } from './create.js'
const h = createLocalizedElement(createElement)

const css = `
.dtv-play-io{position:relative;display:inline-flex}.dtv-play-io-trigger{width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}.dtv-play-io-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-play-io-menu{position:absolute;z-index:30;left:0;bottom:calc(100% + 6px);min-width:210px;padding:6px;border:1px solid var(--dsw-alias-border-subtle);border-radius:11px;background:var(--dsw-alias-bg-layer-1,#181a20);box-shadow:0 12px 30px #0008;display:flex;flex-direction:column;gap:2px}.dtv-play-io[data-placement=sidebar] .dtv-play-io-menu{left:auto;right:0;bottom:auto;top:calc(100% + 4px);width:max-content;min-width:0;max-width:168px}.dtv-play-io[data-placement=sidebar] .dtv-play-io-item{white-space:nowrap}
.dtv-play-io-item{min-height:34px;border:0;border-radius:8px;padding:6px 9px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;text-align:left;cursor:pointer}.dtv-play-io-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-io-item:disabled{opacity:.45;cursor:default}.dtv-play-io-error{max-width:240px;margin:3px 5px;color:var(--dsw-alias-state-error);font-size:10px;overflow-wrap:anywhere}
`

function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-io"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-play-io`
  style.textContent = css
  document.head.append(style)
}

function safeFilename(value) {
  const normalized = String(value ?? 'playthrough').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim()
  return normalized === '' ? 'playthrough' : normalized.slice(0, 100)
}

function downloadDocument(playthrough, document) {
  const blob = new Blob([document.content], { type: document.mime })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFilename(playthrough.title || playthrough.id)}.${document.extension}`
  anchor.style.display = 'none'
  window.document.body.append(anchor)
  anchor.click()
  anchor.remove()
  queueMicrotask(() => URL.revokeObjectURL(url))
}

export function PlayIoMenu({ playClient, playthrough, trigger = '+', placement = 'composer', onRelink }) {
  installStyles()
  const root = useRef(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    window.document.addEventListener('pointerdown', close)
    return () => window.document.removeEventListener('pointerdown', close)
  }, [open])

  const exportAs = async format => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const snapshot = await loadPlaythroughExport(playClient, playthrough)
      downloadDocument(playthrough, playthroughExportDocument(snapshot, format))
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const rename = async () => {
    if (busy) return
    const title = window.prompt(unwrapText(uiMessage('play.io.renamePrompt')), playthrough.title ?? '')
    if (title === null) return
    if (title.trim() === '' || title.trim().length > 120) {
      setError(unwrapText(uiMessage('play.io.renameInvalid')))
      return
    }
    setBusy(true)
    setError('')
    try {
      await renamePlaythrough(playClient, playthrough, title)
      window.dispatchEvent(new Event('pmp-dsh-tavern:refresh'))
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }
  return h('div', { ref: root, className: 'dtv-play-io', 'data-placement': placement },
    h('button', {
      type: 'button',
      className: 'dtv-play-io-trigger',
      title: uiMessage('play.io.menu'),
      'aria-label': uiMessage('play.io.menu'),
      'aria-expanded': open,
      onClick: event => { event.stopPropagation(); setOpen(value => !value) },
    }, rawText(trigger)),
    !open ? null : h('div', { className: 'dtv-play-io-menu' },
      h('button', { type: 'button', className: 'dtv-play-io-item', disabled: busy, onClick: rename }, uiMessage('play.io.rename')),
      typeof onRelink !== 'function' ? null : h('button', {
        type: 'button',
        className: 'dtv-play-io-item',
        disabled: busy,
        onClick: () => { setOpen(false); onRelink() },
      }, uiMessage('play.io.relinkCharacter')),
      h('button', { type: 'button', className: 'dtv-play-io-item', disabled: busy, onClick: () => exportAs('html') }, uiMessage('play.io.exportHtml')),
      h('button', { type: 'button', className: 'dtv-play-io-item', disabled: busy, onClick: () => exportAs('st') }, uiMessage('play.io.exportSt')),
      h('button', { type: 'button', className: 'dtv-play-io-item', disabled: busy, onClick: () => exportAs('bundle') }, uiMessage('play.io.exportBundle')),
      error === '' ? null : h('p', { className: 'dtv-play-io-error' }, rawText(error)),
    ),
  )
}
