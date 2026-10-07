import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, DEMO_PASSWORD } from '@/api'
import { renderApp, resetWorld } from './render'

beforeEach(resetWorld)
const as = (email: string) => api.login({ email, password: DEMO_PASSWORD })

describe('approved partner view', () => {
  it('shows KYC level, limits, products and key status', async () => {
    await as('ae.demo@mizaniya.dz')
    renderApp('/status')
    expect(await screen.findByTestId('merchant-status')).toHaveTextContent('Approved')
    expect(screen.getByText('KYC level 2')).toBeInTheDocument()
    expect(screen.getByTestId('limit-annual')).toHaveTextContent('5,000,000 DZD')
    expect(screen.getByTestId('limit-perTransaction')).toBeInTheDocument()
    expect(screen.getByText('QR payments')).toBeInTheDocument()
    expect(screen.queryByText('Website checkout')).toBeNull()
    expect(screen.getByTestId('key-LIVE')).toHaveTextContent('Active')
    expect(screen.queryByTestId('cap-80')).toBeNull()
    expect(screen.queryByTestId('cap-100')).toBeNull()
  })

  it('Enterprise approved: "Contract signature pending", live key inactive, KYC 3, limits by contract', async () => {
    await as('enterprise.approved@mizaniya.dz')
    renderApp('/status')
    expect(await screen.findByTestId('contract-pending')).toHaveTextContent('Contract signature pending')
    expect(screen.getByTestId('key-LIVE')).toHaveTextContent('Inactive')
    expect(screen.getByText('KYC level 3')).toBeInTheDocument()
    expect(screen.getByTestId('limit-monthly')).toHaveTextContent('By contract')
  })

  it('pending: timeline shows Submitted done and In review current', async () => {
    await as('trader.pending@mizaniya.dz')
    renderApp('/status')
    const tl = await screen.findByTestId('timeline')
    const states = within(tl).getAllByRole('listitem').map((li) => li.getAttribute('data-state'))
    expect(states).toEqual(['done', 'done', 'current'])
    expect(screen.getByText(/being reviewed/)).toBeInTheDocument()
  })

  it('rejected: timeline ends in Rejected', async () => {
    await as('trader.rejected@mizaniya.dz')
    renderApp('/status')
    const tl = await screen.findByTestId('timeline')
    expect(within(tl).getAllByRole('listitem').map((li) => li.getAttribute('data-state'))).toEqual(['done', 'done', 'rejected'])
  })
})

describe('AE annual cap', () => {
  it('80%: banner with Upgrade call to action, and an email in the outbox', async () => {
    await as('ae.demo@mizaniya.dz')
    await api.dev.setVolumes({ annualDzd: 4_000_000 })
    renderApp('/status')
    const banner = await screen.findByTestId('cap-80')
    expect(banner).toHaveTextContent('You reached 80%')
    expect(within(banner).getByRole('button', { name: 'Upgrade to Individual trader or artisan' })).toBeInTheDocument()
    expect(within(banner).getByRole('button', { name: 'Upgrade to Company' })).toBeInTheDocument()
    expect(screen.getByTestId('ae-usage')).toHaveTextContent('80%')
    expect(within(screen.getByTestId('outbox')).getByText('Email: you reached 80% of your annual cap')).toBeInTheDocument()
    expect(screen.queryByTestId('cap-100')).toBeNull()
  })

  it('100%: flagged for admin review (default FLAG) and still shows the upgrade options', async () => {
    await as('ae.demo@mizaniya.dz')
    await api.dev.setVolumes({ annualDzd: 5_000_000 })
    renderApp('/status')
    const banner = await screen.findByTestId('cap-100')
    expect(banner).toHaveTextContent('flagged for review')
    expect(within(banner).getAllByRole('button')).toHaveLength(2)
    expect(screen.queryByTestId('cap-80')).toBeNull()
  })
})

