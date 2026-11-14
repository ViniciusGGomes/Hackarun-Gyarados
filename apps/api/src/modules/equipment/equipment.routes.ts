import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function equipmentRoutes(app: FastifyInstance) {
  app.get('/admin/equipment', { preHandler: authorize('read', 'Equipment') }, async () => ({}))

  app.post('/admin/equipment', { preHandler: authorize('create', 'Equipment') }, async () => ({}))

  app.patch('/admin/equipment/:id', { preHandler: authorize('update', 'Equipment') }, async () => ({}))
}
