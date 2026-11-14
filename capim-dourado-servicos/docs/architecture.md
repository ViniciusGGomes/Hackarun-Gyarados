# Arquitetura

## Estilo arquitetural

A solução adota **monólito modular** em um **monorepositório**. Frontend e backend são aplicações independentes no mesmo repositório, e o backend é dividido por módulos de domínio.

Não transformar os módulos em microsserviços sem decisão explícita.

## Visão dos componentes

```text
Visitante / Equipe
       |
       v
Frontend Next.js
       |
       | HTTP/JSON
       v
API REST — Fastify (Node.js)
       |
       +--> Autenticação JWT
       +--> Autorização CASL
       +--> Módulos de domínio
       |      +--> Services / casos de uso
       |      +--> Repositories
       |      +--> Controllers / Routes
       |
       v
Prisma ORM
       |
       v
PostgreSQL

Jobs do backend:
- Não comparecimento (RF19)
- Anonimização (RF31)
- Notificações (RF32)
```

## Monorepo

O repositório utiliza PNPM Workspaces e Turborepo.

Estrutura planejada de alto nível:

```text
capim-dourado-servicos/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── auth/
│   └── shared/
├── config/
│   ├── eslint-config/
│   ├── prettier/
│   └── typescript-config/
├── docs/
├── AGENTS.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

A estrutura acima é a organização-alvo documental. A captura atual confirma `apps/`, `config/` e `packages/auth/`; não confirma a existência de `packages/shared/` nem o conteúdo interno de `apps/`. Inspecione o repositório antes de criar/mover arquivos.

## Responsabilidades das aplicações

### `apps/api`

- API REST Fastify.
- Autenticação JWT e autorização CASL.
- Regras de negócio.
- Validação de entrada.
- Persistência via Prisma.
- Jobs agendados.
- Integrações externas, como e-mail e armazenamento de fotos.

### `apps/web`

- Aplicação Next.js.
- Área pública e painel administrativo.
- Formulários e acompanhamento de solicitações.
- Consumo da API REST.
- Controle de navegação conforme sessão/permissão, sem substituir a autorização no backend.

### `packages/auth`

Pacote compartilhado existente na captura, contendo modelos/subjects/roles/permissions para autorização. Deve ser inspecionado antes de alterar. A autorização efetiva de endpoints sempre deve ser validada no backend.

### `packages/shared`

Pacote planejado para contratos compartilhados, como enums, tipos e schemas Zod usados por web e API. Antes de duplicar tipos, verificar se o pacote já existe e quais contratos já exporta.

### `config`

Configurações compartilhadas de ESLint, Prettier e TypeScript.

## Camadas do backend

Cada módulo de domínio mantém suas responsabilidades:

| Camada | Responsabilidade |
|---|---|
| Routes | Registrar endpoints e associá-los aos controllers. |
| Controller | Adaptar requisição HTTP para chamada do serviço e resposta HTTP. |
| Service | Orquestrar casos de uso e regras de negócio. |
| Repository | Encapsular consultas e persistência. |
| Schemas | Validar entradas/contratos locais com Zod. |

Prisma deve permanecer atrás da camada de repositório, evitando acesso ao banco diretamente em controllers ou componentes de rota.

## Fluxo típico de uma requisição

1. Fastify recebe a requisição.
2. Plugins e middlewares aplicam parsing, autenticação e autorização conforme a rota.
3. Controller obtém os dados validados.
4. Service executa o caso de uso e regras de domínio.
5. Repository acessa PostgreSQL via Prisma.
6. Controller converte o resultado em resposta HTTP conforme OpenAPI.
7. Tratador central converte erros conhecidos para o formato padronizado.

## Fronteiras de confiança

- Visitante não autenticado pode acessar somente rotas públicas.
- Rotas administrativas exigem JWT.
- CASL verifica capacidades conforme o usuário autenticado.
- O backend é a autoridade final de autorização.
- O frontend nunca deve ser considerado barreira de segurança.
- Dados internos de achados e perdidos não podem vazar por DTOs públicos.

## Convenções temporais

- Timezone operacional: `America/Araguaina`.
- Transporte da API: ISO 8601/UTC, conforme OpenAPI.
- Cálculos de expediente, blocos e tolerâncias devem converter corretamente entre horário local e UTC.
"""
