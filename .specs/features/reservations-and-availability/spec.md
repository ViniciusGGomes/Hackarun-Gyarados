# Reservations and Availability Specification

**Status**: Approved
**Approved**: 2026-11-14 - user: "aceito as remodações, e preciso que seja simples a contrusção, siga"

## Problem Statement

O visitante ainda não consegue saber quando há cadeira de rodas ou carrinho de bebê disponível nem
reservar um: os módulos `reservations` e `tracking` só têm as rotas administrativas vazias
(`/admin/agenda`, retirada e devolução) e o módulo `equipment` não tem nada. Esta feature entrega
os endpoints públicos de RF03 (consultar horários), RF04 (reservar) e RF08 (cancelar reserva),
com a regra mais delicada do projeto: duas pessoas nunca podem ficar com a mesma unidade. A
disponibilidade mostrada é só informativa; a garantia vem da revalidação dentro de uma transação
no momento da reserva (`AGENTS.MD`, `docs/backend.md`).

## Goals

- [ ] `GET /api/v1/equipment/{type}/availability` devolve os blocos do dia com unidades livres, usando as regras atuais de `ReservationSettings` e `OpeningHour`.
- [ ] `POST /api/v1/reservations` cria a reserva (com protocolo) ou responde `409` com `SLOT_UNAVAILABLE` / `ACTIVE_RESERVATION_LIMIT`, sem nunca vender uma unidade duas vezes, mesmo sob requisições simultâneas.
- [ ] `POST /api/v1/tracking/{protocol}/cancel` cancela uma reserva antes da retirada e libera a unidade na hora.
- [ ] Nenhum dado pessoal de outro visitante aparece em qualquer resposta.

## Current State

Verificado no código da branch `backend` e nos documentos:

| Área | Situação encontrada | Consequência |
| --- | --- | --- |
| `apps/api/src/modules/reservations/*` | Só `reservations.routes.ts` com 3 rotas admin que retornam `{}`; controller, service, repository e schemas vazios | Implementar o fluxo público ali . |
| `apps/api/src/modules/trancking/*` | Pasta com nome digitado errado (`trancking`), todos os arquivos vazios; `docs/backend.md` chama o módulo de `tracking` | Cancelamento é rota de `tracking` ; o nome da pasta é uma pendência. |
| `apps/api/src/modules/equipment/*` | Só rotas admin; nenhuma lógica | `docs/backend.md` atribui "disponibilidade" ao módulo `equipment` . |
| Prisma `Equipment` | Uma linha por modelo: `type`, `label`, `quantity`, `pickupLocationId`, `active` (seed: cadeira adulto 4, cadeira infantil 2, cadeira em manutenção inativa, carrinho simples 5, carrinho duplo 2) | `Reservation` guarda só `equipmentType`, não a linha de `Equipment` . |
| Prisma `Reservation` / `Request` / `Consent` / `RequestHistory` / `UnmetDemand` | Existem com todos os campos necessários (`startAt`, `endAt`, `pickupDeadline`, `forWhom`, `size`, `strollerKind`, `currentLocationId`, `notes`; `Request.protocol`, `visitorPhone`, `completedAt`; `UnmetDemand.requestedFor`) | Sem mudança de schema. |
| `ReservationSettings` e `OpeningHour` | Singleton (`id = 1`) e uma linha por dia da semana (`weekday` 0 = domingo; `closed`, `openTime`/`closeTime` `HH:mm`); seed: dom 14:00-20:00, demais 10:00-22:00 | Lidos a cada request, para que a mudança do Gestor valha para os cálculos futuros (RF25). |
| `docs/capim-dourado.dbml` | Índices úteis já previstos: `(visitor_phone, type, status)`, `(equipment_type, start_at, end_at)` | Usar nas consultas de limite e de disponibilidade. |
| Auth e CASL | Concluídas (`admin-authentication`, `authorization-casl`) | As rotas desta feature são públicas e não usam `authorize`. |
| Catálogo público | Concluído (`public-query-routes`): `/services`, `/locations`, `/privacy-notice` | O formulário obtém locais e a versão do aviso nessas rotas. |
| Utilitários | `apps/api/src/utils/` só tem `create-slug.ts` e `get-user-permissions.ts` (sem protocolo, telefone ou datas) | `docs/backend.md` prevê esses utilitários; criar na implementação. |
| `AGENTS.MD` / docs | Cita `docs/conventions.md` e `docs/specs/`, que não existem no repo | Pendência de documentação (seção Inconsistencies). |

## Out of Scope

