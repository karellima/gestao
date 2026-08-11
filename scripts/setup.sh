#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
venv_dir="$root_dir/backend/.venv"

for command in docker node npm; do
  command -v "$command" >/dev/null || {
    echo "Falta o requisito: $command" >&2
    exit 1
  }
done

# O interpretador é escolhido explicitamente, nunca por `python3` puro: no macOS
# `python3` é o 3.9.6 do CommandLineTools, e o app usa sintaxe de 3.10+. Criar a
# venv com ele não falha na hora — falha depois, na instalação das dependências —
# e ainda reescreve o pyvenv.cfg de uma venv 3.12 que já estivesse no lugar,
# deixando um ambiente onde nenhum comando Python roda. O CI usa 3.12; os números
# congelados em quality/baseline.json só se reproduzem nessa versão.
python_compativel() {
  "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)' >/dev/null 2>&1
}

tem_uv=0
command -v uv >/dev/null && tem_uv=1

# A ordem de preferência é 3.12 exato > uv > qualquer 3.12+ do PATH. O CI roda em
# 3.12 e as dependências estão pinadas nela; o uv entra na frente de um 3.13/3.14
# porque baixa o 3.12 sozinho, e um Python mais novo que o do CI pode não ter
# wheel para as versões pinadas.
interpretador=""
caminho="$(command -v python3.12 2>/dev/null || true)"
if [[ -n "$caminho" ]] && python_compativel "$caminho"; then
  interpretador="$caminho"
fi

if [[ -z "$interpretador" && $tem_uv -eq 0 ]]; then
  for candidato in python3.13 python3.14 python3; do
    caminho="$(command -v "$candidato" 2>/dev/null || true)"
    if [[ -n "$caminho" ]] && python_compativel "$caminho"; then
      interpretador="$caminho"
      echo "Aviso: usando $caminho. O CI roda em 3.12 — divergências de versão aparecem primeiro aqui." >&2
      break
    fi
  done
fi

if [[ -z "$interpretador" && $tem_uv -eq 0 ]]; then
  echo "Falta o requisito: Python 3.12." >&2
  echo "Instale com 'brew install python@3.12', ou instale o uv (https://docs.astral.sh/uv/)." >&2
  exit 1
fi

# Venv existente só é reaproveitada se o interpretador dela ainda funcionar e for
# 3.12+. Uma venv quebrada é refeita, não remendada: instalar por cima deixa
# metade das dependências apontando para o Python errado.
if [[ -x "$venv_dir/bin/python" ]] && python_compativel "$venv_dir/bin/python"; then
  echo "Reaproveitando a venv em $venv_dir"
else
  if [[ -e "$venv_dir" ]]; then
    echo "Recriando $venv_dir: a venv existente não roda em Python 3.12+."
  fi
  rm -rf "$venv_dir"
  if [[ -n "$interpretador" ]]; then
    "$interpretador" -m venv "$venv_dir"
  else
    uv venv --python 3.12 "$venv_dir"
  fi
fi

# Quem instala depende de como a venv nasceu: `uv venv` não põe pip lá dentro, e
# `python -m venv` põe. Decidir pelo que a venv tem — e não pelo que criou esta
# execução — mantém o script correto sobre uma venv que já estava no disco.
# O requirements-dev puxa o de produção via `-r` e acrescenta pytest/httpx: o
# ambiente local roda os testes.
if "$venv_dir/bin/python" -m pip --version >/dev/null 2>&1; then
  "$venv_dir/bin/python" -m pip install --upgrade pip
  "$venv_dir/bin/python" -m pip install -r "$root_dir/backend/requirements-dev.txt"
elif (( tem_uv )); then
  uv pip install --python "$venv_dir/bin/python" -r "$root_dir/backend/requirements-dev.txt"
else
  echo "A venv em $venv_dir não tem pip e o uv não está instalado. Apague a pasta e rode de novo." >&2
  exit 1
fi

(cd "$root_dir/frontend" && npm ci)

if [[ ! -f "$root_dir/backend/.env" ]]; then
  cp "$root_dir/backend/.env.example" "$root_dir/backend/.env"
  "$venv_dir/bin/python" - "$root_dir/backend/.env" <<'PY'
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

# `docker compose up --wait` dá sucesso mesmo quando a porta não foi publicada
# porque outro container já a ocupava — e aí o alembic e o app conectam no banco
# alheio, não neste. O sintoma é obscuro (migration batendo em tabela que "já
# existe"), então a checagem é feita aqui, onde dá para dizer o que houve.
publicado="$(cd "$root_dir" && docker compose port db 5432 2>/dev/null || true)"
if [[ -z "$publicado" ]]; then
  echo "O banco deste repositório subiu sem publicar a porta 5432 — outro container já a ocupa:" >&2
  docker ps --filter publish=5432 --format '  {{.Names}} ({{.Image}}, no ar há {{.RunningFor}})' >&2
  echo "Pare o container acima e rode este script de novo." >&2
  exit 1
fi

# O app não cria schema. Quem cria é o alembic, e é aqui que isso acontece na
# primeira subida: sem esta linha o `import app.main` logo abaixo morre com
# "Banco sem as tabelas users, roles, products, stock_movements".
(cd "$root_dir/backend" && .venv/bin/python -m alembic upgrade head)

(cd "$root_dir/backend" && .venv/bin/python -c 'import app.main')

echo "Ambiente pronto: http://127.0.0.1:5173"
echo "Login local: $(grep '^ADMIN_EMAIL=' "$root_dir/backend/.env" | cut -d= -f2-) / $(grep '^ADMIN_PASSWORD=' "$root_dir/backend/.env" | cut -d= -f2-)"
