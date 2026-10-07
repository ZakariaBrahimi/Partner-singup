import { CircleAlert } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { fieldIds } from './Field'

export interface SummaryItem {
  /** Field name; the link focuses the control with id f-<name>. */
  name: string
  label: string
  message: string
  /** Optional: link elsewhere (e.g. another step on the review screen) instead of focusing a field. */
  href?: string
}

/**
 * Error summary at the top of a step. Receives focus when it appears so keyboard and screen-reader
 * users land on it, and each item jumps to the field that caused it.
 */
export function ErrorSummary({ items, focusKey }: { items: SummaryItem[]; focusKey: number }) {
  const { t } = useTranslation()
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (items.length) ref.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey])
  if (!items.length) return null

  const jump = (e: React.MouseEvent, name: string) => {
    e.preventDefault()
    const el = document.getElementById(fieldIds(name).id) ?? document.querySelector<HTMLElement>(`[data-field="${name}"] button, [data-field="${name}"] input`)
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-card border-2 border-danger bg-[#fdeceb] p-5 text-danger"
    >
      <h2 id="error-summary-title" className="flex items-center gap-2 text-base font-bold">
        <CircleAlert aria-hidden className="size-5" />
        {t('ui.errorSummaryTitle', { count: items.length })}
      </h2>
      <ul className="mt-2 list-disc ps-6 text-sm">
        {items.map((i) => (
          <li key={i.name}>
            <a href={i.href ?? `#${fieldIds(i.name).id}`} onClick={i.href ? undefined : (e) => jump(e, i.name)} className="font-semibold underline">
              {i.label}
            </a>
            : {i.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
