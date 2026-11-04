import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock import.meta.env so VITE_USE_MOCKS=true
vi.stubEnv('VITE_USE_MOCKS', 'true')

// Dynamic import so the stub is in place before the module loads
const { getMyBookings, createBooking, createStaffBooking } = await import('../api/bookings')
const { ApiError } = await import('../api/client')

// Minimal fake of a fetch Response
function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

describe('bookings API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('getMyBookings returns mock bookings', async () => {
    const promise = getMyBookings()
    vi.runAllTimersAsync()
    const bookings = await promise
    expect(bookings).toHaveLength(2)
    expect(bookings[0].status).toBe('confirmed')
    expect(bookings[1].status).toBe('cancelled')
  })

  it('createStaffBooking sends POST /api/staff/bookings with the hiker, slot and party', async () => {
    const result = {
      status: 'PLACED',
      userId: 7,
      slotId: 3,
      partySize: 4,
      reservations: [{ reservationId: 1, tableId: 3, seats: 4 }],
    }
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(201, result))
    vi.stubGlobal('fetch', fetchMock)

    const booking = await createStaffBooking({ hikerId: 7, slotId: 3, partySize: 4 })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/staff/bookings')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ hikerId: 7, slotId: 3, partySize: 4 })
    expect(booking).toEqual(result)
  })

  it('createBooking sends POST /api/bookings with slotId and partySize', async () => {
    const result = {
      status: 'PLACED',
      userId: 2,
      slotId: 3,
      partySize: 4,
      reservations: [{ reservationId: 1, tableId: 3, seats: 4 }],
    }
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(201, result))
    vi.stubGlobal('fetch', fetchMock)

    const booking = await createBooking(3, 4)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/bookings')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ slotId: 3, partySize: 4 })
    expect(booking).toEqual(result)
  })

  it('createBooking throws ApiError with status and backend message on 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fakeResponse(409, { error: 'Not enough seats' })),
    )

    const error = await createBooking(3, 30).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.message).toBe('Not enough seats')
  })
})