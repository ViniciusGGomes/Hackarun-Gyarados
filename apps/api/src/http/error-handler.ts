import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

import { BadRequestError } from './routes/_errors/bad-request-error'
import { ForbiddenError } from './routes/_errors/forbidden-error'
import { NotFoundError } from './routes/_errors/not-found-error'
import { UnauthorizedError } from './routes/_errors/unauthorized-error'

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error',
      errors: error.flatten().fieldErrors,
    })
  }

  if (error instanceof BadRequestError) {
    return reply.status(400).send({ message: error.message })
  }

  if (error instanceof UnauthorizedError) {
    return reply.status(401).send({ message: error.message })
  }

  if (error instanceof ForbiddenError) {
    return reply.status(403).send({ message: error.message })
  }

  if (error instanceof NotFoundError) {
    return reply.status(404).send({ statusCode: 404, code: 'NOT_FOUND', message: error.message })
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ message: error.message })
  }

  console.error(error)

  return reply.status(500).send({ message: 'Internal server error.' })
}
