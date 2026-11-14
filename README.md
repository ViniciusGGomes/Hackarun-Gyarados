# Hackarun-Gyarados

**Plataforma inteligente de orientação e atendimento para visitantes do Capim Dourado Shopping, desenvolvida durante o Hackarun.**

<p align="center">
  <strong>Central de Orientação e Atendimento Inteligente</strong>
</p>

## Sobre o projeto

O **Hackarun-Gyarados** é um projeto desenvolvido com o objetivo de melhorar a experiência dos visitantes do Capim Dourado Shopping, em Palmas – TO, por meio de uma plataforma digital que centraliza informações, facilita a localização de lojas e serviços e simplifica o acesso aos canais de atendimento.

A proposta consiste em desenvolver uma central inteligente de orientação e atendimento, permitindo que os visitantes encontrem informações e registrem solicitações de maneira simples e acessível.

Por meio de uma aplicação web responsiva e QR Codes distribuídos em pontos estratégicos do shopping, o visitante poderá acessar a plataforma, consultar serviços, obter orientações e encaminhar solicitações ao responsável adequado.

A solução também prevê o uso de inteligência artificial para auxiliar na interpretação e classificação das solicitações, contribuindo para um encaminhamento mais adequado e uma experiência de atendimento mais eficiente.

## Objetivos

- Centralizar informações sobre lojas, serviços e facilidades do shopping.
- Facilitar a localização de estabelecimentos e pontos de interesse.
- Simplificar o registro de solicitações e ocorrências.
- Direcionar as solicitações aos responsáveis correspondentes.
- Permitir o acompanhamento do andamento das solicitações.
- Melhorar a experiência dos visitantes e apoiar a gestão do atendimento.

## Proposta da solução

A plataforma será organizada em duas áreas principais:

- **Central do visitante:** permite consultar lojas e serviços, buscar informações, registrar solicitações e acompanhar atendimentos.
- **Painel administrativo:** permite visualizar e gerenciar solicitações, atualizar seus status e administrar informações relacionadas aos serviços e responsáveis.

## Tecnologias e arquitetura

O projeto será desenvolvido utilizando um monorepositório (monorepo), mantendo as aplicações frontend e backend organizadas em um único repositório.

| Tecnologia | Aplicação |
|---|---|
| TypeScript | Linguagem principal do projeto |
| Next.js | Desenvolvimento do frontend |
| Node.js | Ambiente de execução do backend |
| Fastify | Desenvolvimento da API REST |
| PostgreSQL | Banco de dados relacional |
| Prisma ORM | Acesso e gerenciamento dos dados |
| Docker | Containerização e padronização do ambiente |
| JWT | Autenticação e controle de acesso |

O backend seguirá uma arquitetura monolítica modular, com organização em camadas e separação de responsabilidades baseada no padrão MVC, adaptado ao contexto de uma API REST.

## Tecnologia sorteada

A tecnologia sorteada foi **Node.js / FastAPI**. Após avaliação da equipe, foi escolhido o **Node.js**, que será utilizado no desenvolvimento do backend, em conjunto com TypeScript e Fastify.

Essa escolha permite utilizar uma linguagem compartilhada entre frontend e backend, além de facilitar a integração entre os componentes da aplicação.

## Documentação

A documentação técnica inicial apresenta o planejamento do projeto, incluindo a definição do problema, proposta da solução, estrutura inicial das telas, arquitetura, tecnologias, infraestrutura e organização da equipe.

