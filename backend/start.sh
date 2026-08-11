#!/usr/bin/env bash
set -e

# Build frontend
echo "Building frontend..."
cd frontend && npm install && npm run build && cd ..

cd backend

# O app não cria mais schema no boot: quem migra é o alembic, aqui, antes de
# subir. `set -e` garante que um deploy com migration quebrada não sobe um app
# apontando para um banco em estado indefinido.
echo "Applying migrations..."
alembic upgrade head

echo "Starting backend..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
