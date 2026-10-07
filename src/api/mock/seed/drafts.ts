import type { PartnerDraft, StepData, UploadedDocument } from '@/shared/types'

export const sampleDoc = (name = 'document.pdf'): UploadedDocument => ({
  id: `doc_${name.replace(/\W+/g, '_')}`,
  name,
  size: 120_000,
  mime: name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
  status: 'uploaded',
})

/** Values already registered in the seed data: type one of them in the form to see the duplicate error. */
export const DEMO_DUPLICATES = {
  email: 'taken@mizaniya.dz',
  phone: '550000001',
  nin: '100000000000000001',
  rc: 'RC-DEMO-0001',
  nif: 'NIF-DEMO-0001',
  nis: 'NIS-DEMO-0001',
  anaeCardNumber: 'AE-DEMO-0001',
  rib: '00799999000000000001',
  ccp: '00000001',
} as const

export const DEMO_PASSWORD = 'Demo1234!'

export interface SeedOptions {
  n: number
  email: string
  phone: string
  fullName: string
  companyName?: string
  band?: string
  extraAccount?: StepData
  extraBusiness?: StepData
  extraSettlement?: StepData
}

const pad = (n: number, len: number) => String(n).padStart(len, '0')

/** Builds a complete, valid draft for a type. `n` makes identifiers unique. */
export function sampleDraft(type: string, o: SeedOptions): PartnerDraft {
  const account: StepData = {
    email: o.email,
    emailVerified: true,
    phone: o.phone,
    phoneVerified: true,
    password: DEMO_PASSWORD,
    fullName: o.fullName,
    idType: 'CNI',
    idFront: sampleDoc('cni-front.jpg'),
    idBack: sampleDoc('cni-back.jpg'),
    nin: `1${pad(o.n, 17)}`,
    selfie: sampleDoc('selfie.jpg'),
    ...o.extraAccount,
  }
  const isCompany = type === 'COMPANY' || type === 'ENTERPRISE'
  const holder = isCompany ? (o.companyName ?? o.fullName) : o.fullName
  const settlement: StepData = {
    settlementType: 'RIB',
    accountNumber: `0079999900${pad(o.n, 10)}`,
    holderName: holder,
    volumeBand: o.band ?? (type === 'ENTERPRISE' ? 'B4' : 'B1'),
    avgTicketDzd: 8000,
    ...o.extraSettlement,
  }
  const base = {
    tradeName: o.companyName ?? `Boutique ${o.fullName.split(' ')[0]}`,
    wilaya: '16',
    commune: 'Alger Centre',
    streetAddress: `${o.n} rue Didouche Mourad`,
    activityCode: 'PLACEHOLDER-001',
    salesChannel: 'IN_PERSON',
  }
  let business: StepData
  const steps: PartnerDraft['steps'] = {}
  if (type === 'AUTO_ENTREPRENEUR') {
    business = { anaeCardNumber: `AE-SEED-${pad(o.n, 4)}`, anaeCardPhoto: sampleDoc('anae.jpg'), ...base }
  } else if (type === 'INDIVIDUAL_TRADER') {
    business = {
      registrationType: 'RC',
      registrationNumber: `RC-SEED-${pad(o.n, 4)}`,
      registrationPhoto: sampleDoc('rc.jpg'),
      nif: `NIF-SEED-${pad(o.n, 4)}`,
      nifCertificate: sampleDoc('nif.pdf'),
      ...base,
    }
  } else {
    account.legalRole = 'MANAGER'
    business = {
      companyName: o.companyName ?? o.fullName,
      legalForm: 'SARL',
      rc: `RC-SEED-${pad(o.n, 4)}`,
      rcPhoto: sampleDoc('rc.jpg'),
      nif: `NIF-SEED-${pad(o.n, 4)}`,
      nis: `NIS-SEED-${pad(o.n, 4)}`,
      statuts: sampleDoc('statuts.pdf'),
      companyPhone: '021123456',
      companyEmail: o.email,
      repIsManager: 'YES',
      beneficialOwners: [
        { id: `bo_${o.n}`, fullName: o.fullName, nin: account.nin, ownershipPct: 100, idDocument: sampleDoc('cni-front.jpg') },
      ],
      ...base,
    }
    if (type === 'ENTERPRISE') {
      steps.enterpriseDocs = {
        delegationOfAuthority: sampleDoc('delegation.pdf'),
        financialStatements: sampleDoc('financials.pdf'),
        amlQuestionnaire: { status: 'DONE', answers: {} },
        techContactName: 'Sara Hamidi',
        techContactEmail: `it+${o.n}@example.dz`,
        techContactPhone: '661234567',
        collectsForSubMerchants: 'NO',
      }
    }
  }
  Object.assign(business, o.extraBusiness)
  steps.account = account
  steps.business = business
  steps.settlement = settlement
  steps.review = { acceptDeclarations: true }
  return { partnerType: type, steps, lastCompletedStep: 'review' }
}
