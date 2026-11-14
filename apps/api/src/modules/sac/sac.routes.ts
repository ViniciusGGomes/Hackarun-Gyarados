import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { rateLimit } from '../../http/middlewares/rate-limit'
import { createSacMessageController } from './sac.controller'
import { CreateSacMessageSchema, SacProtocolCreatedSchema } from './sac.schemas'

export async function sacRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/sac-messages',
    {
      onRequest: rateLimit({ max: 10, windowMs: 60_000 }),
      schema: {
        tags: ['Público - SAC'],
        summary: 'Enviar mensagem ao SAC',
        body: CreateSacMessageSchema,
        response: { 201: SacProtocolCreatedSchema },
      },
    },
    createSacMessageController,
  )
}
