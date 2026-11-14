# SPEC — Camada de Autorização (CASL)

**Status:** Proposta (aguardando revisão)
**Escopo:** autorização administrativa (Atendente/Gestor) via CASL
**Fontes de verdade:**
- `docs/requirements.md` (RF11–RF30)
- `docs/authorization.md`
- `docs/openapi-servicos-capim-dourado.yaml` (contrato HTTP)
- `docs/architecture.md` e `docs/backend.md`
- Código atual de `packages/auth`

> Nota: o caminho `docs/source-reference/openapi-servicos-capim-dourado.yaml` citado na
> tarefa não existe neste repositório. O contrato está em
> `docs/openapi-servicos-capim-dourado.yaml`. Esta spec usa o caminho real.

---

## 1. Objetivo

Definir, de forma **única e compartilhada** entre backend e frontend, o modelo de
autorização da aplicação usando **CASL**, para controlar o que os perfis administrativos
(`attendant` e `manager`) podem fazer.

A spec estabelece:

- Os **papéis** (`roles`).
- Os **subjects** (recursos de domínio).
- As **actions** (verbos de operação).
- As **regras de ability** por papel.
- A **matriz de permissões** completa, vinculada aos endpoints do OpenAPI.
- Como o **backend** aplica as abilities (autoridade final).
- Como o **frontend** reaproveita as mesmas definições (somente controle de interface).

**Fora de escopo:** implementação, plano de implementação, alteração de código, schema
Prisma ou OpenAPI. Visitante e Sistema **não** são papéis CASL (ver §3).

---

## 2. Contexto atual do projeto

### 2.1 Stack de autenticação/autorização

- **Autenticação:** JWT via `@fastify/jwt` (`Authorization: Bearer <token>`).
- **Autorização:** CASL (`@casl/ability ^7.0.1`).
- **Validação:** Zod.
- **Papéis documentados:** `attendant` e `manager` (OpenAPI + `authorization.md`).

### 2.2 Estado atual de `packages/auth`

O pacote existe, mas **ainda contém o código do template `next-saas-rbac`**, incompatível
com o modelo de papéis do produto. Estrutura atual:

```text
packages/auth/
├── package.json            → @casl/ability ^7.0.1 + zod ^4.4.3 (deps ok)
├── tsconfig.json           → extends @saas/typescript-config/library.json
└── src/
    ├── index.ts            → defineAbilityFor + createAppAbility + AppAbility
    ├── role.ts             → apenas 'ADMIN'
    ├── permissions.ts      → ADMIN → can('manage', 'all')
    ├── models/user.ts      → userSchema { __typename, id, profile }
    └── subjects/user.ts    → subject 'User' (manage/get/update/delete)
```

Divergências em relação ao produto (registradas no `docs/project-audit.md`):

| Item | Template (atual) | Necessário para o produto |
|---|---|---|
| Papéis | `ADMIN` | `attendant`, `manager` |
| Campo do usuário | `profile` | `role` (conforme `users.role` do Prisma) |
| Regras | `manage all` para ADMIN | matriz explícita Atendente/Gestor |
| Subjects | só `User` | 9 subjects de domínio (ver §4) |
| Actions | `manage/get/update/delete` | vocabulário específico (ver §4) |

**O que será reaproveitado:** a infraestrutura CASL existente — `AbilityBuilder`,
`createMongoAbility`/`createAppAbility`, `defineAbilityFor(user)` e o padrão de
`detectSubjectType` via `__typename`. O conteúdo de `role.ts`, `permissions.ts`,
`models/user.ts` e `subjects/*` será **substituído** pelo modelo definido nesta spec.

### 2.3 Contrato OpenAPI (resumo relevante)

- **Segurança global:** `security: - bearerAuth: []` — todos os endpoints exigem JWT por
  padrão; os públicos declaram `security: []` para optar por não exigir.
- **Endpoints públicos** (sem CASL): `/privacy-notice`, `/services`, `/services/{slug}`,
  `/locations`, `/uploads/photos`, `/equipment/{type}/availability`, `/reservations`,
  `/lost-reports`, `/sac-messages`, `/tracking/*`, `/auth/login`, `/auth/logout`.
