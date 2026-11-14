import type { User } from '@prisma/client'
import type { AppAbility } from '@saas/auth'
import 'fastify'

declare module 'fastify' {
  export interface FastifyRequest {
    getCurrentUserId(): Promise<string>
    getCurrentUser(): Promise<User>
    getAbility(): Promise<AppAbility>
  }
}
