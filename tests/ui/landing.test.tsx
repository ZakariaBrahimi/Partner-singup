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
    const types = within(screen.getByRole('heading', { name: 'Which partner type are you?' }).closest('section')!)
    for (const n of ['Auto-entrepreneur', 'Individual trader or artisan', 'Company', 'Enterprise']) expect(types.getByText(n)).toBeInTheDocument()
  })
})
