import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LangSwitcher } from '@/components/layout/LangSwitcher'

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/admin" className="flex min-h-11 items-center gap-2">
            <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-accent font-extrabold text-ink">M</span>
            <span className="text-lg font-bold">Mizaniya Pay</span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold uppercase">{t('admin.badge')}</span>
          </Link>
          <LangSwitcher />
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">{children}</main>
    </div>
  )
}
