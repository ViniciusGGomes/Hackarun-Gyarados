# Public Query Routes Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/public-query-routes/design.md`
**Status**: Approved
**Approved**: 2026-11-14 - user: "quero aprovar Design + tasks e iniciar a execute"
**Build**: pnpm --filter @saas/api run check-types
**Run test**: pnpm --filter @saas/api exec vitest run --reporter=verbose

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute.
> Guidelines found: `AGENTS.MD` (says "run lint, typecheck, tests and build when available"), no test framework/coverage config beyond the Vitest added in the CASL feature - strong defaults applied.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Service (`isOpenNow`, filtros, montagem do `ServiceDetail`) | unit | 1:1 aos ACs de negócio; casos de horário aberto/fechado | `apps/api/src/modules/**/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Rotas/controllers (4 endpoints) | integration | happy path + 404 + sem token | `apps/api/src/http/**/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Schemas (Zod), repositories | none | build gate | - | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | unit tests only | `pnpm --filter @saas/api exec vitest run` |
| Full | integration tests | `pnpm --filter @saas/api exec vitest run` |
| Build | config/entity/wiring | `pnpm --filter @saas/api run check-types` |

---

## Execution Plan

Phases run sequentially; tasks run in order within a phase. The dependency chain is linear across phases:

```
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9
```

### Phase 1: Schemas

Tasks T1..T2.

### Phase 2: Repositories

Tasks T3..T4.

### Phase 3: Services

Tasks T5..T6.

### Phase 4: Controllers + routes

Tasks T7..T8.

### Phase 5: Wiring + integration tests

Task T9.

---

## Task Breakdown

### T1: Zod schemas do módulo services

**What**: `ServiceSchema` e `ServiceDetailSchema` (contratos de resposta, campos públicos apenas).
**Where**: `apps/api/src/modules/services/services.schemas.ts`
**Depends on**: None
**Reuses**: padrão de schemas com `fastify-type-provider-zod`.
**Requirement**: PUB-01, PUB-02, PUB-09

**Done when**:
- [x] `ServiceSchema` com `id, slug, name, shortDescription, icon, kind, flow, equipmentType`.
- [x] `ServiceDetailSchema` com os campos do `ServiceDetail` + `openingHours` e `isOpenNow`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T2: Zod schemas de locations e privacy

**What**: `LocationSchema` e `PrivacyNoticeSchema` (contratos de resposta).
**Where**: `apps/api/src/modules/locations/locations.schemas.ts`
**Depends on**: T1
**Reuses**: padrão de schemas.
**Requirement**: PUB-04, PUB-05, PUB-09

**Done when**:
- [x] `LocationSchema` com `id, name, floor, type, active`.
- [x] `PrivacyNoticeSchema` com `version, text, updatedAt`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T3: Repository do módulo services

**What**: `findManyActive()` (ativos, `orderBy sortOrder`), `findUniqueBySlug(slug)` (com `pickupLocation`), leituras de `OpeningHour` e `ReservationSettings`.
**Where**: `apps/api/src/modules/services/services.repository.ts`
**Depends on**: T2
**Reuses**: `@/lib/prisma`.
**Requirement**: PUB-01, PUB-02, PUB-11

**Done when**:
- [x] `findManyActive` filtra `active: true` e ordena por `sortOrder`.
- [x] `findUniqueBySlug` inclui `pickupLocation`.
- [x] Métodos para `OpeningHour.findMany` e `ReservationSettings.findUnique`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T4: Repositories de locations e privacy

**What**: `findManyActive()` (locations) e `findActive()` (privacy).
**Where**: `apps/api/src/modules/locations/locations.repository.ts`
**Depends on**: T3
**Reuses**: `@/lib/prisma`.
**Requirement**: PUB-04, PUB-05, PUB-10

**Done when**:
- [x] `locations.findManyActive` filtra `active: true`.
- [x] `privacy.findActive` usa `findFirst({ where: { active: true } })`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T5: Service do módulo services (com isOpenNow)

**What**: `listServices()` e `getServiceDetail(slug)` com o cálculo de `isOpenNow` em `America/Araguaina`; teste unitário.
**Where**: `apps/api/src/modules/services/services.service.ts`
**Depends on**: T4
**Reuses**: repository de T3.
**Requirement**: PUB-01, PUB-02, PUB-03, PUB-06, PUB-11

