import { describe, it, expect } from 'vitest'
import { changeBlockReason, createdAtMs, isPast } from '../../../src/utils/booking-rules.ts'
import type { MyBooking } from '../../../src/types/booking.ts'

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

  it('allows a change within 48h of booking and well before the slot', () => {
    expect(changeBlockReason(booking(), at('2026-11-05T10:00:00Z'))).toBeNull()
  })

  it('blocks a change more than 48h after booking', () => {
    expect(changeBlockReason(booking(), at('2026-11-06T14:00:01Z'))).toBe('window-expired')
  })

  it('blocks a change less than 2h before the slot', () => {
    const b = booking({ date: '2026-11-05', from: '19:00' })
    expect(changeBlockReason(b, new Date('2026-11-05T18:00:00').getTime())).toBe('too-close')
  })

  it('blocks a cancelled booking', () => {
    expect(changeBlockReason(booking({ status: 'CANCELED' }), at('2026-11-05T10:00:00Z'))).toBe('not-placed')
  })

  it('blocks a fulfilled booking', () => {
  expect(changeBlockReason(booking({ status: 'FULFILLED' }), at('2026-11-05T10:00:00Z'))).toBe('not-placed')
  })

  it('detects past bookings', () => {
    const b = booking({ date: '2026-11-05', from: '19:00' })
    expect(isPast(b, new Date('2026-11-05T20:00:00').getTime())).toBe(true)
    expect(isPast(b, new Date('2026-11-05T12:00:00').getTime())).toBe(false)
  })
})