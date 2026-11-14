import { prisma } from '../../lib/prisma'
import { MAX_FAILED_ATTEMPTS } from './auth.constants'

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  // Compare-and-set: only the request that still finds a finished lock (or a count already at the
  // limit) restarts the count at 1; concurrent attempts then see a fresh count and increment it.
  async restartFailedAttempts(userId: string, now: Date) {
    const { count } = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lockedUntil: { lte: now } },
          { lockedUntil: null, failedLoginAttempts: { gte: MAX_FAILED_ATTEMPTS } },
        ],
      },
      data: { failedLoginAttempts: 1, lockedUntil: null },
    })

    return count === 1
  },

  async incrementFailedAttempts(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    })

    return user.failedLoginAttempts
  },

  setLockedUntil(userId: string, lockedUntil: Date) {
    return prisma.user.update({ where: { id: userId }, data: { lockedUntil } })
  },

  markLoginSuccess(userId: string, now: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    })
  },

  createSession(userId: string, now: Date) {
    return prisma.session.create({ data: { userId, lastActivityAt: now } })
  },

  findSessionById(id: string) {
    return prisma.session.findUnique({ where: { id } })
  },

  touchSession(id: string, now: Date) {
    return prisma.session.update({ where: { id }, data: { lastActivityAt: now } })
  },

  revokeSession(id: string, now: Date) {
    return prisma.session.update({ where: { id }, data: { revokedAt: now } })
  },
}
