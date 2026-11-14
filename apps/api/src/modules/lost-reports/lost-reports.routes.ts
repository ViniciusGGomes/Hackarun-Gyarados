import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { authorize } from '../../http/middlewares/authorize'
import { rateLimit } from '../../http/middlewares/rate-limit'
import { createLostReportController } from './lost-reports.controller'
import { CreateLostReportSchema, ProtocolCreatedSchema } from './lost-reports.schemas'

export async function lostReportsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/lost-reports',
    {
      onRequest: rateLimit({ max: 10, windowMs: 60_000 }),
      schema: {
        tags: ['Público - Achados e perdidos'],
        summary: 'Registrar objeto perdido',
        body: CreateLostReportSchema,
        response: { 201: ProtocolCreatedSchema },
      },
    },
    createLostReportController,
  )

  app.get(
    '/admin/lost-reports/:id/suggestions',
    { preHandler: authorize('read', 'LostReport') },
    async () => ({}),
  )

  app.post(
    '/admin/lost-reports/:id/match',
    { preHandler: authorize('match', 'LostReport') },
    async () => ({}),
  )

  app.post(
    '/admin/lost-reports/:id/deliver',
    { preHandler: authorize('deliver', 'LostReport') },
    async () => ({}),
  )
}
