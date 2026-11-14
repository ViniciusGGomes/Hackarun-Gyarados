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
  // The pickup and return bodies are optional, and a client that always sends `Content-Type: application/json`
  // sends an empty body: Fastify rejects that by default, so inside this plugin an empty JSON body is "no body".
  // The parsed object is only ever read through the Zod schemas, which keep just the declared keys.
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    if (body === '') return done(null, undefined)

    try {
      done(null, JSON.parse(body as string))
    } catch {
      done(Object.assign(new Error('Malformed JSON body'), { statusCode: 400 }), undefined)
    }
  })

  app.withTypeProvider<ZodTypeProvider>().get(
    '/admin/agenda',
    {
      onRequest: authorize('read', 'Reservation'),
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
      onRequest: authorize('pickup', 'Reservation'),
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
      onRequest: authorize('return', 'Reservation'),
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