describe('volume above declared band', () => {
  it('banner asks the partner to update the declared volume; updating clears it', async () => {
    await as('company.approved@mizaniya.dz')
    await api.dev.setVolumes({ monthlyDzd: 2_500_000 })
    renderApp('/status')
    const banner = await screen.findByTestId('volume-flag')
    await userEvent.click(within(banner).getByRole('button', { name: 'Update declared volume' }))
    const dlg = await screen.findByRole('dialog')
    expect(dlg).toHaveTextContent('Your limits stay the same')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }))
    expect(await within(dlg).findByText('This field is required.')).toBeInTheDocument()
    await userEvent.selectOptions(within(dlg).getByLabelText('Expected monthly volume'), 'B3')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByTestId('volume-flag')).toBeNull())
  })

  it('an Enterprise-level band for a Company shows an inline error pointing to the upgrade', async () => {
    await as('company.approved@mizaniya.dz')
    await api.dev.setVolumes({ monthlyDzd: 2_500_000 })
    renderApp('/status')
    const banner = await screen.findByTestId('volume-flag')
    await userEvent.click(within(banner).getByRole('button', { name: 'Update declared volume' }))
    const dlg = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dlg).getByLabelText('Expected monthly volume'), 'B4')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }))
    expect(await within(dlg).findByText(/requires an Enterprise account/)).toBeInTheDocument()
  })
})

describe('AE activity restriction', () => {
  it('a category outside the ANAE mapping is refused inline', async () => {
    await as('ae.demo@mizaniya.dz')
    renderApp('/status')
    const card = await screen.findByTestId('activity-restriction')
    expect(card).toHaveTextContent('PLACEHOLDER-001')
    await userEvent.selectOptions(within(card).getByLabelText('Try a payment link category'), 'FOOD')
    await userEvent.click(within(card).getByRole('button', { name: 'Check' }))
    expect(await within(card).findByTestId('category-result')).toHaveTextContent('does not allow this category')
    await userEvent.selectOptions(within(card).getByLabelText('Try a payment link category'), 'SERVICES_DIGITAL')
    await userEvent.click(within(card).getByRole('button', { name: 'Check' }))
    expect(await within(card).findByTestId('category-result')).toHaveTextContent('is allowed')
  })

  it('is not shown to a company', async () => {
    await as('company.approved@mizaniya.dz')
    renderApp('/status')
    await screen.findByTestId('merchant-status')
    expect(screen.queryByTestId('activity-restriction')).toBeNull()
  })
})

describe('upgrade path', () => {
  it('Upgrade starts a pre-filled draft and opens the first step that still needs input', async () => {
    await as('ae.demo@mizaniya.dz')
    renderApp('/status')
    const card = await screen.findByTestId('upgrade-card')
    await userEvent.click(within(card).getByRole('button', { name: 'Upgrade to Individual trader or artisan' }))
    // AE -> trader: the shared steps are already valid, so the partner lands directly on the trader step
    expect(await screen.findByRole('heading', { name: 'Trader details' })).toBeInTheDocument()
    expect(screen.queryByText('ANAE card number')).toBeNull()
    // identity data was kept
    const d = await api.getDraft()
    expect(d.ok && d.data.draft.steps.account.nin).toBeDefined()
    // the account still works at its current limits
    const st = await api.getPartnerStatus()
    expect(st.ok && st.data.status).toBe('APPROVED')
  })

  it('AE -> Company: the account step reappears only because the role is new for companies', async () => {
    await as('ae.demo@mizaniya.dz')
    renderApp('/status')
    const card = await screen.findByTestId('upgrade-card')
    await userEvent.click(within(card).getByRole('button', { name: 'Upgrade to Company' }))
    expect(await screen.findByRole('heading', { name: 'Account & legal representative' })).toBeInTheDocument()
  })

  it('shows the pending upgrade on the status page with a note that limits are unchanged', async () => {
    await as('ae.demo@mizaniya.dz')
    await api.startUpgrade('INDIVIDUAL_TRADER')
    renderApp('/status')
    const card = await screen.findByTestId('upgrade-card')
    expect(card).toHaveTextContent('In progress')
    expect(card).toHaveTextContent('keeps working at its current limits')
    expect(within(card).getByRole('button', { name: 'Continue upgrade' })).toBeInTheDocument()
  })
})
