import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ErrorSummary } from '@/components/form/ErrorSummary'
import { Field } from '@/components/form/Field'
import { Input } from '@/components/ui/input'

describe('Field', () => {
  it('wires label, hint and error to the control (aria-invalid / aria-describedby)', () => {
    render(
      <Field name="rc" label="RC number" hint="As on your registre" error="This RC is already registered.">
        {(aria) => <Input {...aria} />}
      </Field>,
    )
    const input = screen.getByLabelText('RC number')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const described = input.getAttribute('aria-describedby')!.split(' ')
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual(
      expect.arrayContaining(['As on your registre', 'This RC is already registered.']),
    )
  })

  it('is valid and undescribed without an error', () => {
    render(<Field name="x" label="X">{(aria) => <Input {...aria} />}</Field>)
    const input = screen.getByLabelText('X')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })
})

describe('ErrorSummary', () => {
  it('lists each error as a link that focuses the field, and takes focus itself', async () => {
    render(
      <>
        <ErrorSummary focusKey={1} items={[{ name: 'rc', label: 'RC number', message: 'This RC is already registered.' }]} />
        <Field name="rc" label="RC number">{(aria) => <Input {...aria} />}</Field>
      </>,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveFocus()
    await userEvent.click(screen.getByRole('link', { name: 'RC number' }))
    expect(screen.getByLabelText('RC number')).toHaveFocus()
  })

  it('renders nothing without errors', () => {
    render(<ErrorSummary focusKey={0} items={[]} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
