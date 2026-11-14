# Reservations and Availability Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/reservations-and-availability/design.md`
**Status**: Approved
**Approved**: 2026-11-14 - user: "aprovo"
**Build**: pnpm --filter @saas/api run check-types
**Run test**: pnpm --filter @saas/api exec vitest run --reporter=verbose

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute.
> Guidelines found: `capim-dourado-servicos/AGENTS.MD` ("não faça operações de reserva sem revalidar disponibilidade em transação"; run lint, typecheck, tests and build when available); Vitest tests in `apps/api/src/**` from the previous features are the floor for style and location.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Lógica pura (`reservations.slots.ts`, `utils/protocol.ts`) | unit | Todos os ramos; 1:1 com os ACs de blocos, janela e unidades livres; relógio injetado | `apps/api/src/**/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Middleware `rate-limit`, `errorHandler` | integration | 429 e mapeamento de `AppError` por `fastify.inject` | `apps/api/src/http/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Service + repository + rotas de `reservations` e `tracking` | integration (PostgreSQL de teste) | Todos os endpoints: caminho feliz + cada erro + concorrência; **um único arquivo** `apps/api/src/http/reservations-routes.test.ts` | `apps/api/src/http/reservations-routes.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Schemas Zod, controllers, erros, helper de banco de teste | none | build gate (exercitados pelos testes acima) | - | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | unit tests only | `pnpm --filter @saas/api exec vitest run` |
| Full | integration tests | `pnpm --filter @saas/api exec vitest run` |
| Build | config/entity/wiring | `pnpm --filter @saas/api run check-types` |

Pré-requisito dos testes de integração com banco: container `hackathon-postgres` ativo (porta 5433); o helper cria o banco `hackathon_test` e aplica as migrations sozinho.

---

## Execution Plan

Phases run sequentially; tasks run in order within a phase. A cadeia é linear:

```
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16 -> T17 -> T18 -> T19 -> T20 -> T21
```

### Phase 1: Fundações (erro, lógica pura, limitador, base de teste)

Tasks T1..T7.

### Phase 2: Módulos `reservations` e `tracking`

Tasks T8..T17.

### Phase 3: Registro e testes de integração

Tasks T18..T21.

---

## Task Breakdown

### T1: `AppError`

**What**: Erro genérico com `statusCode`, `code` e `message`.
**Where**: `apps/api/src/http/routes/_errors/app-error.ts`
**Depends on**: None
**Reuses**: padrão de `unauthorized-error.ts`.
**Requirement**: RSV-04, RSV-05, RSV-06, RSV-08, RSV-09

**Done when**:
- [x] `AppError extends Error` com `statusCode: number` e `code: string`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T2: `errorHandler` responde `AppError`

**What**: Ramo novo no handler: `{ statusCode, code, message }` com o status do `AppError`; demais ramos intactos.
**Where**: `apps/api/src/http/error-handler.ts`
**Depends on**: T1
**Reuses**: handler e `error-response.test.ts` existentes.
**Requirement**: RSV-05, RSV-06, RSV-08, RSV-09

**Done when**:
- [x] `AppError(409, 'SLOT_UNAVAILABLE', ...)` responde `409` com `{ statusCode, code, message }`; outros códigos idem (400, 429).
- [x] Teste de integração acrescentado em `apps/api/src/http/error-response.test.ts`; os testes existentes seguem verdes.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T3: Gerador de protocolo

**What**: `generateProtocol()` com `crypto.randomInt` sobre o alfabeto do seed.
**Where**: `apps/api/src/utils/protocol.ts`
**Depends on**: T2
**Reuses**: alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` do `prisma/seed.ts`.
**Requirement**: RSV-04

**Done when**:
- [x] Formato `CAP-XXXX-XXXX` (13 caracteres), só caracteres do alfabeto.
- [x] Teste unitário `apps/api/src/utils/protocol.test.ts`: formato, alfabeto e 5.000 valores sem repetição.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: unit
**Gate**: quick

---

### T4: Lógica pura de blocos e unidades livres

