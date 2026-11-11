import { Check, FlaskConical, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LangSwitcher } from '@/components/layout/LangSwitcher'
import { Logo } from '@/components/layout/PortalLayout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { listPartnerTypes } from '@/shared/config/partnerTypes'

const STEPS = ['account', 'test', 'verify', 'live'] as const
const TEST_ITEMS = ['keys', 'products', 'reset'] as const
const LIVE_ITEMS = ['verified', 'subscription', 'limits'] as const

/** Landing page: explains the partner auth system (test first, verify, subscribe, go live). */
export function Landing() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <Link to="/login" className="inline-flex min-h-11 items-center px-3 font-semibold underline">{t('landing.login')}</Link>
            <LangSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-12 px-4 py-12">
        <section className="grid gap-5">
          <p className="w-fit rounded-full bg-accent px-3 py-1 text-sm font-bold text-ink">{t('landing.badge')}</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">{t('landing.title')}</h1>
          <p className="max-w-2xl text-lg text-ink-2">{t('landing.subtitle')}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/signup">{t('landing.cta')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/login">{t('landing.login')}</Link>
            </Button>
          </div>
          <p className="text-sm text-ink-2">{t('landing.ctaNote')}</p>
        </section>

        <section aria-labelledby="how" className="grid gap-5">
          <h2 id="how" className="text-2xl font-bold">{t('landing.how.title')}</h2>
          <ol className="grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s}>
                <Card className="h-full p-5">
                  <span aria-hidden className="mb-3 flex size-9 items-center justify-center rounded-full bg-primary font-bold text-white">{i + 1}</span>
                  <h3 className="text-lg font-bold">{t(`landing.how.${s}.title`)}</h3>
                  <p className="mt-1 text-sm text-ink-2">{t(`landing.how.${s}.body`)}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="modes" className="grid gap-5">
          <h2 id="modes" className="text-2xl font-bold">{t('landing.modes.title')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-2 border-warn-border bg-warn-bg">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-warn-ink">
                <FlaskConical aria-hidden className="size-5" />
                {t('landing.modes.test')}
              </h3>
              <ul className="grid gap-2 text-sm text-warn-ink">
                {TEST_ITEMS.map((k) => (
                  <li key={k} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0" />{t(`landing.modes.testItems.${k}`)}</li>
                ))}
              </ul>
            </Card>
            <Card className="border-2 border-primary">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary">
                <Rocket aria-hidden className="size-5" />
                {t('landing.modes.live')}
              </h3>
              <ul className="grid gap-2 text-sm">
                {LIVE_ITEMS.map((k) => (
                  <li key={k} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{t(`landing.modes.liveItems.${k}`)}</li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section aria-labelledby="types" className="grid gap-5">
          <div>
            <h2 id="types" className="text-2xl font-bold">{t('landing.types.title')}</h2>
            <p className="mt-1 text-ink-2">{t('landing.types.intro')}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {listPartnerTypes().map((c) => (
              <li key={c.id}>
                <Card className="h-full p-5">
                  <h3 className="font-bold">{t(`types.${c.id}.name`)}</h3>
                  <p className="mt-1 text-sm text-ink-2">{t(`types.${c.id}.desc`)}</p>
                  <p className="mt-3 text-xs font-semibold text-primary">KYC {c.kycLevel}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-card bg-primary p-8 text-white">
          <h2 className="text-2xl font-bold">{t('landing.final.title')}</h2>
          <p className="mt-1 text-white/90">{t('landing.final.body')}</p>
          <Button asChild variant="accent" className="mt-5">
            <Link to="/signup">{t('landing.cta')}</Link>
          </Button>
        </section>
      </main>
    </div>
  )
}
