import { beforeEach, describe, expect, it } from 'vitest'
import { api, DEMO_DUPLICATES, DEMO_PASSWORD, MOCK_OTP } from '@/api'
import { resetDb } from '@/api/mock/db'
import type { ApiResult } from '@/api/types'
import { requiredDocuments } from '@/shared/schema'
import type { PartnerDraft, StepData } from '@/shared/types'
import { doc, validDraft } from './helpers'

const TYPES = ['AUTO_ENTREPRENEUR', 'INDIVIDUAL_TRADER', 'COMPANY', 'ENTERPRISE'] as const

function must<T>(r: ApiResult<T>): T {
  if (!r.ok) throw new Error(`API error ${r.error} ${JSON.stringify(r.fieldErrors ?? {})}`)
  return r.data
}

async function verifyContacts(account: StepData) {
  for (const [channel, value] of [['EMAIL', account.email], ['PHONE', account.phone]] as const) {
    must(await api.sendOtp({ channel, value: String(value) }))
    must(await api.verifyOtp({ channel, value: String(value), code: MOCK_OTP }))
  }
}

/** Walk the whole signup through the API, stopping before submit when `submit` is false. */
async function signup(type: string, submit = true, tweak?: (d: PartnerDraft) => void) {
  const d = validDraft(type)
  tweak?.(d)
  await verifyContacts(d.steps.account)
  must(await api.createAccount({ partnerType: type, data: d.steps.account }))
  for (const stepId of ['business', 'settlement', 'enterpriseDocs', 'review']) {
    if (!d.steps[stepId]) continue
    must(await api.saveStep({ stepId, data: d.steps[stepId], complete: true }))
  }
  if (submit) must(await api.submit())
  return d
}

beforeEach(async () => {
  await api.dev.reset()
  await api.logout()
})

describe('account creation', () => {
  it('creates a DRAFT account with sandbox keys and logs the partner in', async () => {
    const d = validDraft('COMPANY')
    await verifyContacts(d.steps.account)
    const s = must(await api.createAccount({ partnerType: 'COMPANY', data: d.steps.account }))
    expect(s.status).toBe('DRAFT')
    expect(s.kyb).toBeNull()
    expect(s.sandboxKeys).toHaveLength(1)
    expect(s.sandboxKeys[0]).toMatchObject({ env: 'SANDBOX', status: 'ACTIVE' })
    expect(must(await api.getSession())?.id).toBe(s.id)
  })

  it('refuses unverified email/phone even if the client claims they are verified', async () => {
    const d = validDraft('COMPANY')
    const r = await api.createAccount({ partnerType: 'COMPANY', data: { ...d.steps.account, emailVerified: true, phoneVerified: true } })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.fieldErrors?.email).toBe('notVerified')
      expect(r.fieldErrors?.phone).toBe('notVerified')
    }
  })

  it('rejects a wrong OTP and sends no field to the generic toast path', async () => {
    const r = await api.verifyOtp({ channel: 'EMAIL', value: 'a@b.dz', code: '000000' })
    expect(r).toEqual({ ok: false, error: 'OTP_INVALID' })
  })

  it('reports duplicate email/phone/NIN as field-level errors', async () => {
    const d = validDraft('COMPANY')
    const account = { ...d.steps.account, email: DEMO_DUPLICATES.email, phone: DEMO_DUPLICATES.phone, nin: DEMO_DUPLICATES.nin }
    await verifyContacts(account)
    const r = await api.createAccount({ partnerType: 'COMPANY', data: account })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('VALIDATION')
      expect(r.fieldErrors).toMatchObject({ email: 'duplicate.email', phone: 'duplicate.phone', nin: 'duplicate.nin' })
    }
  })
})

