import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, DEMO_PASSWORD } from '@/api'
import { renderApp, resetWorld } from './render'

beforeEach(resetWorld)

const rows = () => screen.getAllByTestId('submission-row')
const rowFor = (name: string) => rows().find((r) => within(r).queryByText(name))!

describe('admin – submissions list', () => {
  it('Level 2 tab lists AE/trader/company submissions with a type filter; Level 3 lists Enterprise', async () => {
    renderApp('/admin')
    await screen.findByRole('heading', { name: 'Merchant Registration Requests' })
    await waitFor(() => expect(rows().length).toBeGreaterThan(3))
    const l2 = rows().map((r) => r.textContent)
    expect(l2.join(' ')).toContain('Auto-entrepreneur')
    expect(l2.join(' ')).not.toContain('Enterprise')

    // partner type filter
    await userEvent.selectOptions(screen.getByLabelText('Partner type'), 'COMPANY')
    await waitFor(() => rows().forEach((r) => expect(r).toHaveTextContent('Company')))
    expect(rows().length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('tab', { name: 'KYC Level 3' }))
    await waitFor(() => rows().forEach((r) => expect(r).toHaveTextContent('Enterprise')))
    // the filter only offers Level 3 types on this tab
    expect(within(screen.getByLabelText('Partner type')).queryByRole('option', { name: 'Company' })).toBeNull()
  })

  it('status filter narrows the list', async () => {
    renderApp('/admin')
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'REJECTED')
    await waitFor(() => rows().forEach((r) => expect(r).toHaveTextContent('Rejected')))
  })

  it('incomplete signups tab shows the last completed step', async () => {
    renderApp('/admin')
    await userEvent.click(await screen.findByRole('tab', { name: 'Incomplete signups' }))
    await waitFor(() => expect(rows().length).toBeGreaterThanOrEqual(2))
    expect(screen.getAllByTestId('last-step').map((c) => c.textContent)).toEqual(expect.arrayContaining(['Account']))
  })
})

async function openDetail(name: string, tab?: string) {
  renderApp('/admin')
  if (tab) await userEvent.click(await screen.findByRole('tab', { name: tab }))
  await waitFor(() => expect(rows().length).toBeGreaterThan(0))
  await userEvent.click(within(rowFor(name)).getByRole('link', { name }))
  await screen.findByRole('heading', { name })
}

