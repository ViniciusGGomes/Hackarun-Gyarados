import type { FastifyInstance } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'

export async function lostReportsRoutes(app: FastifyInstance) {
  app.get(
    '/admin/lost-reports/:id/suggestions',
    { preHandler: authorize('read', 'LostReport') },
    async () => ({}),
  )

  app.post(
    '/admin/lost-reports/:id/match',
    { preHandler: authorize('match', 'LostReport') },
    async () => ({}),
  )

  app.post(
    '/admin/lost-reports/:id/deliver',
    { preHandler: authorize('deliver', 'LostReport') },
    async () => ({}),
  )
}
