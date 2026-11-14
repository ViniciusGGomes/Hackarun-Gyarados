# Hackarun Gyarados

**Central inteligente de orientação e atendimento do Capim Dourado Shopping**

Uma plataforma digital desenvolvida durante o Hackarun com o objetivo de tornar a experiência dos visitantes do Capim Dourado Shopping, em Palmas – TO, mais simples, prática e eficiente.

<p align="center">
  <strong>Encontre informações, acesse serviços e resolva suas solicitações em um só lugar.</strong>
</p>

## Demonstração

Confira a apresentação da solução:

https://github.com/user-attachments/assets/b7cbe1cb-14da-4922-99ca-da9a4b132b01

---

## O problema

A experiência de um visitante em um shopping vai além de encontrar lojas e realizar compras. Muitas vezes, ele precisa localizar serviços, encontrar informações, solicitar algum tipo de assistência ou entrar em contato com os setores responsáveis.

Quando essas informações e canais de atendimento estão distribuídos em diferentes lugares, o visitante pode enfrentar dificuldades para encontrar o que precisa, identificar o canal correto e acompanhar suas solicitações.

Essa fragmentação pode gerar uma experiência pouco prática, aumentar o tempo necessário para resolver problemas e dificultar a comunicação entre visitantes e shopping.

## Nossa solução

O **Hackarun Gyarados** propõe uma central digital que reúne informações, serviços e canais de atendimento do Capim Dourado Shopping em uma única plataforma.

Por meio de uma aplicação web responsiva, acessível também por QR Codes distribuídos em pontos estratégicos do shopping, o visitante poderá acessar os serviços de forma rápida, sem precisar instalar um aplicativo.

A plataforma busca simplificar a jornada do visitante, desde a busca por informações até a resolução de uma solicitação, oferecendo mais autonomia, praticidade e transparência durante o atendimento.

A solução também prevê o uso de inteligência artificial para auxiliar na interpretação e classificação das solicitações, contribuindo para um encaminhamento mais adequado aos responsáveis.

## Principais funcionalidades

### Para os visitantes

- **Centralização de informações:** acesso facilitado às informações sobre lojas, serviços e facilidades do shopping.
- **Orientação:** consulta e localização de estabelecimentos e pontos de interesse.
- **Reserva de equipamentos:** consulta de disponibilidade e solicitação de equipamentos, como cadeiras de rodas e carrinhos de bebê.
- **Achados e perdidos:** registro de objetos perdidos e acompanhamento das solicitações.
- **Atendimento ao cliente (SAC):** registro de dúvidas, reclamações, sugestões e outras solicitações.
- **Acompanhamento por protocolo:** consulta do andamento das solicitações sem necessidade de criar uma conta.
- **Acesso por QR Code:** entrada rápida na plataforma por meio de códigos distribuídos pelo shopping.

### Para os atendentes e gestores

- **Gestão de solicitações:** visualização, organização e atualização dos atendimentos.
- **Controle de equipamentos:** gerenciamento de reservas, retiradas e devoluções.
- **Gestão de achados e perdidos:** cadastro de itens encontrados, identificação de possíveis correspondências e registro de entregas.
- **Painel administrativo:** gerenciamento dos serviços, equipamentos, locais e usuários.
- **Indicadores:** acompanhamento de informações relacionadas aos atendimentos e à operação.

## Experiência do visitante

A proposta é tornar o acesso aos serviços do shopping mais intuitivo e reduzir etapas desnecessárias durante o atendimento.

O fluxo esperado é simples:

1. O visitante acessa a plataforma pelo celular ou por um QR Code.
2. Encontra o serviço ou a informação de que precisa.
3. Registra uma solicitação, quando necessário.
4. Recebe um protocolo para acompanhar o atendimento.
5. Consulta as atualizações até a conclusão da solicitação.

Dessa forma, o visitante ganha mais autonomia para resolver suas necessidades, enquanto o shopping passa a contar com um canal centralizado para organizar e acompanhar os atendimentos.

## Arquitetura e tecnologias

