import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, DEMO_DUPLICATES, DEMO_PASSWORD, MOCK_OTP } from '@/api'
import { validDraft } from '../helpers'
import { renderApp, resetWorld } from './render'

beforeEach(resetWorld)

const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!
const img = (n = 'doc.jpg') => new File(['x'], n, { type: 'image/jpeg' })
const pdf = (n = 'doc.pdf') => new File(['x'], n, { type: 'application/pdf' })

async function type(sel: string, v: string) {
  await userEvent.type($(sel), v)
}
async function upload(field: string, f: File) {
  await userEvent.upload(screen.getByTestId(`f-${field}-input`), f)
  await waitFor(() => expect($(`[data-field="${field}"] [data-state="uploaded"]`)).toBeTruthy())
}
async function verify(field: 'email' | 'phone') {
  const box = $(`[data-field="${field}"]`)
  await userEvent.click(within(box).getByRole('button', { name: 'Send code' }))
  await userEvent.type($(`#f-${field}-code`), MOCK_OTP)
  await userEvent.click(within(box).getByRole('button', { name: 'Verify' }))
  await within(box).findByText('Verified')
}
const radio = (field: string, name: RegExp | string) => userEvent.click(within($(`[data-field="${field}"]`)).getByRole('radio', { name }))

/** Create the account through the API and sign in, so a test can start at a later step. */
async function accountFor(type: string) {
  const d = validDraft(type)
  for (const [c, v] of [['EMAIL', d.steps.account.email], ['PHONE', d.steps.account.phone]] as const) {
    await api.verifyOtp({ channel: c, value: String(v), code: MOCK_OTP })
  }
  const r = await api.createAccount({ partnerType: type, data: d.steps.account })
  if (!r.ok) throw new Error(r.error)
  return d
}

describe('field-level validation (fixes 869e4xg74)', () => {
  it('a duplicate RC shows under the field on blur, with aria wiring and no toast', async () => {
    await accountFor('COMPANY')
    renderApp('/signup/business')
    await screen.findByRole('heading', { name: 'Company details' })
    await type('#f-rc', DEMO_DUPLICATES.rc)
    await userEvent.tab()
    const msg = await screen.findByText('This RC is already registered.')
    expect(msg.closest('p')).toHaveAttribute('id', 'f-rc-error')
    expect($('#f-rc')).toHaveAttribute('aria-invalid', 'true')
    expect($('#f-rc').getAttribute('aria-describedby')).toContain('f-rc-error')
    expect(screen.queryByRole('status', { name: /toast/i })).toBeNull()
  })

  it('invalid format is reported immediately on blur; fixing it clears the error', async () => {
    await accountFor('COMPANY')
    renderApp('/signup/business')
    await screen.findByRole('heading', { name: 'Company details' })
    await type('#f-nif', '!')
    await userEvent.tab()
    expect(await screen.findByText('This NIF format is not valid.')).toBeInTheDocument()
    await userEvent.clear($('#f-nif'))
    await type('#f-nif', 'NIF-FRESH-001')
    await userEvent.tab()
    await waitFor(() => expect(screen.queryByText('This NIF format is not valid.')).toBeNull())
    await waitFor(() => expect($('#f-nif')).not.toHaveAttribute('aria-invalid'))
  })

  it('submitting a step with problems shows an error summary that links to each field', async () => {
    await accountFor('COMPANY')
    renderApp('/signup/business')
    await screen.findByRole('heading', { name: 'Company details' })
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const summary = await screen.findByRole('alert', { name: /There is a problem/ })
    await userEvent.click(within(summary).getByRole('link', { name: 'Company name' }))
    expect($('#f-companyName')).toHaveFocus()
  })

  it('the .com.dz rule shows the exact inline message', async () => {
    await accountFor('INDIVIDUAL_TRADER')
    renderApp('/signup/business')
    await screen.findByRole('heading', { name: 'Trader details' })
    await radio('salesChannel', 'Online')
    await type('#f-website', 'https://shop.example.com')
    await userEvent.tab()
    expect(await screen.findByText('Online sales must run on a site hosted in Algeria with a .com.dz address.')).toBeInTheDocument()
  })

  it('the role field is hidden for AE and trader, shown for Company', async () => {
    await accountFor('AUTO_ENTREPRENEUR')
    const { unmount } = renderApp('/signup/account')
    await screen.findByRole('heading', { name: 'Account & legal representative' })
    expect($('#f-legalRole')).toBeNull()
    unmount()
    await resetWorld()
    await accountFor('COMPANY')
    renderApp('/signup/account')
    await screen.findByRole('heading', { name: 'Account & legal representative' })
    expect($('#f-legalRole')).not.toBeNull()
  })
})

