import { describe, expect, it } from 'vitest'
import { listPartnerTypes } from '@/shared/config/partnerTypes'
import { makeContext } from '@/shared/flow'
import { requiredDocuments, settlementHolderCheck, validateStepInContext, validateSubmission } from '@/shared/schema'
import { validDraft } from './helpers'

const TYPES = ['AUTO_ENTREPRENEUR', 'INDIVIDUAL_TRADER', 'COMPANY', 'ENTERPRISE']

describe.each(TYPES)('schema – %s', (type) => {
  it('accepts a complete valid draft', () => {
    expect(validateSubmission(validDraft(type))).toEqual({})
  })

  it('reports required fields with step-qualified keys', () => {
    const d = validDraft(type)
    d.steps.account = {}
    const errs = validateSubmission(d)
    expect(errs['account.email']).toBe('required')
    expect(errs['account.nin']).toBe('required')
    expect(errs['account.selfie']).toBe('required')
  })

  it('requires OTP verification of email and phone', () => {
    const d = validDraft(type)
    d.steps.account.emailVerified = false
    expect(validateSubmission(d)['account.email']).toBe('notVerified')
  })

  it('role field only applies to company types', () => {
    const d = validDraft(type)
    delete d.steps.account.legalRole
    const hasRole = !!makeContext(type, d.steps).showLegalRole
    expect(validateSubmission(d)['account.legalRole']).toBe(hasRole ? 'required' : undefined)
  })

  it('passport hides the back of the ID', () => {
    const d = validDraft(type)
    d.steps.account.idType = 'PASSPORT'
    delete d.steps.account.idBack
    expect(validateSubmission(d)['account.idBack']).toBeUndefined()
  })

  it('.com.dz website is required and checked when selling online', () => {
    const d = validDraft(type)
    d.steps.business.salesChannel = 'ONLINE'
    expect(validateSubmission(d)['business.website']).toBe('required')
    d.steps.business.website = 'https://shop.example.com'
    expect(validateSubmission(d)['business.website']).toBe('websiteComDz')
    d.steps.business.website = 'https://shop.example.com.dz'
    expect(validateSubmission(d)['business.website']).toBeUndefined()
  })

  it('does not require a website for in-person sales', () => {
    const d = validDraft(type)
    d.steps.business.salesChannel = 'IN_PERSON'
    expect(validateSubmission(d)['business.website']).toBeUndefined()
  })

  it('requires the declarations checkbox', () => {
    const d = validDraft(type)
    d.steps.review = { acceptDeclarations: false }
    expect(validateSubmission(d)['review.acceptDeclarations']).toBe('mustAccept')
  })

  it('uses the CCP format when the settlement type is CCP', () => {
    const d = validDraft(type)
    d.steps.settlement.settlementType = 'CCP'
    d.steps.settlement.accountNumber = 'abc'
    expect(validateSubmission(d)['settlement.accountNumber']).toBe('invalidCcp')
  })
})

