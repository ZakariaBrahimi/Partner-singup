import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api, type SubmissionRow } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { bandLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { listPartnerTypes } from '@/shared/config/partnerTypes'
import type { KycLevel, MerchantStatus } from '@/shared/types'
import { AdminLayout } from './AdminLayout'
import { StatusBadge } from './StatusBadge'

type Tab = 'L2' | 'L3' | 'DRAFTS'
const TABS: Tab[] = ['L2', 'L3', 'DRAFTS']

/** "Merchant Registration Requests": partner submissions under KYC Level 2 / 3, plus incomplete signups. */
export function SubmissionsList() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = React.useState<Tab>('L2')
  const [type, setType] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [rows, setRows] = React.useState<SubmissionRow[] | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    let live = true
    setRows(null)
    setError(false)
    void api.admin
      .listSubmissions({
        view: tab === 'DRAFTS' ? 'drafts' : 'submissions',
        level: tab === 'L2' ? (2 as KycLevel) : tab === 'L3' ? (3 as KycLevel) : undefined,
        partnerType: type || undefined,
        status: (status as MerchantStatus) || undefined,
      })
      .then((r) => {
        if (!live) return
        if (r.ok) setRows(r.data)
        else setError(true)
      })
    return () => {
      live = false
    }
  }, [tab, type, status])

  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso)) : '—')
  const types = listPartnerTypes().filter((x) => (tab === 'L2' ? x.kycLevel === 2 : tab === 'L3' ? x.kycLevel === 3 : true))

  return (
    <AdminLayout>
      <header>
        <h1 className="text-3xl font-bold" tabIndex={-1}>{t('admin.list.title')}</h1>
        <p className="mt-1 text-ink-2">{t('admin.list.intro')}</p>
      </header>

      <div role="tablist" aria-label={t('admin.list.title')} className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <button
            key={x}
            role="tab"
            aria-selected={tab === x}
            onClick={() => {
              setTab(x)
              setType('')
              setStatus('')
            }}
            className={cn('min-h-11 rounded-full border px-5 text-sm font-bold', tab === x ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink')}
          >
            {t(`admin.list.tab.${x}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
        <label className="grid gap-1.5 text-sm font-semibold">
          {t('admin.list.filterType')}
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('admin.list.all')}</option>
            {types.map((x) => (
              <option key={x.id} value={x.id}>{t(`types.${x.id}.name`)}</option>
            ))}
          </Select>
        </label>
        {tab !== 'DRAFTS' && (
          <label className="grid gap-1.5 text-sm font-semibold">
            {t('admin.list.filterStatus')}
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('admin.list.all')}</option>
              {(['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const).map((s) => (
                <option key={s} value={s}>{t(`ui.status.state.${s}`)}</option>
              ))}
            </Select>
          </label>
        )}
      </div>

      {error && <Alert tone="error">{t('errors.network')}</Alert>}
      {!rows && !error && (
        <div role="status" className="flex items-center gap-2 text-ink-2">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          {t('ui.loading')}
        </div>
      )}
      {rows && rows.length === 0 && <Alert tone="info">{t('admin.list.empty')}</Alert>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[760px] text-start text-sm" data-testid="submissions-table">
            <caption className="sr-only">{t('admin.list.title')}</caption>
            <thead className="bg-surface text-ink-2">
              <tr>
                {['partner', 'type', tab === 'DRAFTS' ? 'lastStep' : 'status', tab === 'DRAFTS' ? 'email' : 'band', 'submitted'].map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 text-start font-semibold">{t(`admin.list.col.${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line" data-testid="submission-row">
                  <th scope="row" className="px-4 py-3 text-start font-semibold">
                    <Link to={`/admin/${r.id}`} className="inline-flex min-h-11 items-center text-primary underline">{r.displayName}</Link>
                    {r.isUpgrade && <Badge variant="info" className="ms-2">{t('admin.list.upgrade')}</Badge>}
                  </th>
                  <td className="px-4 py-3">
                    <span>{t(`types.${r.partnerType}.name`)}</span>
                    <span className="ms-2 text-xs text-ink-2">KYC {r.kycLevel}</span>
                  </td>
                  {tab === 'DRAFTS' ? (
                    <>
                      <td className="px-4 py-3" data-testid="last-step">{r.lastCompletedStep ? t(`steps.${r.lastCompletedStep}.nav`) : '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs" dir="ltr">{r.email}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={r.status} />
                          {r.flags.map((f) => (
                            <Badge key={f} variant="warning">{t(`admin.flag.${f}`)}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">{bandLabel(t, i18n.language, r.volumeBand)}</td>
                    </>
                  )}
                  <td className="px-4 py-3">{date(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
