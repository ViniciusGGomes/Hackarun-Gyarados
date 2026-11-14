import { prisma } from '../../lib/prisma'

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  // Starts a new count after a lock (or a stale count) ended: this attempt is the first failure.
  restartFailedAttempts(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 1, lockedUntil: null },
    })
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
