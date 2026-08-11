# Sistema de Gestao

ERP-lite para gestao de estoque, vendas, financeiro e contatos.

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, JWT (python-jose + bcrypt) |
| Frontend | React 18, Vite 5, Tailwind CSS 3.3, PWA |
| Banco (dev) | PostgreSQL via Docker Compose (SQLite tambem e suportado) |
| Banco (prod) | PostgreSQL (Render managed database `gestao-db`) |
| Host | Render → `https://gestao-iscb.onrender.com` |
| Repo | `karellima/gestao` |

## Rodando localmente

### Backend

```bash
cd backend
cp .env.example .env         # edite se quiser PostgreSQL; padrao usa SQLite local
pip install -r requirements-dev.txt   # producao usa requirements.txt, sem pytest/httpx
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npx vite --port 5173 --host 127.0.0.1
```

### Acesso

- App: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`
- Login: configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` antes de executar o seed; nao ha credenciais padrao versionadas.

## Variaveis de ambiente

| Variavel | Descricao | Padrao local |
|---|---|---|
| `DATABASE_URL` | Conexao com o banco | `sqlite:///./gestao.db` |
| `SECRET_KEY` | Chave de assinatura JWT | `your-secret-key-change-in-production` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiracao do token JWT | `480` (8h) |

Em producao no Render, `DATABASE_URL` e `SECRET_KEY` sao injetadas automaticamente.

## Deploy

Deploy automatico via Render (branch `main`). O `render.yaml` define o servico:

1. Build: `npm install && npm run build` (frontend), `pip install -r requirements.txt` (backend)
2. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. O backend serve os arquivos estaticos do frontend (buildado), entao basta um unico servico.

## Estrutura

```
gestao/
  AGENTS.md              # instrucoes para agentes
  render.yaml            # config de deploy no Render
  backend/
    app/
      main.py            # entrypoint, monta middlewares e rotas
      config.py          # leitura de env vars
      database.py        # engine SQLAlchemy
      models/            # modelos (User, Product, StockMovement, Transaction, etc.)
      schemas/           # schemas Pydantic
      routers/           # endpoints REST (/api/*)
      utils/security.py  # JWT, bcrypt, decorators de permissao
    seed.py              # dados iniciais (roles, admin user, categorias, etc.)
    requirements.txt
    .env.example
  frontend/
    src/
      App.jsx            # rotas React Router + auth gate
      main.jsx           # entrypoint
      contexts/          # AuthContext, SettingsContext
      services/api.js    # axios com token JWT
      pages/             # ~30 paginas (Dashboard, Produtos, Estoque, Financeiro, etc.)
      components/        # Layout, SearchableSelect, ImportExcelModal, etc.
    vite.config.js
    package.json
  startup/               # scripts de auto-start no Windows
  backup.ps1             # backup local + producao (pg_dump)
  restore.ps1            # restauracao de backup
  status.ps1             # status dos servicos
  iniciar.bat            # atalho Windows para iniciar backend + frontend
```

## Backup e restauracao (Windows/PowerShell)

- `backup.ps1` — faz dump do banco local (SQLite) e do banco de producao (PostgreSQL, via `pg_dump`). Espelha no OneDrive. Mantem os ultimos 10 backups.
- `restore.ps1` — restaura um `.dump` no banco de destino usando `pg_restore`.
- `status.ps1` — mostra status dos processos backend e frontend, IP local e testes de conectividade.

Para backup de producao, copie `backup.env.example` para `backup.env` e preencha `PROD_DATABASE_URL` com a External Database URL do Render.
