$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path "$Root/backend/.venv/Scripts/python.exe")) {
  throw 'Execute .\scripts\setup.ps1 primeiro.'
}

Push-Location $Root
try {
  docker compose up -d --wait db
}
finally {
  Pop-Location
}

$Backend = Start-Job -ScriptBlock {
  param($Path)
  Set-Location "$Path/backend"
  & .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
} -ArgumentList $Root

try {
  Push-Location "$Root/frontend"
  try {
    npm run dev -- --host 127.0.0.1 --port 5173
  }
  finally {
    Pop-Location
  }
}
finally {
  Stop-Job $Backend -ErrorAction SilentlyContinue
  Remove-Job $Backend -Force -ErrorAction SilentlyContinue
}
