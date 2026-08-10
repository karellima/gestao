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
"$root_dir/backend/.venv/bin/python" -m pip install -r "$root_dir/backend/requirements.txt"

(cd "$root_dir/frontend" && npm ci)

if [[ ! -f "$root_dir/backend/.env" ]]; then
  cp "$root_dir/backend/.env.example" "$root_dir/backend/.env"
  "$root_dir/backend/.venv/bin/python" - "$root_dir/backend/.env" <<'PY'
from pathlib import Path
import secrets
import sys

path = Path(sys.argv[1])
path.write_text(
    path.read_text().replace(
        "SECRET_KEY=your-secret-key-change-in-production",
        f"SECRET_KEY={secrets.token_hex(32)}",
    )
)
PY
fi

(cd "$root_dir" && docker compose up -d --wait db)
(cd "$root_dir/backend" && .venv/bin/python -c 'import app.main')

echo "Ambiente pronto: http://127.0.0.1:5173"
