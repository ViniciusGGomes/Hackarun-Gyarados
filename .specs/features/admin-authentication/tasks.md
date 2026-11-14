# Admin Authentication Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/admin-authentication/design.md`
**Status**: Approved
**Approved**: 2026-11-14 - user: "veja a tasks e o design e aprove caso não aja nenhuma complexidade"
**Build**: pnpm --filter @saas/api run check-types
**Run test**: pnpm --filter @saas/api exec vitest run --reporter=verbose

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute.
> Guidelines found: `AGENTS.MD` (run lint, typecheck, tests and build when available); Vitest tests already in `apps/api/src/**` (CASL and public-query-routes features) used as the floor for style and location.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Service (`login`, `validateSession`, `logout`) | unit | 1:1 aos ACs de login, bloqueio e sessão; relógio injetado; Prisma simulado em memória | `apps/api/src/modules/**/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Rotas/controllers/plugin `auth`/`errorHandler` | integration | Os 3 endpoints e as rotas `/admin/*`: caminho feliz + cada erro (400, 401, 403, 423) | `apps/api/src/http/**/*.test.ts` | `pnpm --filter @saas/api exec vitest run` |
| Schemas Zod, constantes, erros, repository, model Prisma | none | build gate | - | build gate |
| Fake de Prisma (utilitário de teste) | none | build gate; exercitado pelos testes dos serviços | - | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | unit tests only | `pnpm --filter @saas/api exec vitest run` |
| Full | integration tests | `pnpm --filter @saas/api exec vitest run` |
| Build | config/entity/wiring | `pnpm --filter @saas/api run check-types` |

---

## Execution Plan

Phases run sequentially; tasks run in order within a phase. A cadeia é linear:

```
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15
```

### Phase 1: Persistência e erros

Tasks T1..T4.

### Phase 2: Núcleo de auth (schemas, repository, serviços)

Tasks T5..T10.

### Phase 3: HTTP (plugin, controller, rotas, integração)

Tasks T11..T15.

---

## Task Breakdown

### T1: Model Prisma `Session` e migration

**What**: Adicionar o model `Session` e a relação `User.sessions`, criar a migration e regenerar o client.
**Where**: `apps/api/prisma/schema.prisma`
**Depends on**: None
**Reuses**: convenções do schema (`@map`, `Timestamptz(3)`, uuid `gen_random_uuid()`). A migration é gerada com `pnpm --filter @saas/api run db:migrate -- --name add_sessions` (PostgreSQL local na porta 5433).
**Requirement**: AUTHN-30, AUTHN-31, AUTHN-32

**Done when**:
- [x] `Session` com `id`, `userId`, `lastActivityAt`, `revokedAt`, `createdAt`, relação `onDelete: Cascade` e `@@index([userId])`.
- [x] `User` ganha `sessions Session[]`; nenhum outro campo de `User` muda.
- [x] Migration criada em `apps/api/prisma/migrations/` e aplicada; `prisma generate` executado.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T2: `InvalidCredentialsError`

**What**: Classe de erro para credenciais inválidas (e usuário inativo no login).
**Where**: `apps/api/src/http/routes/_errors/invalid-credentials-error.ts`
**Depends on**: T1
**Reuses**: padrão de `unauthorized-error.ts`.
**Requirement**: AUTHN-02, AUTHN-03

**Done when**:
- [x] `InvalidCredentialsError extends Error` com mensagem padrão genérica e `name`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T3: `AccountLockedError`

**What**: Classe de erro para conta bloqueada.
**Where**: `apps/api/src/http/routes/_errors/account-locked-error.ts`
**Depends on**: T2
**Reuses**: padrão de `unauthorized-error.ts`.
**Requirement**: AUTHN-10

**Done when**:
- [x] `AccountLockedError extends Error` com mensagem padrão e `name`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T4: `errorHandler` no formato `ErrorResponse`

**What**: Mapear 400 (validação), 401, 403 e os novos 401/423 para `{ statusCode, code, message }` (AD-002); 404, 4xx genérico e 500 ficam como estão.
**Where**: `apps/api/src/http/error-handler.ts`
**Depends on**: T3
**Reuses**: handler existente, `hasZodFastifySchemaValidationErrors` de `fastify-type-provider-zod`; padrão de teste `fastify.inject`.
**Requirement**: AUTHN-50, AUTHN-40

**Done when**:
- [x] `InvalidCredentialsError` → 401 `INVALID_CREDENTIALS`; `AccountLockedError` → 423 `ACCOUNT_LOCKED`; `UnauthorizedError` → 401 `UNAUTHORIZED`; `ForbiddenError` → 403 `FORBIDDEN`; validação Zod e `BadRequestError` → 400 `VALIDATION_ERROR` com `details`.
- [x] Os status codes de `UnauthorizedError`, `ForbiddenError` e `BadRequestError` não mudam; os branches de 404, 4xx genérico e 500 ficam intactos.
- [x] Teste de integração `apps/api/src/http/error-response.test.ts` cobre cada código com uma rota de teste que lança o erro.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run` (todos os testes existentes continuam verdes).

