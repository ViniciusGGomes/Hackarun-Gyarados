/**
 * Newsletter da Home.
 * TODO(etapa 1b): ligar ao backend. Não há endpoint de newsletter no contrato
 * OpenAPI; ele precisa ser criado (spec + OpenAPI + API) antes de o envio funcionar.
 */
export function Newsletter() {
  return (
    <section className="bg-gold mt-[60px] px-[6%] py-11 text-ink">
      <div className="mx-auto grid max-w-[1160px] grid-cols-2 items-center gap-[30px] max-[860px]:grid-cols-1">
        <div>
          <h2 className="mb-1.5 text-[30px] font-bold">Newsletter</h2>
          <p className="text-[15px]">
            Cadastre-se e fique por dentro de tudo o que acontece no Capim
            Dourado Shopping.
          </p>
        </div>
        <div>
          <div className="flex flex-wrap gap-2.5">
            <div className="min-w-[200px] flex-1 rounded-xl bg-card p-3.5 text-[14px] text-sub">
              Seu e-mail
            </div>
            <span className="inline-block rounded-[14px] bg-brown px-[26px] py-3.5 text-[14px] font-bold text-highlight shadow-[0_6px_14px_rgba(58,42,6,0.25)]">
              Enviar
            </span>
          </div>
          <small className="mt-2 block text-[11px]">
            Ao prosseguir, declaro estar ciente de que meus dados pessoais serão
            tratados conforme a Política de Privacidade.
          </small>
        </div>
      </div>
    </section>
  )
}
