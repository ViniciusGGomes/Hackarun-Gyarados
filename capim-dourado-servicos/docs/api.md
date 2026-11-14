# Contrato da API

## Fonte contratual

O arquivo [`openapi-servicos-capim-dourado.yaml`](./openapi-servicos-capim-dourado.yaml) é o contrato de referência da API REST. Está descrito em OpenAPI 3.0.3.

- Base path: `/api/v1`.
- Desenvolvimento: `http://localhost:3333/api/v1`.
- Produção: URL de exemplo no OpenAPI deve ser substituída pela URL real.
- Formato: JSON, exceto upload multipart.
- Datas: ISO 8601; transporte em UTC.
- Timezone operacional do shopping: `America/Araguaina`.

## Segurança

- Rotas públicas não exigem autenticação.
- Rotas administrativas exigem `Authorization: Bearer <JWT>`.
- Perfis: `attendant` e `manager`.
- Operações exclusivas do Gestor devem responder 403 para Atendente.
- Login/logout/me ficam em `/auth/*`.

## Convenções

- Protocolo imprevisível `CAP-XXXX-XXXX`.
- Acompanhamento público exige protocolo e telefone.
- Todo formulário público exige `consent.accepted = true` e a versão vigente do aviso.
- A API não retorna descrição de itens encontrados ao público.
- Paginação: `page` começa em 1; `pageSize` máximo 100.
- Respostas paginadas usam `{ data, meta }` quando especificado.
- Erros usam `ErrorResponse` com código estável.

## Endpoints

### Públicos

| Método | Caminho | Operação / requisito |
|---|---|---|
| GET | `/privacy-notice` | Aviso de privacidade vigente (RF10) |
| GET | `/services` | Listar serviços ativos (RF01) |
| GET | `/services/{slug}` | Detalhes do serviço (RF02) |
| GET | `/locations` | Locais ativos (RF26) |
| POST | `/uploads/photos` | Upload de foto opcional (RF05) |
| GET | `/equipment/{type}/availability` | Disponibilidade por equipamento/data (RF03) |
| POST | `/reservations` | Criar reserva (RF04) |
| POST | `/lost-reports` | Registrar objeto perdido (RF05) |
| POST | `/sac-messages` | Enviar mensagem ao SAC (RF06) |
| POST | `/tracking/lookup` | Consultar acompanhamento (RF07) |
| POST | `/tracking/{protocol}/cancel` | Cancelar solicitação (RF08) |
| POST | `/tracking/{protocol}/messages` | Visitante envia mensagem (RF09) |

### Autenticação

| Método | Caminho | Operação |
|---|---|---|
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Usuário autenticado |

### Administração

| Método | Caminho | Operação / requisito |
|---|---|---|
| GET | `/admin/requests` | Listar/filtrar solicitações (RF13) |
| GET | `/admin/requests/{id}` | Detalhe da solicitação (RF14) |
| PATCH | `/admin/requests/{id}/status` | Atualizar estado (RF15) |
| POST | `/admin/requests/{id}/messages` | Mensagem da equipe (RF16) |
| GET | `/admin/agenda` | Agenda de equipamentos (RF17) |
| POST | `/admin/reservations/{id}/pickup` | Registrar retirada (RF18) |
| POST | `/admin/reservations/{id}/return` | Registrar devolução (RF18) |
| GET | `/admin/found-items` | Listar itens encontrados (RF20) |
| POST | `/admin/found-items` | Cadastrar item encontrado (RF20) |
| GET | `/admin/found-items/{id}` | Detalhe do item encontrado |
| POST | `/admin/found-items/{id}/close` | Encerrar item (RF23) |
| GET | `/admin/lost-reports/{id}/suggestions` | Sugestões de correspondência (RF21) |
| POST | `/admin/lost-reports/{id}/match` | Confirmar correspondência |
| POST | `/admin/lost-reports/{id}/deliver` | Registrar entrega (RF22) |
| GET | `/admin/equipment` | Listar equipamentos |
| POST | `/admin/equipment` | Cadastrar equipamento (RF24) |
| PATCH | `/admin/equipment/{id}` | Atualizar equipamento (RF24) |
| GET | `/admin/settings/reservations` | Consultar configurações (RF25) |
| PUT | `/admin/settings/reservations` | Atualizar configurações (RF25) |
| GET | `/admin/locations` | Listar locais |
| POST | `/admin/locations` | Cadastrar local (RF26) |
| PATCH | `/admin/locations/{id}` | Atualizar local (RF26) |
| GET | `/admin/users` | Listar usuários (RF27) |
| POST | `/admin/users` | Criar usuário (RF27) |
| PATCH | `/admin/users/{id}` | Atualizar usuário (RF27) |
| GET | `/admin/indicators/equipment` | Indicadores de equipamentos (RF28) |
| GET | `/admin/indicators/lost-and-found` | Indicadores de achados e perdidos (RF29) |
| GET | `/admin/indicators/service` | Indicadores de atendimento (RF30) |

## Processos sem endpoint

Executados como tarefas agendadas no backend:

- RF19: marcar `no_show` após tolerância.
- RF31: anonimizar dados após prazo de retenção.
- RF32: enviar e-mails de notificação.
- RF21: cálculo de sugestões é consultado por endpoint; não é descrito como job independente no contrato.

## Estados e transições

### Reserva

- `reserved` → `picked_up` por endpoint de retirada.
- `picked_up` → `returned` por endpoint de devolução.
- `reserved` → `cancelled`.
- `no_show` após job RF19.
- Estados finais, conforme descrição geral OpenAPI, só são reabertos pelo Gestor.

### Objeto perdido

Fluxo principal: `registered` → `searching` → `possible_match` → `ready_for_pickup` → `delivered`.
Também pode terminar em `closed_not_found` ou `cancelled`.
Para o visitante, `possible_match` deve ser exibido como `searching`, para não revelar a correspondência antes da validação.

### SAC

`open` → `in_progress` → `answered` → `closed`.

## Upload de fotos

O contrato descreve `POST /uploads/photos` com `multipart/form-data`, arquivo de até 5 MB e formatos JPEG, PNG ou WebP. A resposta fornece uma URL para uso no registro de objeto perdido.

## Implementação

- Não inventar endpoints ou formatos de payload: consultar o YAML completo.
- Ao mudar o contrato, atualizar OpenAPI e testes de contrato.
- Os nomes e detalhes resumidos aqui não substituem os schemas completos do arquivo OpenAPI.
"""