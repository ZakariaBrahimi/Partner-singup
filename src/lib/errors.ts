import type { TFunction } from 'i18next'

/** Error code (from the shared schema or the API) -> localized message. Never a generic toast. */
export function errorText(t: TFunction, code: string): string {
  if (code.startsWith('duplicate.')) return t(code)
  const key = `errors.${code}`
  const out = t(key)
  return out === key ? t('errors.network') : out
}
