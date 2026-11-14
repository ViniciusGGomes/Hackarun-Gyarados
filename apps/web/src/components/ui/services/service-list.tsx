'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import {
  matchesFilter,
  SERVICE_FILTERS,
  type ServiceFilter,
} from '@/lib/service-meta'
import { cn } from '@/lib/utils'
import type { Service } from '@/types/service'

import { FeaturedServiceCard, ServiceCard } from './service-card'

interface ServiceListProps {
  /** `null` quando a API não respondeu. */
  services: Service[] | null
}

export function ServiceList({ services }: ServiceListProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ServiceFilter>('all')

  const visible = useMemo(() => {
    const term = query.toLowerCase()

    return (services ?? []).filter(
      (service) =>
        matchesFilter(service, filter) &&
        service.name.toLowerCase().includes(term),
    )
  }, [services, query, filter])

  const featured = visible.filter((service) => service.kind === 'interactive')

  return (
    <main className="mx-auto -mt-7 max-w-[1100px] px-6">
      <div className="flex items-center gap-2.5 rounded-2xl bg-card px-4 py-3 shadow-[0_10px_28px_rgba(42,31,5,0.16)]">
        <span aria-hidden>🔎</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar serviço, como cadeira de rodas ou Wi-Fi"
          aria-label="Buscar serviço"
          className="flex-1 border-0 bg-transparent text-[15px] text-foreground outline-0"
        />
      </div>

      <div className="mt-[18px] mb-2 flex flex-wrap gap-2">
        {SERVICE_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              'cursor-pointer rounded-full border border-line bg-card px-4 py-2 text-[13px] font-semibold text-foreground',
              filter === item.key &&
                'border-brown bg-brown text-highlight',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {services === null ? (
        <p className="p-[30px] text-center text-sub">
          Não foi possível carregar os serviços agora. Tente novamente em
          instantes ou fale com o SAC: (63) 3219-4616.
        </p>
      ) : (
        <>
          {featured.length > 0 && (
            <div>
              <h2 className="mt-[30px] mb-1 text-[20px] font-bold">
                Solicite online
              </h2>
              <p className="mb-4 text-[14px] text-sub">
                Reserve ou registre sem sair do celular e acompanhe pelo
                protocolo.
              </p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-[18px]">
                {featured.map((service) => (
                  <FeaturedServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          )}

          <h2 className="mt-[30px] mb-1 text-[20px] font-bold">
            Todos os serviços
          </h2>
          <p className="mb-4 text-[14px] text-sub">
            {visible.length} serviços disponíveis
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
            {visible.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>

          {visible.length === 0 && (
            <div className="p-[30px] text-center text-sub">
              Nenhum serviço encontrado. Fale com o SAC: (63) 3219-4616.
            </div>
          )}
        </>
      )}

      <div className="my-10 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line bg-g50 px-[26px] py-[22px]">
        <div>
          <b className="block text-[16px]">Prefere falar com o SAC?</b>
          <span className="text-[13px] text-sub">
            (63) 3219-4616 · telefone e WhatsApp
          </span>
        </div>
        <Link
          href="/acompanhar"
          className="rounded-[14px] bg-brown px-6 py-[13px] text-[14px] font-bold text-highlight shadow-[0_6px_14px_rgba(58,42,6,0.25)]"
        >
          Já tenho um protocolo? Acompanhar
        </Link>
      </div>
    </main>
  )
}
