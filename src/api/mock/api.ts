// Mock implementation of PartnerApi. Server-side rules (validation on save/submit, duplicates,
// status transitions, flagged-fields-only resubmit) are enforced here with the SAME shared code the
// portal uses, so this doubles as an executable spec for the real backend.
import { ANAE_ACTIVITIES } from './seed/anaeActivities'
import { REJECTION_REASONS, type RejectionReasonCode } from '@/shared/config/reasons'
import { getPartnerType, hasPartnerType } from '@/shared/config/partnerTypes'
import { EXPECTED_REVIEW_HOURS } from '@/shared/config/tbd'
import { UPLOAD_LIMITS } from '@/shared/config/steps'
import { canonicalValue, dedupeEntries } from '@/shared/dedupe'
import {
  canTransition,
  changePartnerType,
  effectiveType,
  getStepDef,
  isFieldVisible,
  makeContext,
  resolveSteps,
  stepFields,
} from '@/shared/flow'
import { evaluateFlags, aeUsage, limitsFor, transactionsBlocked } from '@/shared/limits'
import { requiredDocuments, validateStepInContext, validateSubmission } from '@/shared/schema'
import type {
  FieldErrors,
  MerchantStatus,
  PartnerDraft,
  RejectionInfo,
  StepData,
  StepId,
  UploadedDocument,
} from '@/shared/types'
import { DUPLICATE_CHECKED_FIELDS, validateFormat } from '@/shared/validators'
import type {
  AnaeActivityResult,
  ApiErrorCode,
  ApiResult,
  AuditEntry,
  NotificationItem,
  PartnerApi,
  PartnerStatus,
  PartnerSummary,
  SubmissionDetail,
  SubmissionRow,
  TimelineEvent,
  ValidateFieldResult,
} from '../types'
import { db, mockOptions, MOCK_OTP, nextId, nowIso, persist, resetDb, wait, type PartnerRecord } from './db'
import { makeKey } from './keys'
import { messageFor } from './messages'

const ADMIN = 'admin@mizaniyapay.dz'

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data: JSON.parse(JSON.stringify(data ?? null)) as T })
const fail = (error: ApiErrorCode, extra: { fieldErrors?: FieldErrors; message?: string } = {}): ApiResult<never> => ({
  ok: false,
  error,
  ...extra,
})

