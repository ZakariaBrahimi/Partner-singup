import { ChevronDown } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

// Native <select> with shadcn styling: best a11y and mobile behaviour for long lists (58 wilayas).
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'h-12 w-full appearance-none rounded-[10px] border border-input bg-white ps-3.5 pe-10 text-base text-ink',
          'aria-invalid:border-2 aria-invalid:border-danger disabled:bg-surface disabled:opacity-70',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-ink-2" />
    </div>
  )
}
export { Select }
