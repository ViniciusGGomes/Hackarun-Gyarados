# Requisitos funcionais e regras de negócio

Este documento consolida os requisitos fornecidos para o Capim Dourado Serviços. Os códigos RF01–RF32 devem ser preservados para rastreabilidade.

## Atores

- **Visitante:** sem login.
- **Atendente:** equipe de atendimento/SAC.
- **Gestor:** responsável pela administração.
- **Sistema:** ações automáticas.

## Premissas iniciais

As seguintes configurações são premissas iniciais e podem ser alteradas pelo Gestor:

| Parâmetro | Valor inicial |
|---|---:|
| Equipamentos | Cadeira de rodas e carrinho de bebê (confirmar carrinho) |
| Bloco de reserva | 30 minutos |
| Duração do empréstimo | 2 horas |
| Tolerância para retirada | 15 minutos |
| Antecedência máxima | 7 dias |
| Reservas ativas por telefone | 1 por tipo de equipamento |
| Documento na retirada | Não exigido |

O DBML/Prisma também registra valores assumidos que precisam de confirmação: armazenamento de item encontrado por 90 dias e retenção de dados pessoais por 180 dias.

## Estados por tipo

| Tipo | Fluxo principal | Outros estados |
|---|---|---|
| Reserva | Reservada → Retirada → Devolvida | Cancelada, Não compareceu |
| Objeto perdido | Registrado → Em busca → Possível correspondência → Pronto para retirada → Entregue | Encerrado sem localização, Cancelado |
| Mensagem SAC | Aberta → Em atendimento → Respondida → Encerrada | — |
| Item encontrado | Guardado → Entregue | Descartado, Encaminhado |

Os valores internos em inglês usados no banco/API estão descritos em `database.md` e `api.md`.

## RF01 — Listar serviços

- **Ator:** Visitante.
- Exibir cards dos serviços ativos, com nome, descrição curta, ícone, tipo e estado ativo.
- Serviços interativos (cadeira de rodas, carrinho, achados e perdidos e SAC) levam ao formulário.
- Serviços informativos (ex.: Correios, Detran, Wi-Fi) exibem apenas informações.
- Prioridade: alta.

## RF02 — Consultar detalhes de um serviço

- **Ator:** Visitante.
- Exibir descrição, funcionamento, horário, local de retirada e contato do SAC.
- Avisar quando estiver fora do expediente.
- Exibir botão “Solicitar” somente para serviço interativo.
- Manter telefone do SAC visível como alternativa.
- Prioridade: alta.

## RF03 — Consultar horários disponíveis

- **Ator:** Visitante.
- Listar blocos livres de cadeira de rodas ou carrinho para uma data.
- Exibir somente horários dentro do expediente, ainda não passados e dentro da antecedência máxima.
- Disponibilidade = unidades ativas menos reservas sobrepostas com status Reservada ou Retirada.
- Se não houver horário livre, registrar demanda não atendida com tipo, data e hora da consulta.
- Prioridade: alta.

## RF04 — Reservar equipamento

- **Ator:** Visitante.
- Permitir reserva agendada ou opção “Preciso agora”.
- Dados: tipo, data, início, nome, telefone, e-mail opcional, local atual opcional, destinatário (próprio/acompanhante, somente cadeira), tamanho (adulto/infantil, somente cadeira), observações opcionais e consentimento.
- Nome, telefone e consentimento são obrigatórios.
- Revalidar disponibilidade no envio dentro de transação para impedir dupla reserva.
- “Preciso agora” usa o bloco atual, se houver unidade.
- Respeitar limite de reservas ativas por telefone e tipo.
- Não perguntar motivo, deficiência ou condição de saúde.
- Gerar protocolo imprevisível.
- Estado inicial: Reservada.
- Prioridade: alta.

## RF05 — Registrar objeto perdido

- **Ator:** Visitante.
- Dados: nome, telefone, e-mail opcional, categoria, descrição, detalhe de identificação opcional, local aproximado ou “não sei”, data/período e foto opcional, além do consentimento.
- Categoria, descrição, local ou “não sei”, data e consentimento são obrigatórios.
- Detalhe de identificação é interno e serve para validar o proprietário.
- Gerar protocolo imprevisível; estado inicial Registrado.
- Nunca exibir publicamente a descrição do objeto perdido.
- Prioridade: alta.

## RF06 — Enviar mensagem ao SAC

