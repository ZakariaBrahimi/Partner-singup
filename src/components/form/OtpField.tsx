import { BadgeCheck, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validateFormat } from '@/shared/validators'

export interface OtpFieldProps {
  id: string
  kind: 'email' | 'phone'
  value: string
  verified: boolean
  onChange: (value: string) => void
  onBlur: () => void
  onVerifiedChange: (verified: boolean) => void
  invalid?: boolean
  describedBy?: string
  required?: boolean
}

type Phase = 'idle' | 'sending' | 'sent' | 'verifying'

/**
 * Email / phone with a 6-digit OTP. Phone shows a fixed +213 prefix.
 * trigger (Send code) -> loading -> code input -> trigger (Verify) -> loading -> verified | inline error.
 */
export function OtpField({ id, kind, value, verified, onChange, onBlur, onVerifiedChange, invalid, describedBy, required }: OtpFieldProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [code, setCode] = React.useState('')
  const [otpError, setOtpError] = React.useState<string | null>(null)
  const formatOk = value.trim() !== '' && !validateFormat(kind, value)

  async function send() {
    setOtpError(null)
    setPhase('sending')
    const r = await api.sendOtp({ channel: kind === 'email' ? 'EMAIL' : 'PHONE', value })
    if (r.ok) {
      setPhase('sent')
      setCode('')
    } else {
      setPhase('idle')
      setOtpError('network')
    }
  }

  async function verify() {
    setOtpError(null)
    setPhase('verifying')
    const r = await api.verifyOtp({ channel: kind === 'email' ? 'EMAIL' : 'PHONE', value, code })
    if (r.ok) {
      setPhase('idle')
      onVerifiedChange(true)
    } else {
      setPhase('sent')
      setOtpError(r.error === 'OTP_INVALID' ? 'otpInvalid' : 'network')
    }
  }

  const input = (
    <Input
      id={id}
      type={kind === 'email' ? 'email' : 'tel'}
      inputMode={kind === 'email' ? 'email' : 'numeric'}
      autoComplete={kind === 'email' ? 'email' : 'tel-national'}
      dir="ltr"
      value={value}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      className={kind === 'phone' ? 'rounded-s-none' : undefined}
      onChange={(e) => {
        onChange(e.target.value)
        if (verified) onVerifiedChange(false)
        if (phase !== 'idle') setPhase('idle')
      }}
      onBlur={onBlur}
    />
  )

  return (
    <div className="grid gap-2">
      {kind === 'phone' ? (
        <div className="flex" dir="ltr">
          <span className="flex h-12 items-center rounded-s-[10px] border border-e-0 border-input bg-surface px-3 font-mono text-base text-ink-2">+213</span>
          <div className="min-w-0 flex-1">{input}</div>
        </div>
      ) : (
        input
      )}

      {verified ? (
        <Badge variant="success" className="w-fit">
          <BadgeCheck aria-hidden className="size-4" />
          {t('ui.otp.verified')}
        </Badge>
      ) : (
        <div className="grid gap-2">
          {phase === 'idle' || phase === 'sending' ? (
            <Button variant="outline" size="sm" className="w-fit" onClick={send} disabled={!formatOk || phase === 'sending'} aria-busy={phase === 'sending'}>
              {phase === 'sending' && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {t('ui.otp.send')}
            </Button>
          ) : (
            <div className="grid gap-2">
              <label htmlFor={`${id}-code`} className="text-sm font-semibold">
                {t('ui.otp.enter', { target: kind === 'email' ? t('ui.otp.yourEmail') : t('ui.otp.yourPhone') })}
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id={`${id}-code`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  dir="ltr"
                  className="w-40 text-center font-mono tracking-[0.35em]"
                  value={code}
                  aria-invalid={otpError === 'otpInvalid' || undefined}
                  aria-describedby={otpError ? `${id}-code-error` : undefined}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <Button size="sm" onClick={verify} disabled={code.length !== 6 || phase === 'verifying'} aria-busy={phase === 'verifying'}>
                  {phase === 'verifying' && <Loader2 aria-hidden className="size-4 animate-spin" />}
                  {t('ui.otp.verify')}
                </Button>
                <Button variant="ghost" size="sm" onClick={send}>
                  {t('ui.otp.resend')}
                </Button>
              </div>
            </div>
          )}
          {otpError && (
            <p id={`${id}-code-error`} role="alert" className="text-sm font-medium text-danger">
              {t(`errors.${otpError}`)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
