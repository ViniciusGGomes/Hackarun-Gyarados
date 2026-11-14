import Link from 'next/link'

import { cn } from '@/lib/utils'

function Placeholder({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-placeholder relative grid place-items-center overflow-hidden text-center text-[12px] font-bold text-brown',
        className,
      )}
    >
      <span className="rounded-full bg-white/80 px-3 py-1.5">{label}</span>
    </div>
  )
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <>
      <h2 className="mt-[60px] mb-1.5 text-[28px] font-bold">{title}</h2>
      <p className="mb-5 text-[15px] text-sub">{subtitle}</p>
    </>
  )
}

function EditorialCard({
  imageLabel,
  title,
  text,
  cta,
  href,
  reversed,
}: {
  imageLabel: string
  title: string
  text: string
  cta: string
  href: string
  reversed?: boolean
}) {
  return (
    <div className="mt-[26px] grid grid-cols-2 overflow-hidden rounded-3xl border border-line bg-card max-[860px]:grid-cols-1">
      <Placeholder
        label={imageLabel}
        className={cn(
          'min-h-[320px]',
          reversed && 'order-2 max-[860px]:order-none',
        )}
      />
      <div className="flex flex-col items-start justify-center gap-2.5 p-10">
        <h3 className="text-[30px] font-bold">{title}</h3>
        <p className="mb-2 text-[15px] leading-normal text-sub">{text}</p>
        <Link
          href={href}
          className="inline-block rounded-[14px] bg-brown px-[26px] py-3.5 text-[14px] font-bold text-highlight shadow-[0_6px_14px_rgba(58,42,6,0.25)]"
        >
          {cta}
        </Link>
      </div>
    </div>
  )
}

export function StoresAndFood() {
  return (
    <>
      <SectionHeading
        title="Lojas e gastronomia"
        subtitle="As melhores tendências e sabores, em um só lugar."
      />
      <EditorialCard
        imageLabel="Imagem · Lojas · 700 × 320"
        title="Lojas"
        text="As melhores tendências, você só encontra aqui, no Capim Dourado Shopping."
        cta="Confira →"
        href="/lojas"
      />
      <EditorialCard
        imageLabel="Imagem · Gastronomia · 700 × 320"
        title="Gastronomia"
        text="Restaurantes, fast foods, cafés e sorveterias para toda a família."
        cta="Ver opções →"
        href="/gastronomia"
        reversed
      />
    </>
  )
}

export function CinemaPosters() {
  return (
    <>
      <SectionHeading
        title="Em cartaz no cinema"
        subtitle="Salas e horários da semana."
      />
      <div className="grid grid-cols-5 gap-4 max-[860px]:grid-cols-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Link key={n} href="/cinema">
            <Placeholder label="Pôster" className="aspect-[2/3] rounded-2xl" />
            <div className="mt-2 text-[13px] font-bold">[Filme {n}]</div>
          </Link>
        ))}
      </div>
    </>
  )
}

const DISCOVER = [
  {
    title: 'Novidades',
    caption: 'Acompanhe o que acontece no shopping.',
    href: '/novidades',
  },
  {
    title: 'Serviços',
    caption: 'Cadeira de rodas, carrinho, achados e perdidos.',
    href: '/servicos',
  },
  {
    title: 'Eventos',
    caption: 'Programação para toda a família.',
    href: '/eventos',
  },
  {
    title: 'Trabalhe conosco',
    caption: 'Venha fazer parte do time.',
    href: '/trabalhe-conosco',
  },
]

export function DiscoverMore() {
  return (
    <>
      <SectionHeading
        title="Descubra mais"
        subtitle="Novidades, serviços e oportunidades."
      />
      <div className="grid grid-cols-4 gap-4 max-[860px]:grid-cols-2">
        {DISCOVER.map((tile) => (
          <Link key={tile.title} href={tile.href}>
            <Placeholder
              label="Imagem · 480 × 600"
              className="aspect-[4/5] rounded-[20px]"
            />
            <b className="mt-2.5 block text-[16px]">{tile.title}</b>
            <span className="text-[13px] text-sub">{tile.caption}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
