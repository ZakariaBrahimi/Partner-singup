import { Camera, CircleAlert, FileCheck2, RefreshCw, Upload } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { UPLOAD_LIMITS } from '@/shared/config/steps'
import type { UploadedDocument } from '@/shared/types'
import { cn } from '@/lib/utils'
import { errorText } from '@/lib/errors'
import { SelfieCapture } from './SelfieCapture'

type TileState = 'empty' | 'uploading' | 'uploaded' | 'error'

const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' }

export interface UploadTileProps {
  id: string
  docType: string
  accept: Array<'jpg' | 'png' | 'pdf'>
  value: UploadedDocument | null | undefined
  onChange: (doc: UploadedDocument | null) => void
  camera?: boolean
  compact?: boolean
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  label: string
}

const API_ERR: Record<string, string> = {
  FILE_TOO_LARGE: 'fileTooLarge',
  FILE_TYPE: 'fileType',
  UPLOAD_FAILED: 'uploadFailed',
}

/** empty -> uploading (progress) -> uploaded (filename + Replace) | error (message + Retry). */
export function UploadTile({ id, docType, accept, value, onChange, camera, compact, invalid, describedBy, disabled, label }: UploadTileProps) {
  const { t } = useTranslation()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [pct, setPct] = React.useState(0)
  const [errorCode, setErrorCode] = React.useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = React.useState(false)
  const [lastFile, setLastFile] = React.useState<File | null>(null)

  const state: TileState = uploading ? 'uploading' : errorCode ? 'error' : value ? 'uploaded' : 'empty'
  const acceptAttr = accept.map((a) => MIME[a]).join(',')

  async function upload(file: File) {
    setLastFile(file)
    setErrorCode(null)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = accept.map((a) => (a === 'jpg' ? ['jpg', 'jpeg'] : [a])).flat()
    if (!allowed.includes(ext) && !accept.map((a) => MIME[a]).includes(file.type)) return setErrorCode('fileType')
    if (file.size > UPLOAD_LIMITS.maxBytes) return setErrorCode('fileTooLarge')
    setUploading(true)
    setPct(0)
    const r = await api.uploadDocument({ file: { name: file.name, size: file.size, type: file.type }, docType, onProgress: setPct })
    setUploading(false)
    if (r.ok) onChange(r.data)
    else setErrorCode(API_ERR[r.error] ?? 'network')
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) void upload(f)
  }

  const open = () => inputRef.current?.click()

  return (
    <div
      data-slot="upload-tile"
      data-state={state}
      className={cn(
        'rounded-[12px] border-2 border-dashed bg-white p-4',
        invalid || state === 'error' ? 'border-danger' : state === 'uploaded' ? 'border-success border-solid' : 'border-input',
        compact && 'p-3',
      )}
    >
      <input ref={inputRef} type="file" tabIndex={-1} className="sr-only" accept={acceptAttr} onChange={pick} aria-hidden data-testid={`${id}-input`} />

      {state === 'empty' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            id={id}
            variant="outline"
            size="sm"
            onClick={open}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-label={`${t('ui.upload.choose')}: ${label}`}
          >
            <Upload aria-hidden className="size-4" />
            {t('ui.upload.choose')}
          </Button>
          {camera && (
            <Button variant="outline" size="sm" onClick={() => setCameraOpen(true)} disabled={disabled}>
              <Camera aria-hidden className="size-4" />
              {t('ui.upload.takeSelfie')}
            </Button>
          )}
          <span className="text-xs text-ink-2">{t(accept.includes('pdf') ? (accept.length === 1 ? 'ui.upload.rulesPdf' : 'ui.upload.rules') : 'ui.upload.rulesImg')}</span>
        </div>
      )}

      {state === 'uploading' && (
        <div role="status" aria-live="polite" className="grid gap-2">
          <span className="text-sm font-medium">{t('ui.upload.uploading', { name: lastFile?.name })}</span>
          <Progress value={pct} aria-label={t('ui.upload.progress')} />
          <span className="text-xs text-ink-2">{pct}%</span>
        </div>
      )}

      {state === 'uploaded' && value && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-success">
            <FileCheck2 aria-hidden className="size-5 shrink-0" />
            <span className="truncate text-ink" dir="auto">{value.name}</span>
          </span>
          <Button id={id} variant="ghost" size="sm" onClick={open} disabled={disabled} aria-describedby={describedBy}>
            <RefreshCw aria-hidden className="size-4" />
            {t('ui.upload.replace')}
          </Button>
        </div>
      )}

      {state === 'error' && errorCode && (
        <div className="grid gap-2">
          <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {errorText(t, errorCode)}
          </p>
          <div className="flex gap-2">
            {lastFile && errorCode !== 'fileType' && errorCode !== 'fileTooLarge' && (
              <Button variant="outline" size="sm" onClick={() => lastFile && void upload(lastFile)}>
                {t('ui.upload.retry')}
              </Button>
            )}
            <Button id={id} variant="ghost" size="sm" onClick={open} aria-describedby={describedBy}>
              {t('ui.upload.choose')}
            </Button>
          </div>
        </div>
      )}

      {camera && (
        <SelfieCapture
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(f) => {
            setCameraOpen(false)
            void upload(f)
          }}
          onFallback={() => {
            setCameraOpen(false)
            open()
          }}
        />
      )}
    </div>
  )
}
