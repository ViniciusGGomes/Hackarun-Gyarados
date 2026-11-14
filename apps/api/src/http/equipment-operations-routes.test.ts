// Integration tests of the administrative equipment routes (agenda, pickup, return) against a real
// PostgreSQL test database (`hackathon_test`, see src/test/test-db.ts). Test files run one at a time.
import { fastifyJwt } from '@fastify/jwt'
import { fastify } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { localDateToUtc } from '../modules/reservations/reservations.slots'
import { resetTestDb, seedStaff, setupTestDb, testPrisma } from '../test/test-db'
import { getUserPermissions } from '../utils/get-user-permissions'
import { generateProtocol } from '../utils/protocol'
import { errorHandler } from './error-handler'
import { auth } from './middlewares/auth'
import { routes } from './routes'

vi.mock('../utils/protocol', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/protocol')>()

  return { generateProtocol: vi.fn(actual.generateProtocol) }
})

vi.mock('../utils/get-user-permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/get-user-permissions')>()

  return { getUserPermissions: vi.fn(actual.getUserPermissions) }
})

vi.mock('../lib/prisma', async () => {
  const { testPrisma } = await import('../test/test-db.js')

  return { prisma: testPrisma }
})

vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 })

// Tuesday 2026-11-17, 10:05 in America/Araguaina (UTC-3): five minutes into the 10:00 block.
const NOW = new Date('2026-11-17T13:05:00Z')
const TUESDAY = '2026-11-17'
const MINUTE = 60 * 1000

beforeAll(async () => {
  await setupTestDb()
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

beforeEach(async () => {
  await resetTestDb()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(getUserPermissions).mockReset() // back to the real implementation
})

async function buildApp() {
  const app = fastify()

  app.setErrorHandler(errorHandler)
  await app.register(fastifyJwt, { secret: 'test-secret' })
  await app.register(auth)
  await app.register(routes, { prefix: '/api/v1' })

  await app.ready()
  return app
}

type App = Awaited<ReturnType<typeof buildApp>>
type Role = 'attendant' | 'manager'
type Status = 'reserved' | 'picked_up' | 'returned' | 'cancelled' | 'no_show'

/** A staff user with a valid session and the signed token, created at the current (fake) time. */
async function staff(app: App, role: Role = 'attendant', claims: Record<string, unknown> = {}) {
  const { userId, sessionId } = await seedStaff(role)
  const token = app.jwt.sign({ sub: userId, sid: sessionId, ...claims })

  return { userId, sessionId, token, headers: { authorization: `Bearer ${token}` } }
}

let phoneSeq = 0
const nextPhone = () => `6399${String(100000 + ++phoneSeq)}`.slice(0, 11)

/** Inserts a reservation directly, the way the public flow would leave it, bypassing the booking rules. */
async function seedReservation(
  options: {
    date?: string
    time?: string
    type?: 'wheelchair' | 'stroller'
    status?: Status
    name?: string
    phone?: string
    email?: string
    notes?: string
    startAt?: Date
    pickupDeadline?: Date
    createdAt?: Date
  } = {},
) {
  const startAt = options.startAt ?? localDateToUtc(options.date ?? TUESDAY, options.time ?? '10:00')

  return testPrisma.request.create({
    data: {
      protocol: generateProtocol(),
      type: 'reservation',
      status: options.status ?? 'reserved',
      visitorName: options.name ?? 'Visitante Teste',
      visitorPhone: options.phone ?? nextPhone(),
      visitorEmail: options.email,
      createdAt: options.createdAt,
      history: { create: { fromStatus: null, toStatus: options.status ?? 'reserved', actorType: 'visitor' } },
      reservation: {
        create: {
          equipmentType: options.type ?? 'wheelchair',
          startAt,
          endAt: new Date(startAt.getTime() + 120 * MINUTE),
          pickupDeadline: options.pickupDeadline ?? new Date(startAt.getTime() + 15 * MINUTE),
          notes: options.notes,
        },
      },
    },
  })
}

function agenda(app: App, headers: Record<string, string>, query = `date=${TUESDAY}&equipmentType=wheelchair`) {
  return app.inject({ method: 'GET', url: `/api/v1/admin/agenda?${query}`, headers })
}

function pickup(app: App, id: string, headers: Record<string, string>, payload?: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: `/api/v1/admin/reservations/${id}/pickup`, headers, payload })
}

