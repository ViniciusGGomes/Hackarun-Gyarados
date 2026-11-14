import type { UserRole } from '@prisma/client'
import { defineAbilityFor } from '@saas/auth'

export function getUserPermissions(userId: string, role: UserRole) {
  return defineAbilityFor({ id: userId, role })
}
