import { describe, it, expect, afterAll } from 'vitest'
import { buildApp } from '../server.ts'

describe('server test', () => {
  const app = buildApp({ logger: false })

  afterAll(async () => {
    await app.close()
  })

  it('GET / returns 200 with hello world', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ hello: 'world' })
  })
})
