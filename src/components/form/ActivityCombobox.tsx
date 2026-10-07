import { Search, X } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { api, type AnaeActivityResult } from '@/api'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface ActivityComboboxProps {
  id: string
  value: string | undefined
  onChange: (code: string) => void
  onBlur?: () => void
  invalid?: boolean
  describedBy?: string
  /** Show "what you'll be able to accept" for the selected activity. */
  showCategories?: boolean
}

export function useActivity(code: string | undefined) {
  const [activity, setActivity] = React.useState<AnaeActivityResult | null>(null)
  React.useEffect(() => {
    let live = true
    if (!code) {
      setActivity(null)
      return
    }
    void api.searchAnaeActivities(code).then((r) => {
      if (live && r.ok) setActivity(r.data.find((a) => a.code === code) ?? null)
    })
    return () => {
      live = false
    }
  }, [code])
  return activity
}

/** ANAE nomenclature picker: search by code or name, no free text, selection shown as a removable chip. */
export function ActivityCombobox({ id, value, onChange, onBlur, invalid, describedBy, showCategories }: ActivityComboboxProps) {
  const { t, i18n } = useTranslation()
  const selected = useActivity(value)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<AnaeActivityResult[]>([])
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const listId = `${id}-list`
  const label = (a: AnaeActivityResult) => (i18n.language === 'ar' ? a.labelAr : a.labelFr)

  React.useEffect(() => {
    if (!open) return
    let live = true
    setLoading(true)
    const h = setTimeout(() => {
      void api.searchAnaeActivities(query).then((r) => {
        if (!live) return
        setLoading(false)
        setResults(r.ok ? r.data : [])
        setActive(0)
      })
    }, 150)
    return () => {
      live = false
      clearTimeout(h)
    }
  }, [query, open])

  function choose(a: AnaeActivityResult) {
    onChange(a.code)
    setOpen(false)
    setQuery('')
  }

  if (value) {
    return (
      <div className="grid gap-3">
        <div id={id} tabIndex={-1} className="flex min-h-12 items-center justify-between gap-2 rounded-[10px] border border-input bg-white ps-3.5 pe-1.5">
          <span className="min-w-0 text-base">
            <span className="font-mono text-sm text-ink-2">{value}</span>
            {selected && <span className="ms-2" dir="auto">{label(selected)}</span>}
          </span>
          <button
            type="button"
            aria-label={t('ui.activity.remove')}
            onClick={() => onChange('')}
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {showCategories && selected && (
          <div className="rounded-xl bg-surface p-4" data-testid="accept-summary">
            <p className="text-sm font-semibold">{t('ui.activity.canAccept')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {selected.paymentCategories.map((c) => (
                <li key={c} className="rounded-full border border-line bg-white px-3 py-1 text-sm">
                  {t(`categories.${c}`)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-2" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={t('ui.activity.placeholder')}
        className="ps-11"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120)
          onBlur?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((i) => Math.min(i + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && open && results[active]) {
            e.preventDefault()
            choose(results[active])
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('ui.activity.results')}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[10px] border border-line bg-white shadow-lg"
        >
          {loading && results.length === 0 && <li className="px-3.5 py-3 text-sm text-ink-2">{t('ui.loading')}</li>}
          {!loading && results.length === 0 && <li className="px-3.5 py-3 text-sm text-ink-2">{t('ui.activity.none')}</li>}
          {results.map((a, i) => (
            <li
              key={a.code}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(a)
              }}
              className={cn('flex min-h-11 cursor-pointer items-center gap-2 px-3.5 py-2 text-base', i === active && 'bg-[#eef4f7]')}
            >
              <span className="font-mono text-sm text-ink-2">{a.code}</span>
              <span dir="auto">{label(a)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
