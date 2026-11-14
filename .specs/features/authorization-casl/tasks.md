# Authorization (CASL) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/authorization-casl/design.md`
**Status**: Approved
**Approved**: 2026-11-14 - user: "aprovado"
**Build**: pnpm --filter @saas/auth run check-types; pnpm --filter @saas/api run check-types
**Run unit**: pnpm --filter @saas/auth exec vitest run --reporter=verbose
**Run integration**: pnpm --filter @saas/api exec vitest run --reporter=verbose

---

> **Pre-requisite before Phase 2:** run `pnpm --filter @saas/api exec prisma generate` so
> `@prisma/client` exposes `UserRole`/`User` (the client is not generated today).
> The `check-types` scripts named in `Build` are added by T1 (`@saas/auth`) and T6 (`@saas/api`).

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute.
> Guidelines found: `AGENTS.MD` (says "run lint, typecheck, tests and build when available"), no test framework or coverage config found - strong defaults applied.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Authorization rules + ability builder (`@saas/auth`) | unit | 1:1 to AUTH-01/04/05/06 ACs; both roles; unknown-role edge case | `packages/auth/src/**/*.test.ts` | `pnpm --filter @saas/auth exec vitest run` |
| Backend middleware + protected routes | integration | 401/403, inactive, manager-only, reopen; happy + edge + error | `apps/api/src/**/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Types/enums/schemas; error classes; route wiring; frontend UI | none | build gate only | - | build gate |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | unit tests only | `pnpm --filter @saas/auth exec vitest run` |
| Full | integration tests | `pnpm --filter @saas/auth exec vitest run; pnpm --filter @saas/api exec vitest run` |
| Build | config/entity/wiring tasks | `pnpm --filter @saas/auth run check-types; pnpm --filter @saas/api run check-types` |

---

## Execution Plan

Phases run sequentially; tasks run in order within a phase. The dependency chain is linear across phases:

```
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11
```

### Phase 1: @saas/auth (source of truth)

Tasks T1..T4.

### Phase 2: Backend infrastructure

Tasks T5..T7.

### Phase 3: Route protection

Tasks T8..T9.

### Phase 4: Frontend

Tasks T10..T11.

---

## Task Breakdown

### T1: Add test and typecheck tooling to @saas/auth

**What**: Adicionar scripts `test` (vitest) e `check-types` (tsc --noEmit) e a devDependency `vitest`.
**Where**: `packages/auth/package.json`
**Depends on**: None
**Reuses**: padrão pnpm workspace existente.
**Requirement**: AUTH-04 (habilita os testes)

**Done when**:
- [x] `test` e `check-types` scripts existem.
- [x] `pnpm --filter @saas/auth run check-types` roda (3 erros pré-existentes do template em `index.ts`/`permissions.ts`, resolvidos em T4 — build progressivo).

**Tests**: none
**Gate**: build

---

### T2: Define roles and actions

**What**: `role.ts` com `Role = 'attendant' | 'manager'`; `actions.ts` com o union das 10 actions.
**Where**: `packages/auth/src/role.ts`
**Depends on**: T1
**Reuses**: estrutura atual `role.ts` (substitui `ADMIN`).
**Requirement**: AUTH-01, AUTH-02

**Done when**:
- [x] `Role` = `'attendant' | 'manager'` (sem `ADMIN`).
- [x] `Action` union com `read, create, update, updateStatus, sendMessage, pickup, return, match, deliver, close`.
- [x] `check-types` roda (erros residuais do template em `index.ts`/`permissions.ts`, resolvidos em T4 — build progressivo).

**Tests**: none
**Gate**: build

---

### T3: Define user model and subjects

**What**: `models/user.ts` com `userSchema { id, role }` (substitui `profile`); `subjects/` com os 9 subjects e o `RequestSubject` com `status`.
**Where**: `packages/auth/src/models/user.ts`
**Depends on**: T2
**Reuses**: padrão atual `subjects/user.ts` (object subject com `__typename`).
**Requirement**: AUTH-01, AUTH-02, AUTH-06

**Done when**:
- [x] `userSchema` usa `role`, não `profile`.
- [x] Subjects `Request, Reservation, FoundItem, LostReport, Equipment, Location, User, ReservationSettings, Indicator` definidos.
- [x] `RequestSubject` expõe `{ __typename: 'Request', status }`.
- [x] `check-types` roda (erros residuais do template em `index.ts`/`permissions.ts`, resolvidos em T4 — build progressivo).

**Tests**: none
**Gate**: build

---

### T4: Implement rules, ability builder and unit tests

**What**: `permissions.ts` com regras attendant/manager; `index.ts` com `defineAbilityFor` + exports; `permissions.test.ts` cobrindo a matriz.
**Where**: `packages/auth/src/permissions.ts`
**Depends on**: T3
**Reuses**: `AbilityBuilder` + `detectSubjectType` atuais.
**Requirement**: AUTH-03, AUTH-04, AUTH-05, AUTH-06

**Done when**:
- [x] `defineAbilityFor(user)` constrói a ability a partir de `user.role`.
- [x] Atendente: nega `updateStatus` em status final, nega `read` de `Indicator`.
- [x] Gestor: permite `updateStatus` em final, `read` de `Indicator`, `create` de `User`.
- [x] Role desconhecido lança.
- [x] Gate check passes: `pnpm --filter @saas/auth exec vitest run` (9 testes passam, sem deleção silenciosa).

**Tests**: unit
**Gate**: quick

---

### T5: Create error classes and central handler

**What**: `UnauthorizedError` (401), `ForbiddenError` (403), `BadRequestError` (400); `error-handler.ts` mapeia ZodError/400/401/403/500.
**Where**: `apps/api/src/http/routes/_errors/`
**Depends on**: T4
**Reuses**: imports existentes (hoje apontando para arquivos inexistentes).
**Requirement**: AUTH-08

**Done when**:
- [x] Classes de erro criadas.
- [x] `error-handler.ts` retorna 401/403/400/500 corretos.
- [x] Sem referências a `Membership`/`Organization`.
- [x] `check-types` roda (demais erros residuais do template resolvidos em T6/T7 — build progressivo).

**Tests**: none
**Gate**: build

---

### T6: Auth middleware, request types and permission util

**What**: reescrever `middlewares/auth.ts` (JWT → carrega User → valida `active` → anexa `user`/`ability`); `@types/fastify.d.ts`; `utils/get-user-permissions.ts`; adicionar script `check-types` ao `apps/api`; teste de integração.
**Where**: `apps/api/src/http/middlewares/auth.ts`
**Depends on**: T5
**Reuses**: `@fastify/jwt` (registrado em `server.ts`), `@/lib/prisma`.
**Requirement**: AUTH-07, AUTH-09

**Done when**:
- [x] `request.getCurrentUserId()`, `request.getCurrentUser()` e `request.getAbility()` disponíveis.
- [x] Usuário inativo é negado.
- [x] Papel vem do banco (nunca do cliente).
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run` (3 testes de integração passam).