function giveBack(app: App, id: string, headers: Record<string, string>, payload?: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: `/api/v1/admin/reservations/${id}/return`, headers, payload })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slotAt = (body: { slots: any[] }, isoStart: string) => body.slots.find((slot) => slot.start === isoStart)

describe('GET /api/v1/admin/agenda', () => {
  it('agenda returns the slots of the day in ascending order', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)
    await seedReservation({ time: '11:00' })
    await seedReservation({ time: '10:00' })

    const response = await agenda(app, headers)
    const body = response.json()
    const starts = body.slots.map((slot: { start: string }) => slot.start)

    expect(response.statusCode).toBe(200)
    expect(body).toMatchObject({ date: TUESDAY, equipmentType: 'wheelchair' })
    expect(starts).toHaveLength(21) // 10:00 ... 20:00 (the last block that still fits the 2 h loan)
    expect(starts[0]).toBe('2026-11-17T13:00:00.000Z')
    expect(starts).toEqual([...starts].sort())
  })

  it('agenda slots carry units and reservations with their fields', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)
    const request = await seedReservation({ name: 'Maria Souza' })

    const body = (await agenda(app, headers)).json()
    const slot = slotAt(body, '2026-11-17T13:00:00.000Z')

    expect(Object.keys(slot).sort()).toEqual(['end', 'freeUnits', 'reservations', 'start', 'totalUnits'])
    expect(slot.end).toBe('2026-11-17T13:30:00.000Z')
    expect(slot.reservations).toEqual([
      {
        id: request.id,
        protocol: request.protocol,
        visitorName: 'Maria Souza',
        status: 'reserved',
        pickupOverdue: false,
        returnOverdue: false,
      },
    ])
  })

  it('agenda totals and free units count only reserved and picked up reservations', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)
    for (const status of ['reserved', 'reserved', 'picked_up', 'cancelled', 'no_show', 'returned'] as const) {
      await seedReservation({ status })
    }

    const body = (await agenda(app, headers)).json()

    // 4 adult + 2 child active chairs; the inactive one does not count.
    expect(slotAt(body, '2026-11-17T13:00:00.000Z')).toMatchObject({ totalUnits: 6, freeUnits: 3 })
    expect(slotAt(body, '2026-11-17T14:30:00.000Z')).toMatchObject({ totalUnits: 6, freeUnits: 3 }) // 11:30, still inside the 10:00-12:00 loan
    expect(slotAt(body, '2026-11-17T15:00:00.000Z')).toMatchObject({ totalUnits: 6, freeUnits: 6 }) // 12:00, the loan has ended
    expect(slotAt(body, '2026-11-17T12:30:00.000Z')).toBeUndefined() // nothing before the opening
  })

  it('agenda lists reservations of every status', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)
    const statuses = ['reserved', 'picked_up', 'returned', 'cancelled', 'no_show'] as const
    for (const status of statuses) await seedReservation({ status })

    const slot = slotAt((await agenda(app, headers)).json(), '2026-11-17T13:00:00.000Z')

    expect(slot.reservations.map((item: { status: string }) => item.status).sort()).toEqual([...statuses].sort())
  })

  it('agenda of a closed day or a day without opening hours has no slots', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)

    await testPrisma.openingHour.update({ where: { weekday: 2 }, data: { closed: true } })
    const closed = await agenda(app, headers)

    await testPrisma.openingHour.delete({ where: { weekday: 2 } })
    const missing = await agenda(app, headers)

    for (const response of [closed, missing]) {
      expect(response.statusCode).toBe(200)
      expect(response.json().slots).toEqual([])
    }
  })

  it('agenda accepts past dates and dates beyond the advance limit', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)
    const past = await seedReservation({ date: '2026-11-10' }) // a Tuesday, a week ago
    const far = await seedReservation({ date: '2026-12-29' }) // a Tuesday, beyond the 7 days of advance

    const pastBody = (await agenda(app, headers, 'date=2026-11-10&equipmentType=wheelchair')).json()
    const farBody = (await agenda(app, headers, 'date=2026-12-29&equipmentType=wheelchair')).json()

    expect(pastBody.slots).toHaveLength(21)
    expect(farBody.slots).toHaveLength(21)
    expect(slotAt(pastBody, '2026-11-10T13:00:00.000Z').reservations[0].id).toBe(past.id)
    expect(slotAt(farBody, '2026-12-29T13:00:00.000Z').reservations[0].id).toBe(far.id)
  })

  it('agenda lists a reservation that starts outside the current blocks in its own slot', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)
    const odd = await seedReservation({ time: '10:10' }) // not a multiple of the 30-minute block

    const body = (await agenda(app, headers)).json()
    const own = slotAt(body, '2026-11-17T13:10:00.000Z')

    expect(body.slots).toHaveLength(22)
    expect(own.reservations.map((item: { id: string }) => item.id)).toEqual([odd.id])
    expect(own.end).toBe('2026-11-17T13:40:00.000Z')
    expect(slotAt(body, '2026-11-17T13:00:00.000Z').reservations).toEqual([])
  })

  it('agenda carries no contact data', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)
    await seedReservation({ phone: '63911112222', email: 'maria@email.com', notes: 'Estou na entrada', name: 'Maria Souza' })

    const response = await agenda(app, headers)

    expect(response.body).toContain('Maria Souza') // the name identifies the visitor
    for (const secret of ['63911112222', 'maria@email.com', 'Estou na entrada', 'visitorPhone', 'visitorEmail']) {
      expect(response.body).not.toContain(secret)
    }
  })

  it('agenda rejects a missing or invalid date and equipment type', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)

    for (const query of [
      '',
      'equipmentType=wheelchair',
      `date=${TUESDAY}`,
      'date=2026-02-30&equipmentType=wheelchair',
      'date=17/11/2026&equipmentType=wheelchair',
      `date=${TUESDAY}&equipmentType=bike`,
    ]) {
      const response = await agenda(app, headers, query)

      expect(response.statusCode, query).toBe(400)
      expect(response.json(), query).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
    }
  })
})

