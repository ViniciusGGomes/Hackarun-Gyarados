# Equipment Operations Specification

**Status**: Approved
**Approved**: 2026-11-14 - user: "aceito as recomendações"

## Problem Statement

A equipe ainda não consegue operar as reservas: as três rotas administrativas do contrato
(`GET /admin/agenda`, `POST /admin/reservations/{id}/pickup` e `.../return`) existem só como stubs que
respondem `{}` dentro do módulo `reservations`, e nada marca `no_show`. Esta feature entrega o RF17
(agenda), o RF18 (retirada e devolução) e o comportamento do RF19 (não comparecimento automático),
mantendo status, histórico e disponibilidade coerentes mesmo com operações simultâneas. O job do RF19
é **especificado aqui e implementado depois**; a criação e o cancelamento públicos de reservas (feature
`reservations-and-availability`) e o fluxo geral de solicitações (RF13-RF15) ficam fora.

## Goals

- [ ] `GET /api/v1/admin/agenda` devolve, para uma data e um tipo, os blocos do dia com unidades totais e livres e as reservas de cada bloco, com os sinais de retirada e devolução atrasadas.
- [ ] `POST /api/v1/admin/reservations/{id}/pickup` e `.../return` mudam o status só a partir do status e da janela corretos, gravam o horário real **do servidor** e o responsável, e devolvem o detalhe da reserva.
- [ ] A rotina de não comparecimento (comportamento) marca `no_show` exatamente as reservas `reserved` com a tolerância vencida, uma vez, sem conflitar com retirada, cancelamento ou outra execução.
- [ ] Toda mudança de status grava o histórico (anterior, novo, ator, horário) na mesma transação.
- [ ] Todas as rotas exigem token válido e a permissão CASL do perfil; o backend decide.

## Current State

Verificado no código da branch `backend`, no Prisma e nos documentos:

| Área | Situação encontrada | Consequência |
| --- | --- | --- |
| `modules/reservations/reservations.routes.ts` | Contém, além das rotas públicas, os stubs `GET /admin/agenda`, `POST /admin/reservations/:id/pickup` e `/return` com `authorize('read'\|'pickup'\|'return', 'Reservation')` e `async () => ({})` | A autorização já está ligada; falta o comportamento. Onde ficam as rotas: Q1. |
| `packages/auth` (CASL) | `attendant` e `manager` já têm `read`, `pickup` e `return` em `Reservation` (função `grantAttendance`); o `manager` herda tudo | Nenhuma ability nova; matriz abaixo. |
| `http/middlewares/auth.ts` e `authorize.ts` | JWT com `sid` validado no banco; `authorize(action, subject)` responde `401` sem token e `403` sem permissão | Reutilizar como está. |
| Prisma `Reservation` | `startAt`, `endAt`, `pickupDeadline`, `pickedUpAt?`, `returnedAt?`, `documentChecked?`, `pickupNotes?` (300), `returnNotes?` (300), `forWhom`, `size`, `strollerKind`, `currentLocationId`, `notes` | Todos os dados de retirada e devolução já têm coluna. **Não há** `pickedUpById` nem `returnedById`: o responsável fica no histórico (próxima linha). |
| Prisma `RequestHistory` | `fromStatus?`, `toStatus`, `actorType` (`staff`/`visitor`/`system`), `actorUserId?`, `internalNote?` (500), `createdAt` | Atende "quem, quando, de/para e origem" (staff x system). Sem mudança de schema. |
| Prisma `Request` | `status`, `completedAt?`, `visitorName`, `visitorPhone?`, `visitorEmail?`, `updatedAt` | `completedAt` já é preenchido no cancelamento (reservas). Ver Q de `completedAt` nas Assumptions. |
| Prisma `ReservationSettings` | `pickupToleranceMinutes` (15), `requireDocumentOnPickup` (false), `loanDurationMinutes`, `slotMinutes` | A tolerância já foi aplicada na criação: `pickupDeadline` está gravado por reserva (RF25: mudanças valem para cálculos futuros). A retirada usa o `pickupDeadline` gravado, não a configuração atual. `requireDocumentOnPickup` é lido na retirada. |
| Prisma `JobLog` | `jobName`, `status` (`success`/`failed`), `affectedCount`, `error?`, `startedAt`, `finishedAt?` | Pode registrar as execuções do job de não comparecimento. |
| `apps/api/src/jobs/` | Pasta vazia; sem agendador (`node-cron` etc.) nas dependências; `server.ts` não inicia nada periódico | Decisão do mecanismo: Q5. |
| `reservations.slots.ts` e `reservations.repository.ts` | Lógica pura de blocos e `freeUnits` (sem banco); `buildBlocks` **remove blocos passados e além da antecedência** (regra do fluxo público) e o cancelamento usa `updateMany` condicional em `status = 'reserved'` | Reutilizar `freeUnits`/fuso/`localDateToUtc`; a agenda precisa listar o dia inteiro, então não pode usar `buildBlocks` como está (ver A4). |
| `modules/requests` | `GET /admin/requests/:id` (RF14) e `PATCH /admin/requests/:id/status` são stubs | O `RequestDetail` do contrato é o corpo de resposta da retirada/devolução; quem entrega o `GET`: Q2. |
| `docs/conventions.md`, `docs/specs/` | Citados pelo `AGENTS.MD`; **não existem** | Pendência de documentação (I13); seguem-se as convenções observadas no código. |

## Out of Scope

| Feature | Reason |
| --- | --- |
| Criação, disponibilidade pública e cancelamento de reservas | Feature `reservations-and-availability` (concluída). |
| Fila e filtros de solicitações, atualização geral de status, mensagens (RF13, RF15, RF16) | Feature de solicitações. Em especial, impedir `PATCH /admin/requests/{id}/status` de pular a janela de retirada é desta outra feature (I5). |
| `GET /admin/requests/{id}` para objetos perdidos e SAC | Outros tipos; o detalhe de reserva depende de Q2. |
| Implementar o job de não comparecimento | Pedido explícito: aqui só o comportamento é especificado. |
| Notificação por e-mail de mudança de estado (RF32) | Job/notificação próprios. |
| Anonimização (RF31) | Feature própria; esta só preenche `completedAt`, que ela usa. |
| Multas, cobranças, penalidades por atraso | Não existem nos requisitos. |
| `/admin/equipment`, `/admin/settings/reservations` (RF24, RF25) | Features de configuração; esta só lê. |
| Alterar Prisma, criar migrations, alterar OpenAPI, escrever código | Pedido explícito desta etapa. |
| Frontend | Contrato apenas. |

