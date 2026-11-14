import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function indicatorsRoutes(app: FastifyInstance) {
  app.get(
    '/admin/indicators/equipment',
    { preHandler: authorize('read', 'Indicator') },
    async () => ({}),
  )

  app.get(
    '/admin/indicators/lost-and-found',
    { preHandler: authorize('read', 'Indicator') },
    async () => ({}),
  )

  app.get(
    '/admin/indicators/service',
    { preHandler: authorize('read', 'Indicator') },
    async () => ({}),
  )
}
