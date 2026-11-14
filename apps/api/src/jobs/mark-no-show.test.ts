// Integration tests of the no-show routine against a real PostgreSQL test database
// (`hackathon_test`, see src/test/test-db.ts). Test files run one at a time.
import { fastify } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { errorHandler } from '../http/error-handler'
import { routes } from '../http/routes'
import { equipmentOperationsRepository } from '../modules/equipment-operations/equipment-operations.repository'
import { localDateToUtc } from '../modules/reservations/reservations.slots'
import { resetTestDb, setupTestDb, testPrisma } from '../test/test-db'
import { generateProtocol } from '../utils/protocol'
import { runMarkNoShow, startNoShowJob } from './mark-no-show'

vi.mock('../lib/prisma', async () => {
  const { testPrisma } = await import('../test/test-db.js')

  return { prisma: testPrisma }
})

vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 })

// Tuesday 2026-11-17, 10:20 in America/Araguaina (UTC-3): the 10:00 reservations had their deadline at 10:15.
const NOW = new Date('2026-11-17T13:20:00Z')
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
})

type Status = 'reserved' | 'picked_up' | 'returned' | 'cancelled' | 'no_show'

let phoneSeq = 0

async function seedReservation(options: { status?: Status; time?: string; pickupDeadline?: Date } = {}) {
  const startAt = localDateToUtc('2026-11-17', options.time ?? '10:00')

  return testPrisma.request.create({
    data: {
      protocol: generateProtocol(),
      type: 'reservation',
      status: options.status ?? 'reserved',
      visitorName: 'Visitante Teste',
      visitorPhone: `6399${String(100000 + ++phoneSeq)}`.slice(0, 11),
      history: { create: { fromStatus: null, toStatus: options.status ?? 'reserved', actorType: 'visitor', createdAt: new Date(NOW.getTime() - 60 * MINUTE) } },
      reservation: {
        create: {
          equipmentType: 'wheelchair',
          startAt,
          endAt: new Date(startAt.getTime() + 120 * MINUTE),
          pickupDeadline: options.pickupDeadline ?? new Date(startAt.getTime() + 15 * MINUTE),
        },
      },
    },
  })
}

function stored(id: string) {
  return testPrisma.request.findUniqueOrThrow({ where: { id }, include: { history: { orderBy: { createdAt: 'asc' } } } })
}

const noShowRows = () => testPrisma.requestHistory.count({ where: { toStatus: 'no_show' } })

