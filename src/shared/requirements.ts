// What a partner type asks for, derived from the type's step config (so it can never drift from the forms).
import { SHARED_STEPS } from './config/steps'
import type { PartnerTypeConfig } from './config/schemaTypes'
import { stepFields } from './flow'
import type { DocType, Product } from './types'

export const ALL_PRODUCTS: Product[] = [
  'PAYMENT_LINKS',
  'INVOICES',
  'QR',
  'WEBSITE_CHECKOUT',
  'POS',
  'API',
  'TEAM_USERS',
  'REFUNDS',
  'CUSTOM_PRICING',
  'SUB_MERCHANTS',
  'DEDICATED_SUPPORT',
]

export interface TypeRequirements {
  /** File uploads. `conditional` = only asked in some cases (e.g. ID back for a CNI). */
  documents: Array<{ field: string; docType: DocType; conditional: boolean }>
  /** Registration numbers and account numbers typed in (monospace fields). */
  identifiers: string[]
  /** Other items: beneficial owners list, AML questionnaire. */
  extras: string[]
  products: Product[]
  notIncluded: Product[]
}

export function typeRequirements(cfg: PartnerTypeConfig): TypeRequirements {
  const documents: TypeRequirements['documents'] = []
  const identifiers: string[] = []
  const extras: string[] = []
  const seen = new Set<string>()
  for (const id of cfg.stepIds) {
    const def = cfg.stepDefs[id] ?? SHARED_STEPS[id]
    if (!def) continue
    for (const f of stepFields(def)) {
      if (seen.has(f.name)) continue
      seen.add(f.name)
      if (f.kind === 'file' && f.doc) documents.push({ field: f.name, docType: f.doc.type, conditional: !!f.visibleWhen })
      else if (f.kind === 'mono') identifiers.push(f.name)
      else if (f.kind === 'owners' || f.kind === 'amlQuestionnaire') extras.push(f.name)
    }
  }
  return {
    documents,
    identifiers,
    extras,
    products: cfg.products,
    notIncluded: ALL_PRODUCTS.filter((p) => !cfg.products.includes(p)),
  }
}
