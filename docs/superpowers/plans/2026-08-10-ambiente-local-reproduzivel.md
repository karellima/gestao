# Ambiente Local Reproduzível Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-ruby:subagent-driven-development (recommended) or superpowers-ruby:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir o Sistema de Gestão com PostgreSQL local, dados demo, backend e frontend de modo repetível em macOS e Windows.

**Architecture:** Docker Compose fornece a única dependência de estado, PostgreSQL. Scripts POSIX e PowerShell preparam dependências e controlam os processos; a aplicação mantém os mecanismos atuais de criação de esquema e seed idempotente no startup do backend.

**Tech Stack:** Docker Compose, PostgreSQL 16, Python/FastAPI/Uvicorn, React/Vite, Bash e PowerShell.

---

## File structure

- `docker-compose.yml`: banco PostgreSQL de desenvolvimento com volume e healthcheck.
- `scripts/setup.sh`, `scripts/setup.ps1`: bootstrap idempotente em macOS e Windows.
- `scripts/dev.sh`, `scripts/dev.ps1`: execução local coordenada do backend e frontend.
- `docs/AMBIENTE_LOCAL.md`: instruções operacionais, endpoints e recuperação.
- `backend/.env.example`: modelo da configuração local que os scripts copiam.

### Task 1: Definir o banco local

**Files:**

- Create: `docker-compose.yml`

- [ ] **Step 1: Criar a definição declarativa do PostgreSQL local**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: gestao
      POSTGRES_USER: gestao
      POSTGRES_PASSWORD: gestao
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - gestao_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gestao -d gestao"]
      interval: 5s
      timeout: 5s
      retries: 12

volumes:
  gestao_postgres_data:
```

- [ ] **Step 2: Validar a configuração do Compose**

Run: `docker compose config`

Expected: saída normalizada contendo o serviço `db` e o volume `gestao_postgres_data`.

- [ ] **Step 3: Subir e validar o banco**

Run: `docker compose up -d --wait db && docker compose ps`

Expected: serviço `db` com estado `healthy`.

### Task 2: Automatizar o bootstrap em macOS

**Files:**

- Create: `scripts/setup.sh`
- Create: `scripts/dev.sh`

- [ ] **Step 1: Escrever a checagem de sintaxe que inicialmente falha**

Run: `bash -n scripts/setup.sh scripts/dev.sh`

Expected: FAIL porque os scripts ainda não existem.

- [ ] **Step 2: Criar `scripts/setup.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for command in docker python3 node npm; do
  command -v "$command" >/dev/null || { echo "Falta o requisito: $command" >&2; exit 1; }
done
python3 -m venv "$root_dir/backend/.venv"
"$root_dir/backend/.venv/bin/python" -m pip install --upgrade pip
"$root_dir/backend/.venv/bin/python" -m pip install -r "$root_dir/backend/requirements.txt"
(cd "$root_dir/frontend" && npm ci)
if [[ ! -f "$root_dir/backend/.env" ]]; then
  cp "$root_dir/backend/.env.example" "$root_dir/backend/.env"
  "$root_dir/backend/.venv/bin/python" - "$root_dir/backend/.env" <<'PY'
