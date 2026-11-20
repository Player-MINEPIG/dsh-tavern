import { httpError } from './http.js'

export function sessionCoordinates(inspection) {
  const version = inspection?.meta?.version
  return {
    sessionFormatVersion: Number.isSafeInteger(version) && version >= 0 ? version : null,
    // Conservative detection only: this marker never authorizes a guessed remap.
    migratedFromV2: (inspection?.events ?? []).some(event => event.type === 'system/message'
      && /^v2-to-v3-system-[a-f0-9]{64}$/.test(event.data?.message?.id ?? '')),
  }
}

function requireSnapshotVersion(version) {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw httpError(503, 'The Host did not provide the Session format version for this history snapshot. Retry when Session metadata is available.', 'PLAY_COORDINATES_UNAVAILABLE')
  }
}

export function requireCoordinates(version, current) {
  if (version !== undefined && (!Number.isSafeInteger(version) || version < 0)) {
    throw httpError(400, 'Invalid Session coordinate format version', 'PLAY_COORDINATES_INVALID')
  }
  requireSnapshotVersion(current?.sessionFormatVersion)
  if ((version !== undefined && version !== current.sessionFormatVersion)
    || (version === undefined && (current.migratedFromV2 || current.sessionFormatVersion >= 4))) {
    throw httpError(409,
      'Session event references need migration. Back up the playthrough and run scripts/migrate-session-coordinates.mjs. For missing markers after a V3-to-V4 upgrade, preview --auto-v3-v4. Use --stamp-only for independently verified message IDs.',
      'PLAY_COORDINATES_MIGRATION_REQUIRED')
  }
}

export function variantFormatVersion(variant) {
  return variant.ext?.pmpDshTavern?.sessionFormatVersion
}

export function withVariantFormat(variant, version) {
  requireSnapshotVersion(version)
  return { ...variant, ext: { ...variant.ext, pmpDshTavern: {
    ...variant.ext?.pmpDshTavern, sessionFormatVersion: version,
  } } }
}

export async function validateTimelineCoordinates(timeline, describe) {
  if (typeof describe !== 'function') return
  const descriptions = new Map()
  for (const node of timeline.nodes) {
    for (const variant of node.variants) {
      if (!descriptions.has(variant.sessionId)) descriptions.set(variant.sessionId, await describe(variant.sessionId))
      requireCoordinates(variantFormatVersion(variant), descriptions.get(variant.sessionId))
    }
  }
}
