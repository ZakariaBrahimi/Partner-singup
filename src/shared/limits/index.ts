// Limits and post-approval flags. Pure functions; all numbers come from config/tbd.ts.
import { getPartnerType } from '../config/partnerTypes'
import { AE_CAP_BEHAVIOUR, AE_WARNING_RATIO, LIMITS, VOLUME_BANDS } from '../config/tbd'
import type { Limits, PartnerType } from '../types'

export type PartnerFlag = 'AE_CAP_80' | 'AE_CAP_100' | 'VOLUME_ABOVE_BAND'

/** Limits for a type and declared band (Enterprise: nulls = by contract). */
export function limitsFor(type: PartnerType, band: string | null | undefined): Limits | null {
  const perBand = LIMITS[type]
  if (!perBand) return null
  return (band && perBand[band]) || null
}

export function aeUsage(type: PartnerType, annualDzd: number) {
  const cap = getPartnerType(type).annualCapDzd
  if (!cap) return null
  return { annualDzd, capDzd: cap, ratio: annualDzd / cap }
}

/** Monthly volume above the declared band's upper bound. Open-ended bands never trigger. */
export function volumeAboveBand(band: string | null | undefined, monthlyDzd: number): boolean {
  const b = VOLUME_BANDS.find((x) => x.id === band)
  return !!b && b.maxDzd !== null && monthlyDzd > b.maxDzd
}

export function evaluateFlags(input: {
  type: PartnerType
  band: string | null | undefined
  annualDzd: number
  monthlyDzd: number
}): PartnerFlag[] {
  const flags: PartnerFlag[] = []
  const usage = aeUsage(input.type, input.annualDzd)
  if (usage) {
    if (usage.ratio >= 1) flags.push('AE_CAP_100')
    else if (usage.ratio >= AE_WARNING_RATIO) flags.push('AE_CAP_80')
  }
  if (volumeAboveBand(input.band, input.monthlyDzd)) flags.push('VOLUME_ABOVE_BAND')
  return flags
}

/** At 100% of the AE cap: FLAG only (default) or BLOCK new transactions. */
export function transactionsBlocked(flags: PartnerFlag[]): boolean {
  return AE_CAP_BEHAVIOUR === 'BLOCK' && flags.includes('AE_CAP_100')
}
