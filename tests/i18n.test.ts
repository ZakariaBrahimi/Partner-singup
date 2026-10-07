import { describe, expect, it } from 'vitest'
import ar from '@/i18n/ar.json'
import en from '@/i18n/en.json'
import fr from '@/i18n/fr.json'
import { listPartnerTypes } from '@/shared/config/partnerTypes'
import { REJECTION_REASONS } from '@/shared/config/reasons'
import { stepFields } from '@/shared/flow'
import { SHARED_STEPS } from '@/shared/config/steps'
import { DUPLICATE_CHECKED_FIELDS } from '@/shared/validators'

function flatten(o: unknown, prefix = ''): string[] {
  if (typeof o === 'string') return [prefix]
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
}
const get = (o: unknown, path: string) =>
  path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], o)

describe('i18n', () => {
  const enKeys = flatten(en).sort()
  it('FR and AR have exactly the same keys as EN', () => {
    expect(flatten(fr).sort()).toEqual(enKeys)
    expect(flatten(ar).sort()).toEqual(enKeys)
  })
  it('no empty strings', () => {
    for (const l of [en, fr, ar]) for (const k of flatten(l)) expect(String(get(l, k)).trim()).not.toBe('')
  })
  it('every key used by the config exists', () => {
    const need = new Set<string>()
    for (const t of listPartnerTypes()) {
      need.add(`types.${t.id}.name`)
      need.add(`types.${t.id}.desc`)
      need.add(`types.${t.id}.needs`)
      t.products.forEach((p) => need.add(`products.${p}`))
      t.reviewChecklist.forEach((c) => need.add(`checklist.${c}`))
      const defs = [...t.stepIds.map((id) => t.stepDefs[id] ?? SHARED_STEPS[id]).filter(Boolean)]
      for (const def of defs) {
        need.add(`steps.${def.id}.title`)
        need.add(`steps.${def.id}.intro`)
        for (const s of def.sections) need.add(`sections.${def.id}.${s.id}`)
        for (const f of stepFields(def)) {
          need.add(`fields.${f.name}.label`)
          f.options?.forEach((o) => {
            if (f.optionsSource !== 'volumeBands') need.add(`fields.${f.name}.options.${o}`)
          })
        }
      }
    }
    REJECTION_REASONS.forEach((r) => need.add(`reasons.${r}`))
    DUPLICATE_CHECKED_FIELDS.forEach((f) => need.add(`duplicate.${f}`))
    const missing = [...need].filter((k) => get(en, k) === undefined)
    expect(missing).toEqual([])
  })
})

describe('i18n – keys used in source code', () => {
  it('every static t("…") key exists in en/fr/ar', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((f) => {
        const p = join(d, f)
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
      })
    const files = walk(join(process.cwd(), 'src'))
    const keys = new Set<string>()
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)'/g)) keys.add(m[1])
      for (const m of src.matchAll(/\?\s*'(ui\.[A-Za-z0-9_.]+)'\s*:\s*'(ui\.[A-Za-z0-9_.]+)'/g)) {
        keys.add(m[1])
        keys.add(m[2])
      }
    }
    expect(keys.size).toBeGreaterThan(50)
    for (const [name, l] of [['en', en], ['fr', fr], ['ar', ar]] as const) {
      expect([...keys].filter((k) => get(l, k) === undefined), name).toEqual([])
    }
  })
})