describe('validate-field (fixes 869e4xg74)', () => {
  it('returns format errors', async () => {
    const r = must(await api.validateField({ field: 'rc', value: '!' }))
    expect(r).toMatchObject({ valid: false, code: 'invalidRc', field: 'rc' })
    expect(r.message).toMatch(/RC/)
  })

  it.each(Object.entries(DEMO_DUPLICATES))('flags an already registered %s', async (field, value) => {
    const r = must(await api.validateField({ field, value }))
    expect(r).toMatchObject({ valid: false, code: 'duplicate', field })
    expect(r.message).toMatch(/already registered/i)
  })

  it('RC duplicate message matches the story', async () => {
    const r = must(await api.validateField({ field: 'rc', value: DEMO_DUPLICATES.rc }))
    expect(r.message).toBe('This RC is already registered.')
  })

  it('ignores spacing / case / separators when comparing', async () => {
    const r = must(await api.validateField({ field: 'rc', value: ' rc demo 0001 ' }))
    expect(r.code).toBe('duplicate')
    expect(must(await api.validateField({ field: 'phone', value: '0550 00 00 01' })).code).toBe('duplicate')
    expect(must(await api.validateField({ field: 'email', value: 'TAKEN@mizaniya.dz' })).code).toBe('duplicate')
  })

  it('accepts fresh values and empty values', async () => {
    expect(must(await api.validateField({ field: 'rc', value: 'RC-FRESH-999' })).valid).toBe(true)
    expect(must(await api.validateField({ field: 'nif', value: '' })).valid).toBe(true)
  })

  it('does not flag the partner’s own values', async () => {
    const r = must(await api.login({ email: 'ae.demo@mizaniya.dz', password: DEMO_PASSWORD }))
    expect(r.email).toBe('ae.demo@mizaniya.dz')
    expect(must(await api.validateField({ field: 'anaeCardNumber', value: DEMO_DUPLICATES.anaeCardNumber })).valid).toBe(true)
  })
})

