import { useTranslation } from 'react-i18next'
import type { StepperItem } from '@/components/layout/Stepper'
import { listPartnerTypes } from '@/shared/config/partnerTypes'
import { resolveSteps } from '@/shared/flow'
import type { StepId } from '@/shared/types'
import { useSignup } from './SignupContext'

export const stepPath = (id: StepId) => (id === 'type' ? '/signup' : `/signup/${id}`)

/** Stepper items + "Step N of M" for the current step, from the live draft. */
export function useSteps(currentId: StepId) {
  const { t } = useTranslation()
  const { draft, summary } = useSignup()
  const type = draft.partnerType
  // Before a type is chosen, preview the default flow so the stepper is never a single item.
  const ids = type ? resolveSteps(type, draft.steps) : listPartnerTypes()[0].stepIds
  const lastIdx = draft.lastCompletedStep ? ids.indexOf(draft.lastCompletedStep) : -1
  const doneIdx = Math.max(lastIdx, type && summary ? 0 : -1)
  const currentIdx = ids.indexOf(currentId)
  const items: StepperItem[] = ids.map((id, i) => ({
    id,
    label: t(`steps.${id}.nav`),
    state: i === currentIdx ? 'current' : i <= doneIdx ? 'done' : 'upcoming',
    // Only completed steps and the next one are reachable from the sidebar.
    href: summary || id === 'type' ? (i <= doneIdx + 1 ? stepPath(id) : undefined) : undefined,
  }))
  return { items, ids, eyebrow: t('ui.stepOf', { n: Math.max(0, currentIdx) + 1, m: ids.length }) }
}
