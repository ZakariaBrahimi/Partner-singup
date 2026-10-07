import { describe, expect, it } from 'vitest'
import { AE_ANNUAL_CAP_DZD, LIMITS, VOLUME_BANDS } from '@/shared/config/tbd'
import { aeUsage, evaluateFlags, limitsFor, transactionsBlocked, volumeAboveBand } from '@/shared/limits'

describe('limits per type and band', () => {
  it('every type has an entry for every band', () => {
    for (const t of ['AUTO_ENTREPRENEUR', 'INDIVIDUAL_TRADER', 'COMPANY', 'ENTERPRISE']) {
      for (const b of VOLUME_BANDS) expect(limitsFor(t, b.id), `${t}/${b.id}`).not.toBeNull()
    }
  })
  it('AE carries the 5,000,000 DZD legal cap, enterprise limits are by contract', () => {
    expect(limitsFor('AUTO_ENTREPRENEUR', 'B1')?.annual).toBe(5_000_000)
    expect(AE_ANNUAL_CAP_DZD).toBe(5_000_000)
    expect(limitsFor('ENTERPRISE', 'B4')).toEqual({ perTransaction: null, monthly: null, payout: null })
    expect(limitsFor('COMPANY', 'B2')).toEqual(LIMITS.COMPANY.B2)
  })
  it('unknown type or band gives null', () => {
    expect(limitsFor('NOPE', 'B1')).toBeNull()
    expect(limitsFor('COMPANY', 'ZZ')).toBeNull()
    expect(limitsFor('COMPANY', undefined)).toBeNull()
  })
})

describe('AE cap tracking', () => {
  const flags = (annualDzd: number) => evaluateFlags({ type: 'AUTO_ENTREPRENEUR', band: 'B1', annualDzd, monthlyDzd: 0 })
  it('warns at 80% and flags at 100%', () => {
    expect(flags(0)).toEqual([])
    expect(flags(3_999_999)).toEqual([])
    expect(flags(4_000_000)).toEqual(['AE_CAP_80'])
    expect(flags(4_999_999)).toEqual(['AE_CAP_80'])
    expect(flags(5_000_000)).toEqual(['AE_CAP_100'])
    expect(flags(7_000_000)).toEqual(['AE_CAP_100'])
  })
  it('only applies to types with an annual cap', () => {
    expect(evaluateFlags({ type: 'COMPANY', band: 'B2', annualDzd: 9_000_000, monthlyDzd: 0 })).toEqual([])
    expect(aeUsage('COMPANY', 1)).toBeNull()
    expect(aeUsage('AUTO_ENTREPRENEUR', 2_500_000)?.ratio).toBe(0.5)
  })
  it('default behaviour at 100% is FLAG: transactions are not blocked', () => {
    expect(transactionsBlocked(['AE_CAP_100'])).toBe(false)
  })
})

describe('volume above declared band', () => {
  it('compares monthly volume with the upper bound of the declared band', () => {
    expect(volumeAboveBand('B1', 500_000)).toBe(false)
    expect(volumeAboveBand('B1', 500_001)).toBe(true)
    expect(volumeAboveBand('B2', 1_999_999)).toBe(false)
  })
  it('an open-ended band is never exceeded', () => {
    expect(volumeAboveBand('B4', 999_999_999_999)).toBe(false)
  })
  it('unknown band: nothing to compare', () => {
    expect(volumeAboveBand(null, 10)).toBe(false)
  })
  it('is reported as a flag', () => {
    expect(evaluateFlags({ type: 'COMPANY', band: 'B1', annualDzd: 0, monthlyDzd: 600_000 })).toEqual(['VOLUME_ABOVE_BAND'])
  })
})