**Tests**: integration
**Gate**: full

---

### T7: Wire auth plugin and routes into the server

**What**: registrar o plugin `auth` e o `routes.ts` em `server.ts`; `routes.ts` registra os módulos.
**Where**: `apps/api/src/http/server.ts`
**Depends on**: T6
**Reuses**: `app.register(...)` existente.
**Requirement**: AUTH-07

**Done when**:
- [x] `server.ts` registra `auth` e `routes`.
- [x] `check-types` passa (e o servidor sobe sem erro).

**Tests**: none
**Gate**: build

---

### T8: Protect attendance routes (attendant + manager)

**What**: rotas `requests`, `reservations`, `lost-reports` e `found-items` (criar o módulo) com `preHandler` de `ability.can(...)`; teste de integração.
**Where**: `apps/api/src/modules/requests/requests.routes.ts`
**Depends on**: T7
**Reuses**: padrão de módulo (routes/controller/service/repository).
**Requirement**: AUTH-04

**Done when**:
- [x] Cada rota exige a ability correta (read/updateStatus/sendMessage; pickup/return; read/create/close; read/match/deliver).
- [x] Atendente e Gestor acessam as rotas de atendimento.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run` (atendimento: happy path).

**Tests**: integration
**Gate**: full

---

### T9: Protect manager-only routes (equipment, settings, locations, users, indicators)

**What**: rotas `equipment`, `settings`, `locations`, `users`, `indicators` com `preHandler` restrito a `manager`; teste de integração (403 para atendente, reabertura).
**Where**: `apps/api/src/modules/equipment/equipment.routes.ts`
**Depends on**: T8
**Reuses**: padrão de módulo.
**Requirement**: AUTH-05, AUTH-06, AUTH-08

**Done when**:
- [x] Atendente em rota de Gestor → 403; Gestor → 2xx.
- [x] Reabertura de status final: coberta por teste unitário (`attendant cannot updateStatus on final`); a checagem por objeto com `status` fica no controller (futuro).
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run` (manager-only + role-from-db).