describe('type-specific rules', () => {
  it('AE needs the ANAE card number and photo', () => {
    const d = validDraft('AUTO_ENTREPRENEUR')
    d.steps.business = { ...d.steps.business, anaeCardNumber: '', anaeCardPhoto: null }
    const e = validateSubmission(d)
    expect(e['business.anaeCardNumber']).toBe('required')
    expect(e['business.anaeCardPhoto']).toBe('required')
  })

  it('trader: RAM uses the RAM validator', () => {
    const d = validDraft('INDIVIDUAL_TRADER')
    d.steps.business.registrationType = 'RAM'
    d.steps.business.registrationNumber = '!'
    expect(validateSubmission(d)['business.registrationNumber']).toBe('invalidRam')
  })

  it('company: delegation + manager ID required only when the representative is not the manager', () => {
    const d = validDraft('COMPANY')
    expect(validateSubmission(d)['business.delegation']).toBeUndefined()
    d.steps.business.repIsManager = 'NO'
    const e = validateSubmission(d)
    expect(e['business.delegation']).toBe('required')
    expect(e['business.managerId']).toBe('required')
  })

  it('company: statuts must be provided, beneficial owners must be valid', () => {
    const d = validDraft('COMPANY')
    d.steps.business.statuts = null
    d.steps.business.beneficialOwners = []
    let e = validateSubmission(d)
    expect(e['business.statuts']).toBe('required')
    expect(e['business.beneficialOwners']).toBe('ownersRequired')
    d.steps.business.beneficialOwners = [{ id: 'x', fullName: 'A', nin: '1', ownershipPct: 30 }]
    e = validateSubmission(d)
    expect(e['business.beneficialOwners']).toBe('ownersInvalid')
  })

  it('company: ownership above 100% is rejected', () => {
    const d = validDraft('COMPANY')
    const o = { id: 'o', fullName: 'Aa Bb', nin: '109876543210123456', ownershipPct: 70, idDocument: null }
    ;(d.steps.business.beneficialOwners as unknown[]).push({ ...o, idDocument: d.steps.account.idFront })
    expect(validateSubmission(d)['business.beneficialOwners']).toBe('ownershipOver100')
  })

  it('enterprise: AML questionnaire must be Done, docs and technical contact required', () => {
    const d = validDraft('ENTERPRISE')
    d.steps.enterpriseDocs = { amlQuestionnaire: { status: 'IN_PROGRESS' } }
    const e = validateSubmission(d)
    expect(e['enterpriseDocs.amlQuestionnaire']).toBe('amlIncomplete')
    expect(e['enterpriseDocs.delegationOfAuthority']).toBe('required')
    expect(e['enterpriseDocs.financialStatements']).toBe('required')
    expect(e['enterpriseDocs.techContactName']).toBe('required')
    expect(e['enterpriseDocs.collectsForSubMerchants']).toBe('required')
  })

  it('company routed to Enterprise (volume above threshold) must complete the enterprise step', () => {
    const d = validDraft('COMPANY')
    d.steps.settlement.volumeBand = 'B4'
    const e = validateSubmission(d)
    expect(e['enterpriseDocs.financialStatements']).toBe('required')
  })
})

describe('settlement holder', () => {
  it('AE: mismatch is a warning, not an error', () => {
    const d = validDraft('AUTO_ENTREPRENEUR')
    d.steps.settlement.holderName = 'Somebody Else'
    const ctx = makeContext('AUTO_ENTREPRENEUR', d.steps)
    expect(settlementHolderCheck(ctx)).toEqual({ mismatch: true, blocking: false })
    expect(validateSubmission(d)['settlement.holderName']).toBeUndefined()
  })
  it('company types: mismatch blocks', () => {
    for (const t of ['COMPANY', 'ENTERPRISE']) {
      const d = validDraft(t)
      d.steps.settlement.holderName = 'Karim Benali'
      expect(validateStepInContext('settlement', makeContext(t, d.steps)).holderName).toBe('holderMustMatchCompany')
    }
  })
  it('no mismatch for name in different order', () => {
    const d = validDraft('AUTO_ENTREPRENEUR')
    d.steps.settlement.holderName = 'BENALI karim'
    expect(settlementHolderCheck(makeContext('AUTO_ENTREPRENEUR', d.steps)).mismatch).toBe(false)
  })
})

describe('documents', () => {
  it('lists the visible file fields per type', () => {
    const keys = (t: string) => requiredDocuments(validDraft(t)).map((d) => d.key)
    expect(keys('AUTO_ENTREPRENEUR')).toContain('business.anaeCardPhoto')
    expect(keys('AUTO_ENTREPRENEUR')).not.toContain('business.statuts')
    expect(keys('COMPANY')).toContain('business.statuts')
    expect(keys('ENTERPRISE')).toContain('enterpriseDocs.financialStatements')
    expect(keys('COMPANY')).not.toContain('enterpriseDocs.financialStatements')
  })
  it('all types are covered by this test file', () => {
    expect(listPartnerTypes().map((t) => t.id).sort()).toEqual([...TYPES].sort())
  })
})
