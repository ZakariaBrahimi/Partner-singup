// Which values of a draft must be unique across partners (RC, NIF, NIS, NIN, AE card, email, phone, RIB, CCP).
// Driven by the `dedupe` declarations in the partner-type config.
import { getPartnerType, hasPartnerType } from './config/partnerTypes'
import { getStepDef, isFieldVisible, makeContext, resolveSteps, stepFields } from './flow'
import type { PartnerDraft } from './types'
import { normalizeIdentifier, type DuplicateField } from './validators'

export function canonicalValue(field: string, value: string): string {
  if (field === 'email') return value.trim().toLowerCase()
  if (field === 'phone') return value.replace(/\D/g, '').replace(/^0/, '')
  return normalizeIdentifier(value)
}

export interface DedupeEntry {
  field: DuplicateField
  value: string // canonical
  stepId: string
  fieldName: string
}

export function dedupeEntries(draft: PartnerDraft): DedupeEntry[] {
  if (!hasPartnerType(draft.partnerType)) return []
  const ctx = makeContext(draft.partnerType, draft.steps)
  const cfg = getPartnerType(ctx.effectiveType)
  const out: DedupeEntry[] = []
  for (const stepId of resolveSteps(draft.partnerType, draft.steps)) {
    const def = getStepDef(cfg, stepId)
    if (!def) continue
    const data = draft.steps[stepId] ?? {}
    for (const f of stepFields(def)) {
      if (!f.dedupe || !isFieldVisible(f, data, ctx)) continue
      const field = typeof f.dedupe === 'function' ? f.dedupe(data) : f.dedupe
      const raw = data[f.name]
      if (!field || typeof raw !== 'string' || !raw.trim()) continue
      out.push({ field, value: canonicalValue(field, raw), stepId, fieldName: f.name })
    }
  }
  return out
}
