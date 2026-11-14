import bcrypt from 'bcryptjs'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountLockedError } from '../../http/routes/_errors/account-locked-error'
import { InvalidCredentialsError } from '../../http/routes/_errors/invalid-credentials-error'
import { createFakePrisma, type FakeUser } from '../../test/fake-prisma'
import { DUMMY_PASSWORD_HASH } from './auth.constants'
import { login } from './auth.service'

const state = vi.hoisted(() => ({ prisma: null as unknown as Record<string, unknown> }))

vi.mock('../../lib/prisma', () => ({
  prisma: new Proxy({}, { get: (_target, key: string) => state.prisma[key] }),
}))

const PASSWORD = 'Senha@123'
const NOW = new Date('2026-11-16T15:00:00Z')
const minutes = (n: number) => n * 60 * 1000

const PAULO_ID = '00000000-0000-4000-8000-000000000001'
const INATIVO_ID = '00000000-0000-4000-8000-000000000002'

let passwordHash: string

beforeAll(async () => {
  // Same algorithm and cost as prisma/seed.ts
  passwordHash = await bcrypt.hash(PASSWORD, 10)
})

function user(overrides: Partial<FakeUser>): FakeUser {
  return {
    id: PAULO_ID,
    name: 'Paulo Atendente',
    email: 'paulo@exemplo.com',
    passwordHash,
    role: 'attendant',
    active: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...overrides,
  }
}

function setup(users: FakeUser[]) {
  const fake = createFakePrisma({ users })
  state.prisma = fake.prisma as unknown as Record<string, unknown>
  return fake
}

beforeEach(() => {
  setup([user({}), user({ id: INATIVO_ID, email: 'inativo@exemplo.com', active: false })])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('login()', () => {
  it('returns the public user and the id of a new session', async () => {
    const fake = setup([user({})])

    const result = await login('paulo@exemplo.com', PASSWORD, NOW)

    expect(result.user).toEqual({
      id: PAULO_ID,
      name: 'Paulo Atendente',
      email: 'paulo@exemplo.com',
      role: 'attendant',
      active: true,
    })
    expect(fake.sessions.get(result.sessionId)).toMatchObject({ userId: PAULO_ID, revokedAt: null, lastActivityAt: NOW })
  })

  it('accepts a bcrypt hash produced like the seed', async () => {
    const seedHash = await bcrypt.hash('OutraSenha#1', 10)
    setup([user({ passwordHash: seedHash })])

    const result = await login('paulo@exemplo.com', 'OutraSenha#1', NOW)

    expect(result.user.id).toBe(PAULO_ID)
  })

  it('looks the user up with the e-mail trimmed and lowercased', async () => {
    const result = await login('  Paulo@Exemplo.COM ', PASSWORD, NOW)

    expect(result.user.email).toBe('paulo@exemplo.com')
  })

  it('unknown email compares against the dummy hash', async () => {
    const compare = vi.spyOn(bcrypt, 'compare')

    await expect(login('ninguem@exemplo.com', PASSWORD, NOW)).rejects.toBeInstanceOf(InvalidCredentialsError)

    expect(compare).toHaveBeenCalledTimes(1)
    expect(compare).toHaveBeenCalledWith(PASSWORD, DUMMY_PASSWORD_HASH)
  })

  it('wrong password is rejected with InvalidCredentialsError', async () => {
    await expect(login('paulo@exemplo.com', 'errada', NOW)).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('inactive user is rejected without touching counters', async () => {
    const fake = setup([user({ id: INATIVO_ID, email: 'inativo@exemplo.com', active: false })])

    await expect(login('inativo@exemplo.com', PASSWORD, NOW)).rejects.toBeInstanceOf(InvalidCredentialsError)
    await expect(login('inativo@exemplo.com', 'errada', NOW)).rejects.toBeInstanceOf(InvalidCredentialsError)

    expect(fake.users.get(INATIVO_ID)).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null })
    expect(fake.sessions.size).toBe(0)
  })
})

describe('login() lockout', () => {
  it('wrong password increments failed attempts by one', async () => {
    const fake = setup([user({ failedLoginAttempts: 2 })])

    await expect(login('paulo@exemplo.com', 'errada', NOW)).rejects.toBeInstanceOf(InvalidCredentialsError)

    expect(fake.users.get(PAULO_ID)).toMatchObject({ failedLoginAttempts: 3, lockedUntil: null })
  })

  it('fifth wrong password locks the account for 15 minutes', async () => {
    const fake = setup([user({ failedLoginAttempts: 4 })])

    await expect(login('paulo@exemplo.com', 'errada', NOW)).rejects.toBeInstanceOf(InvalidCredentialsError)

    expect(fake.users.get(PAULO_ID)).toMatchObject({
      failedLoginAttempts: 5,
      lockedUntil: new Date(NOW.getTime() + minutes(15)),
    })
  })

  it('locked account is refused even with the right password and nothing changes', async () => {
    const lockedUntil = new Date(NOW.getTime() + minutes(5))
    const fake = setup([user({ failedLoginAttempts: 5, lockedUntil })])
    const compare = vi.spyOn(bcrypt, 'compare')

    await expect(login('paulo@exemplo.com', PASSWORD, NOW)).rejects.toBeInstanceOf(AccountLockedError)

    expect(compare).not.toHaveBeenCalled()
    expect(fake.users.get(PAULO_ID)).toMatchObject({ failedLoginAttempts: 5, lockedUntil, lastLoginAt: null })
    expect(fake.sessions.size).toBe(0)
  })

  it('login after lock expiry restarts the count', async () => {
    const lockedUntil = new Date(NOW.getTime() - minutes(1))
    const fake = setup([user({ failedLoginAttempts: 5, lockedUntil })])

    await expect(login('paulo@exemplo.com', 'errada', NOW)).rejects.toBeInstanceOf(InvalidCredentialsError)

    expect(fake.users.get(PAULO_ID)).toMatchObject({ failedLoginAttempts: 1, lockedUntil: null })
  })

  it('a stale count at the limit without a lock restarts the count', async () => {
    const fake = setup([user({ failedLoginAttempts: 5, lockedUntil: null })])

    await expect(login('paulo@exemplo.com', 'errada', NOW)).rejects.toBeInstanceOf(InvalidCredentialsError)

    expect(fake.users.get(PAULO_ID)).toMatchObject({ failedLoginAttempts: 1, lockedUntil: null })
  })

  it('right password after lock expiry signs in', async () => {
    const lockedUntil = new Date(NOW.getTime() - minutes(1))
    setup([user({ failedLoginAttempts: 5, lockedUntil })])

    const result = await login('paulo@exemplo.com', PASSWORD, NOW)

    expect(result.user.id).toBe(PAULO_ID)
  })

  it('successful login resets attempts and sets lastLoginAt', async () => {
    const fake = setup([user({ failedLoginAttempts: 3 })])

    await login('paulo@exemplo.com', PASSWORD, NOW)

    expect(fake.users.get(PAULO_ID)).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: NOW })
  })

  it('simultaneous wrong passwords are all counted', async () => {
    const fake = setup([user({})])

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => login('paulo@exemplo.com', 'errada', NOW)),
    )

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(fake.users.get(PAULO_ID)?.failedLoginAttempts).toBe(4)
  })
})
