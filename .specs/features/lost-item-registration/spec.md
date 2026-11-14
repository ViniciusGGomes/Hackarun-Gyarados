# Lost Item Registration Specification

**Status**: Approved
**Approved**: 2026-11-14 - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas"

## Problem Statement

O visitante que perdeu um objeto no shopping ainda não consegue registrá-lo: `POST /lost-reports`
não existe e o módulo `lost-reports` só tem as três rotas administrativas vazias
(`/admin/lost-reports/:id/suggestions|match|deliver`). Esta feature entrega o RF05 (e a parte de
consentimento do RF10 que ele exige): receber o formulário público, gravar a solicitação com status
`registered`, devolver um protocolo imprevisível e não expor nenhum dado pessoal. O acompanhamento
(RF07), o cancelamento (RF08), as mudanças de status e a correspondência com itens encontrados
(RF15, RF21, RF22) pertencem a outras features.

## Goals

- [ ] `POST /api/v1/lost-reports` cria a solicitação (`Request` tipo `lost_report` + `LostReport` + `Consent` + histórico inicial) em uma transação e responde `201` com `protocol`, `status` `registered`, `createdAt` e `trackingPath`.
- [ ] Toda entrada inválida (campos, formatos, limites, data, local, consentimento) responde `400` com código estável e não grava nada.
- [ ] Nenhuma resposta nem log expõe nome, telefone, e-mail, descrição ou detalhe de identificação.
- [ ] O visitante não consegue escolher o status; o status inicial é sempre `registered`.
- [ ] Tentativas automatizadas são limitadas (`429`).

## Current State

Verificado no código da branch `backend`, no Prisma e nos documentos:

| Área | Situação encontrada | Consequência |
| --- | --- | --- |
| `apps/api/src/modules/lost-reports/*` | `lost-reports.routes.ts` com 3 rotas admin que retornam `{}`; controller, service, repository e schemas existem **vazios**. `http/routes.ts` já registra `lostReportsRoutes` | A rota pública entra neste módulo (ver Q1: o pedido fala em `lost-items`). |
| Prisma `Request` | `protocol` único `VarChar(13)`, `type`, `status`, `visitorName` (obrigatório, 120), `visitorPhone?` (11), `visitorEmail?` (255), `completedAt?`, `anonymizedAt?` | Dados pessoais ficam em `requests` (anonimização RF31). Sem mudança de schema. |
| Prisma `LostReport` | `category`, `description` (500), `identificationDetail?` (300), `photoUrl?` (500), `locationId?`, `unknownLocation` (padrão `false`), `lostDate` (`Date`), `lostPeriod` (padrão `unknown`), `foundItemId?`, `matchedAt?`, `identificationValidated?`, `deliveredAt?`, `deliveryNotes?` | Todos os campos do formulário já têm coluna; os campos de correspondência/entrega ficam nulos. |
| Prisma `Consent`, `RequestHistory`, `PrivacyNotice`, `Location` | `Consent` (`privacyNoticeVersion` FK, `purpose`), `RequestHistory` (`fromStatus` nulo, `toStatus`, `actorType`), `PrivacyNotice` com no máximo um `active`, `Location.active` | Reutilizados como em `reservations`. |
| Enums Prisma | `ObjectCategory`: `documents, wallet_bag, phone_electronics, keys, clothing_accessories, glasses_jewelry, other`; `DayPeriod`: `morning, afternoon, night, unknown`; `RequestStatus` inclui `registered, searching, possible_match, ready_for_pickup, delivered, closed_not_found, cancelled` | O status final de busca sem sucesso é `closed_not_found` (ver I1). |
| `reservations` (concluída) | Já implementa: consentimento (`CONSENT_REQUIRED`), `generateProtocol` com checagem antes do insert, `rateLimit` em memória (10/min por IP), `AppError`, histórico inicial, transação Prisma | Mesmos padrões e utilitários; sem criar segunda implementação. |
| `utils/protocol.ts` e `http/middlewares/rate-limit.ts` | Existem e servem a qualquer módulo | Reutilizar. |
| `modules/privacy` | `GET /privacy-notice` devolve a versão ativa | O formulário lê a versão aí; o POST valida contra a versão ativa do banco. |
| `POST /uploads/photos` | Não existe no código; o OpenAPI o descreve (multipart, 5 MB, jpeg/png/webp, retorna `url`) e o `lib/` não tem armazenamento | Ver Q4. |
| `docs/conventions.md` e `docs/specs/` | Citados pelo `AGENTS.MD`; **não existem** | Pendência de documentação (I8); a spec segue as convenções observadas no código e nas specs anteriores. |

