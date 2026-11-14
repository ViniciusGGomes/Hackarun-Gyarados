import { fastifyJwt } from '@fastify/jwt'
import { fastify } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '../lib/prisma'
import { errorHandler } from './error-handler'
import { auth } from './middlewares/auth'
import { routes } from './routes'

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

const findUniqueMock = vi.mocked(prisma.user.findUnique)

const ATTENDANT_ID = '00000000-0000-0000-0000-000000000001'
const MANAGER_ID = '00000000-0000-0000-0000-000000000002'

async function buildApp() {
  const app = fastify()

  await app.register(fastifyJwt, { secret: 'test-secret' })
  app.setErrorHandler(errorHandler)
  await app.register(auth)
  await app.register(routes)

  await app.ready()
  return app
}

describe('attendance routes', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
  })

  it('attendant can access attendance routes', async () => {
    const app = await buildApp()
    findUniqueMock.mockResolvedValue({ id: ATTENDANT_ID, role: 'attendant', active: true } as never)
    const token = app.jwt.sign({ sub: ATTENDANT_ID })

    const response = await app.inject({
      method: 'GET',
      url: '/admin/requests',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
  })

  it('manager can access attendance routes', async () => {
    const app = await buildApp()
    findUniqueMock.mockResolvedValue({ id: MANAGER_ID, role: 'manager', active: true } as never)
    const token = app.jwt.sign({ sub: MANAGER_ID })

    const response = await app.inject({
      method: 'GET',
      url: '/admin/requests',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
  })
})
