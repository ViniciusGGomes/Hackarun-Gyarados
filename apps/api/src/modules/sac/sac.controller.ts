import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CreateSacMessageInput } from './sac.schemas'
import { createSacMessage } from './sac.service'

export async function createSacMessageController(request: FastifyRequest, reply: FastifyReply) {
  const result = await createSacMessage(request.body as CreateSacMessageInput)

  return reply.status(201).send(result)
}
