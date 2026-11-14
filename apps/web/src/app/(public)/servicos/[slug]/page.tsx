import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicFooterSimple } from '@/components/ui/layout/public-footer'
import { PublicHeader } from '@/components/ui/layout/public-hearder'
import { serviceEmoji } from '@/lib/service-meta'
import { getService } from '@/services/services'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const service = await getService(slug)

  return { title: service?.name ?? 'Serviço' }
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params
  const service = await getService(slug)

  if (!service) notFound()

  const interactive = service.kind === 'interactive'

  return (
    <>
      <PublicHeader variant="services" active="SERVIÇOS" />

      <section className="bg-gold px-[8%] pt-12 pb-16 text-center text-ink">
        <div className="mx-auto mb-3 grid size-[54px] place-items-center rounded-2xl bg-ink/[0.14] text-[26px]">
          {serviceEmoji(service.icon)}
        </div>
        <h1 className="mb-2 text-[40px] font-bold">{service.name}</h1>
        <p className="mx-auto max-w-[620px] text-[15px] leading-normal">
          {service.shortDescription}
        </p>
      </section>

      <main className="mx-auto flex max-w-[860px] flex-col gap-8 px-6 py-10">
        {service.description && (
          <section>
            <h2 className="mb-2 text-xl font-bold">Sobre o serviço</h2>
            <p className="text-sub whitespace-pre-line">{service.description}</p>
          </section>
        )}

        {service.howItWorks && (
          <section>
            <h2 className="mb-2 text-xl font-bold">Como funciona</h2>
            <p className="text-sub whitespace-pre-line">{service.howItWorks}</p>
          </section>
        )}

        {service.pickupLocation && (
          <section>
            <h2 className="mb-2 text-xl font-bold">Onde retirar</h2>
            <p className="text-sub">
              {service.pickupLocation.name}
              {service.pickupLocation.floor ? ` — ${service.pickupLocation.floor}` : ''}
            </p>
          </section>
        )}

        {service.openingHours.length > 0 && (
          <section>
            <h2 className="mb-2 text-xl font-bold">
              Horário de atendimento{' '}
              <span className="text-sm font-normal">
                ({service.isOpenNow ? 'aberto agora' : 'fechado agora'})
              </span>
            </h2>
            <ul className="text-sub">
              {service.openingHours.map((h) => (
                <li key={h.weekday}>
                  {WEEKDAYS[h.weekday] ?? h.weekday}:{' '}
                  {h.closed ? 'Fechado' : `${h.open} às ${h.close}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        {service.contactPhone && (
          <p className="text-sub">Contato: {service.contactPhone}</p>
        )}

        <div className="flex gap-3">
          {interactive && (
            <Link
              href={`/servicos/${service.slug}/solicitar`}
              className="rounded-full bg-gold px-6 py-3 font-bold text-ink"
            >
              Solicitar
            </Link>
          )}
          <Link href="/servicos" className="rounded-full border border-line px-6 py-3 font-bold">
            Voltar aos serviços
          </Link>
        </div>
      </main>

      <PublicFooterSimple />
    </>
  )
}