**What**: `reservations.slots.ts` com fuso, blocos, janela, simultaneidade e validação do `startAt`.
**Where**: `apps/api/src/modules/reservations/reservations.slots.ts`
**Depends on**: T3
**Reuses**: nada de banco; regras do spec (D1-D4, D11).
**Requirement**: RSV-01, RSV-02, RSV-05

**Done when**:
- [x] `localDateToUtc`, `localWeekday`, `buildBlocks`, `isWithinWindow`, `freeUnits`, `currentBlock`, `validateStartAt` conforme o design.
- [x] `buildBlocks`: blocos de `slotMinutes` da `openTime` a `closeTime − loanDurationMinutes`; vazio para dia fechado ou sem linha; remove bloco cujo fim já passou (mantém o em andamento); vazio além de hoje + `maxAdvanceDays`.
- [x] `freeUnits`: unidades − maior simultaneidade na janela, mínimo 0 (reservas que não coexistem não se somam).
- [x] `validateStartAt`: `outside_hours` (fora do expediente ou dia fechado), `invalid` (desalinhado, passado ou além da antecedência), senão `ok`.
- [x] Teste unitário `reservations.slots.test.ts` cobrindo cada ramo, com `now` injetado e fuso UTC−3.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: unit
**Gate**: quick

---

### T5: Limitador de requisições em memória

**What**: `rateLimit({ max, windowMs })` por IP, janela fixa, contador próprio por instância.
**Where**: `apps/api/src/http/middlewares/rate-limit.ts`
**Depends on**: T4
**Reuses**: `AppError` (T1); hook `onRequest` (conta também requisições inválidas).
**Requirement**: RSV-09

**Done when**:
- [x] A 11ª requisição na janela do mesmo IP responde `429 TOO_MANY_REQUESTS`; a janela seguinte volta a aceitar.
- [x] Contador por instância do limitador (cada app de teste começa zerado).
- [x] Teste de integração `apps/api/src/http/rate-limit.test.ts` com relógio controlado.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T6: Renomear `trancking` para `tracking`

**What**: Mover a pasta do módulo (todos os arquivos estão vazios) com `git mv`.
**Where**: `apps/api/src/modules/tracking/`
**Depends on**: T5
**Reuses**: `git mv apps/api/src/modules/trancking apps/api/src/modules/tracking`; confirmar com busca que nada importa o nome antigo.
**Requirement**: RSV-08

**Done when**:
- [x] A pasta se chama `tracking`; nenhum arquivo referencia `trancking`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T7: Helper do banco de teste

**What**: `setupTestDb`, `resetTestDb` e `testPrisma` para o PostgreSQL `hackathon_test`.
**Where**: `apps/api/src/test/test-db.ts`
**Depends on**: T6
**Reuses**: `prisma migrate deploy` e as migrations existentes; `DATABASE_URL` do ambiente ou do `.env` da raiz (sem imprimir a senha).
**Requirement**: RSV-07

**Done when**:
- [x] `setupTestDb()` cria o banco `hackathon_test` se não existir e aplica as migrations uma vez; falha com mensagem clara se o PostgreSQL não responde.
- [x] `resetTestDb()` faz `TRUNCATE` das tabelas operacionais e semeia expediente (domingo 14:00-20:00, demais dias 10:00-22:00, como o seed), `ReservationSettings` padrão, dois locais, aviso de privacidade ativo `1.0` e equipamentos (cadeira adulto 4, cadeira infantil 2, cadeira inativa 1, carrinho simples 5, carrinho duplo 2).
- [x] `testPrisma` exportado; o helper nunca toca o banco `hackathon`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T8: Schemas de `reservations`

**What**: Contratos Zod de disponibilidade e criação.
**Where**: `apps/api/src/modules/reservations/reservations.schemas.ts`
**Depends on**: T7
**Reuses**: `LocationSchema` de `locations.schemas`; padrão de `services.schemas`.
**Requirement**: RSV-01, RSV-02, RSV-04, RSV-05

