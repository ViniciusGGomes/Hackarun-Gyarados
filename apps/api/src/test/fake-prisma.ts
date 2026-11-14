import { randomUUID } from 'node:crypto'

export type FakeUser = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: 'attendant' | 'manager'
  active: boolean
  failedLoginAttempts: number
  lockedUntil: Date | null
  lastLoginAt: Date | null
}

export type FakeSession = {
  id: string
  userId: string
  lastActivityAt: Date
  revokedAt: Date | null
  createdAt: Date
}

type Data = Record<string, unknown>

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

/**
 * In-memory stand-in for the Prisma calls used by the auth module. Every call yields once before
 * touching state, so a read-then-write implementation would lose updates under Promise.all,
 * while `{ increment: 1 }` stays correct (the mutation itself is a single synchronous step).
 */
export function createFakePrisma(seed: { users: FakeUser[] }) {
  const users = new Map<string, FakeUser>(seed.users.map((u) => [u.id, { ...u }]))
  const sessions = new Map<string, FakeSession>()

  function applyData(row: Data, data: Data) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !(value instanceof Date) && 'increment' in value) {
        row[key] = (row[key] as number) + (value as { increment: number }).increment
      } else {
        row[key] = value
      }
    }
  }

  function pick(row: Data, select?: Record<string, boolean>) {
    if (!select) return { ...row }
    return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]))
  }

  type Condition = Record<string, unknown>

  function matches(row: Data, where: Condition): boolean {
    return Object.entries(where).every(([key, expected]) => {
      if (key === 'OR') return (expected as Condition[]).some((branch) => matches(row, branch))
      const value = row[key]
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        const ops = expected as { lte?: Date; gte?: number }
        if (ops.lte !== undefined) return value instanceof Date && value <= ops.lte
        if (ops.gte !== undefined) return typeof value === 'number' && value >= ops.gte
      }
      return value === expected
    })
  }

  const prisma = {
    privacyNotice: {
      async findFirst() {
        await tick()
        return null
      },
    },
    user: {
      async findUnique({ where }: { where: { id?: string; email?: string } }) {
        await tick()
        const found = where.id
          ? users.get(where.id)
          : [...users.values()].find((u) => u.email === where.email)
        return found ? { ...found } : null
      },
      async update({ where, data, select }: { where: { id: string }; data: Data; select?: Record<string, boolean> }) {
        await tick()
        const row = users.get(where.id)
        if (!row) throw new Error('Record to update not found')
        applyData(row as unknown as Data, data)
        return pick(row as unknown as Data, select)
      },
      async updateMany({ where, data }: { where: Condition; data: Data }) {
        await tick()
        let count = 0
        for (const row of users.values()) {
          if (matches(row as unknown as Data, where)) {
            applyData(row as unknown as Data, data)
            count++
          }
        }
        return { count }
      },
    },
    session: {
      async create({ data }: { data: { userId: string; lastActivityAt?: Date } }) {
        await tick()
        const now = new Date()
        const row: FakeSession = {
          id: randomUUID(),
          userId: data.userId,
          lastActivityAt: data.lastActivityAt ?? now,
          revokedAt: null,
          createdAt: now,
        }
        sessions.set(row.id, row)
        return { ...row }
      },
      async findUnique({ where }: { where: { id: string } }) {
        await tick()
        const found = sessions.get(where.id)
        return found ? { ...found } : null
      },
      async update({ where, data }: { where: { id: string }; data: Data }) {
        await tick()
        const row = sessions.get(where.id)
        if (!row) throw new Error('Record to update not found')
        applyData(row as unknown as Data, data)
        return { ...row }
      },
    },
  }

  return { prisma, users, sessions }
}
