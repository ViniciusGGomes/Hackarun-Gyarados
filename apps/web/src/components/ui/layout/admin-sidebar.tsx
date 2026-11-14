'use client'

import Link from 'next/link'

import { useAbility } from '@/lib/ability-context'

export function AdminSidebar() {
  const ability = useAbility()

  return (
    <nav>
      <Link href="/admin/solicitacoes">Solicitações</Link>
      <Link href="/admin/agenda">Agenda</Link>
      <Link href="/admin/achados-e-perdidos">Achados e Perdidos</Link>

      {ability.can('read', 'Equipment') && (
        <Link href="/admin/configuracoes/equipamentos">Equipamentos</Link>
      )}
      {ability.can('read', 'ReservationSettings') && (
        <Link href="/admin/configuracoes/regras">Regras</Link>
      )}
      {ability.can('read', 'Location') && (
        <Link href="/admin/configuracoes/locais">Locais</Link>
      )}
      {ability.can('read', 'User') && (
        <Link href="/admin/configuracoes/usuarios">Usuários</Link>
      )}
      {ability.can('read', 'Indicator') && (
        <Link href="/admin/indicadores">Indicadores</Link>
      )}
    </nav>
  )
}
