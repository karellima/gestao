# Ambiente Local Reproduzível — Design

## Objetivo

Permitir que uma pessoa em macOS ou Windows suba o Sistema de Gestão com PostgreSQL local, dados de demonstração, backend FastAPI e frontend Vite usando comandos documentados e repetíveis.

## Arquitetura

O PostgreSQL local será fornecido por Docker Compose, com volume nomeado e healthcheck. Scripts específicos para shell POSIX e PowerShell prepararão as dependências do backend e frontend, iniciarão o banco, aplicarão o esquema e os dados de demonstração existentes e iniciarão os dois servidores nas portas já usadas pela aplicação.

O guia operacional será um documento próprio. A consolidação das instruções gerais do repositório em README.md e AGENTS.md permanece fora de escopo e será feita pela Task 04.

## Componentes

- `docker-compose.yml`: contrato local do PostgreSQL, incluindo persistência, credenciais de desenvolvimento e healthcheck.
- `scripts/setup.sh` e `scripts/setup.ps1`: instalação idempotente de dependências, inicialização do banco e carga de dados demo.
- `scripts/dev.sh` e `scripts/dev.ps1`: início coordenado do backend e frontend depois de confirmarem a disponibilidade do banco.
- Guia operacional específico: pré-requisitos, comandos equivalentes em macOS e Windows, URLs locais, credenciais demo e como reiniciar o ambiente.

## Fluxo de dados

Os scripts criam um arquivo de ambiente local a partir do modelo quando necessário e apontam o backend para o PostgreSQL publicado apenas em `localhost`. Ao iniciar o backend, o esquema atual e o seed idempotente existentes preparam os dados de demonstração; o Vite encaminha `/api` para a API em `localhost:8000`.

## Erros e validação

Os scripts devem parar no primeiro erro e exibir uma ação corretiva quando Docker, Python ou Node não estiverem disponíveis. A validação cobre o healthcheck do banco, o endpoint `GET /api/health`, o build do frontend e a presença do login de demonstração.

## Decisions

- "PostgreSQL via Docker como fluxo canônico": reproduz a base de dados relacional usada pelo sistema e evita instruções dependentes de instalação manual por sistema operacional.
- "SQLite apenas como fallback implícito ou caminho secundário": não será apresentado como o fluxo principal.
- "Evite assumir a consolidação final de README.md e AGENTS.md": a Task 04 é responsável por essa harmonização; esta tarefa publicará apenas um guia operacional específico.