**Tests**: integration
**Gate**: full

---

### T5: Constantes de auth

**What**: Constantes aprovadas (5 tentativas, 15 min, 30 min, 1800 s, 8 h) e o hash fictício.
**Where**: `apps/api/src/modules/auth/auth.constants.ts`
**Depends on**: T4
**Reuses**: `bcryptjs` (custo 10) para gerar o valor de `DUMMY_PASSWORD_HASH` uma única vez.
**Requirement**: AUTHN-10, AUTHN-32, AUTHN-33

**Done when**:
- [x] `MAX_FAILED_ATTEMPTS`, `LOCK_DURATION_MS`, `INACTIVITY_WINDOW_MS`, `EXPIRES_IN_SECONDS`, `TOKEN_MAX_AGE`, `DUMMY_PASSWORD_HASH` exportados.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T6: Schemas Zod de auth

**What**: `LoginBodySchema`, `UserSchema`, `LoginResponseSchema`.
**Where**: `apps/api/src/modules/auth/auth.schemas.ts`
**Depends on**: T5
**Reuses**: padrão de schemas dos módulos `services`/`locations`.
**Requirement**: AUTHN-01, AUTHN-04, AUTHN-20

**Done when**:
- [x] `LoginBodySchema`: `email` (e-mail válido) e `password` (string não vazia).
- [x] `UserSchema`: `id` (uuid), `name`, `email`, `role` (`attendant`|`manager`), `active`; sem `passwordHash`, contadores ou `lastLoginAt`.
- [x] `LoginResponseSchema`: `accessToken`, `expiresIn` (inteiro), `user`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T7: Repository de auth

**What**: Acesso ao Prisma para usuário, tentativas e sessões.
**Where**: `apps/api/src/modules/auth/auth.repository.ts`
**Depends on**: T6
**Reuses**: `../../lib/prisma`.
**Requirement**: AUTHN-10, AUTHN-30, AUTHN-31, AUTHN-32

**Done when**:
- [x] `findUserByEmail`, `resetLock`, `incrementFailedAttempts` (via `update` com `{ increment: 1 }`, devolve o novo valor), `setLockedUntil`, `markLoginSuccess`.
- [x] `createSession`, `findSessionById`, `touchSession`, `revokeSession`.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T8: Fake de Prisma em memória (utilitário de teste)

**What**: `createFakePrisma(seed)` com usuários e sessões em memória e as operações usadas por auth.
**Where**: `apps/api/src/test/fake-prisma.ts`
**Depends on**: T7
**Reuses**: padrão `vi.mock('../lib/prisma')`.
**Requirement**: AUTHN-10, AUTHN-32

**Done when**:
- [x] `user.findUnique` (por `id` e por `email`), `user.update` (aplica `increment` de forma atômica, devolve a linha atualizada), `session.create`, `session.findUnique`, `session.update`.
- [x] Expõe o estado (usuários e sessões) para asserções.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T9: `login` no `auth.service`

**What**: `login(email, password, now)` com normalização de e-mail, hash fictício, bloqueio, reset após o fim do bloqueio, sucesso e criação da sessão; testes unitários.
**Where**: `apps/api/src/modules/auth/auth.service.ts`
**Depends on**: T8
**Reuses**: repository (T7), constantes (T5), fake (T8), `bcryptjs`.
**Requirement**: AUTHN-01, AUTHN-02, AUTHN-03, AUTHN-04, AUTHN-10

