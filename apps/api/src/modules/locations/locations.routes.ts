import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function locationsRoutes(app: FastifyInstance) {
  app.get('/admin/locations', { preHandler: authorize('read', 'Location') }, async () => ({}))

  app.post('/admin/locations', { preHandler: authorize('create', 'Location') }, async () => ({}))

  app.patch('/admin/locations/:id', { preHandler: authorize('update', 'Location') }, async () => ({}))
}
