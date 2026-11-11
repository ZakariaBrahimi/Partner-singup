import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from './render'

describe('landing page', () => {
  it('is the home page and explains test mode, verification and go-live', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Test everything/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
    expect(screen.getByText('Test mode – available right after signup')).toBeInTheDocument()
    expect(screen.getByText('Live mode – after verification and subscription')).toBeInTheDocument()
  })
  it('links to signup and login, and lists the four partner types', async () => {
    renderApp('/')
    const ctas = await screen.findAllByRole('link', { name: 'Create an account' })
    expect(ctas.length).toBeGreaterThanOrEqual(2)
    ctas.forEach((a) => expect(a).toHaveAttribute('href', '/signup'))
    expect(screen.getAllByRole('link', { name: 'Log in' })[0]).toHaveAttribute('href', '/login')
    for (const id of ['AUTO_ENTREPRENEUR', 'INDIVIDUAL_TRADER', 'COMPANY', 'ENTERPRISE']) expect(screen.getByTestId(`landing-type-${id}`)).toBeInTheDocument()
  })

  it('each type explains itself: products, documents, numbers and limits', async () => {
    renderApp('/')
    const ae = within(await screen.findByTestId('landing-type-AUTO_ENTREPRENEUR'))
    expect(ae.getByText(/official ANAE list/)).toBeInTheDocument()
    expect(ae.getByText('Photo of the ANAE card')).toBeInTheDocument()
    expect(ae.getByText('ANAE card number')).toBeInTheDocument()
    expect(ae.getByText(/Legal annual turnover cap: 5,000,000 DZD/)).toBeInTheDocument()
    expect(ae.getByText(/categories mapped to your ANAE activity/)).toBeInTheDocument()
    expect(within(ae.getByText('Not included').parentElement!).getByText('API')).toBeInTheDocument()

    const co = within(screen.getByTestId('landing-type-COMPANY'))
    expect(co.getByText('Statuts (PDF)')).toBeInTheDocument()
    expect(co.getByText('Beneficial owners')).toBeInTheDocument()
    expect(co.getAllByText('if applicable').length).toBeGreaterThanOrEqual(2)
    expect(co.getByText(/routed to Enterprise/)).toBeInTheDocument()

    const en = within(screen.getByTestId('landing-type-ENTERPRISE'))
    expect(en.getByText('Latest financial statements (PDF)')).toBeInTheDocument()
    expect(en.getByText('AML questionnaire')).toBeInTheDocument()
    expect(en.getByText('Limits and pricing are set by contract.')).toBeInTheDocument()
    expect(en.queryByText('Not included')).toBeNull()
  })

  it('does not present placeholder limit values as real numbers', async () => {
    renderApp('/')
    await screen.findByTestId('landing-type-COMPANY')
    expect(document.body.textContent).not.toMatch(/999,?999/)
    expect(screen.getAllByText(/being finalised/).length).toBe(3) // Enterprise is by contract
  })
})
