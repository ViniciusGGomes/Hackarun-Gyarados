import type { FastifyInstance } from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'

import { equipmentRoutes } from '../modules/equipment/equipment.routes'
import { foundItemsRoutes } from '../modules/found-items/found-items.routes'
import { indicatorsRoutes } from '../modules/indicators/indicators.routes'
import { locationsRoutes } from '../modules/locations/locations.routes'
import { lostReportsRoutes } from '../modules/lost-reports/lost-reports.routes'
import { privacyRoutes } from '../modules/privacy/privacy.routes'
import { requestsRoutes } from '../modules/requests/requests.routes'
import { reservationsRoutes } from '../modules/reservations/reservations.routes'
import { servicesRoutes } from '../modules/services/services.routes'
import { settingsRoutes } from '../modules/settings/settings.routes'
import { usersRoutes } from '../modules/users/users.routes'

export async function routes(app: FastifyInstance) {
  // Scoped to this plugin so every route can declare Zod schemas regardless of the host app setup.
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(servicesRoutes)
  await app.register(privacyRoutes)
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
