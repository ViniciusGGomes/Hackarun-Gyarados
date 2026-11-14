# Equipment Operations Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/equipment-operations/design.md`
**Status**: Approved
**Approved**: 2026-11-14 - user: "aprovo"
**Build**: pnpm --filter @saas/api run check-types
**Run test**: pnpm --filter @saas/api exec vitest run --reporter=verbose

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute.
> Guidelines found: `capim-dourado-servicos/AGENTS.MD` (CASL no backend, histórico, `America/Araguaina`, rodar typecheck e testes); Vitest tests in `apps/api/src/**` from the previous features are the floor for style and location.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Lógica pura (`equipment-operations.logic.ts`) | unit | Todos os ramos; limites exatos de atraso e janela; montagem dos blocos (ordem, bloco próprio da reserva fora dos blocos) | `apps/api/src/modules/equipment-operations/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Service + repository + rotas administrativas | integration (PostgreSQL de teste) | Os três endpoints: caminho feliz + cada erro + autorização + concorrência + auditoria; **um arquivo** `apps/api/src/http/equipment-operations-routes.test.ts` | `apps/api/src/http/equipment-operations-routes.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Job (`src/jobs/mark-no-show.ts`) | integration (PostgreSQL de teste) | Elegibilidade, idempotência, simultaneidade, `job_logs`, falha | `apps/api/src/jobs/mark-no-show.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Schemas Zod, controller, mapper, helper de teste | none | build gate (exercitados pelos testes acima) | - | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | unit tests only | `pnpm --filter @saas/api exec vitest run` |
| Full | integration tests | `pnpm --filter @saas/api exec vitest run` |
| Build | config/wiring | `pnpm --filter @saas/api run check-types` |

Pré-requisito dos testes com banco: container `hackathon-postgres` ativo (porta 5433); o helper cria o banco `hackathon_test` e aplica as migrations sozinho.

---

## Execution Plan

Phases run sequentially; tasks run in order within a phase. A cadeia é linear:

```
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12
```

### Phase 1: Base (apoio de teste, lógica pura)

Tasks T1..T2.

### Phase 2: Módulo `equipment-operations`

Tasks T3..T7.

### Phase 3: Rotas, testes e job

Tasks T8..T12.

---

## Task Breakdown

### T1: Apoio de teste: usuário e sessão no banco de teste

**What**: `resetTestDb` passa a truncar `users`/`sessions`; helper que cria um usuário `attendant` ou `manager` com sessão válida.
**Where**: `apps/api/src/test/test-db.ts`
**Depends on**: None
**Reuses**: `testPrisma`, modelos `User` e `Session`.
**Requirement**: EQP-10

**Done when**:
- [x] `resetTestDb` inclui `users` e `sessions` no `TRUNCATE`.
- [x] `seedStaff(role)` cria o usuário (hash qualquer, ativo) e a sessão, e devolve `{ userId, sessionId }`.
- [x] A suíte inteira continua verde.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: none
**Gate**: full

---

### T2: Lógica pura da agenda e dos atrasos

**What**: Sinais de atraso, janela da retirada e montagem dos blocos da agenda.
**Where**: `apps/api/src/modules/equipment-operations/equipment-operations.logic.ts`
**Depends on**: T1
**Reuses**: `freeUnits` e tipos de `reservations.slots`.
**Requirement**: EQP-01, EQP-02, EQP-03

**Done when**:
- [x] `isPickupOverdue`, `isReturnOverdue`, `pickupWindowOpen` e `assembleSlots` conforme o design.
- [x] Teste unitário `equipment-operations.logic.test.ts`: limites exatos dos atrasos (igual ao prazo não é atraso), todos os status, janela com extremos incluídos, ordem dos blocos, reserva fora dos blocos em bloco próprio, `freeUnits` só com `reserved`/`picked_up`; o teste do check C8 tem o nome indicado nos Checks.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: unit
**Gate**: quick

---

### T3: Schemas de `equipment-operations`

**What**: Contratos Zod de consulta, parâmetros, corpos e respostas.
**Where**: `apps/api/src/modules/equipment-operations/equipment-operations.schemas.ts`
**Depends on**: T2
**Reuses**: `LocationSchema` de `locations.schemas`; padrão de `reservations.schemas.ts`.
**Requirement**: EQP-02, EQP-07, EQP-09, EQP-14

**Done when**:
- [x] `AgendaQuerySchema`, `IdParamsSchema`, `PickupBodySchema` e `ReturnBodySchema` (corpo opcional; `notes` e `conditionNotes` ≤ 300 com `trim` e remoção de caracteres de controle; campos desconhecidos descartados).
- [x] `AgendaSchema` e `RequestDetailSchema` com os campos do OpenAPI.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T4: Repository de `equipment-operations`

**What**: Leituras da agenda e do detalhe, as transações de retirada, devolução e não comparecimento, e o `job_logs`.
**Where**: `apps/api/src/modules/equipment-operations/equipment-operations.repository.ts`
**Depends on**: T3
**Reuses**: `prisma`; padrão do `cancelReservationTx` de `reservations.repository.ts`.
**Requirement**: EQP-04, EQP-08, EQP-11, EQP-12, EQP-13

**Done when**:
- [ ] `findAgendaReservations`, `findOperable`, `loadDetail`, `pickupTx`, `returnTx`, `markNoShowsTx`, `logJob` conforme o design.
- [ ] Todas as mudanças de status são `updateMany` condicional dentro de `$transaction`, com o histórico criado só quando `count = 1`; `markNoShowsTx` percorre os ids em ordem crescente.
- [ ] `check-types` passa; os testes de integração vêm nas tarefas T8 a T12.

**Tests**: none
**Gate**: build

---

### T5: Mapper do `RequestDetail` de reservas

**What**: Monta a resposta `RequestDetail` de uma reserva.
**Where**: `apps/api/src/modules/equipment-operations/equipment-operations.mapper.ts`
**Depends on**: T4
**Reuses**: `isPickupOverdue`/`isReturnOverdue` (T2).
**Requirement**: EQP-12, EQP-14

**Done when**:
- [ ] `visitor`, `reservation` (com `currentLocation`, `pickupOverdue` e `returnOverdue`), `history` em ordem crescente com `actor { type, userId, name }`, `lostReport` e `sacMessage` nulos e `messages` vazia.
- [ ] Nenhum campo de senha, token ou de outro visitante.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T6: Service de `equipment-operations`

**What**: Regras da agenda, retirada, devolução e do não comparecimento.
**Where**: `apps/api/src/modules/equipment-operations/equipment-operations.service.ts`
**Depends on**: T5
**Reuses**: `reservationsRepository` (leituras), `AppError`, `NotFoundError`, `buildBlocks`.
**Requirement**: EQP-01, EQP-04, EQP-05, EQP-06, EQP-08, EQP-09, EQP-13

**Done when**:
- [ ] `getAgenda`, `registerPickup`, `registerReturn` e `markNoShows` com `now` por parâmetro.
- [ ] Ordem das respostas: `404` (não existe, não é reserva ou anonimizada), `400` (documento exigido), `409 INVALID_STATUS_TRANSITION` com mensagem por motivo; sucesso devolve o `RequestDetail`.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T7: Controller de `equipment-operations`

**What**: Traduz as requisições HTTP para o service e responde `200`.
**Where**: `apps/api/src/modules/equipment-operations/equipment-operations.controller.ts`
**Depends on**: T6
**Reuses**: padrão de `reservations.controller.ts`; `request.getCurrentUserId()`.
**Requirement**: EQP-01, EQP-04, EQP-08

**Done when**:
- [ ] Controllers `getAgendaController`, `pickupController` e `returnController`, sem Prisma nem regra de negócio.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T8: Rotas, registro e testes da agenda e da autorização

**What**: Registra as três rotas no módulo novo, retira os stubs de `reservations.routes.ts` e cria o arquivo de integração com os testes da agenda e da autorização.
**Where**: `apps/api/src/modules/equipment-operations/equipment-operations.routes.ts`
**Depends on**: T7
**Reuses**: `authorize`, plugin `auth`, `test-db.ts`, `buildApp` de `reservations-routes.test.ts` (com `fastifyJwt` e `auth` registrados).
**Requirement**: EQP-01, EQP-02, EQP-03, EQP-10

**Done when**:
- [ ] As três rotas com `authorize('read'|'pickup'|'return', 'Reservation')` e schemas Zod; registradas em `http/routes.ts`; os stubs saem de `reservations.routes.ts`.
- [ ] Cria `apps/api/src/http/equipment-operations-routes.test.ts` com testes com os nomes dos checks C1 a C7, C9, C10 e C29 a C32.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T9: Testes da retirada

**What**: Retirada válida, janela, estados, documento, validação e detalhe.
**Where**: `apps/api/src/http/equipment-operations-routes.test.ts` (modify)
**Depends on**: T8
**Reuses**: helpers do próprio arquivo.
**Requirement**: EQP-04, EQP-05, EQP-06, EQP-07, EQP-14

**Done when**:
- [ ] Testes com os nomes dos checks C11 a C21 e C50 a C52; os de erro conferem que nada mudou.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T10: Testes da devolução

**What**: Devolução válida, liberação da unidade, atraso, estados e validação.
**Where**: `apps/api/src/http/equipment-operations-routes.test.ts` (modify)
**Depends on**: T9
**Reuses**: helpers do próprio arquivo.
**Requirement**: EQP-08, EQP-09

**Done when**:
- [ ] Testes com os nomes dos checks C22 a C28.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T11: Testes de concorrência e auditoria

**What**: Operações simultâneas sobre a mesma reserva, falha na transação e histórico.
**Where**: `apps/api/src/http/equipment-operations-routes.test.ts` (modify)
**Depends on**: T10
**Reuses**: trigger de falha de `lost-reports-routes.test.ts`; `markNoShows` do service; o cancelamento público.
**Requirement**: EQP-11, EQP-12

**Done when**:
- [ ] Testes com os nomes dos checks C33 a C38, C40 e C41; os de simultaneidade repetem rodadas e conferem uma linha de histórico por transição.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T12: Job de não comparecimento e testes

**What**: `runMarkNoShow` com `job_logs`, `startNoShowJob` com `setInterval`, ligado em `server.ts`, e seus testes.
**Where**: `apps/api/src/jobs/mark-no-show.ts`
**Depends on**: T11
**Reuses**: `markNoShows` do service, `logJob` do repository; padrão do banco de teste.
**Requirement**: EQP-12, EQP-13

**Done when**:
- [ ] `runMarkNoShow(now)` grava `job_logs` só se afetou reservas ou falhou; `startNoShowJob()` roda a cada 60 s com `unref()` e pula a execução se a anterior ainda não terminou; `server.ts` o inicia após o `listen`.
- [ ] Teste `apps/api/src/jobs/mark-no-show.test.ts` com os nomes dos checks C39, C42 a C49, C53 e C54.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run` e `pnpm --filter @saas/api run check-types`.

