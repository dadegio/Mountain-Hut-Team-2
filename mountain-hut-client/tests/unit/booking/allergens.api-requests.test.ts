import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAllergens } from '../../../src/booking/api/allergens-api.ts'
import { ApiError } from '../../../src/shared/api/client.ts'

function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

describe('allergens API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAllergens calls GET /api/v1/allergens and returns the list', async () => {
    const list = [
      { id: 9, name: 'Milk' },
      { id: 14, name: 'Wheat' },
    ]
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, list))
    vi.stubGlobal('fetch', fetchMock)

    const allergens = await getAllergens()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/allergens')
    expect(allergens).toEqual(list)
  })

  it('getAllergens throws ApiError when the server fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(500, { error: 'Internal server error' })))

    const error = await getAllergens().catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(500)
  })
})