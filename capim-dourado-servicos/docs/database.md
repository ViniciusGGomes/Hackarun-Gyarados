# Banco de dados

## Tecnologia e artefatos

- Banco relacional: PostgreSQL.
- ORM: Prisma.
- Modelo visual: [schema.prisma](../../apps/api/prisma/schema.prisma)
- Schema ORM: [capim-dourado.dbml](./capim-dourado.dbml)

O schema Prisma é a definição usada pelo cliente Prisma e pelas migrations. O DBML documenta visualmente as entidades e relacionamentos. Ao mudar o modelo, manter os dois consistentes.

## Convenções gerais

- IDs UUID, com exceções para tabelas singleton/horários e sequência de itens encontrados.
- Datas operacionais armazenadas como `timestamptz` (UTC).
- O shopping opera em `America/Araguaina`.
- Toda solicitação pública tem um registro central em `requests` e um registro específico em `reservations`, `lost_reports` ou `sac_messages`.
- Dados pessoais do visitante ficam centralizados em `requests` para facilitar anonimização.
- Protocolo é único, imprevisível e segue `CAP-XXXX-XXXX`.

## Entidades

| Model Prisma / tabela | Responsabilidade |
|---|---|
| `User` / `users` | Usuários administrativos, perfil, hash de senha, estado ativo e controle de tentativas. |
| `Location` / `locations` | Locais do shopping usados em formulários e operações. |
| `Service` / `services` | Catálogo público de serviços e seus fluxos. |
| `OpeningHour` / `opening_hours` | Expediente por dia da semana. |
| `ReservationSettings` / `reservation_settings` | Configurações singleton de reservas e retenção. |
| `Equipment` / `equipment` | Equipamentos, quantidades, local de retirada e estado ativo. |
| `PrivacyNotice` / `privacy_notices` | Versões do aviso de privacidade. |
| `Request` / `requests` | Núcleo comum das solicitações e dados pessoais do visitante. |
| `Consent` / `consents` | Registro de consentimento e versão do aviso. |
| `Reservation` / `reservations` | Dados específicos de reserva. |
| `UnmetDemand` / `unmet_demands` | Consultas sem disponibilidade. |
| `LostReport` / `lost_reports` | Registro de objeto perdido. |
| `FoundItem` / `found_items` | Item encontrado sob custódia da equipe. |
| `SacMessage` / `sac_messages` | Dados específicos de mensagem SAC. |
| `RequestMessage` / `request_messages` | Mensagens entre visitante e equipe. |
| `RequestHistory` / `request_history` | Histórico de estados e ator responsável. |
| `NotificationLog` / `notification_logs` | Tentativas de notificação por e-mail. |
| `JobLog` / `job_logs` | Execuções de tarefas agendadas. |

## Enums principais

- `UserRole`: `attendant`, `manager`.
- `LocationType`: `entrance`, `food_court`, `parking`, `store_area`, `service`, `other`.
- `ServiceKind`: `interactive`, `informational`.
- `ServiceFlow`: `equipment_reservation`, `lost_report`, `sac_message`, `none`.
- `EquipmentType`: `wheelchair`, `stroller`.
- `RequestType`: `reservation`, `lost_report`, `sac_message`.
- `RequestStatus`: `reserved`, `picked_up`, `returned`, `no_show`, `registered`, `searching`, `possible_match`, `ready_for_pickup`, `delivered`, `closed_not_found`, `open`, `in_progress`, `answered`, `closed`, `cancelled`.
- `FoundItemStatus`: `stored`, `delivered`, `discarded`, `forwarded`.
- `MessageAuthor`: `staff`, `visitor`.
- `ActorType`: `staff`, `visitor`, `system`.
- `NotificationEvent`: `reservation_confirmed`, `status_changed`, `new_message`.
- `NotificationStatus`: `pending`, `sent`, `failed`.
- `JobStatus`: `success`, `failed`.

Também existem enums específicos para destinatário/tamanho de cadeira, tipo de carrinho, categoria do objeto, período do dia e assunto do SAC.

## Relacionamentos conceituais

- `Request` possui no máximo um registro específico de `Reservation`, `LostReport` ou `SacMessage`.
- `Request` possui consentimentos, mensagens, histórico e notificações.
- `Reservation` referencia equipamento por tipo e pode referenciar local atual.
- `LostReport` pode relacionar-se a um `FoundItem` correspondente.
- `FoundItem` registra local encontrado e usuários que cadastraram/encerraram.
- `Service` pode referenciar local de retirada e relacionar mensagens SAC.
- `Location` é reutilizado em serviços, equipamentos, reservas, objetos perdidos e itens encontrados.

## Regras que exigem migration SQL ou lógica transacional

O DBML documenta explicitamente regras que não são expressas apenas pelo schema Prisma:

1. `reservation_settings.id = 1`, com `CHECK`, para garantir singleton.
2. No máximo um aviso de privacidade ativo: índice único parcial em `privacy_notices(active) WHERE active`.
3. Reserva concorrente: validar disponibilidade dentro de transação; usar isolamento `SERIALIZABLE` ou `pg_advisory_xact_lock` por tipo de equipamento, conforme decisão de implementação.
4. Garantir que as constraints e índices efetivos acompanhem as migrations.

## Regras de persistência

- Não armazenar senha em texto puro.
- Não excluir fisicamente usuários/equipamentos/locais quando o requisito pede inativação.
- Dados pessoais de visitantes ficam em `requests`; job RF31 anonimiza esses campos conforme retenção.
- O detalhe de identificação do objeto perdido é interno.
- A descrição do item encontrado nunca deve ser retornada em contratos públicos.
- Estados precisam ser validados conforme o tipo de solicitação; o enum global permite valores de mais de um fluxo, então a API deve impedir combinações inválidas.

## Parâmetros de configuração registrados no modelo

- `slotMinutes`: 30.
- `loanDurationMinutes`: 120.
- `pickupToleranceMinutes`: 15.
- `maxAdvanceDays`: 7.
- `maxActiveReservationsPerPhone`: 1.
- `requireDocumentOnPickup`: false.
- `foundItemStorageDays`: 90 (valor assumido, confirmar).
- `personalDataRetentionDays`: 180 (valor assumido, confirmar).

## Cuidados ao alterar o modelo

1. Identificar requisitos afetados.
2. Atualizar schema Prisma.
3. Gerar migration e revisar SQL, incluindo índices parciais/checks que Prisma não represente.
4. Atualizar DBML.
5. Atualizar DTOs, repositórios e OpenAPI.
6. Atualizar testes e dados seed.
"""
