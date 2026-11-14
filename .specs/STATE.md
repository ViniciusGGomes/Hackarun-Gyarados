# Project State

## Decisions

### AD-001
- **Decision**: Sessões administrativas ficam no PostgreSQL (model `Session`), e o JWT carrega o `sid` da sessão.
- **Reason**: RF11 exige logout com revogação e expiração por inatividade; um JWT puro não revoga nem mede inatividade, e a infraestrutura só tem PostgreSQL (sem Redis).
- **Trade-off**: Uma leitura de sessão por request autenticada e uma escrita limitada a 1 por minuto; o schema Prisma ganha uma tabela.
- **Scope**: `apps/api` (módulo `auth`, middleware `auth`, Prisma); qualquer rota administrativa.
- **Date**: 2026-11-14
- **Status**: active

### AD-002
- **Decision**: Erros de autenticação e autorização (400 validação, 401, 403, 423) respondem no formato `ErrorResponse` do OpenAPI: `{ statusCode, code, message }`.
- **Reason**: O contrato público exige `code` estável (`UNAUTHORIZED`, `FORBIDDEN`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `VALIDATION_ERROR`) para o frontend reagir a cada falha.
- **Trade-off**: Mudou o corpo de erros que antes era `{ message }`; clientes que liam só `message` continuam funcionando.
- **Scope**: `apps/api/src/http/error-handler.ts` e todas as features futuras.
- **Date**: 2026-11-14
- **Status**: active

## Handoff

(none)
