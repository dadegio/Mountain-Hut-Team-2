import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChangeBookingPanel from '../../../src/booking/components/ChangeBookingPanel'
import { getAvailability } from '../../../src/booking/api/availability-api.ts'
import { changeBooking } from '../../../src/booking/api/bookings-api.ts'
import type { MyBooking } from '../../../src/booking/types/booking.ts'

vi.mock('../../../src/booking/api/availability-api.ts', () => ({
  getAvailability: vi.fn(),
}))

vi.mock('../../../src/booking/api/bookings-api.ts', () => ({
  changeBooking: vi.fn(),
}))

function futureBooking(overrides: Partial<MyBooking> = {}): MyBooking {
  return {
    id: 12,
    date: '2099-01-15',
    slotId: 3,
    from: '12:00',
    to: '13:00',
    partySize: 2,
    status: 'PLACED',
    description: null,
    createdAt: '2099-01-14 10:00:00',
    reservations: [{ reservationId: 12, tableId: 1, seats: 2 }],
    ...overrides,
  }
}

describe('ChangeBookingPanel requirements editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAvailability).mockResolvedValue({
      date: '2099-01-15',
      partySize: 2,
      slots: [
        {
          slotId: 3,
          from: '12:00',
          to: '13:00',
          availableSeats: 4,
          available: true,
          tables: [],
          allocation: null,
        },
      ],
    })
  })

  it('starts unchecked and hides the textbox when booking has no notes, then saves added notes', async () => {
    vi.mocked(changeBooking).mockResolvedValue({
      bookingId: 12,
      status: 'PLACED',
      userId: 1,
      slotId: 3,
      partySize: 2,
      description: 'Celiac',
      reservations: [{ reservationId: 12, tableId: 1, seats: 2 }],
    })
    const onChanged = vi.fn()
    const user = userEvent.setup()

    render(
      <ChangeBookingPanel
        booking={futureBooking({ description: null })}
        onCancel={vi.fn()}
        onChanged={onChanged}
      />,
    )
    await screen.findByRole('button', { name: /12:00–13:00/ })

    const checkbox = screen.getByRole('checkbox', {
      name: /allergies, intolerances,? or special requests/i,
    })
    expect(checkbox).not.toBeChecked()
    expect(
      screen.queryByLabelText(/specify allergies, intolerances or notes/i),
    ).not.toBeInTheDocument()

    await user.click(checkbox)
    await user.type(
      screen.getByLabelText(/specify allergies, intolerances or notes/i),
      '  Celiac  ',
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(changeBooking).toHaveBeenCalledWith(12, { description: 'Celiac' })
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('prefills existing notes and sends updated notes on save', async () => {
    vi.mocked(changeBooking).mockResolvedValue({
      bookingId: 12,
      status: 'PLACED',
      userId: 1,
      slotId: 3,
      partySize: 2,
      description: 'Peanut and milk allergy',
      reservations: [{ reservationId: 12, tableId: 1, seats: 2 }],
    })
    const onChanged = vi.fn()
    const user = userEvent.setup()

    render(
      <ChangeBookingPanel
        booking={futureBooking({ description: 'Peanut allergy' })}
        onCancel={vi.fn()}
        onChanged={onChanged}
      />,
    )
    await screen.findByRole('button', { name: /12:00–13:00/ })

    const checkbox = screen.getByRole('checkbox', {
      name: /allergies, intolerances,? or special requests/i,
    })
    expect(checkbox).toBeChecked()

    const textbox = screen.getByLabelText(/specify allergies, intolerances or notes/i)
    expect(textbox).toHaveValue('Peanut allergy')

    await user.clear(textbox)
    await user.type(textbox, 'Peanut and milk allergy')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(changeBooking).toHaveBeenCalledWith(12, {
        description: 'Peanut and milk allergy',
      })
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('preserves text when unchecked and re-checked, and sends null if saved unchecked', async () => {
    vi.mocked(changeBooking).mockResolvedValue({
      bookingId: 12,
      status: 'PLACED',
      userId: 1,
      slotId: 3,
      partySize: 2,
      description: null,
      reservations: [{ reservationId: 12, tableId: 1, seats: 2 }],
    })
    const user = userEvent.setup()

    render(
      <ChangeBookingPanel
        booking={futureBooking({ description: 'Peanut allergy' })}
        onCancel={vi.fn()}
        onChanged={vi.fn()}
      />,
    )
    await screen.findByRole('button', { name: /12:00–13:00/ })

    const checkbox = screen.getByRole('checkbox', {
      name: /allergies, intolerances,? or special requests/i,
    })

    await user.click(checkbox)
    expect(
      screen.queryByLabelText(/specify allergies, intolerances or notes/i),
    ).not.toBeInTheDocument()

    await user.click(checkbox)
    expect(
      screen.getByLabelText(/specify allergies, intolerances or notes/i),
    ).toHaveValue('Peanut allergy')

    await user.click(checkbox)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(changeBooking).toHaveBeenCalledWith(12, { description: null })
    })
  })

  it('shows a validation message if nothing changed', async () => {
    const user = userEvent.setup()

    render(
      <ChangeBookingPanel
        booking={futureBooking({ description: 'Peanut allergy' })}
        onCancel={vi.fn()}
        onChanged={vi.fn()}
      />,
    )
    await screen.findByRole('button', { name: /12:00–13:00/ })

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByRole('alert')).toHaveTextContent("You haven't changed anything yet.")
    expect(changeBooking).not.toHaveBeenCalled()
  })
})
