import type { FastifyReply, FastifyRequest } from 'fastify'

import { cancelReservation } from '../reservations/reservations.service'

export async function cancelController(
  request: FastifyRequest<{ Params: { protocol: string }; Body: { phone: string; reason?: string } }>,
  reply: FastifyReply,
) {
  const view = await cancelReservation(request.params.protocol, request.body.phone, request.body.reason)

  return reply.send(view)
}
