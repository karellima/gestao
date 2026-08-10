#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for command in docker python3 node npm; do
  command -v "$command" >/dev/null || {
    echo "Falta o requisito: $command" >&2
    exit 1
  }
done

python3 -m venv "$root_dir/backend/.venv"
"$root_dir/backend/.venv/bin/python" -m pip install --upgrade pip
# O ambiente local roda os testes: instala o requirements-dev, que puxa o de
# produção via `-r` e acrescenta pytest/httpx.
"$root_dir/backend/.venv/bin/python" -m pip install -r "$root_dir/backend/requirements-dev.txt"

(cd "$root_dir/frontend" && npm ci)

if [[ ! -f "$root_dir/backend/.env" ]]; then
  cp "$root_dir/backend/.env.example" "$root_dir/backend/.env"
  "$root_dir/backend/.venv/bin/python" - "$root_dir/backend/.env" <<'PY'
from pathlib import Path
import secrets
import sys

path = Path(sys.argv[1])
texto = path.read_text().replace(
    "SECRET_KEY=your-secret-key-change-in-production",
    f"SECRET_KEY={secrets.token_hex(32)}",
)
# Administrador de desenvolvimento. O seed só cria usuário quando ADMIN_EMAIL e
# ADMIN_PASSWORD estão definidos — sem isto o banco nasce sem ninguém e não há
# como entrar na aplicação. A senha é sorteada e fica só no .env, não versionado.
texto = texto.replace("# ADMIN_EMAIL=admin@exemplo.com", "ADMIN_EMAIL=admin@local.test")
texto = texto.replace("# ADMIN_PASSWORD=senha-segura", f"ADMIN_PASSWORD={secrets.token_urlsafe(12)}")
path.write_text(texto)
PY
fi

(cd "$root_dir" && docker compose up -d --wait db)

# O app não cria schema. Quem cria é o alembic, e é aqui que isso acontece na
# primeira subida: sem esta linha o `import app.main` logo abaixo morre com
# "Banco sem as tabelas users, roles, products, stock_movements".
(cd "$root_dir/backend" && .venv/bin/python -m alembic upgrade head)

(cd "$root_dir/backend" && .venv/bin/python -c 'import app.main')

echo "Ambiente pronto: http://127.0.0.1:5173"
echo "Login local: $(grep '^ADMIN_EMAIL=' "$root_dir/backend/.env" | cut -d= -f2-) / $(grep '^ADMIN_PASSWORD=' "$root_dir/backend/.env" | cut -d= -f2-)"
