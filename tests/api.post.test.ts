import { beforeEach, describe, expect, it } from 'vitest'
import { api, DEMO_PASSWORD, MOCK_OTP } from '@/api'
import type { ApiResult } from '@/api/types'
import { LIMITS } from '@/shared/config/tbd'
import { validDraft } from './helpers'

function must<T>(r: ApiResult<T>): T {
  if (!r.ok) throw new Error(`API error ${r.error} ${JSON.stringify(r.fieldErrors ?? {})}`)
  return r.data
}
const login = async (email: string) => must(await api.login({ email, password: DEMO_PASSWORD }))

beforeEach(async () => {
  await api.dev.reset()
  await api.logout()
})

describe('limits applied on approval', () => {
  it('uses the limits of the type and the declared band', async () => {
    const id = (await login('company.approved@mizaniya.dz')).id
    const st = must(await api.getPartnerStatus())
    expect(st.id).toBe(id)
    expect(st.limits).toEqual(LIMITS.COMPANY.B2)
  })
  it('AE gets the legal annual cap in its limits', async () => {
    await login('ae.demo@mizaniya.dz')
    expect(must(await api.getPartnerStatus()).limits?.annual).toBe(5_000_000)
  })
})

describe('AE cap tracking', () => {
  it('80%: flag + one email/portal notification (not repeated); 100%: flagged for admin review', async () => {
    await login('ae.demo@mizaniya.dz')
    let st = must(await api.dev.setVolumes({ annualDzd: 3_900_000 }))
    expect(st.flags).toEqual([])
    st = must(await api.dev.setVolumes({ annualDzd: 4_000_000 }))
    expect(st.flags).toEqual(['AE_CAP_80'])
    must(await api.dev.setVolumes({ annualDzd: 4_100_000 }))
    st = must(await api.getPartnerStatus())
    expect(st.notifications.filter((n) => n.kind === 'AE_CAP_80')).toHaveLength(1)

    st = must(await api.dev.setVolumes({ annualDzd: 5_000_000 }))
    expect(st.flags).toEqual(['AE_CAP_100'])
    expect(st.transactionsBlocked).toBe(false) // AE_CAP_BEHAVIOUR default FLAG
    expect(st.notifications.map((n) => n.kind)).toEqual(expect.arrayContaining(['AE_CAP_80', 'AE_CAP_100']))
    expect(st.aeUsage?.ratio).toBe(1)

    // the admin sees the flag in the list and on the record
    const rows = must(await api.admin.listSubmissions({ view: 'submissions', partnerType: 'AUTO_ENTREPRENEUR' }))
    expect(rows[0].flags).toEqual(['AE_CAP_100'])
    expect(must(await api.admin.getSubmission(rows[0].id)).aeUsage?.ratio).toBe(1)
    expect(must(await api.admin.getSubmission(rows[0].id)).anaeActivityCode).toBe('PLACEHOLDER-001')
  })

  it('does not apply to a company', async () => {
    await login('company.approved@mizaniya.dz')
    const st = must(await api.dev.setVolumes({ annualDzd: 9_000_000 }))
    expect(st.flags).toEqual([])
    expect(st.aeUsage).toBeNull()
  })
})

describe('volume above declared band', () => {
  it('flags the account, notifies the partner, and clears after the declared volume is updated (limits unchanged)', async () => {
    await login('company.approved@mizaniya.dz') // declared B2: 500k - 2M
    let st = must(await api.dev.setVolumes({ monthlyDzd: 2_000_001 }))
    expect(st.flags).toEqual(['VOLUME_ABOVE_BAND'])
    expect(st.notifications.map((n) => n.kind)).toContain('VOLUME_ABOVE_BAND')
    const before = st.limits

    st = must(await api.updateDeclaredVolume({ volumeBand: 'B3' }))
    expect(st.flags).toEqual([])
    expect(st.limits).toEqual(before) // limits only change after an admin review
    expect(must(await api.getDraft()).draft.steps.settlement.volumeBand).toBe('B3')
  })

  it('a Company cannot declare an Enterprise-level band: that is an upgrade', async () => {
    await login('company.approved@mizaniya.dz')
    const r = await api.updateDeclaredVolume({ volumeBand: 'B4' })
    expect(r).toMatchObject({ ok: false, error: 'VALIDATION', fieldErrors: { volumeBand: 'requiresUpgrade' } })
    expect(await api.updateDeclaredVolume({ volumeBand: 'nope' })).toMatchObject({ ok: false, fieldErrors: { volumeBand: 'invalidOption' } })
  })

  it('only approved partners can update', async () => {
    await login('trader.pending@mizaniya.dz')
    expect(await api.updateDeclaredVolume({ volumeBand: 'B2' })).toMatchObject({ ok: false, error: 'INVALID_STATE' })
  })
})