| Feature | Reason |
| --- | --- |
| Rotas administrativas: agenda (RF17), retirada/devolução (RF18), `/admin/equipment` (RF24), `/admin/settings/reservations` (RF25) | Features próprias; esta feature só lê equipamentos, configurações e expediente do banco. |
| Job de não comparecimento (RF19), anonimização (RF31) e e-mail de confirmação (RF32) | Jobs e notificações; fora dos endpoints públicos. |
| `POST /tracking/lookup` (RF07) e `POST /tracking/{protocol}/messages` (RF09) | Outras features; o OpenAPI não tem endpoint próprio de "consulta de reserva" além do lookup (ver D9). |
| Cancelamento de objeto perdido (RF08, parte de `lost_report`) | Pertence à feature de objetos perdidos. |
| Listar os tipos de equipamento | O OpenAPI não define endpoint; os tipos vêm do catálogo `/services` (`equipmentType`). Ver Inconsistencies. |
| Alterar o schema Prisma ou criar migrations | Pedido explícito; limitações são documentadas e propostas, não implementadas. |
| Frontend | Contrato apenas. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Prefixo | `/api/v1`, rotas públicas sem `authorize` e sem token | OpenAPI (`security: []`) e `docs/api.md` | y (documentado) |
| Tipos de equipamento | Enum `wheelchair` / `stroller` do OpenAPI; tipo fora do enum = `400` | Não há `404` no contrato; "equipamento inexistente" é tipo inválido | y (documentado) |
| Telefone | `^[0-9]{10,11}$`, só dígitos, gravado em `Request.visitorPhone` | OpenAPI `Phone`; coluna `varchar(11)` | y (documentado) |
| Protocolo | `CAP-XXXX-XXXX`, 8 caracteres aleatórios do alfabeto sem ambíguos (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, o do seed), por gerador criptográfico; repete em colisão de `unique` | `docs/backend.md`, seed | y (documentado) |
| Reservas "ativas" para o limite por telefone | `Request.type = reservation` com `Reservation.equipmentType` igual ao pedido e status `reserved` ou `picked_up`; limite = `maxActiveReservationsPerPhone` (padrão 1) | RF04 e premissas | y (documentado) |
| Quais reservas ocupam uma unidade | Status `reserved` e `picked_up`; `returned`, `cancelled` e `no_show` liberam | RF03/OpenAPI | y (documentado) |
| Consentimento | `consent.accepted` deve ser `true` e `privacyNoticeVersion` igual à versão do aviso ativo; grava `Consent` com `purpose = 'atender a solicitação'` | RF10, exemplo do DBML | y (documentado) |
| Histórico | Ao criar: linha em `request_history` (`from_status` nulo, `to_status = reserved`, `actor_type = visitor`); ao cancelar: `reserved` → `cancelled`, `actor_type = visitor`, `internal_note` = motivo informado | RF14/RF08; o motivo do visitante é guardado no campo interno, que nunca aparece ao visitante | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| Campos desconhecidos no corpo | Ignorados (Zod `strip`), nunca persistidos; o formulário não tem campo de motivo/saúde | `AGENTS.MD` proíbe perguntar motivo, deficiência ou saúde | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| `forWhom` e `size` | Opcionais, só para cadeira; `strollerKind` opcional, só para carrinho; enviar o campo do outro tipo = `400` | OpenAPI: nenhum está em `required` | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| Falha ao registrar demanda não atendida | Não derruba a consulta de disponibilidade | A demanda é um registro estatístico (RF28) | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| Cálculos de horário | Sempre em `America/Araguaina` (UTC-3, sem horário de verão); datas trafegam em ISO 8601 | `AGENTS.MD` | y (documentado) |
| Configurações mudam | Valem para consultas e reservas futuras; `startAt`, `endAt` e `pickupDeadline` já gravados não mudam | RF25 | y (documentado) |
| D1 Sobreposição | Um bloco só tem unidade livre se houver unidade livre durante **toda a janela** `[start, start + loanDurationMinutes)`: `availableUnits` = unidades − maior número de reservas `reserved`/`picked_up` simultâneas em qualquer instante da janela | Nunca oferece um horário que depois dá 409; a contagem simultânea evita recusar reservas que não coexistem | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D2 Bloco passado e `now` | Bloco passado = fim já passou (o bloco em andamento ainda é listado). `mode=now`: `startAt` = início do bloco atual, `endAt` = `startAt` + empréstimo, `pickupDeadline` = agora + tolerância. `mode=scheduled` exige `startAt` ≥ agora | Mantém o Preciso agora do OpenAPI sem prazo de retirada já vencido | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D3 Fechamento | Último bloco reservável começa em `closeTime` − `loanDurationMinutes` (20:00 com expediente até 22:00) | A devolução cabe no expediente | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D4 Antecedência | Datas locais até hoje + `maxAdvanceDays` (inclusive) e bloco não passado | Regra por data, simples de explicar | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D5 Capacidade | Por tipo de equipamento; `size` e `strollerKind` são informação para a equipe | Contrato e modelo atuais; limitação registrada | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D6 Demanda não atendida | Uma linha sempre que a consulta em dia aberto e dentro da janela não tiver nenhum bloco livre; nada para data passada, além da antecedência ou dia fechado; sem deduplicar | Leitura literal de RF03; o limite de abuso controla o ruído | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D7 Concorrência | `pg_advisory_xact_lock` por tipo de equipamento dentro de `prisma.$transaction` | Simples e solta sozinho no commit/rollback | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D8 Abuso | Limite em memória por IP, sem dependência nova: 10 requisições por minuto em `POST /reservations` e em `POST /tracking/{protocol}/cancel`; a disponibilidade não tem limite | Suficiente para a apresentação local; o OpenAPI não prevê 429 na consulta | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D9 Cancelamento | `POST /tracking/{protocol}/cancel` só para reservas, devolvendo a `TrackingView`; outros tipos respondem `409 REQUEST_NOT_CANCELLABLE` até suas features; `POST /tracking/lookup` fica fora | Entrega o RF08 de reserva sem ampliar o escopo | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D10 Módulos | Disponibilidade e criação em `reservations`; a rota de cancelamento em `tracking` (chama a regra de `reservations.service`); a pasta `trancking` é renomeada para `tracking` | Segue o pedido e o `docs/backend.md` | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D11 Código para `startAt` inválido | `400 OUTSIDE_OPENING_HOURS` para fora do expediente ou dia fechado; `400 VALIDATION_ERROR` para passado, além da antecedência ou desalinhado do bloco | Usa um código já previsto no OpenAPI | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| D12 Testes de banco | Um único arquivo de integração contra o PostgreSQL local em um banco de teste separado (`hackathon_test`), criado e migrado pelo próprio teste; lógica pura (blocos, simultaneidade, protocolo) em testes unitários sem banco | Mais simples que ampliar o fake em memória e prova a trava de verdade; um só arquivo evita corrida entre arquivos de teste | y - user: "aceito as remodações, e preciso que seja simples a contrusção, siga" (aceitou a recomendação) |
| Disponibilidade na consulta | Só informativa; a decisão final é feita na criação, dentro da transação | Pedido e `AGENTS.MD` | y (documentado) |