**Tests**: integration
**Gate**: full

---

## Checks

Os textos após `✓` são os títulos dos testes; cada check aponta o critério da spec.

**C1** - The agenda returns the slots of the day in ascending order of start (EQP-01, Agenda AC 1)
Proof: run test | ✓ agenda returns the slots of the day in ascending order

**C2** - Each slot carries start, end, totalUnits, freeUnits and its reservations with id, protocol, visitorName, status and the two overdue flags (EQP-01, Agenda AC 2)
Proof: run test | ✓ agenda slots carry units and reservations with their fields

**C3** - totalUnits is the sum of active equipment and freeUnits discounts the peak of reserved and picked_up reservations only (EQP-01, Agenda AC 3)
Proof: run test | ✓ agenda totals and free units count only reserved and picked up reservations

**C4** - Reservations of every status are listed (EQP-01, Agenda AC 4)
Proof: run test | ✓ agenda lists reservations of every status

**C5** - A closed day or a day without an opening-hour row has no slots (EQP-02, Agenda AC 5)
Proof: run test | ✓ agenda of a closed day or a day without opening hours has no slots

**C6** - Past dates and dates beyond the maximum advance still return their slots (EQP-02, Agenda AC 6)
Proof: run test | ✓ agenda accepts past dates and dates beyond the advance limit

