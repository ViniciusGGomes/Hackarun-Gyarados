'use client'

import type { AppAbility, User } from '@saas/auth'
import { createContext, useContext, type ReactNode } from 'react'

import { getAbility } from './ability'

const AbilityContext = createContext<AppAbility | null>(null)

interface AbilityProviderProps {
  user: User
  children: ReactNode
}

export function AbilityProvider({ user, children }: AbilityProviderProps) {
  const ability = getAbility(user)

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
}

export function useAbility(): AppAbility {
  const ability = useContext(AbilityContext)

  if (!ability) {
    throw new Error('useAbility must be used within an AbilityProvider')
  }

  return ability
}
