import { describe, expect, it } from 'vitest'
import { holderNameMatches, passwordStrength, validateFormat, VALIDATORS } from '@/shared/validators'

describe('website .com.dz (Law 18-05)', () => {
  it.each(['monsite.com.dz', 'https://shop.monsite.com.dz/path', 'www.a-b.com.dz'])('accepts %s', (v) => {
    expect(VALIDATORS.websiteComDz(v)).toBeNull()
  })
  it.each(['monsite.com', 'monsite.dz', 'https://com.dz', 'monsite.com.dz.evil.com', 'not a url', 'x.com.dz.fr'])(
    'rejects %s',
    (v) => {
      expect(VALIDATORS.websiteComDz(v)).toBe('websiteComDz')
    },
  )
})

describe('phone', () => {
  it('accepts national numbers with or without leading 0', () => {
    expect(VALIDATORS.phone('550123456')).toBeNull()
    expect(VALIDATORS.phone('0550 12 34 56')).toBeNull()
  })
  it('rejects bad numbers', () => {
    expect(VALIDATORS.phone('123')).toBe('invalidPhone')
    expect(VALIDATORS.phone('150123456')).toBe('invalidPhone')
  })
})

describe('email', () => {
  it('validates', () => {
    expect(VALIDATORS.email('a@b.dz')).toBeNull()
    expect(VALIDATORS.email('a@b')).toBe('invalidEmail')
  })
})

describe('placeholder identifier formats are loose but reject junk', () => {
  it('RC / NIF / NIS', () => {
    expect(validateFormat('rc', '16/00-1234567 B 09')).toBeNull()
    expect(validateFormat('rc', '!!')).toBe('invalidRc')
    expect(validateFormat('nif', '099916000123456')).toBeNull()
    expect(validateFormat('nis', 'abc')).toBe('invalidNis')
  })
  it('RIB / CCP are numeric', () => {
    expect(validateFormat('rib', '00799999 0012345678 91')).toBeNull()
    expect(validateFormat('rib', 'abc')).toBe('invalidRib')
    expect(validateFormat('ccp', '12345678')).toBeNull()
  })
  it('unknown field has no rule', () => {
    expect(validateFormat('whatever', 'x')).toBeNull()
  })
})

describe('percentage', () => {
  it('1..100', () => {
    expect(VALIDATORS.percentage('25')).toBeNull()
    expect(VALIDATORS.percentage('0')).toBe('invalidPercentage')
    expect(VALIDATORS.percentage('101')).toBe('invalidPercentage')
  })
})

describe('password strength', () => {
  it('scores', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(1)
    expect(passwordStrength('Abcdefg1')).toBeGreaterThanOrEqual(3)
    expect(passwordStrength('Abcdefg1!xyz')).toBe(4)
  })
})

describe('holder name match', () => {
  it('ignores case, accents, order and punctuation', () => {
    expect(holderNameMatches('BRAHIMI Zakaria', 'Zakaria Brahimi')).toBe(true)
    expect(holderNameMatches('Société X', 'SOCIETE x')).toBe(true)
  })
  it('detects mismatch', () => {
    expect(holderNameMatches('Ahmed Ali', 'Zakaria Brahimi')).toBe(false)
    expect(holderNameMatches('', 'Zakaria')).toBe(false)
  })
})