---

## Assumptions & Open Questions

Q1-Q5 eram decisões de produto/arquitetura e foram respondidas pelo usuário (recomendações aceitas); as demais linhas eram defaults e foram confirmadas na mesma resposta.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Q1 Onde ficam agenda, retirada e devolução | Módulo próprio `apps/api/src/modules/equipment-operations/` (routes, controller, service, repository, schemas), com os três stubs saindo de `reservations.routes.ts`; o módulo importa a lógica pura de `reservations.slots` (`freeUnits`, fuso, `localDateToUtc`) e não a duplica; o job fica em `src/jobs/` e usa o service do módulo | Separa operação administrativa do fluxo público; a lógica de horário já é pura e compartilhável. Foge de `docs/backend.md`, que põe retirada/devolução em `reservations` e a agenda em `equipment` | y - user: "aceito as recomendações" |
| Q2 Detalhe da reserva | Esta feature entrega o `RequestDetail` **de reservas** como resposta de retirada e devolução (mapper no módulo novo) e **não** registra `GET /admin/requests/{id}`, que fica com a feature de solicitações (RF14), reaproveitando o mapper | O OpenAPI não tem endpoint de detalhe só de reservas; `GET /admin/requests/{id}` serve os três tipos e é do RF14 | y - user: "aceito as recomendações" |
| Q3 Retirada fora da janela ou em reserva já tratada | `409 INVALID_STATUS_TRANSITION` para todos os casos (status diferente de `reserved`, antes do `startAt`, depois do `pickupDeadline`), com mensagem distinta por motivo; nenhum código novo | O `ErrorResponse.code` do OpenAPI não tem código de janela; criar um exigiria alterar o contrato | y - user: "aceito as recomendações" |
| Q4 Conteúdo da agenda | Dia inteiro (blocos passados incluídos, sem limite de antecedência) e **todas** as reservas do bloco, de qualquer status, em ordem de criação; `freeUnits` usa a mesma regra do fluxo público (só `reserved`/`picked_up` ocupam) | A equipe precisa ver retiradas atrasadas e o desfecho do dia; o contrato não restringe status | y - user: "aceito as recomendações" |
| Q5 Agendamento do job | `setInterval` de 60 s dentro do processo da API (sem dependência nova), executando a função do service; registra uma linha em `job_logs` só quando afetou reservas ou falhou | Instalação mais simples (uso local); lag máximo ≈ 1 min; evita 1.440 linhas/dia vazias | y - user: "aceito as recomendações" |
| `id` das rotas | `{id}` e `reservations[].id` da agenda são o `Request.id` (o mesmo de `RequestDetail.id`), não o `Reservation.id` | A agenda leva à retirada e ao detalhe; o OpenAPI usa o mesmo `IdPath` e `RequestDetail.id` é o id da solicitação | y - user: "aceito as recomendações" |
| Filtros da agenda | Só `date` e `equipmentType`, ambos obrigatórios, como no OpenAPI; sem filtro de status, local ou período | "Não adicione filtros sem justificativa": o contrato não os prevê (I1) | y - user: "aceito as recomendações" |
| Dia e fuso | `date` é o dia local em `America/Araguaina`; blocos vêm do expediente do dia e de `slotMinutes`; o último bloco é o último reservável pelo fluxo público (`closeTime` − empréstimo) | Mesma regra do fluxo público | y - user: "aceito as recomendações" |
| Reservas fora dos blocos atuais | Reserva do dia cujo `startAt` não coincide com nenhum bloco atual (expediente alterado depois) aparece em um bloco próprio com o `startAt` dela; nada é escondido | RF25: mudanças de regra não corrompem reservas existentes | y - user: "aceito as recomendações" |
| Sinais de atraso | `pickupOverdue` = status `reserved` e agora > `pickupDeadline`; `returnOverdue` = status `picked_up` e agora > `endAt`; falsos nos demais status | OpenAPI "Sinaliza retirada atrasada e devolução atrasada" | y - user: "aceito as recomendações" |
| Janela da retirada | `startAt ≤ agora ≤ pickupDeadline` (extremos incluídos); o `agora` é o relógio do servidor | OpenAPI: "entre o início do bloco e a tolerância"; modo `now` já grava `pickupDeadline` = criação + tolerância | y - user: "aceito as recomendações" |
| Horário efetivo | `pickedUpAt` e `returnedAt` = relógio do servidor; qualquer horário enviado no corpo é descartado | Pedido: o cliente não define o horário | y (pedido) |
| Documento | Se `requireDocumentOnPickup` for `true` e `documentChecked` não for `true`: `400 VALIDATION_ERROR`; sempre grava o `documentChecked` recebido (padrão: `null` quando não enviado) | OpenAPI: "`documentChecked` deve ser true"; não há código próprio | y - user: "aceito as recomendações" |
| Observações | `notes` da retirada → `Reservation.pickupNotes`; `conditionNotes` da devolução → `Reservation.returnNotes`; ambos ≤ 300 | OpenAPI e colunas Prisma | y (documentado) |
| Histórico | Retirada: `reserved` → `picked_up`; devolução: `picked_up` → `returned`; ambos com `actorType = staff` e `actorUserId` = usuário do token; job: `reserved` → `no_show` com `actorType = system`, sem usuário; `internalNote` vazio | Modelo atual; RF15/RF14 | y - user: "aceito as recomendações" |
| `completedAt` | Preenchido com o horário da operação ao devolver (`returned`) e ao marcar `no_show`; a retirada não preenche | Estados finais; o cancelamento já faz o mesmo; RF31 usa `completedAt` | y - user: "aceito as recomendações" |
| Atraso na devolução | Permitida a qualquer momento depois da retirada; só `returnOverdue` na agenda e a diferença entre `returnedAt` e `endAt`; sem multa nem penalidade | Requisitos não preveem nada além disso | y (documentado) |
| Elegibilidade do job | `status = 'reserved'` e `pickupDeadline < agora` (estritamente), a mesma fronteira da janela da retirada | Em `agora = pickupDeadline` a retirada ainda vale e o job não marca | y - user: "aceito as recomendações" |
| Corpo vazio | O corpo de retirada e devolução é opcional; sem corpo, os campos opcionais ficam vazios; campos desconhecidos são ignorados | OpenAPI não marca `requestBody` como obrigatório | y - user: "aceito as recomendações" |
| `{id}` inválido ou de outro tipo | `id` que não é uuid → `400 VALIDATION_ERROR`; id inexistente ou que não é de reserva → `404 NOT_FOUND`; `date` ou `equipmentType` ausente/inválido na agenda → `400 VALIDATION_ERROR` | OpenAPI só lista `404`; `400` por consistência com as rotas públicas | y - user: "aceito as recomendações" |
| Anonimizada | Reserva com `anonymizedAt` preenchido não pode ser retirada nem devolvida e responde `404` | Não há mais dados de contato; RF31 | y - user: "aceito as recomendações" |
| Rate limit | Rotas administrativas sem limite de requisições | Autenticadas; padrão das demais rotas admin | y - user: "aceito as recomendações" |
| Logs | Sem corpo, nome, telefone ou e-mail nos logs; o job registra só contagens | `AGENTS.MD` | y (documentado) |
| Estratégia de teste | Integração contra o PostgreSQL de teste (`hackathon_test`) para rotas, concorrência e job; lógica pura (atraso, janela) em unitários; arquivos de teste rodam um por vez (já configurado) | Padrão de `reservations` e `lost-item-registration` | y - user: "aceito as recomendações" |

