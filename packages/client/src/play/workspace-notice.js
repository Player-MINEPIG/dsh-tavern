import { createElement, useState } from 'react'
import { createLocalizedElement, uiMessage } from '../i18n.js'

const h = createLocalizedElement(createElement)

export function RpWorkspaceNotice() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return h('aside', { className: 'dtv-rp-workspace-warning', role: 'note' },
    h('button', { className: 'dtv-close', type: 'button',
      title: uiMessage('settings.rpWorkspace.warningClose'),
      'aria-label': uiMessage('settings.rpWorkspace.warningClose'),
      onClick: () => setDismissed(true) }, '✕'),
    h('h3', null, uiMessage('settings.rpWorkspace.warningTitle')),
    h('p', null, uiMessage('settings.rpWorkspace.warningUse')),
    h('p', null, uiMessage('settings.rpWorkspace.warningResidue')),
  )
}
