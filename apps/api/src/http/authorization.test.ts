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
    request: {
      findUnique: vi.fn(),
    },
  },
}))

const findUniqueMock = vi.mocked(prisma.user.findUnique)
const requestFindUniqueMock = vi.mocked(prisma.request.findUnique)

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

describe('manager-only routes', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    requestFindUniqueMock.mockReset()
  })

  it('attendant returns 403 on manager route', async () => {
    const app = await buildApp()
    findUniqueMock.mockResolvedValue({ id: ATTENDANT_ID, role: 'attendant', active: true } as never)
    const token = app.jwt.sign({ sub: ATTENDANT_ID })

    const response = await app.inject({
      method: 'GET',
      url: '/admin/indicators/equipment',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(403)
  })

  it('manager accesses manager route', async () => {
    const app = await buildApp()
    findUniqueMock.mockResolvedValue({ id: MANAGER_ID, role: 'manager', active: true } as never)
    const token = app.jwt.sign({ sub: MANAGER_ID })

    const response = await app.inject({
      method: 'GET',
      url: '/admin/indicators/equipment',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
  })

  it('role is derived from the database', async () => {
    const app = await buildApp()
    findUniqueMock.mockResolvedValue({ id: ATTENDANT_ID, role: 'attendant', active: true } as never)
    const token = app.jwt.sign({ sub: ATTENDANT_ID, role: 'manager' }) // forged role claim

    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(403)
  })

  it('attendant cannot reopen final', async () => {
    const app = await buildApp()
    findUniqueMock.mockResolvedValue({ id: ATTENDANT_ID, role: 'attendant', active: true } as never)
    requestFindUniqueMock.mockResolvedValue({ status: 'returned' } as never)
    const token = app.jwt.sign({ sub: ATTENDANT_ID })

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/requests/00000000-0000-0000-0000-000000000010/status',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(403)
  })

  it('manager can reopen final', async () => {
    const app = await buildApp()
    findUniqueMock.mockResolvedValue({ id: MANAGER_ID, role: 'manager', active: true } as never)
    requestFindUniqueMock.mockResolvedValue({ status: 'returned' } as never)
    const token = app.jwt.sign({ sub: MANAGER_ID })

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/requests/00000000-0000-0000-0000-000000000010/status',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
  })
})
