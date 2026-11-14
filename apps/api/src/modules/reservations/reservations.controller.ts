import type { EquipmentType } from '@prisma/client'
import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CreateReservationInput } from './reservations.schemas'
import { createReservation, getAvailability } from './reservations.service'

export async function getAvailabilityController(
  request: FastifyRequest<{ Params: { type: EquipmentType }; Querystring: { date: string } }>,
  reply: FastifyReply,
) {
  const availability = await getAvailability(request.params.type, request.query.date)

  return reply.send(availability)
}

export async function createReservationController(
  request: FastifyRequest<{ Body: CreateReservationInput }>,
  reply: FastifyReply,
) {
  const reservation = await createReservation(request.body)

  return reply.status(201).send(reservation)
}