- **Endpoints administrativos** (exigem JWT + CASL): `/admin/*` e `/auth/me`.
- **Marca de papel:** os endpoints exclusivos do Gestor têm o sufixo `- Gestor` no
  `summary` do OpenAPI (ex.: "Cadastrar equipamento (RF24) - Gestor").

---

## 3. Papéis e responsabilidades

| Papel | Código | Escopo |
|---|---|---|
| Atendente | `attendant` | Operação de solicitações, agenda, achados e perdidos e mensagens. |
| Gestor | `manager` | Tudo do Atendente + configurações, usuários, equipamentos, locais, indicadores e reabertura de solicitações. |

Regras de papéis:

- **Apenas dois papéis administrativos.** Não criar outros.
- **`manager` herda todas as permissões de `attendant`.**
- **Visitante** e **Sistema** são atores do domínio, mas **não são papéis CASL**:
  - Visitante usa endpoints públicos (sem JWT), portanto fora do CASL.
  - Sistema executa jobs internos (RF19/RF31/RF32), fora do fluxo de requisição
    autenticada, portanto fora do CASL.

---

## 4. Subjects e actions

### 4.1 Subjects (conjunto final: 9)

| Subject | Representa | Justificativa |
|---|---|---|
| `Request` | Solicitação (núcleo comum: reserva, objeto perdido, SAC) | Central; concentra fila, detalhe, status e mensagens. |
| `Reservation` | Reserva de equipamento | Ações próprias (`pickup`, `return`) e agenda. |
| `FoundItem` | Item encontrado | Cadastro, consulta e encerramento. |
| `LostReport` | Objeto perdido | Correspondência (`match`) e entrega (`deliver`). |
| `Equipment` | Equipamento | Gestão (Gestor). |
| `Location` | Local | Gestão (Gestor). |
| `User` | Usuário administrativo | Gestão (Gestor). |
| `ReservationSettings` | Regras/horários de reserva | Singleton; leitura e configuração (Gestor). |
| `Indicator` | Indicadores gerenciais | Leitura (Gestor). |

**Subject descartado: `Message`.** As mensagens da equipe são criadas **sempre no
contexto de uma `Request`** (`POST /admin/requests/{id}/messages`) e sua leitura faz parte
do detalhe da solicitação (`Request.read`). Não há CRUD independente de mensagens, então
um subject `Message` teria uma única action — modelamos como a action **`sendMessage`
sobre `Request`** (§4.2). Evita um subject de propósito único.

### 4.2 Actions (conjunto final: 10)

| Action | Significado | Aplicada a |
|---|---|---|
| `read` | Listar / consultar detalhe | Request, Reservation, FoundItem, LostReport, Equipment, Location, User, ReservationSettings, Indicator |
| `create` | Criar | FoundItem, Equipment, Location, User |
| `update` | Editar / inativar | Equipment, Location, User, ReservationSettings |
| `updateStatus` | Transicionar status de uma solicitação | Request |
| `sendMessage` | Enviar mensagem ao visitante | Request |
| `pickup` | Registrar retirada de equipamento | Reservation |
| `return` | Registrar devolução de equipamento | Reservation |
| `match` | Vincular objeto perdido a item encontrado | LostReport |
| `deliver` | Registrar entrega ao dono | LostReport |
| `close` | Encerrar item encontrado | FoundItem |

**Actions descartadas:**

- **`manage`** (meta-action do CASL = "todas as actions"): evitada. A matriz explícita é
  auditável, impede concessões sem endpoint correspondente e simplifica o teste por
  papel. (Pode ser usada como atalho de *escrita interna* nas definições, mas o contrato
  público da matriz usa actions explícitas.)
- **`delete`**: o domínio **não exclui** registros operacionais — usa **inativação**
  (`active = false`), que é `update` (RF24/RF26/RF27). Não há endpoint de exclusão.
- **`reopen`**: **não é uma action distinta.** Reabrir uma solicitação em status final é
  o mesmo endpoint `PATCH /admin/requests/{id}/status`; modelamos como **`updateStatus`
  permitido em status final**, concedido **somente ao Gestor** via condição CASL (ver §6).
  A palavra "reabertura" é usada como rótulo de caso de uso/teste, não como action.

