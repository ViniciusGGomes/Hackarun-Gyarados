import type { Metadata } from 'next'

import { PublicFooterSimple } from '@/components/ui/layout/public-footer'
import { PublicHeader } from '@/components/ui/layout/public-hearder'
import { ServiceList } from '@/components/ui/services/service-list'
import { listServices } from '@/services/services'

export const metadata: Metadata = {
  title: 'Serviços',
}

export default async function ServicesPage() {
  const services = await listServices()

  return (
    <>
      <PublicHeader variant="services" active="SERVIÇOS" />

      <section className="bg-gold px-[8%] pt-12 pb-16 text-center text-ink">
        <div className="mx-auto mb-3 grid size-[54px] place-items-center rounded-2xl bg-ink/[0.14] text-[26px]">
          🛠
        </div>
        <h1 className="mb-2 text-[40px] font-bold">Serviços</h1>
        <p className="mx-auto max-w-[620px] text-[15px] leading-normal">
          Além de pagar o estacionamento pelo aplicativo, oferecemos uma série
          de serviços e comodidades para trazer mais conforto para você e sua
          família.
        </p>
      </section>

      <ServiceList services={services} />
      <PublicFooterSimple />
    </>
  )
}
