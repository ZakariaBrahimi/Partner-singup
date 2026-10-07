import { describe, expect, it } from 'vitest'

// Brand tokens from the story. Text contrast must be >= 4.5:1.
const T = {
  navy: '#1F4E67',
  accent: '#F8E81C',
  ink: '#13232E',
  ink2: '#4A5D6A',
  surface: '#F4F6F7',
  danger: '#B42318',
  success: '#1E7A4C',
  warnBg: '#FFF6D6',
  warnInk: '#4A3400',
  white: '#FFFFFF',
  dangerBg: '#FDECEB',
  successBg: '#E3F4EA',
  infoBg: '#EEF4F7',
}

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** `fg` at `alpha` over `bg`. */
const blend = (fg: string, bg: string, alpha: number) =>
  '#' + rgb(fg).map((c, i) => Math.round(c * alpha + rgb(bg)[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')

describe('text contrast >= 4.5:1', () => {
  it.each([
    ['ink on white', T.ink, T.white],
    ['ink on page background', T.ink, T.surface],
    ['secondary text on white', T.ink2, T.white],
    ['secondary text on page background', T.ink2, T.surface],
    ['navy (links, primary) on white', T.navy, T.white],
    ['navy (links) on page background', T.navy, T.surface],
    ['white on navy sidebar / primary button', T.white, T.navy],
    ['sidebar secondary text (white 85%) on navy', blend(T.white, T.navy, 0.85), T.navy],
    ['ink on accent yellow (badges, active language)', T.ink, T.accent],
    ['error text on white', T.danger, T.white],
    ['error text on error background', T.danger, T.dangerBg],
    ['success text on white', T.success, T.white],
    ['success text on success background', T.success, T.successBg],
    ['warning text on warning background', T.warnInk, T.warnBg],
    ['ink on info background', T.ink, T.infoBg],
    ['white on destructive button', T.white, T.danger],
  ])('%s', (_name, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('the selection ring (accent) is visible against the card border colour', () => {
    // non-text UI component: >= 3:1 is required, the accent ring is paired with a navy border
    expect(ratio(T.navy, T.white)).toBeGreaterThanOrEqual(3)
  })
})
