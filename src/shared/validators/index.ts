// Single home for every format rule. A validator returns an error code (i18n key `errors.<code>`)
// or null when the value is fine. Empty values are NOT handled here: "required" is a schema concern.
//
// Formats that are not officially defined yet are deliberately loose placeholders marked
// TODO(compliance). Do not tighten them with guessed rules.

export type Validator = (value: string) => string | null

const digitsOnly = (v: string) => v.replace(/[\s.-]/g, '')

/** Normalise identifiers before comparing/storing (dedupe, display). */
export function normalizeIdentifier(v: string): string {
  return v.replace(/[\s.\-/]/g, '').toUpperCase()
}

export const email: Validator = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'invalidEmail'

/** National part only (the UI shows the fixed +213 prefix). */
// TODO(compliance): confirm Algerian mobile numbering plan (assumed: 9 digits starting 5/6/7, optional leading 0).
export const phone: Validator = (v) => {
  const n = digitsOnly(v).replace(/^0/, '')
  return /^[567]\d{8}$/.test(n) ? null : 'invalidPhone'
}

/** Company phone: mobile or landline. */
// TODO(compliance): confirm landline format (assumed: 8 digits starting 2/3/4 after an optional 0).
export const companyPhone: Validator = (v) => {
  const n = digitsOnly(v).replace(/^0/, '')
  return /^[567]\d{8}$/.test(n) || /^[234]\d{7}$/.test(n) ? null : 'invalidPhone'
}

// Placeholder identifier formats. TODO(compliance): replace each with the official rule.
const alnum = (min: number, max: number, code: string): Validator => (v) => {
  const n = normalizeIdentifier(v)
  return /^[0-9A-Z]+$/.test(n) && n.length >= min && n.length <= max ? null : code
}
const numeric = (min: number, max: number, code: string): Validator => (v) => {
  const n = digitsOnly(v)
  return /^\d+$/.test(n) && n.length >= min && n.length <= max ? null : code
}

// TODO(compliance): RC format (placeholder: 6-25 alphanumeric characters)
export const rc = alnum(6, 25, 'invalidRc')
// TODO(compliance): RAM / artisan card format (placeholder)
export const ram = alnum(4, 25, 'invalidRam')
// TODO(compliance): NIF format (placeholder: 6-25 alphanumeric)
export const nif = alnum(6, 25, 'invalidNif')
// TODO(compliance): NIS format (placeholder: 6-25 alphanumeric)
export const nis = alnum(6, 25, 'invalidNis')
// TODO(compliance): NIN format (placeholder: 10-20 digits)
export const nin = numeric(10, 20, 'invalidNin')
// TODO(compliance): ANAE card number format (placeholder: 4-25 alphanumeric)
export const anaeCardNumber = alnum(4, 25, 'invalidAnaeCard')
// TODO(compliance): RIB format (placeholder: 10-24 digits)
export const rib = numeric(10, 24, 'invalidRib')
// TODO(compliance): CCP format (placeholder: 8-20 digits)
export const ccp = numeric(8, 20, 'invalidCcp')

/** Law 18-05: online sales must run on a site hosted in Algeria with a .com.dz address. */
export const websiteComDz: Validator = (v) => {
  let host: string
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`).hostname
  } catch {
    return 'websiteComDz'
  }
  return /^([a-z0-9-]+\.)+com\.dz$/i.test(host) ? null : 'websiteComDz'
}

export const minLength = (n: number, code = 'tooShort'): Validator => (v) => (v.trim().length >= n ? null : code)

export const personName: Validator = (v) => (v.trim().split(/\s+/).length >= 2 ? null : 'fullNameRequired')

export const positiveNumber: Validator = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? null : 'invalidNumber'
}

export const percentage: Validator = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && n <= 100 ? null : 'invalidPercentage'
}

// TODO(compliance): password policy (placeholder: >= 8 chars).
export const password: Validator = (v) => (v.length >= 8 ? null : 'passwordTooShort')

/** 0 (empty) .. 4 (strong). Used by the strength meter. */
export function passwordStrength(v: string): 0 | 1 | 2 | 3 | 4 {
  if (!v) return 0
  let s = 0
  if (v.length >= 8) s++
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++
  if (/\d/.test(v)) s++
  if (/[^A-Za-z0-9]/.test(v) && v.length >= 10) s++
  return Math.max(1, s) as 1 | 2 | 3 | 4
}

export const VALIDATORS = {
  email,
  phone,
  companyPhone,
  rc,
  ram,
  nif,
  nis,
  nin,
  anaeCardNumber,
  rib,
  ccp,
  websiteComDz,
  personName,
  positiveNumber,
  percentage,
  password,
  text: minLength(2, 'tooShort'),
} satisfies Record<string, Validator>

export type ValidatorId = keyof typeof VALIDATORS

/** Fields whose duplicates are checked against existing partners. */
export const DUPLICATE_CHECKED_FIELDS = [
  'rc',
  'nif',
  'nis',
  'nin',
  'anaeCardNumber',
  'email',
  'phone',
  'rib',
  'ccp',
] as const
export type DuplicateField = (typeof DUPLICATE_CHECKED_FIELDS)[number]

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/** Account-holder name check: same set of name tokens, in any order (ignores accents/case/punctuation). */
export function holderNameMatches(holder: string, expected: string): boolean {
  const a = strip(holder).sort().join(' ')
  const b = strip(expected).sort().join(' ')
  return a.length > 0 && a === b
}

/** Format-check one named field. Unknown field names are valid (no rule). */
export function validateFormat(field: string, value: string): string | null {
  const v = (VALIDATORS as Record<string, Validator>)[field]
  return v ? v(value) : null
}
