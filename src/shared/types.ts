// Framework-free types shared by the portal, the admin and the (mock) API.
// Keep this folder free of React/DOM so it can move to a shared package.

/** Partner types are config-driven: any key registered in `partnerTypes.ts` is valid. */
export type PartnerType = string

export const BUILT_IN_TYPES = {
  AUTO_ENTREPRENEUR: 'AUTO_ENTREPRENEUR',
  INDIVIDUAL_TRADER: 'INDIVIDUAL_TRADER',
  COMPANY: 'COMPANY',
  ENTERPRISE: 'ENTERPRISE',
} as const

/** Existing backend states (869bbzntr) + the new DRAFT onboarding state. */
export type MerchantStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
export type KybStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type KycLevel = 2 | 3
export type ApiKeyStatus = 'ACTIVE' | 'INACTIVE'

export type StepId = string // 'type' | 'account' | 'business' | 'settlement' | 'enterpriseDocs' | 'review' | ...

export type Product =
  | 'PAYMENT_LINKS'
  | 'INVOICES'
  | 'QR'
  | 'WEBSITE_CHECKOUT'
  | 'POS'
  | 'API'
  | 'TEAM_USERS'
  | 'REFUNDS'
  | 'CUSTOM_PRICING'
  | 'SUB_MERCHANTS'
  | 'DEDICATED_SUPPORT'

export type LimitKey = 'perTransaction' | 'monthly' | 'payout'
export type Limits = Partial<Record<LimitKey | 'annual', number | null>>

export type DocType =
  | 'idFront'
  | 'idBack'
  | 'selfie'
  | 'anaeCardPhoto'
  | 'rcPhoto'
  | 'ramPhoto'
  | 'registrationPhoto'
  | 'nifCertificate'
  | 'statuts'
  | 'managerId'
  | 'delegation'
  | 'financialStatements'

export interface UploadedDocument {
  id: string
  name: string
  size: number
  mime: string
  status: 'uploaded'
}

export interface BeneficialOwner {
  id: string
  fullName: string
  nin: string
  ownershipPct: number
  idDocument?: UploadedDocument | null
}

export type StepData = Record<string, unknown>

/** The whole partner draft. `steps[stepId][fieldName]` holds each field. */
export interface PartnerDraft {
  partnerType: PartnerType | null
  steps: Record<StepId, StepData>
  /** Id of the last step the partner completed (saved), or null. */
  lastCompletedStep: StepId | null
}

export interface RejectionInfo {
  code: string
  text: string
  /** `${stepId}.${fieldName}` keys */
  flaggedFields: string[]
}

export type FieldErrors = Record<string, string> // key `${stepId}.${field}` -> error code
