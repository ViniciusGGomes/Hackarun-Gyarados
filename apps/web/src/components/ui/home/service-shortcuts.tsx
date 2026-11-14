import Link from 'next/link'

const SHORTCUTS = [
  {
    icon: '♿',
    title: 'Cadeira de rodas',
    caption: 'Reserve e retire no SAC',
    href: '/servicos/cadeiras-de-rodas/solicitar',
  },
  {
    icon: '🛒',
    title: 'Carrinho de bebê',
    caption: 'Reserve o horário',
    href: '/servicos/carrinhos-de-bebe/solicitar',
  },
  {
    icon: '🔍',
    title: 'Achados e perdidos',
    caption: 'Registre o que perdeu',
    href: '/servicos/achados-e-perdidos/solicitar',
  },
  {
    icon: '📋',
    title: 'Acompanhar',
    caption: 'Use seu protocolo',
    href: '/acompanhar',
  },
]

export function ServiceShortcuts() {
  return (
    <div className="relative -mt-[52px] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
      {SHORTCUTS.map((item) => (
        <Link
          key={item.title}
          href={item.href}
          className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-[18px] shadow-[0_12px_28px_rgba(42,31,5,0.16)] transition duration-150 hover:-translate-y-[3px] hover:border-g500"
        >
          <div className="bg-gold grid size-11 flex-none place-items-center rounded-xl text-[21px]">
            {item.icon}
          </div>
          <div>
            <b className="block text-[15px]">{item.title}</b>
            <span className="text-[12px] text-sub">{item.caption}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
