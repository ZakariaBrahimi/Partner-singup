// ANAE nomenclature seed. PLACEHOLDER ROWS: replace with the real list (Executive Decree 23-197).
// TODO(compliance): fill with the official activity codes, labels and allowed payment categories.

/** Payment categories an activity may accept. TODO(compliance): confirm the category list. */
export type PaymentCategory = 'SERVICES_PROFESSIONAL' | 'SERVICES_DIGITAL' | 'EDUCATION' | 'CRAFT' | 'FOOD' | 'TRANSPORT'

export interface AnaeActivity {
  code: string
  labelFr: string
  labelAr: string
  paymentCategories: PaymentCategory[]
}

export const ANAE_ACTIVITIES: AnaeActivity[] = [
  { code: 'PLACEHOLDER-001', labelFr: 'Conception de sites web (placeholder)', labelAr: 'تصميم المواقع الإلكترونية (نموذج)', paymentCategories: ['SERVICES_DIGITAL', 'SERVICES_PROFESSIONAL'] },
  { code: 'PLACEHOLDER-002', labelFr: 'Soutien scolaire (placeholder)', labelAr: 'الدروس الخصوصية (نموذج)', paymentCategories: ['EDUCATION'] },
  { code: 'PLACEHOLDER-003', labelFr: 'Traduction (placeholder)', labelAr: 'الترجمة (نموذج)', paymentCategories: ['SERVICES_PROFESSIONAL'] },
  { code: 'PLACEHOLDER-004', labelFr: 'Artisanat décoratif (placeholder)', labelAr: 'الحرف الزخرفية (نموذج)', paymentCategories: ['CRAFT'] },
  { code: 'PLACEHOLDER-005', labelFr: 'Transport de personnes (placeholder)', labelAr: 'نقل الأشخاص (نموذج)', paymentCategories: ['TRANSPORT'] },
]