**Open questions:** none - Q1 a Q5 resolvidas (recomendações aceitas) e as demais premissas confirmadas.

---

## Endpoints (contracts)

Base path `/api/v1`. Erros em `ErrorResponse` `{ statusCode, code, message }` (AD-002). Todas exigem `Authorization: Bearer <JWT>`.

| Method | Path | Ability CASL | Request | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/admin/agenda?date=YYYY-MM-DD&equipmentType=wheelchair\|stroller` | `read` `Reservation` | `date`, `equipmentType` obrigatórios | `200 Agenda` | `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 FORBIDDEN` |
| POST | `/admin/reservations/{id}/pickup` | `pickup` `Reservation` | `{ documentChecked?, notes? (≤ 300) }` (corpo opcional) | `200 RequestDetail` (`status` `picked_up`) | `400 VALIDATION_ERROR`, `401`, `403`, `404 NOT_FOUND`, `409 INVALID_STATUS_TRANSITION` |
| POST | `/admin/reservations/{id}/return` | `return` `Reservation` | `{ conditionNotes? (≤ 300) }` (corpo opcional) | `200 RequestDetail` (`status` `returned`) | `400 VALIDATION_ERROR`, `401`, `403`, `404`, `409 INVALID_STATUS_TRANSITION` |

O OpenAPI lista só `401` na agenda e `401/404/409` na retirada e devolução; os `400` e `403` acima vêm do comportamento padrão do projeto (I3). **Não há** endpoint de detalhe só de reservas e **não há** endpoint do job (RF19 é tarefa agendada).

`Agenda`: `{ date, equipmentType, slots: [{ start, end, totalUnits, freeUnits, reservations: [{ id, protocol, visitorName, status, pickupOverdue, returnOverdue }] }] }`.

`RequestDetail` (reserva): `id`, `protocol`, `type` `reservation`, `status`, `createdAt`, `updatedAt`, `visitor { name, phone, email }`, `reservation { equipmentType, startAt, endAt, pickedUpAt, returnedAt, forWhom, size, strollerKind, currentLocation, notes, pickupOverdue, returnOverdue }`, `lostReport` e `sacMessage` nulos, `history [{ id, fromStatus, toStatus, actor { type, userId, name }, internalNote, createdAt }]`, `messages`.

---

## Business Rules

| # | Regra |
| --- | --- |
| BR1 | A agenda lista as reservas de um tipo de equipamento em um dia local, agrupadas por bloco e ordenadas por horário; `totalUnits` = soma de `quantity` dos equipamentos ativos do tipo; `freeUnits` segue a regra de disponibilidade das reservas (só `reserved` e `picked_up` ocupam). |
| BR2 | Retirada: só `reserved`, com `startAt ≤ agora ≤ pickupDeadline`; vira `picked_up` e grava `pickedUpAt` = agora, `documentChecked` e `pickupNotes`. |
| BR3 | Devolução: só `picked_up`; vira `returned` e grava `returnedAt` = agora, `returnNotes` e `completedAt`. |
| BR4 | `cancelled`, `returned` e `no_show` nunca são retirados; `reserved`, `cancelled`, `returned` e `no_show` nunca são devolvidos. |
| BR5 | A tolerância usada na retirada é a gravada em `pickupDeadline` na criação; mudar `pickupToleranceMinutes` depois só afeta reservas novas (RF25). |
| BR6 | O ator da operação é sempre o usuário do token; o cliente não envia ator nem horário. |
| BR7 | Toda mudança de status e sua linha de histórico acontecem na mesma transação, ou nenhuma delas. |
| BR8 | A devolução libera a unidade na hora; `no_show` também libera, porque só `reserved` e `picked_up` ocupam. |
| BR9 | O job marca `no_show` só `reserved` com `pickupDeadline < agora`; nunca `cancelled`, `picked_up` ou `returned`. |
| BR10 | Devolução tardia é permitida e sem consequência financeira (nada além de `returnOverdue` e do `returnedAt`). |

---

## Main and Alternative Flows

```
Atendente/Gestor                 API                                    Banco
  GET /admin/agenda ------------> 401/403 -> 400 -> blocos do dia + reservas -> 200 Agenda
  POST .../pickup --------------> 401/403 -> 400 -> 404 (não é reserva)
                                  UPDATE request SET status='picked_up'
                                    WHERE id=? AND status='reserved'
                                    AND start_at<=now AND pickup_deadline>=now   (1 linha = venceu)
                                  + reservation.picked_up_at, document_checked, pickup_notes
                                  + request_history(reserved->picked_up, staff, userId)
                                  -> 200 RequestDetail | 0 linhas: 409 INVALID_STATUS_TRANSITION
  POST .../return --------------> idem com status='picked_up' -> 'returned' + completed_at

