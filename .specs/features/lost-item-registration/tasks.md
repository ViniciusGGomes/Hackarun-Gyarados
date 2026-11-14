# Lost Item Registration Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/lost-item-registration/design.md`
**Status**: Approved
**Approved**: 2026-11-14 - user: "aprovo"
**Build**: pnpm --filter @saas/api run check-types
**Run test**: pnpm --filter @saas/api exec vitest run --reporter=verbose

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute.
> Guidelines found: `capim-dourado-servicos/AGENTS.MD` (Zod nas rotas, sem dados pessoais expostos, rodar typecheck e testes); Vitest tests in `apps/api/src/**` from the previous features are the floor for style and location.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Schema Zod (`lost-reports.schemas.ts`) | unit | Cada regra de validação do spec (obrigatórios, enums, telefone, e-mail, limites, texto vazio, `photoUrl`, data real/futura/hoje local, exclusividade do local, `trim`, campos extras), sem banco | `apps/api/src/modules/lost-reports/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| `errorHandler` | integration | Fallback `500 INTERNAL_ERROR` e log sem dados | `apps/api/src/http/error-response.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Service + repository + rota de `lost-reports` | integration (PostgreSQL de teste) | `POST /lost-reports`: caminho feliz + cada erro + atomicidade + privacidade + limite; **um arquivo** `apps/api/src/http/lost-reports-routes.test.ts` | `apps/api/src/http/lost-reports-routes.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Controller, config do Vitest | none | build gate (exercitados pelos testes de rota) | - | build gate |

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
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10
```

### Phase 1: Base (testes sem corrida, erro 500)

Tasks T1..T2.

### Phase 2: Módulo `lost-reports`

Tasks T3..T6.

### Phase 3: Rota e testes de integração

Tasks T7..T10.

---

## Task Breakdown

### T1: Vitest sem corrida entre arquivos de banco

**What**: Config do Vitest que roda um arquivo de teste por vez, porque dois arquivos usam o mesmo banco de teste e o `TRUNCATE` de um apagaria os dados do outro.
**Where**: `apps/api/vitest.config.mts`
**Depends on**: None
**Reuses**: nada (o pacote não tem config do Vitest).
**Requirement**: LIR-02

**Done when**:
- [x] `fileParallelism: false` e o mesmo comportamento atual para o resto (padrões de include, ambiente node).
- [x] A suíte inteira continua verde.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: none
**Gate**: full

---

### T2: `errorHandler` responde `500 INTERNAL_ERROR` sem dados pessoais

**What**: O fallback passa a responder `{ statusCode: 500, code: 'INTERNAL_ERROR', message }` e a registrar só `name` e `code` do erro.
**Where**: `apps/api/src/http/error-handler.ts`
**Depends on**: T1
**Reuses**: handler e `error-response.test.ts` existentes.
**Requirement**: LIR-07, LIR-10

**Done when**:
- [x] Um erro inesperado responde `500` com `{ statusCode, code: 'INTERNAL_ERROR', message }` genérico, sem stack nem texto do erro.
- [x] O log registra `name` e `code` e nunca a mensagem do erro nem o corpo da requisição.
- [x] Teste `unexpected error returns 500 INTERNAL_ERROR and logs only name and code` (check C36) em `error-response.test.ts`; os testes existentes que esperavam `{ message }` no 500 são ajustados ao novo corpo e continuam verdes.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T3: Schemas Zod de `lost-reports`

**What**: `CreateLostReportSchema` (todas as regras de corpo do spec) e `ProtocolCreatedSchema`.
**Where**: `apps/api/src/modules/lost-reports/lost-reports.schemas.ts`
**Depends on**: T2
**Reuses**: `localDateOf` de `reservations.slots`; padrão de `reservations.schemas.ts`.
**Requirement**: LIR-04, LIR-05, LIR-06, LIR-08

**Done when**:
- [x] `CreateLostReportSchema`: obrigatórios, enums, telefone `^[0-9]{10,11}$`, e-mail ≤ 255, limites 120/500/300/500, `name`/`description` não vazios após `trim`, `photoUrl` `http`/`https`, `lostDate` real e ≤ hoje local, um e só um entre `locationId` e `unknownLocation: true`, `trim` e remoção de caracteres de controle (quebra de linha mantida em `description` e `identificationDetail`), campos extras descartados.
- [x] `ProtocolCreatedSchema` com os quatro campos e `CreateLostReportInput` exportado.
- [x] Teste unitário `lost-reports.schemas.test.ts` com um teste por regra, com os nomes dos checks C9 a C22.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: unit
**Gate**: quick

