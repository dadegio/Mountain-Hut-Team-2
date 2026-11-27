import { describe, it, expect } from 'vitest'
import { changeBlockReason, createdAtMs, isPast } from '../../../src/booking/rules/booking-rules.ts'
import type { MyBooking } from '../../../src/booking/types/booking.ts'

const booking = (overrides: Partial<MyBooking> = {}): MyBooking => ({
  id: 1,
  date: '2026-11-10',
  slotId: 1,
  from: '19:00',
  to: '21:00',
  partySize: 2,
  status: 'PLACED',
  createdAt: '2026-11-04 14:00:00',
  reservations: [],
  ...overrides,
})

const at = (iso: string) => new Date(iso).getTime()

describe('booking rules', () => {
  it('reads createdAt as UTC', () => {
    expect(createdAtMs('2026-11-04 14:00:00')).toBe(Date.UTC(2026, 10, 4, 14, 0, 0))
  })

  it('allows a change more than 48 hours before the slot even if booked days ago', () => {
    expect(changeBlockReason(booking(), at('2026-11-07T18:00:00Z'))).toBeNull()
  })

  it('allows a change exactly 48 hours before the slot in Rome', () => {
    expect(changeBlockReason(booking(), at('2026-11-08T18:00:00Z'))).toBeNull()
  })

  it('blocks a change one millisecond inside the 48-hour window', () => {
    expect(changeBlockReason(booking(), at('2026-11-08T18:00:00.001Z'))).toBe('window-expired')
  })

  it('blocks a change less than 2 hours before the slot too', () => {
    expect(changeBlockReason(booking(), at('2026-11-10T17:00:00Z'))).toBe('window-expired')
  })

  it('blocks a cancelled booking', () => {
    expect(changeBlockReason(booking({ status: 'CANCELED' }), at('2026-11-05T10:00:00Z'))).toBe('not-placed')
  })

  it('blocks a fulfilled booking', () => {
  expect(changeBlockReason(booking({ status: 'FULFILLED' }), at('2026-11-05T10:00:00Z'))).toBe('not-placed')
  })

  it('detects past bookings', () => {
    const b = booking({ date: '2026-11-05', from: '19:00' })
    expect(isPast(b, at('2026-11-05T19:00:00Z'))).toBe(true)
    expect(isPast(b, at('2026-11-05T11:00:00Z'))).toBe(false)
  })
})