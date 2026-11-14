import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { authorize } from '../../http/middlewares/authorize'
import { listLocationsController } from './locations.controller'
import { LocationSchema } from './locations.schemas'

export async function locationsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/locations',
    {
      schema: {
        tags: ['Público - Serviços'],
        summary: 'Listar locais ativos',
        response: { 200: z.object({ data: z.array(LocationSchema) }) },
      },
    },
    listLocationsController,
  )

  app.get('/admin/locations', { preHandler: authorize('read', 'Location') }, async () => ({}))

  app.post('/admin/locations', { preHandler: authorize('create', 'Location') }, async () => ({}))

  app.patch('/admin/locations/:id', { preHandler: authorize('update', 'Location') }, async () => ({}))
}
