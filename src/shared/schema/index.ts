// Validation generated from the partner-type config. The same code runs in the portal (per step,
// via react-hook-form + zod) and in the mock API (on save and on submit): "the server validates
// against the same schema".
import { z } from 'zod'
import { getPartnerType } from '../config/partnerTypes'
import { BENEFICIAL_OWNER_THRESHOLD_PCT, VOLUME_BANDS } from '../config/tbd'
import { WILAYAS } from '../config/wilayas'
import type { FieldDef, FlowContext, StepDef } from '../config/schemaTypes'
import { getStepDef, isFieldRequired, isFieldVisible, makeContext, resolveSteps, stepFields } from '../flow'
import type { BeneficialOwner, FieldErrors, PartnerDraft, StepData, StepId, UploadedDocument } from '../types'
import { holderNameMatches, VALIDATORS, type Validator, type ValidatorId } from '../validators'

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

function resolveValidator(f: FieldDef, data: StepData): Validator | null {
  const id = typeof f.validator === 'function' ? f.validator(data) : f.validator
  return id ? (VALIDATORS as Record<ValidatorId, Validator>)[id] : null
}

function optionValues(f: FieldDef): string[] | null {
  if (f.optionsSource === 'wilayas') return WILAYAS.map((w) => w.code)
  if (f.optionsSource === 'volumeBands') return VOLUME_BANDS.map((b) => b.id)
  return f.options ?? null
}

export function ownerErrors(owners: BeneficialOwner[]): FieldErrors {
  const errs: FieldErrors = {}
  owners.forEach((o, i) => {
    if (!o.fullName || o.fullName.trim().split(/\s+/).length < 2) errs[`${i}.fullName`] = 'fullNameRequired'
    const ninErr = o.nin ? VALIDATORS.nin(o.nin) : 'required'
    if (ninErr) errs[`${i}.nin`] = ninErr
    const pct = VALIDATORS.percentage(String(o.ownershipPct ?? ''))
    if (pct) errs[`${i}.ownershipPct`] = pct
    // TODO(compliance): which owners need an ID? (threshold and required data TBD)
    else if (o.ownershipPct >= BENEFICIAL_OWNER_THRESHOLD_PCT && !o.idDocument) errs[`${i}.idDocument`] = 'ownerIdMissing'
  })
  return errs
}

/** Validate one field. Returns an error code or null. */
export function validateField(f: FieldDef, data: StepData): string | null {
  const v = data[f.name]
  if (f.kind === 'notice') return null
  if (f.kind === 'owners') {
    const owners = (Array.isArray(v) ? v : []) as BeneficialOwner[]
    if (owners.length === 0) return 'ownersRequired'
    if (Object.keys(ownerErrors(owners)).length) return 'ownersInvalid'
    if (owners.reduce((s, o) => s + Number(o.ownershipPct || 0), 0) > 100) return 'ownershipOver100'
    return null
  }
  if (f.kind === 'amlQuestionnaire') {
    const status = (v as { status?: string } | undefined)?.status
    return status === 'DONE' ? null : 'amlIncomplete'
  }
  if (f.kind === 'file') return v && (v as UploadedDocument).id ? null : 'required'
  if (f.kind === 'checkbox') return v === true ? null : 'mustAccept'

  if (isEmpty(v)) return null // required handled by the caller
  const s = String(v)
  const opts = optionValues(f)
  if ((f.kind === 'select' || f.kind === 'radio') && opts && !opts.includes(s)) return 'invalidOption'
  const validator = resolveValidator(f, data)
  const formatErr = validator ? validator(s) : null
  if (formatErr) return formatErr
  if (f.verifiedFlag && data[f.verifiedFlag] !== true) return 'notVerified'
  return null
}

