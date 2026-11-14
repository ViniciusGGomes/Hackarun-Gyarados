# Visão geral do projeto

## Produto

**Capim Dourado Serviços** é uma aplicação web para disponibilizar informações e solicitações de serviços do Capim Dourado Shopping. A plataforma atende visitantes sem exigir criação de conta e oferece um painel administrativo para a equipe.

## Objetivos funcionais

- Apresentar os serviços disponíveis no shopping.
- Permitir reserva de equipamentos, inicialmente cadeira de rodas e carrinho de bebê (a disponibilidade do carrinho ainda precisa ser confirmada pelo shopping).
- Permitir registro de objetos perdidos.
- Permitir contato com o SAC.
- Permitir acompanhamento de solicitações por protocolo e telefone.
- Permitir que Atendentes e Gestores operem solicitações.
- Permitir que Gestores configurem equipamentos, regras, locais e usuários e consultem indicadores.
- Aplicar controles de privacidade, consentimento, retenção e anonimização.

## Atores

| Ator | Descrição |
|---|---|
| Visitante | Usa a área pública sem login para consultar serviços, registrar solicitações e acompanhar protocolos. |
| Atendente | Opera solicitações, agenda, achados e perdidos e mensagens. |
| Gestor | Possui as permissões do Atendente e também administra configurações, usuários e indicadores. |
| Sistema | Executa tarefas automáticas, como não comparecimento, anonimização e notificações. |

## Escopo funcional

O produto está organizado nos seguintes domínios:

1. Área pública e catálogo de serviços.
2. Reservas de equipamentos.
3. Objetos perdidos.
4. SAC e mensagens.
5. Acompanhamento por protocolo.
6. Autenticação e autorização administrativa.
7. Gestão de solicitações.
8. Agenda, retirada e devolução.
9. Achados e perdidos pela equipe.
10. Configurações administrativas.
11. Indicadores.
12. Privacidade, retenção e notificações.

## Stack informada

| Área | Tecnologia |
|---|---|
| Monorepo | PNPM Workspaces + Turborepo |
| Linguagem | TypeScript |
| Frontend | Next.js |
| Backend | Node.js + Fastify |
| Banco | PostgreSQL |
| ORM | Prisma |
| Validação | Zod |
| Autenticação | JWT / `@fastify/jwt` |
| Autorização | CASL |
| Componentes UI | shadcn/ui (estrutura existente/pretendida) |
| Ambiente local | Docker Compose |
| Configuração de ambiente | `@t3-oss/env-nextjs` foi informado no pacote `auth` |

## Estado conhecido do repositório

A captura enviada mostra a raiz `hackarun/` com:

- `apps/` (conteúdo não visível na captura).
- `config/eslint-config/`, `config/prettier/` e `config/typescript-config/`.
- `packages/auth/src/models/user.ts`.
- `packages/auth/src/subjects/user.ts`.
- `packages/auth/src/index.ts`.
- `packages/auth/src/permissions.ts`.
- `packages/auth/src/role.ts`.
- `packages/auth/package.json` e `tsconfig.json`.
- `.env`, `.env.example`, `.npmrc`, `docker-compose.yml`, `package.json` e `pnpm-lock.yaml`.

O nome exibido no `package.json` raiz é `next-saas-rbac`, provavelmente herdado de um template. Não renomeie sem decisão explícita.

## Materiais de referência fornecidos

- `Texto colado.txt`: requisitos funcionais e regras de negócio.
- `capim-dourado.dbml`: modelo relacional DBML.
- `schema (3).prisma`: schema Prisma.
- `openapi-servicos-capim-dourado.yaml`: contrato OpenAPI 3.0.3.
- Captura do VS Code: estrutura atual do monorepo.
- Trechos de `docker-compose.yml`, `.env`, `package.json` raiz e configuração `@t3-oss/env-nextjs`: configuração atual informada pelo desenvolvedor.

## Premissas e pendências conhecidas

- Confirmar se o shopping disponibilizará carrinho de bebê.
- Confirmar os valores iniciais de retenção de dados pessoais e armazenamento de itens encontrados (o modelo indica 180 e 90 dias como valores assumidos).
- Confirmar aviso de privacidade e sua versão vigente.
- Confirmar horários reais de funcionamento e expediente do SAC.
- Confirmar telefone e locais de retirada.
- Confirmar política operacional de retirada, devolução e descarte/encaminhamento de itens.
- Confirmar se a configuração `@t3-oss/env-nextjs` está sendo usada intencionalmente em um pacote compartilhado/backend ou se deverá ser separada por aplicação.
- A captura não permite verificar a estrutura interna de `apps/`; inspecione antes de implementar.
"""