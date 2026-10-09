// Shared Host/browser cache bounds and inert URL normalization.
export const MAX_RENDER_SOURCE = 8 * 1024 * 1024
export const DEPENDENCY_LIMITS = Object.freeze({count:128, depth:8, bytes:24*1024*1024})
export const RENDERING_CACHE_LIMITS = Object.freeze({count:512, bytes:64*1024*1024})
export const MAX_DEPENDENCY_IDENTITIES = 4096
export function externalUrl(value, base) {
  try {
    const url = new URL(value, base)
    const host = url.hostname.toLowerCase().replace(/\.+$/, '')
    url.hostname=host
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') ||
      /^[\d.]+$/.test(host) || host.includes(':') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return null
    url.hash = ''
    return url.href
  } catch { return null }
}
