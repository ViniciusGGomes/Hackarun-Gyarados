# Auditoria inicial do monorepo — Capim Dourado Serviços

> Data: 2026-11-14
> Escopo: análise estrutural e de consistência (código × documentação), validação de
> dependências, execução dos comandos disponíveis e tentativa de inicialização de
> frontend/backend. **Nenhuma funcionalidade foi implementada, nenhum arquivo de
> configuração foi alterado e nenhuma migração foi executada.**

---

## 1. Sumário executivo

O repositório é um **esqueleto herdado do template `next-saas-rbac`** sobre o qual a
documentação do Capim Dourado Serviços foi escrita, mas cujo código ainda **não foi
implementado**. Em resumo:

- A **documentação está completa e de boa qualidade** (visão, RF01–RF32, arquitetura,
  banco, API/OpenAPI, backend, frontend e autorização).
- O **schema Prisma está pronto e alinhado 1:1 com o DBML** — é o artefato de maior
  maturidade técnica do repositório.
- O **código efetivamente implementado é quase nulo**: todos os módulos do backend
  (`apps/api/src/modules/*`) e todas as páginas/componentes do frontend
  (`apps/web/src/app`, `apps/web/src/components`) estão **vazios (0 linhas)**.
- O que existe de código é, em grande parte, **código residual do template**
  (`next-saas-rbac`), que referencia entidades e contratos que **não existem** no
  modelo Capim Dourado (`Organization`, `Membership`, `accounts`, `tokens`,
  `Billing`, `Invite`, `projectSchema`).
- O **backend não inicia** (falha na validação de ambiente) e o **frontend não compila**
  (módulos de UI e dependências ausentes). Os scripts `lint` e `check-types` da raiz
  **não executam nada** (nenhum workspace os define).

O projeto está, portanto, na **fase inicial**: a especificação e o modelo de dados estão
prontos, mas a implementação ainda não começou.

---

## 2. Estado do ambiente e das dependências

| Item | Status | Observação |
|---|---|---|
| Node.js | ✅ `v22.19.0` | Atende `engines.node >=18` |
| pnpm | ✅ `9.0.0` | Igual ao `packageManager` da raiz |
| Turborepo | ✅ `2.10.11` instalado | binário `turbo` presente em `node_modules/.bin` |
| TypeScript | ✅ `5.9.2` instalado | raiz |
| Dependências instaladas | ✅ | `node_modules` presente na raiz e nos workspaces (`apps/api`, `apps/web`) |
| Binários por workspace | ✅ | `api`: `prisma`, `tsx`, `dotenv`, `bcrypt` · `web`: `next`, `tsc`, `shadcn`, `cn` |
| **Prisma Client gerado** | ❌ **Não** | Não existe diretório `.prisma` (nem na raiz, nem em `apps/api`). O `prisma generate` nunca foi executado para o schema atual |

Conclusão: as dependências estão instaladas, mas o **client do Prisma não foi gerado**,
o que impede o typecheck/build do backend e o uso de `@prisma/client` em runtime.

---

## 3. Estrutura observada do monorepo

```
hackarun/                          ← raiz do monorepo (pnpm + turbo)
├── apps/
│   ├── api/                       ← backend Fastify (@saas/api)
│   │   ├── prisma/{schema.prisma, seed.ts (vazio), migrations/}
│   │   ├── src/{index.ts, http/, lib/, utils/, modules/}
│   │   └── @types/fastify.d.ts
│   └── web/                       ← frontend Next.js (nome "web")
│       └── src/{app/, components/, http/, services/, lib/, middleware.ts}
├── packages/
│   ├── auth/                      ← @saas/auth (CASL + Zod) — ainda do template
│   └── env/                       ← @saas/env (@t3-oss/env-nextjs)
├── config/
│   ├── eslint-config/             ← @saas/eslint-config
│   ├── prettier/                  ← @saas/prettier
│   └── typescript-config/         ← @saas/typescript-config
├── capim-dourado-servicos/        ← documentação (AGENTS.MD + docs/)
│   ├── AGENTS.MD
│   └── docs/{*.md, capim-dourado.dbml, openapi-servicos-capim-dourado.yaml}
├── docker-compose.yml             ← PostgreSQL Bitnami (nomes do projeto anterior)
├── package.json (nome: next-saas-rbac)
├── pnpm-workspace.yaml            ← apps/*, packages/*, config/*
├── turbo.json
└── .env / .env.example / .npmrc / .gitignore / README.md (template)
```

