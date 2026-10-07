import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Check } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { PageHeader, PortalLayout, StepFooter } from '@/components/layout/PortalLayout'
import { cn } from '@/lib/utils'
import { listPartnerTypes } from '@/shared/config/partnerTypes'
import { fieldsLostOnTypeChange } from '@/shared/flow'
import type { PartnerType } from '@/shared/types'
import { useSignup } from './SignupContext'
import { stepPath, useSteps } from './useSteps'

export function TypeStep() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const location = useLocation()
  const s = useSignup()
  const types = listPartnerTypes()
  const [selected, setSelected] = React.useState<PartnerType | null>(s.draft.partnerType)
  const [confirm, setConfirm] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const suggested = (location.state as { suggested?: boolean } | null)?.suggested === true
  const { items, eyebrow } = useSteps('type')

  // The helper (or a reload) may change the draft type after mount.
  React.useEffect(() => {
    setSelected(s.draft.partnerType)
  }, [s.draft.partnerType])

  if (s.ready && s.summary && s.summary.status !== 'DRAFT') return <Redirect to="/status" />

  const chosen = types.find((x) => x.id === selected)
  const changing = !!s.summary && !!s.draft.partnerType && selected !== s.draft.partnerType
  const lost = selected && changing ? fieldsLostOnTypeChange(s.draft, selected) : 0

  async function proceed() {
    if (!selected) return
    setBusy(true)
    setError(null)
    const r = s.draft.partnerType === selected ? { ok: true as const } : await s.selectType(selected)
    setBusy(false)
    if (!r.ok) return setError('network')
    nav(stepPath('account'))
  }

  return (
    <PortalLayout steps={items}>
      <PageHeader eyebrow={eyebrow} title={t('steps.type.title')} intro={t('steps.type.intro')} />

      {suggested && selected && (
        <Alert tone="info" role="status">
          {t('ui.type.suggested', { type: t(`types.${selected}.name`) })}
        </Alert>
      )}

      <RadioGroupPrimitive.Root
        value={selected ?? ''}
        onValueChange={setSelected}
        aria-label={t('steps.type.title')}
        className="grid gap-4 sm:grid-cols-2"
      >
        {types.map((c) => {
          const on = selected === c.id
          return (
            <RadioGroupPrimitive.Item
              key={c.id}
              value={c.id}
              data-testid={`type-${c.id}`}
              className={cn(
                'grid content-start gap-3 rounded-card border border-line bg-white p-5 text-start transition-shadow',
                on && 'border-primary ring-4 ring-accent',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-lg font-bold text-ink">{t(`types.${c.id}.name`)}</span>
                {on && (
                  <Badge variant="accent">
                    <Check aria-hidden className="size-3.5" strokeWidth={3} />
                    {t('ui.type.selected')}
                  </Badge>
                )}
              </span>
              <span className="text-sm text-ink-2">{t(`types.${c.id}.desc`)}</span>
              <span className="text-sm text-ink">
                <span className="font-semibold">{t('ui.type.youllNeed')}</span> {t(`types.${c.id}.needs`)}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {c.products.map((p) => (
                  <span key={p} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2">
                    {t(`products.${p}`)}
                  </span>
                ))}
              </span>
            </RadioGroupPrimitive.Item>
          )
        })}
      </RadioGroupPrimitive.Root>

      <nav aria-label={t('ui.type.help')} className="grid gap-1 text-base">
        <Link to="/signup/helper" className="min-h-11 py-2.5 font-semibold text-primary underline">
          {t('ui.type.helpMe')}
        </Link>
        <Link to="/signup/no-legal-status" className="min-h-11 py-2.5 font-semibold text-primary underline">
          {t('ui.type.noBusiness')}
        </Link>
        <span className="min-h-11 py-2.5 text-ink-2">
          {t('ui.type.alreadyPartner')}{' '}
          <Link to="/login" className="font-semibold text-primary underline">
            {t('ui.login.cta')}
          </Link>
        </span>
      </nav>

      {error && <Alert tone="error">{t(`errors.${error}`)}</Alert>}

      <StepFooter>
        <span />
        <Button
          disabled={!selected || busy}
          aria-busy={busy}
          onClick={() => (changing && lost > 0 ? setConfirm(true) : void proceed())}
        >
          {chosen ? t('ui.continueAs', { type: t(`types.${chosen.id}.name`) }) : t('ui.continue')}
        </Button>
      </StepFooter>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>{t('ui.type.changeTitle')}</DialogTitle>
          <DialogDescription>{t('ui.type.changeBody', { count: lost })}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t('ui.cancel')}
            </Button>
            <Button
              onClick={() => {
                setConfirm(false)
                void proceed()
              }}
            >
              {t('ui.type.changeConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  )
}

function Redirect({ to }: { to: string }) {
  return <Navigate to={to} replace />
}