📄 **[Acessar o Planejamento Técnico Inicial](https://docs.google.com/document/d/1FftF9Ybjzb5fKMiLHq7U5n_dYZjmE4DK0Qwt5WAsZzY/edit?usp=sharing)**

## Como rodar o backend

O backend fica em `apps/api` (Fastify + TypeScript + Prisma + PostgreSQL). Todos os comandos abaixo partem da raiz do repositório, exceto onde indicado.

### Pré-requisitos

- [Node.js](https://nodejs.org) 18 ou superior (testado com o Node 22).
- [pnpm](https://pnpm.io) 9 (`npm install -g pnpm@9`).
- [Docker](https://www.docker.com) com o Docker Desktop aberto, para o PostgreSQL.

### 1. Instalar as dependências

```bash
pnpm install
```

### 2. Criar o arquivo `.env`

Copie o modelo e preencha os valores. O arquivo `.env` fica na **raiz** do repositório e não é versionado.

```bash
cp .env.example .env
```

```env
SERVER_PORT=3333
DATABASE_URL="postgresql://postgres:docker@localhost:5433/hackathon?schema=public"
JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
NEXT_PUBLIC_API_URL=http://localhost:3333
```

A `DATABASE_URL` acima usa as credenciais de desenvolvimento do `docker-compose.yml` (porta `5433`). Use um `JWT_SECRET` próprio e nunca publique o `.env`.

### 3. Subir o banco de dados

```bash
docker compose up -d
```

Isso inicia o container `hackathon-postgres` (PostgreSQL na porta `5433`). Se o Docker for fechado ou reiniciado, o container pode parar: rode `docker start hackathon-postgres` para religá-lo.

### 4. Criar as tabelas e os dados de exemplo

```bash
cd apps/api
pnpm env:load prisma migrate deploy    # aplica as migrations
pnpm env:load prisma generate          # gera o cliente do Prisma
pnpm env:load prisma db seed           # dados fictícios de desenvolvimento
```

O seed cria usuários, serviços, locais, equipamentos, reservas e solicitações de exemplo. Rodar o seed de novo é seguro, mas **apaga e recria** as solicitações; não rode em produção.

| Perfil | E-mail | Senha |
|---|---|---|
| Gestor | `gestor@exemplo.com` | `Senha@123` |
| Atendente | `paulo@exemplo.com` | `Senha@123` |
| Atendente | `camila@exemplo.com` | `Senha@123` |

A senha pode ser trocada com a variável `SEED_PASSWORD` ao rodar o seed.

### 5. Rodar a API

Ainda em `apps/api`:

```bash
pnpm run dev
```

Quando aparecer `HTTP server is running`, a API está em `http://localhost:3333/api/v1`.

- Documentação Swagger: `http://localhost:3333/docs`
- Teste rápido: `GET http://localhost:3333/api/v1/privacy-notice` deve responder `200`.
- O job de não comparecimento (RF19) inicia junto com o servidor e roda a cada minuto.

### 6. Testar as rotas

Importe a coleção do Postman em `capim-dourado-servicos/docs/postman/capim-dourado-servicos.postman_collection.json`. Rode primeiro "Aviso de privacidade" e "Listar locais"; para as rotas de admin, faça o login antes.

### 7. Testes automatizados e verificação de tipos

Os testes de integração usam um banco separado (`hackathon_test`), criado e migrado automaticamente. O container do PostgreSQL precisa estar ativo.

```bash
cd apps/api
pnpm test               # todos os testes
pnpm run check-types    # verificação de tipos
```

### Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `EADDRINUSE ... 3333` ao rodar `pnpm run dev` | Outro processo (um `pnpm run dev` antigo) ocupa a porta | Feche o outro terminal ou rode `Get-NetTCPConnection -LocalPort 3333 -State Listen` no PowerShell e encerre o processo |
| `500 INTERNAL_ERROR` em todas as rotas | O banco não está acessível (`Can't reach database server at localhost:5433`) | `docker start hackathon-postgres` e confira com `docker ps` |
| `EPERM` ao rodar `prisma generate` | A API está rodando e segura o arquivo do motor do Prisma | Pare o `pnpm run dev`, rode o comando e suba a API de novo |
| Erros de tabela inexistente ou coluna ausente | Migrations pendentes | `pnpm env:load prisma migrate deploy` em `apps/api` |

## Equipe — Gyarados

Projeto desenvolvido por uma equipe de quatro integrantes durante o Hackarun.

---

<p align="center">
  Desenvolvido com dedicação pela equipe <strong>Gyarados</strong> durante o Hackarun.
  <br />
  <strong>Integrantes:</strong> Vinicius, Igor, Bruna e Estefany.
</p>
