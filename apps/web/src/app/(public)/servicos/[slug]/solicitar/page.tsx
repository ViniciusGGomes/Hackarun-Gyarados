import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PublicFooterSimple } from '@/components/ui/layout/public-footer'
import { PublicHeader } from '@/components/ui/layout/public-hearder'
import { LostReportForm } from '@/components/ui/lost-found/lost-report-form'
import { ReservationForm } from '@/components/ui/reservations/reservation-form'
import { SacForm } from '@/components/ui/sac/sac-form'
import { serviceEmoji } from '@/lib/service-meta'
import { getLocations, getPrivacyNotice } from '@/services/public-api'
import { getService } from '@/services/services'

type Props = { params: Promise<{ slug: string }> }

export const metadata: Metadata = { title: 'Solicitar serviço' }

const TITLES = {
  equipment_reservation: 'Reservar',
  lost_report: 'Registrar objeto perdido',
  sac_message: 'Falar com o SAC',
} as const

export default async function RequestServicePage({ params }: Props) {
  const { slug } = await params
  const service = await getService(slug)

  if (!service) notFound()
  if (service.kind !== 'interactive' || service.flow === 'none') redirect(`/servicos/${slug}`)

  const [notice, locations] = await Promise.all([getPrivacyNotice(), getLocations()])

  return (
    <>
      <PublicHeader variant="services" active="SERVIÇOS" />

      <section className="bg-gold px-[8%] pt-10 pb-12 text-center text-ink">
        <div className="mx-auto mb-3 grid size-[54px] place-items-center rounded-2xl bg-ink/[0.14] text-[26px]">
          {serviceEmoji(service.icon)}
        </div>
        <h1 className="mb-1 text-[34px] font-bold">
          {TITLES[service.flow as keyof typeof TITLES] ?? 'Solicitar'}: {service.name}
        </h1>
        <p className="mx-auto max-w-[620px] text-[15px]">{service.shortDescription}</p>
      </section>

      <main className="mx-auto max-w-[680px] px-6 py-10">
        {service.flow === 'equipment_reservation' && service.equipmentType && (
          <ReservationForm equipmentType={service.equipmentType} notice={notice} locations={locations} />
        )}
        {service.flow === 'lost_report' && <LostReportForm notice={notice} locations={locations} />}
        {service.flow === 'sac_message' && <SacForm notice={notice} serviceSlug={service.slug} />}

        <Link href={`/servicos/${slug}`} className="mt-8 inline-block text-[13px] font-bold underline">
          ← Voltar para {service.name}
        </Link>
      </main>

      <PublicFooterSimple />
    </>
  )
}
