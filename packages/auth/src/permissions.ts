import type { AbilityBuilder } from '@casl/ability'
import type { AppAbility } from '.'
import type { User } from './models/user'
import type { Role } from './role'

type PermissionsByRole = (
  user: User,
  builder: AbilityBuilder<AppAbility>
) => void

export const permissions: Partial<Record<Role, PermissionsByRole>> = {
  ADMIN(_, { can }) {
    can('manage', 'all')
  },
}