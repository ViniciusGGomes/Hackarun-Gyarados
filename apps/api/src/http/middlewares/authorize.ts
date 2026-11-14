import type { Action, SubjectName } from '@saas/auth'
import type { FastifyRequest } from 'fastify'

import { ForbiddenError } from '../routes/_errors/forbidden-error'

export function authorize(action: Action, subject: SubjectName) {
  return async (request: FastifyRequest) => {
    const ability = await request.getAbility()

    if (!ability.can(action, subject)) {
      throw new ForbiddenError()
    }
  }
}
