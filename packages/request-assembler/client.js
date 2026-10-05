import { createElement as h } from 'react'
import { AssemblyPanel as Panel } from 'dsh-prompt-assembler/client'
import { tavernFetch } from '../client/src/api-fetch.js'
import { getClientUiSettings } from '../client/src/i18n.js'
import { API_V1, API_V3, CLIENT_REFRESH_EVENT } from '../identity.js'
export { assemblyCss, sourceColor } from 'dsh-prompt-assembler/client'
export const AssemblyPanel = props => h(Panel, { ...props, locale: getClientUiSettings().locale, fetcher: tavernFetch, apiRoot: `${API_V1}/assembly-presets`, traceRoot: API_V3, refreshEvent: CLIENT_REFRESH_EVENT })
