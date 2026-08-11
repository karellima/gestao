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
  # Administrador de desenvolvimento. O seed so cria usuario quando ADMIN_EMAIL e
  # ADMIN_PASSWORD estao definidos — sem isto o banco nasce sem ninguem e nao ha
  # como entrar na aplicacao. A senha e sorteada e fica so no .env, nao versionado.
  $AdminPassword = & "$Root/backend/.venv/Scripts/python.exe" -c "import secrets; print(secrets.token_urlsafe(12))"
  (Get-Content -Raw "$Root/backend/.env").Replace(
    'SECRET_KEY=your-secret-key-change-in-production',
    "SECRET_KEY=$SecretKey"
  ).Replace(
    '# ADMIN_EMAIL=admin@exemplo.com',
    'ADMIN_EMAIL=admin@local.test'
  ).Replace(
    '# ADMIN_PASSWORD=senha-segura',
    "ADMIN_PASSWORD=$AdminPassword"
  ) | Set-Content -NoNewline "$Root/backend/.env"
}

Push-Location $Root
try {
  docker compose up -d --wait db
}
finally {
  Pop-Location
}

# O app nao cria schema. Quem cria e o alembic, e e aqui que isso acontece na
# primeira subida: sem esta etapa o `import app.main` abaixo morre com
# "Banco sem as tabelas users, roles, products, stock_movements".
Push-Location "$Root/backend"
try {
  & .venv/Scripts/python.exe -m alembic upgrade head
  & .venv/Scripts/python.exe -c "import app.main"
}
finally {
  Pop-Location
}

$AdminEmail = (Select-String -Path "$Root/backend/.env" -Pattern '^ADMIN_EMAIL=(.*)$').Matches.Groups[1].Value
$AdminSenha = (Select-String -Path "$Root/backend/.env" -Pattern '^ADMIN_PASSWORD=(.*)$').Matches.Groups[1].Value

Write-Host 'Ambiente pronto: http://127.0.0.1:5173'
Write-Host "Login local: $AdminEmail / $AdminSenha"
