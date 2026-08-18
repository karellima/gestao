# Sistema de Gestão

ERP-lite para gestão de estoque, vendas, financeiro e contatos. Backend FastAPI,
frontend React, banco PostgreSQL, rodando em servidor próprio.

Vai mexer no sistema? Comece pela receita da tarefa que você quer fazer em
[`docs/receitas/`](docs/receitas/); antes de abrir o PR, rode o
[`quality/revisao-rapida.md`](quality/revisao-rapida.md).

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, JWT (python-jose + bcrypt) |
| Frontend | React 18, Vite 5, Tailwind CSS 3.3, PWA |
| Banco | PostgreSQL 16 (SQLite serve só para teste rápido local) |
| Produção | Servidor próprio na IONOS, via Docker |
| Imagem | `ghcr.io/karellima/gestao` |

## Começando

Primeira vez — sobe o banco, aplica as migrations, popula os dados de demonstração
e imprime o login local:

```bash
./scripts/setup.sh
```

No Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1`

Depois disso, o dia a dia é um comando só. Ele sobe banco, API e Vite juntos:

```bash
./scripts/dev.sh
```

- App: <http://localhost:5173>
- API e documentação interativa: <http://localhost:8000/docs>

Pré-requisitos, como reiniciar o ambiente do zero e o que fazer quando algo não
sobe: [docs/AMBIENTE_LOCAL.md](docs/AMBIENTE_LOCAL.md).

### Rodando as partes separadamente

Quando você precisa de só um lado no ar — depurar a API sem o Vite, por exemplo:

```bash
cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
cd frontend && npx vite --port 5173 --host 127.0.0.1
```

Em desenvolvimento o Vite faz proxy de `/api` para `localhost:8000`. Em produção
não existe Vite: o backend serve o frontend já buildado, então basta ele no ar.

## Configuração

O backend lê tudo de variáveis de ambiente. Os modelos estão em
`backend/.env.example` (local) e `.env.ionos.example` (produção); o `.env.ionos`
real não é versionado.

| Variável | O que faz | Padrão local |
|---|---|---|
| `DATABASE_URL` | Conexão com o banco | `sqlite:///./gestao.db` |
| `SECRET_KEY` | Assinatura dos tokens JWT | valor de desenvolvimento |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiração do token | `480` (8h) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Criam o administrador no seed | sem padrão |

**Não existe credencial de administrador versionada.** O seed só cria o admin
quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` estão definidos no ambiente.

## Como o schema muda

Só por migration, nunca pelo boot da aplicação:

```bash
cd backend && alembic revision --autogenerate -m "descricao"
cd backend && alembic upgrade head
```

Mudança de model sem migration correspondente é bug. O motivo, o que fazer com
banco que já existia e como testar a cadeia inteira estão em
[backend/docs/migrations.md](backend/docs/migrations.md).

Movimentação de estoque é imutável: linha de `stock_movements` não se apaga nem
se reescreve — erro se corrige por compensação
([backend/docs/estoque-historico-imutavel.md](backend/docs/estoque-historico-imutavel.md)).

## Deploy

Produção roda em servidor próprio na IONOS, com Docker. **Não há autoDeploy:**
publicar é um passo manual e explícito, e nada sobe sem autorização do dono do
sistema.

1. O GitHub Actions constrói a imagem e publica em `ghcr.io/karellima/gestao`.
2. `docker-compose.ionos.yml` sobe a aplicação e o PostgreSQL no servidor.
3. `ops/entrypoint.sh` roda `alembic upgrade head` antes de subir a aplicação —
   migration quebrada derruba o start, e o app nunca sobe apontando para um
   banco em estado indefinido.

O backup do banco é diário, por timer systemd, com retenção de 14 dias
(`ops/backup.sh`); a restauração é `ops/restore.sh`, que exige `--confirm`.

Runbook completo — instalar, publicar versão nova, restaurar backup, investigar
incidente: [docs/operacao-ionos.md](docs/operacao-ionos.md).

## Qualidade

`quality/gate.py` é uma catraca. Ele mede violações de lint, complexidade,
cobertura, duplicação, tamanho de arquivo e ciclos de import, e falha se algum
número piorar em relação ao `quality/baseline.json`. Roda no CI e no hook de
pre-commit.

```bash
python3 quality/gate.py
```

Números melhoram enquanto o código piora — por isso existe
[quality/review.md](quality/review.md), a lista do que o gate não pega e um
humano precisa olhar no PR.

## Onde as coisas ficam

```
backend/     API FastAPI: models, schemas, routers, migrations, testes
frontend/    SPA React: pages, components, contexts, services
scripts/     setup e dev — o que você roda na sua máquina
ops/         deploy, backup, restore, systemd — o que roda no servidor
quality/     catraca de qualidade, baseline e rubrica de review
docs/        documentação do projeto
```

A regra de qual arquivo pode morar na raiz, e por que ela é curta:
[docs/estrutura-do-repositorio.md](docs/estrutura-do-repositorio.md).

As regras de trabalho no projeto — o que rodar antes de commitar, o que nunca
versionar, quais invariantes não se quebra — estão em [AGENTS.md](AGENTS.md).
