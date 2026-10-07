import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioItem } from '@/components/ui/radio-group'
import { AML_QUESTION_KEYS, type AmlStatus } from '@/shared/config/tbd'

export interface AmlValue {
  status: AmlStatus
  answers: Record<string, 'YES' | 'NO'>
}

export function statusOf(answers: AmlValue['answers']): AmlStatus {
  const n = AML_QUESTION_KEYS.filter((k) => answers[k]).length
  return n === 0 ? 'NOT_STARTED' : n === AML_QUESTION_KEYS.length ? 'DONE' : 'IN_PROGRESS'
}

const VARIANT = { NOT_STARTED: 'neutral', IN_PROGRESS: 'warning', DONE: 'success' } as const

/** AML questionnaire with a Not started / In progress / Done status. */
export function AmlQuestionnaire({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string
  value: AmlValue | undefined
  onChange: (v: AmlValue) => void
  invalid?: boolean
  describedBy?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<AmlValue['answers']>(value?.answers ?? {})
  const status = value?.status ?? 'NOT_STARTED'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-input bg-white p-4" data-state={status}>
      <Badge variant={VARIANT[status]} data-testid="aml-status">{t(`ui.aml.status.${status}`)}</Badge>
      <Button
        id={id}
        variant="outline"
        size="sm"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          setDraft(value?.answers ?? {})
          setOpen(true)
        }}
      >
        {status === 'NOT_STARTED' ? t('ui.aml.start') : t('ui.aml.continue')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t('fields.amlQuestionnaire.label')}</DialogTitle>
          <DialogDescription>{t('ui.aml.intro')}</DialogDescription>
          <div className="mt-4 grid gap-5">
            {AML_QUESTION_KEYS.map((k) => (
              <fieldset key={k} className="grid gap-2">
                <legend className="mb-1 text-sm font-semibold">{t(`ui.aml.q.${k}`)}</legend>
                <RadioGroup
                  className="grid-cols-2"
                  value={draft[k] ?? ''}
                  onValueChange={(v) => setDraft((d) => ({ ...d, [k]: v as 'YES' | 'NO' }))}
                  aria-label={t(`ui.aml.q.${k}`)}
                >
                  <RadioItem value="YES">{t('ui.yes')}</RadioItem>
                  <RadioItem value="NO">{t('ui.no')}</RadioItem>
                </RadioGroup>
              </fieldset>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('ui.cancel')}</Button>
            <Button
              onClick={() => {
                onChange({ status: statusOf(draft), answers: draft })
                setOpen(false)
              }}
            >
              {t('ui.aml.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
