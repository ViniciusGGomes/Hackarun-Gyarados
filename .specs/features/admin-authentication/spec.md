# Admin Authentication Specification

**Status**: Approved
**Approved**: 2026-11-14 - user: "pode seguir"

## Problem Statement

A API tem a autorização (CASL) concluída e rotas administrativas protegidas, mas ninguém consegue
obter um token: o módulo `auth` está vazio, nenhum código assina JWT, e não existe login, logout nem
consulta do usuário atual. RF11 exige que Atendentes e Gestores entrem com e-mail e senha, com
senha em hash, sessão que expira por inatividade, bloqueio temporário após tentativas inválidas e
usuários inativos barrados. RF12 exige que as rotas administrativas rejeitem acesso sem
autenticação ou permissão, reutilizando o CASL existente. Esta feature implementa
`POST /auth/login`, `POST /auth/logout` e `GET /auth/me` e define o contrato que o frontend Next.js
vai consumir.

## Goals

- [ ] Atendente e Gestor autenticam via `POST /api/v1/auth/login` e recebem `accessToken`, `expiresIn` e `user`, conforme o OpenAPI.
- [ ] Credenciais inválidas, conta bloqueada e usuário inativo não geram token e não vazam informação sensível.
- [ ] A sessão pode ser encerrada (`logout`) e expira por inatividade (comportamento exato sujeito à decisão D1).
- [ ] O papel do usuário vem sempre do banco, nunca do token nem do cliente, e alimenta a ability CASL já existente.
- [ ] O frontend tem um contrato claro de login, sessão, expiração e papel.

## Current State

Verificado no código da branch `backend`, após o fechamento de `public-query-routes`:

| Área | Situação encontrada | Consequência para esta feature |
| --- | --- | --- |
| `apps/api/src/modules/auth/*` | 5 arquivos vazios (0 bytes) | Implementar controller, routes, service, repository e schemas. |
| `apps/api/src/http/routes.ts` | Não registra `authRoutes`; as rotas ficam sob o prefixo `/api/v1` (aplicado em `server.ts`) | Registrar `authRoutes` no mesmo plugin. |
| `@fastify/jwt` | Registrado em `server.ts` com `secret: env.JWT_SECRET`, **sem** `sign.expiresIn`; nada assina tokens hoje | O login assina o token e define a expiração. |
| `apps/api/src/http/middlewares/auth.ts` | Plugin com `getCurrentUserId` (valida assinatura/expiração; `sub`), `getCurrentUser` (busca o usuário no banco a cada request; 401 se inexistente ou inativo) e `getAbility` (`defineAbilityFor({id, role})` com o papel do **banco**) | Já atende: identificação pelo token, dados atuais, usuário ativo, ability. Não confia em papel vindo do cliente. |
| `authorize(action, subject)` | Aplicado em todas as rotas `/admin/*` (27 usos em 9 módulos); 401 sem token, 403 sem permissão | Reutilizar. Não recriar. |
| `errorHandler` | 401/403/400 respondem `{ message }` (sem `statusCode`/`code`); 404 já responde `{ statusCode, code: 'NOT_FOUND', message }` | O OpenAPI exige `ErrorResponse` com `code` (`UNAUTHORIZED`, `FORBIDDEN`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `VALIDATION_ERROR`). Ver D5. |
| Prisma `User` | Tem `passwordHash`, `role`, `active`, `failedLoginAttempts`, `lockedUntil`, `lastLoginAt` | Suficiente para login e bloqueio. **Não** há model de sessão/token (ver D1). |
| Seed (`apps/api/prisma/seed.ts`) | `bcryptjs`, custo 10, senha `SEED_PASSWORD` ou `Senha@123`; 4 usuários: `gestor@exemplo.com` (manager), `paulo@exemplo.com` e `camila@exemplo.com` (attendant), `inativo@exemplo.com` (attendant, inativo); reseta `failedLoginAttempts` e `lockedUntil` | Compatível: o login usa `bcryptjs` (já dependência da API). Seed não muda. |
| `packages/auth` | `defineAbilityFor({ id, role })`, roles `attendant`/`manager` | Reutilizar no backend e no frontend. |
| `packages/env` | `JWT_SECRET: z.string()` sem tamanho mínimo; `.env.example` vazio | Risco anotado, fora do escopo (ver Out of Scope). |
| Frontend `apps/web` | Restos do template: `http/sign-in-with-password.ts` chama `sessions/password` e espera `{ token }`; cookie `token` com 7 dias; `auth/sign-in` com OAuth GitHub/Google; `middleware.ts` só trata `org`; existe `(admin)/admin/login/page.tsx` | O contrato novo difere do template (`accessToken`/`expiresIn`, sem OAuth). Adaptar o frontend é outra feature (ver Out of Scope). |
| Infra | Só PostgreSQL (`docker-compose`); sem Redis | Qualquer estado de sessão fora do JWT precisa ficar no PostgreSQL ou em memória do processo. |

