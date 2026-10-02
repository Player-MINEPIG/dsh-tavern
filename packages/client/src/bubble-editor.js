import { createElement as h, useState, useEffect, useRef } from 'react'
import { BUBBLE_STYLES, normalizeBubbleStyle } from '../../presentation/bubble-style.js'
import { translate } from './i18n.js'
import { PlayTurnActionsPreview } from './play/turn-actions.js'
import { MessageRow, messageAvatarStyle, messageBubbleStyle } from './play/message-layout.js'
export function BubbleEditor({ settings, update, busy, status, onDirty }) {
  const selected = settings.bubbleStyle ?? BUBBLE_STYLES[0]
  const fileRef = useRef(null)
  const withSize = style => ({ ...style, fontSize: style.fontSize ?? Math.round(14 * settings.textScale) })
  const selectedJson = JSON.stringify(withSize(selected), null, 2)
  const [draft, setDraft] = useState(selectedJson)
  useEffect(() => setDraft(selectedJson), [selectedJson])
  const [actionScale, setActionScale] = useState(settings.actionScale)
  useEffect(() => setActionScale(settings.actionScale), [settings.actionScale])
  const [error, setError] = useState('')
  useEffect(()=>{onDirty?.(draft !== selectedJson || actionScale !== settings.actionScale)},[draft,selectedJson,actionScale,settings.actionScale,onDirty])
  let preview, parsed
  try { parsed = JSON.parse(draft); preview = normalizeBubbleStyle(withSize(parsed)) } catch {}
  const choose = value => { setDraft(JSON.stringify(value, null, 2)); setError('') }
  return h('section', { className: 'dtv-bubble-editor' },
    h('div', { className: 'dtv-style-toolbar' },
      h('button', { type: 'button', className: 'dtv-button', disabled: busy, onClick: () => fileRef.current?.click() }, translate('common.importJson')),
      h('button', { type: 'button', className: 'dtv-button', disabled: !preview || busy, onClick: () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(preview, null, 2)], { type: 'application/json' }))
        const link = document.createElement('a'); link.href = url; link.download = 'tavern-bubble.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      } }, translate('common.exportJson')),
      h('button', { type: 'button', className: 'dtv-button', disabled: busy, onClick: () => choose({ ...BUBBLE_STYLES[0], fontSize: preview?.fontSize ?? 14, name: translate('appearance.newStyle') }) }, translate('appearance.createStyle')),
    ),
    h('input', { ref: fileRef, hidden: true, 'aria-label': translate('appearance.styleFile'), type: 'file', accept: '.json,application/json', onChange: async event => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (!file) return
      try { if (file.size > 16384) throw new Error('Style exceeds 16 KiB'); choose(withSize(normalizeBubbleStyle(JSON.parse(await file.text())))) } catch (error) { setError(error.message) }
    } }),
    status?.text ? h('div', { className: 'dtv-status', 'data-error': status.error || undefined, role: 'status' }, status.text) : null,
    h('p', null, translate('appearance.styleHint')),
    h('label', null, translate('appearance.presets'), h('select', { value: BUBBLE_STYLES.findIndex(style => JSON.stringify(normalizeBubbleStyle({ ...style, fontSize: preview?.fontSize })) === JSON.stringify(preview)), onChange: event => choose({ ...BUBBLE_STYLES[Number(event.target.value)], fontSize: preview?.fontSize ?? 14 }) },
      h('option', { value: -1, disabled: true }, translate('appearance.custom')),
      ...BUBBLE_STYLES.map((style, index) => h('option', { key: style.name, value: index }, style.name)))),
    typeof parsed?.name === 'string' ? h('label', null, translate('appearance.styleName'), h('input', { value: parsed.name, maxLength: 80, onChange: event => choose({ ...parsed, name: event.target.value }) })) : null,
    preview ? h('div', { style: { display: 'grid', gap: 8, marginTop: 12 } },
      h('label', null, translate('appearance.fontSize'),
        h('div', { className: 'dtv-size-control' },
          h('input', { type: 'range', min: 8, max: 48, step: 1, value: preview.fontSize, 'aria-label': translate('appearance.fontSizeSlider'), onChange: event => choose({ ...preview, fontSize: Number(event.target.value) }) }),
          h('input', { type: 'number', min: 8, max: 48, step: 1, value: preview.fontSize, 'aria-label': translate('appearance.fontSize'), onChange: event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 8 && value <= 48) choose({ ...preview, fontSize: value }) } }),
          h('span', null, 'px'))),
      h('label', null, translate('conversationSettings.actionScale'), `: ${Math.round(actionScale * 100)}%`,
        h('input', { type: 'range', min: 0.75, max: 1.5, step: 0.05, value: actionScale, 'aria-label': translate('conversationSettings.actionScale'), 'aria-valuetext': `${Math.round(actionScale * 100)}%`, onChange: event => setActionScale(Number(event.target.value)) })),
      h('p', null, translate('conversationSettings.actionScale.help')),
      ...['radius', 'padding', 'borderWidth'].map(token => h('label', { key: token }, translate(`appearance.${token}`), `: ${preview[token]} px`, h('input', { type: 'range', min: token === 'padding' ? 8 : 0, max: token === 'radius' ? 32 : token === 'padding' ? 24 : 3, value: preview[token], onChange: event => choose({ ...preview, [token]: Number(event.target.value) }) }))),
      h('label', null, translate('appearance.font'), h('select', { value: preview.font, onChange: event => choose({ ...preview, font: event.target.value }) }, ...['sans','serif','mono'].map(font => h('option', { key: font, value: font }, font)))),
      ...['user','assistant'].map(role => h('fieldset', { key: role }, h('legend', null, translate(`appearance.${role}`)), ...['background','text','border'].map(token => h('label', { key: token, style: { display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 8 } }, translate(`appearance.${token}`), h('input', { type: 'color', value: preview[role][token], onChange: event => choose({ ...preview, [role]: { ...preview[role], [token]: event.target.value } }) }))))),
    ) : null,
    h('details', null, h('summary', null, translate('appearance.editJson')), h('textarea', { 'aria-label': translate('appearance.editJson'), value: draft, onChange: event => setDraft(event.target.value), spellCheck: false, rows: 14, style: { width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' } })),
    preview ? h('div', { 'aria-label': translate('appearance.preview'), style: { display: 'grid', gap: 8, margin: '12px 0' } },
      ...['user', 'assistant'].map(role => h(MessageRow, { key: role, role,
        avatar: h('div', { 'aria-label': translate(`appearance.${role}`), style: { ...messageAvatarStyle, display: 'grid', placeItems: 'center' } }, translate(`appearance.${role}`).slice(0, 1)),
      }, h('div', { style: messageBubbleStyle(preview, role) },
        h('div', { style: { textAlign: role === 'user' ? 'right' : 'left', font: '600 11px system-ui', opacity: 0.65, marginBottom: 6 } }, translate(`appearance.${role}`)),
        translate(role === 'user' ? 'appearance.previewUser' : 'appearance.previewAssistant')))),
      h(MessageRow, null, h(PlayTurnActionsPreview, { scale: actionScale })),
    ) : h('p', { role: 'alert' }, translate('appearance.invalidStyle')),
    h('button', { type: 'button', className: 'dtv-button dtv-primary', disabled: busy || !preview, onClick: () => update({ ...settings, textScale: 1, actionScale, bubbleStyle: preview }) }, translate('appearance.apply')),
    error ? h('p', { role: 'alert' }, error) : null,
    h('label', { className: 'dtv-check', style: { marginTop: 18 } }, h('input', { type: 'checkbox', checked: settings.interactiveCards === true, disabled: busy, onChange: event => update({ ...settings, interactiveCards: event.target.checked }) }), translate('appearance.scripts')),
    h('p', null, translate('appearance.scriptHint')),
  )
}