O projeto utiliza uma arquitetura de monorepositório (monorepo), mantendo frontend, backend e pacotes compartilhados organizados em um único repositório.

| Tecnologia | Aplicação |
|---|---|
| TypeScript | Linguagem principal |
| Next.js | Desenvolvimento do frontend |
| Node.js | Ambiente de execução do backend |
| Fastify | Construção da API REST |
| PostgreSQL | Banco de dados relacional |
| Prisma ORM | Acesso e gerenciamento dos dados |
| Docker | Containerização do ambiente |
| JWT | Autenticação |
| CASL | Controle de permissões e autorização |
| Zod | Validação de dados |
| pnpm Workspaces | Gerenciamento do monorepo |
| Turborepo | Orquestração de tarefas |

### Organização do projeto

```text
capim-dourado-servicos/
├── apps/
│   ├── api/          # Backend - Fastify
│   └── web/          # Frontend - Next.js
├── packages/
│   ├── auth/         # Autenticação e permissões compartilhadas
│   └── shared/       # Tipos, schemas e contratos compartilhados
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

O backend segue uma arquitetura monolítica modular, com separação de responsabilidades e organização por domínios, facilitando a manutenção e evolução da aplicação.

## Tecnologia sorteada

A tecnologia sorteada para o desafio foi **Node.js / FastAPI**.

Após avaliação da equipe, optamos pelo **Node.js**, utilizando TypeScript e Fastify no desenvolvimento do backend.

Essa escolha permite compartilhar a linguagem entre frontend e backend, além de aproveitar o conhecimento técnico da equipe e facilitar a integração entre as aplicações.

---

## Como executar o projeto

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- [pnpm](https://pnpm.io/) 9
- [Docker](https://www.docker.com/) e Docker Compose

### 1. Clonar o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd capim-dourado-servicos
```

### 2. Instalar as dependências

Na raiz do projeto:

```bash
pnpm install
```

### 3. Configurar as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Configure as variáveis necessárias:

| Variável | Descrição | Exemplo |
|---|---|---|
| `SERVER_PORT` | Porta da API | `3333` |
| `DATABASE_URL` | Conexão com PostgreSQL | `postgresql://postgres:docker@localhost:5433/hackathon` |
| `JWT_SECRET` | Segredo para assinatura dos tokens | Uma string segura |
| `NEXT_PUBLIC_API_URL` | URL pública da API para o frontend | `http://localhost:3333` |

Para o frontend, copie o arquivo de ambiente:

```bash
cp .env apps/web/.env.local
```

> Confira os arquivos `.env.example` de cada aplicação para identificar outras variáveis obrigatórias.

### 4. Iniciar o banco de dados

```bash
docker compose up -d
```

O PostgreSQL ficará disponível em `localhost:5433`, conforme a configuração padrão do projeto.

### 5. Executar o backend

```bash
cd apps/api

# Executar as migrations
pnpm db:migrate

# Popular o banco com dados de exemplo
pnpm prisma db seed

# Iniciar a API
pnpm dev
```

A API ficará disponível em:

- API: http://localhost:3333
- Swagger: http://localhost:3333/docs

### 6. Executar o frontend

Em outro terminal:

```bash
cd apps/web
pnpm dev
```

A aplicação ficará disponível em:

http://localhost:3000

### Executar tudo pela raiz

Também é possível iniciar as aplicações utilizando o Turborepo:

```bash
pnpm dev
```

---

## Documentação

O planejamento técnico reúne as informações sobre o problema, a proposta da solução, os requisitos, as funcionalidades e as decisões técnicas do projeto.

📄 **[Acessar o Planejamento Técnico Inicial](https://docs.google.com/document/d/1FftF9Ybjzb5fKMiLHq7U5n_dYZjmE4DK0Qwt5WAsZzY/edit?usp=sharing)**

---

## Equipe Gyarados

Projeto desenvolvido por uma equipe de quatro integrantes durante o Hackarun.

- Vinicius
- Igor
- Bruna
- Estefany

<p align="center">
  Desenvolvido pela equipe <strong>Gyarados</strong> durante o Hackarun.
</p>