## Out of Scope

| Feature | Reason |
| --- | --- |
| Tela de login e adaptação do `apps/web` ao novo contrato (client HTTP, cookie, middleware Next) | O pedido prioriza contrato e integração com a API; a UI é feature própria (D7). |
| CRUD de usuários, troca/redefinição/recuperação de senha, "esqueci a senha" | Fora de RF11/RF12; `users` é outro módulo. |
| Recriar ou alterar abilities/roles do CASL | Concluído na feature `authorization-casl`. |
| Rate limit por IP no login | Exige dependência nova e não é parte de RF11; D6. |
| Login social (GitHub/Google) | Resquício do template; não existe no OpenAPI. |
| MFA, refresh token separado, "lembrar de mim" | Não documentado. |
| Regra "último Gestor ativo" | Pertence ao módulo `users`. |
| Validar força mínima de `JWT_SECRET` no `packages/env` | Mudança de configuração fora desta feature; risco registrado. |
| Log de eventos de autenticação (login, falha, bloqueio, logout) e limite de escrita de `lastActivityAt` | Endurecimento de produção; a feature roda só localmente. |
| Mudança no seed e no OpenAPI | Só o schema muda, com o model `Session` aprovado em D1; seed, OpenAPI e `User` permanecem. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Algoritmo de hash | `bcryptjs` (`compare`), o mesmo do seed (custo 10); sem trocar para argon2 | O seed e a dependência `bcryptjs` da API já usam bcrypt; trocar quebraria as senhas do seed | y (resolvido pelo código) |
| Papel no token | O JWT carrega só `sub` (id do usuário); o papel é lido do banco a cada request | O middleware atual já faz isso; um papel no token ficaria desatualizado e não é confiável | y (resolvido pelo código) |
| Transporte do token | Header `Authorization: Bearer <accessToken>` | `docs/api.md`, OpenAPI `bearerAuth` | y (documentado) |
| Corpo do `user` no login e no `/auth/me` | Schema `User` do OpenAPI: `id`, `name`, `email`, `role`, `active` | OpenAPI | y (documentado) |
| `INVALID_CREDENTIALS` para e-mail inexistente e senha errada | Mesma resposta (401), mesmo corpo | Evita enumerar contas; OpenAPI só prevê 401 `INVALID_CREDENTIALS` | y (documentado) |
| Execução | Somente local (apresentação em máquina de desenvolvimento, sem deploy); decisões e testes pensados para esse cenário | Pedido do usuário | y - user: "preciso que esse processo de login e de authenticação seja pensando apenas local, não vou fazer o deploy do projeto" |
| D1 Sessão | Sessões no PostgreSQL: novo model `Session` (`id`, `userId`, `lastActivityAt`, `revokedAt`, `createdAt`); o JWT leva `sid`; cada request valida a sessão; `lastActivityAt` renovado a cada request autenticada | Única opção com revogação real e inatividade real usando só PostgreSQL | y - user: "pode seguir" (aceitou a recomendação) |
| D2 Bloqueio | N = 5 tentativas inválidas; L = 15 minutos | Docs dizem só "várias" | y - user: "pode seguir" (aceitou a recomendação) |
| D3 Inatividade | T = 30 minutos; `expiresIn = 1800`; teto absoluto do JWT (`exp`) = 8 horas | Um turno; `expiresIn` é a janela de inatividade | y - user: "pode seguir" (aceitou a recomendação) |
| D4 Usuário inativo | `401 INVALID_CREDENTIALS`, sem incrementar o contador | Não revela a existência/estado da conta | y - user: "pode seguir" (aceitou a recomendação) |
| D5 Formato de erro | 401, 403 e 400 passam a `{ statusCode, code, message }` (mesmos status codes) | OpenAPI exige `ErrorResponse`; testes atuais só conferem status | y - user: "pode seguir" (aceitou a recomendação) |
| D6 Rate limit por IP | Fora desta feature | Exige dependência nova; RF11 exige só bloqueio por conta | y - user: "pode seguir" (aceitou a recomendação) |
| D7 Frontend | Fora desta feature; só o contrato | Pedido prioriza a API | y - user: "pode seguir" (aceitou a recomendação) |
| Efeito do bloqueio em tokens já emitidos | O bloqueio (`lockedUntil`) afeta somente o login; token já emitido continua válido até expirar/ser revogado | RF11 liga o bloqueio a "tentativas inválidas de login" | y - user: "pode seguir" (aceitou a recomendação) |
| Armazenamento do token no frontend | Cookie `httpOnly`, `sameSite=lax`, `secure` em produção, `maxAge = expiresIn`, escrito por Server Action/route handler do Next; nunca `localStorage` | O frontend atual já usa cookie `token` via Server Action; httpOnly reduz risco de XSS | y - user: "pode seguir" (aceitou a recomendação) |

