// Integration tests of POST /lost-reports against a real PostgreSQL test database
// (`hackathon_test`, see src/test/test-db.ts). Test files run one at a time (vitest.config.mts).
import { fastify } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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

// Monday 2026-11-16, 09:00 in America/Araguaina (UTC-3).
const NOW = new Date('2026-11-16T12:00:00Z')
const PHONE = '63988887777'

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
  vi.restoreAllMocks()
})

async function buildApp() {
  const app = fastify()

  app.setErrorHandler(errorHandler)
  await app.register(routes, { prefix: '/api/v1' })

  await app.ready()
  return app
}

type App = Awaited<ReturnType<typeof buildApp>>

/** A valid body (the example of the contract), with the given overrides. */
function body(overrides: Record<string, unknown> = {}) {
  return {
    category: 'wallet_bag',
    description: 'Carteira preta de couro',
    identificationDetail: 'Foto de um cachorro dentro da carteira',
    locationId: locations.sacLocationId,
    unknownLocation: false,
    lostDate: '2026-11-12',
    lostPeriod: 'afternoon',
    name: 'João Lima',
    phone: PHONE,
    consent: { accepted: true, privacyNoticeVersion: '1.0' },
    ...overrides,
  }
}

function report(app: App, payload: Record<string, unknown> = body()) {
  return app.inject({ method: 'POST', url: '/api/v1/lost-reports', payload })
}

async function counts() {
  const [requests, lostReports, consents, history] = await Promise.all([
    testPrisma.request.count(),
    testPrisma.lostReport.count(),
    testPrisma.consent.count(),
    testPrisma.requestHistory.count(),
  ])

  return { requests, lostReports, consents, history }
}

const NOTHING_STORED = { requests: 0, lostReports: 0, consents: 0, history: 0 }

describe('POST /api/v1/lost-reports', () => {
  it('valid report returns 201 with protocol status createdAt and trackingPath', async () => {
    const app = await buildApp()

    const response = await report(app)
    const result = response.json()

    expect(response.statusCode).toBe(201)
    expect(Object.keys(result).sort()).toEqual(['createdAt', 'protocol', 'status', 'trackingPath'])
    expect(result.status).toBe('registered')
    expect(result.protocol).toMatch(/^CAP-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(result.trackingPath).toBe(`/acompanhar/${result.protocol}`)
    expect(Number.isNaN(Date.parse(result.createdAt))).toBe(false)
  })

  it('valid report persists request lost report consent and history', async () => {
    const app = await buildApp()

    const response = await report(app, body({ email: ' maria@email.com ', photoUrl: 'https://cdn.example.com/a.png' }))
    const stored = await testPrisma.request.findUniqueOrThrow({
      where: { protocol: response.json().protocol },
      include: { lostReport: true, consents: true, history: true },
    })

    expect(stored).toMatchObject({
      type: 'lost_report',
      status: 'registered',
      visitorName: 'João Lima',
      visitorPhone: PHONE,
      visitorEmail: 'maria@email.com',
    })
    expect(stored.lostReport).toMatchObject({
      category: 'wallet_bag',
      description: 'Carteira preta de couro',
      identificationDetail: 'Foto de um cachorro dentro da carteira',
      photoUrl: 'https://cdn.example.com/a.png',
      locationId: locations.sacLocationId,
      unknownLocation: false,
      lostPeriod: 'afternoon',
    })
    expect(stored.lostReport?.lostDate.toISOString()).toBe('2026-11-12T00:00:00.000Z')
    expect(stored.consents).toHaveLength(1)
    expect(stored.history).toHaveLength(1)
    expect(stored.history[0]).toMatchObject({ fromStatus: null, toStatus: 'registered', actorType: 'visitor' })
    expect(await counts()).toEqual({ requests: 1, lostReports: 1, consents: 1, history: 1 })
  })

  it('absent lostPeriod and unknownLocation store unknown and false', async () => {
    const app = await buildApp()
    const { lostPeriod: _period, unknownLocation: _unknown, ...minimal } = body()

    const response = await report(app, minimal)
    const stored = await testPrisma.lostReport.findFirstOrThrow({ where: { request: { protocol: response.json().protocol } } })

    expect(response.statusCode).toBe(201)
    expect(stored.lostPeriod).toBe('unknown')
    expect(stored.unknownLocation).toBe(false)
  })

  it('creation leaves match delivery completion and anonymization empty', async () => {
    const app = await buildApp()

    const response = await report(app)
    const stored = await testPrisma.request.findUniqueOrThrow({
      where: { protocol: response.json().protocol },
      include: { lostReport: true },
    })

    expect(stored.completedAt).toBeNull()
    expect(stored.anonymizedAt).toBeNull()
    expect(stored.lostReport).toMatchObject({
      foundItemId: null,
      matchedAt: null,
      identificationValidated: null,
      deliveredAt: null,
      deliveryNotes: null,
    })
  })

  it('protocol has the CAP format and a colliding protocol is replaced', async () => {
    const app = await buildApp()
    await testPrisma.request.create({
      data: { protocol: 'CAP-AAAA-AAAA', type: 'sac_message', status: 'open', visitorName: 'Outra Pessoa' },
    })
    vi.mocked(generateProtocol).mockReturnValueOnce('CAP-AAAA-AAAA').mockReturnValueOnce('CAP-BBBB-BBBB')

    const response = await report(app)

    expect(response.statusCode).toBe(201)
    expect(response.json().protocol).toBe('CAP-BBBB-BBBB')
    expect(await testPrisma.request.count({ where: { type: 'lost_report' } })).toBe(1)
    expect((await testPrisma.request.findUniqueOrThrow({ where: { protocol: 'CAP-AAAA-AAAA' } })).type).toBe('sac_message')
  })

  it('two identical reports create two distinct protocols', async () => {
    const app = await buildApp()

    const first = await report(app)
    const second = await report(app)

    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(201)
    expect(first.json().protocol).not.toBe(second.json().protocol)
    expect(await counts()).toEqual({ requests: 2, lostReports: 2, consents: 2, history: 2 })
  })

  it('route validates the body with the schema before the controller', async () => {
    const app = await buildApp()
    const { description: _removed, ...withoutDescription } = body()

    const response = await report(app, withoutDescription)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
    expect(response.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'description', issue: expect.any(String) })]),
    )
    expect(await counts()).toEqual(NOTHING_STORED)
  })
})

