import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../http/routes/_errors/not-found-error'
import { prisma } from '../../lib/prisma'
import { getServiceDetail, isOpenNow, listServices } from './services.service'

vi.mock('../../lib/prisma', () => ({
  prisma: {
    service: { findMany: vi.fn(), findUnique: vi.fn() },
    openingHour: { findMany: vi.fn() },
    reservationSettings: { findUnique: vi.fn() },
  },
}))

const PICKUP = {
  id: '00000000-0000-0000-0000-0000000000a1',
  name: 'SAC',
  floor: 'L1',
  type: 'service',
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function serviceRow(overrides: Record<string, unknown>) {
  return {
    id: '00000000-0000-0000-0000-000000000001',
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

const HOURS = [
  { id: 1, weekday: 0, closed: false, openTime: '10:00', closeTime: '23:30' },
  { id: 2, weekday: 1, closed: true, openTime: null, closeTime: null },
  { id: 3, weekday: 2, closed: false, openTime: '10:00', closeTime: '22:00' },
]

const SETTINGS = {
  id: 1,
  loanDurationMinutes: 120,
  pickupToleranceMinutes: 15,
  foundItemStorageDays: 90,
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('listServices', () => {
  it('list services returns only active ordered', async () => {
    const rows = [
      serviceRow({ id: '00000000-0000-0000-0000-000000000002', slug: 'b', sortOrder: 2 }),
      serviceRow({ id: '00000000-0000-0000-0000-000000000003', slug: 'inativo', sortOrder: 1, active: false }),
      serviceRow({ id: '00000000-0000-0000-0000-000000000004', slug: 'a', sortOrder: 1 }),
    ]
    // The fake honours the query the repository sends, so the filter and the order are the real ones.
    vi.mocked(prisma.service.findMany).mockImplementation((async (args: {
      where?: { active?: boolean }
      orderBy?: { sortOrder?: 'asc' | 'desc' }
    }) => {
      const filtered = rows.filter((r) => args.where?.active === undefined || r.active === args.where.active)
      return args.orderBy?.sortOrder === 'asc'
        ? [...filtered].sort((x, y) => (x.sortOrder as number) - (y.sortOrder as number))
        : filtered
    }) as never)

    const result = await listServices()

    expect(result.map((s) => s.slug)).toEqual(['a', 'b'])
    expect(Object.keys(result[0]).sort()).toEqual(
      ['equipmentType', 'flow', 'icon', 'id', 'kind', 'name', 'shortDescription', 'slug'].sort(),
    )
  })
})

describe('getServiceDetail', () => {
  it('get service detail by slug', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ ...serviceRow({}), pickupLocation: PICKUP } as never)
    vi.mocked(prisma.openingHour.findMany).mockResolvedValue(HOURS as never)
    vi.mocked(prisma.reservationSettings.findUnique).mockResolvedValue(SETTINGS as never)

    // 2026-11-17 15:00Z is Tuesday 12:00 in America/Araguaina
    const detail = await getServiceDetail('cadeiras-de-rodas', new Date('2026-11-17T15:00:00Z'))

    expect(detail).toMatchObject({
      slug: 'cadeiras-de-rodas',
      description: 'Descrição completa',
      howItWorks: ['Escolha o horário', 'Retire no SAC'],
      isOpenNow: true,
      loanDurationMinutes: 120,
      pickupToleranceMinutes: 15,
      storageDays: 90,
      contactPhone: '(63) 3219-4616',
    })
    expect(detail.pickupLocation).toEqual({
      id: PICKUP.id,
      name: 'SAC',
      floor: 'L1',
      type: 'service',
      active: true,
    })
    expect(detail.openingHours).toContainEqual({ weekday: 2, closed: false, open: '10:00', close: '22:00' })
    expect(detail.openingHours).toContainEqual({ weekday: 1, closed: true, open: null, close: null })
  })

  it('get service detail throws NotFoundError for a missing slug', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)

    await expect(getServiceDetail('nao-existe')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('get service detail returns flow none and no equipment for an informational service', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue({
      ...serviceRow({ kind: 'informational', flow: 'none', equipmentType: null, pickupLocationId: null }),
      pickupLocation: null,
    } as never)
    vi.mocked(prisma.openingHour.findMany).mockResolvedValue(HOURS as never)
    vi.mocked(prisma.reservationSettings.findUnique).mockResolvedValue(SETTINGS as never)

    const detail = await getServiceDetail('cadeiras-de-rodas')

    expect(detail.flow).toBe('none')
    expect(detail.equipmentType).toBeNull()
  })
})

describe('isOpenNow is computed', () => {
  const hours = [
    { weekday: 0, closed: false, open: '10:00', close: '23:30' },
    { weekday: 1, closed: true, open: null, close: null },
    { weekday: 2, closed: false, open: '10:00', close: '22:00' },
  ]

  it('is true inside the opening window of the local weekday', () => {
    expect(isOpenNow(hours, new Date('2026-11-17T15:00:00Z'))).toBe(true) // Tue 12:00 local
  })

  it('is false before opening time', () => {
    expect(isOpenNow(hours, new Date('2026-11-17T12:00:00Z'))).toBe(false) // Tue 09:00 local
  })

  it('is false when today is closed', () => {
    expect(isOpenNow(hours, new Date('2026-11-16T15:00:00Z'))).toBe(false) // Mon 12:00 local
  })

  it('uses America/Araguaina (UTC-3), not the UTC date', () => {
    // 2026-11-16 02:00Z is still Sunday 23:00 local; Sunday is open until 23:30
    expect(isOpenNow(hours, new Date('2026-11-16T02:00:00Z'))).toBe(true)
  })
})
