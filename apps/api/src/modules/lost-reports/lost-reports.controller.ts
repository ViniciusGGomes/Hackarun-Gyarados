import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CreateLostReportInput } from './lost-reports.schemas'
import { createLostReport } from './lost-reports.service'

// The route schema (Zod) has already validated and cleaned the body when this runs.

export async function createLostReportController(request: FastifyRequest, reply: FastifyReply) {
  const result = await createLostReport(request.body as CreateLostReportInput)

  return reply.status(201).send(result)
}