## Out of Scope

| Feature | Reason |
| --- | --- |
| Consulta por protocolo (`POST /tracking/lookup`, RF07) e visão `TrackingView` do objeto perdido | Feature própria; aqui só o `trackingPath` é devolvido. |
| Cancelamento de objeto perdido pelo visitante (RF08, parte `lost_report`) | O pedido de cancelamento fica no módulo `tracking`; a spec de reservas deixou `409 REQUEST_NOT_CANCELLABLE` para outros tipos. |
| Resposta do visitante à equipe (RF09) e mensagem da equipe (RF16) | Outras features. |
| Mudança de status, reabertura, fila e detalhe administrativos (RF13-RF15) | Fluxo administrativo, outra feature. |
| Itens encontrados (RF20), sugestões (RF21), correspondência e entrega (RF22), `/admin/lost-reports/*` | Outras features; as rotas admin existentes ficam como estão. |
| Notificação por e-mail (RF32) | Job/notificação; o e-mail é só gravado. |
| Anonimização (RF31) | Job; esta feature só garante que os dados pessoais ficam em `requests` e anota a lacuna dos textos livres (I6). |
| `POST /uploads/photos` | Depende de Q4. Recomendado como feature própria. |
| Alterar Prisma, criar migrations, OpenAPI ou código | Pedido explícito desta etapa. |
| Frontend | Contrato apenas. |

---

## Assumptions & Open Questions

Q1-Q5 eram decisões de produto e foram respondidas pelo usuário (recomendações aceitas).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Q1 Pasta do módulo | Usar `apps/api/src/modules/lost-reports/` (já existe, tem as rotas admin, e é o nome de `docs/backend.md` e da rota `/lost-reports`) em vez de criar `lost-items/` | Criar `lost-items` duplicaria o módulo e deixaria `lost-reports` vazio; o pedido pode ter usado o nome do conceito | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Q2 `locationId` e `unknownLocation=true` juntos | `400 VALIDATION_ERROR`: exatamente um dos dois (`locationId` válido ativo **ou** `unknownLocation=true`) | RF05 exige "local aproximado **ou** não sei"; aceitar os dois guardaria um dado contraditório | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Q3 Limites de `lostDate` | Só rejeita data futura (em `America/Araguaina`) e data de calendário inexistente; sem limite para trás | Nenhuma fonte define idade máxima; o objeto pode ter sido perdido há meses e a equipe decide | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Q4 Foto (`photoUrl`) e upload | Aceitar `photoUrl` opcional (`uri` `http`/`https`, ≤ 500) gravado como veio; `POST /uploads/photos` fica para outra feature | O campo está em `CreateLostReport` e no Prisma; o upload precisa de multipart + armazenamento (infra nova) | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Q5 Duplicidade | Sem limite por telefone nem deduplicação: dois registros iguais criam dois protocolos; a defesa é o limite de 10/min por IP | RF05 não limita a quantidade; criar um bloqueio exigiria código de erro que o OpenAPI não tem (`ErrorResponse.code`) | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Nome do status final | A spec usa `closed_not_found` (OpenAPI, Prisma, DBML, `requirements.md`); o pedido cita `closed_without_location`, que não existe em nenhuma fonte | Instrução do pedido: não contradizer o OpenAPI/Prisma e não alterar o schema | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Validação | Todo o corpo é validado por schema Zod em `lost-reports.schemas.ts`, ligado à rota; regras que dependem do banco (local ativo, versão do aviso) ficam no service | Pedido do usuário; padrão das rotas existentes | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Endpoint | Só `POST /api/v1/lost-reports` (público, `security: []`); mesma `/api/v1` das demais rotas | OpenAPI e `docs/api.md` | y (documentado) |
| Telefone | `^[0-9]{10,11}$`, só dígitos; obrigatório (está em `required` do OpenAPI) mesmo com `Request.visitorPhone` nulo no banco | `Phone` do OpenAPI; a coluna é opcional por causa da anonimização | y (documentado) |
| E-mail | Opcional, formato e-mail, ≤ 255 (limite da coluna; o OpenAPI não define `maxLength`) | Coluna `varchar(255)`; não contradiz o contrato | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Limites de texto | `name` ≤ 120, `description` ≤ 500, `identificationDetail` ≤ 300, `photoUrl` ≤ 500; `name` e `description` não podem ficar vazios após `trim` | OpenAPI e colunas Prisma | y (documentado) |
| Sanitização | Texto recebido passa por `trim` e perde caracteres de controle (exceto quebra de linha em `description`/`identificationDetail`); nenhum HTML é removido nem escapado no armazenamento (o cliente escapa na saída); a API não devolve esses textos | Valida e normaliza sem alterar o sentido; a saída pública não contém os textos | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Campos desconhecidos no corpo | Ignorados (Zod `strip`) e nunca gravados; `status`, `protocol` ou `id` enviados pelo visitante não têm efeito | Mesma regra aprovada em `reservations`; garante que o visitante não escolhe o status | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Consentimento | `consent.accepted = true` e `privacyNoticeVersion` igual à versão do aviso ativo; grava `Consent` com `purpose = 'atender a solicitação'` | RF10, OpenAPI, feature `reservations-and-availability` | y (documentado) |
| Histórico inicial | Uma linha em `request_history`: `fromStatus` nulo, `toStatus = registered`, `actorType = visitor` | RF14/RF15 e padrão de `reservations` | y (documentado) |
| `lostPeriod` | Opcional; ausente grava `unknown` (padrão do Prisma e do DBML); a combinação com a hora atual não é validada | RF05 pede "data/período"; o OpenAPI não o põe em `required` | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Serviço ativo | A rota não consulta `Service`: o registro não depende de o serviço de achados e perdidos estar ativo | Nenhuma fonte liga o POST ao estado do serviço | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Limite de abuso | 10 requisições por minuto por IP em `POST /lost-reports`, em memória, contando também requisições inválidas | Mesmo limite aprovado em `reservations` (D8); o OpenAPI declara `429` | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |
| Protocolo | `CAP-XXXX-XXXX` (alfabeto sem ambíguos, gerador criptográfico), com checagem prévia e repetição em colisão | `docs/backend.md`, `utils/protocol.ts` | y (documentado) |
| Logs | Erros inesperados registram só o tipo/mensagem do erro, nunca o corpo da requisição nem campos do formulário | `AGENTS.MD`; pedido (não registrar dados pessoais) | y (documentado) |
| Estratégia de teste | Integração contra o PostgreSQL de teste (`hackathon_test`) como em `reservations` e unitários sem banco para a validação | Prova a atomicidade e a persistência de verdade; decidir a forma exata no Design | y - user: "aceito as recomendações, lembra do zod para validar os dados nas rotas" |

