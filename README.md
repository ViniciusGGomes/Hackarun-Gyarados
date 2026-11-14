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

## Como rodar o projeto

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- [pnpm](https://pnpm.io/) 9 (`npm install -g pnpm@9`)
- [Docker](https://www.docker.com/) e Docker Compose (para o PostgreSQL)

### 1. Instalar as dependências

Na raiz do projeto:

```bash
pnpm install
```

### 2. Configurar as variáveis de ambiente

Copie o arquivo de exemplo para `.env` na raiz do projeto:

```bash
cp .env.example .env
```

| Variável | Descrição | Exemplo |
|---|---|---|
| `SERVER_PORT` | Porta da API | `3333` |
| `DATABASE_URL` | Conexão com o PostgreSQL | `postgresql://postgres:docker@localhost:5433/hackathon` |
| `JWT_SECRET` | Segredo usado para assinar os tokens JWT | qualquer string segura |
| `NEXT_PUBLIC_API_URL` | URL da API usada pelo frontend | `http://localhost:3333` |

O frontend (Next.js) lê o `.env` da própria pasta. Para ele, copie o mesmo arquivo:

```bash
cp .env apps/web/.env.local
```

### 3. Subir o banco de dados

```bash
docker compose up -d
```

O PostgreSQL fica disponível em `localhost:5433` (usuário `postgres`, senha `docker`, banco `hackathon`).

### 4. Rodar o backend (API)

```bash
cd apps/api

# Cria as tabelas no banco
pnpm db:migrate

# (Opcional) Popula o banco com dados de exemplo
pnpm prisma db seed

# Inicia a API em modo de desenvolvimento
pnpm dev
```

- API: http://localhost:3333
- Documentação Swagger: http://localhost:3333/docs
- Testes: `pnpm test`
- Visualizar o banco: `pnpm db:studio`

### 5. Rodar o frontend

Em outro terminal, com a API em execução:

```bash
cd apps/web
pnpm dev
```

- Aplicação: http://localhost:3000

### Rodar tudo de uma vez

Na raiz do projeto, o Turborepo inicia backend e frontend juntos:

```bash
pnpm dev
```

## Documentação

A documentação técnica inicial apresenta o planejamento do projeto, incluindo a definição do problema, proposta da solução, estrutura inicial das telas, arquitetura, tecnologias, infraestrutura e organização da equipe.

📄 **[Acessar o Planejamento Técnico Inicial](https://docs.google.com/document/d/1FftF9Ybjzb5fKMiLHq7U5n_dYZjmE4DK0Qwt5WAsZzY/edit?usp=sharing)**

## Equipe — Gyarados

Projeto desenvolvido por uma equipe de quatro integrantes durante o Hackarun.

---

<p align="center">
  Desenvolvido com dedicação pela equipe <strong>Gyarados</strong> durante o Hackarun.
  <br />
  <strong>Integrantes:</strong> Vinicius, Igor, Bruna e Estefany.
</p>
