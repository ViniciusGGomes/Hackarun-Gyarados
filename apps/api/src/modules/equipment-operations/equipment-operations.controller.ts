import type { EquipmentType } from '@prisma/client'
import type { FastifyReply, FastifyRequest } from 'fastify'

import type { PickupInput, ReturnInput } from './equipment-operations.schemas'
import { getAgenda, registerPickup, registerReturn } from './equipment-operations.service'

// The route schemas (Zod) have already validated query, params and body when these run.

export async function getAgendaController(request: FastifyRequest, reply: FastifyReply) {
  const { date, equipmentType } = request.query as { date: string; equipmentType: EquipmentType }

  return reply.send(await getAgenda(date, equipmentType))
}

export async function pickupController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const userId = await request.getCurrentUserId()

  return reply.send(await registerPickup(id, userId, request.body as PickupInput))
}

export async function returnController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const userId = await request.getCurrentUserId()

  return reply.send(await registerReturn(id, userId, request.body as ReturnInput))
}
