import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { useForm, type FieldValues, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FieldRenderer, useDedupe } from '@/components/form/FieldRenderer'
import { ErrorSummary, type SummaryItem } from '@/components/form/ErrorSummary'
import { PageHeader, PortalLayout, StepFooter } from '@/components/layout/PortalLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { errorText } from '@/lib/errors'
import { getPartnerType, hasPartnerType } from '@/shared/config/partnerTypes'
import { getStepDef, isFieldVisible, makeContext, prevStep, resolveSteps } from '@/shared/flow'
import { settlementHolderCheck, stepZodSchema } from '@/shared/schema'
import type { StepData } from '@/shared/types'
import { ReviewStep } from './ReviewStep'
import { useSignup } from './SignupContext'
import { nextStepAfter, pickVisible } from './stepHelpers'
import { stepPath, useSteps } from './useSteps'

/** Route element for /signup/:stepId. Guards, then renders the generic step form. */
export function StepPage() {
  const { stepId = '' } = useParams()
  const s = useSignup()
  if (!s.ready) return <Loading />
  if (s.summary && s.summary.status !== 'DRAFT') return <Navigate to="/status" replace />
  if (!hasPartnerType(s.draft.partnerType)) return <Navigate to="/signup" replace />
  const ids = resolveSteps(s.draft.partnerType, s.draft.steps)
  if (stepId === 'type' || !ids.includes(stepId)) return <Navigate to="/signup" replace />
  if (!s.summary && stepId !== 'account') return <Navigate to={stepPath('account')} replace />
  if (stepId === 'review') return <ReviewStep />
  return <StepForm key={`${stepId}:${s.draft.partnerType}`} stepId={stepId} />
}

export function Loading() {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex min-h-screen items-center justify-center gap-2 text-ink-2">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      {t('ui.loading')}
    </div>
  )
}

function StepForm({ stepId }: { stepId: string }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const location = useLocation()
  const s = useSignup()
  const { draft, summary } = s
  const type = draft.partnerType!
  const baseCtx = makeContext(type, draft.steps)
  const cfg = getPartnerType(baseCtx.effectiveType)
  const def = getStepDef(cfg, stepId)!
  const { items, eyebrow } = useSteps(stepId)

  const ctxRef = React.useRef(baseCtx)
  ctxRef.current = baseCtx
  const schema = React.useMemo(() => stepZodSchema(stepId, () => ctxRef.current), [stepId])
  const form = useForm<FieldValues>({
    defaultValues: draft.steps[stepId] ?? {},
    resolver: zodResolver(schema as never) as Resolver<FieldValues>,
    mode: 'onBlur',
    shouldFocusError: false,
  })
  const dedupe = useDedupe(form)
  const [busy, setBusy] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [summaryKey, setSummaryKey] = React.useState(0)

  const values = form.watch() as StepData
  const live = makeContext(type, { ...draft.steps, [stepId]: values })
  const holder = stepId === 'settlement' ? settlementHolderCheck(live) : null
  const created = (location.state as { accountCreated?: boolean } | null)?.accountCreated === true

  const errors = form.formState.errors as Record<string, { message?: string } | undefined>
  const summaryItems: SummaryItem[] = Object.entries(errors)
    .filter(([, e]) => e?.message && !(e.message === 'notVerified' && !form.formState.isSubmitted))
    .map(([name, e]) => ({ name, label: t(`fields.${name}.label`), message: errorText(t, e!.message!) }))

  const isUpgrade = !!summary?.isUpgrade

  async function onValid(raw: FieldValues) {
    setBusy(true)
    setFormError(null)
    const data = pickVisible(def, raw as StepData, live)
    const first = !summary && stepId === 'account'
    const r = await s.saveStep(stepId, data, true)
    setBusy(false)
    if (r.ok) {
      const merged = { ...draft.steps, [stepId]: data }
      const next = nextStepAfter(type, merged, stepId, isUpgrade)
      nav(next ? stepPath(next) : '/signup/review', { state: first ? { accountCreated: true } : undefined })
      return
    }
    if (r.fieldErrors) {
      for (const [name, code] of Object.entries(r.fieldErrors)) form.setError(name, { type: 'server', message: code })
      setSummaryKey((k) => k + 1)
    } else setFormError(r.error === 'NETWORK' ? 'network' : r.error)
  }

  async function back() {
    const prev = prevStep(type, draft.steps, stepId)
    const data = pickVisible(def, form.getValues() as StepData, live)
    if (Object.keys(data).length) await s.saveStep(stepId, data, false) // keep what was typed, no validation
    nav(prev ? stepPath(prev) : '/signup')
  }

  const title = t([`steps.${stepId}.${cfg.id}.title`, `steps.${stepId}.title`])
  const intro = t([`steps.${stepId}.${cfg.id}.intro`, `steps.${stepId}.intro`])

  return (
    <PortalLayout steps={items}>
      <PageHeader eyebrow={eyebrow} title={title} intro={intro} />

      {created && (
        <Alert tone="success" role="status">
          {t('ui.account.created')}
        </Alert>
      )}
      {live.effectiveType !== live.type && stepId !== 'type' && (
        <Alert tone="info">{t('ui.routed.note')}</Alert>
      )}

      <ErrorSummary items={summaryItems} focusKey={form.formState.submitCount + summaryKey} />

      <form noValidate onSubmit={(e) => void form.handleSubmit(onValid, () => setSummaryKey((k) => k + 1))(e)} className="grid gap-6" aria-busy={busy}>
        {def.sections.map((sec) => {
          const fields = sec.fields.filter((f) => isFieldVisible(f, values, live))
          if (!fields.length) return null
          return (
            <Card key={sec.id} aria-labelledby={`sec-${sec.id}`}>
              <CardTitle id={`sec-${sec.id}`}>{t(`sections.${stepId}.${sec.id}`)}</CardTitle>
              <div className="grid gap-5">
                {fields.map((f) => (
                  <React.Fragment key={f.name}>
                    <FieldRenderer
                      def={f}
                      form={form}
                      ctx={live}
                      dedupe={dedupe}
                      showCategories={!!cfg.activityRestricted}
                      warning={f.name === 'holderName' && holder?.mismatch ? t(cfg.holderMatch === 'company' ? 'ui.settlement.mismatchCompany' : 'ui.settlement.mismatchPerson') : null}
                    />
                    {f.name === 'volumeBand' && live.effectiveType !== live.type && (
                      <Alert tone="info" role="status">{t('ui.settlement.enterpriseNote')}</Alert>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </Card>
          )
        })}

        {formError && <Alert tone="error">{t(`errors.${formError}`, { defaultValue: t('errors.network') })}</Alert>}

        <StepFooter>
          {stepId === 'account' && !summary ? (
            <Button asChild variant="outline">
              <Link to="/signup" onClick={() => s.stashStep('account', pickVisible(def, form.getValues() as StepData, live))}>{t('ui.back')}</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void back()}>{t('ui.back')}</Button>
          )}
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {busy ? t('ui.saving') : t('ui.continue')}
          </Button>
        </StepFooter>
      </form>
    </PortalLayout>
  )
}