**Open questions:** none - D1 a D12 resolvidas (recomendações aceitas); as demais premissas seguem o default indicado.

---

## Endpoints (contracts)

Base path `/api/v1`. Erros em `ErrorResponse` `{ statusCode, code, message }`. Contrato conforme o OpenAPI; nada foi inventado.

| Method | Path | Auth | Request | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/equipment/{type}/availability?date=YYYY-MM-DD` | none | `type` ∈ `wheelchair\|stroller` (path); `date` obrigatório | `200 Availability` | `400 VALIDATION_ERROR` |
| POST | `/reservations` | none | `CreateReservation` | `201 ReservationCreated` | `400 VALIDATION_ERROR`/`CONSENT_REQUIRED`, `409 SLOT_UNAVAILABLE`/`ACTIVE_RESERVATION_LIMIT`, `429 TOO_MANY_REQUESTS` |
| POST | `/tracking/{protocol}/cancel` | none | `{ phone, reason? (≤ 200) }` | `200 TrackingView` | `404 NOT_FOUND` (genérico), `409 REQUEST_NOT_CANCELLABLE`, `429 TOO_MANY_REQUESTS` |

`Availability`: `{ equipmentType, date, slotMinutes, loanDurationMinutes, nowAvailable (boolean\|null), slots: [{ start, end, availableUnits, available }] }`.

`CreateReservation`: `equipmentType`, `mode` (`now`\|`scheduled`), `startAt` (obrigatório se `scheduled`), `name` (≤ 120), `phone`, `email?`, `currentLocationId?`, `forWhom?` (`self`\|`other`), `size?` (`adult`\|`child`), `strollerKind?` (`single`\|`double`), `notes?` (≤ 200), `consent { accepted: true, privacyNoticeVersion }`.

`ReservationCreated`: `protocol`, `status` (`reserved`), `createdAt`, `trackingPath` (`/acompanhar/{protocol}`), `equipmentType`, `startAt`, `endAt`, `pickupDeadline`, `pickupLocation` (`Location`).

`TrackingView` (resposta do cancelamento): `protocol`, `type`, `publicStatus`, `createdAt`, `summary` (equipamento e horário), `timeline [{ status, at }]`, `messages`, `canCancel`, `canReply`.

---

## Business Rules

| # | Regra |
| --- | --- |
| BR1 | Unidades de um tipo = soma de `quantity` das linhas de `Equipment` ativas do tipo (RF03). |
| BR2 | Os blocos do dia vêm do `OpeningHour` do dia da semana local, em passos de `slotMinutes`; dia `closed` ou sem linha não tem blocos. |
| BR3 | Uma reserva ocupa a unidade em `[startAt, endAt)`, com `endAt = startAt + loanDurationMinutes`. |
| BR4 | `availableUnits` de um bloco = unidades − o maior número de reservas `reserved`/`picked_up` do tipo ativas ao mesmo tempo em qualquer instante da janela do empréstimo, mínimo 0. |
| BR5 | `pickupDeadline = startAt + pickupToleranceMinutes` [no modo `now`: agora + tolerância]. |
| BR6 | Só se reserva um bloco que a consulta ofereceria: dentro do expediente (último bloco em `closeTime` − empréstimo), não passado e dentro da antecedência máxima. |
| BR7 | Limite de reservas ativas por telefone e por tipo = `maxActiveReservationsPerPhone` (1). |
| BR8 | Criar reserva é atômico: `Request`, `Reservation`, `Consent` e histórico inicial ou nada. |
| BR9 | Cancelar só é possível enquanto a reserva está `reserved`; vira `cancelled` e libera a unidade imediatamente. |
| BR10 | `forWhom`/`size` só valem para `wheelchair`; `strollerKind` só para `stroller`. |

---

## Main and Alternative Flows

```
Consulta (GET availability)
  valida type e date (Zod)                              -> 400 VALIDATION_ERROR
  lê ReservationSettings + OpeningHour do dia + unidades
  gera blocos -> remove passados/fora da janela
  conta reservas reserved/picked_up que ativas em cada janela de empréstimo
  sem bloco livre (dentro da janela, dia aberto) -> registra UnmetDemand
  200 Availability (sem dados pessoais, sem lock, sem garantia)

Reserva (POST /reservations)  -- tudo dentro de UMA transação
  valida corpo (Zod); consent.accepted = true             -> 400
  versão do aviso = aviso ativo                           -> 400 CONSENT_REQUIRED
  resolve startAt (scheduled) ou bloco atual (now)
  janela: expediente, futuro, antecedência              -> 400
  local atual (se enviado) existe e está ativo             -> 400
  trava (pg_advisory_xact_lock do tipo)
  conta reservas ativas do telefone e tipo >= limite      -> 409 ACTIVE_RESERVATION_LIMIT
  recalcula unidades livres do intervalo; 0          -> 409 SLOT_UNAVAILABLE
  gera protocolo (repete em colisão)
  cria Request + Reservation + Consent + RequestHistory
  commit libera a trava -> 201 ReservationCreated

