import type { FastifyInstance } from 'fastify'

import { equipmentRoutes } from '../modules/equipment/equipment.routes'
import { foundItemsRoutes } from '../modules/found-items/found-items.routes'
import { indicatorsRoutes } from '../modules/indicators/indicators.routes'
import { locationsRoutes } from '../modules/locations/locations.routes'
import { lostReportsRoutes } from '../modules/lost-reports/lost-reports.routes'
import { requestsRoutes } from '../modules/requests/requests.routes'
import { reservationsRoutes } from '../modules/reservations/reservations.routes'
import { settingsRoutes } from '../modules/settings/settings.routes'
import { usersRoutes } from '../modules/users/users.routes'

export async function routes(app: FastifyInstance) {
  await app.register(requestsRoutes)
  await app.register(reservationsRoutes)
  await app.register(foundItemsRoutes)
  await app.register(lostReportsRoutes)
  await app.register(equipmentRoutes)
  await app.register(settingsRoutes)
  await app.register(locationsRoutes)
  await app.register(usersRoutes)
  await app.register(indicatorsRoutes)
}
