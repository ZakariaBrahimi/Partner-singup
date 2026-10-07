import { ArrowLeft, Eye, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { api, type AuditEntry, type SubmissionDetail as Detail } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { bandLabel, displayValue, fmtDzd } from '@/lib/format'
import { getPartnerType } from '@/shared/config/partnerTypes'
import { getStepDef, isFieldVisible, makeContext, resolveSteps, stepFields } from '@/shared/flow'
import type { UploadedDocument } from '@/shared/types'
import { useActivity } from '@/components/form/ActivityCombobox'
import { AdminLayout } from './AdminLayout'
import { ApproveDialog, ContractDialog, RejectDialog } from './AdminDialogs'
import { DocPreview } from './DocPreview'
import { StatusBadge } from './StatusBadge'

export function SubmissionDetail() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const [detail, setDetail] = React.useState<Detail | null>(null)
  const [audit, setAudit] = React.useState<AuditEntry[]>([])
  const [error, setError] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [dialog, setDialog] = React.useState<'approve' | 'reject' | 'contract' | null>(null)
  const [preview, setPreview] = React.useState<{ doc: UploadedDocument | null; label: string } | null>(null)

  const load = React.useCallback(async () => {
    const [d, a] = await Promise.all([api.admin.getSubmission(id), api.admin.listAudit(id)])
    if (d.ok) setDetail(d.data)
    else setError(true)
    if (a.ok) setAudit(a.data)
  }, [id])
  React.useEffect(() => {
    void load()
  }, [load])

  const activity = useActivity(detail?.anaeActivityCode ?? undefined)
  const [checkError, setCheckError] = React.useState(false)

  if (error)
    return (
      <AdminLayout>
        <Alert tone="error">{t('admin.detail.notFound')}</Alert>
        <Link to="/admin" className="font-semibold text-primary underline">{t('admin.detail.back')}</Link>
      </AdminLayout>
    )
  if (!detail)
    return (
      <AdminLayout>
        <div role="status" className="flex items-center gap-2 text-ink-2">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          {t('ui.loading')}
        </div>
      </AdminLayout>
    )

  const cfg = getPartnerType(detail.partnerType)
  const ctx = makeContext(detail.draft.partnerType!, detail.draft.steps)
  const pending = detail.status === 'PENDING_APPROVAL'
  const isDraft = detail.status === 'DRAFT'
  const done = detail.checklistKeys.filter((k) => detail.checklist[k]).length
  const fmtDate = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  const canSign = detail.status === 'APPROVED' && detail.contract.required && !detail.contract.signedAt && !detail.isUpgrade

  async function toggle(key: string, checked: boolean) {
    setCheckError(false)
    setDetail((d) => (d ? { ...d, checklist: { ...d.checklist, [key]: checked } } : d))
    const r = await api.admin.setChecklistItem(id, key, checked)
    if (!r.ok) {
      setCheckError(true)
      await load()
    }
  }
  const after = (msgKey: string) => (d: Detail) => {
    setDetail(d)
    setNotice(msgKey)
    void load()
  }

  return (
    <AdminLayout>
      <Link to="/admin" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline">
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t('admin.detail.back')}
      </Link>

      <header className="grid gap-2">
        <h1 className="text-3xl font-bold" tabIndex={-1} dir="auto">{detail.displayName}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} />
          <Badge variant="info">{t(`types.${detail.partnerType}.name`)}</Badge>
          <Badge variant="neutral">KYC {detail.kycLevel}</Badge>
          {detail.isUpgrade && detail.upgradeFrom && (
            <Badge variant="accent">{t('admin.detail.upgradeFrom', { from: t(`types.${detail.upgradeFrom}.name`) })}</Badge>
          )}
          {detail.routedToEnterprise && <Badge variant="warning">{t('admin.detail.routed')}</Badge>}
          {detail.flags.map((f) => (
            <Badge key={f} variant="warning">{t(`admin.flag.${f}`)}</Badge>
          ))}
        </div>
        <p className="text-sm text-ink-2" dir="ltr">{detail.email}</p>
      </header>

      {notice && <Alert tone="success" role="status">{t(notice)}</Alert>}

      {isDraft && (
        <Alert tone="info">
          {t('admin.detail.draftNote', { step: detail.lastCompletedStep ? t(`steps.${detail.lastCompletedStep}.nav`) : '—' })}
        </Alert>
      )}

      {detail.status === 'REJECTED' && detail.rejection && (
        <Alert tone="error" data-testid="admin-rejection">
          <p className="font-semibold">{t('admin.detail.rejected')}: {t(`reasons.${detail.rejection.code}`)}</p>
          <p dir="auto">{detail.rejection.text}</p>
          {detail.rejection.flaggedFields.length > 0 && <p className="mt-1 text-xs">{detail.rejection.flaggedFields.join(', ')}</p>}
        </Alert>
      )}

      {/* actions */}
      <Card className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setDialog('approve')} disabled={!pending}>{t('admin.approve.cta')}</Button>
        <Button variant="destructive" onClick={() => setDialog('reject')} disabled={!pending}>{t('admin.reject.cta')}</Button>
        {detail.contract.required && (
          <Button variant="outline" onClick={() => setDialog('contract')} disabled={!canSign}>
            {t('admin.contract.cta')}
          </Button>
        )}
        {!pending && !canSign && <span className="text-sm text-ink-2">{t('admin.detail.noActions')}</span>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* declared activity */}
        <Card>
          <CardTitle>{t('admin.detail.declared')}</CardTitle>
          <dl className="grid gap-3 text-sm">
            <Row label={t('fields.volumeBand.label')} value={bandLabel(t, i18n.language, detail.volumeBand)} testId="declared-band" />
            <Row label={t('fields.avgTicketDzd.label')} value={detail.draft.steps.settlement?.avgTicketDzd ? `${fmtDzd(Number(detail.draft.steps.settlement.avgTicketDzd), i18n.language)} DZD` : '—'} />
            {detail.anaeActivityCode && (
              <Row
                label={t('fields.activityCode.label')}
                value={`${detail.anaeActivityCode}${activity ? ` – ${i18n.language === 'ar' ? activity.labelAr : activity.labelFr}` : ''}`}
                testId="anae-code"
                mono
              />
            )}
            {cfg.annualCapDzd && detail.status === 'APPROVED' && detail.aeUsage && (
              <div className="grid gap-1">
                <dt className="text-ink-2">{t('admin.detail.aeUsage')}</dt>
                <dd>
                  <Progress value={Math.min(100, Math.round(detail.aeUsage.ratio * 100))} aria-label={t('admin.detail.aeUsage')} />
                  <span className="text-xs text-ink-2">
                    {fmtDzd(detail.aeUsage.annualDzd, i18n.language)} / {fmtDzd(detail.aeUsage.capDzd, i18n.language)} DZD ({Math.round(detail.aeUsage.ratio * 100)}%)
                  </span>
                </dd>
              </div>
            )}
            {detail.status === 'APPROVED' && <Row label={t('admin.detail.monthlyVolume')} value={`${fmtDzd(detail.monthlyVolumeDzd, i18n.language)} DZD`} />}
          </dl>
        </Card>

        {/* type-specific checklist */}
        <Card>
          <CardTitle>{t('admin.detail.checklist', { type: t(`types.${detail.partnerType}.name`) })}</CardTitle>
          <p className="mb-3 text-sm text-ink-2" data-testid="checklist-progress">{t('admin.detail.checklistProgress', { done, total: detail.checklistKeys.length })}</p>
          <ul className="grid gap-1" aria-label={t('admin.detail.checklist', { type: t(`types.${detail.partnerType}.name`) })}>
            {detail.checklistKeys.map((k) => (
              <li key={k}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface">
                  <Checkbox checked={!!detail.checklist[k]} onCheckedChange={(c) => void toggle(k, c === true)} disabled={isDraft} />
                  {t(`checklist.${k}`)}
                </label>
              </li>
            ))}
          </ul>
          {checkError && <Alert tone="error" className="mt-3">{t('errors.network')}</Alert>}
        </Card>
      </div>

      {detail.contract.required && (
        <Alert tone={detail.contract.signedAt ? 'success' : 'warning'} data-testid="admin-contract">
          {detail.contract.signedAt
            ? t('admin.detail.contractSigned', { date: fmtDate(detail.contract.signedAt), by: detail.contract.signedBy })
            : t('admin.detail.contractPending')}
        </Alert>
      )}

      {/* documents with preview popup */}
      <Card>
        <CardTitle>{t('admin.detail.documents')}</CardTitle>
        <ul className="grid gap-2" data-testid="documents">
          {detail.documents.map((d) => (
            <li key={d.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <span>
                {t(`fields.${d.field}.label`)}
                <span className="ms-2 text-xs text-ink-2" dir="auto">{d.doc?.name}</span>
              </span>
              {d.doc ? (
                <Button variant="outline" size="sm" onClick={() => setPreview({ doc: d.doc, label: t(`fields.${d.field}.label`) })}>
                  <Eye aria-hidden className="size-4" />
                  {t('admin.detail.preview')}
                </Button>
              ) : (
                <Badge variant="danger">{t('ui.review.missing')}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* submitted data */}
      {resolveSteps(detail.draft.partnerType!, detail.draft.steps)
        .filter((sid) => sid !== 'type' && sid !== 'review')
        .map((sid) => {
          const def = getStepDef(getPartnerType(ctx.effectiveType), sid)!
          const data = detail.draft.steps[sid] ?? {}
          return (
            <Card key={sid}>
              <CardTitle>{t([`steps.${sid}.${ctx.effectiveType}.title`, `steps.${sid}.title`])}</CardTitle>
              <dl className="grid gap-2">
                {stepFields(def)
                  .filter((f) => f.kind !== 'notice' && f.kind !== 'file' && isFieldVisible(f, data, ctx))
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
        <CardTitle>{t('admin.detail.audit')}</CardTitle>
        <ol className="grid gap-2 text-sm" data-testid="audit-log">
          {audit.length === 0 && <li className="text-ink-2">{t('admin.detail.auditEmpty')}</li>}
          {audit.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line pb-2 last:border-0">
              <time className="text-ink-2" dateTime={e.at}>{fmtDate(e.at)}</time>
              <span className="font-semibold">{e.action}</span>
              <span className="text-ink-2" dir="ltr">{e.actor}</span>
            </li>
          ))}
        </ol>
      </Card>

      <ApproveDialog open={dialog === 'approve'} onOpenChange={(o) => setDialog(o ? 'approve' : null)} detail={detail} onDone={after('admin.approve.done')} />
      <RejectDialog open={dialog === 'reject'} onOpenChange={(o) => setDialog(o ? 'reject' : null)} detail={detail} onDone={after('admin.reject.done')} />
      <ContractDialog open={dialog === 'contract'} onOpenChange={(o) => setDialog(o ? 'contract' : null)} detail={detail} onDone={after('admin.contract.done')} />
      <DocPreview doc={preview?.doc ?? null} label={preview?.label ?? ''} open={!!preview} onOpenChange={(o) => !o && setPreview(null)} />
    </AdminLayout>
  )
}

function Row({ label, value, mono, testId }: { label: string; value: string; mono?: boolean; testId?: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className={mono ? 'font-mono' : 'font-medium'} data-testid={testId}>{value}</dd>
    </div>
  )
}