**Open questions:** none - D1 a D7 resolvidas (recomendações aceitas); as demais premissas seguem o default indicado.

---

## Endpoints (contracts)

Base path `/api/v1`. Erros usam `ErrorResponse` `{ statusCode, code, message }` .

| Method | Path | Auth | Request | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/login` | none | `{ email: string (email), password: string }` | `200 { accessToken: string, expiresIn: integer (segundos), user: User }` | `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED` |
| POST | `/auth/logout` | Bearer | - | `204` sem corpo | `401 UNAUTHORIZED` |
| GET | `/auth/me` | Bearer | - | `200 User` | `401 UNAUTHORIZED` |

`User` = `{ id: uuid, name, email, role: 'attendant' \| 'manager', active: boolean }`. Nenhuma resposta contém `passwordHash`, `failedLoginAttempts`, `lockedUntil` ou `lastLoginAt`.

---

## Business Rules

| # | Regra |
| --- | --- |
| BR1 | Só `attendant` e `manager` autenticam; o papel exibido e usado vem do banco. |
| BR2 | A senha é comparada com `passwordHash` por `bcrypt.compare`; nunca por igualdade de texto. |
| BR3 | E-mail inexistente e senha errada têm a mesma resposta (`401 INVALID_CREDENTIALS`) e custo de tempo comparável (comparar contra um hash fictício quando o e-mail não existe). |
| BR4 | Usuário inativo não autentica: `401 INVALID_CREDENTIALS`, sem tocar nos contadores. |
| BR5 | Cada senha errada de usuário existente e ativo incrementa `failedLoginAttempts` em 1, de forma atômica. |
| BR6 | Ao atingir 5 tentativas, `lockedUntil = agora + 15 minutos`. |
| BR7 | Com `lockedUntil > agora`, o login responde `423 ACCOUNT_LOCKED` sem verificar a senha e sem alterar contadores. |
| BR8 | Passado `lockedUntil`, o login volta a ser permitido e a contagem recomeça do zero (`failedLoginAttempts = 0`, `lockedUntil = null` antes de avaliar a tentativa). |
| BR9 | Login bem-sucedido zera `failedLoginAttempts`, limpa `lockedUntil` e grava `lastLoginAt = agora`. |
| BR10 | O token tem expiração absoluta de 8 h; a sessão expira após 30 min sem uso e o logout a revoga. |
| BR11 | Cada request autenticada relê o usuário no banco: usuário removido ou desativado depois da emissão do token recebe 401. |

---

## Authentication Flow

```
Login
  cliente -> POST /auth/login {email, password}
  api: valida corpo (Zod)               -> 400 VALIDATION_ERROR
  api: busca usuário por e-mail
       inexistente                      -> hash fictício + 401 INVALID_CREDENTIALS
       inativo                          -> hash fictício + 401 INVALID_CREDENTIALS (antes do bloqueio: não revela o estado)
       lockedUntil > agora              -> 423 ACCOUNT_LOCKED
       lockedUntil <= agora             -> a tentativa recomeça a contagem (1ª falha)
  api: bcrypt.compare(password, passwordHash)
       falha -> failedLoginAttempts += 1 (atômico); se >= 5: lockedUntil = agora + 15 min
             -> 401 INVALID_CREDENTIALS
       ok    -> zera contagem, lastLoginAt = agora, assina JWT {sub}
             -> 200 {accessToken, expiresIn, user}

