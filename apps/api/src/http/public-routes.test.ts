import { fastifyJwt } from '@fastify/jwt'
import { fastify } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '../lib/prisma'
import { errorHandler } from './error-handler'
import { auth } from './middlewares/auth'
import { routes } from './routes'

vi.mock('../lib/prisma', () => ({
  prisma: {
    service: { findMany: vi.fn(), findUnique: vi.fn() },
    location: { findMany: vi.fn() },
    openingHour: { findMany: vi.fn() },
    reservationSettings: { findUnique: vi.fn() },
    privacyNotice: { findFirst: vi.fn() },
  },
}))

type Where = { active?: boolean }

const PICKUP = {
  id: '00000000-0000-4000-8000-0000000000a1',
  name: 'SAC',
  floor: 'L1',
  type: 'service',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

function serviceRow(overrides: Record<string, unknown>) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'cadeiras-de-rodas',
    name: 'Cadeiras de rodas',
    shortDescription: 'Empréstimo gratuito',
    description: 'Descrição completa',
    icon: 'wheelchair',
    kind: 'interactive',
    flow: 'equipment_reservation',
    equipmentType: 'wheelchair',
    howItWorks: ['Escolha o horário', 'Retire no SAC'],
    contactPhone: '(63) 3219-4616',
    pickupLocationId: PICKUP.id,
    active: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

async function buildApp() {
  const app = fastify()

  await app.register(fastifyJwt, { secret: 'test-secret' })
  app.setErrorHandler(errorHandler)
  await app.register(auth)
  await app.register(routes, { prefix: '/api/v1' })

  await app.ready()
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/v1/services', () => {
  it('list services returns only active ordered', async () => {
    const rows = [
      serviceRow({ id: '00000000-0000-4000-8000-000000000002', slug: 'b', sortOrder: 2 }),
      serviceRow({ id: '00000000-0000-4000-8000-000000000003', slug: 'inativo', sortOrder: 1, active: false }),
      serviceRow({ id: '00000000-0000-4000-8000-000000000004', slug: 'a', sortOrder: 1 }),
    ]
    vi.mocked(prisma.service.findMany).mockImplementation((async (args: {
      where?: Where
      orderBy?: { sortOrder?: 'asc' }
    }) => {
      const filtered = rows.filter((r) => args.where?.active === undefined || r.active === args.where.active)
      return args.orderBy?.sortOrder === 'asc'
        ? [...filtered].sort((x, y) => (x.sortOrder as number) - (y.sortOrder as number))
        : filtered
    }) as never)
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/v1/services' })

    expect(response.statusCode).toBe(200)
    expect(response.json().data.map((s: { slug: string }) => s.slug)).toEqual(['a', 'b'])
    expect(Object.keys(response.json().data[0]).sort()).toEqual(
      ['equipmentType', 'flow', 'icon', 'id', 'kind', 'name', 'shortDescription', 'slug'].sort(),
    )
  })
})

describe('GET /api/v1/services/:slug', () => {
  it('get service detail by slug', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ ...serviceRow({}), pickupLocation: PICKUP } as never)
    vi.mocked(prisma.openingHour.findMany).mockResolvedValue([
      { id: 1, weekday: 2, closed: false, openTime: '10:00', closeTime: '22:00' },
    ] as never)
    vi.mocked(prisma.reservationSettings.findUnique).mockResolvedValue({
      id: 1,
      loanDurationMinutes: 120,
      pickupToleranceMinutes: 15,
      foundItemStorageDays: 90,
    } as never)
    const app = await buildApp()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T15:00:00Z')) // Tuesday 12:00 in America/Araguaina

    const response = await app.inject({ method: 'GET', url: '/api/v1/services/cadeiras-de-rodas' })
    vi.useRealTimers()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'cadeiras-de-rodas',
      name: 'Cadeiras de rodas',
      shortDescription: 'Empréstimo gratuito',
      icon: 'wheelchair',
      kind: 'interactive',
      flow: 'equipment_reservation',
      equipmentType: 'wheelchair',
      description: 'Descrição completa',
      howItWorks: ['Escolha o horário', 'Retire no SAC'],
      openingHours: [{ weekday: 2, closed: false, open: '10:00', close: '22:00' }],
      isOpenNow: true,
      pickupLocation: { id: PICKUP.id, name: 'SAC', floor: 'L1', type: 'service', active: true },
      loanDurationMinutes: 120,
      pickupToleranceMinutes: 15,
      storageDays: 90,
      contactPhone: '(63) 3219-4616',
    })
  })

  it('get service missing slug returns 404', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/v1/services/nao-existe' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' })
  })
})

describe('GET /api/v1/locations', () => {
  it('list locations returns only active', async () => {
    const rows = [
      { ...PICKUP, id: '00000000-0000-4000-8000-0000000000b1', name: 'Praça', active: true },
      { ...PICKUP, id: '00000000-0000-4000-8000-0000000000b2', name: 'Fechado', active: false },
    ]
    vi.mocked(prisma.location.findMany).mockImplementation((async (args: { where?: Where }) =>
      rows.filter((r) => args.where?.active === undefined || r.active === args.where.active)) as never)
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/v1/locations' })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toEqual([
      { id: '00000000-0000-4000-8000-0000000000b1', name: 'Praça', floor: 'L1', type: 'service', active: true },
    ])
  })
})

describe('GET /api/v1/privacy-notice', () => {
  it('get privacy notice returns active', async () => {
    vi.mocked(prisma.privacyNotice.findFirst).mockImplementation((async (args: { where?: Where }) =>
      args.where?.active === true
        ? {
            id: '00000000-0000-4000-8000-0000000000c1',
            version: '1.0',
            text: 'Texto do aviso',
            active: true,
            publishedAt: new Date('2026-05-01T12:00:00Z'),
          }
        : null) as never)
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/v1/privacy-notice' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      version: '1.0',
      text: 'Texto do aviso',
      updatedAt: '2026-05-01T12:00:00.000Z',
    })
  })

  it('get privacy notice without an active notice returns 404', async () => {
    vi.mocked(prisma.privacyNotice.findFirst).mockResolvedValue(null)
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/v1/privacy-notice' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' })
  })
})

describe('public routes', () => {
  it('public routes work without auth', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([])
    vi.mocked(prisma.location.findMany).mockResolvedValue([])
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ ...serviceRow({}), pickupLocation: null } as never)
    vi.mocked(prisma.openingHour.findMany).mockResolvedValue([])
    vi.mocked(prisma.reservationSettings.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.privacyNotice.findFirst).mockResolvedValue({
      version: '1.0',
      text: 't',
      publishedAt: new Date(),
    } as never)
    const app = await buildApp()

    const urls = ['/api/v1/services', '/api/v1/services/cadeiras-de-rodas', '/api/v1/locations', '/api/v1/privacy-notice']
    for (const url of urls) {
      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode, url).toBe(200)
    }
  })
})
