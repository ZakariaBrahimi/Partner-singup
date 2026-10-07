// THE partner-type configuration. Adding a partner type = adding one entry here (+ i18n strings).
// The flow, stepper, forms, review, validation and admin checklist are all generated from it.
import { AE_ANNUAL_CAP_DZD, ENTERPRISE_VOLUME_THRESHOLD, VOLUME_BANDS } from './tbd'
import {
  activityAndChannels,
  addressFields,
  eq,
  IMAGE_OR_PDF,
} from './steps'
import type { FieldDef, PartnerTypeConfig, SectionDef, StepDef } from './schemaTypes'
import type { Product } from '../types'

const BASE: Product[] = ['PAYMENT_LINKS', 'INVOICES', 'QR']
const TRADER: Product[] = [...BASE, 'WEBSITE_CHECKOUT', 'POS']
const COMPANY_P: Product[] = [...TRADER, 'API', 'TEAM_USERS', 'REFUNDS']
const ENTERPRISE_P: Product[] = [...COMPANY_P, 'CUSTOM_PRICING', 'SUB_MERCHANTS', 'DEDICATED_SUPPORT']

const STEPS = ['type', 'account', 'business', 'settlement', 'review']
const STEPS_ENTERPRISE = ['type', 'account', 'business', 'settlement', 'enterpriseDocs', 'review']

/** True when the band id starts at or above the Enterprise threshold. */
export function bandIsEnterprise(bandId: unknown): boolean {
  const b = VOLUME_BANDS.find((x) => x.id === bandId)
  return !!b && b.minDzd >= ENTERPRISE_VOLUME_THRESHOLD
}

const businessIdentity: SectionDef = {
  id: 'identity',
  fields: [{ name: 'tradeName', kind: 'text', validator: 'text' }, ...addressFields()],
}

const aeStep: StepDef = {
  id: 'business',
  typeSpecific: true,
  sections: [
    {
      id: 'registration',
      fields: [
        { name: 'anaeCardNumber', kind: 'mono', validator: 'anaeCardNumber', dedupe: 'anaeCardNumber' },
        { name: 'anaeCardPhoto', kind: 'file', doc: { type: 'anaeCardPhoto', accept: IMAGE_OR_PDF } },
        { name: 'aeCapNotice', kind: 'notice', tone: 'warning' },
        { name: 'aePhysicalGoodsNotice', kind: 'notice', tone: 'warning', link: 'type-step' },
      ],
    },
    businessIdentity,
    activityAndChannels,
  ],
}

const traderStep: StepDef = {
  id: 'business',
  typeSpecific: true,
  sections: [
    {
      id: 'registration',
      fields: [
        { name: 'registrationType', kind: 'radio', options: ['RC', 'RAM'] },
        {
          name: 'registrationNumber',
          kind: 'mono',
          validator: (d) => (d.registrationType === 'RAM' ? 'ram' : 'rc'),
          dedupe: (d) => (d.registrationType === 'RAM' ? null : 'rc'),
        },
        { name: 'registrationPhoto', kind: 'file', doc: { type: 'registrationPhoto', accept: IMAGE_OR_PDF } },
        { name: 'nif', kind: 'mono', validator: 'nif', dedupe: 'nif' },
        { name: 'nifCertificate', kind: 'file', doc: { type: 'nifCertificate', accept: IMAGE_OR_PDF } },
      ],
    },
    businessIdentity,
    activityAndChannels,
  ],
}

function companyStep(enterprise: boolean): StepDef {
  const notManager = eq('repIsManager', 'NO')
  const fields: FieldDef[] = [
    { name: 'companyName', kind: 'text', validator: 'text' },
    { name: 'legalForm', kind: 'select', options: ['EURL', 'SARL', 'SNC', 'SPA', 'OTHER'] },
    { name: 'legalFormOther', kind: 'text', validator: 'text', visibleWhen: eq('legalForm', 'OTHER') },
    { name: 'tradeName', kind: 'text', validator: 'text' },
  ]
  const registration: FieldDef[] = [
    { name: 'rc', kind: 'mono', validator: 'rc', dedupe: 'rc' },
    { name: 'rcPhoto', kind: 'file', doc: { type: 'rcPhoto', accept: IMAGE_OR_PDF } },
    { name: 'nif', kind: 'mono', validator: 'nif', dedupe: 'nif' },
    { name: 'nis', kind: 'mono', validator: 'nis', dedupe: 'nis' },
    { name: 'statuts', kind: 'file', doc: { type: 'statuts', accept: ['pdf'] } },
  ]
  const contact: FieldDef[] = [
    ...addressFields(),
    { name: 'companyPhone', kind: 'phone', validator: 'companyPhone' },
    { name: 'companyEmail', kind: 'email', validator: 'email' },
  ]
  const representation: FieldDef[] = [
    { name: 'repIsManager', kind: 'radio', options: ['YES', 'NO'] },
    { name: 'managerId', kind: 'file', doc: { type: 'managerId', accept: IMAGE_OR_PDF }, visibleWhen: notManager },
    // Enterprise collects the delegation in its own step, always.
    ...(enterprise
      ? []
      : [
          {
            name: 'delegation',
            kind: 'file',
            doc: { type: 'delegation', accept: IMAGE_OR_PDF },
            visibleWhen: notManager,
          } as FieldDef,
        ]),
  ]
  return {
    id: 'business',
    typeSpecific: true,
    sections: [
      { id: 'company', fields },
      { id: 'registration', fields: registration },
      { id: 'contact', fields: contact },
      { id: 'representation', fields: representation },
      activityAndChannels,
      { id: 'owners', fields: [{ name: 'beneficialOwners', kind: 'owners' }] },
    ],
  }
}

