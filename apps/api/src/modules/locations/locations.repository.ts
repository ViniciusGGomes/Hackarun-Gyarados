import { prisma } from '../../lib/prisma'

export const locationsRepository = {
  findManyActive() {
    return prisma.location.findMany({ where: { active: true } })
  },
}
