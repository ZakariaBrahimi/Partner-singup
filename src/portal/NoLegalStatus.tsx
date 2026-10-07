import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { PageHeader, PortalLayout, StepFooter } from '@/components/layout/PortalLayout'
import { ANAE_INFO_URL, CUSTOMER_APP_URL } from '@/shared/config/tbd'

/** Dead end: no RC, no RAM, no ANAE card. The partner cannot continue the signup. */
export function NoLegalStatus() {
  const { t } = useTranslation()
  return (
    <PortalLayout>
      <PageHeader title={t('ui.noStatus.title')} intro={t('ui.noStatus.intro')} />
      <Alert tone="warning">{t('ui.noStatus.reason')}</Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>{t('ui.noStatus.appTitle')}</CardTitle>
          <p className="mb-4 text-sm text-ink-2">{t('ui.noStatus.appBody')}</p>
          <Button asChild>
            <a href={CUSTOMER_APP_URL} target="_blank" rel="noopener noreferrer">
              {t('ui.noStatus.appCta')} <ExternalLink aria-hidden className="size-4" />
            </a>
          </Button>
        </Card>
        <Card>
          <CardTitle>{t('ui.noStatus.anaeTitle')}</CardTitle>
          <p className="mb-4 text-sm text-ink-2">{t('ui.noStatus.anaeBody')}</p>
          <Button asChild variant="outline">
            <a href={ANAE_INFO_URL} target="_blank" rel="noopener noreferrer">
              {t('ui.noStatus.anaeCta')} <ExternalLink aria-hidden className="size-4" />
            </a>
          </Button>
        </Card>
      </div>
      <StepFooter>
        <Button asChild variant="outline">
          <Link to="/signup">{t('ui.back')}</Link>
        </Button>
        <span />
      </StepFooter>
    </PortalLayout>
  )
}
