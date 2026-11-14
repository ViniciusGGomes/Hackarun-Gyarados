import { fastifyJwt } from '@fastify/jwt'
import bcrypt from 'bcryptjs'
import { fastify } from 'fastify'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakePrisma, type FakeUser } from '../test/fake-prisma'
import { errorHandler } from './error-handler'
import { auth } from './middlewares/auth'
import { routes } from './routes'

const state = vi.hoisted(() => ({ prisma: null as unknown as Record<string, unknown> }))

vi.mock('../lib/prisma', () => ({
  prisma: new Proxy({}, { get: (_target, key: string) => state.prisma[key] }),
}))

const PASSWORD = 'Senha@123'
const PAULO_ID = '00000000-0000-4000-8000-000000000001'
const GESTOR_ID = '00000000-0000-4000-8000-000000000002'
const INATIVO_ID = '00000000-0000-4000-8000-000000000003'
const MANAGER_ONLY_URL = '/api/v1/admin/indicators/equipment'
const SENSITIVE = ['passwordHash', 'failedLoginAttempts', 'lockedUntil', 'lastLoginAt']

let passwordHash: string
let fake: ReturnType<typeof createFakePrisma>

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4)
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

async function buildApp() {
  const app = fastify()

  await app.register(fastifyJwt, { secret: 'test-secret' })
  app.setErrorHandler(errorHandler)
  await app.register(auth)
  await app.register(routes, { prefix: '/api/v1' })

  await app.ready()
  return app
}

type App = Awaited<ReturnType<typeof buildApp>>

function login(app: App, email: string, password = PASSWORD) {
  return app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } })
}

async function tokenFor(app: App, email: string) {
  const response = await login(app, email)

  return response.json().accessToken as string
}

