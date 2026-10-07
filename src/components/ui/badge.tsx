import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', {
  variants: {
    variant: {
      neutral: 'bg-surface text-ink-2 border border-line',
      success: 'bg-[#e3f4ea] text-success',
      danger: 'bg-[#fdeceb] text-danger',
      warning: 'bg-warn-bg text-warn-ink border border-warn-border',
      info: 'bg-[#e4eef3] text-primary',
      accent: 'bg-accent text-ink',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge }
