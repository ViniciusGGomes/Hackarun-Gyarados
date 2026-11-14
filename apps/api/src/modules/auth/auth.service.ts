import bcrypt from 'bcryptjs'

import { AccountLockedError } from '../../http/routes/_errors/account-locked-error'
import { InvalidCredentialsError } from '../../http/routes/_errors/invalid-credentials-error'
import { DUMMY_PASSWORD_HASH, LOCK_DURATION_MS, MAX_FAILED_ATTEMPTS } from './auth.constants'
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

  const lockExpired = user.lockedUntil !== null
  if (lockExpired || user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await authRepository.resetLock(user.id)
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatches) {
    const attempts = await authRepository.incrementFailedAttempts(user.id)

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await authRepository.setLockedUntil(user.id, new Date(now.getTime() + LOCK_DURATION_MS))
    }

    throw new InvalidCredentialsError()
  }

  await authRepository.markLoginSuccess(user.id, now)
  const session = await authRepository.createSession(user.id, now)

  return { user: toPublicUser(user), sessionId: session.id }
}
