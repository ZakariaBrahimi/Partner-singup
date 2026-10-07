import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { api, type SubmissionDetail } from '@/api'
import { Field } from '@/components/form/Field'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { errorText } from '@/lib/errors'
import { REJECTION_REASONS, type RejectionReasonCode } from '@/shared/config/reasons'
import { flaggableFields } from '@/shared/schema'

interface Common {
  open: boolean
  onOpenChange: (o: boolean) => void
  detail: SubmissionDetail
  /** Called with the updated detail after a successful action. */
  onDone: (d: SubmissionDetail) => void
}

function useAction() {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  return { busy, setBusy, error, setError }
}

export function ApproveDialog({ open, onOpenChange, detail, onDone }: Common) {
  const { t } = useTranslation()
  const a = useAction()
  const done = detail.checklistKeys.filter((k) => detail.checklist[k]).length
  async function run() {
    a.setBusy(true)
    a.setError(null)
    const r = await api.admin.approve(detail.id)
    a.setBusy(false)
    if (r.ok) {
      onOpenChange(false)
      onDone(r.data)
    } else a.setError(r.error === 'INVALID_STATE' ? 'invalidState' : 'network')
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('admin.approve.title')}</DialogTitle>
        <DialogDescription>{t('admin.approve.body', { level: detail.kycLevel })}</DialogDescription>
        {done < detail.checklistKeys.length && (
          <Alert tone="warning" className="mt-4">{t('admin.approve.checklistWarn', { done, total: detail.checklistKeys.length })}</Alert>
        )}
        {detail.contract.required && !detail.isUpgrade && <Alert tone="info" className="mt-4">{t('admin.approve.contractNote')}</Alert>}
        {a.error && <Alert tone="error" className="mt-4">{t(`errors.${a.error}`)}</Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('ui.cancel')}</Button>
          <Button onClick={() => void run()} disabled={a.busy} aria-busy={a.busy}>
            {a.busy && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {t('admin.approve.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RejectDialog({ open, onOpenChange, detail, onDone }: Common) {
  const { t } = useTranslation()
  const a = useAction()
  const [code, setCode] = React.useState('')
  const [text, setText] = React.useState('')
  const [flagged, setFlagged] = React.useState<string[]>([])
  const [errors, setErrors] = React.useState<{ code?: string; text?: string }>({})
  const fields = flaggableFields(detail.draft)

  async function run() {
    const next: typeof errors = {}
    if (!code) next.code = 'required'
    if (!text.trim()) next.text = 'required'
    setErrors(next)
    if (Object.keys(next).length) return
    a.setBusy(true)
    a.setError(null)
    const r = await api.admin.reject(detail.id, { code: code as RejectionReasonCode, text, flaggedFields: flagged })
    a.setBusy(false)
    if (r.ok) {
      onOpenChange(false)
      onDone(r.data)
    } else if (r.fieldErrors) setErrors(r.fieldErrors)
    else a.setError(r.error === 'INVALID_STATE' ? 'invalidState' : 'network')
  }

  const msg = (c?: string) => (c ? errorText(t, c) : null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{t('admin.reject.title')}</DialogTitle>
        <DialogDescription>{t('admin.reject.body')}</DialogDescription>
        <div className="mt-4 grid gap-4">
          <Field name="reject-code" label={t('admin.reject.reason')} error={msg(errors.code)} required>
            {(aria) => (
              <Select {...aria} value={code} onChange={(e) => setCode(e.target.value)}>
                <option value="">{t('ui.choose')}</option>
                {REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>{t(`reasons.${r}`)}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field name="reject-text" label={t('admin.reject.text')} hint={t('admin.reject.textHint')} error={msg(errors.text)} required>
            {(aria) => <Textarea {...aria} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">{t('admin.reject.flagged')}</legend>
            <p className="text-sm text-ink-2">{t('admin.reject.flaggedHint')}</p>
            <div className="grid max-h-56 gap-1 overflow-auto rounded-xl border border-line p-2 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-surface">
                  <Checkbox
                    checked={flagged.includes(f.key)}
                    onCheckedChange={(c) => setFlagged((cur) => (c === true ? [...cur, f.key] : cur.filter((k) => k !== f.key)))}
                  />
                  <span>
                    <span className="text-ink-2">{t(`steps.${f.stepId}.nav`)} › </span>
                    {t(`fields.${f.field}.label`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {a.error && <Alert tone="error" className="mt-4">{t(`errors.${a.error}`)}</Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('ui.cancel')}</Button>
          <Button variant="destructive" onClick={() => void run()} disabled={a.busy} aria-busy={a.busy}>
            {a.busy && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {t('admin.reject.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContractDialog({ open, onOpenChange, detail, onDone }: Common) {
  const { t } = useTranslation()
  const a = useAction()
  async function run() {
    a.setBusy(true)
    a.setError(null)
    const r = await api.admin.markContractSigned(detail.id)
    a.setBusy(false)
    if (r.ok) {
      onOpenChange(false)
      onDone(r.data)
    } else a.setError(r.error === 'INVALID_STATE' ? 'invalidState' : 'network')
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('admin.contract.title')}</DialogTitle>
        <DialogDescription>{t('admin.contract.body')}</DialogDescription>
        {a.error && <Alert tone="error" className="mt-4">{t(`errors.${a.error}`)}</Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('ui.cancel')}</Button>
          <Button onClick={() => void run()} disabled={a.busy} aria-busy={a.busy}>
            {a.busy && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {t('admin.contract.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