async function run<T>(fn: () => ApiResult<T>): Promise<ApiResult<T>> {
  await wait(mockOptions.latencyMs)
  const r = fn()
  persist()
  return r
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// ---------- helpers ----------

function me(): PartnerRecord | null {
  const id = db().sessionPartnerId
  return db().partners.find((p) => p.id === id) ?? null
}
const byId = (id: string) => db().partners.find((p) => p.id === id) ?? null

function audit(p: PartnerRecord, actor: string, action: string, details?: Record<string, unknown>) {
  const e: AuditEntry = { id: nextId('aud'), at: nowIso(), actor, action, details }
  p.audit.push(e)
}
function notify(p: PartnerRecord, kind: NotificationItem['kind'], subject: string, channel: NotificationItem['channel'] = 'EMAIL') {
  p.notifications.push({ id: nextId('ntf'), at: nowIso(), channel, kind, subject })
}

/** What the partner is currently editing: the main signup, or an upgrade of an approved account. */
interface Subject {
  kind: 'main' | 'upgrade'
  draft: PartnerDraft
  status: MerchantStatus
  rejection: RejectionInfo | null
}
function subjectOf(p: PartnerRecord): Subject {
  if (p.status === 'APPROVED' && p.upgrade) {
    return { kind: 'upgrade', draft: p.upgrade.draft, status: p.upgrade.status, rejection: p.upgrade.rejection ?? null }
  }
  return { kind: 'main', draft: p.draft, status: p.status, rejection: p.rejection }
}
function setSubject(p: PartnerRecord, s: Partial<Subject>) {
  if (p.status === 'APPROVED' && p.upgrade) {
    if (s.draft) p.upgrade.draft = s.draft
    if (s.status) p.upgrade.status = s.status as 'DRAFT' | 'PENDING_APPROVAL' | 'REJECTED'
    if (s.rejection !== undefined) p.upgrade.rejection = s.rejection
  } else {
    if (s.draft) p.draft = s.draft
    if (s.status) {
      p.status = s.status
      p.kyb = s.status === 'DRAFT' ? null : s.status === 'PENDING_APPROVAL' ? 'PENDING' : s.status
    }
    if (s.rejection !== undefined) p.rejection = s.rejection
  }
}

function displayName(d: PartnerDraft): string {
  const b = d.steps.business ?? {}
  const a = d.steps.account ?? {}
  return String(b.companyName || b.tradeName || a.fullName || a.email || '—')
}

function summary(p: PartnerRecord): PartnerSummary {
  const d = p.draft
  const eff = hasPartnerType(d.partnerType) ? effectiveType(d.partnerType, d.steps) : null
  return {
    id: p.id,
    status: p.status,
    kyb: p.kyb,
    partnerType: d.partnerType,
    effectiveType: eff,
    routedToEnterprise: !!eff && eff !== d.partnerType,
    isUpgrade: false,
    kycLevel: p.kycLevel,
    lastCompletedStep: d.lastCompletedStep,
    email: String(d.steps.account?.email ?? ''),
    displayName: displayName(d),
  }
}
/** Summary of what the partner is editing (upgrade draft if any). */
function subjectSummary(p: PartnerRecord): PartnerSummary {
  const s = subjectOf(p)
  const base = summary(p)
  if (s.kind === 'main') return base
  const eff = hasPartnerType(s.draft.partnerType) ? effectiveType(s.draft.partnerType, s.draft.steps) : null
  return {
    ...base,
    status: s.status,
    partnerType: s.draft.partnerType,
    effectiveType: eff,
    routedToEnterprise: !!eff && eff !== s.draft.partnerType,
    isUpgrade: true,
    lastCompletedStep: s.draft.lastCompletedStep,
  }
}

/** Duplicate check of one canonical value against every other partner (upgrade drafts included). */
function isDuplicate(field: string, value: string, exceptId: string | null): boolean {
  return db().partners.some((p) => {
    if (p.id === exceptId) return false
    const drafts = p.upgrade ? [p.draft, p.upgrade.draft] : [p.draft]
    return drafts.some((d) => dedupeEntries(d).some((e) => e.field === field && e.value === value))
  })
}

function duplicateErrors(draft: PartnerDraft, exceptId: string | null, onlyStep?: StepId): FieldErrors {
  const errs: FieldErrors = {}
  for (const e of dedupeEntries(draft)) {
    if (onlyStep && e.stepId !== onlyStep) continue
    if (isDuplicate(e.field, e.value, exceptId)) errs[onlyStep ? e.fieldName : `${e.stepId}.${e.fieldName}`] = `duplicate.${e.field}`
  }
  return errs
}

/** The server decides what is verified: an OTP it verified, or an unchanged value it already verified. */
function withServerVerification(data: StepData, previous?: StepData): StepData {
  const v = db().verified
  const email = typeof data.email === 'string' ? canonicalValue('email', data.email) : ''
  const phone = typeof data.phone === 'string' ? canonicalValue('phone', data.phone) : ''
  const unchanged = (field: 'email' | 'phone', flag: 'emailVerified' | 'phoneVerified', cur: string) =>
    previous?.[flag] === true && typeof previous[field] === 'string' && canonicalValue(field, previous[field] as string) === cur
  return {
    ...data,
    emailVerified: v.includes(`EMAIL:${email}`) || unchanged('email', 'emailVerified', email),
    phoneVerified: v.includes(`PHONE:${phone}`) || unchanged('phone', 'phoneVerified', phone),
  }
}

const stepIndex = (draft: PartnerDraft, id: StepId) =>
  hasPartnerType(draft.partnerType) ? resolveSteps(draft.partnerType, draft.steps).indexOf(id) : -1

// ---------- status ----------

function buildStatus(p: PartnerRecord): PartnerStatus {
  const s = summary(p)
  const eff = s.effectiveType
  const cfg = eff ? getPartnerType(eff) : null
  const band = (p.draft.steps.settlement?.volumeBand as string | undefined) ?? null
  const approved = p.status === 'APPROVED'
  const flags = approved && eff ? evaluateFlags({ type: eff, band, annualDzd: p.annualVolumeDzd, monthlyDzd: p.monthlyVolumeDzd }) : []
  const requiresContract = !!cfg?.requiresContract
  const timeline: TimelineEvent[] = [
    { state: 'SUBMITTED', at: p.submittedAt, done: !!p.submittedAt },
    { state: 'IN_REVIEW', at: null, done: !!p.submittedAt },
    {
      state: p.status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
      at: p.reviewedAt,
      done: p.status === 'APPROVED' || p.status === 'REJECTED',
    },
  ]
  return {
    ...s,
    submittedAt: p.submittedAt,
    reviewedAt: p.reviewedAt,
    timeline,
    rejection: p.rejection,
    limits: approved ? p.limits : null,
    products: approved && cfg ? cfg.products : [],
    sandboxKeys: p.sandboxKeys,
    liveKeys: p.liveKeys,
    contract: { required: requiresContract, signedAt: p.contractSignedAt, signedBy: p.contractSignedBy },
    goLiveBlocked: approved && requiresContract && !p.contractSignedAt,
    flags,
    transactionsBlocked: transactionsBlocked(flags),
    aeUsage: eff ? aeUsage(eff, p.annualVolumeDzd) : null,
    monthlyVolumeDzd: p.monthlyVolumeDzd,
    upgrade: p.upgrade ? { toType: p.upgrade.toType, status: p.upgrade.status, rejection: p.upgrade.rejection } : null,
    notifications: p.notifications,
    anaeActivityCode: (p.draft.steps.business?.activityCode as string | undefined) ?? null,
  }
}

// ---------- admin views ----------

/** What an admin reviews: a pending upgrade if there is one, otherwise the main signup. */
function reviewView(p: PartnerRecord) {
  const upgrade = p.status === 'APPROVED' && p.upgrade && p.upgrade.status !== 'DRAFT'
  const draft = upgrade ? p.upgrade!.draft : p.draft
  const status: MerchantStatus = upgrade ? p.upgrade!.status : p.status
  const type = hasPartnerType(draft.partnerType) ? effectiveType(draft.partnerType, draft.steps) : null
  return { isUpgrade: !!upgrade, draft, status, type, rejection: upgrade ? (p.upgrade!.rejection ?? null) : p.rejection }
}

function row(p: PartnerRecord): SubmissionRow | null {
  const v = reviewView(p)
  if (!v.type) return null
  const cfg = getPartnerType(v.type)
  const band = (v.draft.steps.settlement?.volumeBand as string | undefined) ?? null
  const main = effectiveType(p.draft.partnerType ?? v.type, p.draft.steps)
  const flags =
    p.status === 'APPROVED'
      ? evaluateFlags({ type: main, band: (p.draft.steps.settlement?.volumeBand as string) ?? null, annualDzd: p.annualVolumeDzd, monthlyDzd: p.monthlyVolumeDzd })
      : []
  return {
    id: p.id,
    displayName: displayName(v.draft),
    email: String(p.draft.steps.account?.email ?? ''),
    partnerType: v.type,
    kycLevel: cfg.kycLevel,
    status: v.status === 'PENDING_APPROVAL' || p.status !== 'APPROVED' ? v.status : p.status,
    kyb: p.kyb,
    submittedAt: p.submittedAt,
    lastCompletedStep: v.draft.lastCompletedStep,
    volumeBand: band,
    flags,
    isUpgrade: v.isUpgrade,
    anaeActivityCode: (v.draft.steps.business?.activityCode as string | undefined) ?? null,
  }
}

function detail(p: PartnerRecord): SubmissionDetail {
  const v = reviewView(p)
  const r = row(p)!
  const cfg = getPartnerType(v.type!)
  const checklist = v.isUpgrade ? p.upgrade!.checklist : p.checklist
  return {
    ...r,
    draft: v.draft,
    rejection: v.rejection,
    checklist,
    checklistKeys: cfg.reviewChecklist,
    documents: requiredDocuments(v.draft),
    contract: { required: !!cfg.requiresContract, signedAt: p.contractSignedAt, signedBy: p.contractSignedBy },
    limits: p.limits,
    liveKeys: p.liveKeys,
    upgradeFrom: v.isUpgrade ? (p.draft.partnerType ? effectiveType(p.draft.partnerType, p.draft.steps) : null) : null,
    routedToEnterprise: !!v.draft.partnerType && v.type !== v.draft.partnerType,
    aeUsage: aeUsage(v.type!, p.annualVolumeDzd),
    monthlyVolumeDzd: p.monthlyVolumeDzd,
  }
}

/** All `${stepId}.${field}` keys an admin may flag for this draft. */
function flaggableKeys(draft: PartnerDraft): Set<string> {
  const out = new Set<string>()
  if (!hasPartnerType(draft.partnerType)) return out
  const ctx = makeContext(draft.partnerType, draft.steps)
  const cfg = getPartnerType(ctx.effectiveType)
  for (const id of resolveSteps(draft.partnerType, draft.steps)) {
    const def = getStepDef(cfg, id)
    if (!def) continue
    for (const f of stepFields(def)) {
      if (f.kind !== 'notice' && isFieldVisible(f, draft.steps[id] ?? {}, ctx)) out.add(`${id}.${f.name}`)
    }
  }
  return out
}

// ---------- the API ----------

export const mockApi: PartnerApi = {
  getSession: () =>
    run(() => {
      const p = me()
      return ok(p ? subjectSummary(p) : null)
    }),

  login: ({ email, password }) =>
    run(() => {
      const e = canonicalValue('email', email)
      const p = db().partners.find((x) => canonicalValue('email', String(x.draft.steps.account?.email ?? '')) === e)
      if (!p || p.draft.steps.account?.password !== password) return fail('INVALID_CREDENTIALS')
      db().sessionPartnerId = p.id
      audit(p, 'partner', 'LOGIN')
      return ok(subjectSummary(p))
    }),

  logout: () =>
    run(() => {
      db().sessionPartnerId = null
      return ok(null)
    }),

  sendOtp: ({ channel, value }) =>
    run(() => {
      const code = validateFormat(channel === 'EMAIL' ? 'email' : 'phone', value)
      if (code) return fail('VALIDATION', { fieldErrors: { [channel === 'EMAIL' ? 'email' : 'phone']: code } })
      return ok({ sent: true as const }) // the code is always MOCK_OTP
    }),

  verifyOtp: ({ channel, value, code }) =>
    run(() => {
      if (code !== MOCK_OTP) return fail('OTP_INVALID')
      const key = `${channel}:${canonicalValue(channel === 'EMAIL' ? 'email' : 'phone', value)}`
      if (!db().verified.includes(key)) db().verified.push(key)
      return ok({ verified: true as const })
    }),

  createAccount: ({ partnerType, data }) =>
    run(() => {
      if (!hasPartnerType(partnerType)) return fail('VALIDATION', { fieldErrors: { partnerType: 'required' } })
      const account = withServerVerification(data)
      const draft: PartnerDraft = { partnerType, steps: { account }, lastCompletedStep: 'account' }
      const errors = {
        ...validateStepInContext('account', makeContext(partnerType, draft.steps)),
        ...duplicateErrors(draft, null, 'account'),
      }
      if (Object.keys(errors).length) return fail('VALIDATION', { fieldErrors: errors })
      const p: PartnerRecord = {
        id: nextId('P'),
        createdAt: nowIso(),
        status: 'DRAFT',
        kyb: null,
        draft,
        kycLevel: null,
        submittedAt: null,
        reviewedAt: null,
        rejection: null,
        rejectionHistory: [],
        limits: null,
        sandboxKeys: [makeKey('SANDBOX', 'ACTIVE')],
        liveKeys: [],
        contractSignedAt: null,
        contractSignedBy: null,
        annualVolumeDzd: 0,
        monthlyVolumeDzd: 0,
        checklist: {},
        notifications: [],
        audit: [],
        upgrade: null,
      }
      db().partners.push(p)
      db().sessionPartnerId = p.id
      audit(p, 'partner', 'ACCOUNT_CREATED', { partnerType })
      return ok({ ...summary(p), sandboxKeys: p.sandboxKeys })
    }),

  getDraft: () =>
    run(() => {
      const p = me()
      if (!p) return fail('UNAUTHENTICATED')
      return ok({ draft: subjectOf(p).draft, summary: subjectSummary(p) })
    }),

  setPartnerType: (type) =>
    run(() => {
      const p = me()
      if (!p) return fail('UNAUTHENTICATED')
      const s = subjectOf(p)
      if (s.kind !== 'main' || s.status !== 'DRAFT') return fail('INVALID_STATE')
      if (!hasPartnerType(type)) return fail('VALIDATION')
      setSubject(p, { draft: changePartnerType(s.draft, type) })
      audit(p, 'partner', 'PARTNER_TYPE_CHANGED', { from: s.draft.partnerType, to: type })
      return ok({ draft: p.draft, summary: summary(p) })
    }),

  saveStep: ({ stepId, data, complete }) =>
    run(() => {
      const p = me()
      if (!p) return fail('UNAUTHENTICATED')
      const s = subjectOf(p)
      if (s.status !== 'DRAFT') return fail('INVALID_STATE')
      const draft = clone(s.draft)
      if (!hasPartnerType(draft.partnerType)) return fail('INVALID_STATE')
      if (stepIndex(draft, stepId) < 1) return fail('NOT_FOUND')
      const stepData = stepId === 'account' ? withServerVerification({ ...data, password: data.password ?? draft.steps.account?.password }, s.draft.steps.account) : data
      draft.steps[stepId] = stepData
      if (complete) {
        const errors = {
          ...validateStepInContext(stepId, makeContext(draft.partnerType, draft.steps)),
          ...duplicateErrors(draft, p.id, stepId),
        }
        if (Object.keys(errors).length) return fail('VALIDATION', { fieldErrors: errors })
        const prev = draft.lastCompletedStep ? stepIndex(draft, draft.lastCompletedStep) : -1
        if (stepIndex(draft, stepId) > prev) draft.lastCompletedStep = stepId
        audit(p, 'partner', 'STEP_SAVED', { stepId })
      }
      setSubject(p, { draft })
      return ok({ draft, summary: subjectSummary(p) })
    }),

  validateField: ({ field, value }) =>
    run(() => {
      const res = (valid: boolean, code: string | null): ApiResult<ValidateFieldResult> =>
        ok({ valid, code, field, message: code ? messageFor(code, field) : null })
      if (!value.trim()) return res(true, null)
      const formatErr = validateFormat(field, value)
      if (formatErr) return res(false, formatErr)
      if ((DUPLICATE_CHECKED_FIELDS as readonly string[]).includes(field)) {
        if (isDuplicate(field, canonicalValue(field, value), me()?.id ?? null)) return res(false, 'duplicate')
      }
      return res(true, null)
    }),

  uploadDocument: async ({ file, docType, onProgress }) => {
    await wait(mockOptions.latencyMs)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const typeOk = UPLOAD_LIMITS.mime.includes(file.type) || ['jpg', 'jpeg', 'png', 'pdf'].includes(ext)
    if (!typeOk) return fail('FILE_TYPE')
    if (file.size > UPLOAD_LIMITS.maxBytes) return fail('FILE_TOO_LARGE')
    for (const pct of [20, 45, 70, 90]) {
      onProgress?.(pct)
      await wait(mockOptions.uploadStepMs)
    }
    if (file.name.toLowerCase().includes('fail')) return fail('UPLOAD_FAILED') // QA trigger
    onProgress?.(100)
    const doc: UploadedDocument = {
      id: nextId('doc'),
      name: file.name,
      size: file.size,
      mime: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      status: 'uploaded',
    }
    void docType
    persist()
    return ok(doc)
  },

  searchAnaeActivities: (q) =>
    run(() => {
      const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      const needle = norm(q.trim())
      const list: AnaeActivityResult[] = ANAE_ACTIVITIES.filter(
        (a) => !needle || norm(a.code).includes(needle) || norm(a.labelFr).includes(needle) || a.labelAr.includes(q.trim()),
      )
        .slice(0, 20)
        .map((a) => ({ ...a }))
      return ok(list)
    }),

  submit: () =>
    run(() => {
      const p = me()
      if (!p) return fail('UNAUTHENTICATED')
      const s = subjectOf(p)
      if (s.status !== 'DRAFT' || !canTransition('DRAFT', 'PENDING_APPROVAL')) return fail('INVALID_STATE')
      const errors = { ...validateSubmission(s.draft), ...duplicateErrors(s.draft, p.id) }
      if (Object.keys(errors).length) return fail('VALIDATION', { fieldErrors: errors })
      const eff = effectiveType(s.draft.partnerType!, s.draft.steps)
      if (s.kind === 'main') {
        p.kycLevel = getPartnerType(eff).kycLevel
        p.submittedAt = nowIso()
      }
      setSubject(p, { status: 'PENDING_APPROVAL', rejection: null })
      notify(p, 'SUBMITTED', 'We received your application')
      audit(p, 'partner', s.kind === 'upgrade' ? 'UPGRADE_SUBMITTED' : 'SUBMITTED', { partnerType: eff })
      return ok({ status: 'PENDING_APPROVAL' as MerchantStatus, expectedReviewHours: EXPECTED_REVIEW_HOURS })
    }),

  getPartnerStatus: () =>
    run(() => {
      const p = me()
      return p ? ok(buildStatus(p)) : fail('UNAUTHENTICATED')
    }),

  resubmit: ({ changes }) =>
    run(() => {
      const p = me()
      if (!p) return fail('UNAUTHENTICATED')
      const s = subjectOf(p)
      if (s.status !== 'REJECTED' || !canTransition('REJECTED', 'PENDING_APPROVAL')) return fail('INVALID_STATE')
      const flagged = new Set(s.rejection?.flaggedFields ?? [])
      const draft = clone(s.draft)
      const notFlagged: FieldErrors = {}
      for (const [stepId, data] of Object.entries(changes)) {
        const before = draft.steps[stepId] ?? {}
        for (const [field, value] of Object.entries(data)) {
          if (same(before[field], value)) continue
          // Only flagged items may change. With no flags at all the rejection was general: allow edits.
          if (flagged.size > 0 && !flagged.has(`${stepId}.${field}`)) notFlagged[`${stepId}.${field}`] = 'notFlagged'
        }
        draft.steps[stepId] = { ...before, ...data }
      }
      if (Object.keys(notFlagged).length) return fail('NOT_FLAGGED', { fieldErrors: notFlagged })
      if (draft.steps.account) {
        draft.steps.account = withServerVerification(draft.steps.account, s.draft.steps.account)
      }
      const errors = { ...validateSubmission(draft), ...duplicateErrors(draft, p.id) }
      if (Object.keys(errors).length) return fail('VALIDATION', { fieldErrors: errors })
      if (s.rejection) p.rejectionHistory.push(s.rejection)
      setSubject(p, { draft, status: 'PENDING_APPROVAL', rejection: null })
      if (s.kind === 'main') p.submittedAt = nowIso()
      audit(p, 'partner', 'RESUBMITTED', { changed: Object.keys(changes) })
      return ok({ status: 'PENDING_APPROVAL' as MerchantStatus })
    }),

  startUpgrade: (toType) =>
    run(() => {
      const p = me()
      if (!p) return fail('UNAUTHENTICATED')
      if (p.status !== 'APPROVED' || !hasPartnerType(p.draft.partnerType)) return fail('INVALID_STATE')
      if (p.upgrade) return ok({ draft: p.upgrade.draft, summary: subjectSummary(p) })
      const from = effectiveType(p.draft.partnerType, p.draft.steps)
      if (!getPartnerType(from).upgradeTargets.includes(toType)) return fail('VALIDATION', { fieldErrors: { toType: 'invalidOption' } })
      const base = clone(p.draft)
      delete base.steps.review // declarations are re-accepted for the upgrade
      p.upgrade = { toType, status: 'DRAFT', rejection: null, draft: changePartnerType(base, toType), checklist: {} }
      audit(p, 'partner', 'UPGRADE_STARTED', { from, toType })
      return ok({ draft: p.upgrade.draft, summary: subjectSummary(p) })
    }),

  admin: {
    listSubmissions: (f) =>
      run(() => {
        const rows = db()
          .partners.filter((p) => (f.view === 'drafts' ? p.status === 'DRAFT' : p.status !== 'DRAFT'))
          .map(row)
          .filter((r): r is SubmissionRow => !!r)
          .filter((r) => (f.level ? r.kycLevel === f.level : true))
          .filter((r) => (f.partnerType ? r.partnerType === f.partnerType : true))
          .filter((r) => (f.status ? r.status === f.status : true))
          .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
        return ok(rows)
      }),

    getSubmission: (id) =>
      run(() => {
        const p = byId(id)
        return p && row(p) ? ok(detail(p)) : fail('NOT_FOUND')
      }),

    setChecklistItem: (id, key, checked) =>
      run(() => {
        const p = byId(id)
        if (!p) return fail('NOT_FOUND')
        const v = reviewView(p)
        const target = v.isUpgrade ? p.upgrade!.checklist : p.checklist
        target[key] = checked
        audit(p, ADMIN, 'CHECKLIST_ITEM', { key, checked })
        return ok(null)
      }),

    approve: (id) =>
      run(() => {
        const p = byId(id)
        if (!p || !row(p)) return fail('NOT_FOUND')
        const v = reviewView(p)
        if (v.status !== 'PENDING_APPROVAL' || !canTransition('PENDING_APPROVAL', 'APPROVED')) return fail('INVALID_STATE')
        const type = v.type!
        const cfg = getPartnerType(type)
        const band = (v.draft.steps.settlement?.volumeBand as string | undefined) ?? null
        p.kycLevel = cfg.kycLevel
        p.limits = limitsFor(type, band)
        p.reviewedAt = nowIso()
        if (v.isUpgrade) {
          p.draft = p.upgrade!.draft
          p.upgrade = null
          if (cfg.requiresContract) {
            p.contractSignedAt = null
            p.contractSignedBy = null
          }
          notify(p, 'UPGRADE_APPROVED', `Your upgrade to ${type} is approved`)
          audit(p, ADMIN, 'UPGRADE_APPROVED', { type, kycLevel: cfg.kycLevel })
        } else {
          p.status = 'APPROVED'
          p.kyb = 'APPROVED'
          p.rejection = null
          // Enterprise: live key stays inactive until the contract is marked signed.
          p.liveKeys = [makeKey('LIVE', cfg.requiresContract ? 'INACTIVE' : 'ACTIVE')]
          notify(p, 'APPROVED', 'Your Mizaniya Pay account is approved')
          audit(p, ADMIN, 'APPROVED', { type, kycLevel: cfg.kycLevel, band, limits: p.limits })
        }
        return ok(detail(p))
      }),

    reject: (id, { code, text, flaggedFields = [] }) =>
      run(() => {
        const p = byId(id)
        if (!p || !row(p)) return fail('NOT_FOUND')
        const v = reviewView(p)
        if (v.status !== 'PENDING_APPROVAL' || !canTransition('PENDING_APPROVAL', 'REJECTED')) return fail('INVALID_STATE')
        const errors: FieldErrors = {}
        if (!(REJECTION_REASONS as readonly string[]).includes(code)) errors.code = 'required'
        if (!text.trim()) errors.text = 'required'
        const allowed = flaggableKeys(v.draft)
        if (flaggedFields.some((k) => !allowed.has(k))) errors.flaggedFields = 'invalidOption'
        if (Object.keys(errors).length) return fail('VALIDATION', { fieldErrors: errors })
        const rejection: RejectionInfo = { code: code as RejectionReasonCode, text: text.trim(), flaggedFields }
        if (v.isUpgrade) {
          setSubject(p, { status: 'REJECTED', rejection })
        } else {
          p.status = 'REJECTED'
          p.kyb = 'REJECTED'
          p.rejection = rejection
          p.reviewedAt = nowIso()
        }
        p.rejectionHistory.push(rejection)
        notify(p, 'REJECTED', 'Your application needs changes')
        audit(p, ADMIN, v.isUpgrade ? 'UPGRADE_REJECTED' : 'REJECTED', { code, text: rejection.text, flaggedFields })
        return ok(detail(p))
      }),

    markContractSigned: (id) =>
      run(() => {
        const p = byId(id)
        if (!p || !row(p)) return fail('NOT_FOUND')
        const eff = hasPartnerType(p.draft.partnerType) ? effectiveType(p.draft.partnerType, p.draft.steps) : null
        if (!eff || !getPartnerType(eff).requiresContract || p.status !== 'APPROVED' || p.contractSignedAt) return fail('INVALID_STATE')
        p.contractSignedAt = nowIso()
        p.contractSignedBy = ADMIN
        p.liveKeys = p.liveKeys.length ? p.liveKeys.map((k) => ({ ...k, status: 'ACTIVE' as const })) : [makeKey('LIVE', 'ACTIVE')]
        notify(p, 'CONTRACT_SIGNED', 'Your contract is signed: you can go live')
        audit(p, ADMIN, 'CONTRACT_SIGNED')
        return ok(detail(p))
      }),

    listAudit: (id) =>
      run(() => {
        const p = byId(id)
        return p ? ok([...p.audit].sort((a, b) => b.at.localeCompare(a.at))) : fail('NOT_FOUND')
      }),
  },

  dev: {
    reset: async () => {
      resetDb()
    },
    setVolumes: ({ annualDzd, monthlyDzd }) =>
      run(() => {
        const p = me()
        if (!p) return fail('UNAUTHENTICATED')
        if (annualDzd !== undefined) p.annualVolumeDzd = annualDzd
        if (monthlyDzd !== undefined) p.monthlyVolumeDzd = monthlyDzd
        const st = buildStatus(p)
        const done = new Set(p.notifications.map((n) => n.kind))
        for (const f of st.flags) {
          if (done.has(f)) continue
          notify(p, f, f === 'AE_CAP_80' ? 'You reached 80% of your annual cap' : f === 'AE_CAP_100' ? 'Annual cap reached: account under review' : 'Your volume exceeds your declared band')
          audit(p, 'system', f)
        }
        return ok(buildStatus(p))
      }),
  },
}