Request protegida
  cliente -> Authorization: Bearer <token>
  plugin auth: jwtVerify (assinatura + exp) -> 401 UNAUTHORIZED
  getCurrentUser: lê o usuário no banco     -> 401 se inexistente/inativo
  verificação da sessão (`sid` não revogado e `lastActivityAt` dentro de 30 min)
  authorize(action, subject): ability do papel do banco -> 403 sem permissão

Logout
  cliente -> POST /auth/logout (Bearer) -> revoga a sessão (`revokedAt`) -> 204
```

---

## JWT Integration

- O token é assinado por `@fastify/jwt` com `JWT_SECRET` (HS256, padrão da biblioteca). Payload mínimo: `sub` (id do usuário) e os claims padrão (`iat`, `exp`); e `sid` (id da sessão).
- `expiresIn` na resposta é o tempo de vida do token em segundos e coincide com o `exp` assinado.
- Assinatura inválida, token malformado ou expirado resultam em `401 UNAUTHORIZED` pelo plugin existente (`getCurrentUserId`).
- O token nunca é registrado em logs nem devolvido fora do login.

## CASL Integration

- Nenhuma ability nova. `getAbility` continua usando `getUserPermissions(user.id, user.role)` com o papel lido do banco; `authorize` continua devolvendo 401 (sem autenticação) ou 403 (sem permissão).
- `/auth/login` é pública (sem `authorize`). `/auth/logout` e `/auth/me` exigem apenas autenticação (`getCurrentUser`), sem ability de domínio: qualquer usuário ativo autenticado pode consultar a si mesmo e sair.
- Mudança de papel no banco vale na request seguinte, sem novo login.

---

## Session Strategy and Logout

O Prisma não tem model de sessão/token. RF11 pede logout e expiração por inatividade; um JWT puro só expira em data fixa e não pode ser invalidado antes. Decisão **D1** (aprovada): sessões no PostgreSQL. No login cria-se uma linha `Session` (`id`, `userId`, `lastActivityAt = agora`, `revokedAt = null`, `createdAt`) e o JWT leva `sid` = id da sessão. Em cada request autenticada a API valida: assinatura e `exp` (teto de 8 h), usuário ativo, sessão existente, `revokedAt` nulo e `agora - lastActivityAt <= 30 min`; falhando qualquer uma, `401 UNAUTHORIZED`. `lastActivityAt` é renovado a cada request autenticada. O logout grava `revokedAt`.

---

## Security

| Item | Requisito |
| --- | --- |
| Hash | `bcryptjs`; nunca texto puro nem log do hash. |
| Enumeração de contas | E-mail inexistente e senha errada: mesma resposta e custo de tempo comparável. Observação: `423` revela que o e-mail existe e está bloqueado (previsto pelo OpenAPI); aceito. |
| Concorrência | O incremento de `failedLoginAttempts` e a aplicação do bloqueio são uma operação atômica no banco (um `UPDATE` com incremento ou transação), sem ler-e-gravar separados; tentativas simultâneas não perdem contagem. |
| Dados sensíveis | Respostas e logs sem `passwordHash`, senha, token, `failedLoginAttempts`, `lockedUntil`. |
| Papel | Nunca aceito do cliente; sempre do banco. |
| Mensagens de erro | Genéricas: não dizem se o e-mail existe, se a senha estava errada ou se o usuário está inativo. |
| Segredo | `JWT_SECRET` vem do ambiente; o valor de exemplo `my-jwt-secret` não vale para produção (risco documentado, sem validação nesta feature). |
| Brute force | Bloqueio por conta (RF11). Rate limit por IP fora do escopo (D6). |

## Frontend Integration (contract)

Contrato que o Next.js consumirá; a implementação da UI e do client HTTP é outra feature.

| Tema | Contrato |
| --- | --- |
| Credenciais | `POST {NEXT_PUBLIC_API_URL}/auth/login` com `{ email, password }`, feito no servidor (Server Action/route handler), nunca expondo a senha em query string. |
| Resposta | `{ accessToken, expiresIn, user }` (o template atual espera `{ token }`: precisa adaptar). |
| Armazenamento | Cookie `httpOnly` (ver Assumptions) com `maxAge = expiresIn`; o token não é lido por JavaScript do navegador. |
| Uso | Chamadas à API enviam `Authorization: Bearer <accessToken>`. |
| Usuário atual e papel | `GET /auth/me` devolve `user.role`; o frontend monta a ability com `defineAbilityFor({ id: user.id, role: user.role })` de `@saas/auth`, só para controlar interface (a API é a autoridade). |
| Sessão expirada/revogada | Qualquer resposta `401` com `code: 'UNAUTHORIZED'` em rota administrativa: apagar o cookie e redirecionar para `/admin/login`. `401 INVALID_CREDENTIALS` no login: mostrar erro no formulário, sem redirecionar. |
| Bloqueio | `423 ACCOUNT_LOCKED`: mostrar mensagem de conta bloqueada temporariamente. |
| Logout | `POST /auth/logout` com o token; independentemente do resultado, apagar o cookie e ir para `/admin/login`. |
| Proteção de páginas | O middleware/layout `/admin/*` redireciona para `/admin/login` sem cookie; é conforto de UX, a autoridade é a API. |

---

## User Stories

### P1: Login de usuário administrativo ⭐ MVP

**User Story**: As a Atendente or Gestor, I want to sign in with e-mail and password so that I can use the admin area with my role.

**Why P1**: Sem login não existe token; todas as rotas administrativas ficam inacessíveis.

**Acceptance Criteria**:

1. WHEN a user sends `POST /auth/login` with the e-mail and password of an active, unlocked user THEN the system SHALL return `200` with `accessToken`, `expiresIn` (integer seconds) and `user` (`id`, `name`, `email`, `role`, `active`).
2. WHEN the authenticated user has role `attendant` or `manager` THEN the system SHALL return that same role from the database in `user.role`.
3. IF the e-mail does not exist THEN the system SHALL return `401` with code `INVALID_CREDENTIALS` and no token.
4. IF the password does not match THEN the system SHALL return `401` with code `INVALID_CREDENTIALS` and no token, with the same body as for a nonexistent e-mail.
5. IF the e-mail does not exist THEN the system SHALL still run a bcrypt comparison against a dummy hash before responding.
6. IF the user is inactive THEN the system SHALL NOT issue a token and SHALL return `401` with code `INVALID_CREDENTIALS` and SHALL NOT change `failedLoginAttempts`.
7. IF the body lacks `email` or `password`, or `email` is not a valid e-mail THEN the system SHALL return `400` with code `VALIDATION_ERROR`.
8. The system SHALL NOT include `passwordHash`, `failedLoginAttempts`, `lockedUntil` or `lastLoginAt` in any response.
9. The system SHALL verify the password with the same bcrypt algorithm used by the seed, so the seeded users can sign in with `SEED_PASSWORD`.

**Independent Test**: Com o seed aplicado, `POST /auth/login` com `paulo@exemplo.com` devolve token e `role: attendant`; com `gestor@exemplo.com`, `role: manager`.

---

### P1: Bloqueio temporário por tentativas inválidas ⭐ MVP

**User Story**: As the shopping, I want repeated wrong passwords to lock the account temporarily so that guessing a password is impractical.

**Why P1**: RF11 exige bloqueio temporário.

**Acceptance Criteria**:

1. WHEN a login fails because the password is wrong for an existing, active user THEN the system SHALL increment `failedLoginAttempts` by 1.
2. WHEN `failedLoginAttempts` reaches 5 THEN the system SHALL set `lockedUntil` to the current time plus 15 minutes and respond `401 INVALID_CREDENTIALS` for that attempt.
3. WHILE `lockedUntil` is in the future, WHEN a user attempts to sign in with that e-mail THEN the system SHALL return `423` with code `ACCOUNT_LOCKED`, SHALL NOT verify the password, SHALL NOT change `failedLoginAttempts` and SHALL NOT issue a token, even if the password is correct.
4. WHEN a login is attempted after `lockedUntil` has passed THEN the system SHALL reset `failedLoginAttempts` to 0 and clear `lockedUntil` before evaluating the attempt, so a wrong password counts as the first failure.
5. WHEN a login succeeds THEN the system SHALL set `failedLoginAttempts` to 0, clear `lockedUntil` and set `lastLoginAt` to the current time.
6. WHEN several wrong-password attempts for the same user arrive simultaneously THEN the system SHALL count every one of them (no lost increments).

**Independent Test**: N logins errados seguidos para `paulo@exemplo.com` bloqueiam a conta; o próximo login, mesmo com a senha certa, devolve `423`; após L, a senha certa volta a funcionar.

---

### P1: Consultar o usuário autenticado ⭐ MVP

**User Story**: As a signed-in user, I want to fetch my own data so that the app knows who I am and what role I have.

**Why P1**: O frontend depende dele para montar abilities e a navegação.

**Acceptance Criteria**:

1. WHEN a request to `GET /auth/me` carries a valid, unexpired token of an active user THEN the system SHALL return `200` with `id`, `name`, `email`, `role` and `active` read from the database.
2. IF the token is missing, malformed, has an invalid signature or is expired THEN the system SHALL return `401` with code `UNAUTHORIZED`.
3. IF the user was deactivated or deleted after the token was issued THEN the system SHALL return `401` with code `UNAUTHORIZED`.
4. WHEN the user's role changed in the database after the token was issued THEN the system SHALL return the new role in `GET /auth/me` and use it for authorization, without a new login.
5. The system SHALL NOT read the role from the token or from any client-supplied value.

**Independent Test**: Logar, trocar o papel no banco, chamar `/auth/me` com o mesmo token e ver o papel novo.

---

### P1: Encerrar a sessão e expirar por inatividade ⭐ MVP

**User Story**: As a signed-in user, I want to sign out, and I want idle sessions to end, so that an abandoned computer does not stay open.

**Why P1**: RF11 exige logout e expiração por inatividade.

**Acceptance Criteria** (mecanismo: sessões no PostgreSQL, ver Session Strategy):

1. WHEN an authenticated user sends `POST /auth/logout` THEN the system SHALL return `204` with no body.
2. WHEN a token has been used in a successful logout THEN the system SHALL reject that token with `401 UNAUTHORIZED` on every later request.
3. WHILE a session has no authenticated request for longer than 30 minutes, WHEN a request arrives with that session's token THEN the system SHALL return `401 UNAUTHORIZED`.
4. WHEN an authenticated request is made within the inactivity window THEN the system SHALL keep the session valid and extend it by 30 minutes.
5. IF `POST /auth/logout` carries no valid token THEN the system SHALL return `401 UNAUTHORIZED`.
6. The system SHALL return `expiresIn` equal to 1800, the inactivity window in seconds.

**Independent Test**: Logar, chamar `/auth/logout`, repetir `/auth/me` com o mesmo token e receber `401`.

---

### P1: Rotas administrativas exigem autenticação e permissão ⭐ MVP

**User Story**: As the system, I want every admin route to require a signed-in user with the right permission so that staff only do what their role allows.

**Why P1**: RF12.

**Acceptance Criteria**:

1. WHEN a request to any `/admin/*` route has no valid token THEN the system SHALL return `401`.
2. WHEN an authenticated `attendant` calls a manager-only `/admin/*` route THEN the system SHALL return `403`.
3. WHEN an authenticated `manager` calls a manager-only `/admin/*` route THEN the system SHALL NOT return `401` or `403`.
4. The system SHALL build the ability from the role read from the database using the existing `@saas/auth` `defineAbilityFor`, with no second authorization layer.
5. The system SHALL keep `POST /auth/login` public and SHALL require authentication (not an ability) on `POST /auth/logout` and `GET /auth/me`.

**Independent Test**: Os testes existentes de `authorization`/`attendance` seguem verdes e um token emitido pelo login real acessa uma rota `/admin/*` do seu perfil.

---

### P2: Respostas de erro no formato do contrato

**User Story**: As a frontend developer, I want stable error codes so that I can react to each failure.

**Why P2**: Necessário para os códigos `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED` e `UNAUTHORIZED` serem observáveis.

**Acceptance Criteria**:

1. WHEN an auth or authorization error occurs THEN the system SHALL respond with `{ statusCode, code, message }` where `code` is `UNAUTHORIZED` (401), `FORBIDDEN` (403), `INVALID_CREDENTIALS` (401 login), `ACCOUNT_LOCKED` (423) or `VALIDATION_ERROR` (400).
2. The system SHALL NOT change the status codes already returned by existing routes.

**Independent Test**: `GET /admin/users` sem token devolve `401` com `code: 'UNAUTHORIZED'`.

---

## Edge Cases

- WHEN the e-mail differs only by letter case THEN the system SHALL treat it as the same user (e-mail normalizado em minúsculas na busca) [Assumption: o seed grava e-mails em minúsculas].
- IF `failedLoginAttempts` is already at or above N and `lockedUntil` is null or past THEN the system SHALL reset the count per BR8 before evaluating.
- IF two logins of the same user succeed in sequence THEN the system SHALL issue two valid tokens and each keeps its own session.
- IF the database is unavailable during login THEN the system SHALL return `500` without exposing details and without issuing a token.
- IF the `Authorization` header is not `Bearer <token>` THEN the system SHALL return `401 UNAUTHORIZED`.
- IF a locked user presents an already issued, still valid token THEN the system SHALL keep accepting it [Assumptions].

---

## Test Scenarios

| # | Cenário | ACs |
| --- | --- | --- |
| T1 | Login bem-sucedido como Atendente (`role: attendant`, token, `expiresIn`) | Login 1, 2 |
| T2 | Login bem-sucedido como Gestor (`role: manager`) | Login 1, 2 |
| T3 | E-mail inexistente → 401 `INVALID_CREDENTIALS`, hash fictício comparado | Login 3, 5 |
| T4 | Senha incorreta → 401, mesmo corpo do T3, contador +1 | Login 4; Lock 1 |
| T5 | Usuário inativo → sem token, contador inalterado | Login 6 |
| T6 | N falhas → bloqueio; próxima tentativa com senha certa → 423, sem alterar contador | Lock 2, 3 |
| T7 | Fim do bloqueio: tentativa após `lockedUntil` recomeça a contagem (relógio controlado) | Lock 4 |
| T8 | Login ok zera `failedLoginAttempts`, limpa `lockedUntil`, grava `lastLoginAt` | Lock 5 |
| T9 | Tentativas simultâneas contam todas (verificar a query atômica) | Lock 6 |
| T10 | Corpo inválido → 400 `VALIDATION_ERROR` | Login 7 |
| T11 | Resposta nunca contém `passwordHash`, `failedLoginAttempts`, `lockedUntil`, `lastLoginAt` | Login 8 |
| T12 | Seed compatível: `bcrypt.hash` do seed é aceito pelo login | Login 9 |
| T13 | Token inválido/malformado/assinatura errada → 401 | Me 2 |
| T14 | Token expirado → 401 (relógio controlado) | Me 2 |
| T15 | `/auth/me` devolve o usuário atual do banco | Me 1 |
| T16 | Papel alterado no banco vale sem novo login | Me 4, 5 |
| T17 | Usuário desativado depois de receber o token → 401 | Me 3 |
| T18 | Logout → 204; mesmo token depois → 401 | Session 1, 2 |
| T19 | Logout sem token → 401 | Session 5 |
| T20 | Inatividade acima de T → 401; atividade dentro de T renova | Session 3, 4 |
| T21 | `/admin/*` sem token → 401 | Routes 1 |
| T22 | Atendente em rota de Gestor → 403; Gestor passa | Routes 2, 3 |
| T23 | Token do login real acessa rota `/admin/*` do seu perfil (integração com CASL) | Routes 3, 4 |
| T24 | Erros no formato `{statusCode, code, message}` | Errors 1 |

---

## Files affected

- `apps/api/src/modules/auth/auth.{routes,controller,service,repository,schemas}.ts` (implementar; hoje vazios).
- `apps/api/src/modules/auth/*.test.ts` e/ou `apps/api/src/http/auth-routes.test.ts` (novos testes).
- `apps/api/src/http/routes.ts` (registrar `authRoutes`).
- `apps/api/src/http/error-handler.ts` e `apps/api/src/http/routes/_errors/*` (novos erros `InvalidCredentialsError`, `AccountLockedError`; formato `ErrorResponse`).
- `apps/api/src/http/middlewares/auth.ts` (checagem de sessão: `sid` não revogado e dentro da inatividade; renova `lastActivityAt`).
- `apps/api/prisma/schema.prisma` e migration (novo model `Session` + relação em `User`) e migration (aprovado em D1).
- Não afetados: `packages/auth`, `apps/api/prisma/seed.ts`, OpenAPI, `apps/web` (contrato apenas).

---

## Decisions

Todas aceitas pelo usuário (`"pode seguir"`, recomendações adotadas).

| # | Decisão | Resultado |
| --- | --- | --- |
| D1 | Sessão, logout e inatividade | Opção C: model `Session` no PostgreSQL, JWT com `sid`. Descartadas: B (JWT curto com renovação, sem revogação), D (memória, perde-se ao reiniciar), A (JWT puro, não cumpre RF11). |
| D2 | Bloqueio | 5 tentativas, 15 minutos |
| D3 | Inatividade e `expiresIn` | 30 minutos, `expiresIn = 1800`, teto absoluto do JWT 8 h |
| D4 | Usuário inativo | `401 INVALID_CREDENTIALS` |
| D5 | `ErrorResponse` em 401/403/400 | Alinhar, mantendo os status codes |
| D6 | Rate limit por IP | Fora do escopo |
| D7 | Adaptação do frontend | Fora do escopo; só contrato |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AUTHN-01 | P1: Login (200, token, user, role) | Specify | Pending |
| AUTHN-02 | P1: Login (401 e-mail inexistente / senha errada, timing) | Specify | Pending |
| AUTHN-03 | P1: Login (usuário inativo) | Specify | Pending |
| AUTHN-04 | P1: Login (validação, sem dados sensíveis, hash compatível) | Specify | Pending |
| AUTHN-10 | P1: Bloqueio (contagem, 423, fim do bloqueio, reset, concorrência) | Specify | Pending |
| AUTHN-20 | P1: `/auth/me` (usuário atual, 401, papel do banco) | Specify | Pending |
| AUTHN-30 | P1: Logout (204 e 401) | Specify | Pending |
| AUTHN-31 | P1: Logout revoga o token | Specify | Pending |
| AUTHN-32 | P1: Expiração por inatividade e renovação | Specify | Pending |
| AUTHN-33 | P1: `expiresIn` coerente com a sessão | Specify | Pending |
| AUTHN-40 | P1: Rotas admin exigem token (401) e permissão (403) via CASL | Specify | Pending |
| AUTHN-50 | P2: Erros no formato `ErrorResponse` | Specify | Pending |

**ID format:** `AUTHN-NN`. **Coverage:** 12 total, 0 mapped to tasks (Tasks phase not started), 13 unmapped ⚠️.

---

## Sources

- `capim-dourado-servicos/docs/openapi-servicos-capim-dourado.yaml` - `/auth/login`, `/auth/logout`, `/auth/me`, schemas `User`, `UserRole`, `ErrorResponse`, responses `Unauthorized`/`Forbidden`/`BadRequest`, `bearerAuth`.
- `capim-dourado-servicos/docs/requirements.md` - RF11, RF12.
- `capim-dourado-servicos/docs/authorization.md`, `docs/api.md`, `docs/backend.md`, `docs/architecture.md`, `docs/frontend.md` - JWT, bloqueio, rate limit, regras de proteção, frontend.
- `apps/api/prisma/schema.prisma` (model `User`) e `apps/api/prisma/seed.ts` (bcryptjs, usuários e papéis).
- `apps/api/src/http/{server,routes,error-handler}.ts`, `http/middlewares/{auth,authorize}.ts`, `utils/get-user-permissions.ts`, `@types/fastify.d.ts`, `modules/auth/*` (vazios).
- `packages/auth/src/*` e `packages/env/index.ts`.
- `apps/web/src/{http,app/auth,middleware.ts}` e `apps/web/src/app/(admin)/admin/login/page.tsx`.
- `.specs/features/authorization-casl/spec.md` e `public-query-routes/spec.md` - convenções e features concluídas.

---

## Success Criteria

- [ ] Os seeds `paulo@exemplo.com` (attendant) e `gestor@exemplo.com` (manager) entram via `POST /auth/login` e acessam rotas `/admin/*` do seu perfil.
- [ ] `inativo@exemplo.com` não obtém token.
- [ ] N senhas erradas bloqueiam a conta; o login volta após L.
- [ ] Logout invalida o token e a inatividade acima de T devolve 401 (conforme D1).
- [ ] Nenhuma resposta expõe senha, hash, token ou contadores.
