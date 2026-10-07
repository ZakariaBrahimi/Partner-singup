import { Check, CircleAlert, CircleDot, Clock, Copy, KeyRound } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { api, type ApiKey, type PartnerStatus } from '@/api'
import { PageHeader, PortalLayout } from '@/components/layout/PortalLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { fmtDzd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getPartnerType, hasPartnerType } from '@/shared/config/partnerTypes'
import { getStepDef, stepFields } from '@/shared/flow'
import { EXPECTED_REVIEW_HOURS } from '@/shared/config/tbd'
import { Loading } from './DynamicStep'
import { PostApproval } from './PostApproval'
import { useSignup } from './SignupContext'

export function useStatus() {
  const [status, setStatus] = React.useState<PartnerStatus | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const load = React.useCallback(async () => {
    const r = await api.getPartnerStatus()
    if (r.ok) setStatus(r.data)
    else setError(r.error)
  }, [])
  React.useEffect(() => {
    void load()
  }, [load])
  // The dev panel (QA only) changes volumes behind the page's back.
  React.useEffect(() => {
    const h = () => void load()
    window.addEventListener('mizaniya:dev-changed', h)
    return () => window.removeEventListener('mizaniya:dev-changed', h)
  }, [load])
  return { status, error, reload: load }
}

const STATUS_BADGE = { DRAFT: 'neutral', PENDING_APPROVAL: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const

export function StatusPage() {
  const { t } = useTranslation()
  const s = useSignup()
  const { status, error, reload } = useStatus()
  if (!s.ready) return <Loading />
  if (!s.summary || error === 'UNAUTHENTICATED') return <Navigate to="/login" replace />
  if (s.summary.status === 'DRAFT' && !s.summary.isUpgrade) return <Navigate to="/signup" replace />
  if (!status) return <Loading />

  return (
    <PortalLayout aside={<AccountAside onLogout={() => void s.logout()} name={status.displayName} />}>
      <PageHeader title={t('ui.status.title')} intro={status.displayName} />
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={STATUS_BADGE[status.status]} data-testid="merchant-status">{t(`ui.status.state.${status.status}`)}</Badge>
        {status.effectiveType && <span className="text-sm text-ink-2">{t(`types.${status.effectiveType}.name`)}</span>}
        {status.kycLevel && status.status === 'APPROVED' && <Badge variant="info">{t('ui.status.kyc', { level: status.kycLevel })}</Badge>}
      </div>

      <Timeline status={status} />

      {status.status === 'PENDING_APPROVAL' && (
        <Alert tone="info" role="status">{t('ui.status.pending', { hours: EXPECTED_REVIEW_HOURS })}</Alert>
      )}
      {status.status === 'REJECTED' && status.rejection && <RejectionCard status={status} />}
      {status.status === 'APPROVED' && <Approved status={status} />}
      {status.status === 'APPROVED' && <PostApproval status={status} onChange={reload} />}
      <Outbox status={status} />
    </PortalLayout>
  )
}

function AccountAside({ onLogout, name }: { onLogout: () => void; name: string }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3 text-sm text-white/90">
      <p className="font-semibold text-white" dir="auto">{name}</p>
      <Button variant="outline" size="sm" className="w-fit border-white bg-transparent text-white hover:bg-white/10" onClick={onLogout}>
        {t('ui.logout')}
      </Button>
    </div>
  )
}

