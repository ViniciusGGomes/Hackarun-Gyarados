import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function settingsRoutes(app: FastifyInstance) {
  app.get(
    '/admin/settings/reservations',
    { preHandler: authorize('read', 'ReservationSettings') },
    async () => ({}),
  )

  app.put(
    '/admin/settings/reservations',
    { preHandler: authorize('update', 'ReservationSettings') },
    async () => ({}),
  )
}
