import { fastify } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { errorHandler } from './error-handler'
import { rateLimit } from './middlewares/rate-limit'

async function buildApp() {
  const app = fastify()

  app.setErrorHandler(errorHandler)
  app.get('/limited', { onRequest: rateLimit({ max: 10, windowMs: 60_000 }) }, async () => ({ ok: true }))
  app.get('/free', async () => ({ ok: true }))

  await app.ready()
  return app
}

afterEach(() => {
  vi.useRealTimers()
})

describe('rate limit', () => {
  it('rate limit returns 429 after 10 requests and recovers next window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-16T15:00:00Z'))
    const app = await buildApp()

    for (let i = 0; i < 10; i++) {
      expect((await app.inject({ method: 'GET', url: '/limited' })).statusCode).toBe(200)
    }
    const blocked = await app.inject({ method: 'GET', url: '/limited' })

    expect(blocked.statusCode).toBe(429)
    expect(blocked.json()).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' })

    vi.setSystemTime(new Date('2026-11-16T15:01:01Z'))

    expect((await app.inject({ method: 'GET', url: '/limited' })).statusCode).toBe(200)
  })

  it('rate limit counts each origin separately and leaves other routes alone', async () => {
    const app = await buildApp()

    for (let i = 0; i < 10; i++) {
      await app.inject({ method: 'GET', url: '/limited', remoteAddress: '10.0.0.1' })
    }

    expect((await app.inject({ method: 'GET', url: '/limited', remoteAddress: '10.0.0.1' })).statusCode).toBe(429)
    expect((await app.inject({ method: 'GET', url: '/limited', remoteAddress: '10.0.0.2' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/free', remoteAddress: '10.0.0.1' })).statusCode).toBe(200)
  })

  it('rate limit keeps a separate counter for every limiter instance', async () => {
    const first = await buildApp()
    const second = await buildApp()

    for (let i = 0; i < 11; i++) {
      await first.inject({ method: 'GET', url: '/limited' })
    }

    expect((await second.inject({ method: 'GET', url: '/limited' })).statusCode).toBe(200)
  })
})
