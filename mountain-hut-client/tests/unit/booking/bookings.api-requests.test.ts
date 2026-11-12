import { describe, it, expect, vi, afterEach } from 'vitest'
import { changeBooking, createBooking, getMyBookings } from '../../../src/booking/api/bookings-api.ts'
import { ApiError } from '../../../src/shared/api/client.ts'

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
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getMyBookings calls GET /api/v1/bookings/mine and returns the list', async () => {
    const data = [
      {
        id: 12,
        date: '2026-11-05',
        slotId: 15,
        from: '19:00',
        to: '21:00',
        partySize: 2,
        status: 'PLACED',
        createdAt: '2026-11-04 14:14:03',
        reservations: [{ reservationId: 12, tableId: 19, seats: 2 }],
      },
    ]
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, data))
    vi.stubGlobal('fetch', fetchMock)

    const bookings = await getMyBookings()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/bookings/mine')
    expect(bookings).toEqual(data)
  })

  it('createBooking sends POST /api/v1/bookings with slotId and partySize', async () => {
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
    expect(url).toBe('/api/v1/bookings')
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

  it('createBooking sends allergenIds and a trimmed description when given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(201, { status: 'PLACED' }))
    vi.stubGlobal('fetch', fetchMock)

    await createBooking(3, 2, { allergenIds: [9, 14], description: '  one vegetarian  ' })

    const [, options] = fetchMock.mock.calls[0]
    expect(JSON.parse(options.body)).toEqual({
      slotId: 3,
      partySize: 2,
      allergenIds: [9, 14],
      description: 'one vegetarian',
    })
  })

  it('createBooking leaves out empty allergens and blank description', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(201, { status: 'PLACED' }))
    vi.stubGlobal('fetch', fetchMock)

    await createBooking(3, 2, { allergenIds: [], description: '   ' })

    const [, options] = fetchMock.mock.calls[0]
    expect(JSON.parse(options.body)).toEqual({ slotId: 3, partySize: 2 })
  })

  it('changeBooking sends PATCH /api/v1/bookings/:id with only the changed fields', async () => {
    const result = {
      bookingId: 12,
      status: 'PLACED',
      userId: 2,
      slotId: 16,
      partySize: 4,
      reservations: [{ reservationId: 12, tableId: 3, seats: 4 }],
    }
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, result))
    vi.stubGlobal('fetch', fetchMock)

    const changed = await changeBooking(12, { slotId: 16, partySize: 4 })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/bookings/12')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ slotId: 16, partySize: 4 })
    expect(changed).toEqual(result)
  })

  it('changeBooking throws ApiError when the change window has expired', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        fakeResponse(409, { error: 'Booking change window has expired (48 hours after creation)' }),
      ),
    )

    const error = await changeBooking(12, { partySize: 3 }).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.message).toContain('48 hours')
  })
})