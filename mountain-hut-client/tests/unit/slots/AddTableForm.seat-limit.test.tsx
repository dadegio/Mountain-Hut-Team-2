import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AddTableForm from '../../../src/slots/components/AddTableForm'
import { createTable } from '../../../src/slots/api/slots-api.ts'

// Only the call to the backend is replaced: the form logic is the real one
vi.mock('../../../src/slots/api/slots-api.ts', () => ({
  createTable: vi.fn(),
}))

function renderForm() {
  const onCreated = vi.fn()
  render(<AddTableForm onCreated={onCreated} />)
  return { onCreated, user: userEvent.setup() }
}

const codeField = () => screen.getByLabelText('Table code')
const seatsField = () => screen.getByLabelText(/^Seats/)
const addButton = () => screen.getByRole('button', { name: 'Add table' })

describe('AddTableForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a table and resets the form', async () => {
    const table = { id: 4, code: 'T4', seats: 8 }
    vi.mocked(createTable).mockResolvedValue(table)
    const { onCreated, user } = renderForm()

    await user.type(codeField(), ' T4 ')
    await user.type(seatsField(), '8')
    await user.click(addButton())

    expect(createTable).toHaveBeenCalledWith({ code: 'T4', seats: 8 })
    expect(onCreated).toHaveBeenCalledWith(table)
    expect(codeField()).toHaveValue('')
    expect(seatsField()).toHaveValue(null)
  })

  describe('seat limit (MH-89)', () => {
        it('shows the allowed range as a hint in the field', () => {
      renderForm()

      expect(seatsField()).toHaveAttribute('max', '20')
      expect(seatsField()).toHaveAttribute('placeholder', '1–20')
    })

    it('keeps only the first two digits', async () => {
      const { user } = renderForm()

      await user.type(seatsField(), '56789')

      expect(seatsField()).toHaveValue(56)
    })

    it('ignores signs, decimals and letters', async () => {
      const { user } = renderForm()

      await user.type(seatsField(), '-1.e5')

      expect(seatsField()).toHaveValue(15)
    })

    it('accepts 20 seats, the maximum', async () => {
      vi.mocked(createTable).mockResolvedValue({ id: 4, code: 'T4', seats: 20 })
      const { user } = renderForm()

      await user.type(codeField(), 'T4')
      await user.type(seatsField(), '20')
      await user.click(addButton())

      expect(createTable).toHaveBeenCalledWith({ code: 'T4', seats: 20 })
    })

    it('does not call the backend for more than 20 seats', async () => {
      const { onCreated, user } = renderForm()

      await user.type(codeField(), 'T4')
      await user.type(seatsField(), '21')
      // Submitted directly, so the form's own check runs even where the
      // browser validation would already have blocked the click
      fireEvent.submit(addButton().closest('form')!)

      expect(createTable).not.toHaveBeenCalled()
      expect(onCreated).not.toHaveBeenCalled()
      expect(
        screen.getByText(/Seats must be a whole number between 1 and 20/),
      ).toBeInTheDocument()
    })
  })

  it('shows the backend error and keeps what was entered', async () => {
    vi.mocked(createTable).mockRejectedValue(
      new Error('Table code T1 already exists'),
    )
    const { onCreated, user } = renderForm()

    await user.type(codeField(), 'T1')
    await user.type(seatsField(), '4')
    await user.click(addButton())

    expect(screen.getByText(/Table code T1 already exists/)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
    expect(codeField()).toHaveValue('T1')
    expect(seatsField()).toHaveValue(4)
  })
})