function authed(app: App, method: 'GET' | 'POST', url: string, token: string) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` } })
}

beforeEach(() => {
  fake = createFakePrisma({
    users: [
      user({}),
      user({ id: GESTOR_ID, name: 'Marina Gestora', email: 'gestor@exemplo.com', role: 'manager' }),
      user({ id: INATIVO_ID, name: 'Ex-atendente', email: 'inativo@exemplo.com', active: false }),
    ],
  })
  state.prisma = fake.prisma as unknown as Record<string, unknown>
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('POST /api/v1/auth/login', () => {
  it('login as attendant returns token and user', async () => {
    const app = await buildApp()

    const response = await login(app, 'paulo@exemplo.com')

    expect(response.statusCode).toBe(200)
    expect(typeof response.json().accessToken).toBe('string')
    expect(response.json().user).toEqual({
      id: PAULO_ID,
      name: 'Paulo Atendente',
      email: 'paulo@exemplo.com',
      role: 'attendant',
      active: true,
    })
  })

  it('login as manager returns role manager', async () => {
    const app = await buildApp()

    const response = await login(app, 'gestor@exemplo.com')

    expect(response.statusCode).toBe(200)
    expect(response.json().user.role).toBe('manager')
  })

  it('login expiresIn is 1800 seconds', async () => {
    const app = await buildApp()

    const response = await login(app, 'paulo@exemplo.com')

    expect(response.json().expiresIn).toBe(1800)
  })

  it('login unknown email returns 401 INVALID_CREDENTIALS', async () => {
    const app = await buildApp()

    const response = await login(app, 'ninguem@exemplo.com')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' })
    expect(response.json()).not.toHaveProperty('accessToken')
  })

  it('login wrong password returns the same 401 body', async () => {
    const app = await buildApp()

    const unknown = await login(app, 'ninguem@exemplo.com')
    const wrong = await login(app, 'paulo@exemplo.com', 'errada')

    expect(wrong.statusCode).toBe(401)
    expect(wrong.json()).toEqual(unknown.json())
  })

  it('login inactive user returns 401 and leaves counters untouched', async () => {
    const app = await buildApp()

    const response = await login(app, 'inativo@exemplo.com')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(response.json()).not.toHaveProperty('accessToken')
    expect(fake.users.get(INATIVO_ID)).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null })
  })

  it('login invalid body returns 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()

    const missingPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'paulo@exemplo.com' },
    })
    const badEmail = await login(app, 'not-an-email')

    for (const response of [missingPassword, badEmail]) {
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
    }
  })

  it('login response has no sensitive fields', async () => {
    const app = await buildApp()

    const ok = await login(app, 'paulo@exemplo.com')
    const wrong = await login(app, 'paulo@exemplo.com', 'errada')
    const me = await authed(app, 'GET', '/api/v1/auth/me', ok.json().accessToken)

    for (const response of [ok, wrong, me]) {
      for (const field of SENSITIVE) {
        expect(response.body).not.toContain(field)
      }
      expect(response.body).not.toContain(passwordHash)
    }
  })

  it('login email is case-insensitive', async () => {
    const app = await buildApp()

    const response = await login(app, 'PAULO@EXEMPLO.COM')

    expect(response.statusCode).toBe(200)
    expect(response.json().user.id).toBe(PAULO_ID)
  })

  it('login locked account returns 423 even with the right password', async () => {
    const app = await buildApp()
    for (let i = 0; i < 5; i++) {
      expect((await login(app, 'paulo@exemplo.com', 'errada')).statusCode).toBe(401)
    }
    const sessionsBefore = fake.sessions.size

    const response = await login(app, 'paulo@exemplo.com')

    expect(response.statusCode).toBe(423)
    expect(response.json()).toMatchObject({ statusCode: 423, code: 'ACCOUNT_LOCKED' })
    expect(response.json()).not.toHaveProperty('accessToken')
    expect(fake.users.get(PAULO_ID)?.failedLoginAttempts).toBe(5)
    expect(fake.sessions.size).toBe(sessionsBefore)
  })

  it('login database failure returns 500 without details', async () => {
    const app = await buildApp()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(fake.prisma.user, 'findUnique').mockRejectedValue(new Error('connection refused at db:5432'))

    const response = await login(app, 'paulo@exemplo.com')

    expect(response.statusCode).toBe(500)
    expect(response.body).not.toContain('connection refused')
    expect(response.json()).not.toHaveProperty('accessToken')
  })

  it('two logins create two independent sessions', async () => {
    const app = await buildApp()

    const first = await tokenFor(app, 'paulo@exemplo.com')
    const second = await tokenFor(app, 'paulo@exemplo.com')
    await authed(app, 'POST', '/api/v1/auth/logout', first)

    expect(fake.sessions.size).toBe(2)
    expect((await authed(app, 'GET', '/api/v1/auth/me', first)).statusCode).toBe(401)
    expect((await authed(app, 'GET', '/api/v1/auth/me', second)).statusCode).toBe(200)
  })
})

describe('GET /api/v1/auth/me', () => {
  it('me returns the current user from the database', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')
    fake.users.get(PAULO_ID)!.name = 'Paulo Renomeado'

    const response = await authed(app, 'GET', '/api/v1/auth/me', token)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      id: PAULO_ID,
      name: 'Paulo Renomeado',
      email: 'paulo@exemplo.com',
      role: 'attendant',
      active: true,
    })
  })

  it('me with an invalid token returns 401 UNAUTHORIZED', async () => {
    const app = await buildApp()

    const missing = await app.inject({ method: 'GET', url: '/api/v1/auth/me' })
    const malformed = await authed(app, 'GET', '/api/v1/auth/me', 'invalid-token')
    const otherSecret = fastify()
    await otherSecret.register(fastifyJwt, { secret: 'another-secret' })
    await otherSecret.ready()
    const badSignature = await authed(
      app,
      'GET',
      '/api/v1/auth/me',
      otherSecret.jwt.sign({ sub: PAULO_ID, sid: `session-${PAULO_ID}` }),
    )

    for (const response of [missing, malformed, badSignature]) {
      expect(response.statusCode).toBe(401)
      expect(response.json()).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' })
    }
  })

  it('me with an expired token returns 401', async () => {
    const app = await buildApp()
    const session = await fake.prisma.session.create({ data: { userId: PAULO_ID } })
    const expired = app.jwt.sign({ sub: PAULO_ID, sid: session.id, exp: Math.floor(Date.now() / 1000) - 60 })

    const response = await authed(app, 'GET', '/api/v1/auth/me', expired)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('me with a non-Bearer header returns 401', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')

    for (const header of [`Basic ${token}`, `Token ${token}`, token]) {
      const response = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: header } })

      expect(response.statusCode).toBe(401)
    }
  })

  it('me after the user was deactivated returns 401', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')
    fake.users.get(PAULO_ID)!.active = false

    const response = await authed(app, 'GET', '/api/v1/auth/me', token)

    expect(response.statusCode).toBe(401)
  })

  it('role change applies without a new login', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')
    expect((await authed(app, 'GET', MANAGER_ONLY_URL, token)).statusCode).toBe(403)

    fake.users.get(PAULO_ID)!.role = 'manager'

    expect((await authed(app, 'GET', '/api/v1/auth/me', token)).json().role).toBe('manager')
    expect((await authed(app, 'GET', MANAGER_ONLY_URL, token)).statusCode).toBe(200)
  })

  it('role claim in the token is ignored', async () => {
    const app = await buildApp()
    const session = await fake.prisma.session.create({ data: { userId: PAULO_ID } })
    const forged = app.jwt.sign({ sub: PAULO_ID, sid: session.id, role: 'manager' })

    const me = await authed(app, 'GET', '/api/v1/auth/me', forged)
    const admin = await authed(app, 'GET', MANAGER_ONLY_URL, forged)

    expect(me.json().role).toBe('attendant')
    expect(admin.statusCode).toBe(403)
  })

  it('lock does not revoke issued tokens', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')
    for (let i = 0; i < 5; i++) await login(app, 'paulo@exemplo.com', 'errada')
    expect((await login(app, 'paulo@exemplo.com')).statusCode).toBe(423)

    const response = await authed(app, 'GET', '/api/v1/auth/me', token)

    expect(response.statusCode).toBe(200)
  })
})

describe('POST /api/v1/auth/logout and session lifetime', () => {
  it('logout returns 204', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')

    const response = await authed(app, 'POST', '/api/v1/auth/logout', token)

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
  })

  it('token is rejected after logout', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')
    await authed(app, 'POST', '/api/v1/auth/logout', token)

    const response = await authed(app, 'GET', '/api/v1/auth/me', token)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('logout without a token returns 401', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('session idle for more than 30 minutes is rejected', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.now() + 31 * 60 * 1000))

    const response = await authed(app, 'GET', '/api/v1/auth/me', token)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('activity within 30 minutes keeps the session alive', async () => {
    const app = await buildApp()
    const token = await tokenFor(app, 'paulo@exemplo.com')
    const start = Date.now()
    vi.useFakeTimers({ toFake: ['Date'] })

    vi.setSystemTime(new Date(start + 20 * 60 * 1000))
    expect((await authed(app, 'GET', '/api/v1/auth/me', token)).statusCode).toBe(200)

    vi.setSystemTime(new Date(start + 45 * 60 * 1000)) // 45 min after login, 25 after the last request
    expect((await authed(app, 'GET', '/api/v1/auth/me', token)).statusCode).toBe(200)
  })
})

describe('admin routes with real login tokens', () => {
  it('admin route without token returns 401', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: MANAGER_ONLY_URL })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('token from login opens an admin route of its role', async () => {
    const app = await buildApp()
    const managerToken = await tokenFor(app, 'gestor@exemplo.com')
    const attendantToken = await tokenFor(app, 'paulo@exemplo.com')

    expect((await authed(app, 'GET', MANAGER_ONLY_URL, managerToken)).statusCode).toBe(200)
    expect((await authed(app, 'GET', MANAGER_ONLY_URL, attendantToken)).statusCode).toBe(403)
    expect((await authed(app, 'GET', '/api/v1/admin/requests', attendantToken)).statusCode).toBe(200)
  })
})
