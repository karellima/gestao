# Regras do projeto

Vai mexer no sistema? Comece pela receita da tarefa que você quer fazer em
[`docs/receitas/`](docs/receitas/). Depois confira o checklist executável em
[`quality/revisao-rapida.md`](quality/revisao-rapida.md).

## Ao concluir uma alteração

1. **Testes**: rodar `cd backend && .venv/bin/python -m pytest tests/` e validar verde.
2. **Frontend**: rodar `npm run build` (na pasta `frontend`) e validar o build.
3. **Qualidade**: rodar `python3 quality/gate.py`. O gate é uma catraca — nenhum
   número pode piorar em relação ao `quality/baseline.json`.
4. **Schema**: mudança de model exige migration (`cd backend && alembic revision --autogenerate`). O app não cria schema — ver `backend/docs/migrations.md`.
5. **Commit** apenas os arquivos relevantes (nunca incluir `.db`/bancos de dados no commit, nem `.env`, nem `.xlsx`).
6. **Push** para um branch e abrir PR. Não existe autoDeploy: publicar em produção é um passo manual e explícito.

## Onde criar arquivo

A raiz é curta de propósito: só mora nela o que uma ferramenta exige encontrar
ali (`Dockerfile`, `docker-compose*.yml`, `.gitignore`) ou o que é porta de
entrada do projeto (`README.md`, `AGENTS.md`). Todo o resto vai para uma pasta.

- `scripts/` — o que o desenvolvedor roda na máquina dele. Nasce em par: `.sh` e `.ps1`.
- `ops/` — o que roda no servidor de produção.
- `docs/` — documentação. Incidente de segurança em `docs/seguranca/`, registro de trabalho concluído em `docs/historico/`.
- `quality/` — catraca de qualidade e rubrica de review.

**Nenhum script versionado pode conter caminho absoluto de uma máquina
específica.** Use caminho relativo ao repositório ou variável de ambiente com
padrão. A regra completa está em `docs/estrutura-do-repositorio.md`.

## Deploy / infra

- **App**: Sistema de Gestão — este repositório (`karellima/gestao`, fork de `Fborgess/gestao`).
- **Produção**: servidor próprio na **IONOS**, via Docker. O runbook completo está em `docs/operacao-ionos.md`.
  - GitHub Actions constrói a imagem e publica em `ghcr.io/karellima/gestao`.
  - `docker-compose.ionos.yml` sobe a aplicação e o PostgreSQL 16 no servidor.
  - `ops/entrypoint.sh` roda `alembic upgrade head` antes de subir a aplicação.
  - Backup diário por timer systemd (`ops/backup.sh`), retenção de 14 dias.
- **O Render não é mais o destino.** Os arquivos daquela fase (`render.yaml`, `Procfile`, `runtime.txt`, `backend/start.sh`) e os scripts `.bat`/`.ps1` da raiz foram removidos em 2026-08-10. Se encontrar referência a eles em algum documento, é resíduo — corrija.
- **Nada sobe para produção sem autorização explícita do dono do sistema.** Preparar artefato não é implantar.
- **Banco de produção**: PostgreSQL no próprio servidor, configurado por `DATABASE_URL` em `.env.ionos` (não versionado).
- O SQLite local só serve para teste rápido; o ambiente de desenvolvimento usa o PostgreSQL do `docker-compose.yml`.
- Acesso administrativo: não há credencial padrão. O seed só cria administrador quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` estão definidos no ambiente.

## Execução local

- **Primeira vez**: `./scripts/setup.sh` (ou `scripts\setup.ps1` no Windows). Ele migra o banco e imprime o login local. Detalhes em `docs/AMBIENTE_LOCAL.md`.
- **Dia a dia**: `./scripts/dev.sh` sobe banco, API e Vite juntos.
- **Backend avulso**: `cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- **Frontend avulso**: `cd frontend && npx vite --port 5173 --host 127.0.0.1`
- O frontend em dev faz proxy de `/api` para `http://localhost:8000` (configurado no `vite.config.js`).
- Em produção, o backend serve os arquivos estáticos do frontend (buildado em `frontend/dist/`), então só o backend precisa rodar.

## Riscos

- Nunca commitar `backend/gestao.db`, arquivos `.env`, arquivos `.xlsx`, ou a pasta `backups/`.
- Não alterar `SECRET_KEY` em produção sem planejamento — invalidará todos os tokens JWT existentes.
- Movimentação de estoque é imutável: nunca apagar nem reescrever linha de `stock_movements`. Erro se corrige por compensação — ver `backend/docs/estoque-historico-imutavel.md`.
- O banco local é recriado por migrations quando apagado; os dados não sobrevivem.
- **Nenhum arquivo versionado leva segredo** — nem de desenvolvimento. Senha, connection string de produção, token de API e chave secreta vivem em variável de ambiente (`.env` local, `.env.ionos` no servidor, ambos fora do git) e em gerenciador de senhas. Este repositório já publicou uma credencial em texto plano num arquivo versionado; o custo disso não é reversível por commit.
