# Diretrizes do frontend

## Stack e responsabilidade

- Next.js + React + TypeScript.
- shadcn/ui para componentes base, conforme estrutura atual/planejada.
- Consumo da API REST por HTTP/JSON.
- Área pública para visitantes e área administrativa para Atendente/Gestor.

O frontend é responsável por interface, navegação, formulários, feedback e apresentação de dados. Regras de negócio e autorização devem ser garantidas pelo backend.

## Estrutura planejada

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── (public)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── servicos/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── solicitar/page.tsx
│   │   │   ├── acompanhar/[protocolo]/page.tsx
│   │   │   └── privacidade/page.tsx
│   │   └── (admin)/
│   │       └── admin/
│   │           ├── layout.tsx
│   │           ├── login/page.tsx
│   │           ├── page.tsx
│   │           ├── solicitacoes/page.tsx
│   │           ├── solicitacoes/[id]/page.tsx
│   │           ├── agenda/page.tsx
│   │           ├── achados-e-perdidos/page.tsx
│   │           ├── achados-e-perdidos/novo/page.tsx
│   │           ├── achados-e-perdidos/[id]/page.tsx
│   │           ├── configuracoes/page.tsx
│   │           ├── configuracoes/equipamentos/page.tsx
│   │           ├── configuracoes/regras/page.tsx
│   │           ├── configuracoes/locais/page.tsx
│   │           ├── configuracoes/usuarios/page.tsx
│   │           └── indicadores/page.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── home/
│   │   ├── services/
│   │   ├── reservations/
│   │   ├── lost-found/
│   │   ├── tracking/
│   │   └── admin/
│   ├── services/
│   │   ├── api-client.ts
│   │   └── [módulos de consumo da API]
│   ├── hooks/
│   ├── lib/
│   └── types/
├── public/
├── components.json
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

A estrutura é uma proposta de organização, não afirma que todos os arquivos já existem. Os grupos `(public)` e `(admin)` não aparecem nas URLs. A Home é `(public)/page.tsx` e corresponde a `/`.

## Rotas públicas

| Rota | Finalidade |
|---|---|
| `/` | Home e atalhos para serviços. |
| `/servicos` | Lista de serviços ativos. |
| `/servicos/[slug]` | Detalhes do serviço. |
| `/servicos/[slug]/solicitar` | Fluxo de solicitação conforme o serviço. |
| `/acompanhar/[protocolo]` | Acompanhamento após validação de protocolo e telefone. |
| `/privacidade` | Aviso de privacidade vigente. |

## Rotas administrativas

| Rota | Finalidade |
|---|---|
| `/admin/login` | Login da equipe. |
| `/admin` | Visão inicial/painel. |
| `/admin/solicitacoes` | Fila e filtros. |
| `/admin/solicitacoes/[id]` | Detalhe, histórico e mensagens. |
| `/admin/agenda` | Agenda de equipamentos. |
| `/admin/achados-e-perdidos` | Lista de itens encontrados. |
| `/admin/achados-e-perdidos/novo` | Cadastro de item encontrado. |
| `/admin/achados-e-perdidos/[id]` | Detalhe/operação do item. |
| `/admin/configuracoes` | Visão de configurações. |
| `/admin/configuracoes/equipamentos` | Equipamentos. |
| `/admin/configuracoes/regras` | Regras e horários. |
| `/admin/configuracoes/locais` | Locais. |
| `/admin/configuracoes/usuarios` | Usuários. |
| `/admin/indicadores` | Indicadores gerenciais. |

## Organização de componentes

- `ui/`: componentes primitivos gerados/adaptados pelo shadcn/ui.
- `layout/`: cabeçalho/rodapé públicos, sidebar/header administrativos, contato SAC.
- `home/`: hero, atalhos e informações institucionais.
- `services/`: cards e listagem de serviços.
- `reservations/`: formulário, grade de horários e resumo.
- `lost-found/`: formulários e etapas de achados e perdidos.
- `tracking/`: formulário, linha do tempo e mensagens.
- `admin/`: componentes específicos das telas administrativas.

