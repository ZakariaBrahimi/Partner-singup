import * as React from 'react'
import { cn } from '@/lib/utils'

// 16px radius, 28px padding, #DCE3E7 border.
function Card({ className, ...props }: React.ComponentProps<'section'>) {
  return <section data-slot="card" className={cn('rounded-card border border-line bg-white p-7', className)} {...props} />
}
function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('mb-4 text-lg font-bold text-ink', className)} {...props} />
}
export { Card, CardTitle }
