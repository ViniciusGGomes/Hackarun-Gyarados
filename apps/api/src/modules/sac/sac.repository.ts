import type { SacSubject } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import { generateProtocol } from '../../utils/protocol'
import { privacyRepository } from '../privacy/privacy.repository'

export type CreateSacMessageData = {
  name: string
  phone?: string
  email?: string
  subject: SacSubject
  message: string
  relatedServiceSlug?: string | null
  relatedProtocol?: string | null
  privacyNoticeVersion: string
}

export const sacRepository = {
  async findActivePrivacyVersion() {
    const notice = await privacyRepository.findActive()

    return notice?.version ?? null
  },

  /** One transaction: the request, the SAC message, the consent and the first history row, or nothing. */
  createSacMessageTx(data: CreateSacMessageData) {
    return prisma.$transaction(async (tx) => {
      let protocol = generateProtocol()
      while (await tx.request.findUnique({ where: { protocol }, select: { id: true } })) {
        protocol = generateProtocol()
      }

      const service = data.relatedServiceSlug
        ? await tx.service.findUnique({ where: { slug: data.relatedServiceSlug }, select: { id: true } })
        : null

      const request = await tx.request.create({
        data: {
          protocol,
          type: 'sac_message',
          status: 'open',
          visitorName: data.name,
          visitorPhone: data.phone,
          visitorEmail: data.email,
          sacMessage: {
            create: {
              subject: data.subject,
              message: data.message,
              relatedServiceId: service?.id,
              relatedProtocol: data.relatedProtocol ?? undefined,
            },
          },
          consents: { create: { privacyNoticeVersion: data.privacyNoticeVersion, purpose: 'atender a solicitação' } },
          history: { create: { fromStatus: null, toStatus: 'open', actorType: 'visitor' } },
        },
        select: { protocol: true, createdAt: true },
      })

      return { protocol: request.protocol, createdAt: request.createdAt }
    })
  },
}
