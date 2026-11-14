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
