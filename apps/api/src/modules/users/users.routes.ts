import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function usersRoutes(app: FastifyInstance) {
  app.get('/admin/users', { preHandler: authorize('read', 'User') }, async () => ({}))

  app.post('/admin/users', { preHandler: authorize('create', 'User') }, async () => ({}))

  app.patch('/admin/users/:id', { preHandler: authorize('update', 'User') }, async () => ({}))
}
