import type { DayPeriod, ObjectCategory } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import { generateProtocol } from '../../utils/protocol'
import { privacyRepository } from '../privacy/privacy.repository'

export type CreateLostReportData = {
  name: string
  phone: string
  email?: string
  category: ObjectCategory
  description: string
  identificationDetail?: string
  photoUrl?: string
  locationId?: string
  unknownLocation: boolean
  lostDate: string // YYYY-MM-DD
  lostPeriod: DayPeriod
  privacyNoticeVersion: string
}

export const lostReportsRepository = {
  async findActivePrivacyVersion() {
    const notice = await privacyRepository.findActive()

    return notice?.version ?? null
  },

  findActiveLocation(id: string) {
    return prisma.location.findFirst({ where: { id, active: true } })
  },

  /** One transaction: the request, the lost report, the consent and the first history row, or nothing. */
  createLostReportTx(data: CreateLostReportData) {
    return prisma.$transaction(async (tx) => {
      // A unique violation would abort the transaction, so look for a free protocol first.
      let protocol = generateProtocol()
      while (await tx.request.findUnique({ where: { protocol }, select: { id: true } })) {
        protocol = generateProtocol()
      }

      const request = await tx.request.create({
        data: {
          protocol,
          type: 'lost_report',
          status: 'registered',
          visitorName: data.name,
          visitorPhone: data.phone,
          visitorEmail: data.email,
          lostReport: {
            create: {
              category: data.category,
              description: data.description,
              identificationDetail: data.identificationDetail,
              photoUrl: data.photoUrl,
              locationId: data.locationId,
              unknownLocation: data.unknownLocation,
              lostDate: new Date(`${data.lostDate}T00:00:00Z`),
              lostPeriod: data.lostPeriod,
            },
          },
          consents: { create: { privacyNoticeVersion: data.privacyNoticeVersion, purpose: 'atender a solicitação' } },
          history: { create: { fromStatus: null, toStatus: 'registered', actorType: 'visitor' } },
        },
        select: { protocol: true, createdAt: true },
      })

      return { protocol: request.protocol, createdAt: request.createdAt }
    })
  },
}