- **Ator:** Visitante.
- Assuntos: dúvida, reclamação, sugestão, elogio ou outro.
- Dados: mensagem, nome, telefone e/ou e-mail, serviço relacionado opcional, protocolo relacionado opcional e consentimento.
- Mensagem, nome, consentimento e ao menos um contato são obrigatórios.
- Exibir aviso: emergências devem ser tratadas com a segurança ou por telefone, não pelo formulário.
- Gerar protocolo; estado inicial Aberta.
- Também pode ser usado para pedido de exclusão de dados.
- Prioridade: alta.

## RF07 — Acompanhar solicitação por protocolo

- **Ator:** Visitante.
- Consultar com protocolo + telefone cadastrado.
- Exibir estado, histórico e mensagens públicas.
- Limitar tentativas por origem.
- Não expor dados pessoais de terceiros nem descrição de itens encontrados.
- Prioridade: alta.

## RF08 — Cancelar solicitação

- **Ator:** Visitante.
- Exigir protocolo e telefone; motivo opcional.
- Reserva só pode ser cancelada antes da retirada.
- Objeto perdido pode ser cancelado antes da entrega.
- Registrar mudança no histórico.
- Cancelar reserva libera a unidade imediatamente.
- Prioridade: média.

## RF09 — Responder mensagem da equipe

- **Ator:** Visitante.
- Exigir protocolo, telefone e texto.
- Permitido somente enquanto a solicitação não estiver encerrada.
- Registrar mensagem no histórico e sinalizar nova resposta para a equipe.
- Aplicar as mesmas validações de protocolo/telefone do acompanhamento.
- Prioridade: média.

## RF10 — Registrar consentimento de privacidade

- **Ator:** Visitante/Sistema.
- Exibir aviso e registrar aceite antes do envio de qualquer formulário público.
- Sem aceite, não enviar.
- Coletar somente os dados necessários.
- Usar contato somente para atender à solicitação.
- Guardar versão do aviso, data/hora, finalidade e solicitação.
- Prioridade: alta.

## RF11 — Autenticar usuário administrativo

- **Atores:** Atendente e Gestor.
- Login/logout com e-mail e senha.
- Armazenar senha com hash.
- Sessão expira por inatividade.
- Bloqueio temporário após várias tentativas inválidas.
- Usuário inativo não pode entrar.
- Prioridade: alta.

## RF12 — Controlar acesso por perfil

- **Ator:** Sistema.
- Atendente: solicitações, agenda, achados e perdidos e mensagens.
- Gestor: tudo do Atendente + configurações, usuários e indicadores.
- Rotas administrativas rejeitam acesso sem autenticação ou permissão.
- Prioridade: alta.

## RF13 — Listar e filtrar solicitações

- **Atores:** Atendente e Gestor.
- Fila geral de solicitações.
- Filtrar por serviço, estado e período.
- Buscar por protocolo, nome ou telefone.
- Destacar reservas do dia.
- Sinalizar respostas novas do visitante.
- Paginar resultados.
- Prioridade: alta.

## RF14 — Consultar detalhe da solicitação

- **Atores:** Atendente e Gestor.
- Exibir dados específicos do tipo, contato, histórico e mensagens.
- Dados sensíveis e detalhes internos são restritos à equipe.
- Prioridade: alta.

## RF15 — Atualizar status da solicitação

- **Atores:** Atendente e Gestor.
- Permitir transições válidas conforme o tipo e o fluxo definido.
- Registrar estado anterior, novo estado, ator e data/hora no histórico.
- Exigir observação quando a regra do fluxo determinar.
- Estados finais só podem ser reabertos pelo Gestor, conforme OpenAPI.
- Prioridade: alta.

## RF16 — Enviar mensagem ao visitante

- **Atores:** Atendente e Gestor.
- Enviar mensagem vinculada à solicitação.
- Registrar autor e data/hora.
- A mensagem deve ficar disponível no acompanhamento público, sem incluir conteúdo interno.
- Prioridade: alta.

## RF17 — Consultar agenda de equipamentos

- **Atores:** Atendente e Gestor.
- Consultar reservas por data e equipamento.
- Visualizar horários, estado, visitante e informações necessárias à operação.
- Prioridade: alta.

## RF18 — Registrar retirada e devolução

- **Atores:** Atendente e Gestor.
- Registrar retirada e devolução de equipamento.
- Atualizar estados e horários efetivos.
- A configuração determina se documento é exigido; premissa inicial: não.
- Registrar observações operacionais quando aplicável.
- Prioridade: alta.

## RF19 — Marcar não comparecimento automaticamente