Job (a cada execução)
  UPDATE request SET status='no_show', completed_at=now
    WHERE type='reservation' AND status='reserved' AND pickup_deadline < now  RETURNING id
  + request_history(reserved->no_show, system) para cada id retornado, na mesma transação
  + job_logs (se afetou ou falhou)
```

Fluxos alternativos: retirada antes do bloco ou depois da tolerância (`409`); reserva já retirada, devolvida, cancelada ou `no_show` (`409`); `id` desconhecido ou de outro tipo (`404`); documento exigido e não confirmado (`400`); falha no meio da transação (`500 INTERNAL_ERROR`, nada gravado).

---

## Permissions Matrix

| Operação | Ability | Sem token | `attendant` | `manager` |
| --- | --- | --- | --- | --- |
| Consultar agenda | `read` `Reservation` | 401 | sim | sim |
| Registrar retirada | `pickup` `Reservation` | 401 | sim | sim |
| Registrar devolução | `return` `Reservation` | 401 | sim | sim |
| Detalhe da reserva (resposta das operações) | as de retirada/devolução | 401 | sim | sim |
| Rotina de não comparecimento | nenhuma (sistema, sem endpoint) | - | - | - |

Nenhuma ability nova; o `manager` herda as do `attendant`. Um usuário autenticado sem a ability recebe `403`; o frontend não é mecanismo de segurança. O papel é lido do banco a cada requisição (feature `admin-authentication`).

---

## Validation Rules

- Zod nos schemas ligados à rota: `date` `YYYY-MM-DD` real, `equipmentType` ∈ `wheelchair|stroller`, `id` uuid, `documentChecked` boolean, `notes` e `conditionNotes` ≤ 300 (com `trim` e remoção de caracteres de controle, como em `lost-item-registration`).
- Regras que dependem do banco (existência, tipo, status, janela, `requireDocumentOnPickup`) ficam no service.
- Campos desconhecidos no corpo (inclusive `pickedUpAt`, `returnedAt`, `status`, `userId`) são descartados.

---

## Concurrency and Consistency

| Risco | Estratégia |
| --- | --- |
| Duas retiradas simultâneas da mesma reserva | `updateMany` condicional dentro de `prisma.$transaction` com `where { id, status: 'reserved', startAt ≤ agora, pickupDeadline ≥ agora }`; o Postgres serializa por linha e só uma atualiza 1 linha; a outra recebe `409` |
| Devolução duplicada | Mesmo mecanismo com `status: 'picked_up'` |
| Retirada x job de não comparecimento | O job usa o `where` `status='reserved' AND pickupDeadline < agora`; a retirada exige `pickupDeadline ≥ agora`. As faixas não se sobrepõem e as duas condicionais disputam a mesma linha: no máximo uma vence |
| Retirada x cancelamento público | O cancelamento já usa `updateMany` condicional em `reserved`; só uma transição vence |
| Duas execuções simultâneas do job | O `UPDATE ... WHERE status='reserved' ...` re-avalia o filtro depois do bloqueio da linha (READ COMMITTED): a segunda execução não encontra as linhas e afeta 0; nenhum histórico duplicado |
| Histórico fora de sincronia | A linha de histórico entra na mesma transação do `UPDATE`; só é criada quando o `UPDATE` afetou 1 linha |
| Quem perdeu a corrida | Relê a reserva e responde `404` (não existe) ou `409` (existe e não está no estado esperado) |

Sem `pg_advisory_xact_lock`: a disponibilidade não é decidida aqui (só diminui ao devolver ou marcar `no_show`), então a trava por tipo de equipamento do fluxo de criação não é necessária.

---

## Audit Requirements

- Cada retirada, devolução e `no_show` grava uma linha em `request_history`: `fromStatus`, `toStatus`, `createdAt` (horário), `actorType` e `actorUserId`.
- Origem: `staff` (com o usuário) nas operações administrativas e `system` (sem usuário) no job.
- O responsável também aparece no `RequestDetail.history[].actor`.
- Limitação do modelo: `Reservation` não guarda `pickedUpById`/`returnedById`; o responsável só existe no histórico. Suficiente para auditoria; sem proposta de mudança de schema.
- O nome do ator no histórico vem de `User.name`; usuário inativado depois continua aparecendo.

---

## No-Show Job Behavior (specified here, implemented later)

| Pergunta | Comportamento |
| --- | --- |
| Quando a reserva fica elegível | `status = 'reserved'` e `pickupDeadline < agora` |
| O que acontece | Status `no_show`, `completedAt` = agora, histórico `reserved → no_show` (`system`); a unidade volta a ficar livre |
| Reserva ainda dentro da tolerância | Não é tocada |
| Reserva `cancelled`, `picked_up`, `returned` ou já `no_show` | Não é tocada |
| Não reprocessar | O filtro `status='reserved'` já exclui o que foi marcado; a rotina é idempotente |
| Execuções simultâneas | Seguras pelo `UPDATE` condicional (acima) |
| Falha | Transação desfeita; `job_logs` com `status = 'failed'` e `error` curto (sem dados pessoais); próxima execução tenta de novo |
| Registro da execução | `job_logs` (`jobName` `mark-no-show`, `affectedCount`, `startedAt`, `finishedAt`) quando afetou reservas ou falhou (Q5) |
| Agendamento | Q5; sem endpoint público |

---

## User Stories

### P1: Consultar a agenda ⭐ MVP

**User Story**: As an attendant or manager, I want to see the reservations of a day and equipment so that I can prepare and run the counter.

**Why P1**: RF17.

**Acceptance Criteria** (cada linha é um padrão EARS):

1. WHEN an authenticated attendant or manager sends `GET /admin/agenda` with a valid `date` and `equipmentType` THEN the system SHALL return `200` with `date`, `equipmentType` and the `slots` of the day in ascending order of `start`. (EQP-01)
2. The system SHALL return, for each slot, `start`, `end`, `totalUnits`, `freeUnits` and the `reservations` that start in it, each with `id`, `protocol`, `visitorName`, `status`, `pickupOverdue` and `returnOverdue`. (EQP-01)
3. The system SHALL set `totalUnits` to the sum of `quantity` of the active equipment of the type and `freeUnits` to `totalUnits` minus the peak of simultaneous `reserved` and `picked_up` reservations in the loan window of the block, never below 0. (EQP-01)
4. The system SHALL list reservations of every status, so that `cancelled`, `returned` and `no_show` appear with their status and do not reduce `freeUnits` (Q4). (EQP-01)
5. WHEN the day is closed or has no opening-hour row THEN the system SHALL return `200` with `slots` empty. (EQP-02)
6. WHEN the date is in the past or beyond the maximum advance THEN the system SHALL return the slots of that day, with no advance limit. (EQP-02)
7. WHEN a reservation of the day starts at an instant that is not the start of a current block THEN the system SHALL list it in its own slot instead of hiding it. (EQP-02)
8. WHILE a reservation is `reserved` and the current time is after its `pickupDeadline` the system SHALL set `pickupOverdue` to true, and WHILE it is `picked_up` and the current time is after its `endAt` the system SHALL set `returnOverdue` to true; in every other case both SHALL be false. (EQP-03)
9. The system SHALL NOT include phone, e-mail, notes or any other contact data in the agenda; only `visitorName` identifies the visitor. (EQP-03)
10. IF `date` is missing or not a real calendar date, or `equipmentType` is missing or not `wheelchair`/`stroller` THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (EQP-02)

**Independent Test**: Com 3 reservas em status diferentes no mesmo dia, a agenda lista as 3 nos blocos certos, com `freeUnits` contando só as `reserved`/`picked_up`.

---

### P1: Registrar a retirada ⭐ MVP

**User Story**: As an attendant, I want to record that the visitor picked up the equipment so that the unit counts as in use and the audit trail is kept.

**Why P1**: RF18.

**Acceptance Criteria**:

1. WHEN an authenticated attendant or manager sends `POST /admin/reservations/{id}/pickup` for a `reserved` reservation, with `startAt ≤ now ≤ pickupDeadline` THEN the system SHALL return `200` with the `RequestDetail` whose `status` is `picked_up` and `reservation.pickedUpAt` is the server time. (EQP-04)
2. The system SHALL set the request status to `picked_up`, `pickedUpAt` to the server time, `documentChecked` and `pickupNotes` to the values sent, and add a history row `reserved` → `picked_up` with actor `staff` and the id of the authenticated user, in one transaction. (EQP-04)
3. The system SHALL ignore any time, status or user sent in the body; the effective time is always the server clock. (EQP-07)
4. IF the reservation status is `picked_up`, `returned`, `cancelled` or `no_show` THEN the system SHALL return `409` with code `INVALID_STATUS_TRANSITION` and SHALL NOT change anything (Q3). (EQP-05)
5. IF the current time is before `startAt` or after `pickupDeadline` THEN the system SHALL return `409` with code `INVALID_STATUS_TRANSITION` and SHALL NOT change anything (Q3). (EQP-05)
6. WHERE `requireDocumentOnPickup` is `true` and `documentChecked` is not `true` the system SHALL return `400` with code `VALIDATION_ERROR` and SHALL NOT change anything. (EQP-06)
7. WHERE `requireDocumentOnPickup` is `false` the system SHALL accept the pickup with `documentChecked` absent, `true` or `false`. (EQP-06)
8. IF `notes` is longer than 300 characters or `documentChecked` is not a boolean THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (EQP-07)
9. IF the `id` is not a uuid THEN the system SHALL return `400` with code `VALIDATION_ERROR`; IF it matches no request, a request that is not a reservation or an anonymized one THEN the system SHALL return `404` with code `NOT_FOUND`. (EQP-07)
10. The system SHALL apply the `pickupDeadline` stored in the reservation, and SHALL NOT recompute it from the current `pickupToleranceMinutes`. (EQP-05)

**Independent Test**: Reservar, retirar dentro da janela (200, `picked_up`, `pickedUpAt`, histórico); retirar de novo devolve `409`.

---

### P1: Registrar a devolução ⭐ MVP

**User Story**: As an attendant, I want to record the return so that the unit is free again.

**Why P1**: RF18.

**Acceptance Criteria**:

1. WHEN an authenticated attendant or manager sends `POST /admin/reservations/{id}/return` for a `picked_up` reservation THEN the system SHALL return `200` with the `RequestDetail` whose `status` is `returned` and `reservation.returnedAt` is the server time. (EQP-08)
2. The system SHALL set the status to `returned`, `returnedAt` and `completedAt` to the server time, `returnNotes` to `conditionNotes` and add a history row `picked_up` → `returned` with actor `staff` and the authenticated user, in one transaction. (EQP-08)
3. WHEN a reservation is returned THEN the system SHALL count its unit as free in the next agenda and in the next public availability query. (EQP-08)
4. WHEN the return happens after `endAt` THEN the system SHALL accept it and SHALL NOT apply any fine or penalty; only the stored `returnedAt` shows the delay. (EQP-09)
5. IF the reservation status is `reserved`, `returned`, `cancelled` or `no_show` THEN the system SHALL return `409` with code `INVALID_STATUS_TRANSITION` and SHALL NOT change anything. (EQP-09)
6. IF `conditionNotes` is longer than 300 characters THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (EQP-09)
7. IF the `id` is not a uuid, matches no request, is not a reservation or is anonymized THEN the system SHALL answer `400 VALIDATION_ERROR` or `404 NOT_FOUND` as in the pickup. (EQP-09)

**Independent Test**: Retirar, devolver (200, `returned`); devolver de novo devolve `409`; a disponibilidade pública volta a contar a unidade.

---

### P1: Autenticação e permissão ⭐ MVP

**User Story**: As the shopping, I want only authenticated staff with the right permission to operate equipment.

**Why P1**: RF12 e `docs/authorization.md`.

**Acceptance Criteria**:

1. IF a request to any of the three routes has no token, an invalid token, an expired token or a revoked session THEN the system SHALL return `401` with code `UNAUTHORIZED`. (EQP-10)
   The access control runs before the validation of the input: a request with no token and invalid input answers `401`, and one without the ability answers `403`, never `400`. (EQP-10)
2. IF the authenticated user lacks the ability of the route (`read`, `pickup` or `return` on `Reservation`) THEN the system SHALL return `403` with code `FORBIDDEN` and SHALL NOT change anything. (EQP-10)
3. The system SHALL allow `attendant` and `manager` on the three routes. (EQP-10)
4. The system SHALL read the role from the database on each request and SHALL NOT trust any role sent by the client. (EQP-10)

**Independent Test**: Sem token, `401` nas três rotas; com token de `attendant` e de `manager`, `200`.

---

### P1: Consistência e concorrência ⭐ MVP

**User Story**: As the shopping, I want status and history to stay consistent even when two people act on the same reservation.

**Why P1**: Pedido explícito; regra crítica de operação.

**Acceptance Criteria**:

1. WHEN two pickups of the same reservation arrive simultaneously THEN the system SHALL answer `200` to exactly one and `409` to the other, and SHALL create exactly one history row. (EQP-11)
2. WHEN two returns of the same reservation arrive simultaneously THEN the system SHALL answer `200` to exactly one and `409` to the other, and SHALL create exactly one history row. (EQP-11)
3. WHEN a pickup and a public cancellation of the same reservation arrive simultaneously THEN the system SHALL apply exactly one transition and answer the other according to the new status. (EQP-11)
4. WHEN a pickup and the no-show routine act on the same reservation simultaneously THEN the system SHALL apply exactly one transition. (EQP-11)
5. IF any step of a status change fails THEN the system SHALL roll back the status and the history together and return `500` with code `INTERNAL_ERROR`. (EQP-11)

**Independent Test**: 6 retiradas simultâneas da mesma reserva: 1 `200`, 5 `409`, 1 linha de histórico.

---

### P1: Auditoria ⭐ MVP

**User Story**: As a manager, I want to know who changed each reservation, when and from what.

**Why P1**: RF14, RF15 e pedido de auditoria.

**Acceptance Criteria**:

1. The system SHALL record, in every pickup, return and no-show, a history row with the previous status, the new status, the time, the actor type and, for staff, the user id. (EQP-12)
2. WHEN the change comes from the no-show routine THEN the system SHALL record actor `system` and no user. (EQP-12)
3. The system SHALL return, in the `RequestDetail` of the pickup and return, the history in ascending order, each entry with `actor.type`, `actor.userId` and `actor.name`. (EQP-12)
4. The system SHALL NOT expose `internalNote` or the history to the public tracking. (EQP-12)

**Independent Test**: Retirar e devolver; o detalhe mostra 3 entradas (criação, retirada, devolução) com o usuário nas duas últimas.

---

### P1: Não comparecimento automático (comportamento) ⭐ MVP

**User Story**: As the shopping, I want reservations that nobody picked up to be released automatically.

**Why P1**: RF19. O job é implementado em outra etapa; os critérios abaixo definem o que ele deve cumprir.

**Acceptance Criteria**:

1. WHEN the routine runs and a reservation is `reserved` with `pickupDeadline` before the current time THEN the system SHALL set it to `no_show`, set `completedAt` to the current time and add a history row `reserved` → `no_show` with actor `system`, in one transaction. (EQP-13)
2. The system SHALL NOT change a reservation that is still within the tolerance (`pickupDeadline` equal to or after the current time). (EQP-13)
3. The system SHALL NOT change reservations `cancelled`, `picked_up`, `returned` or already `no_show`. (EQP-13)
4. WHEN the routine runs twice in a row THEN the second run SHALL affect 0 reservations and add no history. (EQP-13)
5. WHEN two runs execute simultaneously THEN the system SHALL mark each eligible reservation exactly once and add exactly one history row per reservation. (EQP-13)
6. WHEN a reservation becomes `no_show` THEN the system SHALL count its unit as free in the next availability query. (EQP-13)
7. IF the run fails THEN the system SHALL leave every reservation as it was and record the failure in `job_logs` with no personal data. (EQP-13)
8. The system SHALL NOT expose the routine as an endpoint. (EQP-13)

**Independent Test**: Reserva `reserved` com prazo vencido vira `no_show`; as `cancelled`, `picked_up` e dentro do prazo não mudam.

---

### P2: Detalhe da reserva para a equipe

**User Story**: As an attendant, I want the full detail of a reservation so that I can handle the visitor.

**Why P2**: RF14 pertence à feature de solicitações (Q2); aqui só o corpo `RequestDetail` de reservas.

**Acceptance Criteria**:

1. The system SHALL return, in the response of pickup and return, `visitor` (name, phone, e-mail), the `reservation` data (equipment, times, `pickedUpAt`, `returnedAt`, `forWhom`, `size`, `strollerKind`, `currentLocation`, `notes`, `pickupOverdue`, `returnOverdue`) and the `history`. (EQP-14)
2. The system SHALL return `lostReport` and `sacMessage` as `null` and `messages` as an empty list for a reservation. (EQP-14)
3. The system SHALL NOT return the password hash, token or any data of other visitors. (EQP-14)

**Independent Test**: A resposta da retirada contém os dados do visitante e o histórico da reserva, e nenhum de outra.

---

## Edge Cases

- WHEN `agora = pickupDeadline` exatamente THEN the system SHALL accept the pickup and the routine SHALL NOT mark it `no_show`.
- WHEN a reservation in `mode now` was created after its block start THEN the pickup window SHALL run from the block `startAt` to the stored `pickupDeadline` (creation + tolerance).
- IF the reservation is `reserved`, past its `pickupDeadline` and the routine has not run yet THEN the system SHALL answer the pickup with `409`, even though the status is still `reserved`.
- WHEN the Gestor changes `pickupToleranceMinutes`, `slotMinutes` or the opening hours after reservations exist THEN the system SHALL keep the stored `startAt`, `endAt` and `pickupDeadline`.
- WHEN a picked-up reservation passes its `endAt` THEN the public availability stops counting it (limitation recorded in the reservations spec) while the agenda keeps `returnOverdue` true until the return.
- IF the pickup or return body is absent (no body and no `Content-Type`) or `{}` THEN the system SHALL accept it when the document is not required; an empty body sent with `Content-Type: application/json` is answered `400 VALIDATION_ERROR` by Fastify itself, and the client must omit the header or send `{}`.
- IF the body is not JSON or is malformed THEN the system SHALL answer `400 VALIDATION_ERROR`.
- WHEN the agenda day has no reservations THEN the system SHALL return the blocks with `reservations` empty and `freeUnits` equal to `totalUnits`.
- WHEN the equipment type has no active equipment THEN the system SHALL return `totalUnits` and `freeUnits` 0.
- IF a reservation has `anonymizedAt` THEN the agenda SHALL show it without personal data (name `null` or empty) and the operations SHALL answer `404`.
- WHEN the same reservation is returned twice in a double click THEN the system SHALL answer `409` to the second and SHALL create one history row.

---

## Test Scenarios

| # | Cenário | ACs |
| --- | --- | --- |
| T1 | Agenda de um dia com reservas de todos os status: blocos, `totalUnits`, `freeUnits`, ordem | Agenda 1-4 |
| T2 | Filtros: outro dia, outro tipo de equipamento e dia fechado/sem linha de expediente | Agenda 1, 5 |
| T3 | Data passada, além da antecedência e reserva fora dos blocos atuais | Agenda 6, 7 |
| T4 | `pickupOverdue` e `returnOverdue` conforme status e relógio (limites exatos) | Agenda 8 |
| T5 | Agenda sem dados de contato; parâmetros inválidos ou ausentes → `400` | Agenda 9, 10 |
| T6 | Retirada válida: `200`, `picked_up`, `pickedUpAt`, `pickupNotes`, `documentChecked`, histórico com o usuário | Pickup 1, 2 |
| T7 | Retirada com horário/status/usuário no corpo: ignorados | Pickup 3 |
| T8 | Retirada em reserva `picked_up`, `returned`, `cancelled`, `no_show` → `409` | Pickup 4 |
| T9 | Retirada antes do bloco, no limite exato da tolerância e depois dela | Pickup 5; Edge |
| T10 | Documento exigido (configuração) e não confirmado; não exigido | Pickup 6, 7 |
| T11 | Corpo inválido, `id` não uuid, `id` inexistente, de outro tipo e anonimizada | Pickup 8, 9 |
| T12 | Tolerância gravada x configuração alterada depois | Pickup 10 |
| T13 | Devolução válida: `200`, `returned`, `returnedAt`, `completedAt`, histórico, unidade livre | Return 1-3 |
| T14 | Devolução tardia aceita, sem penalidade | Return 4 |
| T15 | Devolução sem retirada, duplicada, de cancelada/`no_show` → `409` | Return 5 |
| T16 | `conditionNotes` acima de 300; `id` inválido ou inexistente | Return 6, 7 |
| T17 | Sem token, token inválido/expirado/sessão revogada → `401` nas três rotas | Auth 1 |
| T18 | Usuário sem a ability → `403`; `attendant` e `manager` → sucesso | Auth 2, 3 |
| T19 | Papel lido do banco: usuário rebaixado perde o acesso | Auth 4 |
| T20 | Retiradas simultâneas da mesma reserva | Conc 1 |
| T21 | Devoluções simultâneas da mesma reserva | Conc 2 |
| T22 | Retirada x cancelamento público simultâneos | Conc 3 |
| T23 | Retirada x job simultâneos (função do service) | Conc 4; Job 4 |
| T24 | Falha dentro da transação não deixa status sem histórico | Conc 5 |
| T25 | Histórico: de/para, horário, ator `staff` com usuário; `system` sem usuário | Audit 1-3 |
| T26 | Job: marca só `reserved` vencida; ignora `cancelled`, `picked_up`, `returned`, dentro do prazo e já `no_show` | Job 1-3 |
| T27 | Job duas vezes seguidas e duas execuções simultâneas | Job 4, 5 |
| T28 | Job libera a unidade na disponibilidade pública | Job 6 |
| T29 | Job com falha: nada muda e `job_logs` registra sem dados pessoais | Job 7 |
| T30 | Detalhe da resposta: visitante, reserva, histórico; sem dados de terceiros | Detail 1-3 |

---

## Dependencies on Other Features

| Feature | Situação | Uso |
| --- | --- | --- |
| `reservations-and-availability` | Concluída | Cria as reservas com `pickupDeadline`; fornece `freeUnits`, fuso e o cancelamento por `updateMany` condicional; o status `no_show`/`returned` já libera a disponibilidade pública. |
| `admin-authentication` | Concluída | JWT com `sid`, sessão no banco, `request.user` e `getAbility`. |
| `authorization-casl` | Concluída | Abilities `read`, `pickup`, `return` em `Reservation`; sem mudança. |
| Configurações das regras (RF25) | Futura (stub) | Altera `pickupToleranceMinutes` e `requireDocumentOnPickup`; esta feature só lê (`requireDocumentOnPickup` na retirada). |
| Solicitações administrativas (RF13-RF15) | Futura | `GET /admin/requests/{id}` reaproveita o mapper de `RequestDetail`; `PATCH /admin/requests/{id}/status` deve rejeitar `picked_up`, `returned` e `no_show` em reservas (I5). |
| Usuários administrativos | Existente | `User.id` e `User.name` para o histórico. |
| Histórico de solicitações | Existente | `RequestHistory` como trilha de auditoria. |
| Notificações (RF32) | Futura | E-mails de mudança de estado; fora desta feature. |
| Anonimização (RF31) | Futura | Usa `completedAt`; reservas anonimizadas deixam de ser operáveis. |

---

## Inconsistencies and Gaps Found

| # | O que foi encontrado | Impacto |
| --- | --- | --- |
| I1 | O pedido cita filtros por período, equipamento, status e local; o OpenAPI da agenda só aceita `date` e `equipmentType` | Assumido: só o contrato. Os outros filtros exigiriam alterar o OpenAPI. |
| I2 | O pedido pede "detalhes da reserva"; o OpenAPI não tem endpoint de detalhe só de reservas, apenas `GET /admin/requests/{id}` (RF14, os três tipos) | Q2. |
| I3 | O OpenAPI da agenda só lista `401`; retirada e devolução listam `401/404/409`, sem `400` nem `403` | `400` por validação e `403` por CASL seguem o comportamento padrão do projeto; documentar no OpenAPI. |
| I4 | O OpenAPI não tem código de erro para retirada fora da janela nem para "documento obrigatório" | Q3; o documento usa `400 VALIDATION_ERROR`. |
| I5 | O OpenAPI diz que reservas usam os endpoints de retirada/devolução, mas a tabela de transições lista `reserved→cancelled` pelo `PATCH /admin/requests/{id}/status`, e o `PATCH` poderia pular a janela | A feature de solicitações deve rejeitar `picked_up`, `returned` e `no_show` por esse endpoint. |
| I6 | O texto do OpenAPI diz que, sem retirada até o prazo, a reserva "é cancelada automaticamente"; RF19, o DBML e o pedido dizem `no_show` | Esta spec usa `no_show`; corrigir o OpenAPI. |
| I7 | `Reservation.id` e `Request.id` são ids diferentes e o OpenAPI usa `{id}` e `id` sem dizer qual | Assumido `Request.id` (Assumptions). |
| I8 | O OpenAPI define `pickupOverdue`/`returnOverdue` sem fórmula | Definidos em BR e Assumptions. |
| I9 | A agenda "mostra unidades livres por bloco", mas não diz se blocos passados e reservas canceladas entram | Q4. |
| I10 | Não existe agendador no projeto (`src/jobs/` vazia, sem dependência) | Q5. |
| I11 | Uma reserva `picked_up` deixa de contar na disponibilidade pública depois do `endAt` (limitação aceita na feature de reservas), mesmo sem devolução | A agenda mostra `returnOverdue`; a unidade pode aparecer livre ao público enquanto está fora. Sem mudança aqui. |
| I12 | `Reservation` não tem campos de responsável pela retirada/devolução | Coberto por `RequestHistory`; sem alteração. |
| I13 | `AGENTS.MD` manda ler `docs/conventions.md` e `docs/specs/`, que não existem | Não bloqueia. |

---

## Decisions

Todas aceitas pelo usuário (`"aceito as recomendações"`): vale a coluna Recomendação.

| # | Decisão | Recomendação | Alternativas |
| --- | --- | --- | --- |
| Q1 | Onde ficam agenda, retirada e devolução | Módulo próprio `equipment-operations`, importando a lógica pura de `reservations.slots` | `reservations` (retirada/devolução) e `equipment` (agenda), como em `docs/backend.md`; ou tudo em `reservations` |
| Q2 | Detalhe da reserva | Só o corpo `RequestDetail` nas respostas; `GET /admin/requests/{id}` fica com o RF14 | Registrar já o `GET /admin/requests/{id}` só para reservas; ou construir o detalhe dos três tipos agora |
| Q3 | Erro de retirada fora da janela/estado | `409 INVALID_STATUS_TRANSITION` com mensagens distintas | Novo código no OpenAPI (ex.: `OUTSIDE_PICKUP_WINDOW`), alterando o contrato; `400` para fora da janela |
| Q4 | Conteúdo da agenda | Dia inteiro e reservas de todos os status | Só blocos de hoje em diante; só reservas ativas (`reserved`/`picked_up`) |
| Q5 | Agendamento do job | `setInterval` 60 s no processo, `job_logs` só com atividade ou falha | `node-cron` (dependência nova); executar a cada minuto com `job_logs` sempre; script externo/agendador do sistema |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| EQP-01 | P1: Consultar a agenda (conteúdo e unidades) | Specify | Pending |
| EQP-02 | P1: Consultar a agenda (dia, validação, bordas) | Specify | Pending |
| EQP-03 | P1: Consultar a agenda (atrasos e privacidade) | Specify | Pending |
| EQP-04 | P1: Registrar a retirada (sucesso e persistência) | Specify | Pending |
| EQP-05 | P1: Registrar a retirada (estado e janela) | Specify | Pending |
| EQP-06 | P1: Registrar a retirada (documento) | Specify | Pending |
| EQP-07 | P1: Registrar a retirada (horário do servidor e validação) | Specify | Pending |
| EQP-08 | P1: Registrar a devolução (sucesso e liberação) | Specify | Pending |
| EQP-09 | P1: Registrar a devolução (estado, atraso e validação) | Specify | Pending |
| EQP-10 | P1: Autenticação e permissão | Specify | Pending |
| EQP-11 | P1: Consistência e concorrência | Specify | Pending |
| EQP-12 | P1: Auditoria | Specify | Pending |
| EQP-13 | P1: Não comparecimento automático | Specify | Pending |
| EQP-14 | P2: Detalhe da reserva para a equipe | Specify | Pending |

**ID format:** `EQP-NN`. **Coverage:** 14 total, 0 mapped to tasks (Tasks phase not started), 14 unmapped ⚠️.

---

## Sources

- `capim-dourado-servicos/docs/openapi-servicos-capim-dourado.yaml` - `GET /admin/agenda` (`getAgenda`), `POST /admin/reservations/{id}/pickup` (`registerPickup`), `.../return` (`registerReturn`), `GET /admin/requests/{id}`, `PATCH /admin/requests/{id}/status`; schemas `Agenda`, `RequestDetail`, `ReservationData`, `HistoryEntry`, `ErrorResponse`; tabela de status por tipo.
- `capim-dourado-servicos/docs/requirements.md` - RF12, RF14, RF15, RF17, RF18, RF19, RF25, RF31, premissas iniciais, estados por tipo.
- `capim-dourado-servicos/docs/{api,authorization,backend,database,architecture,project-overview}.md` e `docs/capim-dourado.dbml` - endpoints, matriz de permissões, jobs idempotentes com `job_logs`, histórico.
- `capim-dourado-servicos/AGENTS.MD` - regras obrigatórias (privacidade, CASL no backend, `America/Araguaina`).
- `apps/api/prisma/schema.prisma` - `Reservation`, `Request`, `RequestHistory`, `ReservationSettings`, `JobLog`, `User`.
- `packages/auth/src/{permissions,actions,subjects}` e `apps/api/src/http/middlewares/{auth,authorize}.ts` - abilities e autorização atuais.
- `apps/api/src/modules/{reservations,requests,equipment}/*`, `jobs/`, `http/routes.ts` - estado atual e stubs.
- `.specs/features/{reservations-and-availability,admin-authentication,authorization-casl,lost-item-registration}` e `.specs/STATE.md` (AD-001, AD-002) - convenções e decisões já aprovadas.

---

## Success Criteria

- [ ] A agenda de um dia com reservas em todos os status mostra cada uma no bloco certo, com `freeUnits` correto e os sinais de atraso.
- [ ] Retirada e devolução só funcionam a partir do status e da janela corretos e gravam horário do servidor, responsável e histórico juntos.
- [ ] Operações simultâneas sobre a mesma reserva produzem uma só transição e uma só linha de histórico.
- [ ] A rotina de não comparecimento (quando implementada) marca só as `reserved` vencidas, uma vez, mesmo com execuções simultâneas.
- [ ] Sem token a resposta é `401`; sem permissão, `403`; nenhuma resposta expõe dados de terceiros.
