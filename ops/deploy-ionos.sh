#!/usr/bin/env bash
set -euo pipefail

HOST="${IONOS_HOST:-ionos-prod}"
REMOTE_DIR="${IONOS_APP_DIR:-/opt/gestao}"
IMAGE="${APP_IMAGE:-ghcr.io/fborgess/gestao:main}"
APPLY=0
YES=0

usage() {
  cat <<'EOF'
Uso: ops/deploy-ionos.sh [--sim] [--apply] [-y] [--host HOST] [--dir PATH] [--image IMAGE]

Sem --apply, apenas mostra o plano. --apply abre SSH e atualiza o host IONOS.
EOF
}

while (($#)); do
  case "$1" in
    --sim) APPLY=0 ;;
    --apply) APPLY=1 ;;
    -y|--yes) YES=1 ;;
    --host) HOST="$2"; shift ;;
    --dir) REMOTE_DIR="$2"; shift ;;
    --image) IMAGE="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argumento desconhecido: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [[ ! "$IMAGE" =~ ^[[:alnum:]][[:alnum:]_.:/-]*$ ]]; then
  echo "Imagem inválida: $IMAGE" >&2
  exit 2
fi

printf 'Host: %s\nDiretório: %s\nImagem: %s\n' "$HOST" "$REMOTE_DIR" "$IMAGE"
printf 'Plano: git pull --ff-only, pull da imagem, compose up e /api/health.\n'

if (( ! APPLY )); then
  echo 'Simulação concluída; nenhum SSH foi aberto.'
  exit 0
fi

if (( ! YES )); then
  read -r -p 'Aplicar no host IONOS agora? [digite SIM] ' confirmation
  [[ "$confirmation" == 'SIM' ]] || { echo 'Cancelado.'; exit 0; }
fi

REMOTE_DIR_Q=$(printf '%q' "$REMOTE_DIR")
IMAGE_Q=$(printf '%q' "$IMAGE")
ssh "$HOST" "
  set -eu
  cd $REMOTE_DIR_Q
  test -z \"\$(git status --porcelain)\"
  git pull --ff-only origin main
  APP_IMAGE=$IMAGE_Q docker compose --env-file .env.ionos -f docker-compose.ionos.yml pull app
  APP_IMAGE=$IMAGE_Q docker compose --env-file .env.ionos -f docker-compose.ionos.yml up -d --remove-orphans db app
  ready=0
  for attempt in \$(seq 1 30); do
    if curl --fail --silent --show-error http://127.0.0.1:8000/api/health >/dev/null; then ready=1; break; fi
    sleep 2
  done
  if [ \"\$ready\" -ne 1 ]; then
    docker compose --env-file .env.ionos -f docker-compose.ionos.yml ps
    exit 1
  fi
  echo 'IONOS deploy OK: /api/health'
"
