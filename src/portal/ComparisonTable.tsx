import { Check, Minus } from 'lucide-react'

import { useTranslation } from 'react-i18next'
import { listPartnerTypes } from '@/shared/config/partnerTypes'
import { ALL_PRODUCTS, typeRequirements } from '@/shared/requirements'
import { cn } from '@/lib/utils'
import { fmtDzd } from '@/lib/format'

type Cell = { kind: 'yes' } | { kind: 'no' } | { kind: 'conditional' } | { kind: 'text'; text: string }

/** Side-by-side comparison of every partner type. Rows are derived from the type config. */
export function ComparisonTable() {
  const { t, i18n } = useTranslation()
  const types = listPartnerTypes()
  const reqs = types.map(typeRequirements)

  // Union of documents / numbers across types, in first-seen order. Documents are merged by document type:
  // Company and Enterprise collect the same delegation through different fields.
  const docRows: Array<{ docType: string; field: string }> = []
  const numRows: string[] = []
  reqs.forEach((r) => {
    r.documents.forEach((d) => !docRows.some((x) => x.docType === d.docType) && docRows.push({ docType: d.docType, field: d.field }))
    ;[...r.identifiers, ...r.extras].forEach((f) => !numRows.includes(f) && numRows.push(f))
  })

  const yn = (v: boolean): Cell => (v ? { kind: 'yes' } : { kind: 'no' })
  const label = (f: string) => t(`fields.${f}.label`)

  type Row = { key: string; label: string; cells: Cell[] }
  const groups: Array<{ id: string; title: string; rows: Row[] }> = [
    {
      id: 'overview',
      title: t('landing.compare.group.overview'),
      rows: [
        { key: 'bestFor', label: t('landing.compare.bestFor'), cells: types.map((c) => ({ kind: 'text', text: t(`types.${c.id}.desc`) })) },
        { key: 'kyc', label: t('landing.compare.kycLevel'), cells: types.map((c) => ({ kind: 'text', text: `KYC ${c.kycLevel}` })) },
        { key: 'steps', label: t('landing.compare.steps'), cells: types.map((c) => ({ kind: 'text', text: String(c.stepIds.length) })) },
        {
          key: 'upgrades',
          label: t('landing.compare.upgrades'),
          cells: types.map((c) => ({
            kind: 'text',
            text: c.upgradeTargets.length ? c.upgradeTargets.map((u) => t(`types.${u}.name`)).join(', ') : t('landing.compare.none'),
          })),
        },
      ],
    },
    {
      id: 'products',
      title: t('landing.compare.group.products'),
      rows: ALL_PRODUCTS.map((p) => ({ key: p, label: t(`products.${p}`), cells: types.map((c) => yn(c.products.includes(p))) })),
    },
    {
      id: 'documents',
      title: t('landing.compare.group.documents'),
      rows: docRows.map(({ docType, field }) => ({
        key: docType,
        label: label(field),
        cells: reqs.map((r): Cell => {
          const ds = r.documents.filter((x) => x.docType === docType)
          if (ds.length === 0) return { kind: 'no' }
          return ds.some((d) => !d.conditional) ? { kind: 'yes' } : { kind: 'conditional' }
        }),
      })),
    },
    {
      id: 'numbers',
      title: t('landing.compare.group.numbers'),
      rows: numRows.map((f) => ({
        key: f,
        label: label(f),
        cells: reqs.map((r) => yn(r.identifiers.includes(f) || r.extras.includes(f))),
      })),
    },
    {
      id: 'rules',
      title: t('landing.compare.group.rules'),
      rows: [
        {
          key: 'limits',
          label: t('landing.compare.limitsBasis'),
          cells: types.map((c) => ({
            kind: 'text',
            text: c.requiresContract ? t('landing.compare.limits.contract') : c.annualCapDzd ? t('landing.compare.limits.capAndBand') : t('landing.compare.limits.band'),
          })),
        },
        {
          key: 'cap',
          label: t('landing.compare.annualCap'),
          cells: types.map((c) => (c.annualCapDzd ? { kind: 'text', text: `${fmtDzd(c.annualCapDzd, i18n.language)} DZD` } : { kind: 'no' })),
        },
        {
          key: 'settlement',
          label: t('landing.compare.settlement'),
          cells: types.map((c) => ({ kind: 'text', text: t(c.holderMatch === 'company' ? 'landing.compare.settlementCompany' : 'landing.compare.settlementPerson') })),
        },
        { key: 'role', label: t('landing.compare.legalRole'), cells: types.map((c) => yn(c.showLegalRole)) },
        { key: 'restricted', label: t('landing.compare.activityRestricted'), cells: types.map((c) => yn(!!c.activityRestricted)) },
        { key: 'contract', label: t('landing.compare.contract'), cells: types.map((c) => yn(!!c.requiresContract)) },
      ],
    },
  ]

  const render = (c: Cell) => {
    switch (c.kind) {
      case 'yes':
        return (
          <>
            <Check aria-hidden className="mx-auto size-5 text-success" strokeWidth={3} />
            <span className="sr-only">{t('ui.yes')}</span>
          </>
        )
      case 'no':
        return (
          <>
            <Minus aria-hidden className="mx-auto size-5 text-ink-2/60" />
            <span className="sr-only">{t('ui.no')}</span>
          </>
        )
      case 'conditional':
        return <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-2">{t('landing.types.conditional')}</span>
      default:
        return <span className="text-sm">{c.text}</span>
    }
  }

  return (
    <section aria-labelledby="compare" className="grid min-w-0 gap-5">
      <div>
        <h2 id="compare" className="text-2xl font-bold">{t('landing.compare.title')}</h2>
        <p className="mt-1 text-ink-2">{t('landing.compare.intro')}</p>
      </div>
      <div className="relative overflow-x-auto rounded-card border border-line bg-white" tabIndex={0} role="region" aria-labelledby="compare">
        <table className="w-full min-w-[820px] border-collapse text-start" data-testid="comparison-table">
          <caption className="sr-only">{t('landing.compare.title')}</caption>
          <thead>
            <tr className="bg-primary text-white">
              <td className="sticky start-0 z-10 bg-primary p-3" />
              {types.map((c) => (
                <th key={c.id} scope="col" className="p-3 text-center align-bottom text-base font-bold">
                  {t(`types.${c.id}.name`)}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.id}>
              <tr>
                <th colSpan={types.length + 1} scope="colgroup" className="bg-surface px-3 py-2 text-start text-xs font-bold uppercase tracking-wide text-ink-2">
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.key} className="border-t border-line" data-row={r.key}>
                  <th scope="row" className="sticky start-0 z-10 w-56 bg-white p-3 text-start text-sm font-semibold">{r.label}</th>
                  {r.cells.map((c, i) => (
                    <td key={types[i].id} className={cn('p-3 text-center align-middle', i % 2 === 1 && 'bg-surface/50')}>
                      {render(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="text-sm text-ink-2">{t('landing.compare.note')}</p>
    </section>
  )
}