**C7** - A reservation that starts outside the current blocks is listed in its own slot (EQP-02, Agenda AC 7)
Proof: run test | ✓ agenda lists a reservation that starts outside the current blocks in its own slot

**C8** - The overdue flags follow status and clock, equal to the limit is not overdue (EQP-03, Agenda AC 8)
Proof: run test | ✓ overdue flags follow status and the clock at the exact limits

**C9** - The agenda carries no phone, e-mail, notes or other contact data (EQP-03, Agenda AC 9)
Proof: run test | ✓ agenda carries no contact data

**C10** - A missing or invalid date or equipment type answers 400 VALIDATION_ERROR (EQP-02, Agenda AC 10)
Proof: run test | ✓ agenda rejects a missing or invalid date and equipment type

**C11** - A pickup inside the window returns 200 with picked_up and the server time (EQP-04, Pickup AC 1)
Proof: run test | ✓ pickup inside the window returns 200 with picked_up and the server time

**C12** - The pickup stores status, time, document and notes with one history row of the user (EQP-04, Pickup AC 2)
Proof: run test | ✓ pickup stores the status the times the document and the notes with one history row

**C13** - A time, status or user sent in the body is ignored (EQP-07, Pickup AC 3)
Proof: run test | ✓ pickup ignores time status and user sent in the body