**Done when**:
- [x] `AvailabilityParamsSchema`, `AvailabilityQuerySchema` (data real), `AvailabilitySchema`.
- [x] `CreateReservationSchema`: regras de validação do spec (telefone `^[0-9]{10,11}$`, nome ≤ 120 com `trim`, `notes` ≤ 200, `email`, `consent.accepted` literal `true`; `scheduled` exige `startAt`; `forWhom`/`size` só `wheelchair`, `strollerKind` só `stroller`).
- [x] `ReservationCreatedSchema`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T9: Schemas de `tracking`

**What**: Contratos Zod do cancelamento e da `TrackingView`.
**Where**: `apps/api/src/modules/tracking/tracking.schemas.ts`
**Depends on**: T8
**Reuses**: `UserSchema`-style do projeto; contrato `TrackingView` do OpenAPI.
**Requirement**: RSV-08

**Done when**:
- [x] `CancelParamsSchema` (`protocol`), `CancelBodySchema` (`phone`, `reason ≤ 200`).
- [x] `TrackingViewSchema` com `protocol`, `type`, `publicStatus`, `createdAt`, `summary`, `timeline`, `messages`, `canCancel`, `canReply`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T10: Repository de `reservations`

**What**: Leituras, demanda não atendida, criação transacional com trava e cancelamento atômico.
**Where**: `apps/api/src/modules/reservations/reservations.repository.ts`
**Depends on**: T9
**Reuses**: `../../lib/prisma`, `generateProtocol` (T3).
**Requirement**: RSV-01, RSV-03, RSV-04, RSV-06, RSV-07, RSV-08

**Done when**:
- [x] Leituras: `getSettings`, `getOpeningHour`, `getEquipmentUnits`, `getPickupLocation`, `findActiveReservations`, `findActiveLocation`, `findActivePrivacyVersion`.
- [x] `recordUnmetDemand(type, requestedFor)`.
- [x] `createReservationTx`: `$transaction` com `pg_advisory_xact_lock(hashtext('equipment:<tipo>'))`, contagem do limite por telefone e tipo (status `reserved`/`picked_up`), releitura das reservas da janela, `freeUnits`, protocolo (repete em colisão), `Request` + `Reservation` + `Consent` + `RequestHistory`; resultado `created` | `limit` | `slot_unavailable`.
- [x] `cancelReservationTx`: por protocolo + telefone; `updateMany` condicional em `status = reserved`; grava `completedAt` e histórico; resultado `not_found` | `not_cancellable` | `cancelled`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T11: `getAvailability` no service

**What**: Monta a `Availability` e registra a demanda não atendida.
**Where**: `apps/api/src/modules/reservations/reservations.service.ts`
**Depends on**: T10
**Reuses**: `reservations.slots`, repository.
**Requirement**: RSV-01, RSV-02, RSV-03

**Done when**:
- [x] `getAvailability(type, date, now)` devolve `equipmentType`, `date`, `slotMinutes`, `loanDurationMinutes`, `nowAvailable` (só hoje) e `slots` com `availableUnits`/`available` por bloco.
- [x] Registra `UnmetDemand` só em dia aberto, dentro da janela e sem nenhum bloco livre; falha ao registrar não derruba a resposta.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T12: `createReservation` no service

**What**: Validações, modo `now`, transação e `ReservationCreated`.
**Where**: `apps/api/src/modules/reservations/reservations.service.ts`
**Depends on**: T11
**Reuses**: `AppError`, `validateStartAt`, `currentBlock`, repository.
**Requirement**: RSV-04, RSV-05, RSV-06, RSV-07

**Done when**:
- [x] `createReservation(input, now)`: consentimento (`400 CONSENT_REQUIRED`), local atual ativo (`400 VALIDATION_ERROR`), `startAt` (`400 OUTSIDE_OPENING_HOURS` / `VALIDATION_ERROR`), modo `now` com bloco atual e `pickupDeadline` = agora + tolerância.
- [x] `limit` → `409 ACTIVE_RESERVATION_LIMIT`; `slot_unavailable` → `409 SLOT_UNAVAILABLE`.
- [x] `endAt` = `startAt` + empréstimo e `pickupDeadline` = `startAt` + tolerância (modo `scheduled`); devolve `ReservationCreated` com `pickupLocation` e `trackingPath`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T13: `cancelReservation` no service

