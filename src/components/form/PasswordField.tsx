import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { passwordStrength } from '@/shared/validators'

const COLORS = ['bg-line', 'bg-danger', 'bg-[#c27a00]', 'bg-[#6a9a2a]', 'bg-success']

export function PasswordMeter({ value }: { value: string }) {
  const { t } = useTranslation()
  const s = passwordStrength(value)
  return (
    <div className="grid gap-1" data-testid="password-meter" data-strength={s}>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= s ? COLORS[s] : 'bg-line')} />
        ))}
      </div>
      <p className="text-xs text-ink-2" aria-live="polite">
        {t('ui.pw.label')}: <span className="font-semibold text-ink">{t(`ui.pw.level${s}`)}</span>
      </p>
    </div>
  )
}

export interface PasswordFieldProps extends Omit<React.ComponentProps<'input'>, 'type' | 'value'> {
  value: string
}

export function PasswordField({ value, className, ...props }: PasswordFieldProps) {
  const { t } = useTranslation()
  const [show, setShow] = React.useState(false)
  return (
    <div className="grid gap-2">
      <div className="relative">
        <Input {...props} value={value} type={show ? 'text' : 'password'} autoComplete="new-password" dir="ltr" className={cn('pe-14', className)} />
        <button
          type="button"
          aria-pressed={show}
          aria-label={show ? t('ui.pw.hide') : t('ui.pw.show')}
          onClick={() => setShow((s) => !s)}
          className="absolute end-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-2 hover:bg-surface"
        >
          {show ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
        </button>
      </div>
      <PasswordMeter value={value} />
    </div>
  )
}