describe('AE activity restriction', () => {
  it('only the categories mapped to the ANAE code are allowed', async () => {
    await login('ae.demo@mizaniya.dz') // PLACEHOLDER-001: digital + professional services
    expect(must(await api.checkPaymentCategory('SERVICES_DIGITAL'))).toMatchObject({ allowed: true })
    expect(must(await api.checkPaymentCategory('FOOD'))).toEqual({ allowed: false, allowedCategories: ['SERVICES_DIGITAL', 'SERVICES_PROFESSIONAL'] })
  })
  it('is not applied to other types', async () => {
    await login('company.approved@mizaniya.dz')
    expect(must(await api.checkPaymentCategory('FOOD')).allowed).toBe(true)
  })
})

describe('upgrade path', () => {
  it('pre-fills shared data, keeps the current account at its limits, and needs only the new step', async () => {
    await login('ae.demo@mizaniya.dz')
    const before = must(await api.getPartnerStatus())
    const { draft, summary } = must(await api.startUpgrade('COMPANY'))
    expect(summary).toMatchObject({ isUpgrade: true, partnerType: 'COMPANY', status: 'DRAFT' })
    expect(draft.steps.account.nin).toBeDefined()
    expect(draft.steps.settlement.accountNumber).toBeDefined()
    expect(draft.steps.business.anaeCardNumber).toBeUndefined()
    expect(draft.steps.review).toBeUndefined()
    expect(draft.steps.business.tradeName).toBeDefined() // same-named fields are kept

    const st = must(await api.getPartnerStatus())
    expect(st).toMatchObject({ status: 'APPROVED', partnerType: 'AUTO_ENTREPRENEUR', upgrade: { toType: 'COMPANY', status: 'DRAFT' } })
    expect(st.limits).toEqual(before.limits)
    expect(st.products).toEqual(before.products)
  })

  it('rejects targets the current type cannot upgrade to, and unapproved partners', async () => {
    await login('ae.demo@mizaniya.dz')
    expect(await api.startUpgrade('ENTERPRISE')).toMatchObject({ ok: false, error: 'VALIDATION' })
    await api.logout()
    await login('trader.pending@mizaniya.dz')
    expect(await api.startUpgrade('COMPANY')).toMatchObject({ ok: false, error: 'INVALID_STATE' })
  })

  it('AE -> Company: submit, admin approves, limits/products/KYC change, cap tracking stops', async () => {
    await login('ae.demo@mizaniya.dz')
    must(await api.startUpgrade('COMPANY'))

    // only the missing items are asked: company data, role (new for companies) and the holder in the company name
    const early = await api.submit()
    expect(early).toMatchObject({ ok: false, error: 'VALIDATION' })
    if (!early.ok) {
      expect(early.fieldErrors?.['account.legalRole']).toBe('required')
      expect(early.fieldErrors?.['business.companyName']).toBe('required')
      expect(early.fieldErrors?.['account.email']).toBeUndefined()
      expect(early.fieldErrors?.['account.nin']).toBeUndefined()
    }

    const c = validDraft('COMPANY')
    const acct = must(await api.getDraft()).draft.steps.account
    must(await api.saveStep({ stepId: 'account', data: { ...acct, legalRole: 'MANAGER' }, complete: true }))
    must(await api.saveStep({ stepId: 'business', data: { ...c.steps.business, rc: 'RC-UP-0001', nif: 'NIF-UP-0001', nis: 'NIS-UP-0001' }, complete: true }))
    const settle = must(await api.getDraft()).draft.steps.settlement
    // the AE's settlement account is in the person's name: a Company needs it in the company's name
    expect(await api.saveStep({ stepId: 'settlement', data: settle, complete: true })).toMatchObject({ ok: false, fieldErrors: { holderName: 'holderMustMatchCompany' } })
    must(await api.saveStep({ stepId: 'settlement', data: { ...settle, holderName: String(c.steps.business.companyName) }, complete: true }))
    must(await api.saveStep({ stepId: 'review', data: { acceptDeclarations: true }, complete: true }))
    expect(must(await api.submit()).status).toBe('PENDING_APPROVAL')
    expect(must(await api.getPartnerStatus())).toMatchObject({ status: 'APPROVED', upgrade: { status: 'PENDING_APPROVAL' } })

    const rows = must(await api.admin.listSubmissions({ view: 'submissions', partnerType: 'COMPANY' }))
    const row = rows.find((r) => r.isUpgrade)!
    expect(row).toMatchObject({ status: 'PENDING_APPROVAL', partnerType: 'COMPANY' })
    expect(must(await api.admin.getSubmission(row.id))).toMatchObject({ upgradeFrom: 'AUTO_ENTREPRENEUR' })

    must(await api.admin.approve(row.id))
    const st = must(await api.getPartnerStatus())
    expect(st).toMatchObject({ partnerType: 'COMPANY', effectiveType: 'COMPANY', kycLevel: 2, upgrade: null })
    expect(st.products).toContain('API')
    expect(st.limits).toEqual(LIMITS.COMPANY.B1)
    expect(st.notifications.map((n) => n.kind)).toContain('UPGRADE_APPROVED')
    expect(must(await api.dev.setVolumes({ annualDzd: 9_000_000 })).flags).toEqual([])
  })

  it('a rejected upgrade can be fixed and resubmitted; the account keeps working meanwhile', async () => {
    await login('ae.demo@mizaniya.dz')
    must(await api.startUpgrade('INDIVIDUAL_TRADER'))
    const t = validDraft('INDIVIDUAL_TRADER')
    must(await api.saveStep({ stepId: 'business', data: { ...t.steps.business, registrationNumber: 'RC-UP-TRADER', nif: 'NIF-UP-TRADER' }, complete: true }))
    must(await api.saveStep({ stepId: 'review', data: { acceptDeclarations: true }, complete: true }))
    must(await api.submit())
    const id = must(await api.getPartnerStatus()).id

    must(await api.admin.reject(id, { code: 'DOCUMENT_UNREADABLE', text: 'RC photo is blurry', flaggedFields: ['business.registrationPhoto'] }))
    let st = must(await api.getPartnerStatus())
    expect(st).toMatchObject({ status: 'APPROVED', upgrade: { status: 'REJECTED', rejection: { code: 'DOCUMENT_UNREADABLE' } } })

    expect(await api.resubmit({ changes: { business: { nif: 'OTHER-NIF-1' } } })).toMatchObject({ ok: false, error: 'NOT_FLAGGED' })
    must(await api.resubmit({ changes: { business: { registrationPhoto: { id: 'd9', name: 'rc2.jpg', size: 10, mime: 'image/jpeg', status: 'uploaded' } } } }))
    st = must(await api.getPartnerStatus())
    expect(st.upgrade?.status).toBe('PENDING_APPROVAL')
    expect(st.status).toBe('APPROVED')
    must(await api.admin.approve(id))
    expect(must(await api.getPartnerStatus())).toMatchObject({ partnerType: 'INDIVIDUAL_TRADER', upgrade: null })
  })

  it('OTP flags survive: verified contacts stay verified through the upgrade', async () => {
    await login('ae.demo@mizaniya.dz')
    const { draft } = must(await api.startUpgrade('INDIVIDUAL_TRADER'))
    expect(draft.steps.account.emailVerified).toBe(true)
    void MOCK_OTP
  })
})
