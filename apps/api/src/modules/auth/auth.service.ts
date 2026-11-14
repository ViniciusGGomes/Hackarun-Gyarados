import bcrypt from 'bcryptjs'

import { AccountLockedError } from '../../http/routes/_errors/account-locked-error'
import { InvalidCredentialsError } from '../../http/routes/_errors/invalid-credentials-error'
import { UnauthorizedError } from '../../http/routes/_errors/unauthorized-error'
import {
  DUMMY_PASSWORD_HASH,
  INACTIVITY_WINDOW_MS,
  LOCK_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
} from './auth.constants'
import { authRepository } from './auth.repository'

type PublicUser = {
  id: string
  name: string
  email: string
  role: 'attendant' | 'manager'
  active: boolean
}

function toPublicUser(user: PublicUser): PublicUser {
  const { id, name, email, role, active } = user

  return { id, name, email, role, active }
}

export async function login(email: string, password: string, now: Date = new Date()) {
  const user = await authRepository.findUserByEmail(email.trim().toLowerCase())

  // Unknown and inactive users cost one bcrypt comparison, like a wrong password.
  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
    throw new InvalidCredentialsError()
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    throw new AccountLockedError()
  }

  // A lock that ended, or a count already at the limit, no longer counts against this attempt.
  const staleCount = user.lockedUntil !== null || user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatches) {
    const restarted = staleCount && (await authRepository.restartFailedAttempts(user.id, now))
    const attempts = restarted ? 1 : await authRepository.incrementFailedAttempts(user.id)

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await authRepository.setLockedUntil(user.id, new Date(now.getTime() + LOCK_DURATION_MS))
    }

    throw new InvalidCredentialsError()
  }

  await authRepository.markLoginSuccess(user.id, now)
  const session = await authRepository.createSession(user.id, now)

  return { user: toPublicUser(user), sessionId: session.id }
}

export async function validateSession(sessionId: string, userId: string, now: Date = new Date()) {
  const session = await authRepository.findSessionById(sessionId)

  if (!session || session.userId !== userId || session.revokedAt) {
    throw new UnauthorizedError('Invalid auth token')
  }

  if (now.getTime() - session.lastActivityAt.getTime() > INACTIVITY_WINDOW_MS) {
    throw new UnauthorizedError('Session expired')
  }

  await authRepository.touchSession(sessionId, now)
}

export async function logout(sessionId: string, now: Date = new Date()) {
  await authRepository.revokeSession(sessionId, now)
}
