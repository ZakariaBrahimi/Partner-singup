// Pure flow logic. It only reads the partner-type config: no partner type is named here.
import { getPartnerType, hasPartnerType, listPartnerTypes } from '../config/partnerTypes'
import { SHARED_STEPS } from '../config/steps'
import type { FieldDef, FlowContext, PartnerTypeConfig, StepDef } from '../config/schemaTypes'
import type { KybStatus, MerchantStatus, PartnerDraft, PartnerType, StepData, StepId } from '../types'

export const emptyDraft = (): PartnerDraft => ({ partnerType: null, steps: {}, lastCompletedStep: null })

/** Apply routing rules (e.g. Company above the volume threshold -> Enterprise). Follows chained rules once. */
export function effectiveType(type: PartnerType, steps: PartnerDraft['steps']): PartnerType {
  let current = type
  for (let i = 0; i < 4; i++) {
    const cfg = getPartnerType(current)
    const base = { type, effectiveType: current, showLegalRole: cfg.showLegalRole, steps }
    const hit = cfg.routing?.find((r) => r.when(base))
    if (!hit || hit.toType === current) return current
    current = hit.toType
  }
  return current
}

export function makeContext(type: PartnerType, steps: PartnerDraft['steps']): FlowContext {
  const eff = effectiveType(type, steps)
  return { type, effectiveType: eff, showLegalRole: getPartnerType(eff).showLegalRole, steps }
}

export function contextFromDraft(draft: PartnerDraft): FlowContext | null {
  return hasPartnerType(draft.partnerType) ? makeContext(draft.partnerType, draft.steps) : null
}

export function isRoutedUp(type: PartnerType, steps: PartnerDraft['steps']): boolean {
  return effectiveType(type, steps) !== type
}

/** Ordered step ids for this draft (after routing). */
export function resolveSteps(type: PartnerType, steps: PartnerDraft['steps']): StepId[] {
  return getPartnerType(effectiveType(type, steps)).stepIds
}

export function getStepDef(cfg: PartnerTypeConfig, id: StepId): StepDef | undefined {
  return cfg.stepDefs[id] ?? SHARED_STEPS[id]
}

export function stepFields(def: StepDef): FieldDef[] {
  return def.sections.flatMap((s) => s.fields)
}

export function isFieldVisible(f: FieldDef, data: StepData, ctx: FlowContext): boolean {
  return f.visibleWhen ? f.visibleWhen(data, ctx) : true
}

export function isFieldRequired(f: FieldDef, data: StepData, ctx: FlowContext): boolean {
  if (f.kind === 'notice') return false
  if (typeof f.required === 'function') return f.required(data, ctx)
  return f.required ?? true
}

export function visibleFields(def: StepDef, data: StepData, ctx: FlowContext): FieldDef[] {
  return stepFields(def).filter((f) => isFieldVisible(f, data, ctx))
}

/** "Step N of M": counts every step including the type step and review. */
export function stepPosition(type: PartnerType | null, steps: PartnerDraft['steps'], id: StepId) {
  const ids = type && hasPartnerType(type) ? resolveSteps(type, steps) : ['type']
  return { index: Math.max(0, ids.indexOf(id)) + 1, total: ids.length }
}

export function nextStep(type: PartnerType, steps: PartnerDraft['steps'], id: StepId): StepId | null {
  const ids = resolveSteps(type, steps)
  return ids[ids.indexOf(id) + 1] ?? null
}
export function prevStep(type: PartnerType, steps: PartnerDraft['steps'], id: StepId): StepId | null {
  const ids = resolveSteps(type, steps)
  return ids[ids.indexOf(id) - 1] ?? null
}

/** Step to open when the partner comes back: the first step after the last completed one. */
export function resumeStep(draft: PartnerDraft): StepId {
  if (!hasPartnerType(draft.partnerType)) return 'type'
  const ids = resolveSteps(draft.partnerType, draft.steps)
  if (!draft.lastCompletedStep) return ids[0]
  const i = ids.indexOf(draft.lastCompletedStep)
  return ids[Math.min(i + 1, ids.length - 1)] ?? ids[0]
}

/**
 * Change of partner type: keep shared-step data; in type-specific steps keep only the fields that
 * still exist in the new type (same name), dropping the rest; drop steps the new type does not have.
 * Completion rolls back to the last step before the first type-specific one, so the partner
 * revisits the type-specific steps.
 */
export function changePartnerType(draft: PartnerDraft, newType: PartnerType): PartnerDraft {
  const cfg = getPartnerType(newType)
  const steps: PartnerDraft['steps'] = {}
  for (const [stepId, data] of Object.entries(draft.steps)) {
    const def = getStepDef(cfg, stepId)
    if (!def) continue
    if (!def.typeSpecific) {
      steps[stepId] = data
      continue
    }
    const keep = new Set(stepFields(def).filter((f) => f.kind !== 'notice').map((f) => f.name))
    const kept = Object.fromEntries(Object.entries(data).filter(([k]) => keep.has(k)))
    if (Object.keys(kept).length) steps[stepId] = kept
  }
  const ids = resolveSteps(newType, steps)
  const firstSpecific = ids.findIndex((id) => getStepDef(cfg, id)?.typeSpecific)
  const lastShared = firstSpecific === -1 ? ids.length - 1 : firstSpecific - 1
  const done = draft.lastCompletedStep ? ids.indexOf(draft.lastCompletedStep) : -1
  const idx = Math.min(done, lastShared)
  return { partnerType: newType, steps, lastCompletedStep: idx >= 0 ? ids[idx] : null }
}

/** Type-specific field names that would be reset by a type change (for the confirmation popup). */
export function fieldsLostOnTypeChange(draft: PartnerDraft, newType: PartnerType): number {
  const after = changePartnerType(draft, newType)
  const count = (s: PartnerDraft['steps']) => Object.values(s).reduce((n, d) => n + Object.keys(d).length, 0)
  return count(draft.steps) - count(after.steps)
}

// ---------- step 1 helper ("Help me choose") ----------

export type HelperAnswers = Partial<Record<'rc' | 'ram' | 'anae', boolean>>

/** Returns the matching type, or 'NONE' (no legal status), or null while unanswered. Priority: RC > RAM > ANAE. */
export function helperResult(a: HelperAnswers): PartnerType | 'NONE' | null {
  const byKey = (k: 'rc' | 'ram' | 'anae') => listPartnerTypes().find((t) => t.helperMatch === k)?.id
  // RC holders could be a trader or a company: the helper preselects the individual trader, the partner can change it.
  if (a.rc) return byKey('rc') ?? null
  if (a.ram) return byKey('rc') ?? null
  if (a.anae) return byKey('anae') ?? null
  if (a.rc === false && a.ram === false && a.anae === false) return 'NONE'
  return null
}

// ---------- status transitions ----------

export const TRANSITIONS: Record<MerchantStatus, MerchantStatus[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  REJECTED: ['PENDING_APPROVAL'], // resubmit
  APPROVED: [],
}

export function canTransition(from: MerchantStatus, to: MerchantStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** KYB status that goes with a merchant status (existing backend pairing). DRAFT has no KYB record yet. */
export function kybFor(status: MerchantStatus): KybStatus | null {
  return status === 'DRAFT' ? null : status === 'PENDING_APPROVAL' ? 'PENDING' : status
}
