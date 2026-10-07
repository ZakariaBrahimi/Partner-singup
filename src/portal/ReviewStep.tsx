import { Loader2, Pencil } from 'lucide-react'
import * as React from 'react'
import { useForm, type FieldValues } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { ErrorSummary, type SummaryItem } from '@/components/form/ErrorSummary'
import { FieldRenderer, useDedupe } from '@/components/form/FieldRenderer'
import { PageHeader, PortalLayout, StepFooter } from '@/components/layout/PortalLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { displayValue } from '@/lib/format'
import { errorText } from '@/lib/errors'
import { getPartnerType } from '@/shared/config/partnerTypes'
import { getStepDef, isFieldVisible, makeContext, prevStep, resolveSteps, stepFields } from '@/shared/flow'
import { requiredDocuments } from '@/shared/schema'
import type { StepData } from '@/shared/types'
import { useSignup } from './SignupContext'
import { stepPath, useSteps } from './useSteps'

/** Step N: one summary card per step with an Edit link, document statuses, declarations, submit. */
export function ReviewStep() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const s = useSignup()
  const { draft } = s
  const type = draft.partnerType!
  const ctx = makeContext(type, draft.steps)
  const cfg = getPartnerType(ctx.effectiveType)
  const { items, eyebrow } = useSteps('review')
  const reviewDef = getStepDef(cfg, 'review')!
  const form = useForm<FieldValues>({ defaultValues: draft.steps.review ?? { acceptDeclarations: false } })
  const dedupe = useDedupe(form)
  const [busy, setBusy] = React.useState(false)
  const [summaryItems, setSummaryItems] = React.useState<SummaryItem[]>([])
  const [summaryKey, setSummaryKey] = React.useState(0)
  const [formError, setFormError] = React.useState<string | null>(null)
  const accepted = form.watch('acceptDeclarations') === true
  const docs = requiredDocuments(draft)

  async function submit() {
    setFormError(null)
    setSummaryItems([])
    if (!accepted) {
      form.setError('acceptDeclarations', { type: 'required', message: 'mustAccept' })
      setSummaryItems([{ name: 'acceptDeclarations', label: t('ui.review.declarations'), message: errorText(t, 'mustAccept') }])
      setSummaryKey((k) => k + 1)
      return
    }
    setBusy(true)
    const saved = await s.saveStep('review', { acceptDeclarations: true }, true)
    if (!saved.ok) {
      setBusy(false)
      return setFormError('network')
    }
    const r = await api.submit()
    setBusy(false)
    if (r.ok) {
      // The confirmation page refreshes the session itself once it is mounted. Refreshing here would
      // make the step guard redirect to /status before the confirmation screen is shown.
      nav('/signup/submitted', { state: { hours: r.data.expectedReviewHours, justSubmitted: true } })
      return
    }
    if (r.fieldErrors) {
      // Server errors are listed here with a link to the step that owns each field.
      setSummaryItems(
        Object.entries(r.fieldErrors).map(([key, code]) => {
          const [stepId, ...rest] = key.split('.')
          const field = rest.join('.')
          return { name: key, label: t(`fields.${field}.label`, { defaultValue: field }), message: errorText(t, code), href: stepPath(stepId) }
        }),
      )
      setSummaryKey((k) => k + 1)
    } else setFormError(r.error === 'NETWORK' ? 'network' : 'network')
  }

  const prev = prevStep(type, draft.steps, 'review')

  return (
    <PortalLayout steps={items}>
      <PageHeader eyebrow={eyebrow} title={t('steps.review.title')} intro={t('steps.review.intro')} />
      <ErrorSummary items={summaryItems} focusKey={summaryKey} />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="mb-0">{t('ui.review.type')}</CardTitle>
          <EditLink to="/signup" />
        </div>
        <p className="mt-3 text-base font-semibold">{t(`types.${type}.name`)}</p>
        {ctx.effectiveType !== type && <p className="mt-1 text-sm text-ink-2">{t('ui.routed.note')}</p>}
      </Card>

      {resolveSteps(type, draft.steps)
        .filter((id) => id !== 'type' && id !== 'review')
        .map((id) => {
          const def = getStepDef(cfg, id)!
          const data = (draft.steps[id] ?? {}) as StepData
          return (
            <Card key={id} data-testid={`review-${id}`}>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="mb-0">{t([`steps.${id}.${cfg.id}.title`, `steps.${id}.title`])}</CardTitle>
                <EditLink to={stepPath(id)} />
              </div>
              <dl className="mt-4 grid gap-3">
                {stepFields(def)
                  .filter((f) => f.kind !== 'notice' && isFieldVisible(f, data, ctx))
                  .map((f) => (
                    <div key={f.name} className="grid gap-0.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
                      <dt className="text-sm text-ink-2">{t(`fields.${f.name}.label`)}</dt>
                      <dd className={f.kind === 'mono' ? 'break-all font-mono text-sm' : 'break-words text-sm font-medium'} dir={f.kind === 'mono' ? 'ltr' : undefined}>
                        {displayValue(f, data[f.name], t, i18n.language)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Card>
          )
        })}

      <Card>
        <CardTitle>{t('ui.review.documents')}</CardTitle>
        <ul className="grid gap-2">
          {docs.map((d) => (
            <li key={d.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{t(`fields.${d.field}.label`)}</span>
              {d.doc ? (
                <Badge variant="success">{t('ui.review.uploaded')} · {d.doc.name}</Badge>
              ) : (
                <Link to={stepPath(d.stepId)}><Badge variant="danger">{t('ui.review.missing')}</Badge></Link>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>{t('sections.review.declarations')}</CardTitle>
        {reviewDef.sections[0].fields.map((f) => (
          <FieldRenderer key={f.name} def={f} form={form} ctx={ctx} dedupe={dedupe} />
        ))}
      </Card>

      {formError && <Alert tone="error">{t(`errors.${formError}`)}</Alert>}

      <StepFooter>
        <Button variant="outline" onClick={() => nav(prev ? stepPath(prev) : '/signup')}>{t('ui.back')}</Button>
        <Button onClick={() => void submit()} disabled={busy} aria-busy={busy}>
          {busy && <Loader2 aria-hidden className="size-5 animate-spin" />}
          {busy ? t('ui.review.submitting') : t('ui.review.submit')}
        </Button>
      </StepFooter>
    </PortalLayout>
  )
}

function EditLink({ to }: { to: string }) {
  const { t } = useTranslation()
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1.5 px-2 font-semibold text-primary underline">
      <Pencil aria-hidden className="size-4" />
      {t('ui.edit')}
    </Link>
  )
}
