import { fastifyJwt } from '@fastify/jwt'
import { fastify } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '../../lib/prisma'
import { errorHandler } from '../error-handler'
import { auth } from './auth'

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    session: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        userId: where.id.replace('session-', ''),
        lastActivityAt: new Date(),
        revokedAt: null,
      })),
      update: vi.fn(async () => ({})),
    },
  },
}))

const findUniqueMock = vi.mocked(prisma.user.findUnique)

async function buildApp() {
  const app = fastify()

  await app.register(fastifyJwt, { secret: 'test-secret' })
  app.setErrorHandler(errorHandler)
  await app.register(auth)

  app.get('/me', async (request) => {
    const user = await request.getCurrentUser()

    return user
  })

  await app.ready()
  return app
}

describe('auth middleware', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
  })

  it('no token returns 401', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/me' })

    expect(response.statusCode).toBe(401)
  })

  it('invalid token returns 401', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer invalid-token' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('inactive user is denied', async () => {
    const app = await buildApp()

    const token = app.jwt.sign({
      sub: '00000000-0000-0000-0000-000000000001',
      sid: 'session-00000000-0000-0000-0000-000000000001',
    })

    findUniqueMock.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      role: 'attendant',
      active: false,
    } as never)

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(401)
  })
})
