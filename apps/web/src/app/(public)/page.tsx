import type { Metadata } from 'next'

import { Hero } from '@/components/ui/home/hero'
import { Newsletter } from '@/components/ui/home/newsletter'
import { ServiceShortcuts } from '@/components/ui/home/service-shortcuts'
import {
  CinemaPosters,
  DiscoverMore,
  StoresAndFood,
} from '@/components/ui/home/shopping-information'
import { CookieBanner } from '@/components/ui/layout/cookie-banner'
import { PublicFooter } from '@/components/ui/layout/public-footer'
import { PublicHeader } from '@/components/ui/layout/public-hearder'

export const metadata: Metadata = {
  title: 'Home',
}

export default function HomePage() {
  return (
    <>
      <PublicHeader variant="home" />
      <Hero />

      <div className="mx-auto max-w-[1160px] px-6">
        <ServiceShortcuts />
        <StoresAndFood />
        <CinemaPosters />
        <DiscoverMore />
      </div>

      <Newsletter />
      <PublicFooter />
      <CookieBanner />
    </>
  )
}
