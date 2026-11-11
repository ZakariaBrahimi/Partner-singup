import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from './render'

/** Renders the page once and returns a lookup of a row's cells, in column order: AE, Individual trader, Company, Enterprise. */
async function setup() {
  renderApp('/')
  const el = await screen.findByTestId('comparison-table')
  const table = within(el)
  return {
    el,
    row(label: string) {
      const tr = table.getByRole('rowheader', { name: label }).closest('tr')!
      return within(tr).getAllByRole('cell').map((c) => c.textContent?.trim() ?? '')
    },
  }
}

describe('comparison table', () => {
  it('has one column per partner type, in order', async () => {
    const { el } = await setup()
    expect([...el.querySelectorAll('thead th')].map((h) => h.textContent)).toEqual(['Auto-entrepreneur', 'Individual trader or artisan', 'Company', 'Enterprise'])
  })

  it('products accumulate from AE to Enterprise', async () => {
    const { row } = await setup()
    expect(row('API')).toEqual(['No', 'No', 'Yes', 'Yes'])
    expect(row('POS')).toEqual(['No', 'Yes', 'Yes', 'Yes'])
    expect(row('Payment links')).toEqual(['Yes', 'Yes', 'Yes', 'Yes'])
    expect(row('Sub-merchants')).toEqual(['No', 'No', 'No', 'Yes'])
  })

  it('documents: required, conditional and not asked', async () => {
    const { row } = await setup()
    expect(row('Photo of the ANAE card')).toEqual(['Yes', 'No', 'No', 'No'])
    expect(row('Statuts (PDF)')).toEqual(['No', 'No', 'Yes', 'Yes'])
    expect(row('Registered manager’s ID')).toEqual(['No', 'No', 'if applicable', 'if applicable'])
    expect(row('ID – back')).toEqual(['if applicable', 'if applicable', 'if applicable', 'if applicable'])
    // one row for the delegation, even though Company and Enterprise collect it through different fields
    expect(screen.getAllByRole('rowheader', { name: 'Delegation of signing authority' })).toHaveLength(1)
    expect(row('Delegation of signing authority')).toEqual(['No', 'No', 'if applicable', 'Yes'])
    expect(row('Latest financial statements (PDF)')).toEqual(['No', 'No', 'No', 'Yes'])
  })

  it('numbers and declarations', async () => {
    const { row } = await setup()
    expect(row('NIS')).toEqual(['No', 'No', 'Yes', 'Yes'])
    expect(row('Beneficial owners')).toEqual(['No', 'No', 'Yes', 'Yes'])
    expect(row('AML questionnaire')).toEqual(['No', 'No', 'No', 'Yes'])
    expect(row('NIN')).toEqual(['Yes', 'Yes', 'Yes', 'Yes'])
  })

  it('rules and limits', async () => {
    const { row } = await setup()
    expect(row('Legal annual turnover cap')).toEqual(['5,000,000 DZD', 'No', 'No', 'No'])
    expect(row('How limits are set')).toEqual(['Legal annual cap + volume band', 'Declared volume band', 'Declared volume band', 'By contract'])
    expect(row('Settlement account (RIB or CCP)')).toEqual(['In your name', 'In your name', 'In the company’s name (required)', 'In the company’s name (required)'])
    expect(row('Signed contract before going live')).toEqual(['No', 'No', 'No', 'Yes'])
    expect(row('Legal representative role asked')).toEqual(['No', 'No', 'Yes', 'Yes'])
    expect(row('Payments limited to your ANAE activity categories')).toEqual(['Yes', 'No', 'No', 'No'])
  })

  it('overview: KYC level, steps, upgrade paths', async () => {
    const { row } = await setup()
    expect(row('KYC level')).toEqual(['KYC 2', 'KYC 2', 'KYC 2', 'KYC 3'])
    expect(row('Verification steps')).toEqual(['5', '5', '5', '6']) // as in the "Step N of M" stepper
    const up = row('Can upgrade to')
    expect(up[0]).toBe('Individual trader or artisan, Company')
    expect(up[2]).toBe('Enterprise')
    expect(up[3]).toBe('–')
  })

  it('never shows placeholder limit numbers', async () => {
    const { el } = await setup()
    expect(el.textContent).not.toMatch(/999,?999/)
  })
})
