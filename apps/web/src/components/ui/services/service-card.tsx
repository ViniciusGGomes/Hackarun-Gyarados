import Link from 'next/link'

import { NEW_SERVICE_SLUGS, serviceEmoji } from '@/lib/service-meta'
import type { Service } from '@/types/service'

/** Card de destaque (seção "Solicite online"). */
export function FeaturedServiceCard({ service }: { service: Service }) {
  const isNew = NEW_SERVICE_SLUGS.has(service.slug)

  return (
    <Link
      href={`/servicos/${service.slug}/solicitar`}
      className="bg-gold-150 flex min-h-[200px] flex-col gap-1.5 rounded-[20px] p-5 text-ink shadow-[0_8px_20px_rgba(168,124,16,0.25)] transition-transform duration-150 hover:-translate-y-[3px]"
    >
      {isNew && (
        <span className="self-start rounded-full bg-brown px-2 py-[3px] text-[10px] font-extrabold text-highlight">
          NOVO
        </span>
      )}
      <div className="mb-auto grid size-11 place-items-center rounded-xl bg-ink/[0.14] text-[22px]">
        {serviceEmoji(service.icon)}
      </div>
      <b className="text-[19px]">{service.name}</b>
      <span className="text-[13px]">{service.shortDescription}</span>
      <em className="mt-1.5 text-[13px] font-bold not-italic">Solicitar →</em>
    </Link>
  )
}

/** Card da grade "Todos os serviços". */
export function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      href={`/servicos/${service.slug}`}
      className="flex cursor-pointer flex-col items-center gap-3 rounded-[18px] border border-line bg-card px-4 py-[22px] text-center transition duration-150 hover:-translate-y-0.5 hover:border-g500 hover:shadow-[0_8px_20px_rgba(212,166,42,0.22)]"
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-g50 text-[26px]">
        {serviceEmoji(service.icon)}
      </div>
      <b className="text-[14px]">{service.name}</b>
      <small className="text-[11px] text-sub">
        {service.kind === 'interactive' ? 'Solicite online' : 'Informações'}
      </small>
    </Link>
  )
}
