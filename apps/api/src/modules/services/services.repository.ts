import { prisma } from '../../lib/prisma'

export const servicesRepository = {
  findManyActive() {
    return prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
  },

  findUniqueBySlug(slug: string) {
    return prisma.service.findUnique({
      where: { slug },
      include: { pickupLocation: true },
    })
  },

  findOpeningHours() {
    return prisma.openingHour.findMany({ orderBy: { weekday: 'asc' } })
  },

  findReservationSettings() {
    return prisma.reservationSettings.findUnique({ where: { id: 1 } })
  },
}
