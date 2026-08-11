#!/usr/bin/env sh
set -eu

if [ "${RUN_MIGRATIONS:-1}" = "1" ] && [ -d /app/backend/alembic ]; then
  (cd /app/backend && python -m alembic -c alembic.ini upgrade head)
fi

cd /app/backend
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