describe('no-show routine', () => {
  it('no-show marks a reserved reservation past its deadline', async () => {
    const target = await seedReservation()

    const affected = await runMarkNoShow(NOW)
    const after = await stored(target.id)

    expect(affected).toBe(1)
    expect(after.status).toBe('no_show')
    expect(after.completedAt?.toISOString()).toBe(NOW.toISOString())
    expect(after.history).toHaveLength(2)
    expect(after.history[1]).toMatchObject({ fromStatus: 'reserved', toStatus: 'no_show' })
  })

  it('no-show history has system actor and no user', async () => {
    const target = await seedReservation()

    await runMarkNoShow(NOW)
    const entry = (await stored(target.id)).history[1]

    expect(entry).toMatchObject({ actorType: 'system', actorUserId: null, internalNote: null })
    expect(entry.createdAt.toISOString()).toBe(NOW.toISOString())
  })

  it('no-show leaves reservations within the tolerance untouched', async () => {
    const exactly = await seedReservation({ pickupDeadline: NOW }) // the deadline is this very instant: the pickup is still allowed
    const oneMore = await seedReservation({ pickupDeadline: new Date(NOW.getTime() + 1) })
    const later = await seedReservation({ time: '11:00' })

    const affected = await runMarkNoShow(NOW)

    expect(affected).toBe(0)
    for (const target of [exactly, oneMore, later]) {
      const after = await stored(target.id)

      expect(after.status).toBe('reserved')
      expect(after.completedAt).toBeNull()
      expect(after.history).toHaveLength(1)
    }
  })

  it('no-show ignores cancelled picked up returned and already no-show reservations', async () => {
    const others: Awaited<ReturnType<typeof seedReservation>>[] = []
    for (const status of ['cancelled', 'picked_up', 'returned', 'no_show'] as const) {
      others.push(await seedReservation({ status }))
    }
    const expectedCompletedAt = await testPrisma.request.findMany({ where: { id: { in: others.map((item) => item.id) } }, select: { id: true, completedAt: true } })

    const affected = await runMarkNoShow(NOW)

    expect(affected).toBe(0)
    for (const [index, status] of (['cancelled', 'picked_up', 'returned', 'no_show'] as const).entries()) {
      const after = await stored(others[index].id)

      expect(after.status).toBe(status)
      expect(after.history).toHaveLength(1)
      expect(after.completedAt).toEqual(expectedCompletedAt.find((item) => item.id === others[index].id)?.completedAt)
    }
  })

  it('no-show run twice affects nothing the second time', async () => {
    await seedReservation()
    await seedReservation({ time: '09:00' })

    const first = await runMarkNoShow(NOW)
    const second = await runMarkNoShow(NOW)
    const third = await runMarkNoShow(new Date(NOW.getTime() + 10 * MINUTE))

    expect([first, second, third]).toEqual([2, 0, 0])
    expect(await noShowRows()).toBe(2)
  })

  it('simultaneous no-show runs mark each reservation once', async () => {
    const targets = []
    for (const time of ['09:00', '09:30', '10:00', '08:00', '08:30', '07:00']) targets.push(await seedReservation({ time }))

    const results = await Promise.all(Array.from({ length: 4 }, () => runMarkNoShow(NOW)))

    expect(results.reduce((sum, value) => sum + value, 0)).toBe(6)
    expect(await noShowRows()).toBe(6)
    for (const target of targets) {
      const after = await stored(target.id)

      expect(after.status).toBe('no_show')
      expect(after.history.filter((entry) => entry.toStatus === 'no_show')).toHaveLength(1)
    }
  })

  it('no-show frees the unit in the public availability', async () => {
    const app = fastify()
    app.setErrorHandler(errorHandler)
    await app.register(routes, { prefix: '/api/v1' })
    await app.ready()
    // One single active unit, so that the reservation that nobody picked up takes all of it.
    await testPrisma.equipment.updateMany({ where: { type: 'wheelchair' }, data: { active: false } })
    const [first] = await testPrisma.equipment.findMany({ where: { type: 'wheelchair' }, orderBy: { createdAt: 'asc' } })
    await testPrisma.equipment.update({ where: { id: first.id }, data: { active: true, quantity: 1 } })
    await seedReservation()
    const unitsAt = async () =>
      (await app.inject({ method: 'GET', url: '/api/v1/equipment/wheelchair/availability?date=2026-11-17' }))
        .json()
        .slots.find((slot: { start: string }) => slot.start === '2026-11-17T13:30:00.000Z').availableUnits

    expect(await unitsAt()).toBe(0)

    await runMarkNoShow(NOW)

    expect(await unitsAt()).toBe(1)
  })

  it('failed no-show run changes nothing and logs the failure without personal data', async () => {
    const target = await seedReservation()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await testPrisma.$executeRawUnsafe(
      "CREATE OR REPLACE FUNCTION fail_history() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced failure for Visitante Teste 63999990000'; END; $$ LANGUAGE plpgsql",
    )
    await testPrisma.$executeRawUnsafe(
      'CREATE TRIGGER fail_history_trigger BEFORE INSERT ON request_history FOR EACH ROW WHEN (NEW.from_status IS NOT NULL) EXECUTE FUNCTION fail_history()',
    )

    try {
      const affected = await runMarkNoShow(NOW)

      expect(affected).toBe(0)
      const after = await stored(target.id)

      expect(after.status).toBe('reserved')
      expect(after.completedAt).toBeNull()
      expect(after.history).toHaveLength(1)
    } finally {
      await testPrisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_history_trigger ON request_history')
      await testPrisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS fail_history()')
    }

    const logs = await testPrisma.jobLog.findMany()

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ jobName: 'mark-no-show', status: 'failed', affectedCount: 0 })
    expect(logs[0].finishedAt).not.toBeNull()
    for (const secret of ['Visitante Teste', '63999990000', 'forced failure']) {
      expect(logs[0].error ?? '').not.toContain(secret)
      expect(JSON.stringify(logged.mock.calls)).not.toContain(secret)
    }
    expect(await runMarkNoShow(NOW)).toBe(1) // the next run recovers what the failed one left
  })

  it('no-show routine has no public endpoint', async () => {
    const app = fastify()
    app.setErrorHandler(errorHandler)
    await app.register(routes, { prefix: '/api/v1' })
    await app.ready()

    for (const url of ['/api/v1/jobs/mark-no-show', '/api/v1/admin/jobs/mark-no-show', '/api/v1/admin/no-show', '/api/v1/reservations/no-show']) {
      for (const method of ['GET', 'POST'] as const) {
        const response = await app.inject({ method, url })

        expect(response.statusCode, `${method} ${url}`).toBe(404)
      }
    }
    expect(app.printRoutes()).not.toMatch(/no-?show/i)
  })

  it('job log is written only when reservations were affected or the run failed', async () => {
    await runMarkNoShow(NOW) // nothing to do
    expect(await testPrisma.jobLog.count()).toBe(0)

    await seedReservation()
    await seedReservation({ time: '09:00' })
    await runMarkNoShow(NOW) // two reservations
    await runMarkNoShow(NOW) // nothing left

    const logs = await testPrisma.jobLog.findMany()

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ jobName: 'mark-no-show', status: 'success', affectedCount: 2, error: null })
    expect(logs[0].startedAt).toBeInstanceOf(Date)
    expect(logs[0].finishedAt).toBeInstanceOf(Date)
  })

  it('job runner skips an overlapping run', async () => {
    vi.useFakeTimers() // every timer, to drive the interval by hand
    let finish: (value: number) => void = () => undefined
    const slow = vi.spyOn(equipmentOperationsRepository, 'markNoShowsTx').mockImplementation(
      () => new Promise<number>((resolve) => (finish = resolve)),
    )
    const timer = startNoShowJob(1000)

    try {
      await vi.advanceTimersByTimeAsync(3500) // three ticks while the first run is still going

      expect(slow).toHaveBeenCalledTimes(1)

      finish(0)
      await vi.advanceTimersByTimeAsync(1000) // the next tick finds the runner free again

      expect(slow).toHaveBeenCalledTimes(2)
      finish(0)
    } finally {
      clearInterval(timer)
    }
  })
})
