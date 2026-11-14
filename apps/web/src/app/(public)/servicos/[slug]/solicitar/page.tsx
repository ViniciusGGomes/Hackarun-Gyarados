import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PublicFooterSimple } from '@/components/ui/layout/public-footer'
import { PublicHeader } from '@/components/ui/layout/public-hearder'
import { getService } from '@/services/services'

type Props = { params: Promise<{ slug: string }> }

export const metadata: Metadata = { title: 'Solicitar serviço' }

export default async function RequestServicePage({ params }: Props) {
  const { slug } = await params
  const service = await getService(slug)

  if (!service) notFound()
  if (service.kind !== 'interactive') redirect(`/servicos/${slug}`)

  return (
    <>
      <PublicHeader variant="services" active="SERVIÇOS" />

      <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-16 text-center">
        <h1 className="text-3xl font-bold">Solicitar: {service.name}</h1>
        <p className="text-sub">
          O formulário online deste serviço ainda está em desenvolvimento. Enquanto
          isso, procure o SAC do shopping
          {service.contactPhone ? ` ou ligue para ${service.contactPhone}` : ''}.
        </p>
        <Link
          href={`/servicos/${slug}`}
          className="mx-auto rounded-full bg-gold px-6 py-3 font-bold text-ink"
        >
          Ver detalhes do serviço
        </Link>
      </main>

      <PublicFooterSimple />
    </>
  )
}