function Timeline({ status }: { status: PartnerStatus }) {
  const { t, i18n } = useTranslation()
  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : null)
  const currentIdx = status.timeline.findIndex((e) => !e.done)
  return (
    <Card aria-label={t('ui.status.timeline')}>
      <ol className="grid gap-5" data-testid="timeline">
        {status.timeline.map((e, i) => {
          const rejected = e.state === 'REJECTED'
          const state = e.done ? (rejected ? 'rejected' : 'done') : i === currentIdx ? 'current' : 'upcoming'
          return (
            <li key={e.state} data-state={state} aria-current={state === 'current' ? 'step' : undefined} className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2',
                  state === 'done' && 'border-success bg-success text-white',
                  state === 'rejected' && 'border-danger bg-danger text-white',
                  state === 'current' && 'border-primary bg-[#eef4f7] text-primary',
                  state === 'upcoming' && 'border-line text-ink-2',
                )}
              >
                {state === 'done' ? <Check className="size-4" strokeWidth={3} /> : state === 'rejected' ? <CircleAlert className="size-4" /> : state === 'current' ? <Clock className="size-4" /> : <CircleDot className="size-4" />}
              </span>
              <div>
                <p className={cn('font-semibold', state === 'upcoming' && 'text-ink-2')}>{t(`ui.status.step.${e.state}`)}</p>
                {fmt(e.at) && <p className="text-sm text-ink-2">{fmt(e.at)}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

/** Flagged keys `step.field` -> readable "Step › Field" labels. */
export function flaggedLabels(status: PartnerStatus, t: (k: string) => string): Array<{ key: string; step: string; field: string }> {
  const eff = status.effectiveType
  if (!eff || !hasPartnerType(eff) || !status.rejection) return []
  const cfg = getPartnerType(eff)
  return status.rejection.flaggedFields.map((key) => {
    const [stepId, field] = key.split('.')
    const def = getStepDef(cfg, stepId)
    const known = def && stepFields(def).some((f) => f.name === field)
    return { key, step: t(`steps.${stepId}.nav`), field: known ? t(`fields.${field}.label`) : field }
  })
}

function RejectionCard({ status }: { status: PartnerStatus }) {
  const { t } = useTranslation()
  const r = status.rejection!
  const flagged = flaggedLabels(status, t as never)
  return (
    <Card className="grid gap-4 border-2 border-danger" data-testid="rejection">
      <div className="flex items-center gap-2 text-danger">
        <CircleAlert aria-hidden className="size-6" />
        <h2 className="text-lg font-bold">{t('ui.status.rejectedTitle')}</h2>
      </div>
      <dl className="grid gap-2">
        <div>
          <dt className="text-sm text-ink-2">{t('ui.status.reason')}</dt>
          <dd className="font-semibold">{t(`reasons.${r.code}`)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-2">{t('ui.status.message')}</dt>
          <dd dir="auto">{r.text}</dd>
        </div>
      </dl>
      {flagged.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">{t('ui.status.flagged')}</p>
          <ul className="grid gap-2" data-testid="flagged-list">
            {flagged.map((f) => (
              <li key={f.key} className="rounded-lg border-2 border-danger bg-[#fdeceb] px-3 py-2 text-sm font-medium">
                {f.step} › {f.field}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <Button asChild>
          <Link to="/status/fix">{t('ui.status.fix')}</Link>
        </Button>
      </div>
    </Card>
  )
}

function KeyRow({ k }: { k: ApiKey }) {
  const { t } = useTranslation()
  const [copied, setCopied] = React.useState(false)
  const masked = `${k.key.slice(0, 8)}••••••••${k.key.slice(-4)}`
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
      <span className="flex items-center gap-2 text-sm">
        <KeyRound aria-hidden className="size-4 text-ink-2" />
        <Badge variant={k.env === 'LIVE' ? 'info' : 'neutral'}>{t(`ui.status.env.${k.env}`)}</Badge>
        <span className="font-mono" dir="ltr">{masked}</span>
      </span>
      <span className="flex items-center gap-2">
        <Badge variant={k.status === 'ACTIVE' ? 'success' : 'warning'} data-testid={`key-${k.env}`}>{t(`ui.status.keyStatus.${k.status}`)}</Badge>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface"
          aria-label={t('ui.status.copyKey')}
          onClick={() => {
            void navigator.clipboard?.writeText(k.key)
            setCopied(true)
          }}
        >
          {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
        </button>
      </span>
    </li>
  )
}

function Approved({ status }: { status: PartnerStatus }) {
  const { t, i18n } = useTranslation()
  const lim = status.limits
  const val = (n: number | null | undefined) => (n === null || n === undefined ? t('ui.status.byContract') : `${fmtDzd(n, i18n.language)} DZD`)
  return (
    <>
      {status.contract.required &&
        (status.goLiveBlocked ? (
          <Alert tone="warning" data-testid="contract-pending">
            <p className="font-semibold">{t('ui.status.contractPending')}</p>
            <p>{t('ui.status.contractPendingBody')}</p>
          </Alert>
        ) : (
          <Alert tone="success">{t('ui.status.contractSigned')}</Alert>
        ))}

      <Card>
        <CardTitle>{t('ui.status.limits')}</CardTitle>
        <dl className="grid gap-2 sm:grid-cols-2">
          {(['perTransaction', 'monthly', 'payout', 'annual'] as const)
            .filter((k) => lim && k in lim)
            .map((k) => (
              <div key={k} className="rounded-lg bg-surface p-3">
                <dt className="text-sm text-ink-2">{t(`ui.status.limit.${k}`)}</dt>
                <dd className="font-semibold" data-testid={`limit-${k}`}>{val(lim![k])}</dd>
              </div>
            ))}
        </dl>
        <p className="mt-3 text-sm text-ink-2">{t('ui.status.limitsNote')}</p>
      </Card>

      <Card>
        <CardTitle>{t('ui.status.products')}</CardTitle>
        <ul className="flex flex-wrap gap-2">
          {status.products.map((p) => (
            <li key={p} className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium">{t(`products.${p}`)}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>{t('ui.status.keys')}</CardTitle>
        <ul className="grid gap-2">
          {[...status.liveKeys, ...status.sandboxKeys].map((k) => (
            <KeyRow key={k.id} k={k} />
          ))}
        </ul>
        {status.goLiveBlocked && <p className="mt-3 text-sm text-ink-2">{t('ui.status.liveBlocked')}</p>}
      </Card>
    </>
  )
}

/** Emails and portal notifications sent to this partner (mock outbox, useful to test notifications). */
function Outbox({ status }: { status: PartnerStatus }) {
  const { t, i18n } = useTranslation()
  if (status.notifications.length === 0) return null
  return (
    <Card data-testid="outbox">
      <CardTitle>{t('ui.status.outbox')}</CardTitle>
      <ul className="grid gap-2 text-sm">
        {[...status.notifications].reverse().map((n) => (
          <li key={n.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 last:border-0">
            <Badge variant="neutral">{n.channel}</Badge>
            <span className="font-medium">{t(`ui.status.notif.${n.kind}`)}</span>
            <time className="text-ink-2" dateTime={n.at}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(n.at))}</time>
          </li>
        ))}
      </ul>
    </Card>
  )
}
