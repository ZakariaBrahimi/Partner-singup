import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, resetWorld } from './render'

beforeEach(resetWorld)

describe('step 1 – partner type', () => {
  it('shows the four types with description, documents and product chips', async () => {
    renderApp()
    const cards = await screen.findAllByRole('radio')
    expect(cards).toHaveLength(4)
    const ae = screen.getByTestId('type-AUTO_ENTREPRENEUR')
    expect(within(ae).getByText('Auto-entrepreneur')).toBeInTheDocument()
    expect(within(ae).getByText(/You’ll need:/)).toBeInTheDocument()
    expect(within(ae).getByText('Payment links')).toBeInTheDocument()
    expect(within(ae).queryByText('API')).toBeNull()
    expect(within(screen.getByTestId('type-ENTERPRISE')).getByText('Dedicated support')).toBeInTheDocument()
  })

  it('selecting a card marks it Selected and relabels Continue', async () => {
    renderApp()
    const continueBtn = await screen.findByRole('button', { name: 'Continue' })
    expect(continueBtn).toBeDisabled()
    await userEvent.click(screen.getByTestId('type-COMPANY'))
    expect(within(screen.getByTestId('type-COMPANY')).getByText('Selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue as Company' })).toBeEnabled()
  })

  it('the stepper and "Step N of M" follow the type', async () => {
    renderApp()
    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('type-ENTERPRISE'))
    await userEvent.click(screen.getByRole('button', { name: /Continue as/ }))
    expect(await screen.findByText('Step 2 of 6')).toBeInTheDocument()
    expect(screen.getByText('Enterprise documents')).toBeInTheDocument()
  })

  it('links to the helper, the no-legal-status screen and login', async () => {
    renderApp()
    expect(await screen.findByRole('link', { name: 'Help me choose' })).toHaveAttribute('href', '/signup/helper')
    expect(screen.getByRole('link', { name: 'No registered business yet?' })).toHaveAttribute('href', '/signup/no-legal-status')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })
})

describe('helper "Help me choose"', () => {
  it('a yes to RC preselects Individual trader on step 1 (still changeable)', async () => {
    renderApp('/signup/helper')
    await userEvent.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByText(/we suggested “Individual trader or artisan”/)).toBeInTheDocument()
    expect(within(screen.getByTestId('type-INDIVIDUAL_TRADER')).getByText('Selected')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('type-COMPANY'))
    expect(within(screen.getByTestId('type-COMPANY')).getByText('Selected')).toBeInTheDocument()
  })

  it('RC no, RAM no, ANAE yes preselects Auto-entrepreneur', async () => {
    renderApp('/signup/helper')
    await userEvent.click(await screen.findByRole('button', { name: 'No' }))
    await userEvent.click(await screen.findByRole('button', { name: 'No' }))
    expect(screen.getByText(/ANAE auto-entrepreneur card\?/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(within(screen.getByTestId('type-AUTO_ENTREPRENEUR')).getByText('Selected')).toBeInTheDocument())
  })

  it('three no answers lead to the dead end: app link, anae.dz, and no way to continue', async () => {
    renderApp('/signup/helper')
    for (let i = 0; i < 3; i++) await userEvent.click(await screen.findByRole('button', { name: 'No' }))
    expect(await screen.findByRole('heading', { name: 'A legal status is required' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Get the app/ })).toHaveAttribute('href', expect.stringContaining('mizaniyapay'))
    expect(screen.getByRole('link', { name: /anae\.dz/ })).toHaveAttribute('href', 'https://www.anae.dz')
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull()
  })
})

describe('guards', () => {
  it('cannot open later steps without an account', async () => {
    renderApp('/signup/business')
    expect(await screen.findByRole('heading', { name: 'Choose your partner type' })).toBeInTheDocument()
  })
})
