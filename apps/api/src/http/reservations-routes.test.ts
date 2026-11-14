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

vi.mock('../utils/protocol', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/protocol')>()

  return { generateProtocol: vi.fn(actual.generateProtocol) }
})

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
    for (const slot of slots.slice(1, 8)) {
      expect(slot).toMatchObject({ availableUnits: 0, available: false })
    }
    expect(slots[8]).toMatchObject({ start: '2026-11-17T17:00:00.000Z', availableUnits: 6, available: true }) // 14:00
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
    await limitUnits('wheelchair', 1)
    const expected: [Status, number][] = [
      ['reserved', 0],
      ['picked_up', 0],
      ['cancelled', 1],
      ['returned', 1],
      ['no_show', 1],
    ]

    for (const [status, free] of expected) {
      await testPrisma.request.deleteMany()
      await seedReservation({ time: '10:00', status })

      const { slots } = (await availability(app, 'wheelchair', TUESDAY)).json()

      expect(slots[0].availableUnits, status).toBe(free)
    }
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

  it('availability nowAvailable follows the opening hours and the local day', async () => {
    const app = await buildApp()
    const nowAvailableAt = async (instant: string, date: string) => {
      vi.setSystemTime(new Date(instant))

      return (await availability(app, 'wheelchair', date)).json()
    }

    expect((await nowAvailableAt('2026-11-16T12:00:00Z', '2026-11-16')).nowAvailable).toBe(false) // 09:00, before opening
    expect((await nowAvailableAt('2026-11-16T23:10:00Z', '2026-11-16')).nowAvailable).toBe(true) // 20:10, the last block
    const night = await nowAvailableAt('2026-11-17T00:30:00Z', '2026-11-16') // 21:30 local, after the last block
    expect(night.slots).toEqual([])
    expect(night.nowAvailable).toBe(false)
    // 02:00Z is still Monday 23:00 locally: "today" is Monday, so Tuesday is not today
    expect((await nowAvailableAt('2026-11-17T02:00:00Z', '2026-11-17')).nowAvailable).toBeNull()
    expect((await nowAvailableAt('2026-11-17T02:00:00Z', '2026-11-16')).nowAvailable).toBe(false)
  })

  it('availability records unmet demand when no block is free', async () => {
    const app = await buildApp()
    await testPrisma.equipment.updateMany({ where: { type: 'stroller' }, data: { active: false } })

    await availability(app, 'stroller', TUESDAY)

    const rows = await testPrisma.unmetDemand.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ equipmentType: 'stroller' })
    expect(rows[0].requestedFor.toISOString().slice(0, 10)).toBe(TUESDAY)

    await availability(app, 'stroller', TUESDAY) // every empty consultation counts, without deduplication
    expect(await testPrisma.unmetDemand.count()).toBe(2)
  })

  it('availability still answers when recording the unmet demand fails', async () => {
    const app = await buildApp()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await testPrisma.equipment.updateMany({ where: { type: 'stroller' }, data: { active: false } })
    await testPrisma.$executeRawUnsafe(
      "CREATE OR REPLACE FUNCTION fail_unmet() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$ LANGUAGE plpgsql",
    )
    await testPrisma.$executeRawUnsafe(
      'CREATE TRIGGER fail_unmet_trigger BEFORE INSERT ON unmet_demands FOR EACH ROW EXECUTE FUNCTION fail_unmet()',
    )

    try {
      const response = await availability(app, 'stroller', TUESDAY)

      expect(response.statusCode).toBe(200)
      expect(response.json().slots).toHaveLength(21)
      expect(logged).toHaveBeenCalled()
      expect(await testPrisma.unmetDemand.count()).toBe(0)
    } finally {
      await testPrisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_unmet_trigger ON unmet_demands')
      await testPrisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS fail_unmet()')
    }
  })

  it('availability does not record unmet demand outside its conditions', async () => {
    const app = await buildApp()

    await availability(app, 'wheelchair', TUESDAY) // a block is free
    expect(await testPrisma.unmetDemand.count()).toBe(0)

    for (let i = 0; i < 6; i++) await seedReservation({ time: '10:00' })
    await availability(app, 'wheelchair', TUESDAY) // a partly free day: the later blocks are still free
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

// ---------------------------------------------------------------------------- create reservation

const at = (date: string, time: string) => localDateToUtc(date, time)

function body(overrides: Record<string, unknown> = {}) {
  return {
    equipmentType: 'wheelchair',
    mode: 'scheduled',
    startAt: at(TUESDAY, '10:00').toISOString(),
    name: 'Maria Souza',
    phone: '63999998888',
    consent: { accepted: true, privacyNoticeVersion: '1.0' },
    ...overrides,
  }
}

function reserve(app: App, overrides: Record<string, unknown> = {}) {
  return app.inject({ method: 'POST', url: '/api/v1/reservations', payload: body(overrides) })
}

async function counts() {
  const [requests, reservations, consents, history] = await Promise.all([
    testPrisma.request.count(),
    testPrisma.reservation.count(),
    testPrisma.consent.count(),
    testPrisma.requestHistory.count(),
  ])

  return { requests, reservations, consents, history }
}

const NOTHING_STORED = { requests: 0, reservations: 0, consents: 0, history: 0 }

describe('POST /api/v1/reservations', () => {
  it('reservation valid request returns 201 and stores request reservation consent and history', async () => {
    const app = await buildApp()

    const response = await reserve(app, {
      email: 'maria@email.com',
      currentLocationId: locations.familyLocationId,
      forWhom: 'other',
      size: 'child',
      notes: 'Estou na entrada principal',
    })
    const result = response.json()

    expect(response.statusCode).toBe(201)
    expect(result.protocol).toMatch(/^CAP-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(result).toMatchObject({
      status: 'reserved',
      trackingPath: `/acompanhar/${result.protocol}`,
      equipmentType: 'wheelchair',
      startAt: '2026-11-17T13:00:00.000Z',
      endAt: '2026-11-17T15:00:00.000Z',
      pickupDeadline: '2026-11-17T13:15:00.000Z',
      pickupLocation: {
        id: locations.sacLocationId,
        name: 'SAC / Espaço do Cliente',
        floor: 'Térreo',
        type: 'service',
        active: true,
      },
    })
    expect(Object.keys(result).sort()).toEqual([
      'createdAt',
      'endAt',
      'equipmentType',
      'pickupDeadline',
      'pickupLocation',
      'protocol',
      'startAt',
      'status',
      'trackingPath',
    ])

    const stored = await testPrisma.request.findUniqueOrThrow({
      where: { protocol: result.protocol },
      include: { reservation: true, consents: true, history: true },
    })
    expect(stored).toMatchObject({
      type: 'reservation',
      status: 'reserved',
      visitorName: 'Maria Souza',
      visitorPhone: '63999998888',
      visitorEmail: 'maria@email.com',
    })
    expect(stored.reservation).toMatchObject({
      equipmentType: 'wheelchair',
      forWhom: 'other',
      size: 'child',
      currentLocationId: locations.familyLocationId,
      notes: 'Estou na entrada principal',
    })
    expect(stored.consents).toHaveLength(1)
    expect(stored.consents[0]).toMatchObject({ privacyNoticeVersion: '1.0', purpose: 'atender a solicitação' })
    expect(stored.history).toHaveLength(1)
    expect(stored.history[0]).toMatchObject({ fromStatus: null, toStatus: 'reserved', actorType: 'visitor' })
  })

  it('reservation retries the protocol after a collision', async () => {
    const app = await buildApp()
    await testPrisma.request.create({
      data: { protocol: 'CAP-DUPL-2222', type: 'sac_message', status: 'open', visitorName: 'Outro', visitorPhone: '63911112222' },
    })
    vi.mocked(generateProtocol).mockReturnValueOnce('CAP-DUPL-2222') // the first value taken by the booking collides

    const response = await reserve(app)

    expect(response.statusCode).toBe(201)
    expect(response.json().protocol).not.toBe('CAP-DUPL-2222')
    expect(response.json().protocol).toMatch(/^CAP-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(await testPrisma.reservation.count()).toBe(1)
  })

  it('reservation accepts values at the documented limits', async () => {
    const edges: Record<string, unknown>[] = [
      { name: 'n'.repeat(120), phone: '6391111000' }, // 120 characters, 10-digit phone
      { notes: 'x'.repeat(200), phone: '63911110001' }, // 200 characters, 11-digit phone
    ]

    for (const overrides of edges) {
      const response = await reserve(await buildApp(), overrides)

      expect(response.statusCode, JSON.stringify(Object.keys(overrides))).toBe(201)
    }
    const app = await buildApp()
    const protocol = (await reserve(app, { phone: '63911110002' })).json().protocol
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/v1/tracking/${protocol}/cancel`,
      payload: { phone: '63911110002', reason: 'r'.repeat(200) },
    })

    expect(cancelled.statusCode).toBe(200)
  })

  it('reservation computes endAt and pickupDeadline from the settings', async () => {
    const app = await buildApp()
    await testPrisma.reservationSettings.update({
      where: { id: 1 },
      data: { loanDurationMinutes: 90, pickupToleranceMinutes: 20 },
    })

    const result = (await reserve(app)).json()

    expect(result.endAt).toBe('2026-11-17T14:30:00.000Z') // 10:00 + 90 min
    expect(result.pickupDeadline).toBe('2026-11-17T13:20:00.000Z') // 10:00 + 20 min
  })

  it('reservation now mode uses the current block', async () => {
    const app = await buildApp()
    vi.setSystemTime(new Date('2026-11-17T14:10:00Z')) // Tuesday 11:10 local

    const response = await reserve(app, { mode: 'now', startAt: undefined })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      startAt: '2026-11-17T14:00:00.000Z', // block 11:00-11:30
      endAt: '2026-11-17T16:00:00.000Z',
      pickupDeadline: '2026-11-17T14:25:00.000Z', // now + 15 min
    })

    vi.setSystemTime(new Date('2026-11-17T12:00:00Z')) // 09:00, before opening
    const early = await reserve(app, { mode: 'now', startAt: undefined, phone: '63977776666' })

    expect(early.statusCode).toBe(400)
    expect(early.json()).toMatchObject({ code: 'OUTSIDE_OPENING_HOURS' })
  })

  it('reservation now mode needs a free unit in the current block', async () => {
    const app = await buildApp()
    vi.setSystemTime(new Date('2026-11-17T14:10:00Z')) // Tuesday 11:10 local
    for (let i = 0; i < 6; i++) await seedReservation({ time: '11:00' })

    const response = await reserve(app, { mode: 'now', startAt: undefined })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'SLOT_UNAVAILABLE' })
    expect((await counts()).requests).toBe(6)
  })

  it('reservation invalid data returns 400 and stores nothing', async () => {
    const invalid: Record<string, unknown>[] = [
      { name: undefined },
      { name: '   ' },
      { name: 'x'.repeat(121) },
      { phone: 'abc' },
      { phone: '639999' },
      { email: 'not-an-email' },
      { notes: 'n'.repeat(201) },
      { mode: 'scheduled', startAt: undefined },
      { mode: 'later' },
      { consent: undefined },
      { startAt: 'tomorrow' },
    ]

    // A new app starts a new rate-limit window, so no case is cut off by the limit of 10 per minute.
    for (const overrides of invalid) {
      const response = await reserve(await buildApp(), overrides)

      expect(response.statusCode, JSON.stringify(overrides)).toBe(400)
      expect(response.json(), JSON.stringify(overrides)).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
    }

    expect(await counts()).toEqual(NOTHING_STORED)
  })

  it('reservation without valid consent returns 400 CONSENT_REQUIRED', async () => {
    const app = await buildApp()

    const refused = await reserve(app, { consent: { accepted: false, privacyNoticeVersion: '1.0' } })
    const oldVersion = await reserve(app, { consent: { accepted: true, privacyNoticeVersion: '0.9' } })
    await testPrisma.privacyNotice.updateMany({ data: { active: false } })
    const noActiveNotice = await reserve(app)

    for (const response of [refused, oldVersion, noActiveNotice]) {
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ statusCode: 400, code: 'CONSENT_REQUIRED' })
    }
    expect(await counts()).toEqual(NOTHING_STORED)
  })

  it('reservation outside the allowed period is rejected', async () => {
    const app = await buildApp()
    const expectRejected = async (startAt: Date, code: string) => {
      const response = await reserve(app, { startAt: startAt.toISOString() })

      expect(response.statusCode, startAt.toISOString()).toBe(400)
      expect(response.json(), startAt.toISOString()).toMatchObject({ code })
    }

    await expectRejected(at(TUESDAY, '09:30'), 'OUTSIDE_OPENING_HOURS') // before opening
    await expectRejected(at(TUESDAY, '20:30'), 'OUTSIDE_OPENING_HOURS') // the 2 h loan would end after 22:00
    await testPrisma.openingHour.update({ where: { weekday: 3 }, data: { closed: true } })
    await expectRejected(at('2026-11-18', '10:00'), 'OUTSIDE_OPENING_HOURS') // closed day
    await expectRejected(at(TUESDAY, '10:15'), 'VALIDATION_ERROR') // not the start of a block
    await expectRejected(at('2026-11-24', '10:00'), 'VALIDATION_ERROR') // today + 8 days
    vi.setSystemTime(new Date('2026-11-17T14:10:00Z')) // Tuesday 11:10
    await expectRejected(at(TUESDAY, '10:00'), 'VALIDATION_ERROR') // already past

    expect(await counts()).toEqual(NOTHING_STORED)
  })

  it('reservation on a taken slot returns 409 SLOT_UNAVAILABLE', async () => {
    const app = await buildApp()
    for (let i = 0; i < 6; i++) await seedReservation({ time: '10:00' })

    const same = await reserve(app)
    const overlapping = await reserve(app, { startAt: at(TUESDAY, '11:00').toISOString() }) // the loan would run into 10:00-12:00

    for (const response of [same, overlapping]) {
      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({ statusCode: 409, code: 'SLOT_UNAVAILABLE' })
    }
    expect((await counts()).requests).toBe(6)
  })

  it('reservation second active reservation of the phone returns 409 ACTIVE_RESERVATION_LIMIT', async () => {
    const app = await buildApp()

    expect((await reserve(app)).statusCode).toBe(201)
    const second = await reserve(app, { startAt: at(TUESDAY, '14:00').toISOString() })
    const otherType = await reserve(app, { equipmentType: 'stroller' })
    const otherPhone = await reserve(app, { phone: '63977776666' })

    expect(second.statusCode).toBe(409)
    expect(second.json()).toMatchObject({ statusCode: 409, code: 'ACTIVE_RESERVATION_LIMIT' })
    expect(otherType.statusCode).toBe(201)
    expect(otherPhone.statusCode).toBe(201)
    expect((await counts()).requests).toBe(3)
  })

  it('reservation allowed again after the previous one is cancelled or returned', async () => {
    const app = await buildApp()
    const first = (await reserve(app)).json()
    await testPrisma.request.update({ where: { protocol: first.protocol }, data: { status: 'cancelled' } })

    const second = await reserve(app, { startAt: at(TUESDAY, '14:00').toISOString() })
    expect(second.statusCode).toBe(201)
    await testPrisma.request.update({ where: { protocol: second.json().protocol }, data: { status: 'returned' } })

    expect((await reserve(app, { startAt: at(TUESDAY, '17:00').toISOString() })).statusCode).toBe(201)
  })

  it('settings changes apply to new bookings and keep stored reservations', async () => {
    const app = await buildApp()
    const first = (await reserve(app)).json()

    await testPrisma.reservationSettings.update({
      where: { id: 1 },
      data: { loanDurationMinutes: 60, slotMinutes: 60, maxActiveReservationsPerPhone: 2 },
    })
    await testPrisma.openingHour.update({ where: { weekday: 2 }, data: { closeTime: '18:00' } })

    const stored = await testPrisma.reservation.findFirstOrThrow({ where: { request: { protocol: first.protocol } } })
    expect(stored.endAt.toISOString()).toBe('2026-11-17T15:00:00.000Z') // still 10:00-12:00
    const { slots, slotMinutes, loanDurationMinutes } = (await availability(app, 'wheelchair', TUESDAY)).json()
    expect({ slotMinutes, loanDurationMinutes }).toEqual({ slotMinutes: 60, loanDurationMinutes: 60 })
    expect(slots.at(-1).start).toBe('2026-11-17T20:00:00.000Z') // 17:00: hourly blocks, the 1 h loan ends at 18:00

    const second = await reserve(app, { startAt: at(TUESDAY, '14:00').toISOString() })
    const third = await reserve(app, { startAt: at(TUESDAY, '16:00').toISOString() })

    expect(second.statusCode).toBe(201) // the limit per phone is now 2
    expect(second.json().endAt).toBe('2026-11-17T18:00:00.000Z') // 14:00 + 60 min
    expect(third.statusCode).toBe(409)
    expect(third.json()).toMatchObject({ code: 'ACTIVE_RESERVATION_LIMIT' })
  })

  it('reservation failure leaves no orphan request', async () => {
    const app = await buildApp()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await testPrisma.$executeRawUnsafe(
      "CREATE OR REPLACE FUNCTION fail_consent() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$ LANGUAGE plpgsql",
    )
    await testPrisma.$executeRawUnsafe(
      'CREATE TRIGGER fail_consent_trigger BEFORE INSERT ON consents FOR EACH ROW EXECUTE FUNCTION fail_consent()',
    )

    try {
      const response = await reserve(app)

      expect(response.statusCode).toBe(500)
      expect(response.body).not.toContain('forced failure')
      expect(await counts()).toEqual(NOTHING_STORED)
    } finally {
      await testPrisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_consent_trigger ON consents')
      await testPrisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS fail_consent()')
    }

    // The rolled-back booking released its lock: the next one for the same type goes through.
    expect((await reserve(app)).statusCode).toBe(201)
  })

  it('reservation failure log holds no personal data', async () => {
    const app = await buildApp()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await testPrisma.$executeRawUnsafe(
      "CREATE OR REPLACE FUNCTION fail_consent() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$ LANGUAGE plpgsql",
    )
    await testPrisma.$executeRawUnsafe(
      'CREATE TRIGGER fail_consent_trigger BEFORE INSERT ON consents FOR EACH ROW EXECUTE FUNCTION fail_consent()',
    )

    try {
      await reserve(app, { name: 'Nome Muito Secreto', phone: '63988880000', email: 'segredo@email.com' })
    } finally {
      await testPrisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_consent_trigger ON consents')
      await testPrisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS fail_consent()')
    }

    const output = logged.mock.calls.flat().map((entry) => String((entry as Error)?.message ?? entry)).join(' ')
    expect(logged).toHaveBeenCalled()
    for (const secret of ['Nome Muito Secreto', '63988880000', 'segredo@email.com']) {
      expect(output).not.toContain(secret)
    }
  })

  it('equipment reduction keeps stored reservations and limits new ones', async () => {
    const app = await buildApp()
    expect((await reserve(app)).statusCode).toBe(201)

    await limitUnits('wheelchair', 1) // the pool shrinks from 6 to 1 unit

    expect(await testPrisma.reservation.count()).toBe(1) // the booking made before is kept
    expect((await availability(app, 'wheelchair', TUESDAY)).json().slots[0].availableUnits).toBe(0)
    const response = await reserve(app, { phone: '63977776666' })
    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'SLOT_UNAVAILABLE' })
  })

  it('advance window setting applies to bookings and availability', async () => {
    const app = await buildApp()
    await testPrisma.reservationSettings.update({ where: { id: 1 }, data: { maxAdvanceDays: 2 } })

    expect((await reserve(app)).statusCode).toBe(201) // Tuesday is today + 1
    const far = await reserve(app, { startAt: at('2026-11-20', '10:00').toISOString(), phone: '63977776666' }) // today + 4

    expect(far.statusCode).toBe(400)
    expect(far.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    expect((await availability(app, 'wheelchair', '2026-11-20')).json().slots).toEqual([])
    expect((await availability(app, 'wheelchair', '2026-11-18')).json().slots).not.toHaveLength(0) // today + 2
  })

  it('reservation with an unknown location or fields of the other type returns 400', async () => {
    const app = await buildApp()
    await testPrisma.location.update({ where: { id: locations.familyLocationId }, data: { active: false } })

    const responses = [
      await reserve(app, { currentLocationId: '00000000-0000-4000-8000-000000000999' }),
      await reserve(app, { currentLocationId: locations.familyLocationId }), // inactive
      await reserve(app, { equipmentType: 'stroller', forWhom: 'self' }),
      await reserve(app, { equipmentType: 'stroller', size: 'adult' }),
      await reserve(app, { equipmentType: 'wheelchair', strollerKind: 'double' }),
    ]

    for (const response of responses) {
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    expect(await counts()).toEqual(NOTHING_STORED)
    expect((await reserve(app, { equipmentType: 'stroller', strollerKind: 'double' })).statusCode).toBe(201)
  })
})

// ---------------------------------------------------------------------------- limits and concurrency

/** Leaves `quantity` active units of the type: one active row, every other row of the type inactive. */
async function limitUnits(type: 'wheelchair' | 'stroller', quantity: number) {
  const rows = await testPrisma.equipment.findMany({ where: { type }, orderBy: { createdAt: 'asc' } })

  await testPrisma.equipment.updateMany({ where: { type }, data: { active: false } })
  await testPrisma.equipment.update({ where: { id: rows[0].id }, data: { active: true, quantity } })
}

const statuses = (responses: { statusCode: number }[]) => responses.map((response) => response.statusCode).sort()
const codes = (responses: { json: () => { code?: string } }[]) => responses.map((response) => response.json().code)

describe('limits and concurrency', () => {
  it('equipment quantity limits the reservations of a block', async () => {
    const app = await buildApp()
    await limitUnits('wheelchair', 2)

    const results = [
      await reserve(app, { phone: '63911110001' }),
      await reserve(app, { phone: '63911110002' }),
      await reserve(app, { phone: '63911110003' }),
    ]

    expect(results.map((response) => response.statusCode)).toEqual([201, 201, 409])
    expect(results[2].json()).toMatchObject({ code: 'SLOT_UNAVAILABLE' })
    const { slots } = (await availability(app, 'wheelchair', TUESDAY)).json()
    expect(slots[0]).toMatchObject({ availableUnits: 0, available: false })
  })

  it('simultaneous reservations create exactly as many as there are free units', async () => {
    const app = await buildApp()
    await limitUnits('wheelchair', 2)

    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) => reserve(app, { phone: `6392222000${index}` })),
    )

    expect(statuses(responses)).toEqual([201, 201, 409, 409, 409, 409, 409, 409])
    expect(codes(responses.filter((response) => response.statusCode === 409))).toEqual(Array(6).fill('SLOT_UNAVAILABLE'))
    expect(await testPrisma.reservation.count()).toBe(2)
  })

  it('simultaneous reservations from one phone create only one', async () => {
    const app = await buildApp()
    const times = ['10:00', '10:30', '11:00', '14:00', '15:00', '16:00']

    const responses = await Promise.all(
      times.map((time) => reserve(app, { startAt: at(TUESDAY, time).toISOString() })),
    )

    expect(statuses(responses)).toEqual([201, 409, 409, 409, 409, 409])
    expect(new Set(codes(responses.filter((response) => response.statusCode === 409)))).toEqual(
      new Set(['ACTIVE_RESERVATION_LIMIT']),
    )
    expect(await testPrisma.reservation.count()).toBe(1)
  })

  it('simultaneous reservations of different types both succeed', async () => {
    const app = await buildApp()
    await limitUnits('wheelchair', 2)
    await limitUnits('stroller', 2)

    const responses = await Promise.all([
      ...Array.from({ length: 4 }, (_, index) => reserve(app, { phone: `6393333000${index}` })),
      ...Array.from({ length: 4 }, (_, index) =>
        reserve(app, { equipmentType: 'stroller', phone: `6394444000${index}` }),
      ),
    ])

    expect(responses.filter((response) => response.statusCode === 201)).toHaveLength(4) // 2 of each type
    expect(await testPrisma.reservation.count({ where: { equipmentType: 'wheelchair' } })).toBe(2)
    expect(await testPrisma.reservation.count({ where: { equipmentType: 'stroller' } })).toBe(2)
  })

  it('booking lock is per type and availability takes no lock', async () => {
    const app = await buildApp()
    let release!: () => void
    let acquired!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const lockTaken = new Promise<void>((resolve) => (acquired = resolve))

    // Another booking of wheelchairs is "in progress": it holds the wheelchair lock.
    const holder = testPrisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'equipment:wheelchair'}))`
        acquired()
        await held
      },
      { timeout: 20_000 },
    )
    await lockTaken

    let wheelchairDone = false
    const wheelchair = reserve(app, { phone: '63911110001' }).then((response) => {
      wheelchairDone = true

      return response
    })
    const stroller = await reserve(app, { equipmentType: 'stroller', phone: '63911110002' })
    const consultation = await availability(app, 'wheelchair', TUESDAY)
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(stroller.statusCode).toBe(201) // another type is not delayed
    expect(consultation.statusCode).toBe(200) // availability takes no lock
    expect(wheelchairDone).toBe(false) // the same type waits for the lock

    release()
    await holder

    expect((await wheelchair).statusCode).toBe(201)
  })

  it('reservation endpoint is rate limited and availability is not', async () => {
    const app = await buildApp()

    for (let i = 0; i < 10; i++) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/reservations', payload: {} })).statusCode).toBe(400)
    }
    const blocked = await app.inject({ method: 'POST', url: '/api/v1/reservations', payload: {} })

    expect(blocked.statusCode).toBe(429)
    expect(blocked.json()).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' })

    const cancelApp = await buildApp()
    for (let i = 0; i < 10; i++) {
      await cancelApp.inject({ method: 'POST', url: '/api/v1/tracking/CAP-AAAA-BBBB/cancel', payload: { phone: '63999998888' } })
    }
    const cancelBlocked = await cancelApp.inject({
      method: 'POST',
      url: '/api/v1/tracking/CAP-AAAA-BBBB/cancel',
      payload: { phone: '63999998888' },
    })
    expect(cancelBlocked.statusCode).toBe(429)

    for (let i = 0; i < 15; i++) {
      expect((await availability(app, 'wheelchair', TUESDAY)).statusCode).toBe(200)
    }
  })
})

// ---------------------------------------------------------------------------- cancel

const PHONE = '63999998888'

function cancel(app: App, protocol: string, payload: Record<string, unknown> = { phone: PHONE }) {
  return app.inject({ method: 'POST', url: `/api/v1/tracking/${protocol}/cancel`, payload })
}

async function reserveAndGetProtocol(app: App, overrides: Record<string, unknown> = {}) {
  const response = await reserve(app, overrides)

  expect(response.statusCode).toBe(201)

  return response.json().protocol as string
}

describe('POST /api/v1/tracking/:protocol/cancel', () => {
  it('cancel valid reservation returns 200 and records history', async () => {
    const app = await buildApp()
    const protocol = await reserveAndGetProtocol(app)

    const response = await cancel(app, protocol, { phone: PHONE, reason: 'Mudei de ideia' })
    const view = response.json()

    expect(response.statusCode).toBe(200)
    expect(view).toMatchObject({
      protocol,
      type: 'reservation',
      publicStatus: 'cancelled',
      summary: { equipmentType: 'wheelchair', startAt: '2026-11-17T13:00:00.000Z', endAt: '2026-11-17T15:00:00.000Z' },
      messages: [],
      canCancel: false,
      canReply: false,
    })
    expect(view.timeline.map((entry: { status: string }) => entry.status)).toEqual(['reserved', 'cancelled'])

    const stored = await testPrisma.request.findUniqueOrThrow({ where: { protocol }, include: { history: true } })
    expect(stored.status).toBe('cancelled')
    expect(stored.completedAt?.toISOString()).toBe(NOW.toISOString())
    const last = stored.history.find((entry) => entry.toStatus === 'cancelled')
    expect(last).toMatchObject({ fromStatus: 'reserved', actorType: 'visitor', internalNote: 'Mudei de ideia' })
  })

  it('cancel frees the unit for availability and a new booking', async () => {
    const app = await buildApp()
    await limitUnits('wheelchair', 1)
    const protocol = await reserveAndGetProtocol(app, { phone: '63911110001' })

    expect((await availability(app, 'wheelchair', TUESDAY)).json().slots[0].availableUnits).toBe(0)
    expect((await reserve(app, { phone: '63911110002' })).statusCode).toBe(409)

    expect((await cancel(app, protocol, { phone: '63911110001' })).statusCode).toBe(200)

    expect((await availability(app, 'wheelchair', TUESDAY)).json().slots[0].availableUnits).toBe(1)
    expect((await reserve(app, { phone: '63911110002' })).statusCode).toBe(201)
  })

  it('cancel unknown protocol wrong phone or anonymized returns the same 404', async () => {
    const app = await buildApp()
    const protocol = await reserveAndGetProtocol(app)
    const anonymized = await reserveAndGetProtocol(app, { phone: '63977776666' }) // keeps its phone: only anonymizedAt differs
    await testPrisma.request.update({ where: { protocol: anonymized }, data: { anonymizedAt: NOW } })

    const responses = [
      await cancel(app, 'CAP-ZZZZ-9999'),
      await cancel(app, 'not-a-protocol'),
      await cancel(app, protocol, { phone: '63900000000' }),
      await cancel(app, anonymized, { phone: '63977776666' }),
    ]

    for (const response of responses) {
      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' })
    }
    expect(new Set(responses.map((response) => response.body)).size).toBe(1) // identical bodies
    expect((await testPrisma.request.findUniqueOrThrow({ where: { protocol } })).status).toBe('reserved')
  })

  it('cancel in a final or picked up status returns 409 REQUEST_NOT_CANCELLABLE', async () => {
    const app = await buildApp()
    const protocol = await reserveAndGetProtocol(app)

    for (const status of ['picked_up', 'returned', 'no_show', 'cancelled'] as const) {
      await testPrisma.request.update({ where: { protocol }, data: { status } })

      const response = await cancel(app, protocol)

      expect(response.statusCode, status).toBe(409)
      expect(response.json(), status).toMatchObject({ statusCode: 409, code: 'REQUEST_NOT_CANCELLABLE' })
      const stored = await testPrisma.request.findUniqueOrThrow({ where: { protocol }, include: { history: true } })
      expect(stored.status, status).toBe(status)
      expect(stored.history, status).toHaveLength(1) // only the creation entry
    }
  })

  it('cancel invalid phone or reason returns 400', async () => {
    const app = await buildApp()
    const protocol = await reserveAndGetProtocol(app)

    const responses = [
      await cancel(app, protocol, { phone: 'abc' }),
      await cancel(app, protocol, {}),
      await cancel(app, protocol, { phone: PHONE, reason: 'r'.repeat(201) }),
    ]

    for (const response of responses) {
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
    }
    expect((await testPrisma.request.findUniqueOrThrow({ where: { protocol } })).status).toBe('reserved')
  })

  it('cancel and pickup at the same time apply one transition', async () => {
    const app = await buildApp()

    for (let round = 0; round < 8; round++) {
      const phone = `6395555000${round}`
      const protocol = await reserveAndGetProtocol(app, { phone, startAt: at(TUESDAY, `${10 + round}:00`).toISOString() })
      const request = await testPrisma.request.findUniqueOrThrow({ where: { protocol } })

      // The pickup is what the admin route will do: a conditional update on `reserved`.
      const [cancelled, pickup] = await Promise.all([
        cancel(app, protocol, { phone }),
        testPrisma.request.updateMany({ where: { id: request.id, status: 'reserved' }, data: { status: 'picked_up' } }),
      ])
      const final = (await testPrisma.request.findUniqueOrThrow({ where: { protocol } })).status

      if (cancelled.statusCode === 200) {
        expect({ final, pickedUp: pickup.count }).toEqual({ final: 'cancelled', pickedUp: 0 })
      } else {
        expect(cancelled.statusCode).toBe(409)
        expect({ final, pickedUp: pickup.count }).toEqual({ final: 'picked_up', pickedUp: 1 })
      }
    }
  })

  it('cancel of a request that is not a reservation returns 409', async () => {
    const app = await buildApp()
    const lost = await testPrisma.request.create({
      data: { protocol: 'CAP-LOST-2222', type: 'lost_report', status: 'registered', visitorName: 'Visitante', visitorPhone: PHONE },
    })

    const response = await cancel(app, lost.protocol)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'REQUEST_NOT_CANCELLABLE' })
    expect((await testPrisma.request.findUniqueOrThrow({ where: { id: lost.id } })).status).toBe('registered')
  })

  it('cancel view exposes only public fields without a token', async () => {
    const app = await buildApp()
    const protocol = await reserveAndGetProtocol(app, { email: 'maria@email.com' })

    const response = await cancel(app, protocol) // no Authorization header

    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.json()).sort()).toEqual(
      ['canCancel', 'canReply', 'createdAt', 'messages', 'protocol', 'publicStatus', 'summary', 'timeline', 'type'],
    )
    for (const secret of [PHONE, 'maria@email.com', 'Maria Souza']) {
      expect(response.body).not.toContain(secret)
    }
  })
})