from pathlib import Path
import secrets
import sys
path = Path(sys.argv[1])
path.write_text(path.read_text().replace("SECRET_KEY=your-secret-key-change-in-production", f"SECRET_KEY={secrets.token_hex(32)}"))
PY
fi
(cd "$root_dir" && docker compose up -d --wait db)
(cd "$root_dir/backend" && .venv/bin/python -c 'import app.main')
echo "Ambiente pronto: http://127.0.0.1:5173"
```

- [ ] **Step 3: Criar `scripts/dev.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -x "$root_dir/backend/.venv/bin/python" ]] || { echo "Execute ./scripts/setup.sh primeiro." >&2; exit 1; }
(cd "$root_dir" && docker compose up -d --wait db)
(cd "$root_dir/backend" && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM
cd "$root_dir/frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```

- [ ] **Step 4: Verificar a sintaxe após a implementação**

Run: `bash -n scripts/setup.sh scripts/dev.sh`

Expected: PASS sem saída.

### Task 3: Automatizar o bootstrap em Windows

**Files:**

- Create: `scripts/setup.ps1`
- Create: `scripts/dev.ps1`

- [ ] **Step 1: Escrever a checagem de parser que inicialmente falha**

Run: `powershell -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw scripts/setup.ps1))"`

Expected: FAIL porque o script ainda não existe.

- [ ] **Step 2: Criar `scripts/setup.ps1`**

```powershell
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
foreach ($Command in 'docker', 'py', 'node', 'npm') {
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) { throw "Falta o requisito: $Command" }
}
& py -3 -m venv "$Root/backend/.venv"
& "$Root/backend/.venv/Scripts/python.exe" -m pip install --upgrade pip
& "$Root/backend/.venv/Scripts/python.exe" -m pip install -r "$Root/backend/requirements.txt"
Push-Location "$Root/frontend"; try { npm ci } finally { Pop-Location }
if (-not (Test-Path "$Root/backend/.env")) {
  Copy-Item "$Root/backend/.env.example" "$Root/backend/.env"
  $SecretKey = & "$Root/backend/.venv/Scripts/python.exe" -c "import secrets; print(secrets.token_hex(32))"
  (Get-Content -Raw "$Root/backend/.env").Replace('SECRET_KEY=your-secret-key-change-in-production', "SECRET_KEY=$SecretKey") | Set-Content -NoNewline "$Root/backend/.env"
}
Push-Location $Root; try { docker compose up -d --wait db } finally { Pop-Location }
Push-Location "$Root/backend"; try { & .venv/Scripts/python.exe -c "import app.main" } finally { Pop-Location }
Write-Host 'Ambiente pronto: http://127.0.0.1:5173'
```

- [ ] **Step 3: Criar `scripts/dev.ps1`**

```powershell
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$Root/backend/.venv/Scripts/python.exe")) { throw 'Execute .\\scripts\\setup.ps1 primeiro.' }
Push-Location $Root; try { docker compose up -d --wait db } finally { Pop-Location }
$Backend = Start-Job -ScriptBlock { param($Path) Set-Location "$Path/backend"; & .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 } -ArgumentList $Root
try {
  Push-Location "$Root/frontend"; try { npm run dev -- --host 127.0.0.1 --port 5173 } finally { Pop-Location }
} finally {
  Stop-Job $Backend -ErrorAction SilentlyContinue
  Remove-Job $Backend -Force -ErrorAction SilentlyContinue
}
```

- [ ] **Step 4: Verificar a sintaxe após a implementação**

Run: `powershell -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw scripts/setup.ps1)); [scriptblock]::Create((Get-Content -Raw scripts/dev.ps1))"`

Expected: PASS sem erro de parser.

### Task 4: Publicar o guia operacional específico

**Files:**

- Create: `docs/AMBIENTE_LOCAL.md`
- Modify: `backend/.env.example`

- [ ] **Step 1: Documentar pré-requisitos e fluxo diário**

Inclua Docker Desktop, Python 3.12+, Node 20+, comandos `./scripts/setup.sh` e `./scripts/dev.sh` para macOS, e `powershell -ExecutionPolicy Bypass -File .\\scripts\\setup.ps1` e `powershell -ExecutionPolicy Bypass -File .\\scripts\\dev.ps1` para Windows. Registre `http://127.0.0.1:5173`, `http://127.0.0.1:8000/docs`, login `admin@admin.com / admin`, `docker compose down`, e o comando explícito de remoção do volume somente para reiniciar os dados demo.

- [ ] **Step 2: Manter o modelo de ambiente alinhado ao Compose**

```dotenv
DATABASE_URL=postgresql://gestao:gestao@localhost:5432/gestao
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

- [ ] **Step 3: Verificar que bancos locais não entram no Git**

Run: `git check-ignore backend/gestao.db`

Expected: `backend/gestao.db` impresso como arquivo ignorado.

### Task 5: Validar a jornada completa e registrar a alteração

**Files:**

- Modify: arquivos das Tasks 1–4 conforme necessário após validação.

- [ ] **Step 1: Executar bootstrap e testar a API**

Run: `./scripts/setup.sh && ./scripts/dev.sh`

Expected: banco saudável, backend em `127.0.0.1:8000` e frontend em `127.0.0.1:5173`; em outro terminal, `curl -fsS http://127.0.0.1:8000/api/health` retorna `status: ok`.

- [ ] **Step 2: Validar o build do frontend**

Run: `cd frontend && npm run build`

Expected: `vite build` conclui sem erro e cria `frontend/dist`, que permanece ignorado.

- [ ] **Step 3: Revisar somente os arquivos desta tarefa e confirmar estado do Git**

Run: `git diff --check && git status --short`

Expected: nenhuma falha de whitespace e nenhum `.db` listado para commit.

- [ ] **Step 4: Commitar e publicar com acesso válido**

Run: `git add docker-compose.yml scripts docs/AMBIENTE_LOCAL.md backend/.env.example && git commit -m "feat: add reproducible local environment" && git push origin HEAD:main`

Expected: push aceito; se a credencial atual retornar 403, interromper publicação e registrar o bloqueio para a coordenação, sem repetir a tentativa.
