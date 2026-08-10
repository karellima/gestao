#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${GESTAO_DIR:-/opt/gestao}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.ionos.yml}"
ENV_FILE="${IONOS_ENV_FILE:-$PROJECT_DIR/.env.ionos}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/gestao}"
PATH_ARG=""
CONFIRM=0
ALLOW_EXTERNAL=0

usage() {
  echo 'Uso: ops/restore.sh --path /var/backups/gestao/gestao-...dump --confirm [--allow-external-path]'
}
while (($#)); do
  case "$1" in
    --path) PATH_ARG="$2"; shift ;;
    --confirm) CONFIRM=1 ;;
    --allow-external-path) ALLOW_EXTERNAL=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argumento desconhecido: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

[[ -n "$PATH_ARG" ]] || { echo 'Informe --path.' >&2; exit 2; }
[[ -f "$PATH_ARG" ]] || { echo "Dump não encontrado: $PATH_ARG" >&2; exit 1; }
if (( ! ALLOW_EXTERNAL )); then
  case "$PATH_ARG" in
    "$BACKUP_DIR"/*) ;;
    *) echo "Dump fora de BACKUP_DIR; use --allow-external-path se intencional." >&2; exit 2 ;;
  esac
fi
(( CONFIRM )) || { echo 'Restore destrutivo exige --confirm.' >&2; exit 2; }
[[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]] || { echo 'Compose/env não encontrado.' >&2; exit 1; }

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop app
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$PATH_ARG"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" start app
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:8000/api/health >/dev/null; then
    echo 'Restore OK: /api/health'
    exit 0
  fi
  sleep 2
done
echo 'Restore concluído, mas /api/health não respondeu a tempo.' >&2
exit 1
