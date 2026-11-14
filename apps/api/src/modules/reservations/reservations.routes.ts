import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function reservationsRoutes(app: FastifyInstance) {
  app.get('/admin/agenda', { preHandler: authorize('read', 'Reservation') }, async () => ({}))

  app.post(
    '/admin/reservations/:id/pickup',
    { preHandler: authorize('pickup', 'Reservation') },
    async () => ({}),
  )

  app.post(
    '/admin/reservations/:id/return',
    { preHandler: authorize('return', 'Reservation') },
    async () => ({}),
  )
}
