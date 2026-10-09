import { createElement as h } from 'react'
import { AssemblyPanel as Panel } from 'dsh-prompt-assembler/panel'
import { assemblerFetch } from 'dsh-prompt-assembler/client-fetch'
import { TAVERN_HISTORY_FRAGMENT_PRESETS } from '../history-policy/index.js'
import { getClientUiSettings } from '../client/src/i18n.js'
export { assemblyCss, sourceColor } from 'dsh-prompt-assembler/panel'
export const ASSEMBLY_REFRESH_EVENT = 'dsh-prompt-assembler:refresh'
export const AssemblyPanel = props => h(Panel, { ...props, historyFragmentPresets: TAVERN_HISTORY_FRAGMENT_PRESETS, locale: getClientUiSettings().locale, fetcher: assemblerFetch, apiRoot: '/dsh-prompt-assembler/api/v1/assembly-presets', refreshEvent: ASSEMBLY_REFRESH_EVENT })