### 4.3 Convenções de nomenclatura

- Nomes de subjects e actions em **inglês, lowercase/camelCase**, alinhados aos enums
  internos do banco/OpenAPI (ex.: `request_status`, `found_items`). Documentado e único.
- Subjects podem ser referenciados por **string** (`'Request'` — "qualquer instância") ou
  por **objeto tipado** com `__typename` e campos (para conditions, ex. `{ status }`).

---

## 5. Matriz completa de permissões

Legenda: ✅ permitido · ❌ negado · ⚠️ permitido com condição/restrição.

### 5.1 Atendente e Gestor (área de atendimento)

| Subject | Action | Atendente | Gestor | Condição/restrição | Endpoint(s) | RF |
|---|---|---|---|---|---|---|
| Request | `read` | ✅ | ✅ | — | `GET /admin/requests`, `GET /admin/requests/{id}` | RF13, RF14 |
| Request | `updateStatus` | ⚠️ | ✅ | Atendente: somente status **não-final** | `PATCH /admin/requests/{id}/status` | RF15 |
| Request | `updateStatus` (reabertura) | ❌ | ✅ | Somente Gestor reabre status final | `PATCH /admin/requests/{id}/status` | RF15 |
| Request | `sendMessage` | ✅ | ✅ | — | `POST /admin/requests/{id}/messages` | RF16 |
| Reservation | `read` | ✅ | ✅ | — | `GET /admin/agenda` | RF17 |
| Reservation | `pickup` | ✅ | ✅ | — | `POST /admin/reservations/{id}/pickup` | RF18 |
| Reservation | `return` | ✅ | ✅ | — | `POST /admin/reservations/{id}/return` | RF18 |
| FoundItem | `read` | ✅ | ✅ | — | `GET /admin/found-items`, `GET /admin/found-items/{id}` | RF20 |
| FoundItem | `create` | ✅ | ✅ | — | `POST /admin/found-items` | RF20 |
| FoundItem | `close` | ✅ | ✅ | Regra de negócio decide prazos/motivo | `POST /admin/found-items/{id}/close` | RF23 |
| LostReport | `read` | ✅ | ✅ | — | `GET /admin/lost-reports/{id}/suggestions` | RF21 |
| LostReport | `match` | ✅ | ✅ | Sugestão **não** confirma propriedade (validação da equipe) | `POST /admin/lost-reports/{id}/match` | RF22 |
| LostReport | `deliver` | ✅ | ✅ | — | `POST /admin/lost-reports/{id}/deliver` | RF22 |

### 5.2 Exclusivo do Gestor

| Subject | Action | Atendente | Gestor | Condição/restrição | Endpoint(s) | RF |
|---|---|---|---|---|---|---|
| Equipment | `read` | ❌ | ✅ | — | `GET /admin/equipment` | RF24 |
| Equipment | `create` | ❌ | ✅ | — | `POST /admin/equipment` | RF24 |
| Equipment | `update` | ❌ | ✅ | Inativação, não exclusão | `PATCH /admin/equipment/{id}` | RF24 |
| ReservationSettings | `read` | ⚠️ | ✅ | *Ver pendência P1* | `GET /admin/settings/reservations` | RF25 |
| ReservationSettings | `update` | ❌ | ✅ | Singleton; mudanças não corrompem reservas existentes | `PUT /admin/settings/reservations` | RF25 |
| Location | `read` | ⚠️ | ✅ | *Ver pendência P1* | `GET /admin/locations` | RF26 |
| Location | `create` | ❌ | ✅ | — | `POST /admin/locations` | RF26 |
| Location | `update` | ❌ | ✅ | Inativação, não exclusão | `PATCH /admin/locations/{id}` | RF26 |
| User | `read` | ❌ | ✅ | — | `GET /admin/users` | RF27 |
| User | `create` | ❌ | ✅ | — | `POST /admin/users` | RF27 |
| User | `update` | ❌ | ✅ | Inativação; nunca remover o último Gestor ativo | `PATCH /admin/users/{id}` | RF27 |
| Indicator | `read` | ❌ | ✅ | — | `GET /admin/indicators/{equipment,lost-and-found,service}` | RF28–RF30 |

