import { createElement as h, useRef, useState, useEffect } from 'react'
import { normalizeAvatar } from '../../presentation/avatar.js'
import { translate } from './i18n.js'

export async function readAvatar(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error(translate('appearance.imageLimit'))
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width > 8192 || bitmap.height > 8192) throw new Error(translate('appearance.imageLimit'))
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const size = Math.min(bitmap.width, bitmap.height)
    canvas.getContext('2d').drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256)
    return normalizeAvatar(canvas.toDataURL('image/webp', 0.8))
  } finally { bitmap.close() }
}

export function AvatarInput({ value, onChange, disabled = false }) {
  const [error, setError] = useState('')
  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  return h('div', { className: 'dtv-avatar-input' },
    h('label', null, translate('appearance.avatar'),
      value ? h('img', { src: value, alt: '', width: 64, height: 64, style: { objectFit: 'cover', borderRadius: 12, display: 'block' } }) : null,
      h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', disabled, onChange: async event => {
        const file = event.target.files?.[0]; event.target.value = ''
        if (!file) return
        const current = ++generation.current
        try { const image = await readAvatar(file); if (current === generation.current) { onChange(image); setError('') } }
        catch (error) { if (current === generation.current) setError(error.message) }
      } })),
    h('button', { type: 'button', disabled: disabled || !value, onClick: () => { generation.current++; onChange(null) } }, translate('appearance.clearImage')),
    h('small', { style: { display: 'block' } }, translate('appearance.imageHint')),
    error ? h('p', { role: 'alert' }, error) : null,
  )
}
