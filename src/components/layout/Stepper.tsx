import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface StepperItem {
  id: string
  label: string
  state: 'done' | 'current' | 'upcoming'
  href?: string
}

/** Vertical stepper: done (yellow check), current (highlighted row), upcoming (outlined number). */
export function Stepper({ items, label }: { items: StepperItem[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ol className="grid gap-1">
        {items.map((s, i) => {
          const inner = (
            <>
              <span
                aria-hidden
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  s.state === 'done' && 'bg-accent text-ink',
                  s.state === 'current' && 'bg-white text-primary',
                  s.state === 'upcoming' && 'border-2 border-white/60 text-white',
                )}
              >
                {s.state === 'done' ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('text-start text-[15px]', s.state === 'current' ? 'font-bold' : 'font-medium')}>{s.label}</span>
              <span className="sr-only">{s.state === 'done' ? ' ✓' : ''}</span>
            </>
          )
          const cls = cn(
            'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-white',
            s.state === 'current' && 'bg-white/15',
            s.state === 'upcoming' && 'text-white/85',
          )
          return (
            <li key={s.id} data-state={s.state} aria-current={s.state === 'current' ? 'step' : undefined}>
              {s.href && s.state !== 'current' ? (
                <Link to={s.href} className={cn(cls, 'hover:bg-white/10')}>{inner}</Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
