import { prisma } from '../../lib/prisma'

export const privacyRepository = {
  findActive() {
    return prisma.privacyNotice.findFirst({ where: { active: true } })
  },
}
