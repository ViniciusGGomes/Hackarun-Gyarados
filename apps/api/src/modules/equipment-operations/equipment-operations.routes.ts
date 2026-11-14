import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { authorize } from '../../http/middlewares/authorize'
import { getAgendaController, pickupController, returnController } from './equipment-operations.controller'
import {
  AgendaQuerySchema,
  AgendaSchema,
  IdParamsSchema,
  PickupBodySchema,
  RequestDetailSchema,
  ReturnBodySchema,
} from './equipment-operations.schemas'

export async function equipmentOperationsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/admin/agenda',
    {
      preHandler: authorize('read', 'Reservation'),
      schema: {
        tags: ['Admin - Equipamentos'],
        summary: 'Agenda do dia',
        security: [{ bearerAuth: [] }],
        querystring: AgendaQuerySchema,
        response: { 200: AgendaSchema },
      },
    },
    getAgendaController,
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/admin/reservations/:id/pickup',
    {
      preHandler: authorize('pickup', 'Reservation'),
      schema: {
        tags: ['Admin - Equipamentos'],
        summary: 'Registrar retirada',
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        body: PickupBodySchema,
        response: { 200: RequestDetailSchema },
      },
    },
    pickupController,
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/admin/reservations/:id/return',
    {
      preHandler: authorize('return', 'Reservation'),
      schema: {
        tags: ['Admin - Equipamentos'],
        summary: 'Registrar devolução',
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        body: ReturnBodySchema,
        response: { 200: RequestDetailSchema },
      },
    },
    returnController,
  )
}