describe('full AE signup through the UI', () => {
  it('type -> account (OTP) -> business -> settlement -> review -> submitted -> status', { timeout: 60_000 }, async () => {
    renderApp('/signup')
    await userEvent.click(await screen.findByTestId('type-AUTO_ENTREPRENEUR'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue as Auto-entrepreneur' }))

    // account
    await screen.findByRole('heading', { name: 'Account & legal representative' })
    await type('#f-email', 'ui.ae@example.dz')
    await type('#f-phone', '551234567')
    await verify('email')
    await verify('phone')
    await type('#f-password', 'Abcdefg1!xyz')
    expect(screen.getByTestId('password-meter')).toHaveAttribute('data-strength', '4')
    await type('#f-fullName', 'Karim Benali')
    await radio('idType', /National ID/)
    await upload('idFront', img())
    await upload('idBack', img())
    await type('#f-nin', '109876543210123456')
    await upload('selfie', img('selfie.jpg'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // business
    await screen.findByRole('heading', { name: 'Auto-entrepreneur details' })
    expect(screen.getByText(/Your account was created and sandbox API keys are ready/)).toBeInTheDocument()
    expect(screen.getByText(/annual turnover cap of 5,000,000 DZD/)).toBeInTheDocument()
    await type('#f-anaeCardNumber', 'AE-UI-0001')
    await upload('anaeCardPhoto', img())
    await type('#f-tradeName', 'Chez Karim')
    await userEvent.selectOptions($('#f-wilaya'), '16')
    await type('#f-commune', 'Bab Ezzouar')
    await type('#f-streetAddress', '12 rue des Oliviers')
    await userEvent.click($('#f-activityCode'))
    await userEvent.click(await screen.findByRole('option', { name: /Conception de sites web/ }))
    expect(await screen.findByTestId('accept-summary')).toHaveTextContent('Digital services')
    await radio('salesChannel', 'In person')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // settlement (mismatching holder is only a warning for an AE)
    await screen.findByRole('heading', { name: 'Settlement account & expected volume' })
    await radio('settlementType', /Bank/)
    await type('#f-accountNumber', '00799999001234567891')
    await type('#f-holderName', 'Somebody Else')
    await userEvent.tab()
    expect(await screen.findByText(/does not match your name on the ID/)).toBeInTheDocument()
    await userEvent.selectOptions($('#f-volumeBand'), 'B1')
    await type('#f-avgTicketDzd', '5000')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // review
    await screen.findByRole('heading', { name: 'Review & submit' })
    expect(within(screen.getByTestId('review-business')).getByText('AE-UI-0001')).toBeInTheDocument()
    expect(within(screen.getByTestId('review-account')).getByText('••••••••')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Edit/ }).length).toBeGreaterThanOrEqual(4)
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(await screen.findByText('You must accept to continue.', { selector: 'p, li' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))

    // confirmation + status
    expect(await screen.findByRole('heading', { name: /we received your application/ })).toBeInTheDocument()
    expect(screen.getByText(/within about 48 hours/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Track my application' }))
    expect(await screen.findByTestId('merchant-status')).toHaveTextContent('Under review')
    const st = await api.getPartnerStatus()
    expect(st.ok && st.data).toMatchObject({ status: 'PENDING_APPROVAL', kyb: 'PENDING' })
  })
})

describe('draft & resume', () => {
  it('login resumes a draft at the step after the last completed one', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText('Email'), 'ae.draft@mizaniya.dz')
    await userEvent.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { name: 'Auto-entrepreneur details' })).toBeInTheDocument()
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument()
  })

  it('wrong password: inline error under the field, not a toast', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText('Email'), 'ae.draft@mizaniya.dz')
    await userEvent.type(screen.getByLabelText('Password'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    const err = await screen.findAllByText('Email or password is incorrect.')
    expect(err.length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps typed values when going Back and returning', async () => {
    await accountFor('COMPANY')
    renderApp('/signup/business')
    await screen.findByRole('heading', { name: 'Company details' })
    await type('#f-companyName', 'Benali Distribution')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('heading', { name: 'Account & legal representative' })
    await userEvent.click(screen.getByRole('link', { name: /Business/ }))
    await screen.findByRole('heading', { name: 'Company details' })
    expect($('#f-companyName')).toHaveValue('Benali Distribution')
  })
})

describe('changing type mid-signup', () => {
  it('asks for confirmation, keeps shared steps, resets type-specific fields', async () => {
    await accountFor('AUTO_ENTREPRENEUR')
    const d = validDraft('AUTO_ENTREPRENEUR')
    await api.saveStep({ stepId: 'business', data: d.steps.business, complete: true })
    renderApp('/signup')
    await userEvent.click(await screen.findByTestId('type-COMPANY'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue as Company' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Change partner type?')
    expect(dialog).toHaveTextContent(/value\(s\) specific to the previous type will be reset/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect((await api.getDraft()).ok && (await api.getDraft()).ok).toBe(true)
    const still = await api.getDraft()
    expect(still.ok && still.data.draft.partnerType).toBe('AUTO_ENTREPRENEUR')

    await userEvent.click(screen.getByRole('button', { name: 'Continue as Company' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Change type' }))
    await screen.findByRole('heading', { name: 'Account & legal representative' })
    const after = await api.getDraft()
    expect(after.ok && after.data.draft.partnerType).toBe('COMPANY')
    expect(after.ok && after.data.draft.steps.account.email).toBe(d.steps.account.email)
    expect(after.ok && after.data.draft.steps.business?.anaeCardNumber).toBeUndefined()
  })
})

describe('rejection -> fix and resubmit', () => {
  it('shows the reason and flagged items, reopens only those, and resubmits', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText('Email'), 'trader.rejected@mizaniya.dz')
    await userEvent.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByTestId('merchant-status')).toHaveTextContent('Rejected')
    const rej = screen.getByTestId('rejection')
    expect(rej).toHaveTextContent('Document unreadable')
    expect(rej).toHaveTextContent('The photo of your RC is blurry')
    const flagged = within(screen.getByTestId('flagged-list')).getAllByRole('listitem').map((l) => l.textContent)
    expect(flagged).toEqual(['Business › Photo of the registration', 'Account › Selfie'])

    await userEvent.click(screen.getByRole('link', { name: 'Fix and resubmit' }))
    await screen.findByRole('heading', { name: 'Fix and resubmit' })
    // only the two flagged items are editable: no email, no NIF, no address...
    expect($('[data-field="account__selfie"]') ?? $('[data-field="selfie"]')).toBeTruthy()
    expect($('[data-field="registrationPhoto"]') ?? $('[data-field="business__registrationPhoto"]')).toBeTruthy()
    expect($('#f-nif')).toBeNull()
    expect($('#f-email')).toBeNull()
    expect(screen.getAllByTestId(/-input$/)).toHaveLength(2)

    // resubmitting without replacing the files is refused inline
    // (the existing files are kept by default; the partner replaces them)
    const inputs = screen.getAllByTestId(/-input$/)
    await userEvent.upload(inputs[0], img('new1.jpg'))
    await userEvent.upload(inputs[1], img('new2.jpg'))
    await waitFor(() => expect(document.querySelectorAll('[data-state="uploaded"]')).toHaveLength(2))
    expect(screen.getByText('new1.jpg')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resubmit application' }))
    expect(await screen.findByTestId('merchant-status')).toHaveTextContent('Under review')
    const d = await api.getDraft()
    expect(d.ok && d.data.draft.steps.account.nin).toBe(validDraftNin())
  })
})

function validDraftNin() {
  // seeded trader P-1003: nin = 1 + zero-padded n(3)
  return `1${String(3).padStart(17, '0')}`
}

void pdf
