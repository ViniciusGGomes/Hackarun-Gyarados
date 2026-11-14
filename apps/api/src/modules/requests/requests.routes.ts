import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function requestsRoutes(app: FastifyInstance) {
  app.get('/admin/requests', { preHandler: authorize('read', 'Request') }, async () => ({}))

  app.get('/admin/requests/:id', { preHandler: authorize('read', 'Request') }, async () => ({}))

  app.patch(
    '/admin/requests/:id/status',
    { preHandler: authorize('updateStatus', 'Request') },
    async () => ({}),
  )

  app.post(
    '/admin/requests/:id/messages',
    { preHandler: authorize('sendMessage', 'Request') },
    async () => ({}),
  )
}
