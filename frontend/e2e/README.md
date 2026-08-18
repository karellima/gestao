# Banco dos testes E2E

Os testes de navegador usam um banco chamado `gestao_e2e`, separado do banco
local `gestao`. Nunca aponte estes comandos para produção nem reaproveite o banco
do desenvolvimento diário: cada rodada pode apagar e recriar `gestao_e2e`.
Como proteção adicional, `seed_e2e.py` recusa qualquer `DATABASE_URL` cujo nome
não contenha `e2e`.

Ao executar `npm run test:e2e --prefix frontend`, o `globalSetup` do Playwright
recria automaticamente esse banco, aplica as migrations e executa o seed antes
da suíte. O PostgreSQL precisa estar disponível, e o backend deve usar a mesma
`DATABASE_URL` E2E. O procedimento manual abaixo é útil apenas para preparar o
banco fora da suíte ou diagnosticar o ambiente.

## Recriar no macOS ou Linux

Na raiz do repositório, com o PostgreSQL local já configurado:

```bash
docker compose up -d --wait db
docker compose exec -T db dropdb --if-exists -U gestao gestao_e2e
docker compose exec -T db createdb -U gestao gestao_e2e
export DATABASE_URL=postgresql://gestao:gestao@127.0.0.1:5432/gestao_e2e
export SECRET_KEY="$(backend/.venv/bin/python -c 'import secrets; print(secrets.token_hex(32))')"
(cd backend && .venv/bin/python -m alembic upgrade head)
(cd backend && .venv/bin/python seed_e2e.py)
```

## Recriar no Windows PowerShell

```powershell
docker compose up -d --wait db
docker compose exec -T db dropdb --if-exists -U gestao gestao_e2e
docker compose exec -T db createdb -U gestao gestao_e2e
$env:DATABASE_URL = 'postgresql://gestao:gestao@127.0.0.1:5432/gestao_e2e'
$env:SECRET_KEY = & backend/.venv/Scripts/python.exe -c "import secrets; print(secrets.token_hex(32))"
Push-Location backend
try {
  & .venv/Scripts/python.exe -m alembic upgrade head
  & .venv/Scripts/python.exe seed_e2e.py
}
finally {
  Pop-Location
}
```

## Credenciais exclusivas de teste

O seed lê as variáveis abaixo. Os padrões são deliberadamente conhecidos e só
podem ser usados no banco E2E:

| Variável | Padrão de teste |
| --- | --- |
| `E2E_ADMIN_EMAIL` | `admin@e2e-gestao.com` |
| `E2E_ADMIN_PASSWORD` | `admin-e2e` |
| `E2E_USER_EMAIL` | `usuario@e2e-gestao.com` |
| `E2E_USER_PASSWORD` | `usuario-e2e` |

Para substituir qualquer valor, exporte a variável antes de executar o seed.
Os specs importam os mesmos padrões de `fixtures/dados.js`.

## Conferir a idempotência

Com `DATABASE_URL` e `SECRET_KEY` ainda definidos, rode duas vezes:

```bash
(cd backend && .venv/bin/python seed_e2e.py)
(cd backend && .venv/bin/python seed_e2e.py)
```

As duas execuções terminam com a mesma mensagem e não duplicam registros. A
prova automatizada fica em `backend/tests/test_seed_e2e.py`.
