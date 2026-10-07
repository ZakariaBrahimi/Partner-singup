import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { useForm, type FieldValues } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, type PartnerStatus } from '@/api'
import { ErrorSummary, type SummaryItem } from '@/components/form/ErrorSummary'
import { FieldRenderer, useDedupe } from '@/components/form/FieldRenderer'
import { PageHeader, PortalLayout, StepFooter } from '@/components/layout/PortalLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { errorText } from '@/lib/errors'
import { getPartnerType } from '@/shared/config/partnerTypes'
import type { FieldDef } from '@/shared/config/schemaTypes'
import { getStepDef, isFieldVisible, makeContext, stepFields } from '@/shared/flow'
import { validateField } from '@/shared/schema'
import type { PartnerDraft, StepData } from '@/shared/types'
import { Loading } from './DynamicStep'
import { useSignup } from './SignupContext'

const sep = '__'
const fname = (stepId: string, field: string) => `${stepId}${sep}${field}`

/** "Fix and resubmit": reopens ONLY the flagged fields/documents; every other value is kept. */
export function FixResubmit() {
  const s = useSignup()
  const [status, setStatus] = React.useState<PartnerStatus | null>(null)
  const [draft, setDraft] = React.useState<PartnerDraft | null>(null)
  const [missing, setMissing] = React.useState(false)

  React.useEffect(() => {
    void (async () => {
      const [st, dr] = await Promise.all([api.getPartnerStatus(), api.getDraft()])
      if (st.ok && dr.ok) {
        setStatus(st.data)
        setDraft(dr.data.draft)
      } else setMissing(true)
    })()
  }, [])

  if (!s.ready) return <Loading />
  if (missing || !s.summary) return <Navigate to="/login" replace />
  if (!status || !draft) return <Loading />
  const rejection = rejectionOf(status)
  if (!rejection) return <Navigate to="/status" replace />
  return <FixForm draft={draft} rejection={rejection} />
}

/** The rejection being fixed: the signup's, or an upgrade's. */
function rejectionOf(status: PartnerStatus) {
  if (status.upgrade?.status === 'REJECTED') return status.upgrade.rejection ?? null
  return status.status === 'REJECTED' ? status.rejection : null
}

function FixForm({ draft, rejection }: { draft: PartnerDraft; rejection: NonNullable<PartnerStatus['rejection']> }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const s = useSignup()
  const ctx = makeContext(draft.partnerType!, draft.steps)
  const cfg = getPartnerType(ctx.effectiveType)
  const flagged = rejection.flaggedFields

  // flagged key -> field definition (skipping fields that are no longer visible)
  const targets = flagged
    .map((key) => {
      const [stepId, field] = key.split('.')
      const def = getStepDef(cfg, stepId)
      const f = def && stepFields(def).find((x) => x.name === field)
      return f && isFieldVisible(f, draft.steps[stepId] ?? {}, ctx) ? { key, stepId, def: f } : null
    })
    .filter((x): x is { key: string; stepId: string; def: FieldDef } => !!x)
  // With no flagged fields the rejection was general: nothing is reopened, the partner just resubmits.

  const defaults: FieldValues = {}
  for (const [stepId, data] of Object.entries(draft.steps)) for (const [k, v] of Object.entries(data)) defaults[fname(stepId, k)] = v
  const form = useForm<FieldValues>({ defaultValues: defaults, shouldFocusError: false })
  const dedupe = useDedupe(form)
  const [busy, setBusy] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [key, setKey] = React.useState(0)

  const errors = form.formState.errors as Record<string, { message?: string } | undefined>
  const items: SummaryItem[] = Object.entries(errors)
    .filter(([, e]) => e?.message)
    .map(([name, e]) => ({ name, label: t(`fields.${name.split(sep)[1]}.label`), message: errorText(t, e!.message!) }))

  async function submit() {
    setFormError(null)
    form.clearErrors()
    const changes: Record<string, StepData> = {}
    let invalid = false
    for (const { stepId, def } of targets) {
      const merged: StepData = {}
      for (const f of stepFields(getStepDef(cfg, stepId)!)) merged[f.name] = form.getValues(fname(stepId, f.name))
      if (def.verifiedFlag) merged[def.verifiedFlag] = form.getValues(fname(stepId, def.verifiedFlag))
      const empty = merged[def.name] === undefined || merged[def.name] === null || merged[def.name] === ''
      const code = empty && def.kind !== 'amlQuestionnaire' && def.kind !== 'owners' ? 'required' : validateField(def, merged)
      if (code) {
        form.setError(fname(stepId, def.name), { type: 'validate', message: code })
        invalid = true
      }
      ;(changes[stepId] ??= {})[def.name] = merged[def.name]
      if (def.verifiedFlag) changes[stepId][def.verifiedFlag] = merged[def.verifiedFlag]
    }
    if (invalid) return setKey((k) => k + 1)
    setBusy(true)
    const r = await api.resubmit({ changes })
    setBusy(false)
    if (r.ok) {
      await s.refresh()
      return nav('/status', { replace: true })
    }
    if (r.fieldErrors) {
      for (const [k, code] of Object.entries(r.fieldErrors)) form.setError(k.replace('.', sep), { type: 'server', message: code })
      setKey((k) => k + 1)
    } else setFormError('network')
  }

  return (
    <PortalLayout>
      <PageHeader title={t('ui.fix.title')} intro={t('ui.fix.intro')} />
      <Alert tone="error" data-testid="fix-reason">
        <p className="font-semibold">{t(`reasons.${rejection.code}`)}</p>
        <p dir="auto">{rejection.text}</p>
      </Alert>
      <ErrorSummary items={items} focusKey={key} />
      <form noValidate className="grid gap-6" onSubmit={(e) => { e.preventDefault(); void submit() }} aria-busy={busy}>
        {targets.length > 0 ? (
          <Card className="grid gap-5">
            <CardTitle>{t('ui.fix.itemsTitle', { count: targets.length })}</CardTitle>
            {targets.map(({ key: k, stepId, def }) => (
              <FieldRenderer key={k} def={def} form={form} ctx={ctx} name={fname(stepId, def.name)} dedupe={dedupe} showCategories={!!cfg.activityRestricted} />
            ))}
          </Card>
        ) : (
          <Alert tone="info">{t('ui.fix.nothingFlagged')}</Alert>
        )}
        {formError && <Alert tone="error">{t(`errors.${formError}`)}</Alert>}
        <StepFooter>
          <Button asChild variant="outline"><Link to="/status">{t('ui.back')}</Link></Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {busy ? t('ui.saving') : t('ui.fix.resubmit')}
          </Button>
        </StepFooter>
      </form>
    </PortalLayout>
  )
}
