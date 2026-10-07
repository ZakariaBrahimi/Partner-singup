import type { DuplicateField, ValidatorId } from '../validators'
import type { DocType, KycLevel, LimitKey, PartnerType, Product, StepData, StepId } from '../types'

export interface FlowContext {
  /** Partner type the partner selected (before routing). */
  type: PartnerType
  /** Type after routing rules (e.g. Company above the volume threshold -> Enterprise). */
  effectiveType: PartnerType
  /** false => legal rep is the account holder; the role field is hidden. */
  showLegalRole: boolean
  steps: Record<StepId, StepData>
}

type Fn<T> = (data: StepData, ctx: FlowContext) => T

export type FieldKind =
  | 'text'
  | 'mono' // IBM Plex Mono: RC, NIF, NIS, NIN, ANAE, RIB, CCP
  | 'textarea'
  | 'email'
  | 'phone'
  | 'password'
  | 'number'
  | 'select'
  | 'radio'
  | 'file'
  | 'checkbox'
  | 'activity' // ANAE nomenclature combobox
  | 'owners' // beneficial owners list
  | 'amlQuestionnaire'
  | 'notice' // static info/warning, never has a value

export interface FieldDef {
  name: string // unique across steps: i18n keys are fields.<name>.label|hint|options.<value>
  kind: FieldKind
  validator?: ValidatorId | ((data: StepData) => ValidatorId)
  /** Default true (notices are never required). */
  required?: boolean | Fn<boolean>
  visibleWhen?: Fn<boolean>
  /** Check duplicates on blur against existing partners. */
  dedupe?: DuplicateField | ((data: StepData) => DuplicateField | null)
  options?: string[]
  optionsSource?: 'wilayas' | 'volumeBands'
  doc?: { type: DocType; accept: Array<'jpg' | 'png' | 'pdf'>; camera?: boolean }
  /** Name of a boolean in the same step that must be true (OTP verified flag). */
  verifiedFlag?: string
  tone?: 'info' | 'warning'
  /** A notice may link back to step 1 (type selection). */
  link?: 'type-step'
}

export interface SectionDef {
  id: string
  fields: FieldDef[]
}

export interface StepDef {
  id: StepId
  /** Type-specific steps are reset (per field) when the partner changes type. */
  typeSpecific?: boolean
  sections: SectionDef[]
}

export interface Routing {
  toType: PartnerType
  /** Evaluated on the draft; true => partner is routed to `toType`. */
  when: (ctx: FlowContext) => boolean
}

export interface PartnerTypeConfig {
  id: PartnerType
  order: number
  kycLevel: KycLevel
  /** false => legal rep is the account holder, role field hidden. */
  showLegalRole: boolean
  /** Settlement holder must match the person or the company. */
  holderMatch: 'person' | 'company'
  /** 'block' => mismatch fails validation; 'warn' => inline warning only. */
  holderMismatch: 'warn' | 'block'
  products: Product[]
  limitKeys: Array<LimitKey | 'annual'>
  /** Ordered step ids, including 'type' first and 'review' last. */
  stepIds: StepId[]
  /** Definitions for type-specific steps; shared steps live in SHARED_STEPS. */
  stepDefs: Record<StepId, StepDef>
  /** i18n keys under checklist.* for the admin review checklist (manual checks). */
  reviewChecklist: string[]
  upgradeTargets: PartnerType[]
  routing?: Routing[]
  requiresContract?: boolean
  /** Helper (step 1) answers that preselect this type, in priority order across types. */
  helperMatch?: 'rc' | 'ram' | 'anae'
  /** Annual turnover cap (DZD) when set; enables cap tracking. */
  annualCapDzd?: number
}
