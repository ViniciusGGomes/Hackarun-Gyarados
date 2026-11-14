import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { PrismaClient } from '@prisma/client'

const TEST_DATABASE = 'hackathon_test'

function developmentUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const env = readFileSync(resolve(process.cwd(), '../../.env'), 'utf8')
  const match = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)

  if (!match) throw new Error('DATABASE_URL not found in the environment or in the root .env')

  return match[1]
}

function urlFor(database: string) {
  const url = new URL(developmentUrl())
  url.pathname = `/${database}`

  return url.toString()
}

export const testDatabaseUrl = urlFor(TEST_DATABASE)

/** Prisma client of the test database (never the development one). */
export const testPrisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } })

let ready: Promise<void> | undefined

async function createDatabaseIfMissing() {
  const admin = new PrismaClient({ datasources: { db: { url: urlFor('postgres') } } })

  try {
    const found = await admin.$queryRawUnsafe<{ datname: string }[]>(
      `SELECT datname FROM pg_database WHERE datname = '${TEST_DATABASE}'`,
    )

    if (found.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE ${TEST_DATABASE}`)
  } finally {
    await admin.$disconnect()
  }
}

/** Creates the test database when missing and applies the migrations. Runs once per process. */
export function setupTestDb() {
  ready ??= (async () => {
    try {
      await createDatabaseIfMissing()
    } catch (error) {
      throw new Error(`PostgreSQL is not reachable for the test database. Start the hackathon-postgres container. ${String(error)}`)
    }

    execSync('pnpm exec prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    })
  })()

  return ready
}

/** Empties the operational tables and seeds the minimum the reservation flows need. */
export async function resetTestDb() {
  await testPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE requests, users, sessions, unmet_demands, equipment, opening_hours, reservation_settings, privacy_notices, locations RESTART IDENTITY CASCADE',
  )

  const sac = await testPrisma.location.create({ data: { name: 'SAC / Espaço do Cliente', floor: 'Térreo', type: 'service' } })
  const family = await testPrisma.location.create({ data: { name: 'Espaço Família', floor: 'Térreo', type: 'service' } })

  await testPrisma.reservationSettings.create({ data: { id: 1 } })
  await testPrisma.openingHour.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
      weekday === 0
        ? { weekday, closed: false, openTime: '14:00', closeTime: '20:00' }
        : { weekday, closed: false, openTime: '10:00', closeTime: '22:00' },
    ),
  })
  await testPrisma.privacyNotice.create({ data: { version: '1.0', text: 'Aviso de teste', active: true } })
  await testPrisma.equipment.createMany({
    data: [
      { type: 'wheelchair', label: 'Cadeira adulto', quantity: 4, pickupLocationId: sac.id },
      { type: 'wheelchair', label: 'Cadeira infantil', quantity: 2, pickupLocationId: sac.id },
      { type: 'wheelchair', label: 'Cadeira em manutenção', quantity: 1, pickupLocationId: sac.id, active: false },
      { type: 'stroller', label: 'Carrinho simples', quantity: 5, pickupLocationId: family.id },
      { type: 'stroller', label: 'Carrinho duplo', quantity: 2, pickupLocationId: family.id },
    ],
  })

  return { sacLocationId: sac.id, familyLocationId: family.id }
}

let staffSeq = 0

/** Creates an active staff user with a valid session, the way the login would leave them. */
export async function seedStaff(role: 'attendant' | 'manager', name = 'Equipe Teste') {
  const user = await testPrisma.user.create({
    data: { name, email: `staff${++staffSeq}-${Date.now()}@teste.com`, passwordHash: 'not-a-real-hash', role },
  })
  const session = await testPrisma.session.create({ data: { userId: user.id } })

  return { userId: user.id, sessionId: session.id }
}
