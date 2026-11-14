import type { FastifyInstance, FastifyRequest } from 'fastify'

import { authorize } from '../../http/middlewares/authorize'
import { ForbiddenError } from '../../http/routes/_errors/forbidden-error'
import { prisma } from '../../lib/prisma'

async function authorizeUpdateStatus(request: FastifyRequest<{ Params: { id: string } }>) {
  const ability = await request.getAbility()
  const { id } = request.params

  const found = await prisma.request.findUnique({
    where: { id },
    select: { status: true },
  })

  if (found && !ability.can('updateStatus', { __typename: 'Request', status: found.status })) {
    throw new ForbiddenError()
  }
}

export async function requestsRoutes(app: FastifyInstance) {
  app.get('/admin/requests', { preHandler: authorize('read', 'Request') }, async () => ({}))

  app.get('/admin/requests/:id', { preHandler: authorize('read', 'Request') }, async () => ({}))

  app.patch('/admin/requests/:id/status', { preHandler: authorizeUpdateStatus }, async () => ({}))

  app.post(
    '/admin/requests/:id/messages',
    { preHandler: authorize('sendMessage', 'Request') },
    async () => ({}),
  )
}
