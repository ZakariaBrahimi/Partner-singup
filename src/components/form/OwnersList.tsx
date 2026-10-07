import { BadgeCheck, CircleAlert, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BENEFICIAL_OWNER_THRESHOLD_PCT } from '@/shared/config/tbd'
import { ownerErrors } from '@/shared/schema'
import type { BeneficialOwner } from '@/shared/types'
import { errorText } from '@/lib/errors'
import { UploadTile } from './UploadTile'

export interface OwnersListProps {
  id: string
  value: BeneficialOwner[]
  onChange: (owners: BeneficialOwner[]) => void
  showErrors: boolean
  describedBy?: string
}

let n = 0
const newOwner = (): BeneficialOwner => ({ id: `bo_${Date.now().toString(36)}_${n++}`, fullName: '', nin: '', ownershipPct: 0, idDocument: null })

export function OwnersList({ id, value, onChange, showErrors, describedBy }: OwnersListProps) {
  const { t } = useTranslation()
  const errs = ownerErrors(value)
  const patch = (i: number, p: Partial<BeneficialOwner>) => onChange(value.map((o, j) => (j === i ? { ...o, ...p } : o)))

  return (
    <div id={id} tabIndex={-1} className="grid gap-4" aria-describedby={describedBy}>
      <p className="text-sm text-ink-2">{t('ui.owners.threshold', { pct: BENEFICIAL_OWNER_THRESHOLD_PCT })}</p>
      {value.map((o, i) => {
        const e = (k: string) => (showErrors ? errs[`${i}.${k}`] : undefined)
        const idErr = e('idDocument')
        return (
          <div key={o.id} role="group" aria-label={t('ui.owners.ownerN', { n: i + 1 })} className="grid gap-3 rounded-[12px] border border-line p-4" data-testid="owner-row">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{t('ui.owners.ownerN', { n: i + 1 })}</p>
              <div className="flex items-center gap-2">
                {o.idDocument ? (
                  <Badge variant="success"><BadgeCheck aria-hidden className="size-3.5" />{t('ui.owners.idVerified')}</Badge>
                ) : (
                  <Badge variant="warning"><CircleAlert aria-hidden className="size-3.5" />{t('ui.owners.idMissing')}</Badge>
                )}
                <button
                  type="button"
                  aria-label={t('ui.owners.remove', { n: i + 1 })}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="flex size-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface"
                >
                  <Trash2 aria-hidden className="size-5" />
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
              <OwnerInput id={`${id}-${i}-name`} label={t('fields.fullName.label')} error={e('fullName')}>
                {(p) => <Input {...p} value={o.fullName} onChange={(ev) => patch(i, { fullName: ev.target.value })} />}
              </OwnerInput>
              <OwnerInput id={`${id}-${i}-nin`} label={t('fields.nin.label')} error={e('nin')}>
                {(p) => <Input {...p} dir="ltr" inputMode="numeric" className="font-mono" value={o.nin} onChange={(ev) => patch(i, { nin: ev.target.value })} />}
              </OwnerInput>
              <OwnerInput id={`${id}-${i}-pct`} label={t('ui.owners.pct')} error={e('ownershipPct')}>
                {(p) => (
                  <Input {...p} dir="ltr" inputMode="decimal" value={o.ownershipPct ? String(o.ownershipPct) : ''} onChange={(ev) => patch(i, { ownershipPct: Number(ev.target.value.replace(',', '.')) || 0 })} />
                )}
              </OwnerInput>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold">{t('ui.owners.idDoc')}</span>
              <UploadTile
                id={`${id}-${i}-doc`}
                docType="idFront"
                accept={['jpg', 'png', 'pdf']}
                compact
                label={t('ui.owners.idDoc')}
                value={o.idDocument}
                invalid={!!idErr}
                onChange={(d) => patch(i, { idDocument: d })}
              />
              {idErr && <p className="text-sm font-medium text-danger">{errorText(t, idErr)}</p>}
            </div>
          </div>
        )
      })}
      <Button variant="outline" className="w-fit" onClick={() => onChange([...value, newOwner()])}>
        <Plus aria-hidden className="size-4" />
        {t('ui.owners.add')}
      </Button>
    </div>
  )
}

function OwnerInput({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: (p: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-err` : undefined })}
      {error && (
        <p id={`${id}-err`} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {errorText(t, error)}
        </p>
      )}
    </div>
  )
}
