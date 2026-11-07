import { isApiV1Path } from '../../identity.js'
import { readJson, sendJson } from '../../character/src/card-http.js'
export const isMoodApiPath = url => isApiV1Path(url, 'personality-mood')
export function moodApi(cards, moods, notify) {
  return async (req, res) => {
    try {
      if (!['POST', 'GET'].includes(req.method)) return sendJson(res, 405, { ok: false })
      const writing = req.method === 'POST'
      const body = writing ? await readJson(req, 8192) : {}
      const sessionId = writing ? body.sessionId : new URL(req.url, 'http://localhost').searchParams.get('sessionId')
      const id = cards.selectedCharacter(sessionId)?.character.id
      if (!id) return sendJson(res, 404, { ok: false, error: { code: 'NO_PERSONALITY', message: 'No active personality' } })
      if (writing && body.personalityId !== id) return sendJson(res, 409, { ok: false, error: { code: 'PERSONALITY_CHANGED', message: 'The selected personality changed' } })
      const state = writing ? moods.change(id, sessionId, body) : moods.read(id, sessionId)
      if (writing) notify()
      return sendJson(res, 200, { ok: true, ...state })
    } catch (error) {
      return sendJson(res, error.status || (error instanceof TypeError ? 400 : 500), { ok: false, error: { code: error.code || 'PERSONALITY_MOOD_ERROR', message: error.message } })
    }
  }
}
