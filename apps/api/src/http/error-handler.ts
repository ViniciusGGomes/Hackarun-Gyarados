import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { ZodError } from 'zod'

import { AccountLockedError } from './routes/_errors/account-locked-error'
import { AppError } from './routes/_errors/app-error'
import { BadRequestError } from './routes/_errors/bad-request-error'
import { ForbiddenError } from './routes/_errors/forbidden-error'
import { InvalidCredentialsError } from './routes/_errors/invalid-credentials-error'
import { NotFoundError } from './routes/_errors/not-found-error'
import { UnauthorizedError } from './routes/_errors/unauthorized-error'

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message }))

    return reply.status(400).send({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation error', details })
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((item) => ({
      field: item.instancePath.replace(/^\//, '').replace(/\//g, '.'),
      issue: item.message ?? 'Invalid value',
    }))

    return reply.status(400).send({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation error', details })
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ statusCode: error.statusCode, code: error.code, message: error.message })
  }

  if (error instanceof BadRequestError) {
    return reply.status(400).send({ statusCode: 400, code: 'VALIDATION_ERROR', message: error.message })
  }

  if (error instanceof InvalidCredentialsError) {
    return reply.status(401).send({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: error.message })
  }

  if (error instanceof UnauthorizedError) {
    return reply.status(401).send({ statusCode: 401, code: 'UNAUTHORIZED', message: error.message })
  }

  if (error instanceof ForbiddenError) {
    return reply.status(403).send({ statusCode: 403, code: 'FORBIDDEN', message: error.message })
  }

  if (error instanceof AccountLockedError) {
    return reply.status(423).send({ statusCode: 423, code: 'ACCOUNT_LOCKED', message: error.message })
  }

  if (error instanceof NotFoundError) {
    return reply.status(404).send({ statusCode: 404, code: 'NOT_FOUND', message: error.message })
  }

  // Fastify's own 400s (malformed or empty JSON body) use the same code as a failed validation.
  if (error.statusCode === 400) {
    return reply.status(400).send({ statusCode: 400, code: 'VALIDATION_ERROR', message: error.message })
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ message: error.message })
  }

  // Log only what identifies the failure: the message of a database error can carry form values.
  console.error('Unexpected error', { name: error.name, code: (error as { code?: unknown }).code })

  return reply.status(500).send({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error.' })
}
