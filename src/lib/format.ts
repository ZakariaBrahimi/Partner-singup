import type { TFunction } from 'i18next'
import type { FieldDef } from '@/shared/config/schemaTypes'
import { VOLUME_BANDS } from '@/shared/config/tbd'
import { WILAYAS } from '@/shared/config/wilayas'
import type { BeneficialOwner, UploadedDocument } from '@/shared/types'

export const fmtDzd = (n: number, lng: string) => new Intl.NumberFormat(lng === 'ar' ? 'ar-DZ' : lng).format(n)

export function bandLabel(t: TFunction, lng: string, id: string | null | undefined): string {
  const b = VOLUME_BANDS.find((x) => x.id === id)
  if (!b) return '—'
  return b.maxDzd === null
    ? t('ui.band.open', { min: fmtDzd(b.minDzd, lng) })
    : t('ui.band.range', { min: fmtDzd(b.minDzd, lng), max: fmtDzd(b.maxDzd, lng) })
}

/** Human-readable value of a field (review screen, admin detail). Secrets are masked. */
export function displayValue(def: FieldDef, value: unknown, t: TFunction, lng: string): string {
  if (value === undefined || value === null || value === '') return '—'
  switch (def.kind) {
    case 'password':
      return '••••••••'
    case 'file':
      return (value as UploadedDocument).name ?? '—'
    case 'owners':
      return (value as BeneficialOwner[]).map((o) => `${o.fullName} (${o.ownershipPct}%)`).join(', ') || '—'
    case 'amlQuestionnaire':
      return t(`ui.aml.status.${(value as { status: string }).status}`)
    case 'checkbox':
      return value === true ? t('ui.yes') : t('ui.no')
    case 'select':
    case 'radio':
      if (def.optionsSource === 'wilayas') {
        const w = WILAYAS.find((x) => x.code === value)
        return w ? (lng === 'ar' ? w.ar : w.fr) : String(value)
      }
      if (def.optionsSource === 'volumeBands') return bandLabel(t, lng, String(value))
      return t(`fields.${def.name}.options.${String(value)}`, { defaultValue: String(value) })
    case 'phone':
      return `+213 ${String(value)}`
    default:
      return String(value)
  }
}