/** Errors (field name -> code) for one step. Hidden fields are ignored. */
export function validateStep(def: StepDef, data: StepData, ctx: FlowContext): FieldErrors {
  const errors: FieldErrors = {}
  for (const f of stepFields(def)) {
    if (!isFieldVisible(f, data, ctx) || f.kind === 'notice') continue
    const v = data[f.name]
    if (isEmpty(v) && f.kind !== 'amlQuestionnaire' && f.kind !== 'checkbox' && f.kind !== 'file' && f.kind !== 'owners') {
      if (isFieldRequired(f, data, ctx)) errors[f.name] = 'required'
      continue
    }
    if (!isFieldRequired(f, data, ctx) && isEmpty(v)) continue
    const err = validateField(f, data)
    if (err) errors[f.name] = err
  }
  return errors
}

export interface StepWarnings {
  [fieldName: string]: string
}

/** Non-blocking (or, for company types, blocking) settlement-holder check, across steps. */
export function settlementHolderCheck(ctx: FlowContext): { mismatch: boolean; blocking: boolean } {
  const cfg = getPartnerType(ctx.effectiveType)
  const s = ctx.steps.settlement ?? {}
  const holder = String(s.holderName ?? '')
  if (!holder.trim()) return { mismatch: false, blocking: false }
  const expected =
    cfg.holderMatch === 'company'
      ? String((ctx.steps.business ?? {}).companyName ?? '')
      : String((ctx.steps.account ?? {}).fullName ?? '')
  if (!expected.trim()) return { mismatch: false, blocking: false }
  const mismatch = !holderNameMatches(holder, expected)
  return { mismatch, blocking: mismatch && cfg.holderMismatch === 'block' }
}

/** Validate a step in the context of the whole draft (cross-step rules included). */
export function validateStepInContext(stepId: StepId, ctx: FlowContext): FieldErrors {
  const cfg = getPartnerType(ctx.effectiveType)
  const def = getStepDef(cfg, stepId)
  if (!def) return {}
  const errors = validateStep(def, ctx.steps[stepId] ?? {}, ctx)
  if (stepId === 'settlement' && !errors.holderName && settlementHolderCheck(ctx).blocking) {
    errors.holderName = 'holderMustMatchCompany'
  }
  return errors
}

/** Full submission check, keys are `${stepId}.${fieldName}`. Mirrors what the real server must do. */
export function validateSubmission(draft: PartnerDraft): FieldErrors {
  if (!draft.partnerType) return { 'type.partnerType': 'required' }
  const ctx = makeContext(draft.partnerType, draft.steps)
  const out: FieldErrors = {}
  for (const id of resolveSteps(draft.partnerType, draft.steps)) {
    for (const [k, code] of Object.entries(validateStepInContext(id, ctx))) out[`${id}.${k}`] = code
  }
  return out
}

/** A zod schema for one step, usable as a react-hook-form resolver. `getCtx` returns the live flow context. */
export function stepZodSchema(stepId: StepId, getCtx: (values: StepData) => FlowContext) {
  return z.record(z.string(), z.unknown()).superRefine((values, issueCtx) => {
    const ctx = getCtx(values)
    const merged = { ...ctx, steps: { ...ctx.steps, [stepId]: values } }
    for (const [name, code] of Object.entries(validateStepInContext(stepId, merged))) {
      issueCtx.addIssue({ code: 'custom', path: [name], message: code })
    }
  })
}

/** Documents a draft needs (visible file fields), with upload status. Used by the review step and admin. */
export function requiredDocuments(draft: PartnerDraft) {
  if (!draft.partnerType) return []
  const ctx = makeContext(draft.partnerType, draft.steps)
  const cfg = getPartnerType(ctx.effectiveType)
  const out: Array<{ key: string; stepId: StepId; field: string; docType: string; doc: UploadedDocument | null }> = []
  for (const stepId of resolveSteps(draft.partnerType, draft.steps)) {
    const def = getStepDef(cfg, stepId)
    if (!def) continue
    const data = draft.steps[stepId] ?? {}
    for (const f of stepFields(def)) {
      if (f.kind !== 'file' || !f.doc || !isFieldVisible(f, data, ctx)) continue
      out.push({
        key: `${stepId}.${f.name}`,
        stepId,
        field: f.name,
        docType: f.doc.type,
        doc: (data[f.name] as UploadedDocument | undefined) ?? null,
      })
    }
  }
  return out
}
