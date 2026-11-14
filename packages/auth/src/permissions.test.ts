import { expect, it } from 'vitest'

import { defineAbilityFor } from './index'
import { roleSchema } from './role'

const attendant = {
  id: '00000000-0000-0000-0000-000000000001',
  role: 'attendant',
} as const

const manager = {
  id: '00000000-0000-0000-0000-000000000002',
  role: 'manager',
} as const

it('only attendant and manager are valid roles', () => {
  const roles = roleSchema.options.map((option) => option.value)

  expect(roles).toEqual(['attendant', 'manager'])
})

it('attendant can read Request', () => {
  expect(defineAbilityFor(attendant).can('read', 'Request')).toBe(true)
})

it('attendant can updateStatus on non-final', () => {
  const ability = defineAbilityFor(attendant)
  expect(ability.can('updateStatus', { __typename: 'Request', status: 'searching' })).toBe(true)
})

it('attendant cannot updateStatus on final', () => {
  const ability = defineAbilityFor(attendant)
  expect(ability.can('updateStatus', { __typename: 'Request', status: 'returned' })).toBe(false)
})

it('attendant cannot read Indicator', () => {
  expect(defineAbilityFor(attendant).can('read', 'Indicator')).toBe(false)
})

it('manager can read Indicator', () => {
  expect(defineAbilityFor(manager).can('read', 'Indicator')).toBe(true)
})

it('manager can updateStatus on final', () => {
  const ability = defineAbilityFor(manager)
  expect(ability.can('updateStatus', { __typename: 'Request', status: 'returned' })).toBe(true)
})

it('manager can create User', () => {
  expect(defineAbilityFor(manager).can('create', 'User')).toBe(true)
})

it('unknown role throws', () => {
  expect(() =>
    defineAbilityFor({ id: '00000000-0000-0000-0000-000000000003', role: 'ADMIN' as never }),
  ).toThrow()
})