describe('admin – detail', () => {
  it('shows a checklist specific to the type, the declared band and the ANAE code for an AE', async () => {
    await api.login({ email: 'ae.demo@mizaniya.dz', password: DEMO_PASSWORD }) // keep session irrelevant to admin
    renderApp('/admin')
    await userEvent.selectOptions(await screen.findByLabelText('Partner type'), 'AUTO_ENTREPRENEUR')
    await waitFor(() => expect(rows()).toHaveLength(1))
    await userEvent.click(within(rows()[0]).getByRole('link'))
    await screen.findByText(/Review checklist – Auto-entrepreneur/)
    expect(screen.getByText('ANAE card number and photo verified (manual check)')).toBeInTheDocument()
    expect(screen.queryByText('Statuts reviewed')).toBeNull()
    expect(screen.getByTestId('anae-code')).toHaveTextContent('PLACEHOLDER-001')
    expect(screen.getByTestId('declared-band')).toHaveTextContent('500,000')
  })

  it('an Enterprise checklist differs (AML, financials, technical contact)', async () => {
    await openDetail('Boudiaf Group SPA', 'KYC Level 3')
    expect(screen.getByText('AML questionnaire reviewed')).toBeInTheDocument()
    expect(screen.getByText('Financial statements reviewed')).toBeInTheDocument()
    expect(screen.getByText('Technical contact verified')).toBeInTheDocument()
    expect(screen.queryByText('ANAE card number and photo verified (manual check)')).toBeNull()
  })

  it('ticking checklist items updates progress and is persisted', async () => {
    await openDetail('Mansouri Électronique SARL')
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0 of 8')
    await userEvent.click(screen.getByRole('checkbox', { name: 'RC valid and photo legible' }))
    await waitFor(() => expect(screen.getByTestId('checklist-progress')).toHaveTextContent('1 of 8'))
    const subs = await api.admin.listSubmissions({ view: 'submissions' })
    const id = subs.ok ? subs.data.find((r) => r.displayName === 'Mansouri Électronique SARL')!.id : ''
    const d = await api.admin.getSubmission(id)
    expect(d.ok && d.data.checklist.rcValid).toBe(true)
  })

  it('documents open in a preview popup', async () => {
    await openDetail('Mansouri Électronique SARL')
    const docs = within(screen.getByTestId('documents'))
    await userEvent.click(docs.getAllByRole('button', { name: 'Preview' })[0])
    const dlg = await screen.findByRole('dialog')
    expect(within(dlg).getByRole('img', { name: /Preview of/ })).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('admin – approve / reject / contract', () => {
  it('approve: status, KYC level and audit are updated; the partner sees approval', async () => {
    await openDetail('Mansouri Électronique SARL')
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    const dlg = await screen.findByRole('dialog')
    expect(dlg).toHaveTextContent('KYC Level 2')
    expect(dlg).toHaveTextContent('Only 0 of 8 checklist items are ticked')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText(/Submission approved/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled())
    expect(within(screen.getByTestId('audit-log')).getByText('APPROVED')).toBeInTheDocument()
    const login = await api.login({ email: 'taken@mizaniya.dz', password: DEMO_PASSWORD })
    expect(login.ok && login.data.status).toBe('APPROVED')
  })

  it('reject: reason and message are mandatory and errors are inline; flagged fields are optional', async () => {
    await openDetail('Mansouri Électronique SARL')
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    const dlg = await screen.findByRole('dialog')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject and notify' }))
    expect(await within(dlg).findAllByText('This field is required.')).toHaveLength(2)
    expect(within(dlg).getByLabelText('Reason')).toHaveAttribute('aria-invalid', 'true')
    expect(within(dlg).getByLabelText('Message to the partner')).toHaveAttribute('aria-invalid', 'true')

    await userEvent.selectOptions(within(dlg).getByLabelText('Reason'), 'DOCUMENT_UNREADABLE')
    await userEvent.type(within(dlg).getByLabelText('Message to the partner'), 'Statuts are cut off.')
    await userEvent.click(within(dlg).getByRole('checkbox', { name: /Statuts \(PDF\)/ }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject and notify' }))
    expect(await screen.findByText(/Submission rejected/)).toBeInTheDocument()
    const box = screen.getByTestId('admin-rejection')
    expect(box).toHaveTextContent('Document unreadable')
    expect(box).toHaveTextContent('business.statuts')
    // the partner sees the same reason and the flagged item
    const login = await api.login({ email: 'taken@mizaniya.dz', password: DEMO_PASSWORD })
    expect(login.ok).toBe(true)
    const st = await api.getPartnerStatus()
    expect(st.ok && st.data.rejection).toEqual({ code: 'DOCUMENT_UNREADABLE', text: 'Statuts are cut off.', flaggedFields: ['business.statuts'] })
  })

  it('reject without flagged fields is allowed', async () => {
    await openDetail('Mansouri Électronique SARL')
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    const dlg = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dlg).getByLabelText('Reason'), 'OTHER')
    await userEvent.type(within(dlg).getByLabelText('Message to the partner'), 'Please contact support.')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject and notify' }))
    expect(await screen.findByText(/Submission rejected/)).toBeInTheDocument()
  })

  it('Enterprise: approval leaves go-live blocked until the contract is marked signed', async () => {
    await openDetail('Boudiaf Group SPA', 'KYC Level 3')
    expect(screen.getByRole('button', { name: 'Mark contract as signed' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }))
    await screen.findByText(/Submission approved/)
    expect(screen.getByTestId('admin-contract')).toHaveTextContent('Contract signature pending')
    await userEvent.click(screen.getByRole('button', { name: 'Mark contract as signed' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark as signed' }))
    await screen.findByText(/Contract marked as signed/)
    await waitFor(() => expect(screen.getByTestId('admin-contract')).toHaveTextContent(/Contract signed on/))
    const log = within(screen.getByTestId('audit-log'))
    expect(log.getByText('APPROVED')).toBeInTheDocument()
    expect(log.getByText('CONTRACT_SIGNED')).toBeInTheDocument()
  })

  it('the contract action does not exist for non-Enterprise types', async () => {
    await openDetail('Mansouri Électronique SARL')
    expect(screen.queryByRole('button', { name: 'Mark contract as signed' })).toBeNull()
  })

  it('an incomplete signup is read-only: no approve/reject', async () => {
    renderApp('/admin')
    await userEvent.click(await screen.findByRole('tab', { name: 'Incomplete signups' }))
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    await userEvent.click(within(rows()[0]).getByRole('link'))
    await screen.findByText(/Incomplete signup\. Last completed step/)
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()
  })
})