describe('authentication and permission', () => {
  /** The three routes with a valid request, so that only the access control can answer. */
  async function threeRoutes(app: App, headers: Record<string, string>) {
    const target = await seedReservation()

    return [
      await agenda(app, headers),
      await pickup(app, target.id, headers),
      await giveBack(app, target.id, headers),
    ]
  }

  it('the three routes answer 401 without a valid token', async () => {
    const app = await buildApp()
    const revoked = await staff(app)
    await testPrisma.session.update({ where: { id: revoked.sessionId }, data: { revokedAt: new Date() } })
    const other = fastify()
    await other.register(fastifyJwt, { secret: 'another-secret' })
    await other.ready()
    const forged = other.jwt.sign({ sub: revoked.userId, sid: revoked.sessionId })

    for (const [label, headers] of [
      ['no token', {}],
      ['garbage token', { authorization: 'Bearer not-a-token' }],
      ['token signed with another secret', { authorization: `Bearer ${forged}` }],
      ['revoked session', revoked.headers],
    ] as const) {
      for (const response of await threeRoutes(app, headers)) {
        expect(response.statusCode, label).toBe(401)
        expect(response.json(), label).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' })
      }
    }
    expect((await testPrisma.request.findFirstOrThrow({ orderBy: { createdAt: 'asc' } })).status).toBe('reserved')
  })

  it('the three routes answer 403 when the user lacks the ability', async () => {
    const app = await buildApp()
    const { headers } = await staff(app)
    vi.mocked(getUserPermissions).mockReturnValue({ can: () => false } as never)

    const responses = await threeRoutes(app, headers)

    for (const response of responses) {
      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' })
    }
    expect((await testPrisma.request.findFirstOrThrow()).status).toBe('reserved') // nothing changed
  })

  it('attendant and manager can use the three routes', async () => {
    const app = await buildApp()
    const attendant = await staff(app, 'attendant')
    const manager = await staff(app, 'manager')
    const first = await seedReservation()
    const second = await seedReservation()

    expect((await agenda(app, attendant.headers)).statusCode).toBe(200)
    expect((await agenda(app, manager.headers)).statusCode).toBe(200)

    expect((await pickup(app, first.id, attendant.headers)).statusCode).toBe(200)
    expect((await giveBack(app, first.id, manager.headers)).statusCode).toBe(200)
    expect((await pickup(app, second.id, manager.headers)).statusCode).toBe(200)
    expect((await giveBack(app, second.id, attendant.headers)).statusCode).toBe(200)
  })

  it('the role is read from the database on each request', async () => {
    const app = await buildApp()
    // The token claims to be a manager; the database says attendant.
    const { userId, headers } = await staff(app, 'attendant', { role: 'manager' })

    await agenda(app, headers)
    await testPrisma.user.update({ where: { id: userId }, data: { role: 'manager' } })
    await agenda(app, headers)

    const roles = vi.mocked(getUserPermissions).mock.calls.filter(([id]) => id === userId).map(([, role]) => role)
    expect(roles).toEqual(['attendant', 'manager'])
  })
})
