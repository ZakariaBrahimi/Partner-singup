import { describe, expect, it } from 'vitest'
import { getPartnerType } from '@/shared/config/partnerTypes'
import { typeRequirements } from '@/shared/requirements'

const req = (t: string) => typeRequirements(getPartnerType(t))
const docs = (t: string) => req(t).documents.map((d) => d.field)

describe('typeRequirements (derived from the type config)', () => {
  it('AE: ANAE card photo, ID, selfie; ANAE number and NIN; no business registration docs', () => {
    expect(docs('AUTO_ENTREPRENEUR')).toEqual(expect.arrayContaining(['anaeCardPhoto', 'idFront', 'idBack', 'selfie']))
    expect(docs('AUTO_ENTREPRENEUR')).not.toContain('statuts')
    expect(req('AUTO_ENTREPRENEUR').identifiers).toEqual(expect.arrayContaining(['anaeCardNumber', 'nin', 'accountNumber']))
  })
  it('trader: RC/RAM photo and NIF certificate', () => {
    expect(docs('INDIVIDUAL_TRADER')).toEqual(expect.arrayContaining(['registrationPhoto', 'nifCertificate']))
    expect(req('INDIVIDUAL_TRADER').identifiers).toEqual(expect.arrayContaining(['registrationNumber', 'nif']))
  })
  it('company: RC photo, statuts, beneficial owners; manager ID and delegation are conditional', () => {
    expect(docs('COMPANY')).toEqual(expect.arrayContaining(['rcPhoto', 'statuts', 'managerId', 'delegation']))
    const cond = req('COMPANY').documents.filter((d) => d.conditional).map((d) => d.field)
    expect(cond).toEqual(expect.arrayContaining(['managerId', 'delegation', 'idBack']))
    expect(cond).not.toContain('statuts')
    expect(req('COMPANY').extras).toEqual(['beneficialOwners'])
    expect(req('COMPANY').identifiers).toEqual(expect.arrayContaining(['rc', 'nif', 'nis']))
  })
  it('enterprise: company docs + delegation, financial statements, AML questionnaire', () => {
    expect(docs('ENTERPRISE')).toEqual(expect.arrayContaining(['statuts', 'delegationOfAuthority', 'financialStatements']))
    expect(req('ENTERPRISE').extras).toEqual(expect.arrayContaining(['beneficialOwners', 'amlQuestionnaire']))
  })
  it('lists products included and not included, cumulatively', () => {
    expect(req('AUTO_ENTREPRENEUR').products).toEqual(['PAYMENT_LINKS', 'INVOICES', 'QR'])
    expect(req('AUTO_ENTREPRENEUR').notIncluded).toEqual(expect.arrayContaining(['API', 'POS', 'REFUNDS', 'SUB_MERCHANTS']))
    expect(req('ENTERPRISE').notIncluded).toEqual([])
    for (const t of ['AUTO_ENTREPRENEUR', 'INDIVIDUAL_TRADER', 'COMPANY', 'ENTERPRISE']) {
      const r = req(t)
      expect(r.products.length + r.notIncluded.length).toBe(11)
    }
  })
})