**Observação estrutural importante:** a documentação (`AGENTS.MD` + `docs/`) está
**um nível abaixo** da raiz do monorepo, dentro de `capim-dourado-servicos/`. A raiz do
repositório Git/workspace é `hackarun/`. Isso difere do layout documentado em
`architecture.md`, que descreve `docs/` e `AGENTS.md` na raiz do projeto.

---

## 4. Configuração de workspaces, TS, Turborepo, ESLint e Prettier

### 4.1 Raiz (`package.json`)
- Nome: **`next-saas-rbac`** (herdado do template; a documentação já sinaliza para não
  renomear sem decisão).
- Scripts: `build`, `dev`, `lint`, `check-types` (todos via `turbo run`).
- `packageManager: pnpm@9.0.0`, `engines.node >=18`. ✅ coerentes.

### 4.2 Turborepo (`turbo.json`)
- Tarefas declaradas: `build` (com `dependsOn ^build` e `outputs` do `.next`), `lint`,
  `check-types` e `dev` (persistent).
- ⚠️ `build.outputs` só cobre `.next/**` (output do `web`); o backend não tem script
  `build`, então nada é gerado para ele.

### 4.3 TypeScript (`config/typescript-config`)
- `node.json`, `nextjs.json`, `library.json` presentes e consistentes (strict, módulos
  modernos). ✅
- `apps/api/tsconfig.json` estende `node.json` com alias `@/*`. ✅
- `apps/web/tsconfig.json` estende `nextjs.json` com alias `@/*`. ✅

### 4.4 ESLint (`config/eslint-config`)
- `base.js`, `next.js`, `node.js` presentes.
- ❌ **Typo no extends**: os três arquivos estendem `@rockeatseat/eslint-config/*`
  (com "ea"), mas o pacote instalado é **`@rocketseat/eslint-config`** (declarado em
  `package.json`). O ESLint falhará ao resolver a config quando houver script de lint.

### 4.5 Prettier (`config/prettier`)
- `index.mjs` com `prettier-plugin-tailwindcss` e regras padrão. ✅
- ⚠️ `package.json` de `@saas/prettier` tem `"private": "true"` (string) em vez de
  `true` (booleano) — cosmético, sem impacto funcional.

---

## 5. Prisma (schema × documentação × migrações)

### 5.1 Schema atual (`apps/api/prisma/schema.prisma`)
- **Completo e bem estruturado.** Contém todos os enums e modelos descritos em
  `database.md` e no DBML: `User`, `Location`, `Service`, `OpeningHour`,
  `ReservationSettings`, `Equipment`, `PrivacyNotice`, `Request`, `Consent`,
  `Reservation`, `UnmetDemand`, `LostReport`, `FoundItem`, `SacMessage`,
  `RequestMessage`, `RequestHistory`, `NotificationLog`, `JobLog`.
- Usa `@map`/`@@map` para snake_case, UUID via `gen_random_uuid()`, `timestamptz`,
  índices e relações com `onDelete: Cascade`. ✅
- Enums `UserRole` (`attendant`, `manager`), `RequestStatus` (fluxo completo),
  `FoundItemStatus`, `ObjectCategory`, `SacSubject` etc. — **alinhados com a
  documentação**. ✅

### 5.2 Comparação schema × DBML (`capim-dourado.dbml`)
- **1:1.** Entidades, campos, enums, índices e relacionamentos coincidem. ✅
- As regras que o Prisma não expressa (CHECK `reservation_settings.id = 1`, índice
  parcial único de `privacy_notices.active`) estão **anotadas como comentário no
  schema** e descritas no DBML, mas **ainda não foram materializadas em migration**.

### 5.3 Migrações (`apps/api/prisma/migrations/`)
- ❌ **Histórico de migração desatualizado/incorreto.** Existe uma única migration
  (`20260921214747_enable_cascades`) que altera as tabelas **`accounts`, `memberships`
  e `tokens`** — todas do template `next-saas-rbac`, **inexistentes** no schema atual.