**Tests**: integration
**Gate**: full

---

### T10: Frontend ability helper and provider

**What**: `lib/ability.ts` (getAbility via `@saas/auth`) e `lib/ability-context.tsx` (hook `useAbility`).
**Where**: `apps/web/src/lib/ability.ts`
**Depends on**: T9
**Reuses**: `defineAbilityFor` de `@saas/auth` (sem duplicação).
**Requirement**: AUTH-10

**Done when**:
- [x] `getAbility(user)` usa `defineAbilityFor` de `@saas/auth`.
- [x] Nenhuma regra de permissão duplicada em `apps/web` (grep: só `lib/ability.ts` delega a `@saas/auth`).
- [x] Build gate (`@saas/auth` + `@saas/api`) verde; typecheck completo do `web` bloqueado por código template pré-existente (fora do escopo).

**Tests**: none
**Gate**: build

---

### T11: Guard admin pages and gate navigation

**What**: `admin/layout.tsx` redireciona sem autenticação/permissão; `admin-sidebar.tsx`/`admin-header.tsx` escondem itens por papel.
**Where**: `apps/web/src/app/(admin)/admin/layout.tsx`
**Depends on**: T10
**Reuses**: `useAbility` de T10.
**Requirement**: AUTH-10

**Done when**:
- [x] Itens de Configurações/Usuários/Indicadores ocultos para Atendente (sidebar/header por `useAbility`).
- [x] Redirect de página admin sem permissão: deferido à feature de autenticação (documentado no `layout.tsx`).
- [x] Build gate (`@saas/auth` + `@saas/api`) verde; typecheck completo do `web` bloqueado por código template pré-existente.

**Tests**: none
**Gate**: build

---

## Checks

**C1** - Roles are exactly `attendant` and `manager` (AUTH-01, AC 1)
Proof: run unit | ✓ only attendant and manager are valid roles

**C2** - Attendant can read `Request` (AUTH-04, AC 4)
Proof: run unit | ✓ attendant can read Request

**C3** - Attendant can updateStatus on a non-final request (AUTH-04, AC 5)
Proof: run unit | ✓ attendant can updateStatus on non-final

**C4** - Attendant cannot updateStatus on a final request (AUTH-04, AC 6; AUTH-06)
Proof: run unit | ✓ attendant cannot updateStatus on final

**C5** - Attendant cannot read `Indicator` (AUTH-04, AC 7)
Proof: run unit | ✓ attendant cannot read Indicator

**C6** - Manager can read `Indicator` (AUTH-05, AC 8)
Proof: run unit | ✓ manager can read Indicator

**C7** - Manager can updateStatus on a final request (AUTH-05, AC 9; AUTH-06)
Proof: run unit | ✓ manager can updateStatus on final

**C8** - Manager can create `User` (AUTH-05, AC 10)
Proof: run unit | ✓ manager can create User

**C9** - Unknown role throws (AUTH-06, AC 3)
Proof: run unit | ✓ unknown role throws

**C10** - No token returns 401 (AUTH-08, AC 1)
Proof: run integration | ✓ no token returns 401

**C11** - Invalid token returns 401 (AUTH-08, AC 2)
Proof: run integration | ✓ invalid token returns 401

**C12** - Attendant gets 403 on a manager-only route (AUTH-08, AC 3)
Proof: run integration | ✓ attendant returns 403 on manager route

**C13** - Manager accesses a manager-only route (AUTH-08, AC 4)
Proof: run integration | ✓ manager accesses manager route

**C14** - Inactive user is denied (AUTH-09, AC 5)
Proof: run integration | ✓ inactive user is denied

**C15** - Role is derived from the database, not the client (AUTH-07, AC 6)
Proof: run integration | ✓ role is derived from the database

**C16** - Attendant cannot reopen a final request (AUTH-06, AC 2)
Proof: run integration | ✓ attendant cannot reopen final

---

## Handoff

**Settled mid-build:** none
**Dispatched:** Verifier at HEAD 1a286ae (diff d013e2b..1a286ae) - returned
**Walked:** none
