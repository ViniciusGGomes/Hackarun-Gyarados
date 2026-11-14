'use client'

import { useAbility } from '@/lib/ability-context'

export function AdminHeader() {
  const ability = useAbility()

  return (
    <header>
      {ability.can('create', 'User') && <span>Criar usuário</span>}
    </header>
  )
}