### 5.3 Endpoints sem CASL

- **Públicos** (`security: []`): não passam por autorização CASL (só validações de
  negócio/privacidade).
- **`/auth/login` e `/auth/logout`**: públicos.
- **`/auth/me`**: exige JWT (qualquer papel autenticado), mas **não** exige ability
  específica — retorna o usuário autenticado e seu papel.

---

## 6. Regras de autorização

Contrato das abilities (pseudo-código; **não é implementação** — define o comportamento):

```ts
// Papéis
type Role = 'attendant' | 'manager'

// Status considerados "finais" para fins de reabertura (membros a confirmar — P2)
const FINAL_REQUEST_STATUSES = [
  'returned', 'delivered', 'closed_not_found', 'closed', 'cancelled',
] as const

// Regras compartilhadas por Atendente e Gestor
const attendancePermissions = ({ can }) => {
  can('read', 'Request')
  can('sendMessage', 'Request')
  can('read', 'Reservation')
  can('pickup', 'Reservation')
  can('return', 'Reservation')
  can('read', 'FoundItem')
  can('create', 'FoundItem')
  can('close', 'FoundItem')
  can('read', 'LostReport')
  can('match', 'LostReport')
  can('deliver', 'LostReport')
}

const permissions: Record<Role, (user, builder) => void> = {
  attendant(_, { can }) {
    attendancePermissions({ can })
    // Atendente NÃO pode reabrir status final (condição CASL)
    can('updateStatus', 'Request', { status: { $nin: FINAL_REQUEST_STATUSES } })
  },

  manager(_, { can }) {
    attendancePermissions({ can })
    // Gestor pode atualizar status inclusive em estado final (reabertura)
    can('updateStatus', 'Request')

    // Exclusivos do Gestor
    can(['read', 'create', 'update'], 'Equipment')
    can(['read', 'update'], 'ReservationSettings')   // ver P1 sobre read
    can(['read', 'create', 'update'], 'Location')     // ver P1 sobre read
    can(['read', 'create', 'update'], 'User')
    can('read', 'Indicator')
  },
}
```

Observações de contrato:

- A **condition** (`status: { $nin: FINAL_REQUEST_STATUSES }`) exige que a checagem do
  Atendente receba a **instância** da `Request` (objeto com `__typename` e `status`), não
  apenas a string `'Request'`. Ver §7.3.
- A herança `manager ⊇ attendant` é implementada reutilizando `attendancePermissions`
  (não duplica regras).
- `FINAL_REQUEST_STATUSES` é conceito de **domínio** (status do enum `request_status`),
  não de CASL. A lista exata é validada na implementação do serviço (P2).

---

## 7. Integração com o backend

### 7.1 Fluxo de autorização de uma requisição administrativa

1. **Autenticação (JWT)** — middleware `@fastify/jwt` valida o token e extrai `sub`
   (id do usuário). Falha → **401**.
2. **Recuperação do usuário** — o backend carrega o `User` do banco (nunca confia em
   papel vindo do token/cliente). Se inativo ou bloqueado → **401/403** conforme regra
   de login (RF11).
3. **Construção da ability** — `defineAbilityFor(user)` a partir do `user.role`
   (`attendant`/`manager`).
4. **Verificação da permissão** — antes de executar a operação, checar
   `ability.can(action, subject)`. Negado → **403**.
5. **Execução** — regras de negócio rodam no service (validações de transição, etc.).

### 7.2 Separação entre CASL e regra de negócio

| Camada | Decide | Exemplo |
|---|---|---|
| **CASL** | *Se o papel pode* executar a ação | Atendente pode `updateStatus`? |
| **Domínio (service)** | *Se a transição/estado é válido* | `reserved → picked_up` é válido? `open → closed` é válido? |

Fluxo para atualizar status (RF15):

1. CASL: `ability.can('updateStatus', request)` — se for reabertura de status final,
   somente Gestor passa (condição §6).
2. Domínio: o service valida a transição contra a tabela de estados do tipo; inválida →
   **409 `INVALID_STATUS_TRANSITION`**.
