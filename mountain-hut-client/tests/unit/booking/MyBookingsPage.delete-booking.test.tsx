import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyBookingsPage from '../../../src/booking/pages/MyBookingsPage.tsx'
import { cancelBooking, getMyBookings } from '../../../src/booking/api/bookings-api.ts'
import { getTables } from '../../../src/slots/api/slots-api.ts'
import type { MyBooking } from '../../../src/booking/types/booking.ts'

vi.mock('../../../src/booking/api/bookings-api.ts', () => ({
  getMyBookings: vi.fn(),
  cancelBooking: vi.fn(),
}))

vi.mock('../../../src/slots/api/slots-api.ts', () => ({
  getTables: vi.fn(),
}))

function createBooking(overrides: Partial<MyBooking> = {}, daysAhead = 4): MyBooking {
  const tomorrow = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  const yyyy = tomorrow.getFullYear()
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const dd = String(tomorrow.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}-${mm}-${dd}`

  return {
    id: 1,
    date: dateStr,
    slotId: 2,
    from: '12:00',
    to: '13:00',
    partySize: 2,
    status: 'PLACED',
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    reservations: [{ reservationId: 1, tableId: 1, seats: 2 }],
    ...overrides,
  }
}

describe('MyBookingsPage — Delete / Cancel booking (MH-107)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTables).mockResolvedValue([
      { id: 1, code: 'T1', seats: 4 },
      { id: 2, code: 'T2', seats: 6 },
    ])
  })

  it('renders a Delete button next to the Change button for upcoming placed bookings', async () => {
    const booking = createBooking({ id: 42 })
    vi.mocked(getMyBookings).mockResolvedValue([booking])

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
    })

    const deleteBtn = screen.getByRole('button', { name: 'Delete' })
    expect(deleteBtn).toBeInTheDocument()
    // Verify it is placed inside the same container next to Change
    expect(deleteBtn.previousElementSibling).toBe(screen.getByRole('button', { name: 'Change' }))
  })

  it('calls cancelBooking when Delete is clicked, displays notice and reloads list', async () => {
    const user = userEvent.setup()
    const activeBooking = createBooking({ id: 42, partySize: 2 })
    const cancelledBooking = createBooking({ id: 42, partySize: 2, status: 'CANCELED' })

    vi.mocked(getMyBookings)
      .mockResolvedValueOnce([activeBooking])
      .mockResolvedValueOnce([cancelledBooking])
    vi.mocked(cancelBooking).mockResolvedValue({ id: 42, status: 'CANCELED' })

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>,
    )

    const deleteBtn = await screen.findByRole('button', { name: 'Delete' })
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(cancelBooking).toHaveBeenCalledTimes(1)
      expect(cancelBooking).toHaveBeenCalledWith(42)
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Your booking has been cancelled.')
    })

    // Booking list reloaded and now shows Cancelled badge in past & cancelled
    expect(getMyBookings).toHaveBeenCalledTimes(2)
  })

  it('displays error alert if cancelBooking fails and leaves booking in list', async () => {
    const user = userEvent.setup()
    const activeBooking = createBooking({ id: 42 })
    vi.mocked(getMyBookings).mockResolvedValue([activeBooking])
    vi.mocked(cancelBooking).mockRejectedValue(new Error('Time slot has already started'))

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>,
    )

    const deleteBtn = await screen.findByRole('button', { name: 'Delete' })
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load your bookings: Time slot has already started')
    })
  })

  it('renders Delete button even when the 48-hour change window has expired', async () => {
    // Slot is tomorrow: change is blocked, cancel is allowed regardless of creation time
    const expiredChangeBooking = createBooking({
      id: 77,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    }, 1)
    vi.mocked(getMyBookings).mockResolvedValue([expiredChangeBooking])

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Changes closed: less than 48 hours before your slot/i)).toBeInTheDocument()
    })

    // Change button must be hidden, but Delete button must be available
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('renders Delete button even when less than 2 hours before the slot', async () => {
    // Slot in 1 hour: change is blocked (too-close), cancel is allowed before slot starts
    const now = new Date()
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(inOneHour)
    const part = (type: string) => parts.find(p => p.type === type)!.value
    const yyyy = part('year'), mm = part('month'), dd = part('day')
    const from = `${part('hour')}:${part('minute')}`
    const to = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(inTwoHours)

    const tooCloseBooking = createBooking({
      id: 88,
      date: `${yyyy}-${mm}-${dd}`,
      from,
      to,
      createdAt: now.toISOString().replace('T', ' ').slice(0, 19),
    })
    vi.mocked(getMyBookings).mockResolvedValue([tooCloseBooking])

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Changes closed: less than 48 hours before your slot/i)).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('does not render Delete button for past or already cancelled bookings', async () => {
    const pastCancelledBooking = createBooking({
      id: 55,
      date: '2020-01-01',
      status: 'CANCELED',
    })
    vi.mocked(getMyBookings).mockResolvedValue([pastCancelledBooking])

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Cancelled')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
  })
})
