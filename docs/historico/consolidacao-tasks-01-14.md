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
- `pytest -q`: **148 passed**, 31 warnings de depreciação.
- `frontend/npm install`: concluído; npm reportou 8 vulnerabilidades já existentes nas dependências transitivas.
- `frontend/npm run build`: passou; Vite gerou `dist/` e o service worker PWA.
- `git diff --check`: acusa espaços à direita em `CONSOLIDACAO_TASKS_01_14.md` (quebras de
  linha de Markdown, intencionais) e no cabeçalho gerado da baseline Alembic. Sem efeito.
- `git status --short --branch`: limpo após o commit deste relatório.

## Revisão da Task 15

Revisão do worktree consolidado contra `origin/main` (`6c5ba61`), sem descartar alterações.
Nada foi enviado: sem push, sem deploy.

### Defeitos corrigidos

| # | Onde | Problema | Correção |
|---|---|---|---|
| 1 | `backend/app/config.py` | `ADMIN_EMAIL`/`ADMIN_PASSWORD` com defaults `admin@admin.com`/`admin` — credencial padrão versionada, contradizendo README e AGENTS.md. Sobra da Task 04: `seed.py` já lia o ambiente direto e importava as constantes sem usá-las. | Constantes removidas; import morto removido de `seed.py`. |
| 2 | `backend/app/config.py` | `CORS_ORIGINS` aceitava `*`. Com `allow_credentials=True`, o Starlette passa a refletir a origem de quem pedir e libera credenciais — qualquer site falando com a API. | Curinga recusado na subida, com mensagem. |
| 3 | `.github/workflows/ionos-image.yml`, `.env.ionos.example`, `ops/deploy-ionos.sh`, `docs/` | Imagem publicada em `ghcr.io/fborgess/gestao`, mas o remoto é `karellima/gestao`: o `GITHUB_TOKEN` do workflow não tem permissão nesse namespace e o push falharia. | Namespace corrigido para `karellima` (`README`/`AGENTS.md` também). `ROTACAO.md` preservado — é registro histórico. |
| 4 | `.dockerignore` | Padrões do Docker não são recursivos como os do git: `.env` e `*.db` pegavam só a raiz, então `backend/.env` e `backend/gestao.db` entrariam na imagem em qualquer build local. | Padrões reescritos com `**/`; `.venv/` e `node_modules/` fora do contexto. |
| 5 | `backend/requirements.txt` + `.github/workflows/ci.yml` | `pytest`/`httpx` no requirements de produção — duplicados no `requirements-dev.txt`, cujo comentário afirma o contrário. Iam para a imagem e para o Render. | Removidos do de produção; CI e `scripts/setup.{sh,ps1}` passam a instalar `requirements-dev.txt`. |
| 6 | `backend/app/routers/reports.py` | `POST /export-excel` interpolava `filename` do cliente direto no header `Content-Disposition`; título com `/` e célula com valor aninhado derrubavam o endpoint em 500. | Nome de arquivo e título saneados; valores não escalares viram texto. Coberto por `tests/test_export_excel.py`. |
| 7 | `backend/app/routers/stock.py` | `_is_admin` reimplementava a consulta de perfil em vez de usar `is_admin_user` — o único router que a Task 12 não unificou. | Passa a delegar. |
| 8 | 6 routers | `_user_deposit_ids` duplicado literalmente seis vezes; é o filtro de escopo por depósito, e dois jeitos de respondê-lo são dois jeitos de vazar depósito alheio. | Extraído para `app/utils/security.user_deposit_ids`. |
| 9 | `config.py`, `reports.py`, `sales.py`, `products.py`, `stock.py`, `seed.py` | 11 imports mortos introduzidos pelas ondas. | Removidos; pyflakes não acusa nenhuma regressão nova em relação a `origin/main`. |

### Verificado sem alteração

- **Alembic**: uma única raiz (`3f9bdb34aa4d`, `Parent: <base>`), uma única head (`9e3f6a2c5b74`), sem branches. Cadeia linear de três revisões.
- **Segredos**: nenhuma credencial real no diff. `.env`/`.db`/`dist` não versionados; só arquivos `.example` com placeholders.
- **Permissões**: todo endpoint passa por `require_module`/`require_any_module`/`require_admin`; o escopo por depósito é aplicado consistentemente nos seis routers.
- `main.py` continua sem DDL no boot, e sem tocar em movimentação de estoque.

### Ficam registrados, não corrigidos

- `main.py` ainda grava `RoleModule` no boot (garante `stock_reports`/`products`/`price_tables` a perfis existentes). É a mesma classe de coisa que a Task 09 tirou do boot para o Alembic, e um perfil que tiver esses módulos revogados de propósito volta a recebê-los na próxima subida. Comportamento herdado de `main`, fora do escopo desta revisão.
- `allow_credentials=True` no CORS: o app autentica por `Authorization: Bearer` (localStorage), sem cookie, então a flag não compra nada. Mantida por ser escolha explícita da Task 13; o buraco que ela abria (curinga) está fechado no item 2.
- `export-excel` aceita `rows` sem limite de tamanho: um usuário autenticado pode pedir uma planilha grande o bastante para pesar na memória do processo.
- `npm audit`: 8 vulnerabilidades em dependências transitivas (4 moderadas, 4 altas), incluindo `react-router` — todas anteriores a esta branch.

### Verificações da revisão

- `pytest -q`: **159 passed** (148 anteriores + 11 novos), sem falhas.
- `npm run build`: passou; `dist/` e service worker gerados.
- `python -m compileall backend/app backend/seed.py backend/alembic backend/tests`: passou.
- `pyflakes` comparado a `origin/main`: nenhuma regressão nova (só o `import app.models` com `# noqa: F401` de efeito colateral).
- `esbuild` sobre os 45 arquivos de `frontend/src`: todos analisam sem erro.
- `alembic heads` / `history` / `branches`: uma head, uma raiz, sem ramos.

