import { CircleCheck, Loader2 } from 'lucide-react'
import * as React from 'react'
import { Controller, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { errorText } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { VOLUME_BANDS } from '@/shared/config/tbd'
import { WILAYAS } from '@/shared/config/wilayas'
import type { FieldDef, FlowContext } from '@/shared/config/schemaTypes'
import type { BeneficialOwner, UploadedDocument } from '@/shared/types'
import { VALIDATORS, type Validator, type ValidatorId } from '@/shared/validators'
import { ActivityCombobox } from './ActivityCombobox'
import { AmlQuestionnaire, type AmlValue } from './AmlQuestionnaire'
import { Field, fieldIds } from './Field'
import { OtpField } from './OtpField'
import { OwnersList } from './OwnersList'
import { PasswordField } from './PasswordField'
import { UploadTile } from './UploadTile'

type DupStatus = 'checking' | 'ok'

/** On-blur duplicate check against existing partners (fixes 869e4xg74: error under the field, never a toast). */
export function useDedupe(form: UseFormReturn<FieldValues>) {
  const [status, setStatus] = React.useState<Record<string, DupStatus | undefined>>({})
  const seq = React.useRef<Record<string, number>>({})

  const check = React.useCallback(
    async (def: FieldDef, name: string, values: Record<string, unknown>) => {
      const key = typeof def.dedupe === 'function' ? def.dedupe(values) : def.dedupe
      const value = values[def.name]
      const set = (s: DupStatus | undefined) => setStatus((p) => ({ ...p, [name]: s }))
      if (!key || typeof value !== 'string' || !value.trim()) return set(undefined)
      const vid = typeof def.validator === 'function' ? def.validator(values) : def.validator
      const fmt = vid ? (VALIDATORS as Record<ValidatorId, Validator>)[vid](value) : null
      if (fmt) return set(undefined) // format error is reported by the schema
      const n = (seq.current[name] = (seq.current[name] ?? 0) + 1)
      set('checking')
      const r = await api.validateField({ field: key, value })
      if (seq.current[name] !== n) return // stale
      if (r.ok && !r.data.valid && r.data.code === 'duplicate') {
        form.setError(name, { type: 'server', message: `duplicate.${key}` })
        set(undefined)
      } else if (r.ok && r.data.valid) set('ok')
      else set(undefined)
    },
    [form],
  )
  return { status, check }
}

const fmtDzd = (n: number, lng: string) => new Intl.NumberFormat(lng === 'ar' ? 'ar-DZ' : lng).format(n)

export interface FieldRendererProps {
  def: FieldDef
  form: UseFormReturn<FieldValues>
  /** Context with live values already merged in (visibility/required are decided by the caller). */
  ctx: FlowContext
  /** react-hook-form path; defaults to def.name. */
  name?: string
  dedupe: ReturnType<typeof useDedupe>
  warning?: string | null
  showCategories?: boolean
  disabled?: boolean
}

export function FieldRenderer({ def, form, name = def.name, dedupe, warning, showCategories, disabled }: FieldRendererProps) {
  const { t, i18n } = useTranslation()
  const submitted = form.formState.isSubmitted
  const errCode = (form.formState.errors as Record<string, { message?: string } | undefined>)[name]?.message as string | undefined
  const hidden = errCode === 'notVerified' && !submitted // don't nag before the code step
  const error = errCode && !hidden ? errorText(t, errCode) : null
  const label = t(`fields.${def.name}.label`)
  const hintKey = `fields.${def.name}.hint`
  const hint = i18n.exists(hintKey) ? t(hintKey) : undefined
  const dup = dedupe.status[name]
  const status =
    dup === 'checking' && !error ? (
      <span role="status" className="flex items-center gap-1 text-xs text-ink-2">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        {t('ui.checking')}
      </span>
    ) : dup === 'ok' && !error ? (
      <CircleCheck aria-label={t('ui.available')} className="size-5 text-success" />
    ) : undefined

  const blur = (onBlur: () => void) => () => {
    onBlur()
    if (!def.dedupe) return
    // Run after react-hook-form's own blur validation, which would otherwise clear the duplicate error.
    void form.trigger(name).then(() => dedupe.check(def, name, form.getValues() as Record<string, unknown>))
  }
  const clearServer = () => {
    if ((form.formState.errors as Record<string, { type?: string } | undefined>)[name]?.type === 'server') form.clearErrors(name)
  }

  // ---- notices -------------------------------------------------------------
  if (def.kind === 'notice') {
    return (
      <Alert tone={def.tone === 'warning' ? 'warning' : 'info'} data-field={name}>
        <p>{label}</p>
        {def.link === 'type-step' && (
          <Link to="/signup" className="mt-1 inline-block min-h-11 py-2.5 font-semibold underline">
            {t(`fields.${def.name}.link`)}
          </Link>
        )}
      </Alert>
    )
  }

  // ---- checkbox ------------------------------------------------------------
  if (def.kind === 'checkbox') {
    const ids = fieldIds(name)
    return (
      <div className="grid gap-1.5" data-field={name}>
        <Controller
          name={name}
          control={form.control}
          render={({ field }) => (
            <div className="flex items-start gap-3">
              <Checkbox
                id={ids.id}
                checked={field.value === true}
                onCheckedChange={(c) => field.onChange(c === true)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? ids.errorId : undefined}
                disabled={disabled}
              />
              <label htmlFor={ids.id} className="text-base leading-6">{label}</label>
            </div>
          )}
        />
        {error && (
          <p id={ids.errorId} className="text-sm font-medium text-danger">{error}</p>
        )}
      </div>
    )
  }

  return (
    <Field name={name} label={label} hint={hint} error={error} warning={warning} status={status} group={['radio', 'file', 'activity', 'owners', 'amlQuestionnaire'].includes(def.kind)}>
      {(aria) => (
        <Controller
          name={name}
          control={form.control}
          render={({ field }) => {
            const v = field.value as unknown
            switch (def.kind) {
              case 'file':
                return (
                  <UploadTile
                    id={aria.id}
                    docType={def.doc!.type}
                    accept={def.doc!.accept}
                    camera={def.doc!.camera}
                    label={label}
                    value={v as UploadedDocument | null | undefined}
                    onChange={(d) => {
                      field.onChange(d)
                      form.clearErrors(name)
                    }}
                    invalid={!!aria['aria-invalid']}
                    describedBy={aria['aria-describedby']}
                    disabled={disabled}
                  />
                )
              case 'radio':
                return (
                  <RadioGroup
                    id={aria.id}
                    value={(v as string) ?? ''}
                    onValueChange={(x) => {
                      field.onChange(x)
                      field.onBlur()
                    }}
                    aria-invalid={aria['aria-invalid']}
                    aria-describedby={aria['aria-describedby']}
                    className={def.options?.length === 2 ? 'sm:grid-cols-2' : def.options?.length === 3 ? 'sm:grid-cols-3' : undefined}
                    disabled={disabled}
                  >
                    {def.options!.map((o) => (
                      <RadioItem key={o} value={o}>{t(`fields.${def.name}.options.${o}`)}</RadioItem>
                    ))}
                  </RadioGroup>
                )
              case 'select':
                return (
                  <Select
                    {...aria}
                    ref={field.ref}
                    value={(v as string) ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    disabled={disabled}
                  >
                    <option value="">{t('ui.choose')}</option>
                    {def.optionsSource === 'wilayas' &&
                      WILAYAS.map((w) => (
                        <option key={w.code} value={w.code}>{w.code} – {i18n.language === 'ar' ? w.ar : w.fr}</option>
                      ))}
                    {def.optionsSource === 'volumeBands' &&
                      VOLUME_BANDS.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.maxDzd === null
                            ? t('ui.band.open', { min: fmtDzd(b.minDzd, i18n.language) })
                            : t('ui.band.range', { min: fmtDzd(b.minDzd, i18n.language), max: fmtDzd(b.maxDzd, i18n.language) })}
                        </option>
                      ))}
                    {!def.optionsSource &&
                      def.options!.map((o) => (
                        <option key={o} value={o}>{t(`fields.${def.name}.options.${o}`)}</option>
                      ))}
                  </Select>
                )
              case 'password':
                return (
                  <PasswordField
                    {...aria}
                    ref={field.ref}
                    value={(v as string) ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    disabled={disabled}
                  />
                )
              case 'email':
              case 'phone':
                if (def.verifiedFlag) {
                  // In the fix-and-resubmit form names are `${step}__${field}`: derive the flag name the same way.
                  const flag = name === def.name ? def.verifiedFlag : name.replace(def.name, def.verifiedFlag)
                  return (
                    <OtpField
                      id={aria.id}
                      kind={def.kind === 'email' ? 'email' : 'phone'}
                      value={(v as string) ?? ''}
                      verified={form.watch(flag) === true}
                      onChange={(x) => {
                        field.onChange(x)
                        clearServer()
                      }}
                      onBlur={blur(field.onBlur)}
                      onVerifiedChange={(ok) => form.setValue(flag, ok, { shouldDirty: true })}
                      invalid={!!aria['aria-invalid']}
                      describedBy={aria['aria-describedby']}
                      required
                    />
                  )
                }
                return (
                  <TextLike def={def} aria={aria} field={field} onBlur={blur(field.onBlur)} onInput={clearServer} disabled={disabled} />
                )
              case 'activity':
                return (
                  <ActivityCombobox
                    id={aria.id}
                    value={v as string | undefined}
                    onChange={(c) => {
                      field.onChange(c)
                      form.clearErrors(name)
                    }}
                    onBlur={field.onBlur}
                    invalid={!!aria['aria-invalid']}
                    describedBy={aria['aria-describedby']}
                    showCategories={showCategories}
                  />
                )
              case 'owners':
                return (
                  <OwnersList
                    id={aria.id}
                    value={(v as BeneficialOwner[] | undefined) ?? []}
                    onChange={(o) => {
                      field.onChange(o)
                      form.clearErrors(name)
                    }}
                    showErrors={submitted}
                    describedBy={aria['aria-describedby']}
                  />
                )
              case 'amlQuestionnaire':
                return (
                  <AmlQuestionnaire
                    id={aria.id}
                    value={v as AmlValue | undefined}
                    onChange={(x) => {
                      field.onChange(x)
                      form.clearErrors(name)
                    }}
                    invalid={!!aria['aria-invalid']}
                    describedBy={aria['aria-describedby']}
                  />
                )
              default:
                return (
                  <TextLike def={def} aria={aria} field={field} onBlur={blur(field.onBlur)} onInput={clearServer} disabled={disabled} />
                )
            }
          }}
        />
      )}
    </Field>
  )
}

