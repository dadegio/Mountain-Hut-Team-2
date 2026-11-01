import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock import.meta.env so VITE_USE_MOCKS=true
vi.stubEnv('VITE_USE_MOCKS', 'true')

// Dynamic import so the stub is in place before the module loads
const { getSlots, getMyBookings, createBooking } = await import('../api/bookings')

describe('bookings API (mock mode)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('getSlots returns mock slots', async () => {
    const promise = getSlots('2026-12-15')
    vi.runAllTimersAsync()
    const slots = await promise
    expect(slots).toHaveLength(2)
    expect(slots[0]).toMatchObject({ id: 1, available: true })
    expect(slots[1]).toMatchObject({ id: 2, available: false })
  })

  it('getMyBookings returns mock bookings', async () => {
    const promise = getMyBookings()
    vi.runAllTimersAsync()
    const bookings = await promise
    expect(bookings).toHaveLength(2)
    expect(bookings[0].status).toBe('confirmed')
    expect(bookings[1].status).toBe('cancelled')
  })

  it('createBooking returns a confirmed booking with the given data', async () => {
    const req = { date: '2026-12-25', slotId: 1, partySize: 3 }
    const promise = createBooking(req)
    vi.runAllTimersAsync()
    const booking = await promise
    expect(booking.status).toBe('confirmed')
    expect(booking.date).toBe('2026-12-25')
    expect(booking.partySize).toBe(3)
  })
})