**What**: Traduz o resultado do repository e monta a `TrackingView` da reserva.
**Where**: `apps/api/src/modules/reservations/reservations.service.ts`
**Depends on**: T12
**Reuses**: `NotFoundError`, `AppError`, repository.
**Requirement**: RSV-08

**Done when**:
- [x] `cancelReservation(protocol, phone, reason, now)`: protocolo inexistente, telefone diferente, anonimizada ou formato inválido → `NotFoundError` genérico; não reserva (outro tipo) ou status diferente de `reserved` → `409 REQUEST_NOT_CANCELLABLE`.
- [x] `TrackingView`: `publicStatus` `cancelled`, `summary` com equipamento e horário, `timeline` do histórico, `messages` vazio, `canCancel` e `canReply` falsos; sem dados de terceiros.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T14: Controller de `reservations`

**What**: `getAvailabilityController` e `createReservationController`.
**Where**: `apps/api/src/modules/reservations/reservations.controller.ts`
**Depends on**: T13
**Reuses**: service; padrão de `services.controller`.
**Requirement**: RSV-01, RSV-04

**Done when**:
- [x] `200` com a `Availability`; `201` com a `ReservationCreated`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T15: Controller de `tracking`

**What**: `cancelController`.
**Where**: `apps/api/src/modules/tracking/tracking.controller.ts`
**Depends on**: T14
**Reuses**: service de `reservations`.
**Requirement**: RSV-08

**Done when**:
- [x] `200` com a `TrackingView` do cancelamento.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T16: Rotas públicas de `reservations`

**What**: `GET /equipment/:type/availability` e `POST /reservations`, ao lado das rotas admin.
**Where**: `apps/api/src/modules/reservations/reservations.routes.ts`
**Depends on**: T15
**Reuses**: schemas (T8), controller (T14), `rateLimit` (T5); rotas admin existentes intactas.
**Requirement**: RSV-01, RSV-04, RSV-09, RSV-10

**Done when**:
- [x] Sem `authorize`; `POST /reservations` com `rateLimit({ max: 10, windowMs: 60000 })` em `onRequest`; a consulta sem limite.
- [x] As três rotas admin continuam como estavam.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T17: Rota de cancelamento em `tracking`

**What**: `POST /tracking/:protocol/cancel`.
**Where**: `apps/api/src/modules/tracking/tracking.routes.ts`
**Depends on**: T16
**Reuses**: schemas (T9), controller (T15), `rateLimit` (T5).
**Requirement**: RSV-08, RSV-09, RSV-10

**Done when**:
- [x] Público, com `rateLimit({ max: 10, windowMs: 60000 })`; corpo e parâmetros validados por Zod.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T18: Registrar rotas e testes de disponibilidade

**What**: Registrar `reservationsRoutes` já existente e `trackingRoutes` em `routes.ts`; criar o arquivo de integração com banco e os testes da consulta.
**Where**: `apps/api/src/http/routes.ts`
**Depends on**: T17
**Reuses**: `test-db.ts` (T7), padrão `fastify.inject`; arquivo `apps/api/src/http/reservations-routes.test.ts` (único com banco).
**Requirement**: RSV-01, RSV-02, RSV-03, RSV-10

**Done when**:
- [x] `routes.ts` registra `trackingRoutes` (e `reservationsRoutes` segue registrada).
- [x] Testes de disponibilidade com banco: blocos livres, sem unidades, tipo/data inválidos, tipo sem equipamento ativo, dia fechado, status que ocupam ou liberam, `nowAvailable`, demanda não atendida, sem token e sem dados pessoais.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T19: Testes de criação de reserva

**What**: Testes da criação no mesmo arquivo de integração.
**Where**: `apps/api/src/http/reservations-routes.test.ts`
**Depends on**: T18
**Reuses**: helper de banco, relógio controlado só para `Date`.
**Requirement**: RSV-04, RSV-05, RSV-06, RSV-10

