import { AlertTriangle, CircleAlert, Info, CircleCheck } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export type AlertTone = 'info' | 'warning' | 'error' | 'success'

const TONES: Record<AlertTone, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-line bg-[#eef4f7] text-ink', Icon: Info },
  warning: { box: 'border-warn-border bg-warn-bg text-warn-ink', Icon: AlertTriangle },
  error: { box: 'border-danger bg-[#fdeceb] text-danger', Icon: CircleAlert },
  success: { box: 'border-success bg-[#e3f4ea] text-success', Icon: CircleCheck },
}

/** Inline notice. Use role="alert" only for errors that appear after an action. */
function Alert({
  tone = 'info',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { tone?: AlertTone }) {
  const { box, Icon } = TONES[tone]
  return (
    <div
      data-slot="alert"
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('flex gap-3 rounded-[12px] border p-4 text-sm', box, className)}
      {...props}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
export { Alert }
