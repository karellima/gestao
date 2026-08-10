$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

foreach ($Command in 'docker', 'py', 'node', 'npm') {
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    throw "Falta o requisito: $Command"
  }
}

& py -3 -m venv "$Root/backend/.venv"
& "$Root/backend/.venv/Scripts/python.exe" -m pip install --upgrade pip
# O ambiente local roda os testes: requirements-dev puxa o de producao via -r.
& "$Root/backend/.venv/Scripts/python.exe" -m pip install -r "$Root/backend/requirements-dev.txt"

Push-Location "$Root/frontend"
try {
  npm ci
}
finally {
  Pop-Location
}

if (-not (Test-Path "$Root/backend/.env")) {
  Copy-Item "$Root/backend/.env.example" "$Root/backend/.env"
  $SecretKey = & "$Root/backend/.venv/Scripts/python.exe" -c "import secrets; print(secrets.token_hex(32))"
  (Get-Content -Raw "$Root/backend/.env").Replace(
    'SECRET_KEY=your-secret-key-change-in-production',
    "SECRET_KEY=$SecretKey"
  ) | Set-Content -NoNewline "$Root/backend/.env"
}

Push-Location $Root
try {
  docker compose up -d --wait db
}
finally {
  Pop-Location
}

Push-Location "$Root/backend"
try {
  & .venv/Scripts/python.exe -c "import app.main"
}
finally {
  Pop-Location
}

Write-Host 'Ambiente pronto: http://127.0.0.1:5173'
