import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LangSwitcher } from './LangSwitcher'
import { Stepper, type StepperItem } from './Stepper'

export function Logo() {
  return (
    <Link to="/signup" className="flex min-h-11 items-center gap-2 text-white">
      <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-accent font-extrabold text-ink">M</span>
      <span className="text-lg font-bold">Mizaniya Pay</span>
    </Link>
  )
}

/**
 * Left navy sidebar (300px; stacks above the content on phones) + centered 760px main column.
 */
export function PortalLayout({
  steps,
  children,
  aside,
}: {
  steps?: StepperItem[]
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 bg-primary px-5 py-6 text-white md:min-h-screen md:w-[300px] md:py-8">
        <Logo />
        {steps && <Stepper items={steps} label={t('ui.progress')} />}
        {aside}
        <div className="mt-auto grid gap-4">
          {steps && <p className="text-sm text-white/85">{t('ui.progressSaved')}</p>}
          <LangSwitcher />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-12">
        <div className="mx-auto grid w-full max-w-[760px] gap-6">{children}</div>
      </main>
    </div>
  )
}

export function PageHeader({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <header className="grid gap-2">
      {eyebrow && <p className="text-sm font-bold uppercase tracking-wide text-ink-2">{eyebrow}</p>}
      <h1 className="text-3xl font-bold leading-tight text-ink" tabIndex={-1} data-page-title>
        {title}
      </h1>
      {intro && <p className="text-base text-ink-2">{intro}</p>}
    </header>
  )
}

export function StepFooter({ children }: { children: React.ReactNode }) {
  return <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">{children}</footer>
}
