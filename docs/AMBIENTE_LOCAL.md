# Ambiente local

Este é o fluxo canônico de desenvolvimento do Sistema de Gestão em macOS e Windows. Ele usa PostgreSQL via Docker, portanto se aproxima do banco relacional usado em produção; SQLite continua disponível apenas como fallback técnico da aplicação e não deve ser usado para validar este fluxo.

## Pré-requisitos

- Docker Desktop em execução, com Docker Compose v2 disponível.
- Python 3.12 ou mais novo.
- Node.js 20 ou mais novo, com npm.

O banco só é publicado em `127.0.0.1:5432`; ele não fica acessível pela rede local.

## Primeiro uso

No macOS (ou Linux), a partir da raiz do repositório:

```bash
chmod +x scripts/setup.sh scripts/dev.sh
./scripts/setup.sh
./scripts/dev.sh
```

No Windows, abra PowerShell na raiz do repositório:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

`setup` cria `backend/.venv`, instala as dependências Python e Node, cria `backend/.env` a partir do exemplo caso ele ainda não exista, gera automaticamente uma `SECRET_KEY` local aleatória, aguarda o PostgreSQL e carrega o esquema e os dados demo idempotentes. `dev` mantém o banco ativo, inicia a API e deixa o Vite em primeiro plano; use `Ctrl+C` para encerrar os dois processos.

## Acessos locais

| Serviço | Endereço |
| --- | --- |
| Frontend | http://127.0.0.1:5173 |
| API | http://127.0.0.1:8000/api/health |
| Documentação da API | http://127.0.0.1:8000/docs |

Os dados de demonstração incluem o acesso `admin@admin.com` com a senha `admin`.

## Operação diária e recuperação

Depois do primeiro uso, execute apenas o script `dev` da sua plataforma. Para parar somente o banco, use:

```bash
docker compose down
```

O volume `gestao_postgres_data` preserva os dados. Para recomeçar deliberadamente com dados demo, pare o banco e remova apenas o volume deste projeto:

```bash
docker compose down -v
./scripts/setup.sh
```

No Windows, substitua o último comando por `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1`.

Não versione `backend/.env`, `backend/.venv`, volumes Docker ou arquivos `.db` locais.
