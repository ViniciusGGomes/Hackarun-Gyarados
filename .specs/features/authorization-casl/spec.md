# Authorization (CASL) Specification

**Status**: Approved
**Approved**: 2026-11-14 - user: "aprovado"

## Problem Statement

A aplicação Capim Dourado Serviços tem dois perfis administrativos (`attendant` e
`manager`) definidos nos requisitos e no OpenAPI, mas o pacote compartilhado
`packages/auth` ainda contém o código do template `next-saas-rbac` (papel `ADMIN`,
`manage all`, campo `profile`). Sem uma camada de autorização correta, rotas
administrativas não podem distinguir o que cada perfil pode fazer, e o frontend não tem
como esconder ações proibidas. Esta feature define, em um único pacote compartilhado,
roles, subjects, actions e abilities (CASL) e as aplica no backend (autoridade final) e
no frontend (controle de interface).

## Goals

- [ ] Um único pacote (`@saas/auth`) define roles, subjects, actions e abilities, sem duplicação entre backend e frontend.
- [ ] O backend protege todas as rotas administrativas com 401 (sem token) e 403 (sem permissão).
- [ ] O frontend reutiliza as mesmas definições para esconder ações e proteger páginas administrativas.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Regras de negócio (transições de status válidas, disponibilidade, prazos) | Pertencem ao serviço de domínio, não ao CASL. |
| Papéis de Visitante e Sistema | Não são papéis administrativos; atuam fora do CASL. |
| Implementação dos módulos (controllers/services/repositories) | Os módulos estão vazios; esta feature adiciona apenas o hook de autorização. |
| Login/senha, hash e bloqueio de tentativas (RF11) | Autenticação existente, não é autorização. |
| Migração Prisma e seed | Fora do escopo desta feature; o client já gerado é o único pré-requisito. |
| Regra "sempre ao menos um Gestor ativo" | Regra de domínio no módulo `users` (não é ability CASL); registrada como edge case. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Atendente pode ler `Location`/`ReservationSettings`/`Equipment`? | Somente Gestor (`read` incluso) | RF24–RF27 declaram "Ator: Gestor"; o OpenAPI marca os mutadores com `- Gestor`, mas `GET /admin/locations` e `GET /admin/settings/reservations` não têm o marcador (divergência) | n |
| Conjunto exato de status "finais" reabrível | `returned, delivered, closed_not_found, closed, cancelled` | Transições documentadas; `no_show` é marcado por job e sua reabertura não está definida | n |
| Modelagem de `reopen` | Condição CASL em `updateStatus` (não action própria) | Reabrir não é endpoint distinto; condição mantém o conjunto de actions mínimo | n |
| Framework de teste | Vitest (unit no pacote; integração com `fastify.inject`) | Repo não tem testes; Vitest é leve e compatível com TS/ESM | n |
| Campo do usuário (`role` vs `profile`) | `role` (alinhado a `users.role` do Prisma) | O schema Prisma usa `role`; `profile` é resíduo do template | y |
| Nomes canônicos de subjects/actions | Inglês, em camelCase (ex.: `updateStatus`, `FoundItem`) | Consistente com os enums internos do banco/OpenAPI | y |
| Caminho do OpenAPI | `docs/openapi-servicos-capim-dourado.yaml` | O caminho `source-reference/` citado na tarefa não existe no repo | y |

**Open questions:** none - all ambiguities logged in the table above (four with `Confirmed? = n`, awaiting user review before Execute).

---

## User Stories

### P1: Modelo de autorização compartilhado ⭐ MVP

**User Story**: As a developer, I want a single shared package that defines roles,
subjects, actions and abilities, so that backend and frontend enforce the same rules
without duplication.

**Acceptance Criteria**:

1. The system SHALL define exactly two administrative roles: `attendant` and `manager`.
2. The system SHALL define the subjects `Request`, `Reservation`, `FoundItem`, `LostReport`, `Equipment`, `Location`, `User`, `ReservationSettings` and `Indicator`.
3. The system SHALL define the actions `read`, `create`, `update`, `updateStatus`, `sendMessage`, `pickup`, `return`, `match`, `deliver` and `close`.
4. WHEN `defineAbilityFor` builds the ability for a user with role `attendant` THEN the system SHALL grant `read` on `Request`.
5. WHEN `defineAbilityFor` builds the ability for a user with role `attendant` THEN the system SHALL grant `updateStatus` on a `Request` whose `status` is `searching`.
6. WHEN `defineAbilityFor` builds the ability for a user with role `attendant` THEN the system SHALL deny `updateStatus` on a `Request` whose `status` is `returned`.
7. WHEN `defineAbilityFor` builds the ability for a user with role `attendant` THEN the system SHALL deny `read` on `Indicator`.
8. WHEN `defineAbilityFor` builds the ability for a user with role `manager` THEN the system SHALL grant `read` on `Indicator`.
9. WHEN `defineAbilityFor` builds the ability for a user with role `manager` THEN the system SHALL grant `updateStatus` on a `Request` whose `status` is `returned`.
10. WHEN `defineAbilityFor` builds the ability for a user with role `manager` THEN the system SHALL grant `create` on `User`.

