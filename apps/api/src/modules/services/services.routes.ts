import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { getServiceController, listServicesController } from './services.controller'
import { ServiceDetailSchema, ServiceSchema } from './services.schemas'

export async function servicesRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/services',
    {
      schema: {
        tags: ['Público - Serviços'],
        summary: 'Listar serviços ativos',
        response: { 200: z.object({ data: z.array(ServiceSchema) }) },
      },
    },
    listServicesController,
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/services/:slug',
    {
      schema: {
        tags: ['Público - Serviços'],
        summary: 'Detalhes de um serviço',
        params: z.object({ slug: z.string() }),
        response: { 200: ServiceDetailSchema },
      },
    },
    getServiceController,
  )
}
