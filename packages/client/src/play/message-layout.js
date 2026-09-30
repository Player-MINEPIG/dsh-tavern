import { createElement as h } from 'react'
import { bubbleCss } from '../../../presentation/bubble-style.js'

export function messageBubbleStyle(style, role = 'assistant') {
  return {
    ...bubbleCss(style, role), boxSizing: 'border-box', minWidth: 0,
    width: 'fit-content', maxWidth: '100%', overflowWrap: 'anywhere',
    marginLeft: role === 'user' ? 'auto' : 0,
    textAlign: role === 'user' ? 'right' : 'left',
  }
}

export const messageAvatarStyle = {
  width: 42, height: 42, padding: 0, overflow: 'hidden', borderRadius: 12,
  border: '1px solid #8b95a5', background: '#dfe6f0', color: '#34445c',
  boxSizing: 'border-box',
}

// Both roles reserve the same avatar columns so text and actions share one lane.
export function MessageRow({ role = 'assistant', avatar, className, children }) {
  return h('div', { className, style: { display: 'grid', gridTemplateColumns: '42px minmax(0,1fr) 42px', columnGap: 10, alignItems: 'start', width: '100%', minWidth: 0 } },
    avatar ? h('div', { className: 'dtv-message-avatar-slot', style: { gridColumn: role === 'user' ? 3 : 1, gridRow: 1 } }, avatar) : null,
    h('div', { className: 'dtv-message-content', style: { gridColumn: 2, gridRow: 1, minWidth: 0 } }, children),
  )
}
