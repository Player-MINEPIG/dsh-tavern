import {
  DEFAULT_UI_LOCALE,
  SUPPORTED_UI_LOCALES,
  UI_LOCALES,
  isSupportedUiLocale,
} from '../../../ui-settings/src/locale-contract.js'
import { CLIENT_UI_SETTINGS_EVENT } from '../../../identity.js'
import { PRODUCTION_CATALOGS } from './catalogs/index.js'

export { UI_LOCALES }
export const DEFAULT_UI_SETTINGS = Object.freeze({ locale: DEFAULT_UI_LOCALE, scale: 1, rpFollowCharacter: true })
export const SUPPORTED_LOCALES = SUPPORTED_UI_LOCALES
export const UI_SCALE_OPTIONS = Object.freeze([0.75, 0.85, 1, 1.15, 1.25, 1.5])
export const MESSAGE_CATALOG = PRODUCTION_CATALOGS

const RAW_TEXT = Symbol('dsh-tavern.raw-text')
let catalogs = PRODUCTION_CATALOGS
let current = { ...DEFAULT_UI_SETTINGS }

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function catalogKeys(catalog) {
  return Object.keys(catalog ?? {}).toSorted()
}

export function assertCatalogParity(catalog, locale, expectedKeys = catalogKeys(catalogs[DEFAULT_UI_LOCALE] ?? PRODUCTION_CATALOGS[DEFAULT_UI_LOCALE])) {
  if (!isRecord(catalog)) throw new TypeError(`UI message catalog ${locale} must be an object`)
  const actual = catalogKeys(catalog)
  if (JSON.stringify(actual) !== JSON.stringify(expectedKeys)) {
    throw new TypeError(`UI message catalog ${locale} does not have the same keys as ${DEFAULT_UI_LOCALE}`)
  }
  for (const key of actual) {
    if (typeof catalog[key] !== 'string') {
      throw new TypeError(`UI message catalog ${locale} key ${JSON.stringify(key)} must be a string`)
    }
  }
  return true
}

function assertCompleteMessageCatalogs(source) {
  const expected = catalogKeys(source[DEFAULT_UI_LOCALE])
  if (expected.length === 0) throw new TypeError(`Missing UI message catalog for ${DEFAULT_UI_LOCALE}`)
  for (const locale of Object.keys(source)) {
    assertCatalogParity(source[locale], locale, expected)
  }
}

assertCompleteMessageCatalogs(PRODUCTION_CATALOGS)

export function getMessageCatalogs() {
  return catalogs
}

export function installMessageCatalogs(extra) {
  if (!isRecord(extra)) throw new TypeError('extra catalogs must be an object')
  const next = { ...PRODUCTION_CATALOGS, ...extra }
  assertCompleteMessageCatalogs(next)
  catalogs = next
  return catalogs
}

export function resetMessageCatalogs() {
  catalogs = PRODUCTION_CATALOGS
  return catalogs
}

function fill(template, values) {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => String(values?.[key] ?? ''))
}

function templateFor(key, locale) {
  const currentCatalog = catalogs[locale]
  const defaultCatalog = catalogs[DEFAULT_UI_LOCALE]
  if (typeof currentCatalog?.[key] === 'string') return currentCatalog[key]
  if (typeof defaultCatalog?.[key] === 'string') return defaultCatalog[key]
  if (typeof defaultCatalog?.['common.unavailable'] === 'string') return defaultCatalog['common.unavailable']
  if (typeof currentCatalog?.['common.unavailable'] === 'string') return currentCatalog['common.unavailable']
  return ''
}

export function translate(key, values = {}) {
  return fill(templateFor(key, current.locale), values)
}

export function translateVisibleText(value) {
  return typeof value === 'string' ? value : ''
}

export function rawText(value) {
  return Object.freeze({
    [RAW_TEXT]: true,
    value: value === null || value === undefined ? '' : String(value),
    toString() { return this.value },
  })
}

export function uiMessage(key, values = {}) {
  return rawText(translate(key, values))
}

export function statusText(status) {
  if (status?.error && !status.key) return rawText(status.text)
  return uiMessage(status?.key ?? 'common.unavailable', status?.values)
}

export function uiError(key, values = {}) {
  const error = new Error(translate(key, values))
  error.uiKey = key
  error.uiValues = values
  return error
}

export function isRawText(value) {
  return value?.[RAW_TEXT] === true && typeof value.value === 'string'
}

export function unwrapText(value) {
  return isRawText(value) ? value.value : String(value ?? '')
}

export function uiText(strings, ...values) {
  let output = ''
  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index]
    if (index < values.length) output += unwrapText(values[index])
  }
  return rawText(output)
}

function localizeChild(value) {
  if (isRawText(value)) return value.value
  if (Array.isArray(value)) return value.map(localizeChild)
  return value
}

export function createLocalizedElement(createElement) {
  return (type, props, ...children) => {
    let localizedProps = props
    if (props !== null && props !== undefined) {
      localizedProps = { ...props }
      for (const key of ['title', 'aria-label', 'placeholder', 'alt']) {
        if (isRawText(localizedProps[key])) localizedProps[key] = localizedProps[key].value
      }
    }
    return createElement(type, localizedProps, ...children.map(localizeChild))
  }
}

export function getClientUiSettings() {
  return { ...current }
}

export function setClientUiSettings(value, { announce = true } = {}) {
  const requested = value?.locale
  const locale = catalogs[requested] !== undefined
    ? requested
    : (isSupportedUiLocale(requested) ? requested : DEFAULT_UI_SETTINGS.locale)
  const numericScale = Number(value?.scale)
  const scale = Number.isFinite(numericScale) && numericScale >= 0.75 && numericScale <= 1.5
    ? Number(numericScale.toFixed(2))
    : DEFAULT_UI_SETTINGS.scale
  const rpFollowCharacter = value?.rpFollowCharacter !== false
  current = { locale, scale, rpFollowCharacter }
  if (announce && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLIENT_UI_SETTINGS_EVENT, { detail: getClientUiSettings() }))
  }
  return getClientUiSettings()
}