- ❌ **Não existe nenhuma migration que crie as tabelas do modelo Capim Dourado.**
  O banco atual (se houver) não corresponde ao `schema.prisma`.
- `migration_lock.toml` = `postgresql`. ✅

### 5.4 Seed
- ❌ `apps/api/prisma/seed.ts` está **vazio** (0 linhas), embora o `package.json`
  configure `prisma.seed`.

### 5.5 Client gerado
- ❌ Não há `.prisma/client` gerado (item 2). Antes de qualquer typecheck/build do
  backend será necessário `prisma generate`.

---

## 6. Pacotes compartilhados

### 6.1 `packages/auth` (`@saas/auth`) — ❌ não alinhado com o produto
Este é o pacote mais crítico e ainda contém código do template:

| Arquivo | Conteúdo atual | Esperado pela documentação |
|---|---|---|
| `src/role.ts` | **apenas `ADMIN`** | `attendant` e `manager` |
| `src/permissions.ts` | `ADMIN → manage all` | matriz Atendente/Gestor (authorization.md) |
| `src/models/user.ts` | campo **`profile`** | campo **`role`** (conforme `users.role`) |
| `src/subjects/user.ts` | apenas subject `User` (manage/get/update/delete) | subjects/abilities por domínio |
| `src/index.ts` | `defineAbilityFor(user.profile)` | coerente com `role` |

- `defineAbilityFor` espera `user.profile`, mas o schema usa `role`. Nenhum consumidor
  atual passa `profile`.
- `src/index.ts` **exporta apenas** `userSchema` + `defineAbilityFor` + helpers CASL.
  Não exporta `projectSchema` (que `apps/api/src/index.ts` tenta importar).
- Dependências: `@casl/ability` e `zod` ✅ (CASL e Zod conforme stack).

### 6.2 `packages/env` (`@saas/env`) — ❌ causa falha em runtime
- Usa `@t3-oss/env-nextjs` (biblioteca voltada a **Next.js**), mas é consumida pelo
  backend **Fastify/Node**. A própria documentação (`backend.md`) questiona essa escolha.
- Declara `NEXT_PUBLIC_API_URL` em `shared`, porém **não a inclui em `runtimeEnv`**.
  Como `.env` também não a define, o `createEnv` **lança exceção ao importar**:
  `NEXT_PUBLIC_API_URL: expected string, received undefined` (confirmado em execução).
- `@t3-oss/env-nextjs` não carrega `.env` automaticamente no Node; o script `dev` do
  `api` contorna com `dotenv -e ../../.env`.

> Não existe pacote `packages/shared` (previsto em `architecture.md`). Contratos
> compartilhados (enums, tipos, schemas Zod) ainda não foram criados.

---

## 7. Backend (`apps/api`)

### 7.1 Estrutura de módulos
Diretórios de módulo criados (esqueleto): `auth`, `users`, `services`, `locations`,
`equipment`, `reservations`, `lost-reports`, `sac`, `requests`, `settings`,
`indicators`, `privacy` e `trancking`.

- ❌ **Todos os arquivos de módulo estão vazios (0 linhas).** Nenhuma regra de negócio,
  rota, controller, service, repository ou schema foi implementada.
- ❌ **`found-items` não existe** como módulo (previsto em `backend.md`).
- ❌ **Typo no diretório `trancking`** (deveria ser `tracking`, conforme docs e OpenAPI).
- ❌ Não existe diretório `jobs/` (RF19/RF31/RF32, previstos em `backend.md`).

### 7.2 Núcleo HTTP e infraestrutura
- `src/http/server.ts` — configura Fastify + `ZodTypeProvider` + Swagger + JWT + CORS.
  ✅ coerente com a stack, **exceto** o título Swagger, que ainda diz
  **"Next.js SaaS"** (residual do template).
- `src/http/routes.ts` — **vazio** (nenhuma rota registrada).
- `src/lib/prisma.ts` — instancia `PrismaClient` (com `log: ['query']`). ✅
- `src/http/error-handler.ts` — importa `./routes/_errors/bad-request-error` e
  `./routes/_errors/unauthorized-error`, **que não existem**. ❌