const enterpriseDocsStep: StepDef = {
  id: 'enterpriseDocs',
  typeSpecific: true,
  sections: [
    {
      id: 'contractNotice',
      fields: [{ name: 'contractNotice', kind: 'notice', tone: 'info' }],
    },
    {
      id: 'documents',
      fields: [
        { name: 'delegationOfAuthority', kind: 'file', doc: { type: 'delegation', accept: IMAGE_OR_PDF } },
        { name: 'financialStatements', kind: 'file', doc: { type: 'financialStatements', accept: ['pdf'] } },
        { name: 'amlQuestionnaire', kind: 'amlQuestionnaire' },
      ],
    },
    {
      id: 'technicalContact',
      fields: [
        { name: 'techContactName', kind: 'text', validator: 'personName' },
        { name: 'techContactEmail', kind: 'email', validator: 'email' },
        { name: 'techContactPhone', kind: 'phone', validator: 'phone' },
        { name: 'collectsForSubMerchants', kind: 'radio', options: ['YES', 'NO'] },
      ],
    },
  ],
}

const REGISTRY: Record<string, PartnerTypeConfig> = {}

export function registerPartnerType(cfg: PartnerTypeConfig) {
  REGISTRY[cfg.id] = cfg
}
export function unregisterPartnerType(id: string) {
  delete REGISTRY[id]
}

registerPartnerType({
  id: 'AUTO_ENTREPRENEUR',
  order: 1,
  kycLevel: 2,
  showLegalRole: false,
  holderMatch: 'person',
  holderMismatch: 'warn',
  products: BASE,
  limitKeys: ['perTransaction', 'payout', 'annual'],
  stepIds: STEPS,
  stepDefs: { business: aeStep },
  reviewChecklist: ['aeCardVerified', 'idMatchesSelfie', 'activityEligible', 'settlementMatchesHolder'],
  upgradeTargets: ['INDIVIDUAL_TRADER', 'COMPANY'],
  helperMatch: 'anae',
  annualCapDzd: AE_ANNUAL_CAP_DZD,
  activityRestricted: true,
})

registerPartnerType({
  id: 'INDIVIDUAL_TRADER',
  order: 2,
  kycLevel: 2,
  showLegalRole: false,
  holderMatch: 'person',
  holderMismatch: 'warn',
  products: TRADER,
  limitKeys: ['perTransaction', 'monthly', 'payout'],
  stepIds: STEPS,
  stepDefs: { business: traderStep },
  reviewChecklist: ['registrationValid', 'nifValid', 'idMatchesSelfie', 'activityEligible', 'websiteComDz', 'settlementMatchesHolder'],
  upgradeTargets: ['COMPANY'],
  helperMatch: 'rc',
})

registerPartnerType({
  id: 'COMPANY',
  order: 3,
  kycLevel: 2,
  showLegalRole: true,
  holderMatch: 'company',
  holderMismatch: 'block',
  products: COMPANY_P,
  limitKeys: ['perTransaction', 'monthly', 'payout'],
  stepIds: STEPS,
  stepDefs: { business: companyStep(false) },
  reviewChecklist: [
    'rcValid',
    'nifNisValid',
    'statutsReviewed',
    'managerIdVerified',
    'beneficialOwnersComplete',
    'delegationIfNotManager',
    'websiteComDz',
    'settlementInCompanyName',
  ],
  upgradeTargets: ['ENTERPRISE'],
  routing: [
    {
      toType: 'ENTERPRISE',
      when: (ctx) => bandIsEnterprise((ctx.steps.settlement ?? {}).volumeBand),
    },
  ],
})

registerPartnerType({
  id: 'ENTERPRISE',
  order: 4,
  kycLevel: 3,
  showLegalRole: true,
  holderMatch: 'company',
  holderMismatch: 'block',
  products: ENTERPRISE_P,
  limitKeys: ['perTransaction', 'monthly', 'payout'],
  stepIds: STEPS_ENTERPRISE,
  stepDefs: { business: companyStep(true), enterpriseDocs: enterpriseDocsStep },
  reviewChecklist: [
    'rcValid',
    'nifNisValid',
    'statutsReviewed',
    'managerIdVerified',
    'beneficialOwnersComplete',
    'delegationReviewed',
    'financialStatementsReviewed',
    'amlQuestionnaireReviewed',
    'technicalContactVerified',
    'settlementInCompanyName',
  ],
  upgradeTargets: [],
  requiresContract: true,
})

export function getPartnerType(id: string): PartnerTypeConfig {
  const cfg = REGISTRY[id]
  if (!cfg) throw new Error(`Unknown partner type: ${id}`)
  return cfg
}
export function hasPartnerType(id: string | null | undefined): id is string {
  return !!id && id in REGISTRY
}
/** Types the partner can pick on step 1, in display order. */
export function listPartnerTypes(): PartnerTypeConfig[] {
  return Object.values(REGISTRY).sort((a, b) => a.order - b.order)
}
