// Shared step definitions (identical for every partner type) and field-building helpers.
import { VOLUME_BANDS } from './tbd'
import type { FieldDef, FlowContext, SectionDef, StepDef } from './schemaTypes'
import type { StepData } from '../types'

export const eq = (name: string, value: unknown) => (d: StepData) => d[name] === value
export const oneOf = (name: string, values: unknown[]) => (d: StepData) => values.includes(d[name])
export const not = (fn: (d: StepData, c: FlowContext) => boolean) => (d: StepData, c: FlowContext) => !fn(d, c)

export const IMAGE_OR_PDF: Array<'jpg' | 'png' | 'pdf'> = ['jpg', 'png', 'pdf']

/** 5 MB, JPG/PNG/PDF (no existing limits to follow). */
export const UPLOAD_LIMITS = { maxBytes: 5 * 1024 * 1024, mime: ['image/jpeg', 'image/png', 'application/pdf'] }

// ---------- reusable field groups ----------

export const activityAndChannels: SectionDef = {
  id: 'activity',
  fields: [
    { name: 'activityCode', kind: 'activity' },
    { name: 'salesChannel', kind: 'radio', options: ['IN_PERSON', 'ONLINE', 'BOTH'] },
    {
      name: 'website',
      kind: 'text',
      validator: 'websiteComDz',
      visibleWhen: oneOf('salesChannel', ['ONLINE', 'BOTH']),
    },
  ],
}

export const addressFields = (prefix = ''): FieldDef[] => [
  { name: `${prefix}wilaya`, kind: 'select', optionsSource: 'wilayas' },
  { name: `${prefix}commune`, kind: 'text', validator: 'text' },
  { name: `${prefix}streetAddress`, kind: 'text', validator: 'text' },
]

// ---------- shared steps ----------

export const ACCOUNT_STEP: StepDef = {
  id: 'account',
  sections: [
    {
      id: 'contact',
      fields: [
        { name: 'email', kind: 'email', validator: 'email', dedupe: 'email', verifiedFlag: 'emailVerified' },
        { name: 'phone', kind: 'phone', validator: 'phone', dedupe: 'phone', verifiedFlag: 'phoneVerified' },
        { name: 'password', kind: 'password', validator: 'password' },
      ],
    },
    {
      id: 'legalRep',
      fields: [
        { name: 'fullName', kind: 'text', validator: 'personName' },
        {
          name: 'legalRole',
          kind: 'select',
          options: ['OWNER', 'MANAGER', 'AUTHORISED_SIGNATORY'],
          // hidden for AE / individual trader: representative is the account holder
          visibleWhen: (_d, c) => c.showLegalRole,
        },
        { name: 'idType', kind: 'radio', options: ['CNI', 'PASSPORT'] },
        { name: 'idFront', kind: 'file', doc: { type: 'idFront', accept: IMAGE_OR_PDF } },
        {
          name: 'idBack',
          kind: 'file',
          doc: { type: 'idBack', accept: IMAGE_OR_PDF },
          visibleWhen: eq('idType', 'CNI'),
        },
        { name: 'nin', kind: 'mono', validator: 'nin', dedupe: 'nin' },
        { name: 'selfie', kind: 'file', doc: { type: 'selfie', accept: ['jpg', 'png'], camera: true } },
      ],
    },
  ],
}

export const SETTLEMENT_STEP: StepDef = {
  id: 'settlement',
  sections: [
    {
      id: 'account',
      fields: [
        { name: 'settlementType', kind: 'radio', options: ['RIB', 'CCP'] },
        {
          name: 'accountNumber',
          kind: 'mono',
          validator: (d) => (d.settlementType === 'CCP' ? 'ccp' : 'rib'),
          dedupe: (d) => (d.settlementType === 'CCP' ? 'ccp' : 'rib'),
        },
        { name: 'holderName', kind: 'text', validator: 'text' },
      ],
    },
    {
      id: 'volume',
      fields: [
        { name: 'volumeBand', kind: 'select', optionsSource: 'volumeBands', options: VOLUME_BANDS.map((b) => b.id) },
        { name: 'avgTicketDzd', kind: 'number', validator: 'positiveNumber' },
      ],
    },
  ],
}

export const REVIEW_STEP: StepDef = {
  id: 'review',
  sections: [{ id: 'declarations', fields: [{ name: 'acceptDeclarations', kind: 'checkbox' }] }],
}

export const TYPE_STEP: StepDef = { id: 'type', sections: [] }

export const SHARED_STEPS: Record<string, StepDef> = {
  type: TYPE_STEP,
  account: ACCOUNT_STEP,
  settlement: SETTLEMENT_STEP,
  review: REVIEW_STEP,
}
