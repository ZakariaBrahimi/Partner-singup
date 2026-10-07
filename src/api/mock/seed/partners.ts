import { effectiveType } from '@/shared/flow'
import { getPartnerType } from '@/shared/config/partnerTypes'
import { limitsFor } from '@/shared/limits'
import type { RejectionInfo } from '@/shared/types'
import { makeKey } from '../keys'
import type { PartnerRecord } from '../db'
import { DEMO_DUPLICATES as D, sampleDraft } from './drafts'

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

function record(
  id: string,
  draft: PartnerRecord['draft'],
  p: Partial<PartnerRecord> & { status: PartnerRecord['status'] },
): PartnerRecord {
  const eff = draft.partnerType ? effectiveType(draft.partnerType, draft.steps) : null
  const approved = p.status === 'APPROVED'
  const band = (draft.steps.settlement?.volumeBand as string | undefined) ?? null
  return {
    id,
    createdAt: day(20),
    kyb: p.status === 'DRAFT' ? null : p.status === 'PENDING_APPROVAL' ? 'PENDING' : p.status,
    draft,
    kycLevel: eff ? getPartnerType(eff).kycLevel : null,
    submittedAt: p.status === 'DRAFT' ? null : day(6),
    reviewedAt: approved || p.status === 'REJECTED' ? day(3) : null,
    rejection: null,
    rejectionHistory: [],
    limits: approved && eff ? limitsFor(eff, band) : null,
    sandboxKeys: [makeKey('SANDBOX', 'ACTIVE')],
    liveKeys: approved ? [makeKey('LIVE', eff === 'ENTERPRISE' && !p.contractSignedAt ? 'INACTIVE' : 'ACTIVE')] : [],
    contractSignedAt: null,
    contractSignedBy: null,
    annualVolumeDzd: 0,
    monthlyVolumeDzd: 0,
    checklist: {},
    notifications: [],
    audit: [],
    upgrade: null,
    ...p,
  }
}

export function seedPartners(): PartnerRecord[] {
  const rejection: RejectionInfo = {
    code: 'DOCUMENT_UNREADABLE',
    text: 'The photo of your RC is blurry and the selfie is cropped. Please upload clear photos.',
    flaggedFields: ['business.registrationPhoto', 'account.selfie'],
  }
  return [
    record(
      'P-1001',
      sampleDraft('AUTO_ENTREPRENEUR', {
        n: 1,
        email: 'ae.demo@mizaniya.dz',
        phone: D.phone,
        fullName: 'Amine Haddad',
        extraAccount: { nin: D.nin },
        extraBusiness: { anaeCardNumber: D.anaeCardNumber },
      }),
      { status: 'APPROVED', annualVolumeDzd: 1_000_000 },
    ),
    record(
      'P-1002',
      sampleDraft('COMPANY', {
        n: 2,
        email: D.email,
        phone: '550000002',
        fullName: 'Yasmine Mansouri',
        companyName: 'Mansouri Électronique SARL',
        band: 'B2',
        extraBusiness: { rc: D.rc, nif: D.nif, nis: D.nis },
        extraSettlement: { settlementType: 'CCP', accountNumber: D.ccp },
      }),
      { status: 'PENDING_APPROVAL' },
    ),
    record(
      'P-1003',
      sampleDraft('INDIVIDUAL_TRADER', {
        n: 3,
        email: 'trader.rejected@mizaniya.dz',
        phone: '550000003',
        fullName: 'Walid Cherif',
      }),
      { status: 'REJECTED', rejection, rejectionHistory: [rejection] },
    ),
    record(
      'P-1004',
      sampleDraft('ENTERPRISE', {
        n: 4,
        email: 'enterprise.pending@mizaniya.dz',
        phone: '550000004',
        fullName: 'Nadia Boudiaf',
        companyName: 'Boudiaf Group SPA',
      }),
      { status: 'PENDING_APPROVAL' },
    ),
    record(
      'P-1005',
      sampleDraft('ENTERPRISE', {
        n: 5,
        email: 'enterprise.approved@mizaniya.dz',
        phone: '550000005',
        fullName: 'Rachid Oussedik',
        companyName: 'Oussedik Industries SPA',
      }),
      { status: 'APPROVED', kycLevel: 3 },
    ),
    record(
      'P-1006',
      {
        partnerType: 'AUTO_ENTREPRENEUR',
        lastCompletedStep: 'account',
        steps: {
          account: { ...sampleDraft('AUTO_ENTREPRENEUR', { n: 6, email: 'ae.draft@mizaniya.dz', phone: '550000006', fullName: 'Lina Merabet' }).steps.account },
        },
      },
      { status: 'DRAFT' },
    ),
    record(
      'P-1007',
      sampleDraft('COMPANY', {
        n: 7,
        email: 'company.approved@mizaniya.dz',
        phone: '550000007',
        fullName: 'Sofiane Kaci',
        companyName: 'Kaci Négoce EURL',
        band: 'B2',
      }),
      { status: 'APPROVED', monthlyVolumeDzd: 900_000 },
    ),
    record(
      'P-1008',
      sampleDraft('INDIVIDUAL_TRADER', {
        n: 8,
        email: 'trader.pending@mizaniya.dz',
        phone: '550000008',
        fullName: 'Meriem Bensalem',
        extraBusiness: { salesChannel: 'ONLINE', website: 'https://meriem-shop.com.dz' },
      }),
      { status: 'PENDING_APPROVAL' },
    ),
    record(
      'P-1009',
      {
        partnerType: 'COMPANY',
        lastCompletedStep: 'account',
        steps: {
          account: { ...sampleDraft('COMPANY', { n: 9, email: 'company.draft@mizaniya.dz', phone: '550000009', fullName: 'Hakim Ziani', companyName: 'Ziani SARL' }).steps.account },
          business: { companyName: 'Ziani SARL', legalForm: 'SARL' },
        },
      },
      { status: 'DRAFT' },
    ),
  ]
}
