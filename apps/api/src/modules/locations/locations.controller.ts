import type { FastifyReply, FastifyRequest } from 'fastify'

import { listActive } from './locations.service'

export async function listLocationsController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await listActive()

  return reply.send({ data })
}
