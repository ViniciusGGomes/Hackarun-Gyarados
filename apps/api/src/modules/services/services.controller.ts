import type { FastifyReply, FastifyRequest } from 'fastify'

import { getServiceDetail, listServices } from './services.service'

export async function listServicesController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await listServices()

  return reply.send({ data })
}

export async function getServiceController(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply,
) {
  const service = await getServiceDetail(request.params.slug)

  return reply.send(service)
}
