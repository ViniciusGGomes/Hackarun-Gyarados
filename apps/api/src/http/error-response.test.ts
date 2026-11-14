import { fastify } from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { errorHandler } from './error-handler'
import { AppError } from './routes/_errors/app-error'
import { AccountLockedError } from './routes/_errors/account-locked-error'
import { BadRequestError } from './routes/_errors/bad-request-error'
import { ForbiddenError } from './routes/_errors/forbidden-error'
import { InvalidCredentialsError } from './routes/_errors/invalid-credentials-error'
import { UnauthorizedError } from './routes/_errors/unauthorized-error'

async function buildApp() {
  const app = fastify()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(errorHandler)

  app.get('/unauthorized', async () => {
    throw new UnauthorizedError('Invalid auth token')
  })
  app.get('/forbidden', async () => {
    throw new ForbiddenError()
  })
  app.get('/bad-request', async () => {
    throw new BadRequestError('Bad input')
  })
  app.get('/invalid-credentials', async () => {
    throw new InvalidCredentialsError()
  })
  app.get('/app-error/:status', async (request) => {
    const { status } = request.params as { status: string }
    const codes: Record<string, string> = { '400': 'OUTSIDE_OPENING_HOURS', '409': 'SLOT_UNAVAILABLE', '429': 'TOO_MANY_REQUESTS' }
    throw new AppError(Number(status), codes[status], `msg ${status}`)
  })
  app.get('/boom', async () => {
    throw Object.assign(new Error('duplicate key value (phone)=(63999998888)'), { code: 'P2002' })
  })
  app.get('/locked', async () => {
    throw new AccountLockedError()
  })
  app.withTypeProvider<ZodTypeProvider>().post(
    '/validated',
    { schema: { body: z.object({ email: z.email() }) } },
    async () => ({ ok: true }),
  )

  await app.ready()
  return app
}

describe('auth errors use the ErrorResponse format', () => {
  it('UnauthorizedError becomes 401 UNAUTHORIZED', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/unauthorized' })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Invalid auth token' })
  })

  it('ForbiddenError becomes 403 FORBIDDEN', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/forbidden' })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' })
  })

  it('BadRequestError becomes 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/bad-request' })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Bad input' })
  })

  it('InvalidCredentialsError becomes 401 INVALID_CREDENTIALS', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/invalid-credentials' })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' })
  })

  it('AccountLockedError becomes 423 ACCOUNT_LOCKED', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/locked' })

    expect(response.statusCode).toBe(423)
    expect(response.json()).toMatchObject({ statusCode: 423, code: 'ACCOUNT_LOCKED' })
  })

  it('schema validation failure becomes 400 VALIDATION_ERROR with details', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'POST', url: '/validated', payload: { email: 'not-an-email' } })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
    expect(response.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email', issue: expect.any(String) })]),
    )
  })
})

describe('AppError becomes its status and code', () => {
  it.each([
    [400, 'OUTSIDE_OPENING_HOURS'],
    [409, 'SLOT_UNAVAILABLE'],
    [429, 'TOO_MANY_REQUESTS'],
  ])('status %i answers { statusCode, code, message } with %s', async (status, code) => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: `/app-error/${status}` })

    expect(response.statusCode).toBe(status)
    expect(response.json()).toEqual({ statusCode: status, code, message: `msg ${status}` })
  })
})

describe('unexpected errors', () => {
  it('unexpected error returns 500 INTERNAL_ERROR and logs only name and code', async () => {
    const app = await buildApp()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await app.inject({ method: 'GET', url: '/boom' })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error.' })
    expect(logged).toHaveBeenCalledTimes(1)
    const output = JSON.stringify(logged.mock.calls)
    expect(output).toContain('P2002')
    expect(output).not.toContain('63999998888')
    expect(output).not.toContain('duplicate key')
    logged.mockRestore()
  })
})
