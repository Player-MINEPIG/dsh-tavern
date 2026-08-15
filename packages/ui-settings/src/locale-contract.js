export const DEFAULT_UI_LOCALE = 'zh-CN'

export const UI_LOCALES = Object.freeze([
  Object.freeze({ id: 'zh-CN', nativeName: '简体中文' }),
  Object.freeze({ id: 'en', nativeName: 'English' }),
])

export const SUPPORTED_UI_LOCALES = Object.freeze(UI_LOCALES.map(locale => locale.id))

export function isSupportedUiLocale(value) {
  return typeof value === 'string' && SUPPORTED_UI_LOCALES.includes(value)
}
