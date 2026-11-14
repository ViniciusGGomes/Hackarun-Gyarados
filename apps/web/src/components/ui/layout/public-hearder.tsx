import Link from 'next/link'

import { cn } from '@/lib/utils'

export type PublicHeaderVariant = 'home' | 'services'

interface MenuItem {
  label: string
  href: string
}

/**
 * O Figma usa menus diferentes em cada frame (Home x Serviços). As duas
 * variantes são mantidas como no design.
 */
const MENUS: Record<PublicHeaderVariant, MenuItem[]> = {
  home: [
    { label: 'O SHOPPING', href: '/o-shopping' },
    { label: 'LOJAS', href: '/lojas' },
    { label: 'GASTRONOMIA', href: '/gastronomia' },
    { label: 'CINEMA', href: '/cinema' },
    { label: 'EVENTOS', href: '/eventos' },
    { label: 'SERVIÇOS', href: '/servicos' },
    { label: 'PROMOÇÕES', href: '/promocoes' },
    { label: 'CONTATO', href: '/servicos/sac/solicitar' },
  ],
  services: [
    { label: 'O SHOPPING', href: '/o-shopping' },
    { label: 'LOJAS', href: '/lojas' },
    { label: 'GASTRONOMIA', href: '/gastronomia' },
    { label: 'CINEMA', href: '/cinema' },
    { label: 'EVENTOS', href: '/eventos' },
    { label: 'SERVIÇOS', href: '/servicos' },
    { label: 'COMO CHEGAR', href: '/como-chegar' },
    { label: 'FALE CONOSCO', href: '/servicos/sac/solicitar' },
    { label: 'PORTAL DO LOJISTA', href: '/portal-do-lojista' },
  ],
}

interface PublicHeaderProps {
  variant: PublicHeaderVariant
  /** Rótulo do item de menu ativo. */
  active?: string
}

export function PublicHeader({ variant, active }: PublicHeaderProps) {
  const isHome = variant === 'home'

  return (
    <>
      <div
        className={cn(
          'flex items-center bg-card',
          isHome
            ? 'gap-5 px-[6%] py-3'
            : 'flex-wrap justify-between gap-2.5 px-[8%] py-3.5',
        )}
      >
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2.5 font-extrabold',
            isHome
              ? 'mr-auto text-[18px]'
              : 'text-[17px]',
          )}
        >
          <i
            className={cn(
              'bg-gold text-ink grid place-items-center rounded-full not-italic',
              isHome ? 'size-9' : 'size-[34px]',
            )}
          >
            ✦
          </i>
          Capim Dourado
        </Link>

        <small className="text-[13px] text-sub">
          ABERTO <b className="text-foreground">10h</b> às{' '}
          <b className="text-foreground">22h</b>
        </small>
      </div>

      <nav
        className={cn(
          'flex flex-wrap justify-center bg-menu px-4',
          isHome ? 'gap-6 py-3' : 'gap-[22px] py-[11px]',
        )}
      >
        {MENUS[variant].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'font-bold text-white',
              isHome
                ? 'text-[12px] tracking-[0.04em]'
                : 'text-[11px] tracking-[0.03em]',
              item.label === active &&
                'border-b-2 border-highlight text-highlight',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
