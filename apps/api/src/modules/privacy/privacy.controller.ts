import type { FastifyReply, FastifyRequest } from 'fastify'

import { getActive } from './privacy.service'

export async function getPrivacyNoticeController(_request: FastifyRequest, reply: FastifyReply) {
  const notice = await getActive()

  return reply.send(notice)
}