describe('draft, save and resume', () => {
  it('saves per step, tracks lastCompletedStep and resumes after login', async () => {
    const d = validDraft('INDIVIDUAL_TRADER')
    await verifyContacts(d.steps.account)
    must(await api.createAccount({ partnerType: d.partnerType!, data: d.steps.account }))
    must(await api.saveStep({ stepId: 'business', data: d.steps.business, complete: true }))
    await api.logout()
    must(await api.login({ email: 'new@partner.dz', password: 'Abcdefg1!xyz' }))
    const { draft, summary } = must(await api.getDraft())
    expect(draft.lastCompletedStep).toBe('business')
    expect(summary.lastCompletedStep).toBe('business')
    expect(draft.steps.business.nif).toBe(d.steps.business.nif)
  })

  it('incomplete partial saves do not advance completion and are not validated', async () => {
    const d = validDraft('COMPANY')
    await verifyContacts(d.steps.account)
    must(await api.createAccount({ partnerType: 'COMPANY', data: d.steps.account }))
    const r = must(await api.saveStep({ stepId: 'business', data: { companyName: 'Half' }, complete: false }))
    expect(r.draft.lastCompletedStep).toBe('account')
    expect(r.draft.steps.business).toEqual({ companyName: 'Half' })
  })

  it('server re-validates on save: invalid data is refused with field errors', async () => {
    const d = validDraft('COMPANY')
    await verifyContacts(d.steps.account)
    must(await api.createAccount({ partnerType: 'COMPANY', data: d.steps.account }))
    const r = await api.saveStep({ stepId: 'business', data: { ...d.steps.business, rc: DEMO_DUPLICATES.rc, nif: '!', statuts: null }, complete: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors).toMatchObject({ rc: 'duplicate.rc', nif: 'invalidNif', statuts: 'required' })
  })

  it('requires authentication', async () => {
    expect(await api.getDraft()).toEqual({ ok: false, error: 'UNAUTHENTICATED' })
    expect(await api.submit()).toEqual({ ok: false, error: 'UNAUTHENTICATED' })
  })

  it('changing type keeps shared data, resets type-specific data', async () => {
    await signup('AUTO_ENTREPRENEUR', false)
    const r = must(await api.setPartnerType('COMPANY'))
    expect(r.draft.steps.account).toBeDefined()
    expect(r.draft.steps.settlement).toBeDefined()
    expect(r.draft.steps.business.anaeCardNumber).toBeUndefined()
    expect(r.summary.partnerType).toBe('COMPANY')
  })
})

describe('uploads', () => {
  const ok = { name: 'cni.jpg', size: 1000, type: 'image/jpeg' }
  it('reports progress then returns the document', async () => {
    const seen: number[] = []
    const r = must(await api.uploadDocument({ file: ok, docType: 'idFront', onProgress: (p) => seen.push(p) }))
    expect(r).toMatchObject({ name: 'cni.jpg', status: 'uploaded' })
    expect(seen.at(-1)).toBe(100)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })
  it('rejects > 5 MB, wrong type, and the QA failure trigger', async () => {
    expect(await api.uploadDocument({ file: { ...ok, size: 6 * 1024 * 1024 }, docType: 'x' })).toMatchObject({ ok: false, error: 'FILE_TOO_LARGE' })
    expect(await api.uploadDocument({ file: { name: 'a.exe', size: 10, type: 'application/x-msdownload' }, docType: 'x' })).toMatchObject({ ok: false, error: 'FILE_TYPE' })
    expect(await api.uploadDocument({ file: { ...ok, name: 'will-fail.jpg' }, docType: 'x' })).toMatchObject({ ok: false, error: 'UPLOAD_FAILED' })
  })
})

describe('ANAE search', () => {
  it('searches by code and by name, accent-insensitive', async () => {
    expect(must(await api.searchAnaeActivities('001')).map((a) => a.code)).toContain('PLACEHOLDER-001')
    expect(must(await api.searchAnaeActivities('soutien'))[0].code).toBe('PLACEHOLDER-002')
    expect(must(await api.searchAnaeActivities('electrique')).length).toBe(0)
    expect(must(await api.searchAnaeActivities('')).length).toBeGreaterThan(1)
  })
})

describe.each(TYPES)('signup → submit → approve – %s', (type) => {
  it('goes DRAFT → PENDING_APPROVAL/PENDING → APPROVED/APPROVED with KYC level, limits and live keys', async () => {
    await signup(type, false)
    expect(must(await api.getPartnerStatus()).status).toBe('DRAFT')
    const sub = must(await api.submit())
    expect(sub.status).toBe('PENDING_APPROVAL')
    expect(sub.expectedReviewHours).toBeGreaterThan(0)
    const st = must(await api.getPartnerStatus())
    expect(st).toMatchObject({ status: 'PENDING_APPROVAL', kyb: 'PENDING' })
    expect(st.timeline.map((t) => t.done)).toEqual([true, true, false])

    const id = st.id
    const approved = must(await api.admin.approve(id))
    expect(approved.status).toBe('APPROVED')
    const after = must(await api.getPartnerStatus())
    expect(after).toMatchObject({ status: 'APPROVED', kyb: 'APPROVED', kycLevel: type === 'ENTERPRISE' ? 3 : 2 })
    expect(after.products.length).toBeGreaterThan(2)
    expect(after.timeline.map((t) => t.done)).toEqual([true, true, true])
    expect(after.notifications.map((n) => n.kind)).toEqual(['SUBMITTED', 'APPROVED'])
    expect(after.liveKeys).toHaveLength(1)
    if (type === 'ENTERPRISE') {
      expect(after.liveKeys[0].status).toBe('INACTIVE')
      expect(after.goLiveBlocked).toBe(true)
      expect(after.limits).toMatchObject({ monthly: null })
    } else {
      expect(after.liveKeys[0].status).toBe('ACTIVE')
      expect(after.goLiveBlocked).toBe(false)
      expect(after.limits?.monthly).toBeGreaterThan(0)
    }
  })
})

describe('product access by type', () => {
  it('follows the Products column cumulatively', async () => {
    const products: Record<string, string[]> = {}
    for (const t of TYPES) {
      await api.dev.reset()
      await api.logout()
      await signup(t)
      const st = must(await api.getPartnerStatus())
      must(await api.admin.approve(st.id))
      products[t] = must(await api.getPartnerStatus()).products
    }
    expect(products.AUTO_ENTREPRENEUR).toEqual(['PAYMENT_LINKS', 'INVOICES', 'QR'])
    expect(products.INDIVIDUAL_TRADER).toEqual(expect.arrayContaining(['WEBSITE_CHECKOUT', 'POS']))
    expect(products.INDIVIDUAL_TRADER).not.toContain('API')
    expect(products.COMPANY).toEqual(expect.arrayContaining(['API', 'TEAM_USERS', 'REFUNDS']))
    expect(products.COMPANY).not.toContain('SUB_MERCHANTS')
    expect(products.ENTERPRISE).toEqual(expect.arrayContaining(['CUSTOM_PRICING', 'SUB_MERCHANTS', 'DEDICATED_SUPPORT']))
  })
})

describe.each(TYPES)('signup → reject → fix and resubmit – %s', (type) => {
  it('shows reason + flags, resubmits only flagged items, keeps everything else', async () => {
    const d = await signup(type)
    const id = must(await api.getPartnerStatus()).id

    const bad = await api.admin.reject(id, { code: 'DOCUMENT_UNREADABLE', text: '   ' })
    expect(bad).toMatchObject({ ok: false, error: 'VALIDATION', fieldErrors: { text: 'required' } })
    const bogus = await api.admin.reject(id, { code: 'OTHER', text: 'x', flaggedFields: ['account.doesNotExist'] })
    expect(bogus).toMatchObject({ ok: false, fieldErrors: { flaggedFields: 'invalidOption' } })

    must(await api.admin.reject(id, { code: 'DOCUMENT_UNREADABLE', text: 'Selfie is cropped.', flaggedFields: ['account.selfie'] }))
    const st = must(await api.getPartnerStatus())
    expect(st).toMatchObject({ status: 'REJECTED', kyb: 'REJECTED' })
    expect(st.rejection).toEqual({ code: 'DOCUMENT_UNREADABLE', text: 'Selfie is cropped.', flaggedFields: ['account.selfie'] })
    expect(st.timeline.at(-1)?.state).toBe('REJECTED')
    expect(st.notifications.map((n) => n.kind)).toContain('REJECTED')

    // Changing an item that was not flagged is refused.
    const blocked = await api.resubmit({ changes: { account: { fullName: 'Other Name' } } })
    expect(blocked).toMatchObject({ ok: false, error: 'NOT_FLAGGED', fieldErrors: { 'account.fullName': 'notFlagged' } })
    expect(must(await api.getPartnerStatus()).status).toBe('REJECTED')

    // Fixing only the flagged item works, everything else is kept.
    const r = must(await api.resubmit({ changes: { account: { selfie: doc('selfie-new.jpg') } } }))
    expect(r.status).toBe('PENDING_APPROVAL')
    const after = must(await api.getPartnerStatus())
    expect(after).toMatchObject({ status: 'PENDING_APPROVAL', kyb: 'PENDING', rejection: null })
    const { draft } = must(await api.getDraft())
    expect(draft.steps.account.selfie).toMatchObject({ name: 'selfie-new.jpg' })
    expect(draft.steps.account.nin).toBe(d.steps.account.nin)
    expect(draft.steps.business).toEqual(d.steps.business)

    // and the admin can approve the resubmission
    expect(must(await api.admin.approve(id)).status).toBe('APPROVED')
  })
})

describe('server-side rules on submit and transitions', () => {
  it('refuses submit with incomplete data and returns qualified field errors', async () => {
    const d = validDraft('COMPANY')
    await verifyContacts(d.steps.account)
    must(await api.createAccount({ partnerType: 'COMPANY', data: d.steps.account }))
    const r = await api.submit()
    expect(r).toMatchObject({ ok: false, error: 'VALIDATION' })
    if (!r.ok) {
      expect(r.fieldErrors?.['business.companyName']).toBe('required')
      expect(r.fieldErrors?.['settlement.volumeBand']).toBe('required')
      expect(r.fieldErrors?.['review.acceptDeclarations']).toBe('mustAccept')
    }
  })

  it('cannot submit twice, approve twice, or approve a draft', async () => {
    await signup('AUTO_ENTREPRENEUR')
    expect(await api.submit()).toMatchObject({ ok: false, error: 'INVALID_STATE' })
    const id = must(await api.getPartnerStatus()).id
    must(await api.admin.approve(id))
    expect(await api.admin.approve(id)).toMatchObject({ ok: false, error: 'INVALID_STATE' })
    expect(await api.admin.reject(id, { code: 'OTHER', text: 'late' })).toMatchObject({ ok: false, error: 'INVALID_STATE' })
    const d = validDraft('COMPANY')
    d.steps.account.email = 'second@partner.dz'
    d.steps.account.phone = '550999999'
    d.steps.account.nin = '109876543210999999'
    await verifyContacts(d.steps.account)
    const s = must(await api.createAccount({ partnerType: 'COMPANY', data: d.steps.account }))
    expect(await api.admin.approve(s.id)).toMatchObject({ ok: false, error: 'INVALID_STATE' })
  })

  it('cannot resubmit unless rejected', async () => {
    await signup('INDIVIDUAL_TRADER')
    expect(await api.resubmit({ changes: {} })).toMatchObject({ ok: false, error: 'INVALID_STATE' })
  })

  it('blocks edits once submitted', async () => {
    const d = await signup('INDIVIDUAL_TRADER')
    const r = await api.saveStep({ stepId: 'business', data: d.steps.business, complete: true })
    expect(r).toMatchObject({ ok: false, error: 'INVALID_STATE' })
  })
})

describe('enterprise', () => {
  it('routes a Company above the volume threshold to Enterprise (KYC 3, enterprise step required)', async () => {
    const d = validDraft('COMPANY')
    d.steps.settlement.volumeBand = 'B4'
    await verifyContacts(d.steps.account)
    must(await api.createAccount({ partnerType: 'COMPANY', data: d.steps.account }))
    must(await api.saveStep({ stepId: 'business', data: d.steps.business, complete: true }))
    const s = must(await api.saveStep({ stepId: 'settlement', data: d.steps.settlement, complete: true }))
    expect(s.summary).toMatchObject({ partnerType: 'COMPANY', effectiveType: 'ENTERPRISE', routedToEnterprise: true })
    must(await api.saveStep({ stepId: 'review', data: { acceptDeclarations: true }, complete: true }))
    expect(await api.submit()).toMatchObject({ ok: false, error: 'VALIDATION' }) // enterprise docs missing
    must(await api.saveStep({ stepId: 'enterpriseDocs', data: validDraft('ENTERPRISE').steps.enterpriseDocs, complete: true }))
    must(await api.submit())
    const id = must(await api.getPartnerStatus()).id
    expect(must(await api.admin.getSubmission(id))).toMatchObject({ kycLevel: 3, partnerType: 'ENTERPRISE', routedToEnterprise: true })
  })

  it('go-live stays blocked until an admin marks the contract signed', async () => {
    await signup('ENTERPRISE')
    const id = must(await api.getPartnerStatus()).id
    expect(await api.admin.markContractSigned(id)).toMatchObject({ ok: false, error: 'INVALID_STATE' }) // not approved yet
    must(await api.admin.approve(id))
    let st = must(await api.getPartnerStatus())
    expect(st.goLiveBlocked).toBe(true)
    expect(st.contract).toMatchObject({ required: true, signedAt: null })
    must(await api.admin.markContractSigned(id))
    st = must(await api.getPartnerStatus())
    expect(st.goLiveBlocked).toBe(false)
    expect(st.contract.signedAt).not.toBeNull()
    expect(st.liveKeys[0].status).toBe('ACTIVE')
    expect(await api.admin.markContractSigned(id)).toMatchObject({ ok: false, error: 'INVALID_STATE' })
  })

  it('contract signing does not apply to non-enterprise types', async () => {
    await signup('COMPANY')
    const id = must(await api.getPartnerStatus()).id
    must(await api.admin.approve(id))
    expect(await api.admin.markContractSigned(id)).toMatchObject({ ok: false, error: 'INVALID_STATE' })
  })
})

describe('admin list and detail', () => {
  it('lists submissions by KYC level and partner type, and drafts with their last completed step', async () => {
    const l2 = must(await api.admin.listSubmissions({ view: 'submissions', level: 2 }))
    const l3 = must(await api.admin.listSubmissions({ view: 'submissions', level: 3 }))
    expect(l2.every((r) => r.kycLevel === 2)).toBe(true)
    expect(l3.every((r) => r.kycLevel === 3 && r.partnerType === 'ENTERPRISE')).toBe(true)
    expect(l3.length).toBeGreaterThan(0)
    const ae = must(await api.admin.listSubmissions({ view: 'submissions', partnerType: 'AUTO_ENTREPRENEUR' }))
    expect(ae.map((r) => r.partnerType)).toEqual(['AUTO_ENTREPRENEUR'])
    const drafts = must(await api.admin.listSubmissions({ view: 'drafts' }))
    expect(drafts.length).toBeGreaterThanOrEqual(2)
    expect(drafts.every((r) => r.status === 'DRAFT' && r.lastCompletedStep)).toBe(true)
    expect(must(await api.admin.listSubmissions({ view: 'submissions' })).some((r) => r.status === 'DRAFT')).toBe(false)
  })

  it('detail has a type-specific checklist, documents, the band and the ANAE code', async () => {
    const subs = must(await api.admin.listSubmissions({ view: 'submissions' }))
    const ae = must(await api.admin.getSubmission(subs.find((r) => r.partnerType === 'AUTO_ENTREPRENEUR')!.id))
    expect(ae.checklistKeys).toContain('aeCardVerified')
    expect(ae.anaeActivityCode).toBe('PLACEHOLDER-001')
    expect(ae.volumeBand).toBe('B1')
    expect(ae.documents.map((x) => x.docType)).toContain('anaeCardPhoto')
    const ent = must(await api.admin.getSubmission(subs.find((r) => r.partnerType === 'ENTERPRISE')!.id))
    expect(ent.checklistKeys).toContain('amlQuestionnaireReviewed')
    expect(ent.checklistKeys).not.toContain('aeCardVerified')
    expect(ent.documents.map((x) => x.key)).toContain('enterpriseDocs.financialStatements')
    expect(requiredDocuments(ent.draft)).toHaveLength(ent.documents.length)
  })

  it('checklist ticks are stored and audited; every admin action is in the audit log', async () => {
    await signup('INDIVIDUAL_TRADER')
    const id = must(await api.getPartnerStatus()).id
    must(await api.admin.setChecklistItem(id, 'registrationValid', true))
    must(await api.admin.reject(id, { code: 'OTHER', text: 'Needs more info' }))
    const detail = must(await api.admin.getSubmission(id))
    expect(detail.checklist.registrationValid).toBe(true)
    const log = must(await api.admin.listAudit(id))
    expect(log.map((e) => e.action)).toEqual(expect.arrayContaining(['ACCOUNT_CREATED', 'SUBMITTED', 'CHECKLIST_ITEM', 'REJECTED']))
    expect(log.find((e) => e.action === 'REJECTED')).toMatchObject({ actor: 'admin@mizaniyapay.dz', details: { code: 'OTHER' } })
  })

  it('returns NOT_FOUND for unknown ids', async () => {
    expect(await api.admin.getSubmission('nope')).toMatchObject({ ok: false, error: 'NOT_FOUND' })
  })
})

describe('login', () => {
  it('rejects bad credentials with a form-level error code', async () => {
    expect(await api.login({ email: 'ae.demo@mizaniya.dz', password: 'wrong' })).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' })
  })
  it('resumes a seeded draft at its last step', async () => {
    const s = must(await api.login({ email: 'ae.draft@mizaniya.dz', password: DEMO_PASSWORD }))
    expect(s).toMatchObject({ status: 'DRAFT', lastCompletedStep: 'account', partnerType: 'AUTO_ENTREPRENEUR' })
  })
})

describe('persistence', () => {
  it('survives a reload (state is kept in localStorage)', async () => {
    await signup('AUTO_ENTREPRENEUR')
    const raw = localStorage.getItem('mizaniya.mock.db.v1')
    expect(raw).toContain('new@partner.dz')
    resetDb()
    expect(localStorage.getItem('mizaniya.mock.db.v1')).not.toContain('new@partner.dz')
  })
})
