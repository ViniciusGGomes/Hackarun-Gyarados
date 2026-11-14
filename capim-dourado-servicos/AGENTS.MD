# Instruções para agentes — Capim Dourado Serviços

## Objetivo

Você está trabalhando no **Capim Dourado Serviços**, uma aplicação web para centralizar serviços oferecidos pelo Capim Dourado Shopping. Leia os documentos em `docs/` antes de implementar funcionalidades.

## Ordem de leitura

1. `docs/project-overview.md`
2. `docs/requirements.md`
3. `docs/architecture.md`
4. `docs/database.md`
5. `docs/api.md`
6. `docs/backend.md` ou `docs/frontend.md`, conforme a tarefa
7. `docs/authorization.md` para qualquer mudança relacionada a login, permissões ou rotas protegidas
8. `docs/conventions.md`
9. A especificação correspondente em `docs/specs/`

## Regras obrigatórias

- Não invente requisitos, campos, endpoints, estados, permissões ou regras de negócio.
- Em caso de conflito, registre a divergência e peça decisão; não escolha silenciosamente.
- Requisitos funcionais e regras de negócio são descritos em `docs/requirements.md`.
- O contrato HTTP é descrito por `openapi-servicos-capim-dourado.yaml` (fonte contratual da API). Não altere o contrato por conveniência sem atualizar a especificação e justificar a mudança.
- O schema Prisma representa o modelo de persistência implementado; o DBML é a representação visual/documental do modelo. Ao alterar o banco, mantenha ambos sincronizados e gere migration Prisma.
- Não crie uma segunda implementação de entidades, enums ou contratos compartilhados quando já houver definição em `packages/shared` ou `packages/auth`.
- Preserve a arquitetura de monólito modular. Não introduza microsserviços, filas ou infraestrutura externa sem requisito explícito.
- Não exponha informações pessoais do visitante em endpoints públicos. O acompanhamento exige protocolo e telefone; retorne apenas informações públicas.
- Nunca exponha ao visitante a descrição de itens encontrados. A descrição de item encontrado é dado interno para validação da correspondência.
- Não solicite motivo, deficiência ou condição de saúde ao reservar equipamento.
- Não persista senha em texto puro. Use hash seguro.
- Não coloque segredos reais em código, documentação, commits ou exemplos. Use variáveis de ambiente e placeholders.
- Não faça operações de reserva sem revalidar disponibilidade em transação, protegendo contra concorrência.
- Use `America/Araguaina` para regras de horário local do shopping. Datas trafegadas pela API seguem ISO 8601/UTC conforme OpenAPI.
- Respeite a divisão Atendente/Gestor definida nos requisitos e em `docs/authorization.md`.
- Não marque uma tarefa como concluída sem executar as verificações aplicáveis (lint, typecheck, testes e build, quando disponíveis).

## Processo Spec-Driven Development

Para cada funcionalidade:

1. Localize o RF correspondente e leia sua regra de negócio completa.
2. Crie ou atualize uma especificação em `docs/specs/` antes de implementar.
3. A especificação deve conter: contexto, objetivo, atores, escopo, requisitos, regras, fluxo principal, exceções, permissões, endpoints, dados envolvidos, critérios de aceite e testes.
4. Identifique dependências e arquivos afetados.
5. Implemente em etapas pequenas, mantendo backend, frontend, banco e OpenAPI consistentes.
6. Escreva/atualize testes para regras e fluxos relevantes.
7. Atualize a documentação quando uma decisão aprovada alterar o comportamento.

## Organização do repositório

O projeto é um monorepo PNPM + Turborepo. A estrutura atual observada contém `apps/`, `config/` e `packages/`; `packages/auth` já existe e contém código de autorização. Não presuma que todos os diretórios planejados já foram criados. Antes de criar ou mover arquivos, inspecione a estrutura real.

## Comandos

Os scripts raiz informados são:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm check-types`

Use os scripts existentes nos respectivos `package.json`. Não invente scripts de workspace que ainda não existam.
"""
