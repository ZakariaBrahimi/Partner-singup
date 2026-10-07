import { Loader2, TrendingUp } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { api, type PartnerStatus } from '@/api'
import { Field } from '@/components/form/Field'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { bandLabel, fmtDzd } from '@/lib/format'
import { errorText } from '@/lib/errors'
import { getPartnerType, hasPartnerType } from '@/shared/config/partnerTypes'
import { VOLUME_BANDS } from '@/shared/config/tbd'
import { firstIncompleteStep } from '@/shared/schema'
import type { PartnerType } from '@/shared/types'
import { useSignup } from './SignupContext'
import { stepPath } from './useSteps'

const CATEGORIES = ['SERVICES_PROFESSIONAL', 'SERVICES_DIGITAL', 'EDUCATION', 'CRAFT', 'FOOD', 'TRANSPORT'] as const

/** Everything that happens after approval: AE cap, activity restriction, upgrade path, volume flag. */
export function PostApproval({ status, onChange }: { status: PartnerStatus; onChange: () => void }) {
  const eff = status.effectiveType
  if (!eff || !hasPartnerType(eff)) return null
  const cfg = getPartnerType(eff)
  return (
    <>
      <CapBanners status={status} />
      {status.flags.includes('VOLUME_ABOVE_BAND') && <VolumeBanner status={status} onChange={onChange} />}
      <UpgradeCard status={status} targets={cfg.upgradeTargets} onChange={onChange} />
      {cfg.activityRestricted && <ActivityRestriction status={status} />}
    </>
  )
}

