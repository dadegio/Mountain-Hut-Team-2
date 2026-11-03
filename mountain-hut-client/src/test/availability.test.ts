import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAvailability } from '../api/availability'
import { ApiError } from '../api/client'

// Minimal fake of a fetch Response
function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
  } as unknown as Response
}

describe('availability API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAvailability calls /api/availability with date and partySize', async () => {
    const response = {
      date: '2026-11-03',
      partySize: 4,
      slots: [
        {
          slotId: 3,
          from: '19:00',
          to: '21:00',
          availableSeats: 26,
          available: true,
          tables: [],
          allocation: [{ tableId: 3, code: 'T3', seats: 4 }],
        },
      ],
    }
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, response))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getAvailability('2026-11-03', 4)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/availability?date=2026-11-03&partySize=4')
    expect(result.slots).toHaveLength(1)
    expect(result.slots[0]).toMatchObject({ slotId: 3, available: true })
  })

  it('getAvailability throws ApiError on 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fakeResponse(400, { error: 'Invalid query parameters' })),
    )

    const error = await getAvailability('not-a-date', 4).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
  })
})