**Done when**:
- [x] Teste unitário `apps/api/src/modules/auth/auth.service.test.ts` cobre cada AC de login e bloqueio (cenários T1-T12 do spec) com relógio injetado, nomes distintos dos testes de integração.
- [x] Usuário inexistente executa `bcrypt.compare` contra `DUMMY_PASSWORD_HASH`.
- [x] Senha errada incrementa de forma atômica; a 5ª falha define `lockedUntil = now + 15 min`.
- [x] `lockedUntil > now` lança `AccountLockedError` sem comparar senha nem alterar contadores; após o fim do bloqueio zera e avalia como a 1ª falha.
- [x] Usuário inativo lança `InvalidCredentialsError` sem tocar nos contadores.
- [x] Sucesso zera contadores, limpa `lockedUntil`, grava `lastLoginAt`, cria a `Session` e devolve usuário público + `sessionId`.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: unit
**Gate**: quick

---

### T10: `validateSession` e `logout` no `auth.service`

**What**: Validar a sessão (existência, dono, revogação, inatividade de 30 min, renovação a cada chamada) e revogá-la no logout; testes unitários.
**Where**: `apps/api/src/modules/auth/auth.service.ts`
**Depends on**: T9
**Reuses**: repository (T7), constantes (T5), fake (T8), `UnauthorizedError`.
**Requirement**: AUTHN-30, AUTHN-31, AUTHN-32

**Done when**:
- [x] Testes unitários em `auth.service.test.ts` para sessão inexistente, de outro usuário, revogada, inativa há mais de 30 min (todos `UnauthorizedError`) e válida.
- [x] Atividade dentro da janela mantém a sessão e renova `lastActivityAt`.
- [x] `logout` grava `revokedAt`; depois disso `validateSession` rejeita.
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: unit
**Gate**: quick

---

### T11: Tipo `getCurrentSessionId` no Fastify

**What**: Declarar `getCurrentSessionId(): Promise<string>` em `FastifyRequest`.
**Where**: `apps/api/@types/fastify.d.ts`
**Depends on**: T10
**Reuses**: declaração existente de `getCurrentUserId`/`getCurrentUser`/`getAbility`.
**Requirement**: AUTHN-30

**Done when**:
- [x] `getCurrentSessionId(): Promise<string>` declarado.
- [x] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T12: Plugin `auth` valida a sessão

**What**: `getCurrentUserId` exige `sid` e chama `validateSession`; `getCurrentSessionId` novo; resolução memoizada por request. Adaptar apenas o **arranjo** dos testes existentes (token com `sid`, mock de `prisma.session`), sem mudar asserções nem a contagem de testes.
**Where**: `apps/api/src/http/middlewares/auth.ts`
**Depends on**: T11
**Reuses**: `validateSession` (T10), plugin existente; testes `auth.test.ts`, `authorization.test.ts` e `attendance.test.ts` (somente arranjo).
**Requirement**: AUTHN-20, AUTHN-31, AUTHN-32, AUTHN-40

**Done when**:
- [x] Token sem `sid`, com assinatura inválida, expirado, sessão revogada ou inativa → `UnauthorizedError`.
- [x] Usuário inexistente ou inativo continua → `UnauthorizedError`; o papel continua vindo do banco.
- [x] `getCurrentSessionId` devolve o `sid` validado; uma leitura de sessão por request.
- [x] `auth.test.ts`, `authorization.test.ts` e `attendance.test.ts` passam com o arranjo adaptado: mesmas asserções, mesma quantidade de testes (3 + 5 + 2).
- [x] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

### T13: Controller de auth

**What**: `loginController`, `logoutController`, `meController`; o login assina `{ sub, sid }` com `expiresIn: '8h'` e responde `expiresIn: 1800`.
**Where**: `apps/api/src/modules/auth/auth.controller.ts`
**Depends on**: T12
**Reuses**: `login`/`logout` (T9, T10), constantes, `reply.jwtSign`.
**Requirement**: AUTHN-01, AUTHN-20, AUTHN-30, AUTHN-33

**Done when**:
- [ ] `loginController` responde 200 com `accessToken`, `expiresIn` 1800 e `user`; assina com `expiresIn: '8h'`.
- [ ] `logoutController` responde 204 sem corpo; `meController` devolve o usuário atual.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T14: Rotas de auth

