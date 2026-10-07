import { getPartnerType } from '@/shared/config/partnerTypes'
import type { FlowContext, StepDef } from '@/shared/config/schemaTypes'
import { getStepDef, isFieldVisible, makeContext, nextStep, resolveSteps, stepFields } from '@/shared/flow'
import { validateStepInContext } from '@/shared/schema'
import type { PartnerDraft, PartnerType, StepData, StepId } from '@/shared/types'

/** Keep only values of visible fields (plus the OTP flags): hidden leftovers are not saved. */
export function pickVisible(def: StepDef, values: StepData, ctx: FlowContext): StepData {
  const out: StepData = {}
  for (const f of stepFields(def)) {
    if (f.kind === 'notice') continue
    if (!isFieldVisible(f, values, ctx)) continue
    if (values[f.name] !== undefined) out[f.name] = values[f.name]
    if (f.verifiedFlag && values[f.verifiedFlag] !== undefined) out[f.verifiedFlag] = values[f.verifiedFlag]
  }
  return out
}

/**
 * Where "Continue" goes after saving `stepId`. In an upgrade the shared steps that are already
 * valid are skipped, so only the new type-specific step (and review) is required.
 */
export function nextStepAfter(type: PartnerType, steps: PartnerDraft['steps'], stepId: StepId, isUpgrade: boolean): StepId | null {
  let next = nextStep(type, steps, stepId)
  if (!isUpgrade) return next
  const ctx = makeContext(type, steps)
  const cfg = getPartnerType(ctx.effectiveType)
  while (next && next !== 'review') {
    const def = getStepDef(cfg, next)
    const clean = def && !def.typeSpecific && Object.keys(validateStepInContext(next, ctx)).length === 0
    if (!clean) break
    next = nextStep(type, steps, next)
  }
  return next
}

export const stepIds = (type: PartnerType, steps: PartnerDraft['steps']) => resolveSteps(type, steps)
