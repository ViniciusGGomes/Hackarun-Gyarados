import { defineAbilityFor, type AppAbility, type User } from '@saas/auth'

export function getAbility(user: User): AppAbility {
  return defineAbilityFor(user)
}

export type { AppAbility, User } from '@saas/auth'