**What**: `POST /auth/login` (público), `POST /auth/logout` e `GET /auth/me` (exigem autenticação), com os schemas de resposta.
**Where**: `apps/api/src/modules/auth/auth.routes.ts`
**Depends on**: T13
**Reuses**: schemas (T6), controller (T13), padrão `withTypeProvider<ZodTypeProvider>()`.
**Requirement**: AUTHN-01, AUTHN-20, AUTHN-30

**Done when**:
- [ ] `/auth/login` sem `authorize` e com `LoginBodySchema`/`LoginResponseSchema`.
- [ ] `/auth/logout` e `/auth/me` autenticam via plugin (sem ability de domínio); `/auth/me` responde `UserSchema`.
- [ ] `check-types` passa.

**Tests**: none
**Gate**: build

---

### T15: Registrar as rotas e testes de integração

**What**: Registrar `authRoutes` em `routes.ts` e testar os 3 endpoints e a integração com CASL.
**Where**: `apps/api/src/http/routes.ts`
**Depends on**: T14
**Reuses**: `routes.ts`, fake de Prisma (T8), padrão `fastify.inject` dos testes existentes.
**Requirement**: AUTHN-01, AUTHN-02, AUTHN-03, AUTHN-04, AUTHN-10, AUTHN-20, AUTHN-30, AUTHN-31, AUTHN-32, AUTHN-33, AUTHN-40, AUTHN-50

**Done when**:
- [ ] `routes.ts` registra `authRoutes`.
- [ ] Testes de integração `apps/api/src/http/auth-routes.test.ts` cobrem os cenários T1-T24 do spec e os edge cases, com os nomes dos checks.
- [ ] Um token emitido pelo login real acessa uma rota `/admin/*` do seu perfil e recebe 403 em rota de Gestor quando for Atendente.
- [ ] Gate check passes: `pnpm --filter @saas/api exec vitest run`.

**Tests**: integration
**Gate**: full

---

## Checks

**C1** - Login as Attendant returns `accessToken`, `expiresIn` 1800 and the public `user` with role `attendant` (AUTHN-01, Login AC 1/2; AUTHN-33)
Proof: run test | ✓ login as attendant returns token and user

**C2** - Login as Manager returns role `manager` (AUTHN-01, Login AC 2)
Proof: run test | ✓ login as manager returns role manager

**C3** - Unknown e-mail returns 401 `INVALID_CREDENTIALS` and no token (AUTHN-02, Login AC 3)
Proof: run test | ✓ login unknown email returns 401 INVALID_CREDENTIALS

**C4** - Wrong password returns 401 with the same body as an unknown e-mail (AUTHN-02, Login AC 4)
Proof: run test | ✓ login wrong password returns the same 401 body

**C5** - An unknown e-mail still runs a bcrypt comparison against the dummy hash (AUTHN-02, Login AC 5)
Proof: run test | ✓ login unknown email compares against the dummy hash

**C6** - An inactive user gets 401 `INVALID_CREDENTIALS`, no token and unchanged counters (AUTHN-03, Login AC 6)
Proof: run test | ✓ login inactive user returns 401 and leaves counters untouched

**C7** - A body without e-mail/password or with an invalid e-mail returns 400 `VALIDATION_ERROR` (AUTHN-04, Login AC 7)
Proof: run test | ✓ login invalid body returns 400 VALIDATION_ERROR

**C8** - No response carries `passwordHash`, `failedLoginAttempts`, `lockedUntil` or `lastLoginAt` (AUTHN-04, Login AC 8)
Proof: run test | ✓ login response has no sensitive fields

**C9** - A bcrypt hash produced like the seed (cost 10) is accepted (AUTHN-04, Login AC 9)
Proof: run test | ✓ login accepts a bcrypt hash produced like the seed

**C10** - A wrong password increments `failedLoginAttempts` by 1 (AUTHN-10, Lock AC 1)
Proof: run test | ✓ wrong password increments failed attempts by one

**C11** - The 5th wrong password sets `lockedUntil` to now + 15 minutes and still answers 401 (AUTHN-10, Lock AC 2)
Proof: run test | ✓ fifth wrong password locks the account for 15 minutes

**C12** - A locked account returns 423 `ACCOUNT_LOCKED` even with the right password, without changing counters or issuing a token (AUTHN-10, Lock AC 3)
Proof: run test | ✓ login locked account returns 423 even with the right password