---

### T4: Repository de `lost-reports`

**What**: Consultas de aviso ativo e local ativo, e a criação atômica do registro.
**Where**: `apps/api/src/modules/lost-reports/lost-reports.repository.ts`
**Depends on**: T3
**Reuses**: `privacyRepository.findActive`, `generateProtocol`, padrão de `reservations.repository.ts` (laço de protocolo livre).
**Requirement**: LIR-02, LIR-03, LIR-07, LIR-09

**Done when**:
- [ ] `findActivePrivacyVersion()` e `findActiveLocation(id)`.
- [ ] `createLostReportTx(data)`: em uma transação, acha um protocolo livre e grava `Request` (`lost_report`, `registered`) com `LostReport`, `Consent` (`purpose` `atender a solicitação`) e `RequestHistory` (`null` → `registered`, `visitor`); `lostDate` gravada como meia-noite UTC do dia enviado.
- [ ] `check-types` passa; os testes de integração do repository vêm nos testes de rota (T7 a T10).

**Tests**: none
**Gate**: build

---

### T5: Service de `lost-reports`

**What**: Regras que dependem do banco e montagem da resposta.
**Where**: `apps/api/src/modules/lost-reports/lost-reports.service.ts`
**Depends on**: T4
**Reuses**: `AppError`; padrão de `createReservation`.
**Requirement**: LIR-01, LIR-06, LIR-09

**Done when**:
- [ ] `createLostReport(input)`: `accepted` falso, versão diferente da ativa ou sem aviso ativo → `AppError(400, 'CONSENT_REQUIRED')`; `locationId` sem `Location` ativa → `AppError(400, 'VALIDATION_ERROR')`; sucesso devolve `{ protocol, status: 'registered', createdAt, trackingPath: '/acompanhar/{protocol}' }`.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T6: Controller de `lost-reports`

**What**: Traduz o pedido HTTP para o service e responde `201`.
**Where**: `apps/api/src/modules/lost-reports/lost-reports.controller.ts`
**Depends on**: T5
**Reuses**: padrão de `reservations.controller.ts`.
**Requirement**: LIR-01

**Done when**:
- [ ] `createLostReportController` lê o corpo já validado, chama o service e responde `201` com o resultado.
- [ ] Sem acesso ao Prisma nem regra de negócio no controller.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T7: Rota `POST /lost-reports` e testes do caminho feliz

**What**: Registra a rota com `rateLimit` e schema Zod, e cria o arquivo de integração com os testes de sucesso, persistência e protocolo.
**Where**: `apps/api/src/modules/lost-reports/lost-reports.routes.ts`
**Depends on**: T6
**Reuses**: `test-db.ts`, o `buildApp` e o `vi.mock` de protocolo de `reservations-routes.test.ts`.
**Requirement**: LIR-01, LIR-02, LIR-03, LIR-04

**Done when**:
- [ ] `POST /lost-reports` com `onRequest: rateLimit({ max: 10, windowMs: 60_000 })`, `body: CreateLostReportSchema` e `response: { 201: ProtocolCreatedSchema }`; as rotas admin do arquivo ficam como estão.
- [ ] Cria `apps/api/src/http/lost-reports-routes.test.ts` com testes com os nomes dos checks C1 a C6 e C8, usando o banco de teste, relógio controlado e `resetTestDb`.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T8: Testes de local e consentimento

**What**: Casos de local inválido, `unknownLocation` e consentimento.
**Where**: `apps/api/src/http/lost-reports-routes.test.ts` (modify)
**Depends on**: T7
**Reuses**: helpers do próprio arquivo.
**Requirement**: LIR-06, LIR-09

**Done when**:
- [ ] Testes com os nomes dos checks C23, C24 e C25 a C27; os casos de erro conferem que nada foi gravado.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T9: Testes de falha, privacidade e bordas