- `src/http/middlewares/auth.ts` — referencia `prisma.membership`, `organization` e
  `../routes/_errors/*`, todos **inexistentes** no modelo atual. ❌
- `@types/fastify.d.ts` — importa `Membership` e `Organization` de `@prisma/client`
  (não existem no schema). ❌
- `src/index.ts` — importa `projectSchema` de `@saas/auth` (não exportado) e referencia
  `Billing`/`Invite`/`project`. ❌ (arquivo morto; o entrypoint real é `http/server.ts`).
- `src/utils/get-user-permissions.ts` — importa `Role` de `@prisma/client` (deveria ser
  `UserRole`) e faz `userSchema.parse({ id, role })` quando o schema espera `profile`. ❌
- `src/utils/create-slug.ts` — implementação de slug simples. ✅ (única utilidade com
  conteúdo real além do `server.ts`/`prisma.ts`).

### 7.3 Scripts do `package.json`
- `dev`, `db:migrate`, `db:studio`, `env:load`. ✅
- ❌ **Não há `build`, `lint`, `check-types` nem `test`.** Por isso os scripts da raiz
  não fazem nada para o backend.

### 7.4 Inicialização (teste real)
`tsx src/http/server.ts` (com `.env` carregado) **falha imediatamente** na importação de
`@saas/env`, com `Error: Invalid environment variables` (motivo `NEXT_PUBLIC_API_URL`).
**O backend não sobe.**

---

## 8. Frontend (`apps/web`)

### 8.1 Estrutura de rotas
Rotas previstas existem como arquivos, mas **vazias**:

- Públicas `(public)`: `page.tsx`, `servicos/page.tsx`, `servicos/[slug]/page.tsx`,
  `acompanhar/protocolo/page.tsx`, `privacidade/page.tsx` — **todas 0 linhas**.
- Administrativas `(admin)`: `admin/page.tsx`, `login`, `solicitacoes`,
  `solicitacoes/[id]`, `agenda`, `achados-e-perdidos` (+`novo` e `[id]`),
  `configuracoes` (+equipamentos/regras/locais/usuarios), `indicadores` — **todas 0 linhas**.

### 8.2 Componentes
`components/ui/{home,services,reservations,lost-found,tracking,layout}/*` — **todos 0 linhas**.

### 8.3 Código residual do template (não vazio, mas fora de contexto)
- `src/app/auth/**` (sign-in, sign-up, ações e formulários) — autenticação por
  e-mail/senha + OAuth Google/GitHub do template, **não** é o fluxo de login
  Atendente/Gestor do Capim Dourado.
- `src/app/api/auth/**` (sign-out, callbacks Google/GitHub) — template.
- `src/http/**` — clientes HTTP do template: `sign-up`, `sign-in-with-password`,
  `sign-in-with-google/github`, `get-profile`, `get-organizations`, `get-membership`,
  `create-organization`, `api-client` (prefixo `http://localhost:3333`).
- `src/middleware.ts` — middleware de cookie `org` do template.
- `src/app/layout.tsx` — layout padrão "Create Next App" (title "Create Next App",
  fonte Inter).

### 8.4 Dependências e inconsistências
- ❌ `action-github.ts` e `action-google.ts` importam **`@saas/env`**, mas o `web` **não
  declara** `@saas/env` em `dependencies` (erro "Can't resolve '@saas/env'" no build).
- ❌ Os formulários do template importam componentes `@/components/ui/{button,input,
  label,separator,alert}` e o asset `@/assets/google-icon.svg` que **não existem**.
- ⚠️ `components.json` aponta `style: base-nova` e `@base-ui/react`, enquanto a doc cita
  "shadcn/ui" como base; `web` declara tanto `@base-ui/react` quanto o CLI `shadcn`.
- ⚠️ Nome do serviço HTTP: arquivo real `services/api.client.ts` (vazio, separado por
  ponto) vs documentado `services/api-client.ts`.
- ⚠️ Nome do package: `web` (sem escopo `@saas/web`), inconsistente com os demais.

### 8.5 Build (teste real)
`pnpm build` executa apenas `web#build` e **falha** com múltiplos
"Module not found" (componentes de UI e `@saas/env`). **O frontend não compila.**

---

## 9. Inconsistências entre documentação e código