function UpgradeButtons({ targets, onChange, variant = 'outline' }: { targets: PartnerType[]; onChange: () => void; variant?: 'outline' | 'accent' }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const s = useSignup()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  async function start(to: PartnerType) {
    setBusy(to)
    setError(null)
    const r = await api.startUpgrade(to)
    setBusy(null)
    if (!r.ok) return setError('network')
    await s.refresh()
    onChange()
    nav(stepPath(firstIncompleteStep(r.data.draft)))
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-3">
        {targets.map((to) => (
          <Button key={to} variant={variant} onClick={() => void start(to)} disabled={!!busy} aria-busy={busy === to}>
            {busy === to && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {t('ui.post.upgradeTo', { type: t(`types.${to}.name`) })}
          </Button>
        ))}
      </div>
      {error && <Alert tone="error">{t(`errors.${error}`)}</Alert>}
    </div>
  )
}

/** Annual turnover versus the 5,000,000 DZD cap, with the 80% warning and the 100% flag. */
function CapBanners({ status }: { status: PartnerStatus }) {
  const { t, i18n } = useTranslation()
  const u = status.aeUsage
  if (!u) return null
  const pct = Math.round(u.ratio * 100)
  const eff = getPartnerType(status.effectiveType!)
  return (
    <>
      <Card data-testid="ae-usage">
        <CardTitle>{t('ui.post.capTitle')}</CardTitle>
        <Progress value={Math.min(100, pct)} aria-label={t('ui.post.capTitle')} />
        <p className="mt-2 text-sm text-ink-2">
          {t('ui.post.capUsage', { used: fmtDzd(u.annualDzd, i18n.language), cap: fmtDzd(u.capDzd, i18n.language), pct })}
        </p>
      </Card>
      {status.flags.includes('AE_CAP_80') && (
        <Alert tone="warning" data-testid="cap-80">
          <p className="mb-3 font-semibold">{t('ui.post.cap80', { pct })}</p>
          <UpgradeButtons targets={eff.upgradeTargets} onChange={() => undefined} variant="accent" />
        </Alert>
      )}
      {status.flags.includes('AE_CAP_100') && (
        <Alert tone="error" data-testid="cap-100">
          <p className="mb-3 font-semibold">{status.transactionsBlocked ? t('ui.post.cap100Block') : t('ui.post.cap100Flag')}</p>
          <UpgradeButtons targets={eff.upgradeTargets} onChange={() => undefined} variant="accent" />
        </Alert>
      )}
    </>
  )
}

function VolumeBanner({ status, onChange }: { status: PartnerStatus; onChange: () => void }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [band, setBand] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const s = useSignup()
  const declared = (s.draft.steps.settlement?.volumeBand as string | undefined) ?? null

  async function save() {
    if (!band) return setError('required')
    setBusy(true)
    setError(null)
    const r = await api.updateDeclaredVolume({ volumeBand: band })
    setBusy(false)
    if (r.ok) {
      setOpen(false)
      await s.refresh()
      onChange()
    } else setError(r.fieldErrors?.volumeBand ?? 'network')
  }

  return (
    <Alert tone="warning" data-testid="volume-flag">
      <p className="font-semibold">{t('ui.post.volumeTitle')}</p>
      <p>
        {t('ui.post.volumeBody', {
          current: `${fmtDzd(status.monthlyVolumeDzd, i18n.language)} DZD`,
          band: bandLabel(t, i18n.language, declared),
        })}
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        {t('ui.post.volumeCta')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t('ui.post.volumeCta')}</DialogTitle>
          <DialogDescription>{t('ui.post.volumeNote')}</DialogDescription>
          <div className="mt-4">
            <Field name="declared-band" label={t('fields.volumeBand.label')} error={error ? errorText(t, error) : null}>
              {(aria) => (
                <Select {...aria} value={band} onChange={(e) => setBand(e.target.value)}>
                  <option value="">{t('ui.choose')}</option>
                  {VOLUME_BANDS.map((b) => (
                    <option key={b.id} value={b.id}>{bandLabel(t, i18n.language, b.id)}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('ui.cancel')}</Button>
            <Button onClick={() => void save()} disabled={busy} aria-busy={busy}>
              {busy && <Loader2 aria-hidden className="size-5 animate-spin" />}
              {t('ui.post.volumeSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Alert>
  )
}

function UpgradeCard({ status, targets, onChange }: { status: PartnerStatus; targets: PartnerType[]; onChange: () => void }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const up = status.upgrade
  if (!up && targets.length === 0) return null
  return (
    <Card data-testid="upgrade-card">
      <CardTitle className="flex items-center gap-2">
        <TrendingUp aria-hidden className="size-5" />
        {t('ui.post.upgradeTitle')}
      </CardTitle>
      {!up && (
        <>
          <p className="mb-4 text-sm text-ink-2">{t('ui.post.upgradeBody')}</p>
          <UpgradeButtons targets={targets} onChange={onChange} />
        </>
      )}
      {up && (
        <div className="grid gap-3">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {t('ui.post.upgradeTo', { type: t(`types.${up.toType}.name`) })}
            <Badge variant={up.status === 'PENDING_APPROVAL' ? 'warning' : up.status === 'REJECTED' ? 'danger' : 'neutral'}>
              {t(`ui.post.upgradeState.${up.status}`)}
            </Badge>
          </p>
          <p className="text-sm text-ink-2">{t('ui.post.upgradeKeepsLimits')}</p>
          {up.status === 'REJECTED' && up.rejection && (
            <Alert tone="error">
              <p className="font-semibold">{t(`reasons.${up.rejection.code}`)}</p>
              <p dir="auto">{up.rejection.text}</p>
            </Alert>
          )}
          <div>
            {up.status === 'DRAFT' && (
              <Button onClick={() => void api.getDraft().then((d) => nav(d.ok ? stepPath(firstIncompleteStep(d.data.draft)) : '/status'))}>{t('ui.post.upgradeContinue')}</Button>
            )}
            {up.status === 'REJECTED' && (
              <Button asChild>
                <Link to="/status/fix">{t('ui.status.fix')}</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

/** AE: payment links and invoices only in categories mapped to the ANAE activity code. */
function ActivityRestriction({ status }: { status: PartnerStatus }) {
  const { t } = useTranslation()
  const [category, setCategory] = React.useState('')
  const [result, setResult] = React.useState<{ allowed: boolean; allowedCategories: string[] } | null>(null)
  const [busy, setBusy] = React.useState(false)
  async function check() {
    if (!category) return
    setBusy(true)
    const r = await api.checkPaymentCategory(category)
    setBusy(false)
    if (r.ok) setResult(r.data)
  }
  return (
    <Card data-testid="activity-restriction">
      <CardTitle>{t('ui.post.restrictionTitle')}</CardTitle>
      <p className="mb-3 text-sm text-ink-2">
        {t('ui.post.restrictionBody', { code: status.anaeActivityCode ?? '—' })}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field name="check-category" label={t('ui.post.restrictionTry')}>
          {(aria) => (
            <Select {...aria} value={category} onChange={(e) => { setCategory(e.target.value); setResult(null) }}>
              <option value="">{t('ui.choose')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`categories.${c}`)}</option>
              ))}
            </Select>
          )}
        </Field>
        <Button variant="outline" onClick={() => void check()} disabled={!category || busy} aria-busy={busy}>
          {t('ui.post.restrictionCheck')}
        </Button>
      </div>
      {result && (
        <Alert tone={result.allowed ? 'success' : 'error'} className="mt-3" role="status" data-testid="category-result">
          {result.allowed ? t('ui.post.categoryAllowed') : t('ui.post.categoryDenied', { allowed: result.allowedCategories.map((c) => t(`categories.${c}`)).join(', ') })}
        </Alert>
      )}
    </Card>
  )
}

