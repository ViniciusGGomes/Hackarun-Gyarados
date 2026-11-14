import type { FastifyInstance } from 'fastify'

import { foundItemsRoutes } from '../modules/found-items/found-items.routes'
import { lostReportsRoutes } from '../modules/lost-reports/lost-reports.routes'
import { requestsRoutes } from '../modules/requests/requests.routes'
import { reservationsRoutes } from '../modules/reservations/reservations.routes'

export async function routes(app: FastifyInstance) {
  await app.register(requestsRoutes)
  await app.register(reservationsRoutes)
  await app.register(foundItemsRoutes)
  await app.register(lostReportsRoutes)
}
