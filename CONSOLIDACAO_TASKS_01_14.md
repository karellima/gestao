# Consolidação local das Tasks 01–14

Data: 2026-08-10  
Worktree: `onda7-integracao-consolidada`  
Branch: `karellima/onda7-integracao-consolidada`  
Base: `origin/main` (`6c5ba61`)  
Push/deploy: não executados, conforme solicitado.

## Origem auditada

Foram inspecionados todos os worktrees registrados em `git worktree list`, incluindo:
`onda1-ambiente-local`, `onda1-bootstrap-admin`, `onda1-rotacao-credenciais`,
`onda2-baseline-alembic`, `onda2-readme-agents`, `onda2-tracer-ci`,
`onda3-cobertura-fluxos`, `onda4-migracoes-adhoc`, `onda5-autorizacao`,
`onda5-historico-estoque`, `onda5-ionos-prep`, `onda6-hardening`,
`onda7-integracao-final`, `opaleye` e `/Users/karel/dev/gestao`.

As alterações não commitadas das Tasks 04, 09/10 e 12 foram preservadas. A árvore final de migrations veio da Task 10 em `onda5-historico-estoque`; as raízes Alembic intermediárias das Tasks 05/06 não foram reaplicadas.

## Commits locais

- `95bbe50` docs: define reproducible local environment
- `9192826` feat: add reproducible local environment
- `f36b291` sanitize: remove exposed financas-pessoais credentials from AGENTS.md, add ROTACAO.md
- `5109351` feat: bootstrap admin via env vars ADMIN_EMAIL/ADMIN_PASSWORD
- `e4be210` feat: tracer bullet de testes + CI
- `07bd63b` testes: cobertura ponta a ponta estoque, vendas, financeiro e requisicoes
- `2df7b94` escopo por deposito: usuarios nao-admin so enxergam dados de seus depositos
- `bfe9ef3`, `3c2d2ee`, `600a236` — arquitetura, plano e artefatos de deploy IONOS
- `15037d4` hardening: CORS por ambiente, segredos configuráveis, logging estruturado, substituição xlsx por openpyxl
- `5f90a79` docs: document gestao project workflow
- `cfd9dbd` feat: make stock history immutable and migrations linear
- `10c2ea9` fix: unify authorization through role modules
- `6d09d91`, `4fc4457`, `5060014` — ajustes de fixtures/testes para o ledger imutável

## Arquivos e grupos principais

- Ambiente/documentação: `docker-compose.yml`, `scripts/`, `docs/AMBIENTE_LOCAL.md`, `README.md`, `AGENTS.md`, `ROTACAO.md`.
- Bootstrap e hardening: `backend/seed.py`, `backend/.env.example`, `backend/app/config.py`, `backend/app/logging_config.py`, `backend/app/main.py`, `render.yaml`, exportação XLSX via `openpyxl`.
- Migrations: `backend/alembic/versions/3f9bdb34aa4d_baseline_schema.py` → `7a1c4e9b2d18_reconcilia_correcoes_do_boot.py` → `9e3f6a2c5b74_compensates_movement_id.py`.
- Histórico de estoque: `backend/app/services/stock_ledger.py`, `stock_repair.py`, `app/cli/repair_stock.py`, `app/startup.py`, schemas/model/router e documentação/testes associados.
- Autorização/escopo: routers de auth, roles, deposits, products, reports, sales, requisicoes e stock, com `is_admin_user`/`require_module`.
- Testes/CI: `.github/workflows/ci.yml`, `backend/tests/`, `backend/pytest.ini`, `backend/requirements-dev.txt`.
- IONOS: `Dockerfile`, `docker-compose.ionos.yml`, `ops/`, `.env.ionos.example`, workflow de imagem e documentação operacional.

## Verificações

- `python -m compileall -q backend/app backend/seed.py`: passou.
- `alembic heads/history`: uma única head, `9e3f6a2c5b74`, com cadeia linear desde `3f9bdb34aa4d`.
- `backend/.venv/bin/python -m pytest -q`: **148 passed**, 31 warnings de depreciação.
- `frontend/npm install`: concluído; npm reportou 8 vulnerabilidades já existentes nas dependências transitivas.
- `frontend/npm run build`: passou; Vite gerou `dist/` e o service worker PWA.
- `git diff --check`: passou.
- `git status --short --branch`: limpo após o commit deste relatório.