| # | Documentação | Código atual | Impacto |
|---|---|---|---|
| 1 | Perfis `attendant`/`manager` (authorization.md) | `packages/auth` só tem `ADMIN` (template) | Autorização inválida |
| 2 | Campo `role` do usuário | `userSchema` usa `profile` | Quebra `get-user-permissions` |
| 3 | Stack "monólito modular Capim Dourado" | Nome raiz `next-saas-rbac`, README/Swagger de template | Confusão/identidade |
| 4 | Módulos `tracking` e `found-items` (backend.md) | `trancking` (typo) e `found-items` ausente | Estrutura divergente |
| 5 | `docs/conventions.md` e `docs/specs/` citados no AGENTS.md | Não existem como arquivos; conteúdo embutido como texto em `frontend.md`/`authorization.md` | Documentação poluída |
| 6 | Scripts `pnpm lint` e `pnpm check-types` funcionais | Nenhum workspace define `lint`/`check-types` | Comandos são no-op |
| 7 | `@t3-oss/env-nextjs` em pacote compartilhado (questionado em backend.md) | `packages/env` usa `env-nextjs` e omite `NEXT_PUBLIC_API_URL` de `runtimeEnv` | Backend não inicia |
| 8 | `packages/shared` para contratos (architecture.md) | Não existe | Contratos ainda não centralizados |
| 9 | Docker Compose com nomes Capim Dourado (a confirmar em backend.md) | `projeto-x-postgres` / `projeto_x` (herdado) | Ambiente legado |
| 10 | Client Prisma e migrations do modelo Capim Dourado | Client não gerado; migration única do template (`accounts/memberships/tokens`) | Banco dessincronizado |
| 11 | `services/api-client.ts` (frontend.md) | `services/api.client.ts` (vazio) | Nomenclatura |

### 9.1 Artefatos de concatenação na documentação
Os arquivos `frontend.md` e `authorization.md` contêm trechos literais do tipo
`files["docs/authorization.md"] = r"""..."""` e `files["docs/conventions.md"] = r"""..."""`,
evidenciando que a documentação foi gerada/concatenada por um script e **não foi
dividida em arquivos separados**. O conteúdo de `conventions.md` e de `specs/README.md`
está embutido dentro de `authorization.md` em vez de existir como arquivo próprio.

---

## 10. Funcionalidades e estruturas já implementadas

O que **de fato** está implementado/consolidado:

1. **Modelo de dados completo** — `schema.prisma` e `capim-dourado.dbml` alinhados.
2. **Contrato OpenAPI** — `openapi-servicos-capim-dourado.yaml` (base `/api/v1`,
   `ErrorResponse`, `bearerAuth`, endpoints públicos/admin/jobs).
3. **Documentação de produto** — requisitos RF01–RF32, arquitetura, banco, API, backend,
   frontend e autorização.
4. **Andaime do monorepo** — pnpm workspaces + Turborepo + configs de TS/ESLint/Prettier.
5. **Esqueleto de módulos do backend** (13 módulos criados, porém vazios) e **esqueleto
   de rotas do frontend** (grupos `(public)` e `(admin)`, porém vazios).
6. **Bootstrap do servidor Fastify** — `server.ts` com `ZodTypeProvider`, Swagger, JWT e
   CORS (funcional, exceto pela validação de ambiente que impede o boot).

Nenhuma **regra de negócio** (RF01–RF32) está implementada.

---

## 11. Comandos executados e resultados

| Comando | Resultado |
|---|---|
| `pnpm --version` / `node --version` | `9.0.0` / `v22.19.0` ✅ |
| `pnpm check-types` | ⚠️ `turbo run check-types` → **"No tasks were executed"** (0 tarefas) |
| `pnpm lint` | ⚠️ `turbo run lint` → **"No tasks were executed"** (0 tarefas) |
| `pnpm build` | ❌ executa só `web#build` e **falha**: "Module not found" (`@/components/ui/{input,label,separator,alert,button}`, `@/assets/google-icon.svg`, `@saas/env`) |
| `tsx src/http/server.ts` (com `.env`) | ❌ **backend não inicia**: `Error: Invalid environment variables` → `NEXT_PUBLIC_API_URL` (esperado string, recebido undefined) |