**Done when**:
- [x] Reserva válida (201 com `Request`, `Reservation`, `Consent` e histórico), `endAt`/`pickupDeadline`, modo `now`, dados inválidos, consentimento, fora do período, horário ocupado, limite por telefone, nova reserva após cancelada/devolvida, configurações do Gestor, local inexistente e campos do outro tipo.
- [x] Falha no meio da transação (gatilho temporário no banco de teste) não deixa `Request` órfão.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T20: Testes de concorrência e limites

**What**: Testes de simultaneidade, quantidade limitada e limite de requisições.
**Where**: `apps/api/src/http/reservations-routes.test.ts`
**Depends on**: T19
**Reuses**: `Promise.all` de `app.inject` (no máximo 8 por teste, abaixo do limite de 10 por minuto por app).
**Requirement**: RSV-06, RSV-07, RSV-09

**Done when**:
- [x] N requisições simultâneas para U unidades livres criam exatamente U reservas e as demais recebem `409 SLOT_UNAVAILABLE`.
- [x] Requisições simultâneas do mesmo telefone e tipo criam uma reserva; tipos diferentes não se bloqueiam.
- [x] A quantidade de unidades limita as reservas de um bloco; o 11º `POST` na janela recebe `429`; a consulta de disponibilidade nunca recebe `429`.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T21: Testes de cancelamento

**What**: Testes do cancelamento no mesmo arquivo de integração.
**Where**: `apps/api/src/http/reservations-routes.test.ts`
**Depends on**: T20
**Reuses**: helper de banco.
**Requirement**: RSV-08, RSV-10

**Done when**:
- [x] Cancelamento válido (200, status, `completedAt`, histórico), liberação da unidade, 404 idêntico (protocolo, telefone, anonimizada), 409 para `picked_up`/`returned`/`no_show`/`cancelled` e para outro tipo de solicitação, 400 para dados inválidos, cancelamento e retirada simultâneos e visão pública sem dados de terceiros.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

## Checks

**C1** - Blocks run from the opening time to closing minus the loan, in the local time zone (RSV-01, Avail AC 3)
Proof: run test | ✓ slots build blocks from the weekday opening hours

**C2** - A closed weekday or a missing opening-hour row has no blocks (RSV-01, Avail AC 4)
Proof: run test | ✓ slots closed or missing weekday has no blocks

**C3** - Past blocks are dropped and the one in progress is kept (RSV-02, Avail AC 7)
Proof: run test | ✓ slots drop past blocks and keep the one in progress

**C4** - Dates beyond today plus the maximum advance have no blocks (RSV-02, Avail AC 7)
Proof: run test | ✓ slots drop dates beyond the maximum advance

**C5** - Free units use the peak of simultaneous reservations inside the loan window (RSV-01, Avail AC 5)
Proof: run test | ✓ free units use peak simultaneity in the loan window

**C6** - Free units never go below zero (RSV-01, Avail AC 5)
Proof: run test | ✓ free units never go below zero

**C7** - A start outside the opening hours or on a closed day is `outside_hours` (RSV-05, Create AC 9)
Proof: run test | ✓ startAt outside hours is outside_hours

**C8** - A start that is unaligned, past or beyond the advance is `invalid` (RSV-05, Create AC 9)
Proof: run test | ✓ startAt unaligned past or beyond advance is invalid

**C9** - A protocol has the format `CAP-XXXX-XXXX` with the safe alphabet (RSV-04, Create AC 5)
Proof: run test | ✓ protocol matches CAP-XXXX-XXXX with the safe alphabet

**C10** - Thousands of generated protocols do not repeat (RSV-04, Create AC 5)
Proof: run test | ✓ protocol values are unique across many calls

**C11** - An `AppError` is answered with its status and `{ statusCode, code, message }` (RSV-05, RSV-06)
Proof: run test | ✓ AppError becomes its status and code

**C12** - The 11th request of one origin in a minute returns 429 `TOO_MANY_REQUESTS` and the next window accepts again (RSV-09, Abuse AC 1)
Proof: run test | ✓ rate limit returns 429 after 10 requests and recovers next window

**C13** - Availability lists blocks with free units for an open day (RSV-01, Avail AC 1)
Proof: run test | ✓ availability lists blocks with free units for an open day

