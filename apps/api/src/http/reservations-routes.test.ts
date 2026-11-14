// Integration tests of the public reservation flows against a real PostgreSQL test database
// (`hackathon_test`, see src/test/test-db.ts). This is the only test file that touches a database,
// so no other file can run against it in parallel.
import { fastify } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { localDateToUtc } from '../modules/reservations/reservations.slots'
import { resetTestDb, setupTestDb, testPrisma } from '../test/test-db'
import { generateProtocol } from '../utils/protocol'
import { errorHandler } from './error-handler'
import { routes } from './routes'

vi.mock('../lib/prisma', async () => {
  const { testPrisma } = await import('../test/test-db.js')

  return { prisma: testPrisma }
})

vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 })

// Monday 2026-11-16, 09:00 in America/Araguaina (UTC-3). The shopping opens at 10:00.
const NOW = new Date('2026-11-16T12:00:00Z')
const TUESDAY = '2026-11-17'
const MINUTE = 60 * 1000

let locations: { sacLocationId: string; familyLocationId: string }

beforeAll(async () => {
  await setupTestDb()
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

beforeEach(async () => {
  locations = await resetTestDb()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

async function buildApp() {
  const app = fastify()

  app.setErrorHandler(errorHandler)
  await app.register(routes, { prefix: '/api/v1' })

  await app.ready()
  return app
}

type App = Awaited<ReturnType<typeof buildApp>>
type Status = 'reserved' | 'picked_up' | 'returned' | 'cancelled' | 'no_show'

let phoneSeq = 0
const nextPhone = () => `6399${String(100000 + ++phoneSeq)}`.slice(0, 11)

/** Inserts a reservation directly (the way the admin flows would leave it), bypassing the booking rules. */
async function seedReservation(options: {
  date?: string
  time: string
  type?: 'wheelchair' | 'stroller'
  status?: Status
  phone?: string
}) {
  const startAt = localDateToUtc(options.date ?? TUESDAY, options.time)

  return testPrisma.request.create({
    data: {
      protocol: generateProtocol(),
      type: 'reservation',
      status: options.status ?? 'reserved',
      visitorName: 'Visitante Teste',
      visitorPhone: options.phone ?? nextPhone(),
      reservation: {
        create: {
          equipmentType: options.type ?? 'wheelchair',
          startAt,
          endAt: new Date(startAt.getTime() + 120 * MINUTE),
          pickupDeadline: new Date(startAt.getTime() + 15 * MINUTE),
        },
      },
    },
  })
}

function availability(app: App, type: string, date: string) {
  return app.inject({ method: 'GET', url: `/api/v1/equipment/${type}/availability?date=${date}` })
}

describe('GET /api/v1/equipment/:type/availability', () => {
  it('availability lists blocks with free units for an open day', async () => {
    const app = await buildApp()

    const response = await availability(app, 'wheelchair', TUESDAY)
    const body = response.json()

    expect(response.statusCode).toBe(200)
    expect(body).toMatchObject({
      equipmentType: 'wheelchair',
      date: TUESDAY,
      slotMinutes: 30,
      loanDurationMinutes: 120,
      nowAvailable: null,
    })
    expect(body.slots).toHaveLength(21) // 10:00 ... 20:00, so the 2 h loan ends by 22:00
    expect(body.slots[0]).toEqual({
      start: '2026-11-17T13:00:00.000Z',
      end: '2026-11-17T13:30:00.000Z',
      availableUnits: 6, // 4 adult + 2 child; the inactive chair does not count
      available: true,
    })
    expect(body.slots.every((slot: { availableUnits: number }) => slot.availableUnits === 6)).toBe(true)
  })

  it('availability with every unit taken marks blocks unavailable', async () => {
    const app = await buildApp()
    for (let i = 0; i < 6; i++) await seedReservation({ time: '12:00' }) // 12:00-14:00 on every unit

    const { slots } = (await availability(app, 'wheelchair', TUESDAY)).json()

    // A block is free only if a unit stays free for the whole 2 h loan that would start in it:
    // 10:00 ends at 12:00 and fits; 10:30 ... 13:30 would run into the 12:00-14:00 reservations.
    expect(slots[0]).toMatchObject({ start: '2026-11-17T13:00:00.000Z', availableUnits: 6, available: true }) // 10:00
    for (const slot of slots.slice(1, 9)) {
      expect(slot).toMatchObject({ availableUnits: 0, available: false })
    }
    expect(slots[9]).toMatchObject({ start: '2026-11-17T17:00:00.000Z', availableUnits: 6, available: true }) // 14:00
  })

  it('availability invalid type or date returns 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()

    const responses = [
      await availability(app, 'wheelchairs', TUESDAY),
      await availability(app, 'wheelchair', 'not-a-date'),
      await availability(app, 'wheelchair', '2026-02-30'),
      await app.inject({ method: 'GET', url: '/api/v1/equipment/wheelchair/availability' }),
    ]

    for (const response of responses) {
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
    }
  })

  it('availability type without active equipment has no free blocks', async () => {
    const app = await buildApp()
    await testPrisma.equipment.updateMany({ where: { type: 'stroller' }, data: { active: false } })

    const body = (await availability(app, 'stroller', TUESDAY)).json()

    expect(body.slots).toHaveLength(21)
    expect(body.slots.every((slot: { availableUnits: number; available: boolean }) => slot.availableUnits === 0 && !slot.available)).toBe(true)
  })

  it('availability closed day returns empty slots', async () => {
    const app = await buildApp()
    await testPrisma.openingHour.update({ where: { weekday: 2 }, data: { closed: true } })

    const response = await availability(app, 'wheelchair', TUESDAY)

    expect(response.statusCode).toBe(200)
    expect(response.json().slots).toEqual([])
  })

  it('availability counts reserved and picked_up but not cancelled returned or no_show', async () => {
    const app = await buildApp()
    for (const status of ['reserved', 'picked_up', 'cancelled', 'returned', 'no_show'] as const) {
      await seedReservation({ time: '10:00', status })
    }

    const { slots } = (await availability(app, 'wheelchair', TUESDAY)).json()

    expect(slots[0].availableUnits).toBe(4) // 6 units minus the reserved and the picked_up
  })

  it('availability nowAvailable is set only for today', async () => {
    const app = await buildApp()
    vi.setSystemTime(new Date('2026-11-16T14:10:00Z')) // Monday 11:10 local, block 11:00-11:30 in progress

    const today = (await availability(app, 'wheelchair', '2026-11-16')).json()
    const tomorrow = (await availability(app, 'wheelchair', TUESDAY)).json()

    expect(today.nowAvailable).toBe(true)
    expect(today.slots[0].start).toBe('2026-11-16T14:00:00.000Z') // the block in progress is listed
    expect(tomorrow.nowAvailable).toBeNull()

    for (let i = 0; i < 6; i++) await seedReservation({ date: '2026-11-16', time: '11:00' })

    expect((await availability(app, 'wheelchair', '2026-11-16')).json().nowAvailable).toBe(false)
  })

  it('availability records unmet demand when no block is free', async () => {
    const app = await buildApp()
    await testPrisma.equipment.updateMany({ where: { type: 'stroller' }, data: { active: false } })

    await availability(app, 'stroller', TUESDAY)

    const rows = await testPrisma.unmetDemand.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ equipmentType: 'stroller' })
    expect(rows[0].requestedFor.toISOString().slice(0, 10)).toBe(TUESDAY)
  })

  it('availability does not record unmet demand outside its conditions', async () => {
    const app = await buildApp()

    await availability(app, 'wheelchair', TUESDAY) // a block is free
    expect(await testPrisma.unmetDemand.count()).toBe(0)

    await testPrisma.equipment.updateMany({ where: { type: 'stroller' }, data: { active: false } })
    await availability(app, 'stroller', '2026-11-30') // beyond the 7-day advance
    await availability(app, 'stroller', '2026-11-15') // yesterday
    await testPrisma.openingHour.update({ where: { weekday: 3 }, data: { closed: true } })
    await availability(app, 'stroller', '2026-11-18') // closed day
    expect(await testPrisma.unmetDemand.count()).toBe(0)
  })

  it('availability needs no token and exposes no personal data', async () => {
    const app = await buildApp()
    const request = await seedReservation({ time: '10:00', phone: '63988887777' })

    const response = await availability(app, 'wheelchair', TUESDAY)

    expect(response.statusCode).toBe(200) // no Authorization header was sent
    expect(response.body).not.toContain('63988887777')
    expect(response.body).not.toContain('Visitante Teste')
    expect(response.body).not.toContain(request.protocol)
    expect(Object.keys(response.json().slots[0]).sort()).toEqual(['available', 'availableUnits', 'end', 'start'])
  })
})
