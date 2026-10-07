import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-24 w-full rounded-[10px] border border-input bg-white px-3.5 py-3 text-base text-ink aria-invalid:border-2 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}
export { Textarea }