**C14** - With every unit taken, the blocks are unavailable (RSV-01, Avail AC 5)
Proof: run test | ✓ availability with every unit taken marks blocks unavailable

**C15** - An invalid type or date returns 400 `VALIDATION_ERROR` (RSV-02, Avail AC 9)
Proof: run test | ✓ availability invalid type or date returns 400 VALIDATION_ERROR

**C16** - A type without active equipment has no free blocks (RSV-01, Avail AC 10)
Proof: run test | ✓ availability type without active equipment has no free blocks

**C17** - A closed day returns empty slots (RSV-02, Avail AC 4)
Proof: run test | ✓ availability closed day returns empty slots

**C18** - `reserved` and `picked_up` take a unit; `cancelled`, `returned` and `no_show` do not (RSV-01, Avail AC 5/6)
Proof: run test | ✓ availability counts reserved and picked_up but not cancelled returned or no_show

**C19** - `nowAvailable` is set only when the date is today (RSV-02, Avail AC 8)
Proof: run test | ✓ availability nowAvailable is set only for today

**C20** - An unmet demand is recorded when no block is free in an open day inside the window (RSV-03, Demand AC 1)
Proof: run test | ✓ availability records unmet demand when no block is free

**C21** - No unmet demand is recorded when a block is free, the date is outside the window or the day is closed (RSV-03, Demand AC 2)
Proof: run test | ✓ availability does not record unmet demand outside its conditions

**C22** - Availability needs no token and exposes no personal data (RSV-10, Avail AC 2/11)
Proof: run test | ✓ availability needs no token and exposes no personal data

**C23** - A valid request returns 201 and stores the request, reservation, consent and history together (RSV-04, Create AC 1/2)
Proof: run test | ✓ reservation valid request returns 201 and stores request reservation consent and history

**C24** - `endAt` and `pickupDeadline` follow the current settings (RSV-04, Create AC 3)
Proof: run test | ✓ reservation computes endAt and pickupDeadline from the settings

**C25** - Mode `now` uses the current block and a deadline of now plus tolerance (RSV-04, Create AC 4)
Proof: run test | ✓ reservation now mode uses the current block

**C26** - Invalid data returns 400 `VALIDATION_ERROR` and stores nothing (RSV-05, Create AC 6/7)
Proof: run test | ✓ reservation invalid data returns 400 and stores nothing

**C27** - A missing consent or a wrong notice version returns 400 `CONSENT_REQUIRED` and stores nothing (RSV-05, Create AC 8)
Proof: run test | ✓ reservation without valid consent returns 400 CONSENT_REQUIRED

**C28** - A start outside the allowed period is rejected with the documented code (RSV-05, Create AC 9)
Proof: run test | ✓ reservation outside the allowed period is rejected

**C29** - An unknown location or fields of the other equipment type return 400 (RSV-05, Create AC 10/11)
Proof: run test | ✓ reservation with an unknown location or fields of the other type returns 400

**C30** - A taken slot returns 409 `SLOT_UNAVAILABLE` (RSV-06, Create AC 13)
Proof: run test | ✓ reservation on a taken slot returns 409 SLOT_UNAVAILABLE

**C31** - A second active reservation of the same phone and type returns 409 `ACTIVE_RESERVATION_LIMIT`; another type or phone passes (RSV-06, Create AC 12)
Proof: run test | ✓ reservation second active reservation of the phone returns 409 ACTIVE_RESERVATION_LIMIT

**C32** - The phone can book again after the previous reservation was cancelled or returned (RSV-06, Edge)
Proof: run test | ✓ reservation allowed again after the previous one is cancelled or returned

**C33** - Changing the settings does not alter stored reservations and applies to new availability and bookings (RSV-04, Create AC 15)
Proof: run test | ✓ settings changes apply to new bookings and keep stored reservations

**C34** - A failure in the middle of the transaction leaves no orphan request (RSV-04, Create AC 14)
Proof: run test | ✓ reservation failure leaves no orphan request

**C35** - The equipment quantity limits the reservations of a block (RSV-06, Create AC 13)
Proof: run test | ✓ equipment quantity limits the reservations of a block

