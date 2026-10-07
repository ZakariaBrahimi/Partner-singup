// English fallback messages for the `message` field of validate-field (the UI localizes by `code`).
import en from '@/i18n/en.json'

export function messageFor(code: string, field: string): string {
  if (code === 'duplicate') return (en.duplicate as Record<string, string>)[field] ?? 'Already registered.'
  return (en.errors as Record<string, string>)[code] ?? code
}
