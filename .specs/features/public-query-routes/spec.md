# Public Query Routes Specification

**Status**: Approved
**Approved**: 2026-11-14 - user: "Aprovo a spec pode avançar"

## Problem Statement

O backend já tem as rotas administrativas protegidas (feature CASL), mas ainda não expõe os
endpoints públicos de consulta. Os visitantes precisam listar os serviços ativos, consultar os
detalhes de um serviço, listar os locais do shopping e ler o aviso de privacidade vigente — tudo
sem autenticação. Os módulos `services`, `locations` e `privacy` estão vazios (exceto as rotas
admin de `locations`), então esta feature implementa esses quatro endpoints de leitura seguindo o
contrato OpenAPI.

## Goals

- [ ] Expor `GET /api/v1/services`, `GET /api/v1/services/{slug}`, `GET /api/v1/locations` e `GET /api/v1/privacy-notice` conforme o OpenAPI.
- [ ] Serviços e locais inativos ficam fora das listagens públicas.
- [ ] Nenhum campo interno é exposto (a resposta respeita os schemas públicos do OpenAPI).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Rotas administrativas de `services`/`locations`/`privacy` (CRUD) | Já cobertas em parte pela feature CASL; CRUD de serviços não está no OpenAPI. |
| Formulários, reservas, achados e perdidos e SAC | Outros módulos/features. |
| Autenticação/autorização | Endpoints públicos, sem JWT. |
| Índice parcial "no máximo um aviso ativo" | Alteração de migration/schema Prisma; registrada como pendência. |
| Upload de fotos (`/uploads/photos`) | RF05, não faz parte dos endpoints de consulta. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Base path `/api/v1` | Usar `/api/v1` (prefixo global no registro das rotas) | O OpenAPI define base path `/api/v1`; as rotas admin existentes ficam sob o mesmo prefixo | y |
| `PrivacyNotice.updatedAt` | Mapear `publishedAt` (Prisma) → `updatedAt` (OpenAPI) | O modelo Prisma só tem `publishedAt`; o OpenAPI chama de `updatedAt` | y |
| Fonte de `openingHours`/`ReservationSettings` no `ServiceDetail` | Consultar direto via Prisma no módulo `services` | São dados de referência; não justifica dependência entre módulos | y |
| `loanDurationMinutes`/`pickupToleranceMinutes`/`storageDays` | Sempre preenchidos a partir do singleton `ReservationSettings` (nullable no contrato) | O singleton é criado pela seed com defaults | y |
| `isOpenNow` | Computado no service a partir de `OpeningHour` + hora local em `America/Araguaina` (UTC-3) | Regra de horário do shopping; convenção do projeto | y |
| "No máximo um aviso ativo" | `findFirst({ where: { active: true } })`; a unicidade depende de índice parcial (ausente na migration) | Pendência de banco, fora do escopo | y |

**Open questions:** none - all ambiguities resolved (defaults confirmed by the user).

---

## User Stories

### P1: Listar serviços ativos ⭐ MVP

**User Story**: As a visitor, I want to list the active services so that I know what the shopping offers.

**Acceptance Criteria**:

1. WHEN a visitor requests `GET /api/v1/services` THEN the system SHALL return `200` with a `data` array of services.
2. The system SHALL return only services where `active = true`.
3. The system SHALL order the services by `sortOrder` ascending.
4. The system SHALL NOT require authentication for this endpoint.
5. The system SHALL return only the public `Service` fields (`id`, `slug`, `name`, `shortDescription`, `icon`, `kind`, `flow`, `equipmentType`).

---

### P1: Consultar detalhes de um serviço ⭐ MVP

**User Story**: As a visitor, I want to view a service's details so that I know how it works and when it is available.

**Acceptance Criteria**:

1. WHEN a visitor requests `GET /api/v1/services/{slug}` for an existing service THEN the system SHALL return `200` with the `ServiceDetail`.
2. WHEN a visitor requests `GET /api/v1/services/{slug}` for a non-existent slug THEN the system SHALL return `404` with code `NOT_FOUND`.
3. The system SHALL return the `ServiceDetail` fields (`description`, `howItWorks`, `openingHours`, `isOpenNow`, `pickupLocation`, `loanDurationMinutes`, `pickupToleranceMinutes`, `storageDays`, `contactPhone`).
4. The system SHALL compute `isOpenNow` from the global `OpeningHour` rows and the current local time in `America/Araguaina`.
5. The system SHALL include the global opening hours in `openingHours`.

---

### P1: Listar locais ativos ⭐ MVP

**User Story**: As a visitor, I want to list the active locations so that I can pick where I am or where I lost something.

**Acceptance Criteria**:

1. WHEN a visitor requests `GET /api/v1/locations` THEN the system SHALL return `200` with a `data` array of locations.
2. The system SHALL return only locations where `active = true`.
3. The system SHALL NOT require authentication for this endpoint.
4. The system SHALL return only the public `Location` fields (`id`, `name`, `floor`, `type`, `active`).

---

### P1: Retornar aviso de privacidade vigente ⭐ MVP

