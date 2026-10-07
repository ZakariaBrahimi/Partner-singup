import { FileText, Image as ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { UploadedDocument } from '@/shared/types'

/** Document preview popup. The mock has no file storage, so it shows the file's metadata with a placeholder. */
export function DocPreview({ doc, label, open, onOpenChange }: { doc: UploadedDocument | null; label: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const isPdf = doc?.mime === 'application/pdf'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>{doc ? doc.name : t('admin.detail.docMissing')}</DialogDescription>
        {doc && (
          <div
            className="mt-4 flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface text-ink-2"
            role="img"
            aria-label={t('admin.detail.previewAlt', { name: doc.name })}
          >
            {isPdf ? <FileText aria-hidden className="size-12" /> : <ImageIcon aria-hidden className="size-12" />}
            <span className="text-sm">{t('admin.detail.previewMock')}</span>
            <span className="text-xs">{doc.mime} · {Math.max(1, Math.round(doc.size / 1024))} KB</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