> Não foram executados `prisma migrate`, `prisma generate`, `prisma db push` nem
> qualquer comando de escrita no banco (restrição respeitada). Também não foi validada a
> conectividade com o PostgreSQL.

---

## 12. Problemas encontrados (consolidado)

**Bloqueantes (impedem desenvolvimento/inicialização):**
1. Backend não inicia — validação de ambiente (`NEXT_PUBLIC_API_URL` ausente em
   `runtimeEnv`/`.env`).
2. Frontend não compila — módulos de UI e dependência `@saas/env` ausentes.
3. `packages/auth` não implementa `attendant`/`manager` (só `ADMIN` do template).
4. Prisma Client não gerado + migration dessincronizada do schema (tabelas do template).
5. Código residual do template referenciando entidades inexistentes
   (`Organization`, `Membership`, `accounts`, `tokens`, `Billing`, `Invite`,
   `projectSchema`).

**Alta prioridade:**
6. Scripts `lint`/`check-types`/`build` ausentes nos workspaces (scripts da raiz são no-op).
7. Typo no extends do ESLint (`@rockeatseat` → `@rocketseat`).
8. Módulo `found-items` ausente e diretório `trancking` (typo).
9. `seed.ts` vazio (sem dados iniciais: serviços, locais, settings, usuários).
10. Docker Compose com nomes do projeto anterior (`projeto-x`, `projeto_x`).

**Média prioridade:**
11. Documentação com artefatos de concatenação; `conventions.md`/`specs/` inexistentes.
12. `packages/shared` inexistente (contratos compartilhados a definir).
13. Nome raiz `next-saas-rbac` e README/Swagger de template.
14. `web` sem escopo `@saas/web`; `services/api.client.ts` vs `api-client.ts`.
15. `@t3-oss/env-nextjs` em processo Node/Fastify (decisão pendente de separação por app).

---

## 13. Pendências antes do desenvolvimento

1. **Decidir e executar a higienização do template** (renomear raiz/escopo, remover
   código residual do backend/frontend, README, middleware e migrations).
2. **Alinhar `packages/auth`** aos perfis `attendant`/`manager` e à matriz de permissões
   de `authorization.md`, com subjects/abilities mapeados aos endpoints do OpenAPI.
3. **Corrigir `packages/env`** (separar validação por aplicação; remover
   `@t3-oss/env-nextjs` do backend ou incluir `NEXT_PUBLIC_API_URL` no `runtimeEnv`).
4. **Gerar o Prisma Client** e **criar a migration inicial** a partir do `schema.prisma`,
   incluindo as regras de CHECK/índice parcial documentadas; **criar o `seed.ts`**.
5. **Adicionar scripts de `build`, `lint`, `check-types` e `test`** aos workspaces e
   corrigir o extends do ESLint.
6. **Corrigir estrutura do backend**: criar `found-items`, renomear `trancking` →
   `tracking`, criar `jobs/` e `http/routes/_errors/*`.
7. **Implementar as regras de negócio** (RF01–RF32) nos módulos, seguindo a arquitetura
   routes/controller/service/repository/schemas.
8. **Implementar o frontend** (páginas públicas e admin, componentes, client HTTP) e
   gerar/instalar os primitivos de UI faltantes.
9. **Reorganizar a documentação** em arquivos separados (`conventions.md`, `specs/…`) e
   remover os artefatos de concatenação.
10. **Atualizar o Docker Compose/.env** para nomes do Capim Dourado (decisão com o time).

---

## 14. Dependências externas

- **PostgreSQL** é a única dependência externa necessária para o desenvolvimento do
  backend (persistência e migrations). O `docker-compose.yml` provê uma instância
  Bitnami na porta `5433` (banco `projeto_x`).
- Para as verificações desta auditoria, o banco **não era necessário** para reproduzir as
  falhas atuais (o backend falha antes de qualquer conexão, na validação de ambiente, e o
  frontend falha na compilação).
- A conectividade real com o PostgreSQL **não foi testada** e nenhuma migração foi
  executada (restrição respeitada).

---

*Este relatório registra o estado observado em 2026-11-14. Nenhuma correção foi aplicada;
os itens acima aguardam decisão e priorização.*
