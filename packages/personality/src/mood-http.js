import { isApiV1Path } from '../../identity.js'
import { readJson, sendJson } from '../../character/src/card-http.js'
export const isMoodApiPath = url => isApiV1Path(url, 'personality-mood')
export function moodApi(cards, moods, notify, { replies, sessionFor = () => null, isRunning = () => false } = {}) {
  return async (req, res) => {
    try {
      if (!['POST', 'GET'].includes(req.method)) return sendJson(res, 405, { ok: false })
      const writing = req.method === 'POST'
      const body = writing ? await readJson(req, 8192) : {}
      const sessionId = writing ? body.sessionId : new URL(req.url, 'http://localhost').searchParams.get('sessionId')
      const id = cards.selectedCharacter(sessionId)?.character.id
      if (!id) return sendJson(res, 404, { ok: false, error: { code: 'NO_PERSONALITY', message: 'No active personality' } })
      if (writing && body.personalityId !== id) return sendJson(res, 409, { ok: false, error: { code: 'PERSONALITY_CHANGED', message: 'The selected personality changed' } })
      const changingReply = writing && Object.hasOwn(body, 'skipNextReply')
      const session = replies ? sessionFor(sessionId) : null
      if (changingReply) {
        if (!replies || !session) return sendJson(res, 409, { ok: false, error: { code: 'MOOD_REPLY_SESSION_UNAVAILABLE', message: 'Open the native session before changing its next-reply setting.' } })
        if (Object.hasOwn(body, 'mood') || Object.hasOwn(body, 'automatic')) throw new TypeError('Change the next-reply setting separately from mood settings')
        if (isRunning(sessionId)) return sendJson(res, 409, { ok: false, error: { code: 'MOOD_REPLY_ACTIVE', message: 'Change the next-reply setting after the current reply finishes.' } })
        replies.change(session, id, body)
      }
      const state = writing && !changingReply ? moods.change(id, sessionId, body) : moods.read(id, sessionId)
      if (writing) notify()
      return sendJson(res, 200, { ok: true, ...state, ...(replies && session ? { reply: replies.view(session, id) } : {}) })
    } catch (error) {
      return sendJson(res, error.status || (error instanceof TypeError ? 400 : 500), { ok: false, error: { code: error.code || 'PERSONALITY_MOOD_ERROR', message: error.message } })
    }
  }
}
