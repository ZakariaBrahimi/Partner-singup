import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { PageHeader, PortalLayout, StepFooter } from '@/components/layout/PortalLayout'
import { helperResult, type HelperAnswers } from '@/shared/flow'
import { useSignup } from './SignupContext'
import { useSteps } from './useSteps'

const QUESTIONS = ['rc', 'ram', 'anae'] as const

/** "Help me choose": up to 3 yes/no questions. First "yes" preselects the matching type; three "no" = dead end. */
export function Helper() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const s = useSignup()
  const [answers, setAnswers] = React.useState<HelperAnswers>({})
  const { items } = useSteps('type')
  const idx = QUESTIONS.findIndex((q) => answers[q] === undefined)
  const q = QUESTIONS[idx === -1 ? 0 : idx]

  async function answer(yes: boolean) {
    const next = { ...answers, [q]: yes }
    const r = helperResult(next)
    if (r === 'NONE') return nav('/signup/no-legal-status')
    if (r) {
      await s.selectType(r)
      return nav('/signup', { state: { suggested: true } })
    }
    setAnswers(next)
  }

  return (
    <PortalLayout steps={items}>
      <PageHeader eyebrow={t('ui.helper.progress', { n: Math.max(idx, 0) + 1, m: QUESTIONS.length })} title={t('ui.helper.title')} intro={t('ui.helper.intro')} />
      <Card>
        <CardTitle id="helper-q">{t(`ui.helper.q.${q}`)}</CardTitle>
        <p className="mb-5 text-sm text-ink-2">{t(`ui.helper.hint.${q}`)}</p>
        <div role="group" aria-labelledby="helper-q" className="grid gap-3 sm:grid-cols-2">
          <Button onClick={() => void answer(true)}>{t('ui.yes')}</Button>
          <Button variant="outline" onClick={() => void answer(false)}>{t('ui.no')}</Button>
        </div>
      </Card>
      <StepFooter>
        <Button asChild variant="outline">
          <Link to="/signup">{t('ui.back')}</Link>
        </Button>
        <span />
      </StepFooter>
    </PortalLayout>
  )
}
