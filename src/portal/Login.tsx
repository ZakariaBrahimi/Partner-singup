import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { DEMO_PASSWORD } from '@/api'
import { ErrorSummary } from '@/components/form/ErrorSummary'
import { Field } from '@/components/form/Field'
import { PageHeader, PortalLayout, StepFooter } from '@/components/layout/PortalLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/api'
import { resumeStep } from '@/shared/flow'
import { firstIncompleteStep } from '@/shared/schema'
import { useSignup } from './SignupContext'
import { stepPath } from './useSteps'

const DEMO = [
  ['ae.demo@mizaniya.dz', 'AE approved'],
  ['company.approved@mizaniya.dz', 'Company approved'],
  ['enterprise.approved@mizaniya.dz', 'Enterprise, contract pending'],
  ['trader.rejected@mizaniya.dz', 'Trader rejected'],
  ['trader.pending@mizaniya.dz', 'Trader pending review'],
  ['ae.draft@mizaniya.dz', 'AE draft (resumes at step 3)'],
] as const

export function Login() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const s = useSignup()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [errors, setErrors] = React.useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = React.useState(false)
  const [key, setKey] = React.useState(0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'required'
    if (!password) next.password = 'required'
    if (Object.keys(next).length) {
      setErrors(next)
      return setKey((k) => k + 1)
    }
    setBusy(true)
    const r = await s.login(email, password)
    setBusy(false)
    if (!r.ok) {
      setErrors({ password: r.error === 'INVALID_CREDENTIALS' ? 'invalidCredentials' : 'network' })
      return setKey((k) => k + 1)
    }
    // DRAFT resumes at the last completed step; submitted partners see their status.
    if (r.data.status === 'DRAFT') {
      const d = await api.getDraft()
      const target = d.ok ? (r.data.isUpgrade ? firstIncompleteStep(d.data.draft) : resumeStep(d.data.draft)) : 'type'
      nav(stepPath(target), { replace: true })
    } else nav('/status', { replace: true })
  }

  const msg = (c?: string) => (c ? t(`errors.${c}`) : null)
  const items = [
    ...(errors.email ? [{ name: 'login-email', label: t('fields.email.label'), message: msg(errors.email)! }] : []),
    ...(errors.password ? [{ name: 'login-password', label: t('fields.password.label'), message: msg(errors.password)! }] : []),
  ]

  return (
    <PortalLayout>
      <PageHeader title={t('ui.login.title')} intro={t('ui.login.intro')} />
      <ErrorSummary items={items} focusKey={key} />
      <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-6">
        <Card className="grid gap-5">
          <Field name="login-email" label={t('fields.email.label')} error={msg(errors.email)}>
            {(aria) => <Input {...aria} type="email" dir="ltr" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field name="login-password" label={t('fields.password.label')} error={msg(errors.password)}>
            {(aria) => <LoginPassword aria={aria} value={password} onChange={setPassword} />}
          </Field>
        </Card>
        <StepFooter>
          <Button asChild variant="outline"><Link to="/signup">{t('ui.login.newPartner')}</Link></Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {t('ui.login.cta')}
          </Button>
        </StepFooter>
      </form>
      <Alert tone="info">
        <p className="font-semibold">{t('ui.login.demoTitle')}</p>
        <p className="mb-2">{t('ui.login.demoBody', { password: DEMO_PASSWORD })}</p>
        <ul className="grid gap-1">
          {DEMO.map(([em, d]) => (
            <li key={em}>
              <button type="button" className="min-h-11 text-start underline" onClick={() => { setEmail(em); setPassword(DEMO_PASSWORD) }}>
                <span className="font-mono text-xs">{em}</span> – {d}
              </button>
            </li>
          ))}
        </ul>
      </Alert>
    </PortalLayout>
  )
}

function LoginPassword({ aria, value, onChange }: { aria: Record<string, unknown>; value: string; onChange: (v: string) => void }) {
  // Login does not show the strength meter, so use a plain password input.
  return <Input {...aria} type="password" dir="ltr" autoComplete="current-password" value={value} onChange={(e) => onChange(e.target.value)} />
}
