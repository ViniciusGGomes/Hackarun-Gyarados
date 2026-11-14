import {
  AbilityBuilder,
  createMongoAbility,
  type CreateAbility,
  type MongoAbility,
} from '@casl/ability'

import type { Action } from './actions'
import type { User } from './models/user'
import { permissions } from './permissions'
import type { Subject } from './subjects'

export * from './actions'
export * from './models/user'
export * from './role'
export * from './subjects'

type AppAbilities = [Action, Subject]
export type AppAbility = MongoAbility<AppAbilities>

export const createAppAbility = createMongoAbility as CreateAbility<AppAbility>

export function defineAbilityFor(user: User) {
  const builder = new AbilityBuilder<AppAbility>(createAppAbility)

  const definePermissions = permissions[user.role]

  if (!definePermissions) {
    throw new Error(`Permissions for role ${user.role} not found`)
  }

  definePermissions(user, builder)

  const ability = builder.build({
    detectSubjectType(subject) {
      return typeof subject === 'string' ? subject : subject.__typename
    },
  })

  ability.can = ability.can.bind(ability)
  ability.cannot = ability.cannot.bind(ability)

  return ability
}