**Independent Test**: run the `@saas/auth` unit suite and observe the ability matrix
(attendant vs manager) matching the criteria above.

---

### P1: Autorização no backend ⭐ MVP

**User Story**: As a developer, I want the backend to derive each user's ability from the
JWT and the database, so that every administrative route is protected before it runs.

**Acceptance Criteria**:

1. WHEN a request to a protected `/admin/*` route carries no `Authorization` header THEN the system SHALL respond `401`.
2. WHEN a request to a protected `/admin/*` route carries an invalid JWT THEN the system SHALL respond `401`.
3. WHEN an authenticated `attendant` requests a manager-only route THEN the system SHALL respond `403`.
4. WHEN an authenticated `manager` requests a manager-only route THEN the system SHALL proceed (no `403`).
5. WHEN the authenticated user has `active = false` THEN the system SHALL deny access.
6. The system SHALL derive the user's role from the JWT subject and the database, never from a client-supplied field.

**Independent Test**: use `fastify.inject` against a protected route with no token, an
invalid token, an inactive user, an attendant and a manager, and assert the status codes.

---

### P1: Controle de interface no frontend ⭐ MVP

**User Story**: As a developer, I want the frontend to reuse `@saas/auth` to hide actions
and protect admin pages, so that users only see what their role allows (UI-only control).

**Acceptance Criteria**:

1. The frontend SHALL build abilities from the same `defineAbilityFor` of `@saas/auth`.
2. WHEN the ability of a user with role `attendant` is built THEN the frontend SHALL hide manager-only navigation items (Configurações, Usuários, Indicadores).
3. WHEN an unauthenticated user opens an `/admin/*` page THEN the frontend SHALL redirect away from the page.

**Independent Test**: with an attendant session, confirm manager-only navigation is
hidden and admin pages redirect when unauthenticated.

---

### P2: Reabertura e invariantes de segurança

**User Story**: As a developer, I want reopening final requests to be manager-only, so
that closed requests cannot be reopened by an attendant.

**Acceptance Criteria**:

1. WHEN a `manager` updates the status of a `Request` whose `status` is final THEN the system SHALL allow it.
2. WHEN an `attendant` updates the status of a `Request` whose `status` is final THEN the system SHALL deny it with `403`.
3. WHEN `defineAbilityFor` receives a role that is neither `attendant` nor `manager` THEN the system SHALL throw.

**Independent Test**: assert the ability for final-status requests per role, and the 403
on the route for an attendant.

---

## Edge Cases

- IF the role is unknown or unrecognized THEN the system SHALL throw (fail closed).
- IF a token carries a role claim that conflicts with the database role THEN the system SHALL use the database role.
- IF the user record is missing or inactive THEN the system SHALL deny access.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AUTH-01 | P1: Modelo compartilhado | Design | Implementing |
| AUTH-02 | P1: Modelo compartilhado | Design | Implementing |
| AUTH-03 | P1: Modelo compartilhado | Design | Implementing |
| AUTH-04 | P1: Modelo compartilhado | Design | Implementing |
| AUTH-05 | P1: Modelo compartilhado | Design | Implementing |
| AUTH-06 | P2: Reabertura | Design | Implementing |
| AUTH-07 | P1: Backend | Design | Pending |
| AUTH-08 | P1: Backend | Design | Pending |
| AUTH-09 | P1: Backend | Design | Pending |
| AUTH-10 | P1: Frontend | Design | Pending |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped.

---

## Sources

- `docs/requirements.md` - RF11–RF30 (papéis, permissões, regras de segurança).
- `docs/authorization.md` - matriz funcional Atendente/Gestor.
- `docs/openapi-servicos-capim-dourado.yaml` - endpoints, `security: bearerAuth`, marcadores `- Gestor`, códigos 401/403.
- `docs/architecture.md` e `docs/backend.md` - monólito modular, camadas e middleware.
- `docs/specs/authorization-casl.spec.md` - spec de autorização prévia (origem desta portagem).
- Código atual de `packages/auth`, `apps/api` e `apps/web`.

---

## Success Criteria

- [ ] `@saas/auth` é a única fonte de roles/subjects/actions/abilities do repositório.
- [ ] Nenhuma rota administrativa executa sem passar pelo `ability.can(...)`.
- [ ] O backend responde 401 sem token e 403 sem permissão.
- [ ] Os testes unit e de integração cobrem a matriz de permissões e os casos de negação.
