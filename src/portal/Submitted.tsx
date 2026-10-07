import { CircleCheck } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { PageHeader, PortalLayout } from '@/components/layout/PortalLayout'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EXPECTED_REVIEW_HOURS } from '@/shared/config/tbd'
import { getPartnerType, hasPartnerType } from '@/shared/config/partnerTypes'
import { useSignup } from './SignupContext'
import { Loading } from './DynamicStep'

export function Submitted() {
  const { t } = useTranslation()
  const s = useSignup()
  const location = useLocation()
  const state = location.state as { hours?: number; justSubmitted?: boolean } | null
  const hours = state?.hours ?? EXPECTED_REVIEW_HOURS
  const { refresh } = s
  React.useEffect(() => {
    if (state?.justSubmitted) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!s.ready) return <Loading />
  // Right after submit the session summary may still say DRAFT for a moment.
  if (state?.justSubmitted && s.summary?.status === 'DRAFT') return <Loading />
  if (!s.summary || s.summary.status === 'DRAFT') return <Navigate to="/signup" replace />
  const eff = s.summary.effectiveType
  const contract = !!eff && hasPartnerType(eff) && getPartnerType(eff).requiresContract
  return (
    <PortalLayout>
      <div className="flex items-center gap-3 text-success">
        <CircleCheck aria-hidden className="size-9" />
        <span className="text-sm font-bold uppercase tracking-wide">{t('ui.submitted.badge')}</span>
      </div>
      <PageHeader title={t('ui.submitted.title')} intro={t('ui.submitted.intro', { hours })} />
      <Card>
        <CardTitle>{t('ui.submitted.next')}</CardTitle>
        <ol className="grid list-decimal gap-2 ps-5 text-base">
          <li>{t('ui.submitted.n1')}</li>
          <li>{t('ui.submitted.n2')}</li>
          <li>{t('ui.submitted.n3')}</li>
          {contract && <li>{t('ui.submitted.contract')}</li>}
        </ol>
      </Card>
      <div>
        <Button asChild>
          <Link to="/status">{t('ui.submitted.track')}</Link>
        </Button>
      </div>
    </PortalLayout>
  )
}