**C14** - A pickup of a picked_up, returned, cancelled or no_show reservation answers 409 and changes nothing (EQP-05, Pickup AC 4)
Proof: run test | ✓ pickup of a reservation in another status returns 409

**C15** - A pickup before the block start or after the deadline answers 409 and changes nothing (EQP-05, Pickup AC 5)
Proof: run test | ✓ pickup before the block start and after the deadline returns 409

**C16** - A pickup at the exact start and at the exact deadline is accepted (EQP-05, Pickup AC 5; Edge)
Proof: run test | ✓ pickup at the exact start and at the exact deadline is accepted

**C17** - When the setting asks for the document, a pickup without documentChecked true answers 400 (EQP-06, Pickup AC 6)
Proof: run test | ✓ pickup requires the document when the setting asks for it

**C18** - When it is not required, documentChecked absent, true or false is accepted (EQP-06, Pickup AC 7)
Proof: run test | ✓ pickup accepts the document absent or false when it is not required

**C19** - Notes above 300 and a non-boolean documentChecked answer 400 (EQP-07, Pickup AC 8)
Proof: run test | ✓ pickup rejects invalid notes and document values

**C20** - A malformed id answers 400; an unknown, non-reservation or anonymized request answers 404 (EQP-07, Pickup AC 9)
Proof: run test | ✓ pickup answers 400 for a malformed id and 404 for unknown other-type or anonymized

**C21** - The window uses the stored pickupDeadline, not the current tolerance setting (EQP-05, Pickup AC 10)
Proof: run test | ✓ pickup uses the stored deadline and not the current tolerance setting

**C22** - A return of a picked_up reservation returns 200 with returned and the server time (EQP-08, Return AC 1)
Proof: run test | ✓ return of a picked up reservation returns 200 with returned and the server time

**C23** - The return stores status, times, notes and completedAt with one history row of the user (EQP-08, Return AC 2)
Proof: run test | ✓ return stores status times notes completedAt and one history row

**C24** - After the return the unit is free in the agenda and in the public availability (EQP-08, Return AC 3)
Proof: run test | ✓ return frees the unit in the agenda and in the public availability

**C25** - A return after endAt is accepted without penalty (EQP-09, Return AC 4)
Proof: run test | ✓ late return is accepted without penalty

**C26** - A return of a reserved, returned, cancelled or no_show reservation answers 409 and changes nothing (EQP-09, Return AC 5)
Proof: run test | ✓ return of a reservation in another status returns 409

**C27** - conditionNotes above 300 answers 400 (EQP-09, Return AC 6)
Proof: run test | ✓ return rejects conditionNotes above 300

**C28** - A malformed id answers 400; an unknown, non-reservation or anonymized request answers 404 (EQP-09, Return AC 7)
Proof: run test | ✓ return answers 400 for a malformed id and 404 for unknown other-type or anonymized

**C29** - The three routes answer 401 without a valid token, with a bad token and with a revoked session (EQP-10, Auth AC 1)
Proof: run test | ✓ the three routes answer 401 without a valid token

**C30** - The three routes answer 403 and change nothing when the user lacks the ability (EQP-10, Auth AC 2)
Proof: run test | ✓ the three routes answer 403 when the user lacks the ability

