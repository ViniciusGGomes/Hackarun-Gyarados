import type { FastifyReply, FastifyRequest } from 'fastify'

import { EXPIRES_IN_SECONDS, TOKEN_MAX_AGE } from './auth.constants'
import { login, logout } from './auth.service'

export async function loginController(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply,
) {
  const { email, password } = request.body

  const { user, sessionId } = await login(email, password)

  const accessToken = await reply.jwtSign({ sub: user.id, sid: sessionId }, { expiresIn: TOKEN_MAX_AGE })

  return reply.send({ accessToken, expiresIn: EXPIRES_IN_SECONDS, user })
}

export async function logoutController(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = await request.getCurrentSessionId()

  await logout(sessionId)

  return reply.status(204).send()
}

export async function meController(request: FastifyRequest, reply: FastifyReply) {
  const { id, name, email, role, active } = await request.getCurrentUser()

  return reply.send({ id, name, email, role, active })
}
