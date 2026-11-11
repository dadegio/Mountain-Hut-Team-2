import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreateSlotForm from '../../../src/components/slots/CreateSlotForm'
import { createSlot, getSlots } from '../../../src/api/slots.ts'
import type { Table, TimeSlot } from '../../../src/types/slot.ts'

// Only the calls to the backend are replaced: the form logic is the real one
vi.mock('../../../src/api/slots.ts', () => ({
  createSlot: vi.fn(),
  getSlots: vi.fn(),
}))

const FUTURE_DAY = '2099-01-15'
const PAST_DAY = '2020-01-15'

const tables: Table[] = [
  { id: 1, code: 'T1', seats: 2 },
  { id: 2, code: 'T2', seats: 4 },
  { id: 3, code: 'T3', seats: 8 },
]

function createdSlot(overrides: Partial<TimeSlot> = {}): TimeSlot {
  return {
    id: 10,
    date: FUTURE_DAY,
    from: '09:30',
    to: '11:30',
    totalSeats: 2,
    tables: [tables[0]],
    ...overrides,
  }
}

function renderForm(date = FUTURE_DAY) {
  const onCreated = vi.fn()
  render(<CreateSlotForm date={date} tables={tables} onCreated={onCreated} />)
  return { onCreated, user: userEvent.setup() }
}

const tile = (code: string) =>
  screen.getByRole('button', { name: new RegExp(`^${code}`) })
const createButton = () =>
  screen.getByRole('button', { name: /^Create slot/ })
// The summary next to the button, not any other number on the page
const seatsSummary = () => screen.getByText(/· \d+ tables/).closest('p')