**What**: Rollback, resposta e log sem dados pessoais, status ignorado e corpos malformados.
**Where**: `apps/api/src/http/lost-reports-routes.test.ts` (modify)
**Depends on**: T8
**Reuses**: helpers do próprio arquivo; o `500` de T2.
**Requirement**: LIR-07, LIR-08, LIR-10

**Done when**:
- [ ] Testes com os nomes dos checks C7 e C28 a C35; o de falha força o erro dentro da transação (consentimento com versão sem aviso, depois do `Request` criado) e confere zero linhas.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T10: Testes do limite de requisições

**What**: `429`, contagem de inválidas e fim da janela.
**Where**: `apps/api/src/http/lost-reports-routes.test.ts` (modify)
**Depends on**: T9
**Reuses**: padrão do teste de limite de `reservations-routes.test.ts`.
**Requirement**: LIR-11

**Done when**:
- [ ] Testes com os nomes dos checks C37 a C39, com o relógio controlado para a janela.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run` e `pnpm --filter @saas/api run check-types`.

**Tests**: integration
**Gate**: full

---

## Checks

Os nomes entre crases são os títulos dos testes. Cada check aponta o critério da spec.

**C1** - A valid report returns `201` with `protocol`, `status` `registered`, `createdAt` and `trackingPath` `/acompanhar/{protocol}` (LIR-01, Reg AC 1)
Proof: run test | ✓ valid report returns 201 with protocol status createdAt and trackingPath

**C2** - A valid report creates the `Request`, `LostReport`, `Consent` and first `RequestHistory` with the sent values (LIR-02, Reg AC 2)
Proof: run test | ✓ valid report persists request lost report consent and history

**C3** - An absent `lostPeriod` is stored as `unknown` and an absent `unknownLocation` as `false` (LIR-02, Reg AC 3)
Proof: run test | ✓ absent lostPeriod and unknownLocation store unknown and false

**C4** - Match, delivery, completion and anonymization fields stay empty on creation (LIR-02, Reg AC 4)
Proof: run test | ✓ creation leaves match delivery completion and anonymization empty

**C5** - The protocol has the `CAP-XXXX-XXXX` format and a colliding protocol is replaced by another (LIR-03, Reg AC 5)
Proof: run test | ✓ protocol has the CAP format and a colliding protocol is replaced

**C6** - Two identical reports create two requests with distinct protocols (LIR-03, Reg AC 6)
Proof: run test | ✓ two identical reports create two distinct protocols

**C7** - A failure inside the transaction leaves no rows and returns `500` `INTERNAL_ERROR` (LIR-07, Reg AC 7)
Proof: run test | ✓ failure inside the transaction leaves no rows and returns 500 INTERNAL_ERROR

**C8** - The route validates the body with the Zod schema before the controller and answers `400` `VALIDATION_ERROR` (LIR-04, Val AC 1)
Proof: run test | ✓ route validates the body with the schema before the controller

**C9** - Each missing required field is rejected (LIR-04, Val AC 2)
Proof: run test | ✓ each missing required field is rejected

**C10** - `category` and `lostPeriod` accept only the enum values (LIR-04, Val AC 3)
Proof: run test | ✓ category and lostPeriod accept only the enum values

**C11** - `phone` accepts only ten or eleven digits (LIR-04, Val AC 4)
Proof: run test | ✓ phone accepts only ten or eleven digits

**C12** - `email` must be a valid address of at most 255 characters (LIR-04, Val AC 5)
Proof: run test | ✓ email must be valid and at most 255 characters

**C13** - Text limits accept the exact size (120, 500, 300, 500) and reject one more (LIR-04, Val AC 6)
Proof: run test | ✓ text limits accept the exact size and reject one more

**C14** - `name` and `description` reject empty and whitespace-only values (LIR-04, Val AC 7)
Proof: run test | ✓ name and description reject empty and whitespace only

**C15** - `photoUrl` accepts only `http` and `https` URIs (LIR-04, Val AC 8)
Proof: run test | ✓ photoUrl accepts only http and https URIs

**C16** - `lostDate` rejects dates that do not exist (LIR-05, Val AC 9)
Proof: run test | ✓ lostDate rejects dates that do not exist

**C17** - `lostDate` rejects tomorrow in `America/Araguaina` (LIR-05, Val AC 10)
Proof: run test | ✓ lostDate rejects tomorrow in the local time zone

**C18** - `lostDate` accepts today in `America/Araguaina` even when it is already tomorrow in UTC (LIR-05, Val AC 11)
Proof: run test | ✓ lostDate accepts today in the local time zone even when UTC is tomorrow

**C19** - Neither `locationId` nor `unknownLocation` `true` is rejected (LIR-06, Val AC 12)
Proof: run test | ✓ location is rejected when neither locationId nor unknownLocation is sent

**C20** - Both `locationId` and `unknownLocation` `true` are rejected (LIR-06, Val AC 13)
Proof: run test | ✓ location is rejected when both locationId and unknownLocation are sent

**C21** - Text fields are trimmed and control characters removed before the limits (LIR-04, Val AC 16)
Proof: run test | ✓ text fields are trimmed and control characters removed

**C22** - Fields outside `CreateLostReport` are stripped (LIR-08, Val AC 17)
Proof: run test | ✓ unknown fields are stripped

**C23** - A malformed, unknown or inactive `locationId` answers `400` `VALIDATION_ERROR` and stores nothing (LIR-06, Val AC 14)
Proof: run test | ✓ unknown inactive or malformed location is rejected with 400

**C24** - `unknownLocation` without `locationId` is stored with `locationId` empty and `unknownLocation` `true` (LIR-06, Val AC 15)
Proof: run test | ✓ unknownLocation without locationId is stored as unknown location

**C25** - `consent.accepted` false answers `400` `CONSENT_REQUIRED` and stores nothing (LIR-09, Cons AC 1)
Proof: run test | ✓ accepted false is rejected with CONSENT_REQUIRED

**C26** - A wrong version, or no active notice, answers `400` `CONSENT_REQUIRED` and stores nothing (LIR-09, Cons AC 2)
Proof: run test | ✓ wrong or missing active privacy version is rejected with CONSENT_REQUIRED

**C27** - A valid report stores one `Consent` with the version, `purpose` and acceptance time (LIR-09, Cons AC 3)
Proof: run test | ✓ valid report stores one consent with version and purpose

**C28** - The route works without a token (LIR-10, Priv AC 1)
Proof: run test | ✓ route works without a token

**C29** - The `201` body has only the four public fields and no personal data (LIR-10, Priv AC 2)
Proof: run test | ✓ response has only the four public fields and no personal data

**C30** - A `status` sent by the visitor is ignored and the status is `registered` (LIR-08, Priv AC 3)
Proof: run test | ✓ status sent by the visitor is ignored

**C31** - Logs never contain the body or personal fields, even on `500` (LIR-10, Priv AC 4)
Proof: run test | ✓ logs never contain the body or personal fields even on 500

**C32** - A phone used by another visitor's request is not revealed (LIR-10, Priv AC 5)
Proof: run test | ✓ same phone of another visitor is not revealed

**C33** - Reason and health fields are ignored and never stored (LIR-10, Priv AC 6)
Proof: run test | ✓ reason and health fields are ignored and never stored

**C34** - HTML in `description` is stored as text and never echoed (LIR-10, Edge)
Proof: run test | ✓ html in description is stored as text and never echoed

**C35** - An empty array and a malformed JSON body answer `400` `VALIDATION_ERROR` (LIR-04, Edge)
Proof: run test | ✓ empty array and malformed JSON bodies return 400

**C36** - An unexpected error answers `500` `INTERNAL_ERROR` and logs only name and code (LIR-07, LIR-10, Reg AC 7)
Proof: run test | ✓ unexpected error returns 500 INTERNAL_ERROR and logs only name and code

**C37** - The eleventh request in a minute from one origin answers `429` `TOO_MANY_REQUESTS` (LIR-11, Abuse AC 1)
Proof: run test | ✓ eleventh request in a minute returns 429 TOO_MANY_REQUESTS

**C38** - Invalid requests count toward the limit (LIR-11, Abuse AC 2)
Proof: run test | ✓ invalid requests count toward the limit

**C39** - After the one-minute window the origin is accepted again (LIR-11, Abuse AC 3)
Proof: run test | ✓ limit window ends and requests are accepted again

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** none
**Dispatched:** none
**Walked:** none