**C13** - After `lockedUntil` passes the count restarts, so a wrong password counts as the first failure (AUTHN-10, Lock AC 4)
Proof: run test | ✓ login after lock expiry restarts the count

**C14** - A successful login zeroes the attempts, clears the lock and sets `lastLoginAt` (AUTHN-10, Lock AC 5)
Proof: run test | ✓ successful login resets attempts and sets lastLoginAt

**C15** - Simultaneous wrong passwords are all counted (AUTHN-10, Lock AC 6)
Proof: run test | ✓ simultaneous wrong passwords are all counted

**C17** - `GET /auth/me` returns the current user read from the database (AUTHN-20, Me AC 1)
Proof: run test | ✓ me returns the current user from the database

**C18** - A missing, malformed or badly signed token returns 401 `UNAUTHORIZED` (AUTHN-20, Me AC 2)
Proof: run test | ✓ me with an invalid token returns 401 UNAUTHORIZED

**C19** - An expired token returns 401 `UNAUTHORIZED` (AUTHN-20, Me AC 2)
Proof: run test | ✓ me with an expired token returns 401

**C20** - A user deactivated after the token was issued gets 401 (AUTHN-20, Me AC 3)
Proof: run test | ✓ me after the user was deactivated returns 401

**C21** - A role changed in the database applies without a new login (AUTHN-20, Me AC 4)
Proof: run test | ✓ role change applies without a new login

**C22** - A role claim inside the token is ignored (AUTHN-20, Me AC 5)
Proof: run test | ✓ role claim in the token is ignored

**C23** - `POST /auth/logout` returns 204 with no body (AUTHN-30, Session AC 1)
Proof: run test | ✓ logout returns 204

**C24** - A token is rejected with 401 after logout (AUTHN-31, Session AC 2)
Proof: run test | ✓ token is rejected after logout

**C25** - A session idle for more than 30 minutes is rejected with 401 (AUTHN-32, Session AC 3)
Proof: run test | ✓ session idle for more than 30 minutes is rejected

**C26** - Activity within 30 minutes keeps the session valid and extends it (AUTHN-32, Session AC 4)
Proof: run test | ✓ activity within 30 minutes keeps the session alive

**C27** - Logout without a valid token returns 401 (AUTHN-30, Session AC 5)
Proof: run test | ✓ logout without a token returns 401

**C28** - `expiresIn` is 1800 (AUTHN-33, Session AC 6)
Proof: run test | ✓ login expiresIn is 1800 seconds

**C29** - An `/admin/*` route without a token returns 401 (AUTHN-40, Routes AC 1)
Proof: run test | ✓ admin route without token returns 401

**C30** - An Attendant on a manager-only route returns 403 (AUTHN-40, Routes AC 2)
Proof: run test | ✓ attendant returns 403 on manager route

**C31** - A Manager on a manager-only route is not rejected (AUTHN-40, Routes AC 3)
Proof: run test | ✓ manager accesses manager route

**C32** - A token issued by the real login opens an admin route of its role, using the existing CASL ability (AUTHN-40, Routes AC 4/5)
Proof: run test | ✓ token from login opens an admin route of its role

**C33** - Auth errors use `{ statusCode, code, message }` with the documented codes (AUTHN-50, Errors AC 1)
Proof: run test | ✓ auth errors use the ErrorResponse format

**C34** - Existing routes keep their status codes after the error format change (AUTHN-50, Errors AC 2)
Proof: run test | ✓ attendant can access attendance routes

**C35** - An e-mail that differs only in letter case signs in as the same user (Edge case)
Proof: run test | ✓ login email is case-insensitive

**C36** - An `Authorization` header that is not `Bearer <token>` returns 401 (Edge case)
Proof: run test | ✓ me with a non-Bearer header returns 401

**C37** - A lock does not revoke a token already issued (Edge case)
Proof: run test | ✓ lock does not revoke issued tokens

**C38** - Two logins of the same user create two independent sessions (Edge case)
Proof: run test | ✓ two logins create two independent sessions

**C39** - A database failure during login returns 500 without details or a token (Edge case)
Proof: run test | ✓ login database failure returns 500 without details

---

## Handoff

**Settled mid-build:** none
**Dispatched:** none
**Walked:** none