**User Story**: As a visitor, I want to read the current privacy notice so that I can consent before submitting a form.

**Acceptance Criteria**:

1. WHEN a visitor requests `GET /api/v1/privacy-notice` THEN the system SHALL return `200` with the active notice.
2. The system SHALL return the active notice as `version`, `text` and `updatedAt`.
3. The system SHALL NOT expose the notice's internal id or the `active` flag.
4. The system SHALL NOT require authentication for this endpoint.

---

## Edge Cases

- IF no privacy notice is active THEN the system SHALL return `404` with code `NOT_FOUND`.
- IF multiple active privacy notices exist (data inconsistency) THEN the system SHALL return one of them (the uniqueness is a DB invariant, not a query concern).
- IF a service is `informational` THEN the system SHALL return `flow = none` and `equipmentType = null`.
- IF the opening hours for today are closed THEN the system SHALL return `isOpenNow = false`.

---

## Endpoints (contracts)

| Method | Path | Auth | 200 | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/services` | none | `{ data: Service[] }` | — |
| GET | `/api/v1/services/{slug}` | none | `ServiceDetail` | `404` `NOT_FOUND` |
| GET | `/api/v1/locations` | none | `{ data: Location[] }` | — |
| GET | `/api/v1/privacy-notice` | none | `PrivacyNotice` | `404` `NOT_FOUND` (sem aviso ativo) |

---

## Module responsibilities & dependencies

| Module | Routes | Controller | Service | Repository | Schemas |
| --- | --- | --- | --- | --- | --- |
| `services` | `GET /services`, `GET /services/:slug` | parse request, montar resposta | filtrar ativos, computar `isOpenNow`, montar `ServiceDetail` | `findMany` ativos ordenados, `findUnique` por slug (+ `include` pickupLocation), `OpeningHour.findMany`, `ReservationSettings.findUnique` | Zod de resposta `Service`, `ServiceDetail` |
| `locations` | `GET /locations` (público) + admin existentes | parse request, montar resposta | filtrar ativos | `findMany` ativos | Zod de resposta `Location` |
| `privacy` | `GET /privacy-notice` | parse request, montar resposta | selecionar vigente | `findFirst` ativo | Zod de resposta `PrivacyNotice` |

Dependências: `services` lê `OpeningHour` e `ReservationSettings` diretamente via Prisma (dados de
referência, sem regra de negócio própria). `locations` e `privacy` são independentes. Os três
módulos não dependem uns dos outros.

---

## Files affected

- `apps/api/src/modules/services/services.{routes,controller,service,repository,schemas}.ts` (implementar — hoje vazios).
- `apps/api/src/modules/locations/locations.{controller,service,repository,schemas}.ts` (implementar) e `locations.routes.ts` (adicionar `GET /locations` público às rotas admin existentes).
- `apps/api/src/modules/privacy/privacy.{routes,controller,service,repository,schemas}.ts` (implementar — hoje vazios).
- `apps/api/src/http/routes.ts` (registrar `servicesRoutes` e `privacyRoutes`).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PUB-01 | P1: Listar serviços | Design | Pending |
| PUB-02 | P1: Detalhe do serviço | Design | Pending |
| PUB-03 | P1: Detalhe do serviço | Design | Pending |
| PUB-04 | P1: Listar locais | Design | Pending |
| PUB-05 | P1: Aviso de privacidade | Design | Pending |
| PUB-06 | P1: Detalhe do serviço | Design | Pending |
| PUB-07 | P1: (transversal) | Design | Pending |
| PUB-08 | P1: (transversal) | Design | Pending |
| PUB-09 | P1: (transversal) | Design | Pending |
| PUB-10 | P1: Aviso de privacidade | Design | Pending |
| PUB-11 | P1: Detalhe do serviço | Design | Pending |

**Coverage:** 11 total, 0 mapped to tasks (Tasks phase not started), 11 unmapped ⚠️.

---

## Sources

- `docs/openapi-servicos-capim-dourado.yaml` — contratos `GET /services`, `GET /services/{slug}`, `GET /locations`, `GET /privacy-notice` e schemas `Service`, `ServiceDetail`, `Location`, `PrivacyNotice`, `ErrorResponse`/`NotFound`.
- `docs/requirements.md` — RF01, RF02, RF10, RF26.
- `apps/api/prisma/schema.prisma` — models `Service`, `Location`, `PrivacyNotice`, `OpeningHour`, `ReservationSettings`.
- `docs/architecture.md` e `docs/backend.md` — camadas (routes/controller/service/repository/schemas) e módulos.
- Código atual de `apps/api/src/modules/{services,locations,privacy}` e `apps/api/src/http/routes.ts`.

---

## Success Criteria

- [ ] Os quatro endpoints respondem conforme o OpenAPI, sem exigir JWT.
- [ ] Serviços e locais inativos não aparecem nas listagens públicas.
- [ ] `GET /services/{slug}` retorna 404 para slug inexistente.
- [ ] `GET /privacy-notice` retorna o aviso vigente (`version`, `text`, `updatedAt`).
- [ ] Nenhum campo interno vaza nas respostas públicas.
