import Link from 'next/link'

/** Rodapé completo da Home. */
export function PublicFooter() {
  return (
    <footer className="bg-[#3a2a06] px-[6%] pt-11 pb-[30px] text-[#f6e9c0]">
      <div className="mx-auto grid max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-7 text-[13px] leading-[1.7]">
        <div>
          <h4 className="mb-2 text-[14px] font-bold text-highlight">
            Horário de funcionamento
          </h4>
          Segunda a sábado: [10h às 22h]
          <br />
          Domingo: [horário a confirmar]
        </div>
        <div>
          <h4 className="mb-2 text-[14px] font-bold text-highlight">
            Links úteis
          </h4>
          <Link href="/privacidade">Política de Privacidade</Link>
          <br />
          <Link href="/servicos/pet-friendly">Regulamento Pet Friendly</Link>
          <br />
          <Link href="/acompanhar">Acompanhar solicitação</Link>
        </div>
        <div>
          <h4 className="mb-2 text-[14px] font-bold text-highlight">
            Como chegar
          </h4>
          [Endereço do shopping]
          <br />
          Palmas, TO
        </div>
        <div>
          <h4 className="mb-2 text-[14px] font-bold text-highlight">SAC</h4>
          (63) 3219-4616
          <br />
          Telefone e WhatsApp
          <br />
          [e-mail do SAC]
        </div>
      </div>
      <div className="mx-auto mt-[26px] max-w-[1160px] text-[11px] opacity-70">
        © Capim Dourado Shopping · Valores entre colchetes são exemplos a
        confirmar
      </div>
    </footer>
  )
}

/** Rodapé simples da página de Serviços. */
export function PublicFooterSimple() {
  return (
    <footer className="bg-[#4a4a4a] p-[18px] text-center text-[12px] text-white">
      Capim Dourado Shopping
    </footer>
  )
}
