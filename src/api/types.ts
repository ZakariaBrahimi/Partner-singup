// Contract between the UI and the backend. The mock (src/api/mock) implements it today; the real
// backend only has to expose the same shapes. All calls are async and never throw for expected failures.
import type {
  ApiKeyStatus,
  FieldErrors,
  KybStatus,
  KycLevel,
  Limits,
  MerchantStatus,
  PartnerDraft,
  PartnerType,
  Product,
  RejectionInfo,
  StepData,
  StepId,
  UploadedDocument,
} from '@/shared/types'
import type { RejectionReasonCode } from '@/shared/config/reasons'

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'VALIDATION'
  | 'OTP_INVALID'
  | 'INVALID_CREDENTIALS'
  | 'UPLOAD_FAILED'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE'
  | 'NOT_FLAGGED'
  | 'FORBIDDEN'
  | 'NETWORK'

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorCode; fieldErrors?: FieldErrors; message?: string }

export interface ValidateFieldResult {
  valid: boolean
  /** Format error code (errors.<code>) or 'duplicate' (duplicate.<field>). */
  code: string | null
  field: string
  message: string | null
}

export interface ApiKey {
  id: string
  name: string
  env: 'SANDBOX' | 'LIVE'
  key: string
  status: ApiKeyStatus
}

export type StatusFlag = import('@/shared/limits').PartnerFlag

export interface NotificationItem {
  id: string
  at: string
  channel: 'EMAIL' | 'PORTAL'
  kind:
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'CONTRACT_SIGNED'
    | 'AE_CAP_80'
    | 'AE_CAP_100'
    | 'VOLUME_ABOVE_BAND'
    | 'UPGRADE_APPROVED'
  subject: string
}

export interface TimelineEvent {
  state: 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
  at: string | null
  done: boolean
}

export interface PartnerSummary {
  id: string
  status: MerchantStatus
  kyb: KybStatus | null
  partnerType: PartnerType | null
  /** After routing rules (Company above the volume threshold -> Enterprise). */
  effectiveType: PartnerType | null
  routedToEnterprise: boolean
  /** The draft being edited is an upgrade of an approved account. */
  isUpgrade: boolean
  kycLevel: KycLevel | null
  lastCompletedStep: StepId | null
  email: string
  displayName: string
}

export interface UpgradeInfo {
  toType: PartnerType
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'REJECTED'
  rejection?: RejectionInfo | null
}

export interface PartnerStatus extends PartnerSummary {
  submittedAt: string | null
  reviewedAt: string | null
  timeline: TimelineEvent[]
  rejection: RejectionInfo | null
  limits: Limits | null
  products: Product[]
  sandboxKeys: ApiKey[]
  liveKeys: ApiKey[]
  contract: { required: boolean; signedAt: string | null; signedBy: string | null }
  /** Go-live is blocked until the Enterprise contract is signed. */
  goLiveBlocked: boolean
  flags: StatusFlag[]
  /** AE cap reached and AE_CAP_BEHAVIOUR is BLOCK. */
  transactionsBlocked: boolean
  aeUsage: { annualDzd: number; capDzd: number; ratio: number } | null
  monthlyVolumeDzd: number
  upgrade: UpgradeInfo | null
  notifications: NotificationItem[]
  anaeActivityCode: string | null
}

export interface AnaeActivityResult {
  code: string
  labelFr: string
  labelAr: string
  paymentCategories: string[]
}

export interface UploadInput {
  file: { name: string; size: number; type: string }
  docType: string
  onProgress?: (pct: number) => void
}

// ---------- admin ----------

export interface SubmissionRow {
  id: string
  displayName: string
  email: string
  partnerType: PartnerType
  kycLevel: KycLevel
  status: MerchantStatus
  kyb: KybStatus | null
  submittedAt: string | null
  lastCompletedStep: StepId | null
  volumeBand: string | null
  flags: StatusFlag[]
  isUpgrade: boolean
  anaeActivityCode: string | null
}

