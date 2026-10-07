import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'

/** Camera capture via getUserMedia, with a file-picker fallback when the camera is unavailable. */
export function SelfieCapture({
  open,
  onOpenChange,
  onCapture,
  onFallback,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCapture: (file: File) => void
  onFallback: () => void
}) {
  const { t } = useTranslation()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setReady(false)
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!md?.getUserMedia) {
      setError('camera')
      return
    }
    md.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((x) => x.stop())
        streamRef.current = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          void videoRef.current.play().catch(() => undefined)
        }
        setReady(true)
      })
      .catch(() => setError('camera'))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((x) => x.stop())
      streamRef.current = null
    }
  }, [open])

  function snap() {
    const v = videoRef.current
    if (!v) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth || 640
    c.height = v.videoHeight || 480
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob((b) => b && onCapture(new File([b], 'selfie.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('ui.selfie.title')}</DialogTitle>
        <DialogDescription>{t('ui.selfie.hint')}</DialogDescription>
        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {t('ui.selfie.unavailable')}
          </p>
        ) : (
          <video ref={videoRef} playsInline muted className="mt-4 aspect-[4/3] w-full rounded-xl bg-ink object-cover" aria-label={t('ui.selfie.preview')} />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onFallback}>
            {t('ui.upload.choose')}
          </Button>
          {!error && (
            <Button onClick={snap} disabled={!ready}>
              {t('ui.selfie.capture')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
