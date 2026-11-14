import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { getPrivacyNoticeController } from './privacy.controller'
import { PrivacyNoticeSchema } from './privacy.schemas'

export async function privacyRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/privacy-notice',
    {
      schema: {
        tags: ['Público - Serviços'],
        summary: 'Aviso de privacidade vigente',
        response: { 200: PrivacyNoticeSchema },
      },
    },
    getPrivacyNoticeController,
  )
}
