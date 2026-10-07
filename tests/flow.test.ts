import { afterEach, describe, expect, it } from 'vitest'
import { getPartnerType, listPartnerTypes, registerPartnerType, unregisterPartnerType } from '@/shared/config/partnerTypes'
import type { PartnerTypeConfig } from '@/shared/config/schemaTypes'
import { ACCOUNT_STEP, SETTLEMENT_STEP } from '@/shared/config/steps'
import {
  canTransition,
  changePartnerType,
  effectiveType,
  emptyDraft,
  fieldsLostOnTypeChange,
  helperResult,
  kybFor,
  nextStep,
  prevStep,
  resolveSteps,
  resumeStep,
  stepPosition,
} from '@/shared/flow'
import { validateSubmission } from '@/shared/schema'
import { validDraft } from './helpers'

describe('step resolution', () => {
  it('has 5 steps for AE / trader / company and 6 for enterprise', () => {
    expect(resolveSteps('AUTO_ENTREPRENEUR', {})).toEqual(['type', 'account', 'business', 'settlement', 'review'])
    expect(resolveSteps('INDIVIDUAL_TRADER', {})).toHaveLength(5)
    expect(resolveSteps('COMPANY', {})).toHaveLength(5)
    expect(resolveSteps('ENTERPRISE', {})).toEqual(['type', 'account', 'business', 'settlement', 'enterpriseDocs', 'review'])
  })

  it('"Step N of M" depends on the type', () => {
    expect(stepPosition('AUTO_ENTREPRENEUR', {}, 'settlement')).toEqual({ index: 4, total: 5 })
    expect(stepPosition('ENTERPRISE', {}, 'review')).toEqual({ index: 6, total: 6 })
  })

  it('next / prev', () => {
    expect(nextStep('COMPANY', {}, 'account')).toBe('business')
    expect(prevStep('COMPANY', {}, 'type')).toBeNull()
    expect(nextStep('COMPANY', {}, 'review')).toBeNull()
  })
})

describe('enterprise routing', () => {
  it('routes a Company to Enterprise above the volume threshold and adds the enterprise step before review', () => {
    const below = { settlement: { volumeBand: 'B2' } }
    const above = { settlement: { volumeBand: 'B4' } }
    expect(effectiveType('COMPANY', below)).toBe('COMPANY')
    expect(effectiveType('COMPANY', above)).toBe('ENTERPRISE')
    const ids = resolveSteps('COMPANY', above)
    expect(ids.indexOf('enterpriseDocs')).toBe(ids.indexOf('review') - 1)
  })
  it('never routes non-company types', () => {
    expect(effectiveType('AUTO_ENTREPRENEUR', { settlement: { volumeBand: 'B4' } })).toBe('AUTO_ENTREPRENEUR')
    expect(effectiveType('INDIVIDUAL_TRADER', { settlement: { volumeBand: 'B4' } })).toBe('INDIVIDUAL_TRADER')
  })
})

describe('changing type mid-signup', () => {
  it('keeps shared steps and resets type-specific fields', () => {
    const d = validDraft('AUTO_ENTREPRENEUR')
    const out = changePartnerType(d, 'COMPANY')
    expect(out.partnerType).toBe('COMPANY')
    expect(out.steps.account).toEqual(d.steps.account)
    expect(out.steps.settlement).toEqual(d.steps.settlement)
    expect(out.steps.business.anaeCardNumber).toBeUndefined()
    expect(out.steps.business.anaeCardPhoto).toBeUndefined()
  })

  it('keeps same-named fields (address, activity) and rolls completion back to the last shared step', () => {
    const d = { ...validDraft('AUTO_ENTREPRENEUR'), lastCompletedStep: 'review' }
    const out = changePartnerType(d, 'INDIVIDUAL_TRADER')
    expect(out.steps.business.tradeName).toBe('Chez Karim')
    expect(out.lastCompletedStep).toBe('account')
  })

  it('drops the enterprise step when leaving Enterprise', () => {
    const out = changePartnerType(validDraft('ENTERPRISE'), 'COMPANY')
    expect(out.steps.enterpriseDocs).toBeUndefined()
  })

  it('does not roll back when the partner had not got past the shared steps', () => {
    const d = { ...emptyDraft(), partnerType: 'COMPANY', lastCompletedStep: 'type', steps: {} }
    expect(changePartnerType(d, 'ENTERPRISE').lastCompletedStep).toBe('type')
  })

  it('reports how many values would be lost (for the confirmation popup)', () => {
    expect(fieldsLostOnTypeChange(validDraft('AUTO_ENTREPRENEUR'), 'COMPANY')).toBeGreaterThan(0)
    expect(fieldsLostOnTypeChange(validDraft('COMPANY'), 'ENTERPRISE')).toBe(0)
  })
})

