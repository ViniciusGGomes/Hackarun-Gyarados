import type { AbilityBuilder } from '@casl/ability'

import type { AppAbility } from '.'
import type { User } from './models/user'
import type { Role } from './role'
import { FINAL_REQUEST_STATUSES } from './subjects'

type PermissionsByRole = (user: User, builder: AbilityBuilder<AppAbility>) => void

function grantAttendance(builder: AbilityBuilder<AppAbility>): void {
  builder.can('read', 'Request')
  builder.can('sendMessage', 'Request')
  builder.can('read', 'Reservation')
  builder.can('pickup', 'Reservation')
  builder.can('return', 'Reservation')
  builder.can('read', 'FoundItem')
  builder.can('create', 'FoundItem')
  builder.can('close', 'FoundItem')
  builder.can('read', 'LostReport')
  builder.can('match', 'LostReport')
  builder.can('deliver', 'LostReport')
}

export const permissions: Partial<Record<Role, PermissionsByRole>> = {
  attendant(_, builder) {
    grantAttendance(builder)
    builder.can('updateStatus', 'Request', {
      status: { $nin: FINAL_REQUEST_STATUSES },
    })
  },

  manager(_, builder) {
    grantAttendance(builder)
    builder.can('updateStatus', 'Request')

    builder.can(['read', 'create', 'update'], 'Equipment')
    builder.can(['read', 'update'], 'ReservationSettings')
    builder.can(['read', 'create', 'update'], 'Location')
    builder.can(['read', 'create', 'update'], 'User')
    builder.can('read', 'Indicator')
  },
}