describe('CreateSlotForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('seats', () => {
    it('starts with no tables selected and 0 seats', () => {
      renderForm()

      expect(seatsSummary()).toHaveTextContent(/^0 seats/)
      expect(tile('T1')).toHaveAttribute('aria-pressed', 'false')
    })

    it('adds up the seats of the selected tables', async () => {
      const { user } = renderForm()

      await user.click(tile('T1'))
      expect(seatsSummary()).toHaveTextContent(/^2 seats/)

      await user.click(tile('T2'))
      expect(seatsSummary()).toHaveTextContent(/^6 seats/)
      expect(tile('T2')).toHaveAttribute('aria-pressed', 'true')
    })

    it('removes the seats when a table is clicked again', async () => {
      const { user } = renderForm()

      await user.click(tile('T1'))
      await user.click(tile('T2'))
      await user.click(tile('T1'))

      expect(seatsSummary()).toHaveTextContent(/^4 seats/)
      expect(tile('T1')).toHaveAttribute('aria-pressed', 'false')
    })

    it('selects every table with All and none with None', async () => {
      const { user } = renderForm()

      await user.click(screen.getByRole('button', { name: 'All' }))
      expect(seatsSummary()).toHaveTextContent(/^14 seats/)

      await user.click(screen.getByRole('button', { name: 'None' }))
      expect(seatsSummary()).toHaveTextContent(/^0 seats/)
    })
  })

  describe('time', () => {
    it('fills both times with a preset', async () => {
      const { user } = renderForm()

      await user.click(screen.getByRole('button', { name: /^Lunch/ }))

      expect(screen.getByLabelText('Start')).toHaveValue('12:00')
      expect(screen.getByLabelText('End')).toHaveValue('14:00')
      expect(createButton()).toHaveTextContent('Create slot 12:00–14:00')
    })

    it('tidies up a typed time when leaving the field', async () => {
      const { user } = renderForm()

      await user.type(screen.getByLabelText('Start'), '930')
      await user.tab()

      expect(screen.getByLabelText('Start')).toHaveValue('09:30')
    })

    it('marks an impossible time when leaving the field', async () => {
      const { user } = renderForm()
      const start = screen.getByLabelText('Start')

      await user.type(start, '25')
      expect(start).toHaveAttribute('aria-invalid', 'false')

      await user.tab()
      expect(start).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('creating a slot', () => {
    async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('Start'), '930')
      await user.type(screen.getByLabelText('End'), '11.30')
      await user.click(tile('T1'))
      await user.click(createButton())
    }

    it('sends tidy times and the selected tables, then resets the form', async () => {
      vi.mocked(createSlot).mockResolvedValue(createdSlot())
      const { onCreated, user } = renderForm()

      await fillAndSubmit(user)

      expect(createSlot).toHaveBeenCalledWith({
        date: FUTURE_DAY,
        from: '09:30',
        to: '11:30',
        tableIds: [1],
      })
      expect(onCreated).toHaveBeenCalledWith(createdSlot())
      expect(screen.getByText(/Slot 09:30–11:30 created/)).toBeInTheDocument()
      expect(screen.getByLabelText('Start')).toHaveValue('')
      expect(tile('T1')).toHaveAttribute('aria-pressed', 'false')
    })

    // Enter submits while still in the field, before the time is tidied up on blur
    it('sends a tidy start time when pressing Enter in the field', async () => {
      vi.mocked(createSlot).mockResolvedValue(createdSlot())
      const { user } = renderForm()

      await user.type(screen.getByLabelText('End'), '1130')
      await user.type(screen.getByLabelText('Start'), '930{Enter}')

      expect(createSlot).toHaveBeenCalledWith(
        expect.objectContaining({ from: '09:30', to: '11:30' }),
      )
    })

    it('sends a tidy end time when pressing Enter in the field', async () => {
      vi.mocked(createSlot).mockResolvedValue(createdSlot())
      const { user } = renderForm()

      await user.type(screen.getByLabelText('Start'), '930')
      await user.type(screen.getByLabelText('End'), '11.30{Enter}')

      expect(createSlot).toHaveBeenCalledWith(
        expect.objectContaining({ from: '09:30', to: '11:30' }),
      )
    })

    it('does not call the backend when a time is impossible', async () => {
      const { user } = renderForm()

      await user.type(screen.getByLabelText('Start'), '25')
      await user.type(screen.getByLabelText('End'), '26')
      await user.click(createButton())

      expect(createSlot).not.toHaveBeenCalled()
      expect(screen.getByText(/Check the times/)).toBeInTheDocument()
    })

    it('shows the backend error and keeps what was entered', async () => {
      vi.mocked(createSlot).mockRejectedValue(
        new Error('Slot overlaps with existing slot 09:00-10:00'),
      )
      const { onCreated, user } = renderForm()

      await fillAndSubmit(user)

      expect(
        screen.getByText('Slot overlaps with existing slot 09:00-10:00'),
      ).toBeInTheDocument()
      expect(onCreated).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Start')).toHaveValue('09:30')
      expect(tile('T1')).toHaveAttribute('aria-pressed', 'true')
    })

    it('can create a slot without tables, warning about the 0 seats', async () => {
      vi.mocked(createSlot).mockResolvedValue(
        createdSlot({ totalSeats: 0, tables: [] }),
      )
      const { user } = renderForm()

      expect(screen.queryByText(/0 seats: nobody/)).not.toBeInTheDocument()

      await user.type(screen.getByLabelText('Start'), '9')
      await user.type(screen.getByLabelText('End'), '10')
      expect(screen.getByText(/0 seats: nobody/)).toBeInTheDocument()

      await user.click(createButton())
      expect(createSlot).toHaveBeenCalledWith(
        expect.objectContaining({ tableIds: [] }),
      )
    })

    it('does not allow creating a slot on a past day', () => {
      renderForm(PAST_DAY)

      expect(createButton()).toBeDisabled()
      expect(screen.getByText(/in the past/)).toBeInTheDocument()
    })
  })

  describe('copying tables from another slot', () => {
    const lunchSlot = createdSlot({
      id: 20,
      date: '2099-01-14',
      from: '12:00',
      to: '14:00',
      totalSeats: 6,
      tables: [tables[0], tables[1]],
    })

    it('selects the tables of the chosen slot and says where they come from', async () => {
      vi.mocked(getSlots).mockResolvedValue([lunchSlot])
      const { user } = renderForm()

      await user.click(
        screen.getByRole('button', { name: /Copy from another slot/ }),
      )
      expect(getSlots).toHaveBeenCalledWith('2099-01-14')

      const slotButton = await screen.findByRole('button', {
        name: /12:00–14:00 · 6 seats/,
      })
      expect(slotButton).toHaveTextContent('T1, T2')
      await user.click(slotButton)

      expect(tile('T1')).toHaveAttribute('aria-pressed', 'true')
      expect(tile('T2')).toHaveAttribute('aria-pressed', 'true')
      expect(tile('T3')).toHaveAttribute('aria-pressed', 'false')
      expect(seatsSummary()).toHaveTextContent(/^6 seats/)
      expect(screen.getByText(/Copied from .*12:00–14:00/)).toBeInTheDocument()
    })

    it('forgets where the tables come from once they are changed', async () => {
      vi.mocked(getSlots).mockResolvedValue([lunchSlot])
      const { user } = renderForm()

      await user.click(
        screen.getByRole('button', { name: /Copy from another slot/ }),
      )
      await user.click(
        await screen.findByRole('button', { name: /12:00–14:00 · 6 seats/ }),
      )
      await user.click(tile('T3'))

      expect(screen.queryByText(/Copied from/)).not.toBeInTheDocument()
    })

    it('does not let you copy from a slot without tables', async () => {
      vi.mocked(getSlots).mockResolvedValue([
        createdSlot({ id: 21, from: '19:00', to: '21:00', totalSeats: 0, tables: [] }),
      ])
      const { user } = renderForm()

      await user.click(
        screen.getByRole('button', { name: /Copy from another slot/ }),
      )

      expect(
        await screen.findByRole('button', { name: /19:00–21:00 · 0 seats/ }),
      ).toBeDisabled()
    })
  })
})