## Consumo da API

- Centralizar configuração HTTP em `services/api-client.ts`.
- Separar chamadas por domínio (reservations, tracking, services etc.).
- Reutilizar tipos/schemas de `packages/shared` quando existirem e forem apropriados.
- Não duplicar contratos manualmente sem necessidade.
- Tratar estados de carregamento, erro, vazio e sucesso.
- Não confiar em esconder botões para proteger permissões: API deve validar autorização.
- Não persistir segredos de servidor em código cliente.

## Formulários públicos

- Buscar e exibir aviso de privacidade vigente.
- Exigir consentimento antes de enviar.
- Enviar apenas campos necessários.
- Não pedir motivo, deficiência ou condição de saúde na reserva.
- Exibir protocolo retornado após criação.
- Para acompanhamento, exigir protocolo e telefone.
- Não renderizar campos internos, detalhes de identificação ou descrição de item encontrado.
"""

files["docs/authorization.md"] = r"""
# Autenticação e autorização

## Perfis de usuário

O sistema possui dois perfis administrativos:

| Perfil | Código | Permissões funcionais |
|---|---|---|
| Atendente | `attendant` | Solicitações, agenda, achados e perdidos e mensagens. |
| Gestor | `manager` | Todas as permissões do Atendente + configurações, usuários e indicadores. |

Visitantes não possuem conta e usam os fluxos públicos com protocolo e telefone.

## Autenticação

- Login por e-mail e senha.
- Senhas armazenadas somente como hash seguro.
- JWT para autenticação das rotas administrativas.
- Usuário inativo não pode autenticar.
- Sessão expira por inatividade.
- Bloqueio temporário após várias tentativas inválidas.
- Endpoints administrativos exigem `Authorization: Bearer <JWT>`.

O OpenAPI define `/auth/login`, `/auth/logout` e `/auth/me`.

## CASL

O projeto utiliza CASL para autorização. A captura mostra o pacote `packages/auth` com:

```text
packages/auth/src/
├── models/
│   └── user.ts
├── subjects/
│   └── user.ts
├── index.ts
├── permissions.ts
└── role.ts
```

Antes de implementar ou alterar permissões, leia os arquivos reais desse pacote e preserve suas abstrações/exportações existentes.

## Diretriz de uso

- Definir abilities/capabilities de acordo com o perfil.
- Criar o contexto de autorização a partir do usuário autenticado.
- Verificar permissões no backend em cada endpoint administrativo.
- Utilizar o frontend apenas para adaptar a experiência visual (ex.: esconder ações não disponíveis).
- Não confiar no frontend como mecanismo de segurança.
- Rotas exclusivas de Gestor devem negar Atendente com HTTP 403.
- Rotas sem JWT devem negar com HTTP 401.

## Matriz funcional inicial

| Recurso | Atendente | Gestor |
|---|---:|---:|
| Consultar fila de solicitações | Sim | Sim |
| Consultar detalhes | Sim | Sim |
| Atualizar estado | Sim | Sim |
| Enviar/responder mensagens | Sim | Sim |
| Consultar agenda | Sim | Sim |
| Registrar retirada/devolução | Sim | Sim |
| Gerenciar achados e perdidos | Sim | Sim |
| Gerenciar equipamentos | Não | Sim |
| Gerenciar regras/horários | Não | Sim |
| Gerenciar locais | Não | Sim |
| Gerenciar usuários | Não | Sim |
| Consultar indicadores | Não | Sim |

A matriz resume RF12. A granularidade de abilities (ações e subjects CASL) deve seguir o código existente e os endpoints OpenAPI; não inventar abilities sem mapear o caso de uso.

## Regras de proteção adicionais

- Não permitir remover/desativar o último Gestor ativo.
- Não permitir login de usuário inativo ou bloqueado.
- Não expor hash de senha em respostas.
- Aplicar rate limit em login e consulta pública por protocolo.
- Registrar tentativas e eventos relevantes sem armazenar credenciais em logs.
"""

files["docs/conventions.md"] = r"""
# Convenções de desenvolvimento

