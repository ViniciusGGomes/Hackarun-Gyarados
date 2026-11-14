import type { FastifyInstance } from 'fastify'
import { fastifyPlugin } from 'fastify-plugin'

import { prisma } from '../../lib/prisma'
import { validateSession } from '../../modules/auth/auth.service'
import { getUserPermissions } from '../../utils/get-user-permissions'
import { UnauthorizedError } from '../routes/_errors/unauthorized-error'

export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (request) => {
    let resolved: Promise<{ userId: string; sessionId: string }> | undefined

    // Verifies the token and its session once per request.
    const resolveSession = () => {
      resolved ??= (async () => {
        let payload: { sub: string; sid?: string }

        try {
          payload = await request.jwtVerify<{ sub: string; sid?: string }>()
        } catch {
          throw new UnauthorizedError('Invalid auth token')
        }

        if (!payload.sid) {
          throw new UnauthorizedError('Invalid auth token')
        }

        await validateSession(payload.sid, payload.sub)

        return { userId: payload.sub, sessionId: payload.sid }
      })()

      return resolved
    }

    request.getCurrentUserId = async () => (await resolveSession()).userId

    request.getCurrentSessionId = async () => (await resolveSession()).sessionId

    request.getCurrentUser = async () => {
      const userId = await request.getCurrentUserId()

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || !user.active) {
        throw new UnauthorizedError('User is not active')
      }

      return user
    }

    request.getAbility = async () => {
      const user = await request.getCurrentUser()

      return getUserPermissions(user.id, user.role)
    }
  })
})
