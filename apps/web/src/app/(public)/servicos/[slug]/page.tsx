import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicFooterSimple } from '@/components/ui/layout/public-footer'
import { PublicHeader } from '@/components/ui/layout/public-hearder'
import { serviceEmoji } from '@/lib/service-meta'
import { getService, type ServiceDetail } from '@/services/services'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const service = await getService(slug)

  return { title: service?.name ?? 'Serviço' }
}

/** Texto do botão e fatos de destaque, específicos de cada tipo de serviço. */
function flowInfo(service: ServiceDetail): { cta: string | null; facts: string[]; extra?: { href: string; label: string } } {
  switch (service.flow) {
    case 'equipment_reservation': {
      const facts: string[] = []
      if (service.loanDurationMinutes) facts.push(`Empréstimo gratuito de ${service.loanDurationMinutes} minutos`)
      if (service.pickupToleranceMinutes)
        facts.push(`Tolerância de ${service.pickupToleranceMinutes} minutos para retirar após o horário reservado`)
      facts.push('Retirada e devolução no SAC, com documento')
      return {
        cta: service.equipmentType === 'stroller' ? 'Reservar carrinho' : 'Reservar cadeira de rodas',
        facts,
      }
    }
    case 'lost_report': {
      const facts = ['Descreva o objeto e onde acha que perdeu: nossa equipe procura para você']
      if (service.storageDays) facts.push(`Itens encontrados ficam guardados por ${service.storageDays} dias`)
      facts.push('Você recebe um protocolo ao registrar')
      return {
        cta: 'Registrar objeto perdido',
        facts,
      }
    }
    case 'sac_message':
      return {
        cta: 'Enviar mensagem ao SAC',
        facts: ['Dúvidas, reclamações, sugestões e elogios', 'Você recebe um protocolo ao enviar'],
      }
    default:
      return { cta: null, facts: [] }
  }
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params
  const service = await getService(slug)

  if (!service) notFound()

  const { cta, facts, extra } = flowInfo(service)

  return (
    <>
      <PublicHeader variant="services" active="SERVIÇOS" />

      <section className="bg-gold px-[8%] pt-12 pb-16 text-center text-ink">
        <div className="mx-auto mb-3 grid size-[54px] place-items-center rounded-2xl bg-ink/[0.14] text-[26px]">
          {serviceEmoji(service.icon)}
        </div>
        <h1 className="mb-2 text-[40px] font-bold">{service.name}</h1>
        <p className="mx-auto max-w-[620px] text-[15px] leading-normal">{service.shortDescription}</p>
        {cta && (
          <Link
            href={`/servicos/${service.slug}/solicitar`}
            className="mt-6 inline-block rounded-full bg-ink px-7 py-3 font-bold text-white"
          >
            {cta}
          </Link>
        )}
      </section>

      <main className="mx-auto flex max-w-[860px] flex-col gap-8 px-6 py-10">
        {service.description && (
          <section>
            <h2 className="mb-2 text-xl font-bold">Sobre o serviço</h2>
            <p className="whitespace-pre-line text-sub">{service.description}</p>
          </section>
        )}

        {facts.length > 0 && (
          <section>
            <h2 className="mb-2 text-xl font-bold">O que você precisa saber</h2>
            <ul className="list-disc pl-5 text-sub">
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </section>
        )}

        {service.howItWorks && (
          <section>
            <h2 className="mb-2 text-xl font-bold">Como funciona</h2>
            <p className="whitespace-pre-line text-sub">{service.howItWorks}</p>
          </section>
        )}

        {service.pickupLocation && (
          <section>
            <h2 className="mb-2 text-xl font-bold">Onde fica</h2>
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
              <span className="text-sm font-normal">({service.isOpenNow ? 'aberto agora' : 'fechado agora'})</span>
            </h2>
            <ul className="text-sub">
              {service.openingHours.map((h) => (
                <li key={h.weekday}>
                  {WEEKDAYS[h.weekday] ?? h.weekday}: {h.closed ? 'Fechado' : `${h.open} às ${h.close}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        {service.contactPhone && <p className="text-sub">Contato: {service.contactPhone}</p>}

        <div className="flex flex-wrap gap-3">
          {extra && (
            <Link href={extra.href} className="rounded-full border border-line px-6 py-3 font-bold">
              {extra.label}
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
