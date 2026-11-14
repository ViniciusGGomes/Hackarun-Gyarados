import type { FastifyInstance } from 'fastify'
import { fastifyPlugin } from 'fastify-plugin'

import { prisma } from '../../lib/prisma'
import { getUserPermissions } from '../../utils/get-user-permissions'
import { UnauthorizedError } from '../routes/_errors/unauthorized-error'

export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (request) => {
    request.getCurrentUserId = async () => {
      try {
        const { sub } = await request.jwtVerify<{ sub: string }>()

        return sub
      } catch {
        throw new UnauthorizedError('Invalid auth token')
      }
    }

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