## Monorepo e ferramentas

- Gerenciador: PNPM, versão informada `9.0.0`.
- Orquestração: Turborepo `^2.10.11`.
- TypeScript: `5.9.2`.
- Node: engines informadas `>=18`.
- Scripts raiz informados:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm check-types`

Antes de executar, confira os scripts e versões atuais no `package.json` e nos workspaces.

## TypeScript

- Manter tipagem explícita nas fronteiras (HTTP, banco, integração).
- Evitar `any`; justificar exceções.
- Reutilizar tipos compartilhados quando disponíveis.
- Não duplicar enums de domínio em múltiplas aplicações.

## Nomes e organização

- Pastas e arquivos em kebab-case, conforme a estrutura proposta (`lost-reports`, `reservations`).
- Classes/types/interfaces em PascalCase.
- Variáveis e funções em camelCase.
- Constantes em UPPER_SNAKE_CASE quando forem constantes globais.
- Rotas HTTP seguem o contrato OpenAPI.
- Não renomear contratos públicos sem atualizar OpenAPI e consumidores.

## Backend

- Routes: definição HTTP.
- Controller: adaptação HTTP.
- Service: regras e casos de uso.
- Repository: persistência.
- Schemas: validação.
- Não acessar Prisma diretamente em controller.
- Tratar erros por handler central.
- Testar regras de negócio sem depender de servidor/banco quando possível; manter testes de integração para persistência e HTTP.

## Frontend

- `app/` contém roteamento e layouts Next.js.
- `components/` contém componentes visuais.
- `services/` contém clientes/funções de API.
- `hooks/` contém hooks reutilizáveis.
- `lib/` contém utilitários e configuração.
- `types/` contém tipos locais quando não compartilhados.
- Componentes de `ui/` devem permanecer genéricos; componentes de domínio ficam fora de `ui/`.

## Segurança e dados

- Nunca commitar `.env`.
- `.env.example` contém somente placeholders.
- Nunca incluir segredo JWT real em documentação ou código.
- Não registrar senha, token ou dados pessoais desnecessários em logs.
- Validar e normalizar telefone.
- Limitar tentativas em endpoints sensíveis.
- Aplicar minimização de dados e consentimento.

## Datas

- Persistir instantes em UTC (`timestamptz`).
- Interpretar expediente e horários do shopping em `America/Araguaina`.
- Usar ISO 8601 nas respostas/requests conforme OpenAPI.
- Não usar timezone local implícito do servidor para regras de negócio.

## Testes e qualidade

- Cobrir regras de negócio e transições de estado.
- Testar permissões de Atendente e Gestor.
- Testar cenários de concorrência de reserva.
- Testar proteção de dados públicos.
- Rodar lint, typecheck, testes e build aplicáveis.
"""

files["docs/specs/README.md"] = r"""
# Especificações de funcionalidades

Este diretório contém especificações de implementação por fluxo ou conjunto de requisitos.

## Como criar uma spec

Cada spec deve conter:

1. Identificação e RFs relacionados.
2. Contexto/problema.
3. Objetivo e escopo.
4. Atores e permissões.
5. Pré-condições.
6. Fluxo principal.
7. Fluxos alternativos e erros.
8. Regras de negócio.
9. Contratos/API envolvidos.
10. Dados envolvidos.
11. Critérios de aceite verificáveis.
12. Casos de teste.
13. Dependências e arquivos previstos.

## Organização sugerida

- `public-services.md`: RF01–RF02.
- `reservations.md`: RF03–RF04, RF17–RF19.
- `lost-and-found.md`: RF05, RF20–RF23.
- `sac-and-tracking.md`: RF06–RF09, RF13–RF16.
- `authentication-and-access.md`: RF11–RF12, RF27.
- `settings-and-indicators.md`: RF24–RF30.
- `privacy-and-notifications.md`: RF10, RF31–RF32.

Não iniciar uma implementação complexa sem uma spec aprovada. Não preencher lacunas de negócio com suposições: registrar como decisão pendente.
"""