- **Ator:** Sistema.
- Após o prazo de tolerância, marcar reserva não retirada como `no_show`.
- Liberar disponibilidade conforme regra operacional.
- Executar como job agendado, sem endpoint público.
- Prioridade: alta.

## RF20 — Cadastrar item encontrado

- **Atores:** Atendente e Gestor.
- Registrar categoria, descrição interna, local, data/hora, local de armazenamento, foto opcional e responsável pelo cadastro.
- Estado inicial: Guardado.
- Definir prazo de armazenamento.
- Prioridade: alta.

## RF21 — Sugerir correspondências

- **Atores:** Atendente e Gestor.
- Comparar registros de objetos perdidos com itens encontrados.
- Sugerir possíveis correspondências usando dados como categoria, data e local.
- Sugestão não confirma propriedade; a equipe deve validar.
- Não revelar detalhes do item encontrado ao visitante antes da validação.
- Prioridade: alta.

## RF22 — Confirmar entrega de item encontrado

- **Atores:** Atendente e Gestor.
- Registrar validação de identificação e entrega do item ao proprietário.
- Atualizar item encontrado e solicitação relacionada.
- Registrar data/hora e observações.
- Prioridade: alta.

## RF23 — Encerrar item encontrado

- **Atores:** Atendente e Gestor, conforme política operacional.
- Permitir encerrar como descartado ou encaminhado após o prazo/política definida.
- Registrar motivo, responsável e data.
- Prioridade: média.

## RF24 — Gerenciar equipamentos

- **Ator:** Gestor.
- Cadastrar/editar/inativar equipamentos, tipo, identificação, quantidade e local de retirada.
- Equipamentos inativos não entram na disponibilidade.
- Não excluir registros operacionais; preferir inativação.
- Prioridade: média.

## RF25 — Configurar regras e horários

- **Ator:** Gestor.
- Configurar expediente, blocos, duração, tolerância, antecedência, limite por telefone, exigência de documento e parâmetros de retenção.
- Mudanças devem afetar cálculos futuros sem corromper reservas existentes.
- Prioridade: média.

## RF26 — Gerenciar locais

- **Ator:** Gestor.
- Cadastrar/editar/inativar locais usados em formulários e operações.
- Locais inativos não devem aparecer nas opções públicas.
- Prioridade: média.

## RF27 — Gerenciar usuários

- **Ator:** Gestor.
- Criar, editar, ativar/inativar usuários e atribuir perfil Atendente/Gestor.
- Não permitir que a aplicação fique sem ao menos um Gestor ativo.
- Prioridade: média.

## RF28 — Indicadores de equipamentos

- **Ator:** Gestor.
- Exibir utilização, reservas, não comparecimentos e demandas não atendidas por período/tipo.
- Prioridade: média.

## RF29 — Indicadores de achados e perdidos

- **Ator:** Gestor.
- Exibir itens cadastrados, entregues, descartados/encaminhados e tempo de armazenamento/entrega por período.
- Prioridade: média.

## RF30 — Indicadores de atendimento

- **Ator:** Gestor.
- Exibir volume por serviço, estados, tempo até primeira resposta e solicitações concluídas por período.
- Prioridade: média.

## RF31 — Anonimizar dados pessoais

- **Ator:** Sistema.
- Anonimizar dados pessoais após o prazo de retenção definido.
- Preservar dados agregados e histórico operacional necessário sem manter identificadores pessoais.
- Executar como job, registrar execução e quantidade afetada.
- O prazo inicial de 180 dias consta como premissa do modelo e precisa ser confirmado.
- Prioridade: alta.

## RF32 — Notificar por e-mail

- **Ator:** Sistema.
- Enviar notificações previstas, como confirmação de reserva, mudança de estado e nova mensagem.
- Registrar tentativas, sucesso/falha e erros.
- Não bloquear a operação principal por falha temporária no envio; tratar retentativas conforme implementação.
- Prioridade: média.

## Regras transversais

- Protocolo imprevisível no formato `CAP-XXXX-XXXX`.
- Visitante consulta solicitação com protocolo e telefone.
- Formulários públicos exigem consentimento da versão vigente do aviso.
- Datas trafegadas na API em ISO 8601/UTC; regras de horário do shopping em `America/Araguaina`.
- Paginação da API: `page` a partir de 1 e `pageSize` máximo 100; envelope `{ data, meta }` quando definido no contrato.
- Erros seguem `ErrorResponse` com código estável, conforme OpenAPI.
- A descrição dos itens encontrados nunca é exposta publicamente.
- Processos RF19, RF31 e RF32 são jobs; cálculo de sugestões RF21 é consultado por endpoint.
"""
