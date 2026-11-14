# Diretrizes do backend

## Stack

- Node.js + TypeScript.
- Fastify para API HTTP.
- Prisma ORM + PostgreSQL.
- Zod para validação.
- JWT com `@fastify/jwt`.
- CASL para autorização.
- Jobs para processos automáticos.

## Organização proposta

```text
apps/api/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── services/
│   │   ├── locations/
│   │   ├── equipment/
│   │   ├── reservations/
│   │   ├── lost-reports/
│   │   ├── found-items/
│   │   ├── sac/
│   │   ├── tracking/
│   │   ├── requests/
│   │   ├── settings/
│   │   ├── indicators/
│   │   └── privacy/
│   ├── http/
│   │   ├── middlewares/
│   │   ├── server.ts
│   │   ├── routes.ts
│   │   └── error-handler.ts
│   ├── jobs/
│   ├── lib/
│   ├── utils/
│   └── index.ts
├── @types/
├── package.json
└── tsconfig.json
```

Esta é a estrutura planejada. Inspecione a estrutura real antes de criar ou mover arquivos.

## Estrutura interna de módulo

Exemplo `modules/reservations/`:

```text
reservations/
├── reservations.routes.ts
├── reservations.controller.ts
├── reservations.service.ts
├── reservations.repository.ts
└── reservations.schemas.ts
```

Responsabilidades:

- **routes:** método, caminho, schema HTTP, hooks de autenticação/autorização e controller.
- **controller:** traduz request/response HTTP e chama serviço.
- **service:** executa regras e coordena o caso de uso.
- **repository:** encapsula acesso ao Prisma.
- **schemas:** validação Zod específica do módulo.

Não coloque regra de negócio em route handler/controller. Não acesse Prisma diretamente no controller.

## Módulos e responsabilidades

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login, logout, sessão e usuário atual. |
| `users` | Gestão de usuários administrativos. |
| `services` | Catálogo e detalhes dos serviços públicos. |
| `locations` | Locais ativos e administração de locais. |
| `equipment` | Cadastro, disponibilidade e agenda de equipamentos. |
| `reservations` | Criação, cancelamento, retirada, devolução e regras de reserva. |
| `lost-reports` | Registro e acompanhamento de objetos perdidos. |
| `found-items` | Cadastro e operação de itens encontrados. |
| `sac` | Mensagens e assuntos do SAC. |
| `tracking` | Consulta pública por protocolo/telefone, cancelamento e mensagens. |
| `requests` | Núcleo comum, fila, detalhe, estado, mensagens e histórico. |
| `settings` | Regras e configurações administrativas. |
| `indicators` | Indicadores agregados. |
| `privacy` | Aviso, consentimento e anonimização. |

## Infraestrutura interna

- `http/`: criação do servidor, registro de plugins/rotas e tratamento central de erros.
- `http/middlewares/`: autenticação, autorização e rate limiting.
- `jobs/`: RF19, RF31 e RF32.
- `lib/`: Prisma, ambiente, e-mail e armazenamento.
- `utils/`: protocolos, telefone e datas.

## Regras técnicas críticas

### Reserva concorrente

A disponibilidade deve ser revalidada no momento da criação, dentro de transação. A estratégia precisa impedir duas reservas concorrentes para a mesma capacidade. O DBML sugere isolamento `SERIALIZABLE` ou `pg_advisory_xact_lock` por tipo de equipamento; escolha uma estratégia, documente e teste.

### Protocolo

Gerar código imprevisível no formato `CAP-XXXX-XXXX`, garantindo unicidade no banco. Não usar ID sequencial como protocolo.

### Horários

Executar cálculos de expediente, bloco, duração e tolerância com timezone `America/Araguaina`; serializar datas conforme contrato ISO 8601/UTC.

### Erros

Usar o formato central `ErrorResponse` definido no OpenAPI, mantendo códigos estáveis.

### Jobs

- RF19: identificar reservas não retiradas após prazo de tolerância e alterar para `no_show`.
- RF31: anonimizar dados pessoais elegíveis, mantendo dados agregados necessários.
- RF32: processar notificações e registrar tentativas.

Jobs devem ser idempotentes sempre que possível e registrar execução em `job_logs`.

## Ambiente informado

O `docker-compose.yml` enviado configura PostgreSQL Bitnami:

- Container: `projeto-x-postgres`.
- Porta local: `5433` → `5432` no container.
- Banco: `projeto_x`.
- Usuário: `postgres`.
- Volume: `postgres_data_projeto_x`.

As configurações atuais parecem herdadas de um projeto anterior. Antes de implementar, decidir se os nomes serão atualizados para Capim Dourado; não alterar sem revisar os arquivos e o ambiente local.

Variáveis informadas:

- `SERVER_PORT=3333`
- `DATABASE_URL` apontando para `localhost:5433/projeto_x`
- `JWT_SECRET` de exemplo.

O valor `my-jwt-secret` não deve ser usado em produção. Gere um segredo forte e mantenha `.env` fora do Git.

## Configuração de ambiente observada

Foi compartilhado um módulo com `createEnv` de `@t3-oss/env-nextjs`, Zod, variáveis `SERVER_PORT`, `DATABASE_URL`, `JWT_SECRET` e `NEXT_PUBLIC_API_URL`. O `runtimeEnv` apresentado inclui as três primeiras, mas não inclui `NEXT_PUBLIC_API_URL`, apesar de ela estar declarada em `shared`. Revisar essa configuração e separar validação de ambiente por aplicação quando necessário. Não presumir que `env-nextjs` seja a escolha correta para o processo Fastify sem conferir a configuração real do pacote.
"""