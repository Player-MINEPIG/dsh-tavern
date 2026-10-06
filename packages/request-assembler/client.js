import { createElement as h } from 'react'
import { AssemblyPanel as Panel } from 'dsh-prompt-assembler/panel'
import { assemblerFetch } from 'dsh-prompt-assembler/client-fetch'
import { getClientUiSettings } from '../client/src/i18n.js'
import { CLIENT_REFRESH_EVENT } from '../identity.js'
export { assemblyCss, sourceColor } from 'dsh-prompt-assembler/panel'
export const AssemblyPanel = props => h(Panel, { ...props, locale: getClientUiSettings().locale, fetcher: assemblerFetch, apiRoot: '/dsh-prompt-assembler/api/v1/assembly-presets', refreshEvent: CLIENT_REFRESH_EVENT })
