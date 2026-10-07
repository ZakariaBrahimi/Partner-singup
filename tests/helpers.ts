import type { PartnerDraft, StepData, UploadedDocument } from '@/shared/types'

export const doc = (name = 'file.pdf'): UploadedDocument => ({
  id: `doc_${name}`,
  name,
  size: 1000,
  mime: 'application/pdf',
  status: 'uploaded',
})

const account = (extra: StepData = {}): StepData => ({
  email: 'new@partner.dz',
  emailVerified: true,
  phone: '550123456',
  phoneVerified: true,
  password: 'Abcdefg1!xyz',
  fullName: 'Karim Benali',
  idType: 'CNI',
  idFront: doc('front.jpg'),
  idBack: doc('back.jpg'),
  nin: '109876543210123456',
  selfie: doc('selfie.jpg'),
  ...extra,
})

const settlement = (extra: StepData = {}): StepData => ({
  settlementType: 'RIB',
  accountNumber: '00799999001234567891',
  holderName: 'Karim Benali',
  volumeBand: 'B1',
  avgTicketDzd: 5000,
  ...extra,
})

const common = {
  tradeName: 'Chez Karim',
  wilaya: '16',
  commune: 'Bab Ezzouar',
  streetAddress: '12 rue des Oliviers',
  activityCode: 'PLACEHOLDER-001',
  salesChannel: 'IN_PERSON',
}

export function validDraft(type: string): PartnerDraft {
  switch (type) {
    case 'AUTO_ENTREPRENEUR':
      return {
        partnerType: type,
        lastCompletedStep: 'settlement',
        steps: {
          account: account(),
          business: { anaeCardNumber: 'AE123456', anaeCardPhoto: doc(), ...common },
          settlement: settlement(),
          review: { acceptDeclarations: true },
        },
      }
    case 'INDIVIDUAL_TRADER':
      return {
        partnerType: type,
        lastCompletedStep: 'settlement',
        steps: {
          account: account(),
          business: {
            registrationType: 'RC',
            registrationNumber: '16/00-1234567B09',
            registrationPhoto: doc(),
            nif: '099916000123456',
            nifCertificate: doc(),
            ...common,
          },
          settlement: settlement(),
          review: { acceptDeclarations: true },
        },
      }
    case 'COMPANY':
    case 'ENTERPRISE': {
      const company = 'Benali Distribution'
      const business: StepData = {
        companyName: company,
        legalForm: 'SARL',
        tradeName: 'Benali Pay',
        rc: '16/00-7654321B09',
        rcPhoto: doc(),
        nif: '099916000654321',
        nis: '099916000987654',
        statuts: doc('statuts.pdf'),
        wilaya: '16',
        commune: 'Hydra',
        streetAddress: '1 avenue des Pins',
        companyPhone: '021123456',
        companyEmail: 'contact@benali.dz',
        repIsManager: 'YES',
        activityCode: 'PLACEHOLDER-001',
        salesChannel: 'IN_PERSON',
        beneficialOwners: [
          { id: 'o1', fullName: 'Karim Benali', nin: '109876543210123456', ownershipPct: 60, idDocument: doc() },
        ],
      }
      const steps: PartnerDraft['steps'] = {
        account: account({ legalRole: 'MANAGER' }),
        business,
        settlement: settlement({ holderName: company, volumeBand: type === 'ENTERPRISE' ? 'B4' : 'B2' }),
        review: { acceptDeclarations: true },
      }
      if (type === 'ENTERPRISE') {
        steps.enterpriseDocs = {
          delegationOfAuthority: doc('delegation.pdf'),
          financialStatements: doc('fin.pdf'),
          amlQuestionnaire: { status: 'DONE', answers: {} },
          techContactName: 'Sara Hamidi',
          techContactEmail: 'it@benali.dz',
          techContactPhone: '661234567',
          collectsForSubMerchants: 'NO',
        }
      }
      return { partnerType: type, lastCompletedStep: 'settlement', steps }
    }
    default:
      throw new Error(type)
  }
}
