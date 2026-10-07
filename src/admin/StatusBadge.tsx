import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { MerchantStatus } from '@/shared/types'

const V = { DRAFT: 'neutral', PENDING_APPROVAL: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const

export function StatusBadge({ status }: { status: MerchantStatus }) {
  const { t } = useTranslation()
  return <Badge variant={V[status]}>{t(`ui.status.state.${status}`)}</Badge>
}
