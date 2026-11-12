import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch } from '../../../src/shared/api/client.ts'

const fetchMock = vi.fn()

function respondWith(body: string, status: number) {
  fetchMock.mockResolvedValue(new Response(body, { status }))
}

// The error thrown by apiFetch, so that its fields can be checked
async function errorOf(request: Promise<unknown>): Promise<ApiError> {
  const error = await request.catch((err: unknown) => err)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

describe('apiFetch', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('successful responses', () => {
    it('returns the parsed JSON body', async () => {
      respondWith(JSON.stringify([{ id: 1, code: 'T1', seats: 2 }]), 200)

      await expect(apiFetch('/tables')).resolves.toEqual([
        { id: 1, code: 'T1', seats: 2 },
      ])
    })

    it('calls the path under /api/v1, sending JSON', async () => {
      respondWith('[]', 200)

      await apiFetch('/tables')

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/tables', {
        headers: { 'Content-Type': 'application/json' },
      })
    })

    it('passes on the method and the body of the request', async () => {
      respondWith('{}', 201)
      const body = JSON.stringify({ code: 'T7', seats: 10 })

      await apiFetch('/tables', { method: 'POST', body })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/tables',
        expect.objectContaining({ method: 'POST', body }),
      )
    })
  })

  describe('error responses', () => {
    it('uses the message sent by the backend', async () => {
      respondWith(JSON.stringify({ error: 'Time slot not found' }), 404)

      const error = await errorOf(apiFetch('/slots/99'))

      expect(error.message).toBe('Time slot not found')
      expect(error.status).toBe(404)
    })

    it('adds the validation details to the message', async () => {
      respondWith(
        JSON.stringify({
          error: 'Invalid request body',
          details: [
            { message: "'from' must be before 'to'" },
            { message: 'tableIds must not contain duplicates' },
          ],
        }),
        400,
      )

      const error = await errorOf(apiFetch('/slots'))

      expect(error.message).toBe(
        "Invalid request body: 'from' must be before 'to'; tableIds must not contain duplicates",
      )
      expect(error.status).toBe(400)
    })

    it('ignores details that are empty or not a list', async () => {
      respondWith(JSON.stringify({ error: 'Conflict', details: [] }), 409)
      expect((await errorOf(apiFetch('/slots'))).message).toBe('Conflict')

      respondWith(JSON.stringify({ error: 'Conflict', details: 'x' }), 409)
      expect((await errorOf(apiFetch('/slots'))).message).toBe('Conflict')
    })

    it('falls back to the raw text when the JSON has no error field', async () => {
      const body = JSON.stringify({ message: 'Body is not valid JSON' })
      respondWith(body, 400)

      const error = await errorOf(apiFetch('/slots'))

      expect(error.message).toBe(`API error 400: ${body}`)
    })

    it('falls back to the raw text when the answer is not JSON', async () => {
      respondWith('Bad Gateway', 502)

      const error = await errorOf(apiFetch('/slots'))

      expect(error.message).toBe('API error 502: Bad Gateway')
      expect(error.status).toBe(502)
    })

    it('throws an error that other code can treat as a normal Error', async () => {
      respondWith(JSON.stringify({ error: 'Conflict' }), 409)

      const error = await errorOf(apiFetch('/slots'))

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('ApiError')
    })
  })
})