**C36** - Simultaneous requests create exactly as many reservations as free units and answer the rest 409 (RSV-07, Conc AC 1)
Proof: run test | ✓ simultaneous reservations create exactly as many as there are free units

**C37** - Simultaneous requests from one phone and type create one reservation (RSV-07, Conc AC 2)
Proof: run test | ✓ simultaneous reservations from one phone create only one

**C38** - Simultaneous bookings of different types do not block each other (RSV-07, Conc AC 3)
Proof: run test | ✓ simultaneous reservations of different types both succeed

**C39** - Booking requests over 10 per minute return 429; availability is never limited (RSV-09, Abuse AC 1/2)
Proof: run test | ✓ reservation endpoint is rate limited and availability is not

**C40** - A valid cancellation returns 200 with the cancelled view and records `completedAt` and history (RSV-08, Cancel AC 1/2)
Proof: run test | ✓ cancel valid reservation returns 200 and records history

**C41** - A cancellation frees the unit in availability and in a new booking (RSV-08, Cancel AC 3)
Proof: run test | ✓ cancel frees the unit for availability and a new booking

**C42** - An unknown protocol, a wrong phone and an anonymized request return the same 404 (RSV-08, Cancel AC 4)
Proof: run test | ✓ cancel unknown protocol wrong phone or anonymized returns the same 404

**C43** - A `picked_up`, `returned`, `no_show` or `cancelled` reservation returns 409 `REQUEST_NOT_CANCELLABLE` and stays as it was (RSV-08, Cancel AC 5)
Proof: run test | ✓ cancel in a final or picked up status returns 409 REQUEST_NOT_CANCELLABLE

**C44** - An invalid phone or a long reason returns 400 (RSV-08, Cancel AC 6)
Proof: run test | ✓ cancel invalid phone or reason returns 400

**C45** - A cancellation and a pickup at the same time apply a single transition (RSV-08, Cancel AC 7)
Proof: run test | ✓ cancel and pickup at the same time apply one transition

**C46** - A request that is not a reservation returns 409 `REQUEST_NOT_CANCELLABLE` (RSV-08, Cancel AC 9)
Proof: run test | ✓ cancel of a request that is not a reservation returns 409

**C47** - The cancellation view has only public fields and needs no token (RSV-10, Cancel AC 8)
Proof: run test | ✓ cancel view exposes only public fields without a token

**C48** - The availability answers even when recording the unmet demand fails (RSV-03, Demand AC 3)
Proof: run test | ✓ availability still answers when recording the unmet demand fails

**C49** - A protocol that collides with an existing one is replaced by another (RSV-04, Create AC 5)
Proof: run test | ✓ reservation retries the protocol after a collision

**C50** - The booking lock is per equipment type and the availability takes no lock (RSV-07, Conc AC 3/4)
Proof: run test | ✓ booking lock is per type and availability takes no lock

**C51** - Reducing the equipment keeps stored reservations and limits new ones (RSV-06, Edge)
Proof: run test | ✓ equipment reduction keeps stored reservations and limits new ones

**C52** - The advance window setting applies to bookings and to the availability (RSV-02, RSV-05)
Proof: run test | ✓ advance window setting applies to bookings and availability

**C53** - A failed booking logs no name, phone or e-mail (RSV-10, Security)
Proof: run test | ✓ reservation failure log holds no personal data

**C54** - Values at the documented limits (name 120, notes 200, phone 10 and 11 digits, reason 200) are accepted (RSV-05, RSV-08)
Proof: run test | ✓ reservation accepts values at the documented limits

**C55** - Mode `now` needs a free unit in the current block (RSV-04, Create AC 4)
Proof: run test | ✓ reservation now mode needs a free unit in the current block

**C56** - `nowAvailable` follows the opening hours, the last block and the local day (RSV-02, Avail AC 8)
Proof: run test | ✓ availability nowAvailable follows the opening hours and the local day

---

## Handoff

**Settled mid-build:** none
**Dispatched:** Verifier @ 2aa9a44 (pending)
**Walked:** none