3. Autorizou e é válida → aplica, grava histórico.

### 7.3 Checagem com conditions

- Para `updateStatus` do Atendente, o backend já carrega a `Request` (necessária para
  validar a transição). Passa a instância à ability para a condition de status funcionar.
- Para checagens sem condition (ex.: `read`, `pickup`), pode-se usar a **string** do
  subject (ex.: `ability.can('read', 'Request')`).

### 7.4 Códigos HTTP

- **401** — não autenticado (token ausente/inválido).
- **403** — autenticado, mas sem permissão (ex.: Atendente em endpoint de Gestor).
- **404** — recurso inexistente.
- **409** — conflito de regra de negócio (ex.: transição inválida, disponibilidade).

O OpenAPI já documenta `401`/`403` nos endpoints administrativos relevantes.

---

## 8. Integração com o frontend

O frontend (Next.js) **importa as mesmas definições** de `packages/auth` (roles, subjects,
actions, `defineAbilityFor`) para **não duplicar regras**.

Usos (sempre como **controle de interface** — a proteção real é no backend):

1. **Construção da ability** no cliente a partir do usuário autenticado (obtido via
   `GET /auth/me`).
2. **Ocultar ações** não permitidas — ex.: esconder botões de "Configurações",
   "Usuários" e "Indicadores" para Atendente (`ability.can('read', 'Indicator')`).
3. **Proteger páginas administrativas** — redirecionar usuários sem permissão
   (ex.: Atendente acessando `/admin/configuracoes`).
4. **Controlar itens de navegação** — renderizar itens de menu conforme o papel.
5. **Exibir/ocultar ações por papel** — ex.: reabertura de solicitação encerrada só para
   Gestor.

Regras:

- O frontend **nunca** é barreira de segurança. Ocultar botão não autoriza; o backend
  rejeita com 403 se a requisição for forjada.
- O frontend não deve enviar papel ao backend; o backend deriva o papel do token/banco.
- Em caso de divergência frontend × backend, o backend é a autoridade.

---

## 9. Regras de segurança

1. **Usuário inativo não acessa** — login bloqueado (RF11) e checagem de `active` na
   recuperação do usuário antes de construir a ability.
2. **Sempre ao menos um Gestor ativo** — impedir desativar/remover o último `manager`
   ativo (RF27).
3. **Atendente não gerencia usuários** — sem `read/create/update` em `User`.
4. **Atendente não altera configurações** — sem `update` em `ReservationSettings`,
   `Equipment`, `Location`.
5. **Atendente não consulta indicadores** — sem `read` em `Indicator`.
6. **Reabertura só pelo Gestor** — `updateStatus` em status final restrito ao `manager`.
7. **Dados internos não expostos ao visitante** — descrição de item encontrado e detalhe
   de identificação nunca vazam por DTOs públicos (fora do CASL, mas preservado).
8. **Backend não confia em papel do cliente** — o papel é derivado do JWT + banco, nunca
   de corpo/header enviado pelo cliente.
9. **Sem segredos/tokens em logs** — não registrar token ou dados pessoais.

---

## 10. Cenários de testes

### 10.1 Permissões do Atendente (deve permitir)
- Listar/detalhar solicitações (`Request.read`).
- Atualizar status em transição válida e não-final (`Request.updateStatus`).
- Enviar mensagem (`Request.sendMessage`).
- Consultar agenda (`Reservation.read`), retirada (`pickup`) e devolução (`return`).
- Listar/detalhar/cadastrar/encerrar item encontrado (`FoundItem.*`).
- Sugerir/vincular/entregar objeto perdido (`LostReport.*`).

### 10.2 Permissões do Gestor (deve permitir)
- Tudo do Atendente.
- Gerenciar equipamentos, locais, usuários e regras.
- Consultar indicadores.
- Reabrir solicitação em status final.

### 10.3 Negação de acesso (deve negar)
- Atendente → endpoints de Gestor (equipment/settings/locations/users/indicators) → 403.
- Atendente → reabrir solicitação final → 403.
- Papel desconhecido/ausente → 403 (ou erro controlado).

### 10.4 Usuários inativos
- Usuário `active = false` → login negado (401) e, se houver token, acesso negado.

