import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function foundItemsRoutes(app: FastifyInstance) {
  app.get('/admin/found-items', { preHandler: authorize('read', 'FoundItem') }, async () => ({}))

  app.post('/admin/found-items', { preHandler: authorize('create', 'FoundItem') }, async () => ({}))

  app.get('/admin/found-items/:id', { preHandler: authorize('read', 'FoundItem') }, async () => ({}))

  app.post(
    '/admin/found-items/:id/close',
    { preHandler: authorize('close', 'FoundItem') },
    async () => ({}),
  )
}