**Open questions:** none - Q1 a Q5 resolvidas (recomendações aceitas) e as demais premissas confirmadas.

---

## Endpoints (contracts)

Base path `/api/v1`. Erros em `ErrorResponse` `{ statusCode, code, message }` (AD-002). Contrato conforme o OpenAPI; nada foi inventado.

| Method | Path | Auth | Request | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/lost-reports` | none | `CreateLostReport` | `201 ProtocolCreated` | `400 VALIDATION_ERROR` / `CONSENT_REQUIRED`, `429 TOO_MANY_REQUESTS`, `500 INTERNAL_ERROR` |

`CreateLostReport` (campos exatamente do OpenAPI):

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `category` | `ObjectCategory` | sim | um dos 7 valores |
| `description` | string | sim | 1-500 após `trim` |
| `identificationDetail` | string | não | ≤ 300; só equipe |
| `photoUrl` | string `uri` | não | ≤ 500; ver Q4 |
| `locationId` | uuid | condicional | local ativo; ver Q2 |
| `unknownLocation` | boolean | condicional | padrão `false`; `true` quando "não sei" |
| `lostDate` | `date` (`YYYY-MM-DD`) | sim | data real, não futura (Q3) |
| `lostPeriod` | `DayPeriod` | não | padrão `unknown` |
| `name` | string | sim | 1-120 após `trim` |
| `phone` | string | sim | `^[0-9]{10,11}$` |
| `email` | string `email` | não | ≤ 255 |
| `consent` | `{ accepted: true, privacyNoticeVersion }` | sim | versão ativa |

`ProtocolCreated`: `protocol` (`CAP-XXXX-XXXX`), `status` (`registered`), `createdAt`, `trackingPath` (`/acompanhar/{protocol}`).

Os códigos `404`, `409` e `403` não existem nesta rota. Um `locationId` inexistente ou inativo responde `400` (não há `404` no contrato desta operação).

---

## Business Rules

| # | Regra |
| --- | --- |
| BR1 | O registro é feito sem login e sem conta (RF05, RF10). |
| BR2 | Obrigatórios: `category`, `description`, local (`locationId` ou `unknownLocation=true`), `lostDate`, `name`, `phone`, `consent` (RF05). |
| BR3 | O status inicial é `registered`; o visitante não define status; só o fluxo administrativo o altera. |
| BR4 | Nome, telefone e e-mail ficam em `requests`; categoria, descrição, detalhe, foto, local e data ficam em `lost_reports`. |
| BR5 | `identificationDetail` e `description` são internos e nunca voltam em resposta pública (RF05, `AGENTS.MD`). |
| BR6 | Criar o registro é atômico: `Request`, `LostReport`, `Consent` e histórico inicial ou nada. |
| BR7 | O protocolo é imprevisível e único; sozinho não dá acesso a nada (o acompanhamento exigirá protocolo + telefone, RF07). |
| BR8 | O consentimento é da versão vigente do aviso; sem ele nada é gravado (RF10). |
| BR9 | Só se coleta o que o formulário do contrato prevê; não há pergunta sobre motivo, saúde ou deficiência. |

---

## Main and Alternative Flows

```
Formulário                        API                                   Banco
   | GET /privacy-notice  ------>  versão ativa
   | GET /locations       ------>  locais ativos
   | POST /lost-reports   ------>  1. rate limit (IP)            -> 429
   |                               2. validar corpo (Zod)        -> 400 VALIDATION_ERROR
   |                               3. consentimento              -> 400 CONSENT_REQUIRED
   |                               4. local ativo (se locationId)-> 400 VALIDATION_ERROR
   |                               5. data não futura (local)    -> 400 VALIDATION_ERROR
   |                               6. transação: protocolo livre; Request + LostReport + Consent + histórico
   |   <--- 201 { protocol, status: registered, createdAt, trackingPath }
