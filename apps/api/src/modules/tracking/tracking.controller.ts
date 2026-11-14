import type { FastifyReply, FastifyRequest } from 'fastify'

import { cancelReservation } from '../reservations/reservations.service'

// The route schemas (Zod) have already validated params and body when this runs.

export async function cancelController(request: FastifyRequest, reply: FastifyReply) {
  const { protocol } = request.params as { protocol: string }
  const { phone, reason } = request.body as { phone: string; reason?: string }

  return reply.send(await cancelReservation(protocol, phone, reason))
}
