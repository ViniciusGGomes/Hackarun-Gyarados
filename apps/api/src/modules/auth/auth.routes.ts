import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { loginController, logoutController, meController } from './auth.controller'
import { LoginBodySchema, LoginResponseSchema, UserSchema } from './auth.schemas'

export async function authRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/login',
    {
      schema: {
        tags: ['Autenticação'],
        summary: 'Login da equipe',
        body: LoginBodySchema,
        response: { 200: LoginResponseSchema },
      },
    },
    loginController,
  )

  app.post(
    '/auth/logout',
    { schema: { tags: ['Autenticação'], summary: 'Logout' } },
    logoutController,
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/auth/me',
    {
      schema: {
        tags: ['Autenticação'],
        summary: 'Usuário autenticado e perfil',
        response: { 200: UserSchema },
      },
    },
    meController,
  )
}
