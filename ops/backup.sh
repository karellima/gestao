#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${GESTAO_DIR:-/opt/gestao}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.ionos.yml}"
ENV_FILE="${IONOS_ENV_FILE:-$PROJECT_DIR/.env.ionos}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/gestao}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

[[ -f "$COMPOSE_FILE" ]] || { echo "Compose não encontrado: $COMPOSE_FILE" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Env não encontrado: $ENV_FILE" >&2; exit 1; }
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo 'RETENTION_DAYS inválido' >&2; exit 2; }

umask 077
mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_DIR/gestao-$stamp.dump"
tmp="$target.tmp"

cleanup() { rm -f "$tmp"; }
trap cleanup EXIT

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$tmp"
[[ -s "$tmp" ]] || { echo 'pg_dump produziu arquivo vazio' >&2; exit 1; }
mv "$tmp" "$target"
sha256sum "$target" > "$target.sha256"

find "$BACKUP_DIR" -type f \( -name 'gestao-*.dump' -o -name 'gestao-*.dump.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete
echo "Backup OK: $target"
