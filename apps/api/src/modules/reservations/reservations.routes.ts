import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { rateLimit } from '../../http/middlewares/rate-limit'
import { createReservationController, getAvailabilityController } from './reservations.controller'
import {
  AvailabilityParamsSchema,
  AvailabilityQuerySchema,
  AvailabilitySchema,
  CreateReservationSchema,
  ReservationCreatedSchema,
} from './reservations.schemas'

export async function reservationsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/equipment/:type/availability',
    {
      schema: {
        tags: ['Público - Reservas'],
        summary: 'Horários disponíveis de um equipamento',
        params: AvailabilityParamsSchema,
        querystring: AvailabilityQuerySchema,
        response: { 200: AvailabilitySchema },
      },
    },
    getAvailabilityController,
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/reservations',
    {
      onRequest: rateLimit({ max: 10, windowMs: 60_000 }),
      schema: {
        tags: ['Público - Reservas'],
        summary: 'Reservar equipamento',
        body: CreateReservationSchema,
        response: { 201: ReservationCreatedSchema },
      },
    },
    createReservationController,
  )
}
