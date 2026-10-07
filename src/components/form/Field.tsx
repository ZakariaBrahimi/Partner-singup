import { CircleAlert, TriangleAlert } from 'lucide-react'
import * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Ids used to wire label, hint and error to the control. */
export const fieldIds = (name: string) => ({
  id: `f-${name}`,
  hintId: `f-${name}-hint`,
  errorId: `f-${name}-error`,
  warnId: `f-${name}-warn`,
})

export interface FieldProps {
  name: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string | null
  warning?: string | null
  required?: boolean
  /** Rendered after the control, e.g. a "checking" indicator. */
  status?: React.ReactNode
  /** Use a fieldset/legend (radio groups, file tiles) instead of a label. */
  group?: boolean
  children: (aria: {
    id: string
    'aria-invalid': true | undefined
    'aria-describedby': string | undefined
    'aria-required': true | undefined
  }) => React.ReactNode
  className?: string
}

/**
 * Label + control + hint + inline error. Error state: the control gets `aria-invalid`
 * (2px red border from the Input styles), and the message shows an icon and is linked via
 * `aria-describedby`. No toast anywhere.
 */
export function Field({ name, label, hint, error, warning, required, status, group, children, className }: FieldProps) {
  const ids = fieldIds(name)
  const described = [hint ? ids.hintId : null, error ? ids.errorId : null, warning ? ids.warnId : null].filter(Boolean).join(' ') || undefined
  const control = children({
    id: ids.id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': described,
    'aria-required': required ? true : undefined,
  })
  const Wrapper = group ? 'fieldset' : 'div'
  return (
    <Wrapper className={cn('grid gap-1.5', className)} data-field={name} aria-describedby={group ? described : undefined}>
      {group ? (
        <legend className="mb-1.5 text-sm font-semibold text-ink">{label}</legend>
      ) : (
        <Label htmlFor={ids.id}>{label}</Label>
      )}
      {hint && (
        <p id={ids.hintId} className="text-sm text-ink-2">
          {hint}
        </p>
      )}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{control}</div>
        {status}
      </div>
      {error && (
        <p id={ids.errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {warning && !error && (
        <p id={ids.warnId} className="flex items-start gap-1.5 rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{warning}</span>
        </p>
      )}
    </Wrapper>
  )
}
