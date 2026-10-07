// EVERY value that is still "TBD" (Risk / Compliance / Legal) lives here and nowhere else.
// Names starting with PLACEHOLDER_ are fake on purpose: they exist so the flow can be tested.
// Do not read them as decisions. Replace them once Compliance/Risk answer.

import type { LimitKey, Limits, PartnerType } from '../types'

export interface VolumeBand {
  id: string
  /** Inclusive lower bound of declared monthly volume, DZD. */
  minDzd: number
  /** Exclusive upper bound, DZD. null = open-ended. */
  maxDzd: number | null
}

// TODO(compliance): what are the official declared-volume bands?
export const VOLUME_BANDS: VolumeBand[] = [
  { id: 'B1', minDzd: 0, maxDzd: 500_000 },
  { id: 'B2', minDzd: 500_000, maxDzd: 2_000_000 },
  { id: 'B3', minDzd: 2_000_000, maxDzd: 10_000_000 },
  { id: 'B4', minDzd: 10_000_000, maxDzd: null },
]

// TODO(compliance): what monthly declared volume (DZD) makes a Company an Enterprise? (Risk)
export const PLACEHOLDER_ENTERPRISE_VOLUME_THRESHOLD = 10_000_000
export const ENTERPRISE_VOLUME_THRESHOLD = PLACEHOLDER_ENTERPRISE_VOLUME_THRESHOLD

// TODO(compliance): beneficial-owner threshold (%) and the data required, under Regulation 24-03 as amended by 25-14?
export const PLACEHOLDER_BENEFICIAL_OWNER_THRESHOLD_PCT = 25
export const BENEFICIAL_OWNER_THRESHOLD_PCT = PLACEHOLDER_BENEFICIAL_OWNER_THRESHOLD_PCT

// Legal value (Law 22-23), not TBD.
export const AE_ANNUAL_CAP_DZD = 5_000_000
export const AE_WARNING_RATIO = 0.8

// TODO(compliance): at 100% of the AE cap, block new transactions or only flag the account? Default FLAG.
export const AE_CAP_BEHAVIOUR: 'FLAG' | 'BLOCK' = 'FLAG'

// TODO(compliance): can an auto-entrepreneur sell physical goods online? Default: services only.
export const AE_ALLOW_PHYSICAL_GOODS_ONLINE = false

// TODO(compliance): does ANAE offer card verification by API/portal? Default: manual admin check.
export const ANAE_VERIFICATION: 'MANUAL' | 'API' = 'MANUAL'

// TODO(compliance): do Banque d'Algérie Instruction 06-2025 balance ceilings (100k/500k/1M DZD) apply to merchant accounts?
export const BA_INSTRUCTION_06_2025_CEILINGS_APPLY_TO_MERCHANTS: boolean | null = null

// TODO(compliance): confirm that individuals with no legal status are excluded from the Partner signup.
export const NO_LEGAL_STATUS_EXCLUDED: boolean | null = null

// TODO(compliance): real expected review time to show on the confirmation screen.
export const PLACEHOLDER_EXPECTED_REVIEW_HOURS = 48
export const EXPECTED_REVIEW_HOURS = PLACEHOLDER_EXPECTED_REVIEW_HOURS

/** Customer-facing links used by the "no legal status" dead end. */
export const CUSTOMER_APP_URL = 'https://mizaniyapay.dz/app' // TODO(compliance): confirm final store/landing URL
export const ANAE_INFO_URL = 'https://www.anae.dz'

const PLACEHOLDER = 999_999 // obviously fake
function placeholderLimits(): Limits {
  const l: Limits = {}
  for (const k of ['perTransaction', 'monthly', 'payout'] as LimitKey[]) l[k] = PLACEHOLDER
  return l
}

// TODO(compliance): per-type/per-band limits (per-transaction, monthly, payout). Enterprise: by contract (null).
export const LIMITS: Record<PartnerType, Record<string, Limits>> = {
  AUTO_ENTREPRENEUR: Object.fromEntries(
    VOLUME_BANDS.map((b) => [b.id, { ...placeholderLimits(), annual: AE_ANNUAL_CAP_DZD }]),
  ),
  INDIVIDUAL_TRADER: Object.fromEntries(VOLUME_BANDS.map((b) => [b.id, placeholderLimits()])),
  COMPANY: Object.fromEntries(VOLUME_BANDS.map((b) => [b.id, placeholderLimits()])),
  ENTERPRISE: Object.fromEntries(
    VOLUME_BANDS.map((b) => [b.id, { perTransaction: null, monthly: null, payout: null }]),
  ),
}

// TODO(compliance): the real AML/CFT questionnaire (Regulation 24-03 as amended by 25-14). Placeholder questions.
export const AML_QUESTION_KEYS = ['pep', 'sanctions', 'highRiskJurisdictions', 'cashIntensive', 'thirdParties'] as const
export type AmlStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
