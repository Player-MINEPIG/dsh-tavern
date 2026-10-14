import { PLUGIN_ID } from './identity.js'

// DSH claims unowned document styles when another client factory materializes.
// Tag before insertion, and reclaim an existing legacy tag on hot replacement.
export function installTavernStyle(key, css, legacyMarker) {
  let style = document.querySelector(`style[data-plugin-css="${key}"]`)
    ?? (legacyMarker ? document.querySelector(`style[${legacyMarker}]`) : null)
  if (!style) style = document.createElement('style')
  style.dataset.plugin = PLUGIN_ID
  style.dataset.pluginCss = key
  if (legacyMarker) style.setAttribute(legacyMarker, '')
  if (style.textContent !== css) style.textContent = css
  if (!style.isConnected) document.head.append(style)
  return style
}