Cancelamento (POST /tracking/{protocol}/cancel)
  valida phone e reason (Zod)                             -> 400
  carrega a solicitação por protocolo com bloqueio de linha
  protocolo inexistente, telefone diferente ou anonimizada -> 404 genérico
  tipo diferente de reserva
  status != reserved                                      -> 409 REQUEST_NOT_CANCELLABLE
  status = cancelled, completedAt = agora, histórico (reserved -> cancelled)
  200 TrackingView (canCancel = false)
```

Alternativas e falhas: erro no meio da reserva desfaz tudo (nenhum `Request` órfão); colisão de protocolo gera outro; duas reservas simultâneas serializam pela trava; cancelamento e retirada simultâneos: só uma transição vence (bloqueio de linha ou atualização condicional).

---

## Validation Rules

| Campo | Regra |
| --- | --- |
| `type` (path) | enum `wheelchair` \| `stroller` |
| `date` (query) | data ISO `YYYY-MM-DD` real (calendário válido) |
| `mode` | `now` \| `scheduled`; `scheduled` exige `startAt` |
| `startAt` | data-hora ISO 8601 com fuso; alinhada ao início de um bloco do dia local |
| `name` | obrigatório, após `trim` não vazio, ≤ 120 |
| `phone` | `^[0-9]{10,11}$` |
| `email` | opcional, e-mail válido, ≤ 255 |
| `currentLocationId` | opcional, UUID de um `Location` existente e ativo |
| `forWhom` / `size` | opcionais, só `wheelchair`; `self`/`other`, `adult`/`child` |
| `strollerKind` | opcional, só `stroller`; `single`/`double` |
| `notes` | opcional, ≤ 200 |
| `consent` | `accepted` exatamente `true`; `privacyNoticeVersion` = versão ativa |
| `protocol` (path do cancelamento) | formato `CAP-XXXX-XXXX`; formato inválido responde o mesmo `404` genérico |
| `reason` | opcional, ≤ 200 |

---

## Security

| Item | Requisito |
| --- | --- |
| Acesso | Sem autenticação; nenhuma ability CASL nova. |
| Dados de terceiros | Nenhuma resposta traz nome, telefone, e-mail ou id de outra reserva; a disponibilidade só devolve contagens. |
| Posse da reserva | O cancelamento exige protocolo + telefone cadastrado; protocolo inexistente, telefone errado e reserva anonimizada respondem o mesmo `404` (mesmo corpo, sem revelar se o protocolo existe). |
| Protocolo | Imprevisível (gerador criptográfico), nunca derivado de id sequencial ou do telefone. |
| Entrada | Tudo validado por Zod; o cliente nunca decide `endAt`, `pickupDeadline`, unidades livres ou status. |
| Abuso | 429 declarado no OpenAPI para `POST /reservations` e cancelamento; a consulta tem efeito colateral (demanda não atendida). Limite de 10 por minuto por IP nas duas rotas de escrita; a consulta não tem limite. |
| Privacidade | Sem campo de motivo, deficiência ou saúde; consentimento registrado com a versão do aviso. |
| Logs | Sem telefone, e-mail ou nome em logs de erro. |

---

## Concurrency and Consistency

- Regra do projeto: revalidar a disponibilidade na criação, dentro de transação (`AGENTS.MD`, `docs/backend.md`, `docs/database.md`). O DBML cita duas estratégias; a escolha está em **D7**.
- O que a transação de criação precisa garantir para um tipo: (1) a contagem de reservas sobrepostas e a inserção são uma única seção crítica; (2) o limite por telefone é contado na mesma seção crítica, pois depende do mesmo tipo; (3) o `Request`/`Reservation`/`Consent`/histórico entram juntos.
- A consulta de disponibilidade não trava, não reserva e não promete: o mesmo bloco pode aparecer livre e já estar tomado quando o visitante enviar. Esse caso responde `409 SLOT_UNAVAILABLE`.
- Cancelamento: o bloqueio da linha da solicitação impede que cancelamento e retirada (rota admin) vençam juntos.
- Limitação do modelo: `Reservation` não referencia a linha de `Equipment`, então a capacidade é contada por **tipo**, não por tamanho/modelo (**D5**).
- Limitação do modelo: uma reserva `picked_up` que passou do `endAt` sem devolução deixa de sobrepor blocos futuros, embora a unidade esteja fora (**D1**).

---

## User Stories

### P1: Consultar disponibilidade ⭐ MVP

**User Story**: As a visitor, I want to see the free time blocks of a wheelchair or stroller for a day so that I can choose when to pick it up.

**Why P1**: É o primeiro passo do fluxo de reserva (RF03).

**Acceptance Criteria**:

1. WHEN a visitor requests `GET /equipment/{type}/availability` with a valid `type` and a valid `date` THEN the system SHALL return `200` with `equipmentType`, `date`, `slotMinutes`, `loanDurationMinutes`, `nowAvailable` and `slots` (`start`, `end`, `availableUnits`, `available`), using the `ReservationSettings` current at the time of the request.
2. The system SHALL NOT require authentication for this endpoint.
3. The system SHALL build the blocks in the `America/Araguaina` timezone, `slotMinutes` long, from the `openTime` of that weekday's `OpeningHour` up to the last block that still ends its loan by `closeTime` (`closeTime` minus `loanDurationMinutes`).
4. IF the weekday is `closed` or has no `OpeningHour` row THEN the system SHALL return `200` with `slots` empty.
5. The system SHALL compute `availableUnits` of a block as the sum of `quantity` of the active `Equipment` of the type minus the largest number of `reserved` and `picked_up` reservations of that type that are active at the same time at any instant of the loan window `[start, start + loanDurationMinutes)`, never below 0, and SHALL set `available` to true only when `availableUnits` is greater than 0.
6. The system SHALL NOT count `cancelled`, `returned` or `no_show` reservations when computing `availableUnits`.
7. The system SHALL NOT list blocks whose end has already passed or whose date is beyond today plus `maxAdvanceDays`.
8. WHEN `date` is today THEN the system SHALL set `nowAvailable` to true only when the block that contains the current instant has `availableUnits` greater than 0, and SHALL set `nowAvailable` to `null` for any other date.
9. IF `type` is not `wheelchair` or `stroller`, or `date` is missing or is not a real calendar date THEN the system SHALL return `400` with code `VALIDATION_ERROR`.
10. IF the type has no active `Equipment` THEN the system SHALL return `200` with every block at `availableUnits` 0 and `available` false.
11. The system SHALL NOT include personal data or reservation identifiers in the response.

**Independent Test**: Com o seed, `GET /equipment/wheelchair/availability?date=<amanhã>` devolve blocos de 30 minutos entre 10:00 e 22:00 com `availableUnits` 6.

---

### P2: Registrar demanda não atendida

**User Story**: As the manager, I want unmet demand recorded so that the indicators show when equipment ran out.

**Why P2**: Dado de indicadores (RF28); não bloqueia a reserva.

**Acceptance Criteria**:

1. WHEN a consultation for a date inside the booking window, on an open day, returns no block with `availableUnits` greater than 0 THEN the system SHALL record one `UnmetDemand` with the `equipmentType`, `requestedFor` equal to the requested date and the consultation time.
2. IF at least one block is available, or the date is outside the booking window, or the day is closed THEN the system SHALL NOT record an `UnmetDemand`.
3. IF recording the `UnmetDemand` fails THEN the system SHALL still return the availability response.

**Independent Test**: Esgotar as unidades de um dia e consultar esse dia: uma linha em `unmet_demands`; consultar um dia livre: nenhuma.

---

### P1: Criar reserva ⭐ MVP

**User Story**: As a visitor, I want to reserve a wheelchair or stroller so that it is ready when I arrive.

**Why P1**: RF04, o objetivo da feature.

**Acceptance Criteria**:

1. WHEN a visitor sends a valid `POST /reservations` with `mode` `scheduled` and a `startAt` that has a free unit THEN the system SHALL return `201` with `protocol`, `status` `reserved`, `createdAt`, `trackingPath`, `equipmentType`, `startAt`, `endAt`, `pickupDeadline` and `pickupLocation`.
2. The system SHALL create the `Request` (type `reservation`, status `reserved`, `visitorName`, `visitorPhone`, `visitorEmail`), the `Reservation`, the `Consent` and the first `RequestHistory` row in one transaction.
3. The system SHALL set `endAt` to `startAt` plus `loanDurationMinutes` and `pickupDeadline` to `startAt` plus `pickupToleranceMinutes`, except in `mode` `now`, where `pickupDeadline` is the current time plus `pickupToleranceMinutes`.
4. WHEN `mode` is `now` THEN the system SHALL use the block that contains the current instant, only if it has a free unit.
5. The system SHALL generate a unique, unpredictable protocol in the format `CAP-XXXX-XXXX` and SHALL generate another one if the value collides.
6. IF `mode` is `scheduled` and `startAt` is missing THEN the system SHALL return `400` with code `VALIDATION_ERROR`.
7. IF `name`, `phone` or `consent` is missing or invalid, or `phone` does not match `^[0-9]{10,11}$`, or `email`, `notes` or `name` break their limits THEN the system SHALL return `400` with code `VALIDATION_ERROR` and SHALL NOT persist anything.
8. IF `consent.accepted` is not `true`, or `consent.privacyNoticeVersion` is not the version of the active privacy notice THEN the system SHALL return `400` with code `CONSENT_REQUIRED` and SHALL NOT persist anything.
9. IF `startAt` is not the start of a block, is outside the opening hours, is already past or is beyond the maximum advance THEN the system SHALL return `400` with code `OUTSIDE_OPENING_HOURS` when it is outside the opening hours or on a closed day, or with code `VALIDATION_ERROR` otherwise, and SHALL NOT persist anything.
10. IF `currentLocationId` is sent and does not belong to an active `Location` THEN the system SHALL return `400` with code `VALIDATION_ERROR`.
11. IF `forWhom` or `size` is sent for a `stroller`, or `strollerKind` for a `wheelchair` THEN the system SHALL return `400` with code `VALIDATION_ERROR`.
12. IF the phone already has `maxActiveReservationsPerPhone` reservations with status `reserved` or `picked_up` of the same equipment type THEN the system SHALL return `409` with code `ACTIVE_RESERVATION_LIMIT` and SHALL NOT persist anything.
13. IF, inside the transaction, no unit is free for the whole `[startAt, endAt)` THEN the system SHALL return `409` with code `SLOT_UNAVAILABLE` and SHALL NOT persist anything.
14. IF any step of the transaction fails THEN the system SHALL roll back every row, leaving no orphan `Request`.
15. The system SHALL NOT change the stored `startAt`, `endAt` or `pickupDeadline` of existing reservations when the Gestor changes the settings.
16. The system SHALL NOT require authentication and SHALL NOT include personal data of other visitors in the response.

**Independent Test**: `POST /reservations` válido devolve `201` com protocolo e `status` `reserved`; o mesmo telefone e tipo de novo devolve `409 ACTIVE_RESERVATION_LIMIT`.

---

### P1: Consistência sob concorrência ⭐ MVP

**User Story**: As the shopping, I want two visitors never to get the same unit so that nobody arrives to an empty counter.

**Why P1**: Regra crítica do projeto (RF04, `AGENTS.MD`).

**Acceptance Criteria**:

1. WHEN N simultaneous valid requests compete for the same equipment type and the same block and only U units are free (U < N) THEN the system SHALL answer `201` to exactly U of them and `409` with code `SLOT_UNAVAILABLE` to the others.
2. WHEN simultaneous requests from the same phone and equipment type arrive THEN the system SHALL create at most `maxActiveReservationsPerPhone` reservations and answer the others `409` with code `ACTIVE_RESERVATION_LIMIT`.
3. WHILE a booking transaction of one equipment type is running, the system SHALL NOT let another booking of that type read the counts before it commits, and SHALL NOT delay bookings of the other type.
4. The system SHALL NOT take a lock or hold a reservation during the availability consultation.
5. The system SHALL release any lock when the transaction ends, by commit or by rollback.

**Independent Test**: Disparar 8 `POST /reservations` simultâneos para o mesmo bloco com 2 unidades livres e telefones distintos: 2 `201` e 6 `409`.

---

### P1: Cancelar reserva ⭐ MVP

**User Story**: As a visitor, I want to cancel my reservation with my protocol and phone so that the unit is freed for someone else.

**Why P1**: RF08, parte reserva; evita unidades presas.

**Acceptance Criteria** (somente reservas; a rota fica no módulo `tracking`):

1. WHEN a visitor sends `POST /tracking/{protocol}/cancel` with the registered phone of a reservation in status `reserved` THEN the system SHALL return `200` with the `TrackingView` showing `publicStatus` `cancelled` and `canCancel` false.
2. The system SHALL set the request status to `cancelled`, set `completedAt` to the current time and add a `RequestHistory` row from `reserved` to `cancelled` with actor `visitor`, in one transaction.
3. WHEN a reservation is cancelled THEN the system SHALL count its unit as free in the next availability consultation and in the next booking.
4. IF the protocol does not exist, the phone differs from the registered one, or the request was anonymized THEN the system SHALL return `404` with the same generic body for the three cases.
5. IF the reservation status is `picked_up`, `returned`, `no_show` or `cancelled` THEN the system SHALL return `409` with code `REQUEST_NOT_CANCELLABLE` and SHALL NOT change anything.
6. IF `phone` does not match `^[0-9]{10,11}$` or `reason` is longer than 200 characters THEN the system SHALL return `400` with code `VALIDATION_ERROR`.
7. WHEN a cancellation and a pickup of the same reservation arrive simultaneously THEN the system SHALL apply only one transition and answer the other according to the new status.
8. The system SHALL return only public fields in the `TrackingView`, with no data of other visitors.
9. IF the request found by the protocol is not a reservation THEN the system SHALL return `409` with code `REQUEST_NOT_CANCELLABLE`.

**Independent Test**: Reservar, cancelar com o telefone certo (200) e consultar a disponibilidade: a unidade volta; cancelar de novo devolve `409 REQUEST_NOT_CANCELLABLE`.

---

### P2: Proteção contra abuso

**User Story**: As the shopping, I want automated attempts limited so that the public endpoints are not flooded.

**Why P2**: O OpenAPI declara `429`, mas o limite é de 10 requisições por minuto por IP nas duas rotas de escrita.

**Acceptance Criteria**:

1. WHEN one origin exceeds 10 requests per minute on `POST /reservations` or `POST /tracking/{protocol}/cancel` THEN the system SHALL return `429` with code `TOO_MANY_REQUESTS` and SHALL NOT process the request.
2. The system SHALL NOT limit the availability endpoint.

**Independent Test**: Repetir o `POST` além do limite e ver o `429`.

---

## Edge Cases

- WHEN the current block is listed by the availability (decision D2) THEN the system SHALL accept a booking of it only with `mode` `now`, and SHALL answer `mode` `scheduled` for it with `400` and code `VALIDATION_ERROR`, because a scheduled start must not be in the past.
- WHEN a reservation is still `reserved` after its `pickupDeadline` and before the no-show job (RF19) changes it THEN the system SHALL still accept its cancellation, because RF08 only forbids cancelling after the pickup.
- WHEN the Gestor changes `slotMinutes` or `loanDurationMinutes` after reservations exist THEN the system SHALL keep their stored `startAt`/`endAt` and SHALL compute new blocks with the new values.
- IF two reservations of the same phone and type are submitted at the same instant THEN the system SHALL create at most one when the limit is 1.
- IF a block has `availableUnits` 1 and two distinct phones book it simultaneously THEN the system SHALL create exactly one.
- WHEN a reserved visitor's phone has a `returned` or `cancelled` reservation of the same type THEN the system SHALL allow a new reservation (only `reserved`/`picked_up` count).
- IF `Equipment.quantity` is reduced or an equipment row is deactivated while reservations exist THEN the system SHALL keep the existing reservations and SHALL use the new total for new bookings.
- WHEN the date is today and the current instant is after the last block THEN the system SHALL return `slots` empty.
- IF `date` is a valid past date THEN the system SHALL return `200` with `slots` empty.
- IF the same request is submitted twice because of a double click THEN the second one SHALL receive `409 ACTIVE_RESERVATION_LIMIT` (limit 1) and no second reservation SHALL exist.

---

## Test Scenarios

| # | Cenário | ACs |
| --- | --- | --- |
| T1 | Disponibilidade com horários livres (blocos, unidades, `slotMinutes`, `loanDurationMinutes`) | Avail 1, 3, 5 |
| T2 | Disponibilidade sem unidade livre (todas reservadas) → blocos `available:false` e demanda registrada | Avail 5; Demand 1 |
| T3 | Tipo inexistente (`wheelchairs`) e data inválida/ausente → 400 | Avail 9 |
| T4 | Tipo sem equipamento ativo (todas as linhas inativas) → blocos zerados | Avail 10 |
| T5 | Dia fechado e dia sem linha de expediente → `slots` vazio | Avail 4 |
| T6 | Reserva cancelada, devolvida e `no_show` não ocupam unidade; `reserved` e `picked_up` ocupam | Avail 5, 6 |
| T7 | Blocos passados e além da antecedência não aparecem; `nowAvailable` só em hoje | Avail 7, 8 |
| T8 | Criação válida: 201, `endAt`, `pickupDeadline`, `pickupLocation`, `Request`+`Reservation`+`Consent`+histórico | Create 1, 2, 3 |
| T9 | `mode:'now'` usa o bloco atual (relógio controlado) | Create 4 |
| T10 | Dados inválidos (nome, telefone, e-mail, notas, `startAt` ausente, campos do outro tipo) → 400 sem persistir | Create 6, 7, 10, 11 |
| T11 | Sem consentimento ou versão do aviso errada → 400 `CONSENT_REQUIRED` | Create 8 |
| T12 | `startAt` fora do período (passado, > antecedência, fora do expediente, desalinhado) | Create 9 |
| T13 | Horário indisponível → 409 `SLOT_UNAVAILABLE` | Create 13 |
| T14 | Segunda reserva do mesmo telefone e tipo → 409 `ACTIVE_RESERVATION_LIMIT`; outro tipo ou outro telefone passa | Create 12 |
| T15 | Quantidade limitada: U unidades aceitam U reservas e a seguinte recebe 409 | Create 13; Conc 1 |
| T16 | Falha no meio da transação não deixa `Request` órfão | Create 14 |
| T17 | Regras do Gestor: mudar `slotMinutes`, `loanDurationMinutes`, `pickupToleranceMinutes`, `maxAdvanceDays`, limite por telefone, `OpeningHour` e `quantity` altera cálculos futuros e não as reservas existentes | Avail 1, 3; Create 3, 15 |
| T18 | Cancelamento válido: 200, `cancelled`, `completedAt`, histórico | Cancel 1, 2 |
| T19 | Liberação: após cancelar, a disponibilidade e uma nova reserva voltam a enxergar a unidade | Cancel 3 |
| T20 | Cancelamento de reserva `picked_up`/`returned`/`no_show`/`cancelled` → 409 `REQUEST_NOT_CANCELLABLE` | Cancel 5 |
| T21 | Protocolo inexistente, telefone errado e anonimizada → mesmo 404 | Cancel 4 |
| T22 | Duas requisições simultâneas para a mesma unidade (banco de teste real) | Conc 1 |
| T23 | Duas simultâneas do mesmo telefone e tipo (banco real) | Conc 2 |
| T24 | Cancelamento e retirada simultâneos (banco real) | Cancel 7 |
| T25 | Respostas sem dados pessoais de terceiros; sem campo de motivo/saúde | Avail 11; Create 16; Cancel 8 |
| T26 | Rotas funcionam sem token | Avail 2; Create 16 |
| T27 | 429 acima do limite (10 por minuto) | Abuse 1 |

---

## Dependencies on Other Features

| Feature | Situação | Uso |
| --- | --- | --- |
| `authorization-casl` e `admin-authentication` | Concluídas | Sem uso direto; as rotas são públicas. As rotas admin vizinhas (`/admin/agenda`, retirada, devolução) continuam protegidas. |
| `public-query-routes` | Concluída | `/locations` (local atual), `/privacy-notice` (versão do consentimento) e `/services` (tipos de equipamento). |
| Prisma e seed | Existentes | `ReservationSettings`, `OpeningHour`, `Equipment`, `Location`, `PrivacyNotice`, `Request`, `Reservation`, `Consent`, `RequestHistory`, `UnmetDemand`. |
| Retirada e devolução (RF18) | Futura | Muda o status para `picked_up`/`returned`; os cálculos desta feature já tratam esses status. |
| Job de não comparecimento (RF19) | Futura | Marca `no_show` depois de `pickupDeadline`; até lá a reserva não retirada segue ocupando a unidade. |
| Consulta por protocolo (RF07) | Futura | Reutiliza a visão `TrackingView` que o cancelamento já devolve . |
| Configurações e equipamentos (RF24/RF25) | Futuras | Alteram os dados lidos aqui; nada a mudar nesta feature. |
| Notificações (RF32) | Futura | E-mail de confirmação não faz parte desta feature. |

---

## Inconsistencies and Gaps Found

| # | O que foi encontrado | Impacto |
| --- | --- | --- |
| I1 | O pedido cita "consultar os equipamentos disponíveis", mas o OpenAPI só tem `GET /equipment/{type}/availability`; não existe listagem pública de equipamentos | Os tipos vêm do catálogo `/services`; não criar endpoint novo sem aprovação. |
| I2 | O OpenAPI põe o cancelamento em `/tracking/{protocol}/cancel`, devolvendo `TrackingView` (compartilhada com RF07/RF09), e a pasta do módulo está escrita `trancking` | D9 e D10. |
| I3 | `docs/backend.md` atribui "disponibilidade" ao módulo `equipment`; o pedido manda implementar em `modules/reservations/` | D10. |
| I4 | O OpenAPI diz que, sem retirada até `pickupDeadline`, a reserva "é cancelada automaticamente"; RF19 e o DBML dizem que vira `no_show` | Não afeta esta feature (o job é outra), mas o texto do OpenAPI deve ser corrigido. |
| I5 | RF03 diz "ainda não passados" e RF04 diz que "Preciso agora" usa o "bloco atual", que já começou | D2. |
| I6 | RF03 define a disponibilidade como "reservas sobrepostas" sem dizer sobreposição a quê (bloco ou janela inteira do empréstimo) | D1. |
| I7 | O `Equipment` tem uma linha por modelo (adulto/infantil, simples/duplo), mas `Reservation` só guarda o tipo | D5. |
| I8 | O OpenAPI lista `OUTSIDE_OPENING_HOURS` em `ErrorResponse.code`, mas nenhuma resposta o associa a um status | D11. |
| I9 | A consulta `GET` grava `UnmetDemand` (efeito colateral) e o OpenAPI não prevê `429` nela | D6 e D8. |
| I10 | `AGENTS.MD` manda ler `docs/conventions.md` e `docs/specs/`, que não existem | Não bloqueia; atualizar a documentação. |
| I11 | O OpenAPI não diz se `forWhom`, `size` e `strollerKind` são obrigatórios | Assumido opcional (tabela de Assumptions). |

---

## Decisions

Todas aceitas pelo usuário (`"aceito as remodações, e preciso que seja simples a contrusção, siga"`); os resultados estão na tabela de Assumptions.

| # | Decisão | Resultado |
| --- | --- | --- |
| D1 | Sobreposição | Janela inteira do empréstimo; unidades livres = total − maior simultaneidade |
| D2 | Bloco passado e "agora" | Passado = fim já passou; `now` usa o bloco atual com prazo = agora + tolerância |
| D3 | Fechamento | Último bloco = `closeTime` − empréstimo |
| D4 | Antecedência | Hoje + `maxAdvanceDays`, inclusive |
| D5 | Capacidade | Por tipo |
| D6 | Demanda não atendida | Registrar quando dia aberto e janela válida sem nenhum bloco livre; sem deduplicar |
| D7 | Concorrência | `pg_advisory_xact_lock` por tipo |
| D8 | Abuso | 10/min por IP em `POST /reservations` e cancelamento, em memória |
| D9 | Cancelamento | Só reservas; sem `lookup` |
| D10 | Módulos | Disponibilidade/criação em `reservations`, cancelamento em `tracking`, pasta renomeada |
| D11 | `startAt` inválido | `OUTSIDE_OPENING_HOURS` ou `VALIDATION_ERROR` |
| D12 | Testes de banco | Arquivo único contra banco de teste; lógica pura em unitários |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RSV-01 | P1: Consultar disponibilidade (cálculo de blocos e unidades) | Specify | Pending |
| RSV-02 | P1: Consultar disponibilidade (janela, validação, dia fechado, nowAvailable) | Specify | Pending |
| RSV-03 | P2: Registrar demanda não atendida | Specify | Pending |
| RSV-04 | P1: Criar reserva (sucesso, persistência atômica, protocolo) | Specify | Pending |
| RSV-05 | P1: Criar reserva (validação e consentimento) | Specify | Pending |
| RSV-06 | P1: Criar reserva (conflitos 409, limite por telefone) | Specify | Pending |
| RSV-07 | P1: Consistência sob concorrência | Specify | Pending |
| RSV-08 | P1: Cancelar reserva | Specify | Pending |
| RSV-09 | P2: Proteção contra abuso | Specify | Pending |
| RSV-10 | P1: Rotas públicas e privacidade (transversal) | Specify | Pending |

**ID format:** `RSV-NN`. **Coverage:** 10 total, 0 mapped to tasks (Tasks phase not started), 10 unmapped ⚠️.

---

## Sources

- `capim-dourado-servicos/docs/openapi-servicos-capim-dourado.yaml` - `GET /equipment/{type}/availability`, `POST /reservations`, `POST /tracking/{protocol}/cancel`; schemas `Availability`, `CreateReservation`, `ReservationCreated`, `ProtocolCreated`, `TrackingView`, `Consent`, `Phone`, `EquipmentType`, `ErrorResponse`; responses `BadRequest`, `NotFound`, `Conflict`, `TooManyRequests`.
- `capim-dourado-servicos/docs/requirements.md` - RF03, RF04, RF08, RF10, RF19, RF25, premissas iniciais.
- `capim-dourado-servicos/docs/backend.md`, `docs/database.md`, `docs/architecture.md`, `docs/api.md`, `docs/authorization.md`, `docs/capim-dourado.dbml` - módulos, regras críticas (reserva concorrente, protocolo, horários), índices, status.
- `capim-dourado-servicos/AGENTS.MD` - regras obrigatórias (revalidar em transação, privacidade, timezone).
- `apps/api/prisma/schema.prisma` e `prisma/seed.ts` - modelos e dados iniciais (equipamentos, expediente).
- `apps/api/src/modules/{reservations,trancking,equipment}/*`, `http/routes.ts`, `utils/*` - estado atual.
- `.specs/features/{public-query-routes,admin-authentication,authorization-casl}` - convenções e dependências concluídas.

---

## Success Criteria

- [ ] A consulta de disponibilidade devolve blocos corretos para um dia com reservas em todos os status.
- [ ] Uma reserva válida devolve `201` com protocolo e grava `Request`, `Reservation`, `Consent` e histórico juntos.
- [ ] N requisições simultâneas por U unidades livres geram exatamente U reservas.
- [ ] O limite de uma reserva ativa por telefone e tipo vale também sob simultaneidade.
- [ ] Cancelar uma reserva `reserved` libera a unidade na hora; reservas retiradas ou finais não cancelam.
- [ ] Nenhuma resposta expõe dados pessoais de outros visitantes.