describe('location and consent', () => {
  it('unknown inactive or malformed location is rejected with 400', async () => {
    const app = await buildApp()
    const inactive = await testPrisma.location.create({
      data: { name: 'Ala fechada', floor: '1º pavimento', type: 'store_area', active: false },
    })

    for (const locationId of ['not-a-uuid', '3f2a9c1e-7b4d-4e8a-9c3b-1a2b3c4d5e6f', inactive.id]) {
      const response = await report(app, body({ locationId }))

      expect(response.statusCode, locationId).toBe(400)
      expect(response.json(), locationId).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
    }
    expect(await counts()).toEqual(NOTHING_STORED)
  })

  it('unknownLocation without locationId is stored as unknown location', async () => {
    const app = await buildApp()
    const { locationId: _removed, ...withoutLocation } = body()

    const response = await report(app, { ...withoutLocation, unknownLocation: true })
    const stored = await testPrisma.lostReport.findFirstOrThrow({ where: { request: { protocol: response.json().protocol } } })

    expect(response.statusCode).toBe(201)
    expect(stored.locationId).toBeNull()
    expect(stored.unknownLocation).toBe(true)
  })

  it('accepted false is rejected with CONSENT_REQUIRED', async () => {
    const app = await buildApp()

    const response = await report(app, body({ consent: { accepted: false, privacyNoticeVersion: '1.0' } }))

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ statusCode: 400, code: 'CONSENT_REQUIRED' })
    expect(await counts()).toEqual(NOTHING_STORED)
  })

  it('wrong or missing active privacy version is rejected with CONSENT_REQUIRED', async () => {
    const app = await buildApp()

    const wrong = await report(app, body({ consent: { accepted: true, privacyNoticeVersion: '0.9' } }))

    await testPrisma.privacyNotice.updateMany({ data: { active: false } })
    const noActive = await report(app)

    for (const response of [wrong, noActive]) {
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ statusCode: 400, code: 'CONSENT_REQUIRED' })
    }
    expect(await counts()).toEqual(NOTHING_STORED)
  })

  it('valid report stores one consent with version and purpose', async () => {
    const app = await buildApp()

    const response = await report(app)
    const consents = await testPrisma.consent.findMany({ where: { request: { protocol: response.json().protocol } } })

    expect(consents).toHaveLength(1)
    expect(consents[0]).toMatchObject({ privacyNoticeVersion: '1.0', purpose: 'atender a solicitação' })
    expect(consents[0].acceptedAt).toBeInstanceOf(Date)
  })
})