**Done when**:
- [ ] `listServices` retorna os ativos ordenados.
- [ ] `getServiceDetail` monta o `ServiceDetail` (inclui `openingHours`, `isOpenNow`, `pickupLocation`, settings).
- [ ] `getServiceDetail` lança `NotFoundError` para slug inexistente.
- [ ] `isOpenNow` respeita `America/Araguaina` (UTC-3).
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run` (teste unitário do `isOpenNow`).

**Tests**: unit
**Gate**: quick

---

### T6: Services de locations e privacy

**What**: `listActive()` (locations) e `getActive()` (privacy, mapeia `publishedAt` → `updatedAt`).
**Where**: `apps/api/src/modules/locations/locations.service.ts`
**Depends on**: T5
**Reuses**: repositories de T4.
**Requirement**: PUB-04, PUB-05, PUB-08

**Done when**:
- [ ] `locations.listActive` retorna ativos.
- [ ] `privacy.getActive` retorna o vigente e lança `NotFoundError` se não houver ativo.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T7: Controller e rotas do módulo services

**What**: `listServices` e `getService` (controller) + `GET /api/v1/services` e `GET /api/v1/services/:slug` (routes).
**Where**: `apps/api/src/modules/services/services.controller.ts`
**Depends on**: T6
**Reuses**: service de T5, `errorHandler` central.
**Requirement**: PUB-01, PUB-02, PUB-03

**Done when**:
- [ ] Rotas registradas sem `authorize` (públicas).
- [ ] Controller monta a resposta conforme os schemas.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T8: Controllers e rotas de locations e privacy

**What**: controllers/routes de `locations` (adicionar `GET /api/v1/locations` público) e `privacy` (`GET /api/v1/privacy-notice`).
**Where**: `apps/api/src/modules/locations/locations.controller.ts`
**Depends on**: T7
**Reuses**: services de T6; rotas admin de `locations` existentes.
**Requirement**: PUB-04, PUB-05, PUB-07

**Done when**:
- [ ] `GET /api/v1/locations` público adicionado às rotas admin de `locations`.
- [ ] `GET /api/v1/privacy-notice` registrado.
- [ ] Nenhuma rota exige `authorize`.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T9: Registrar rotas e testes de integração

**What**: registrar `servicesRoutes` e `privacyRoutes` em `routes.ts`; testes de integração dos 4 endpoints.
**Where**: `apps/api/src/http/routes.ts`
**Depends on**: T8
**Reuses**: `routes.ts` existente, padrão `fastify.inject` + `vi.mock` (CASL).
**Requirement**: PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-07

**Done when**:
- [ ] `routes.ts` registra `servicesRoutes` e `privacyRoutes`.
- [ ] Testes de integração cobrem os 4 endpoints (200, 404, sem token).
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run` (testes de integração).

**Tests**: integration
**Gate**: full

---

## Checks

**C1** - GET /services returns only active services ordered by sortOrder (PUB-01, AC 2/3)
Proof: run test | ✓ list services returns only active ordered

**C2** - GET /services/:slug returns the ServiceDetail (PUB-02, AC 1)
Proof: run test | ✓ get service detail by slug

**C3** - GET /services/:slug missing slug returns 404 (PUB-03)
Proof: run test | ✓ get service missing slug returns 404

**C4** - GET /locations returns only active locations (PUB-04, AC 2)
Proof: run test | ✓ list locations returns only active

**C5** - GET /privacy-notice returns the active notice (PUB-05, AC 1)
Proof: run test | ✓ get privacy notice returns active

**C6** - isOpenNow is computed from opening hours (PUB-06)
Proof: run test | ✓ isOpenNow is computed

**C7** - public routes work without a token (PUB-07)
Proof: run test | ✓ public routes work without auth

---

## Handoff

**Settled mid-build:** T2 executed before T1 (ServiceDetailSchema needs LocationSchema); PrivacyNoticeSchema lives in privacy.schemas.ts per design; NotFoundError + 404 body {statusCode, code, message} and /api/v1 prefix (server.ts + tests) added in later tasks
**Dispatched:** none
**Walked:** none
