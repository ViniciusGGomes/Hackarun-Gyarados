import type { EquipmentType } from '@prisma/client'
import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CreateReservationInput } from './reservations.schemas'
import { createReservation, getAvailability } from './reservations.service'

// The route schemas (Zod) have already validated params, query and body when these run.

export async function getAvailabilityController(request: FastifyRequest, reply: FastifyReply) {
  const { type } = request.params as { type: EquipmentType }
  const { date } = request.query as { date: string }

  return reply.send(await getAvailability(type, date))
}

export async function createReservationController(request: FastifyRequest, reply: FastifyReply) {
  const reservation = await createReservation(request.body as CreateReservationInput)

  return reply.status(201).send(reservation)
}