### 10.5 Sem autenticação
- Acessar `/admin/*` sem token → 401.

### 10.6 Ações exclusivas do Gestor
- Cada endpoint de configuração/gestão verificado individualmente para Atendente (403) e
  Gestor (200/2xx).

### 10.7 Reabertura
- Gestor reabre `returned`/`delivered`/`closed*`/`cancelled` → permitido.
- Atendente tenta o mesmo → 403.

### 10.8 Consistência frontend × backend
- Mesmo `defineAbilityFor` usado nos dois lados → resultados idênticos para o mesmo
  usuário (teste unitário que compara a ability gerada para um papel em ambos os pacotes).

### 10.9 Último Gestor ativo
- Desativar o único `manager` ativo → rejeitado (regra de negócio + restrição em
  `User.update`).

---

## 11. Arquivos e pacotes provavelmente afetados

**Pacote `packages/auth` (fonte única):**
- `src/role.ts` — `attendant` | `manager`.
- `src/models/user.ts` — `userSchema` com `role` (substituir `profile`).
- `src/subjects/*` — subjects `Request`, `Reservation`, `FoundItem`, `LostReport`,
  `Equipment`, `Location`, `User`, `ReservationSettings`, `Indicator`.
- `src/permissions.ts` — regras da §6.
- `src/index.ts` — exportar `defineAbilityFor`, `createAppAbility`, `AppAbility`, roles,
  subjects e types.

**Backend `apps/api`:**
- Middleware de autorização (substituir `src/http/middlewares/auth.ts` do template).
- `src/utils/get-user-permissions.ts` — adaptar a `role` e ao novo `defineAbilityFor`.
- Rotas/controllers administrativos — chamadas de `ability.can(...)` por operação.

**Frontend `apps/web`:**
- Consumo de `@saas/auth` para esconder ações, proteger páginas e controlar navegação.

---

## 12. Dúvidas, inconsistências e decisões pendentes

- **P1 — Leitura de `Location` e `ReservationSettings` (Atendente).** No OpenAPI,
  `GET /admin/locations` ("Listar locais, inclusive inativos") e
  `GET /admin/settings/reservations` ("Consultar regras de reserva") **não** têm o
  marcador `- Gestor`, ao contrário dos seus POST/PATCH/PUT e do `GET /admin/equipment`
  (que é `- Gestor`). Porém, RF24–RF27 declaram "Ator: Gestor" e a descrição de papéis da
  tarefa trata esses domínios como Gestor. **Decidir:** Atendente pode `read` em
  Location/ReservationSettings/Equipment ou são integralmente do Gestor? A spec assume
  **Gestor** (conservador) e marca `read` como ⚠️ até confirmação.
- **P2 — Conjunto exato de "status final" para reabertura.** A spec propõe
  `returned, delivered, closed_not_found, closed, cancelled`. Confirmar se `no_show` é
  final/reabrível pelo Gestor.
- **P3 — `reopen` como action explícita vs. condition em `updateStatus`.** A spec adota
  **condition** (menos actions, checagem única). Alternativa: action `reopen` explícita
  sobre `Request`, caso o time prefira legibilidade no código. Registrar decisão.
- **P4 — Campo `role` vs. `profile`.** Alinhar `packages/auth` a `users.role` (Prisma),
  abandonando `profile` do template.
- **P5 — Nomes internos dos subjects.** Confirmar o uso dos nomes em inglês como
  canônicos (consistentes com enums do banco), com rótulos em português apenas na UI.
- **P6 — Caminho do OpenAPI.** A tarefa cita `docs/source-reference/...`; o arquivo real
  está em `docs/openapi-servicos-capim-dourado.yaml`. Sem ação além de usar o caminho real.
- **P7 — Resíduos do template em `apps/api`.** `middlewares/auth.ts`, `error-handler.ts`
  e `@types/fastify.d.ts` referenciam entidades do template (`Membership`, `Organization`)
  e serão substituídos/removidos na implementação da camada de autorização (fora do
  escopo desta spec, mas listado para ciência).

---

*Esta spec não implementa nada e não altera arquivos existentes. Aguarda revisão antes de
qualquer plano de implementação.*
