import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage, type Language } from '@/i18n'
import { cn } from '@/lib/utils'

export function LangSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  return (
    <div role="group" aria-label={t('ui.language')} className={cn('flex gap-1', className)}>
      {LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={i18n.language === l}
          onClick={() => void setLanguage(l as Language)}
          className={cn(
            'min-h-11 min-w-11 rounded-md px-3 text-sm font-bold uppercase',
            i18n.language === l ? 'bg-accent text-ink' : 'text-white hover:bg-white/10',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