```

Fluxos alternativos: entrada inválida (400, nada gravado); falha no meio da transação (rollback, `500 INTERNAL_ERROR`, nada gravado); colisão de protocolo (gera outro); excesso de requisições (`429`).

---

## Validation Rules

- Zod (`fastify-type-provider-zod`, como nas demais rotas) valida o corpo no schema da rota, antes do controller; erro de formato = `400 VALIDATION_ERROR` com `details` por campo quando houver.
- `category`, `lostPeriod`: enum exato. `lostDate`: ISO `YYYY-MM-DD`, data real (`2026-02-30` é inválida), `≤` hoje em `America/Araguaina`.
- `locationId`: uuid de `Location.active = true`. Regra de exclusividade com `unknownLocation`: Q2.
- Telefone só dígitos (`^[0-9]{10,11}$`); formatos com máscara (`(63) 99999-8888`) são `400`.
- `consent.accepted` deve ser `true`; versão diferente da ativa (ou sem aviso ativo) = `CONSENT_REQUIRED`.
- Corpo ausente, não-objeto ou JSON inválido = `400 VALIDATION_ERROR`.

---

## Security

- Rota pública, sem token e sem `authorize`; nenhuma resposta devolve dados do formulário além do `ProtocolCreated`.
- O protocolo vem de `crypto.randomInt` (não sequencial); descobrir um protocolo não permite ler nada porque esta feature não tem rota de leitura.
- Consultas de terceiros dependem de protocolo **e** telefone (RF07, outra feature); esta feature não cria rota que aceite só o protocolo.
- `429` por IP; erros inesperados em `500 INTERNAL_ERROR` genérico, sem stack nem dados do corpo na resposta.
- Logs sem corpo da requisição, nome, telefone, e-mail, descrição ou detalhe de identificação.
- Texto livre é gravado como recebido (após `trim`/controles) e nunca interpretado como HTML ou SQL: o Prisma parametriza as consultas.

---

## User Stories

### P1: Registrar objeto perdido ⭐ MVP

**User Story**: As a visitor, I want to register a lost object without creating an account so that the staff can look for it and contact me.

**Why P1**: RF05, objetivo da feature.

**Acceptance Criteria** (cada linha é um padrão EARS):

1. WHEN a visitor sends a valid `POST /lost-reports` THEN the system SHALL return `201` with `protocol`, `status` `registered`, `createdAt` and `trackingPath` `/acompanhar/{protocol}`. (LIR-01)
2. The system SHALL create the `Request` (type `lost_report`, status `registered`, `visitorName`, `visitorPhone`, `visitorEmail`), the `LostReport` (category, description, identification detail, photo URL, location, `unknownLocation`, `lostDate`, `lostPeriod`), the `Consent` and the first `RequestHistory` row (from `null` to `registered`, actor `visitor`) in one transaction. (LIR-02)
3. WHERE `lostPeriod` is absent the system SHALL store `unknown`, and WHERE `unknownLocation` is absent the system SHALL store `false`. (LIR-02)
4. The system SHALL leave `foundItemId`, `matchedAt`, `identificationValidated`, `deliveredAt`, `deliveryNotes`, `completedAt` and `anonymizedAt` empty on creation. (LIR-02)
5. The system SHALL generate a unique, unpredictable protocol in the format `CAP-XXXX-XXXX` and SHALL generate another one if the value collides with an existing one. (LIR-03)
6. WHEN two valid requests are sent THEN the system SHALL create two distinct `Request` rows with two distinct protocols, even when their content is identical (Q5). (LIR-03)
7. IF any step of the transaction fails THEN the system SHALL roll back every row, leave no orphan `Request`, and return `500` with code `INTERNAL_ERROR`. (LIR-07)

**Independent Test**: `POST /lost-reports` válido devolve `201` com protocolo e `registered`; no banco existem os quatro registros ligados.

---

### P1: Validar os dados do formulário ⭐ MVP

**User Story**: As a visitor, I want clear errors when the form is wrong so that I can fix it, and as the shopping I want only valid data stored.

**Why P1**: Entrada pública; sem validação o banco recebe lixo e dados contraditórios.

**Acceptance Criteria**:

1. The system SHALL validate the request body with a Zod schema bound to the route, before the controller runs. (LIR-04)
2. IF `category`, `description`, `lostDate`, `name`, `phone` or `consent` is missing THEN the system SHALL return `400` with code `VALIDATION_ERROR` and SHALL NOT persist anything. (LIR-04)
3. IF `category` or `lostPeriod` is not one of the enum values THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (LIR-04)
4. IF `phone` does not match `^[0-9]{10,11}$` THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (LIR-04)
5. IF `email` is sent and is not a valid e-mail address or is longer than 255 characters THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (LIR-04)
6. IF `name` is longer than 120, `description` longer than 500, `identificationDetail` longer than 300 or `photoUrl` longer than 500 characters THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (LIR-04)
7. IF `name` or `description` is empty or only whitespace THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (LIR-04)
8. IF `photoUrl` is sent and is not an `http` or `https` URI THEN the system SHALL return `400` with code `VALIDATION_ERROR` (Q4). (LIR-04)
9. IF `lostDate` is not a real calendar date in `YYYY-MM-DD` THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (LIR-05)
10. IF `lostDate` is later than today in `America/Araguaina` THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (LIR-05)
11. WHEN `lostDate` is today in `America/Araguaina` THEN the system SHALL accept it. (LIR-05)
12. IF neither `locationId` nor `unknownLocation` `true` is sent THEN the system SHALL return `400` with code `VALIDATION_ERROR`. (LIR-06)
13. IF `locationId` and `unknownLocation` `true` are both sent THEN the system SHALL return `400` with code `VALIDATION_ERROR` (Q2). (LIR-06)
14. IF `locationId` is not a uuid, does not exist or belongs to an inactive `Location` THEN the system SHALL return `400` with code `VALIDATION_ERROR` and SHALL NOT persist anything. (LIR-06)
15. WHEN `unknownLocation` is `true` and no `locationId` is sent THEN the system SHALL store `locationId` empty and `unknownLocation` `true`. (LIR-06)
16. The system SHALL trim `name`, `description`, `identificationDetail` and `email` and SHALL remove control characters before validating the limits and storing. (LIR-04)
17. The system SHALL ignore body fields that are not part of `CreateLostReport` and SHALL NOT store them. (LIR-08)

**Independent Test**: Enviar um corpo sem `description` e outro com telefone `(63) 99999-8888`: ambos `400`, nada no banco.

---

### P1: Exigir consentimento ⭐ MVP

**User Story**: As the shopping, I want the visitor's consent to the current privacy notice recorded before any personal data is stored.

**Why P1**: RF10, obrigatório em todo formulário público.

**Acceptance Criteria**:

1. IF `consent.accepted` is not `true` THEN the system SHALL return `400` with code `CONSENT_REQUIRED` and SHALL NOT persist anything. (LIR-09)
2. IF `consent.privacyNoticeVersion` is not the version of the active privacy notice, or no notice is active, THEN the system SHALL return `400` with code `CONSENT_REQUIRED` and SHALL NOT persist anything. (LIR-09)
3. WHEN the request is valid THEN the system SHALL store one `Consent` with the version, `purpose` `atender a solicitação` and the acceptance time, linked to the request. (LIR-09)

**Independent Test**: Corpo válido com versão `0.0` devolve `400 CONSENT_REQUIRED` e nada é gravado.

---

### P1: Proteger dados pessoais e o status ⭐ MVP

**User Story**: As a visitor, I want my data protected and as the shopping I want only the staff to control the status.

**Why P1**: Pedido de privacidade e segurança; `AGENTS.MD`.

**Acceptance Criteria**:

1. The system SHALL NOT require authentication for `POST /lost-reports`. (LIR-10)
2. The system SHALL NOT include `name`, `phone`, `email`, `description`, `identificationDetail`, `photoUrl`, `category` or location in any response of this feature; the `201` body has only the four `ProtocolCreated` fields. (LIR-10)
3. The system SHALL set the status to `registered` regardless of any `status` sent by the visitor. (LIR-08)
4. The system SHALL NOT write the request body or any of its personal fields to the logs, including on `500` errors. (LIR-10)
5. IF the same `phone` is used for another visitor's request THEN the system SHALL NOT reveal that request or its protocol in the response. (LIR-10)
6. The system SHALL NOT ask for reasons, health or disability information. (LIR-10)

**Independent Test**: Enviar `status: 'delivered'` no corpo: o registro nasce `registered` e a resposta só tem os quatro campos.

---

### P2: Proteção contra abuso

**User Story**: As the shopping, I want automated attempts limited so that the form is not flooded.

**Why P2**: O OpenAPI declara `429`; a feature funciona sem o limite.

**Acceptance Criteria**:

1. WHEN one origin exceeds 10 requests per minute on `POST /lost-reports` THEN the system SHALL return `429` with code `TOO_MANY_REQUESTS` and SHALL NOT process the request. (LIR-11)
2. The system SHALL count invalid requests toward the limit. (LIR-11)
3. WHEN the one-minute window ends THEN the system SHALL accept requests from that origin again. (LIR-11)

**Independent Test**: 11 `POST` seguidos do mesmo IP: o 11º devolve `429`.

---

## Edge Cases

- IF a visitor double-clicks the submit button and two identical requests arrive THEN the system SHALL create two registers (Q5) and SHALL NOT fail either; the staff merges duplicates (documented limitation).
- WHEN the active privacy notice changes between the form load and the submission THEN the system SHALL return `400 CONSENT_REQUIRED` and the form must reload `GET /privacy-notice`.
- IF a `Location` is deactivated after the form loaded and before the submission THEN the system SHALL return `400 VALIDATION_ERROR`.
- IF the JSON body is empty, an array or not valid JSON THEN the system SHALL return `400 VALIDATION_ERROR`.
- IF `lostDate` is `2026-02-30` or `2026-13-01` THEN the system SHALL return `400 VALIDATION_ERROR`.
- IF `lostDate` is today in `America/Araguaina` while it is already tomorrow in UTC THEN the system SHALL accept it (the date is compared in the local time zone).
- WHEN `description` has exactly 500 characters and `identificationDetail` exactly 300 THEN the system SHALL accept them; with 501 and 301 it SHALL reject.
- WHEN `email` is absent or `null` THEN the system SHALL store `visitorEmail` empty.
- IF two requests collide on the same generated protocol THEN the system SHALL give the second one another protocol and SHALL NOT return an error.
- IF `description` contains HTML such as `<script>` THEN the system SHALL store it as text and SHALL NOT echo it in any response.

---

## Test Scenarios

| # | Cenário | ACs |
| --- | --- | --- |
| T1 | Registro válido: `201`, quatro campos, `registered`, `trackingPath` | Reg 1 |
| T2 | Persistência: `Request`, `LostReport`, `Consent` e histórico com os valores enviados e padrões (`unknown`, `false`) | Reg 2, 3, 4 |
| T3 | Protocolo no formato, imprevisível, único; colisão força novo protocolo | Reg 5 |
| T4 | Dois registros idênticos geram dois protocolos | Reg 6 |
| T5 | Campos obrigatórios ausentes (um por vez) → `400`, nada gravado | Val 1 |
| T6 | Enum inválido de categoria e período | Val 2 |
| T7 | Telefone inválido (curto, longo, com máscara, letras) | Val 3 |
| T8 | E-mail inválido e acima de 255 | Val 4 |
| T9 | Limites exatos (120/500/300/500) aceitos e +1 rejeitado | Val 5 |
| T10 | Vazio/espaços em `name` e `description`; `trim` e caracteres de controle | Val 6, 15 |
| T11 | `photoUrl` com esquema inválido (`javascript:`, `ftp:`) e válido | Val 7 |
| T12 | `lostDate` inexistente, futura, hoje (local) e fuso (hoje local ≠ hoje UTC) | Val 8, 9, 10 |
| T13 | Local: nenhum, os dois, uuid inválido, inexistente, inativo, só `unknownLocation` | Val 11-14 |
| T14 | Campos desconhecidos e `status` enviado são ignorados | Val 16; Priv 3 |
| T15 | Sem consentimento, versão errada, sem aviso ativo; `Consent` gravado no sucesso | Cons 1, 2, 3 |
| T16 | Falha no meio da transação não deixa `Request` órfão (`500 INTERNAL_ERROR`) | Reg 7 |
| T17 | Resposta e logs sem dados pessoais (inclusive no `500`) | Priv 2, 4 |
| T18 | Rota funciona sem token; nenhuma pergunta de motivo/saúde no corpo aceito | Priv 1, 6 |
| T19 | `429` no 11º pedido; inválidos contam; janela reinicia | Abuse 1, 2, 3 |
| T20 | Telefone repetido de outro visitante não revela nada | Priv 5 |

---

## Dependencies on Other Features

| Feature | Situação | Uso |
| --- | --- | --- |
| `public-query-routes` | Concluída | `GET /locations` (local) e `GET /privacy-notice` (versão do consentimento) alimentam o formulário. |
| `reservations-and-availability` | Concluída | Padrões reutilizados: consentimento, protocolo, `AppError`, `rateLimit`, histórico, teste com PostgreSQL real. |
| `admin-authentication` e `authorization-casl` | Concluídas | Sem uso direto; a rota é pública. As rotas admin do mesmo módulo seguem protegidas. |
| Acompanhamento por protocolo (RF07) | Futura | Passa a ler o registro criado aqui; exibirá `possible_match` como `searching` e nunca a descrição. |
| Cancelamento (RF08) | Futura | Cancelará `registered/searching/...` antes da entrega, via `tracking`. |
| Fluxo administrativo (RF13-RF15, RF21, RF22) | Futuras | Mudam o status, ligam o item encontrado e entregam. |
| SAC (RF06) | Futura | Compartilha protocolo, consentimento e `Request`; não compartilha endpoint. `data_deletion` poderá apagar este registro (RF31). |
| Upload de foto | Futura (Q4) | Fornece as URLs usadas em `photoUrl`. |
| Anonimização (RF31) | Futura | Deve cobrir os textos livres deste registro (I6). |
| Notificações (RF32) | Futura | Possível e-mail de confirmação; fora desta feature. |

---

## Inconsistencies and Gaps Found

| # | O que foi encontrado | Impacto |
| --- | --- | --- |
| I1 | O pedido cita o status `closed_without_location`; OpenAPI, Prisma, DBML e `requirements.md` usam `closed_not_found` | A spec usa `closed_not_found`; nenhum status é criado nesta feature. Confirmar. |
| I2 | O pedido manda criar `apps/api/src/modules/lost-items/`; o repo e `docs/backend.md` têm `lost-reports` (com as rotas admin) | Q1. |
| I3 | O OpenAPI não põe `locationId`/`unknownLocation` em `required`, mas o texto da operação e RF05 exigem um dos dois | Q2: a regra é aplicada na validação, não no esquema. |
| I4 | Nenhuma fonte define limite para trás de `lostDate` nem como tratar `lostPeriod` do dia atual | Q3; `lostPeriod` não é validado contra a hora. |
| I5 | `POST /uploads/photos` (multipart, 5 MB) está no OpenAPI mas não há armazenamento nem dependência multipart; `photoUrl` aceita qualquer `uri` | Q4. Risco: URL externa arbitrária fica gravada e a equipe a abrirá; a restrição à origem própria depende do upload. |
| I6 | `docs/database.md` diz que os dados pessoais ficam em `requests`, mas `lost_reports.description`, `identification_detail` e `photo_url` são texto livre que pode conter nome, documento ou foto de pessoa, e o RF31 só cita `requests` | A anonimização deve tratar esses campos; registrar na feature de RF31. Não muda esta feature. |
| I7 | O OpenAPI não prevê `409` nem nenhum código para registro duplicado | Q5; nada é bloqueado. |
| I8 | `AGENTS.MD` manda ler `docs/conventions.md` e `docs/specs/`, que não existem | Não bloqueia; atualizar a documentação. |
| I9 | `TrackingView.publicStatus` lista `closed_not_found` e `cancelled` para o objeto perdido, mas o texto geral do OpenAPI diz que `possible_match` é exibido como `searching` | Não afeta esta feature; vale para RF07. |
| I10 | O texto da operação não diz o que fazer se `unknownLocation` for `false` e `locationId` estiver ausente | Coberto por Q2 (erro `400`). |
| I11 | `ErrorResponse.code` não tem código próprio para "local inválido" ou "data inválida" | Ambos usam `VALIDATION_ERROR`. |

---

## Decisions

Todas aceitas pelo usuário (`"aceito as recomendações, lembra do zod para validar os dados nas rotas"`): vale a coluna Recomendação.

| # | Decisão | Recomendação | Alternativas |
| --- | --- | --- | --- |
| Q1 | Pasta do módulo | `lost-reports` (já existe) | Criar `lost-items` e mover as rotas admin; ou criar `lost-items` só para esta rota |
| Q2 | `locationId` e `unknownLocation=true` juntos | `400` | Aceitar e ignorar `locationId`; aceitar e ignorar `unknownLocation` |
| Q3 | Limite de `lostDate` | Só não futura | Também máximo de 90 dias para trás (igual a `foundItemStorageDays`); máximo configurável |
| Q4 | Foto | Aceitar `photoUrl` (`http`/`https`), upload em outra feature | Incluir `POST /uploads/photos` aqui; aceitar só URL da própria API (depende do upload) |
| Q5 | Duplicidade | Permitir, só limite por IP | Bloquear registro idêntico do mesmo telefone em N minutos (exige código de erro novo); limite de registros abertos por telefone |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| LIR-01 | P1: Registrar objeto perdido (resposta) | Specify | Pending |
| LIR-02 | P1: Registrar objeto perdido (persistência e padrões) | Specify | Pending |
| LIR-03 | P1: Registrar objeto perdido (protocolo) | Specify | Pending |
| LIR-04 | P1: Validar os dados do formulário (campos e formatos) | Specify | Pending |
| LIR-05 | P1: Validar os dados do formulário (data) | Specify | Pending |
| LIR-06 | P1: Validar os dados do formulário (local) | Specify | Pending |
| LIR-07 | P1: Registrar objeto perdido (falha e atomicidade) | Specify | Pending |
| LIR-08 | P1: Proteger dados pessoais e o status (status e campos extras) | Specify | Pending |
| LIR-09 | P1: Exigir consentimento | Specify | Pending |
| LIR-10 | P1: Proteger dados pessoais e o status (privacidade e logs) | Specify | Pending |
| LIR-11 | P2: Proteção contra abuso | Specify | Pending |

**ID format:** `LIR-NN`. **Coverage:** 11 total, 0 mapped to tasks (Tasks phase not started), 11 unmapped ⚠️.

---

## Sources

- `capim-dourado-servicos/docs/openapi-servicos-capim-dourado.yaml` - `POST /lost-reports` (`createLostReport`), `POST /uploads/photos`; schemas `CreateLostReport`, `ProtocolCreated`, `Consent`, `Phone`, `ObjectCategory`, `DayPeriod`, `ErrorResponse`, `TrackingView`, `LostReportData`; responses `BadRequest`, `TooManyRequests`; tabela de status por tipo.
- `capim-dourado-servicos/docs/requirements.md` - RF05, RF07, RF08, RF10, RF14, RF15, RF21, RF22, RF31, regras transversais, estados por tipo.
- `capim-dourado-servicos/docs/{api,backend,database,architecture,authorization,project-overview}.md` e `docs/capim-dourado.dbml` - endpoints, estrutura modular, protocolo, persistência, privacidade.
- `capim-dourado-servicos/AGENTS.MD` - regras obrigatórias (privacidade, protocolo, `America/Araguaina`, não inventar).
- `apps/api/prisma/schema.prisma` - `Request`, `LostReport`, `Consent`, `RequestHistory`, `PrivacyNotice`, `Location`, enums.
- `apps/api/src/modules/{lost-reports,reservations,privacy,tracking}/*`, `http/{routes.ts,middlewares/rate-limit.ts}`, `utils/protocol.ts` - estado atual e padrões reutilizáveis.
- `.specs/STATE.md` (AD-002) e `.specs/features/{reservations-and-availability,public-query-routes,admin-authentication}` - convenções e decisões já aprovadas.

---

## Success Criteria

- [ ] Um formulário válido gera `201` com protocolo `CAP-XXXX-XXXX`, status `registered`, e os quatro registros ligados no banco.
- [ ] Cada regra de validação (obrigatório, formato, limite, data, local, consentimento) tem um caso que responde `400` e deixa o banco intacto.
- [ ] Nenhum campo pessoal ou texto livre aparece em respostas ou logs.
- [ ] O visitante não consegue definir o status.
- [ ] O 11º pedido do mesmo IP em um minuto recebe `429`.