function TextLike({
  def,
  aria,
  field,
  onBlur,
  onInput,
  disabled,
}: {
  def: FieldDef
  aria: Record<string, unknown>
  field: { value: unknown; onChange: (v: unknown) => void; ref: React.Ref<HTMLInputElement> }
  onBlur: () => void
  onInput: () => void
  disabled?: boolean
}) {
  const mono = def.kind === 'mono'
  const common = {
    ...aria,
    ref: field.ref,
    value: field.value === undefined || field.value === null ? '' : String(field.value),
    onBlur,
    disabled,
    className: cn(mono && 'font-mono'),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      field.onChange(e.target.value)
      onInput()
    },
  }
  if (def.kind === 'textarea') return <Textarea {...(common as object)} />
  if (def.kind === 'phone')
    return (
      <div className="flex" dir="ltr">
        <span className="flex h-12 items-center rounded-s-[10px] border border-e-0 border-input bg-surface px-3 font-mono text-base text-ink-2">+213</span>
        <Input {...(common as object)} type="tel" inputMode="numeric" className="rounded-s-none" />
      </div>
    )
  return (
    <Input
      {...(common as object)}
      type={def.kind === 'email' ? 'email' : 'text'}
      inputMode={def.kind === 'number' ? 'decimal' : undefined}
      dir={mono || def.kind === 'email' || def.name === 'website' || def.kind === 'number' ? 'ltr' : undefined}
      autoCapitalize={mono ? 'characters' : undefined}
    />
  )
}
