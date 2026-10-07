import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/config/tbd', async (orig) => ({ ...(await orig<typeof import('@/shared/config/tbd')>()), AE_CAP_BEHAVIOUR: 'BLOCK' }))

describe('AE_CAP_BEHAVIOUR = BLOCK (config option)', () => {
  it('blocks transactions only at 100%', async () => {
    const { transactionsBlocked } = await import('@/shared/limits')
    expect(transactionsBlocked(['AE_CAP_100'])).toBe(true)
    expect(transactionsBlocked(['AE_CAP_80'])).toBe(false)
    expect(transactionsBlocked([])).toBe(false)
  })
})
