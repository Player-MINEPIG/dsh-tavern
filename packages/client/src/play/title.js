import { translate } from '../i18n.js'

function playthroughNumber(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.playthroughNumber
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function isLegacyAutomaticTitle(title, number) {
  return title === '周目'
    || title === `${number}周目`
    || title === `Playthrough ${number}`
}

export function hasAutomaticPlaythroughTitle(playthrough) {
  const number = playthroughNumber(playthrough)
  if (number === null) return false
  const declared = playthrough?.ext?.pmpDshTavern?.autoTitle
  if (declared === true) return true
  if (declared === false) return false
  return isLegacyAutomaticTitle(playthrough?.title, number)
}

export function playthroughDisplayTitle(playthrough) {
  const number = playthroughNumber(playthrough)
  if (number !== null && hasAutomaticPlaythroughTitle(playthrough)) {
    return translate('play.sidebar.defaultTitle', { number })
  }
  const title = playthrough?.title
  return typeof title === 'string' && title !== '' ? title : String(playthrough?.id ?? '')
}
