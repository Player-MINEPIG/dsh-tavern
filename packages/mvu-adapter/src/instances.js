import { createHash } from 'node:crypto'
import { fail, json } from './value.js'

export const instanceDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function sessionIdentity(session, id) {
  const header = session?.header ?? session?.meta
  if (!header || header.id !== id || !Number.isSafeInteger(header.version)
    || !['number', 'string'].includes(typeof header.createdAt)
    || (typeof header.createdAt === 'number' && !Number.isFinite(header.createdAt))
    || (typeof header.createdAt === 'string' && !header.createdAt)) fail('MVU_SESSION_IDENTITY', 'Durable session identity is required for a state instance')
  return { sessionId: id, createdAt: header.createdAt }
}
export const stateInstanceId = (templateId, identity) => `mvu:instance-${instanceDigest([templateId, identity]).slice(0, 48)}`
export const textFingerprint = event => instanceDigest((event?.data?.message?.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n'))
export function inheritedVersion(version, session, identity) {
  const event = session.events.find(e => e.seq === version.source.messageSeq)
  if (event?.type !== 'assistant/message' || event.data?.message?.id !== version.source.messageId
    || textFingerprint(event) !== (version.sourceFingerprint ?? version.fingerprint)) fail('MVU_SEED_MISMATCH', 'Inherited message does not match the frozen seed')
  return {
    key: instanceDigest(['inherited', identity, version.key]), variables: json(version.variables), revision: 0,
    fingerprint: version.sourceFingerprint ?? version.fingerprint,
    source: { ...json(version.source), sessionId: identity.sessionId, sessionCreatedAt: identity.createdAt,
      sessionFormatVersion: (session.header ?? session.meta).version, inherited: true, manual: false, card: false },
    inheritedFrom: { versionKey: version.key, revision: version.revision ?? 0, sessionId: version.source.sessionId },
  }
}