**C31** - Attendant and manager can use the three routes (EQP-10, Auth AC 3)
Proof: run test | ✓ attendant and manager can use the three routes

**C32** - The role is read from the database on each request (EQP-10, Auth AC 4)
Proof: run test | ✓ the role is read from the database on each request

**C33** - Simultaneous pickups of one reservation give one 200, the rest 409, and one history row (EQP-11, Conc AC 1)
Proof: run test | ✓ simultaneous pickups of one reservation apply only one

**C34** - Simultaneous returns of one reservation give one 200, the rest 409, and one history row (EQP-11, Conc AC 2)
Proof: run test | ✓ simultaneous returns of one reservation apply only one

**C35** - A pickup and a public cancellation at the same time apply exactly one transition (EQP-11, Conc AC 3)
Proof: run test | ✓ pickup and public cancellation at the same time apply one transition

**C36** - A pickup and the no-show routine at the same time apply exactly one transition (EQP-11, Conc AC 4)
Proof: run test | ✓ pickup and no-show run at the same time apply one transition

**C37** - A failure in a status change rolls back status and history together and answers 500 (EQP-11, Conc AC 5)
Proof: run test | ✓ failure inside a status change rolls back status and history together

**C38** - History rows hold previous and new status, time, actor type and user for pickup and return (EQP-12, Audit AC 1)
Proof: run test | ✓ history rows hold previous and new status time actor type and user

**C39** - The no-show history has actor system and no user (EQP-12, Audit AC 2)
Proof: run test | ✓ no-show history has system actor and no user

**C40** - The detail history is in ascending order with actor type, user id and name (EQP-12, Audit AC 3)
Proof: run test | ✓ detail history is ascending with actor type user id and name

**C41** - The public tracking view never exposes history actors or internal notes (EQP-12, Audit AC 4)
Proof: run test | ✓ public tracking view never exposes history actors or internal notes

**C42** - The routine marks a reserved reservation past its deadline as no_show with completedAt and history (EQP-13, Job AC 1)
Proof: run test | ✓ no-show marks a reserved reservation past its deadline

**C43** - A reservation within the tolerance, including the exact deadline, is not touched (EQP-13, Job AC 2)
Proof: run test | ✓ no-show leaves reservations within the tolerance untouched

**C44** - Cancelled, picked_up, returned and already no_show reservations are not touched (EQP-13, Job AC 3)
Proof: run test | ✓ no-show ignores cancelled picked up returned and already no-show reservations

**C45** - A second run right after the first affects nothing and adds no history (EQP-13, Job AC 4)
Proof: run test | ✓ no-show run twice affects nothing the second time

**C46** - Simultaneous runs mark each eligible reservation once with one history row (EQP-13, Job AC 5)
Proof: run test | ✓ simultaneous no-show runs mark each reservation once

**C47** - A no_show reservation frees its unit in the public availability (EQP-13, Job AC 6)
Proof: run test | ✓ no-show frees the unit in the public availability

**C48** - A failed run changes nothing and logs the failure in job_logs without personal data (EQP-13, Job AC 7)
Proof: run test | ✓ failed no-show run changes nothing and logs the failure without personal data

**C49** - The routine has no public endpoint (EQP-13, Job AC 8)
Proof: run test | ✓ no-show routine has no public endpoint

**C50** - The pickup response carries the visitor, the reservation data and the history (EQP-14, Detail AC 1)
Proof: run test | ✓ pickup response carries visitor reservation and history

**C51** - The detail of a reservation has null lostReport and sacMessage and no messages (EQP-14, Detail AC 2)
Proof: run test | ✓ detail of a reservation has null lost report sac message and no messages

**C52** - The detail carries no credentials or data of other visitors (EQP-14, Detail AC 3)
Proof: run test | ✓ detail carries no credentials or data of other visitors

**C53** - job_logs gets a row only when reservations were affected or the run failed (EQP-13, Q5)
Proof: run test | ✓ job log is written only when reservations were affected or the run failed

**C54** - The job runner skips a run while the previous one is still going (EQP-13, Q5)
Proof: run test | ✓ job runner skips an overlapping run

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** none
**Dispatched:** none
**Walked:** none
