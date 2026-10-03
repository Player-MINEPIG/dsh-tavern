// Keep acquisition, cache restoration and runtime module input in agreement.
// More small modules do not grant more bytes, depth, networking or authority.
export const DEPENDENCY_LIMITS = Object.freeze({count:128, depth:8, bytes:24*1024*1024})
export const RENDERING_CACHE_LIMITS = Object.freeze({count:512, bytes:64*1024*1024})
// Discovery metadata is bounded separately from files eligible for downloading.
// Beyond this bound the displayed count is explicitly a lower bound.
export const MAX_DEPENDENCY_IDENTITIES = 4096
