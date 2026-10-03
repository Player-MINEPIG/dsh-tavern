import { imageCss } from './card-images.js'
import { normalizeAvatar } from '../../../presentation/avatar.js'

// Fail closed for resource-bearing CSS and escapes. This is deliberately a
// restricted CSS subset, not a claim to implement a complete CSS sanitizer.
// Layout, variables, colors, gradients, media queries and keyframes still work.
export function localCss(css) {
  const value = String(css).replace(/\/\*[\s\S]*?\*\//g, '')
  return /\\|@import\b|(?:url|image|image-set|-webkit-image-set|src)\s*\(/i.test(value) ? '' : value
}
export function restrictStaticResources(fragment, {liveImages = false} = {}) {
  for (const element of fragment.querySelectorAll('*')) {
    for (const name of ['srcset', 'poster', 'background', 'ping']) element.removeAttribute(name)
    if (element.hasAttribute('src')) {
      try {
        if (element.tagName !== 'IMG' || !normalizeAvatar(element.getAttribute('src'))) element.removeAttribute('src')
      } catch { element.removeAttribute('src') }
    }
    if (element.hasAttribute('style')) element.setAttribute('style', (liveImages?imageCss:localCss)(element.getAttribute('style')))
    if (element.tagName === 'STYLE') element.textContent = (liveImages?imageCss:localCss)(element.textContent)
  }
}