export interface SubmissionFilter {
  view: 'submissions' | 'drafts'
  level?: KycLevel
  partnerType?: PartnerType
  status?: MerchantStatus
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
  details?: Record<string, unknown>
}

export interface SubmissionDetail extends SubmissionRow {
  draft: PartnerDraft
  rejection: RejectionInfo | null
  checklist: Record<string, boolean>
  checklistKeys: string[]
  documents: Array<{ key: string; stepId: StepId; field: string; docType: string; doc: UploadedDocument | null }>
  contract: { required: boolean; signedAt: string | null; signedBy: string | null }
  limits: Limits | null
  liveKeys: ApiKey[]
  upgradeFrom: PartnerType | null
  routedToEnterprise: boolean
  aeUsage: { annualDzd: number; capDzd: number; ratio: number } | null
  monthlyVolumeDzd: number
}

export interface PartnerApi {
  // auth
  getSession(): Promise<ApiResult<PartnerSummary | null>>
  login(input: { email: string; password: string }): Promise<ApiResult<PartnerSummary>>
  logout(): Promise<ApiResult<null>>
  // account
  sendOtp(input: { channel: 'EMAIL' | 'PHONE'; value: string }): Promise<ApiResult<{ sent: true }>>
  verifyOtp(input: { channel: 'EMAIL' | 'PHONE'; value: string; code: string }): Promise<ApiResult<{ verified: true }>>
  createAccount(input: { partnerType: PartnerType; data: StepData }): Promise<ApiResult<PartnerSummary & { sandboxKeys: ApiKey[] }>>
  // draft
  getDraft(): Promise<ApiResult<{ draft: PartnerDraft; summary: PartnerSummary }>>
  setPartnerType(type: PartnerType): Promise<ApiResult<{ draft: PartnerDraft; summary: PartnerSummary }>>
  saveStep(input: { stepId: StepId; data: StepData; complete: boolean }): Promise<ApiResult<{ draft: PartnerDraft; summary: PartnerSummary }>>
  validateField(input: { field: string; value: string }): Promise<ApiResult<ValidateFieldResult>>
  uploadDocument(input: UploadInput): Promise<ApiResult<UploadedDocument>>
  searchAnaeActivities(query: string): Promise<ApiResult<AnaeActivityResult[]>>
  // lifecycle
  submit(): Promise<ApiResult<{ status: MerchantStatus; expectedReviewHours: number }>>
  getPartnerStatus(): Promise<ApiResult<PartnerStatus>>
  resubmit(input: { changes: Record<StepId, StepData> }): Promise<ApiResult<{ status: MerchantStatus }>>
  startUpgrade(toType: PartnerType): Promise<ApiResult<{ draft: PartnerDraft; summary: PartnerSummary }>>
  /** Approved partner updates the declared monthly volume (limits only change after an admin review). */
  updateDeclaredVolume(input: { volumeBand: string; avgTicketDzd?: number }): Promise<ApiResult<PartnerStatus>>
  /** Is a payment-link/invoice category allowed for this partner? (AE: only categories mapped to the ANAE code.) */
  checkPaymentCategory(category: string): Promise<ApiResult<{ allowed: boolean; allowedCategories: string[] }>>
  // admin
  admin: {
    listSubmissions(filter: SubmissionFilter): Promise<ApiResult<SubmissionRow[]>>
    getSubmission(id: string): Promise<ApiResult<SubmissionDetail>>
    setChecklistItem(id: string, key: string, checked: boolean): Promise<ApiResult<null>>
    approve(id: string): Promise<ApiResult<SubmissionDetail>>
    reject(id: string, input: { code: RejectionReasonCode; text: string; flaggedFields?: string[] }): Promise<ApiResult<SubmissionDetail>>
    markContractSigned(id: string): Promise<ApiResult<SubmissionDetail>>
    listAudit(id: string): Promise<ApiResult<AuditEntry[]>>
  }
  // dev / QA only (mock). Not part of the real backend.
  dev: {
    reset(): Promise<void>
    setVolumes(input: { annualDzd?: number; monthlyDzd?: number }): Promise<ApiResult<PartnerStatus>>
  }
}
