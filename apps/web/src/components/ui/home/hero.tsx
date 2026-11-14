import Link from 'next/link'

/**
 * Banner da Home. A imagem do carrossel é um placeholder (como no Figma) e
 * os indicadores são decorativos até existir conteúdo de banner.
 */
export function Hero() {
  return (
    <section className="bg-placeholder relative grid h-[500px] place-items-center overflow-hidden text-center text-[12px] font-bold text-brown max-[860px]:h-[560px]">
      <span className="rounded-full bg-white/80 px-3 py-1.5">
        Espaço para imagem do banner · 1440 × 500 px (carrossel)
      </span>

      <div className="absolute bottom-[90px] left-[6%] max-w-[520px] text-left text-ink max-[860px]:right-[6%] max-[860px]:bottom-[110px]">
        <span className="inline-block rounded-full bg-brown px-3 py-[5px] text-[12px] font-bold text-highlight">
          Destaque da semana
        </span>
        <h1 className="mt-2 mb-3.5 text-[46px] leading-[1.08] font-bold max-[860px]:text-[32px]">
          [Título da campanha do shopping]
        </h1>
        <p className="mb-5 text-[16px]">
          [Subtítulo curto sobre evento, promoção ou novidade]
        </p>
        <Link
          href="/servicos"
          className="inline-block rounded-[14px] bg-brown px-[26px] py-3.5 text-[14px] font-bold text-highlight shadow-[0_6px_14px_rgba(58,42,6,0.25)]"
        >
          Saiba mais →
        </Link>
      </div>

      <div aria-hidden className="absolute right-[6%] bottom-[70px] flex gap-2">
        <i className="size-2.5 rounded-full bg-brown" />
        <i className="size-2.5 rounded-full bg-brown/30" />
        <i className="size-2.5 rounded-full bg-brown/30" />
      </div>
    </section>
  )
}