describe('draft & resume', () => {
  it('resumes after the last completed step', () => {
    const d = { ...emptyDraft(), partnerType: 'COMPANY', lastCompletedStep: 'account' }
    expect(resumeStep(d)).toBe('business')
  })
  it('starts at type when nothing is done', () => {
    expect(resumeStep(emptyDraft())).toBe('type')
  })
})

describe('helper "Help me choose"', () => {
  it('preselects by answer', () => {
    expect(helperResult({ rc: true })).toBe('INDIVIDUAL_TRADER')
    expect(helperResult({ rc: false, ram: true })).toBe('INDIVIDUAL_TRADER')
    expect(helperResult({ rc: false, ram: false, anae: true })).toBe('AUTO_ENTREPRENEUR')
  })
  it('no to all three means no legal status', () => {
    expect(helperResult({ rc: false, ram: false, anae: false })).toBe('NONE')
  })
  it('is undecided while unanswered', () => {
    expect(helperResult({ rc: false })).toBeNull()
  })
})

describe('status transitions', () => {
  it('allows only the documented moves', () => {
    expect(canTransition('DRAFT', 'PENDING_APPROVAL')).toBe(true)
    expect(canTransition('PENDING_APPROVAL', 'APPROVED')).toBe(true)
    expect(canTransition('PENDING_APPROVAL', 'REJECTED')).toBe(true)
    expect(canTransition('REJECTED', 'PENDING_APPROVAL')).toBe(true) // resubmit
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false)
    expect(canTransition('APPROVED', 'REJECTED')).toBe(false)
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false)
  })
  it('pairs merchant and KYB statuses', () => {
    expect(kybFor('DRAFT')).toBeNull()
    expect(kybFor('PENDING_APPROVAL')).toBe('PENDING')
    expect(kybFor('APPROVED')).toBe('APPROVED')
    expect(kybFor('REJECTED')).toBe('REJECTED')
  })
})

describe('config-driven: a new partner type needs only a config entry', () => {
  const NEW_ID = 'ASSOCIATION_TEST'
  afterEach(() => unregisterPartnerType(NEW_ID))

  it('flows through step resolution, validation and type change without touching flow code', () => {
    const cfg: PartnerTypeConfig = {
      id: NEW_ID,
      order: 99,
      kycLevel: 2,
      showLegalRole: true,
      holderMatch: 'person',
      holderMismatch: 'warn',
      products: ['PAYMENT_LINKS'],
      limitKeys: ['monthly'],
      stepIds: ['type', 'account', 'business', 'settlement', 'review'],
      stepDefs: {
        business: {
          id: 'business',
          typeSpecific: true,
          sections: [{ id: 'registration', fields: [{ name: 'agreementNumber', kind: 'mono', validator: 'rc' }] }],
        },
      },
      reviewChecklist: [],
      upgradeTargets: [],
    }
    registerPartnerType(cfg)
    expect(listPartnerTypes().map((t) => t.id)).toContain(NEW_ID)
    expect(getPartnerType(NEW_ID)).toBe(cfg)
    expect(resolveSteps(NEW_ID, {})).toHaveLength(5)

    const base = validDraft('AUTO_ENTREPRENEUR')
    const draft = {
      partnerType: NEW_ID,
      lastCompletedStep: 'settlement',
      steps: { ...base.steps, account: { ...base.steps.account, legalRole: 'OWNER' }, business: { agreementNumber: 'AGR-12345' } },
    }
    expect(validateSubmission(draft)).toEqual({})
    draft.steps.business.agreementNumber = '!'
    expect(validateSubmission(draft)['business.agreementNumber']).toBe('invalidRc')

    const moved = changePartnerType(draft, 'COMPANY')
    expect(moved.steps.account).toEqual(draft.steps.account)
    expect(moved.steps.business).toBeUndefined()
    void ACCOUNT_STEP
    void SETTLEMENT_STEP
  })
})
