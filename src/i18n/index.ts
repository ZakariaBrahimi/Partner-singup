import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './ar.json'
import en from './en.json'
import fr from './fr.json'

export const LANGUAGES = ['fr', 'ar', 'en'] as const
export type Language = (typeof LANGUAGES)[number]
export const isRtl = (lng: string) => lng === 'ar'

const STORAGE_KEY = 'mizaniya.lang'

function storedLanguage(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && (LANGUAGES as readonly string[]).includes(v)) return v as Language
  } catch {
    /* storage unavailable */
  }
  return 'fr' // default language
}

export function applyDirection(lng: string) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lng
  document.documentElement.dir = isRtl(lng) ? 'rtl' : 'ltr'
}

export async function setLanguage(lng: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
  await i18n.changeLanguage(lng)
}

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, ar: { translation: ar }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})
i18n.on('languageChanged', applyDirection)
applyDirection(i18n.language)

export default i18n
