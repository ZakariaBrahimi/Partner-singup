/** Predefined rejection reason codes (i18n key: reasons.<code>). */
// TODO(compliance): confirm the official list of rejection reasons.
export const REJECTION_REASONS = [
  'DOCUMENT_UNREADABLE',
  'DOCUMENT_MISMATCH',
  'DOCUMENT_EXPIRED',
  'IDENTITY_NOT_VERIFIED',
  'REGISTRATION_INVALID',
  'ACTIVITY_NOT_ELIGIBLE',
  'SETTLEMENT_ACCOUNT_MISMATCH',
  'BENEFICIAL_OWNERS_INCOMPLETE',
  'OTHER',
] as const
export type RejectionReasonCode = (typeof REJECTION_REASONS)[number]
