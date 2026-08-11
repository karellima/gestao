#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[[ -x "$root_dir/backend/.venv/bin/python" ]] || {
  echo "Execute ./scripts/setup.sh primeiro." >&2
  exit 1
}

(cd "$root_dir" && docker compose up -d --wait db)
(cd "$root_dir/backend" && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
backend_pid=$!

trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM

cd "$root_dir/frontend"
npm run dev -- --host 127.0.0.1 --port 5173
