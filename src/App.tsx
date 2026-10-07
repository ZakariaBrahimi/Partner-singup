import { useTranslation } from 'react-i18next'

export default function App() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-[760px] p-8">
      <h1 className="text-2xl font-bold">{t('steps.type.title')}</h1>
      <p className="text-ink-2">{t('steps.type.intro')}</p>
    </main>
  )
}
