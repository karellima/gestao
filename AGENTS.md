# Regras do projeto

## Ao concluir uma alteracao

1. **Testes**: rodar `cd backend && .venv/bin/python -m pytest tests/` e validar verde.
2. **Frontend**: rodar `npm run build` (na pasta `frontend`) e validar o build.
3. **Schema**: mudanca de model exige migration (`cd backend && alembic revision --autogenerate`). O app nao cria schema — ver `backend/docs/migrations.md`.
4. **Commit** apenas os arquivos relevantes (nunca incluir `.db`/bancos de dados no commit, nem `backup.env`, nem `.xlsx`).
5. **Push** para um branch e abrir PR. Nao existe autoDeploy: publicar em producao e um passo manual e explicito.

## Deploy / infra

- **App**: Sistema de Gestao — este repositorio (`karellima/gestao`, fork de `Fborgess/gestao`).
- **Producao**: servidor proprio na **IONOS**, via Docker. O runbook completo esta em `docs/operacao-ionos.md`.
  - GitHub Actions constroi a imagem e publica em `ghcr.io/karellima/gestao`.
  - `docker-compose.ionos.yml` sobe a aplicacao e o PostgreSQL 16 no servidor.
  - `ops/entrypoint.sh` roda `alembic upgrade head` antes de subir a aplicacao.
  - Backup diario por timer systemd (`ops/backup.sh`), retencao de 14 dias.
- **O Render nao e mais o destino.** `render.yaml` e os scripts `.bat`/`.ps1` da raiz sao heranca da fase anterior e serao removidos; nao os use como referencia.
- **Nada sobe para producao sem autorizacao explicita do dono do sistema.** Preparar artefato nao e implantar.
- **Banco de producao**: PostgreSQL no proprio servidor, configurado por `DATABASE_URL` em `.env.ionos` (nao versionado).
- O SQLite local so serve para teste rapido; o ambiente de desenvolvimento usa o PostgreSQL do `docker-compose.yml`.
- Acesso administrativo: nao ha credencial padrao. O seed so cria administrador quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` estao definidos no ambiente.

## Execucao local

- **Primeira vez**: `./scripts/setup.sh` (ou `scripts\setup.ps1` no Windows). Ele migra o banco e imprime o login local. Detalhes em `docs/AMBIENTE_LOCAL.md`.
- **Dia a dia**: `./scripts/dev.sh` sobe banco, API e Vite juntos.
- **Backend avulso**: `cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- **Frontend avulso**: `cd frontend && npx vite --port 5173 --host 127.0.0.1`
- O frontend em dev faz proxy de `/api` para `http://localhost:8000` (configurado no `vite.config.js`).
- Em producao, o backend serve os arquivos estaticos do frontend (buildado em `frontend/dist/`), entao so o backend precisa rodar.

## Riscos

- Nunca commitar `backend/gestao.db`, `backup.env`, arquivos `.xlsx`, ou a pasta `backups/`.
- Nao alterar `SECRET_KEY` em producao sem planejamento — invalidara todos os tokens JWT existentes.
- Movimentacao de estoque e imutavel: nunca apagar nem reescrever linha de `stock_movements`. Erro se corrige por compensacao — ver `backend/docs/estoque-historico-imutavel.md`.
- O banco local e recriado por migrations quando apagado; os dados nao sobrevivem.
- Scripts `.bat` e `.ps1` tem caminhos absolutos da maquina do autor (`C:\Python314\`, `C:\Users\fsbor\`). Nao funcionam em outras maquinas sem ajuste.
