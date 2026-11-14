import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { rateLimit } from '../../http/middlewares/rate-limit'
import { cancelController } from './tracking.controller'
import { CancelBodySchema, CancelParamsSchema, TrackingViewSchema } from './tracking.schemas'

export async function trackingRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/tracking/:protocol/cancel',
    {
      onRequest: rateLimit({ max: 10, windowMs: 60_000 }),
      schema: {
        tags: ['Público - Acompanhamento'],
        summary: 'Cancelar solicitação',
        params: CancelParamsSchema,
        body: CancelBodySchema,
        response: { 200: TrackingViewSchema },
      },
    },
    cancelController,
  )
}
