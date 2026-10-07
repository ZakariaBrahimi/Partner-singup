import * as React from 'react'
import { cn } from '@/lib/utils'

// 48px high, 10px radius. Error state: 2px red border (the icon + message live in <Field>).
function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-[10px] border border-input bg-white px-3.5 text-base text-ink placeholder:text-ink-2',
        'disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70',
        'aria-invalid:border-2 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
