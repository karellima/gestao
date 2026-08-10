# Regras do projeto

## Toda alteracao deve subir para a nuvem

Toda alteracao feita em codigo deve ser publicada na nuvem (commit + push). Sempre que concluir uma alteracao:

1. **Frontend**: rodar `npm run build` (na pasta `frontend`) e validar o build.
2. **Commit** apenas os arquivos relevantes (nunca incluir `.db`/bancos de dados no commit, nem `backup.env`, nem `.xlsx`).
3. **Push** para `origin/main` — o Render (autoDeploy) reimplanta sozinho.
4. **Verificar** a nova versao no ar em `https://gestao-iscb.onrender.com` antes de encerrar.

## Deploy / infra

- **App**: Sistema de Gestao — este repositorio (`Fborgess/gestao`).
- **Producao**: Render web service `gestao` → `https://gestao-iscb.onrender.com`.
- **Banco de dados de producao**: PostgreSQL gerenciado pelo Render (`gestao-db`), definido via `DATABASE_URL` injetada automaticamente.
- O SQLite local (`backend/gestao.db`) e **so desenvolvimento** — os dados reais ficam no PostgreSQL do Render.
- Acesso para consultar a producao via API: use credenciais definidas fora do repositorio; o seed so cria administrador quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` estiverem configuradas.
- O build injeta um marcador de versao (data + hash do commit), entao o hash do bundle difere entre builds locais e do Render — para confirmar que o deploy subiu, verificar o **conteudo** (nova logica presente no bundle servido), nao so o nome do arquivo.

## Execucao local

- **Backend**: `cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- **Frontend**: `cd frontend && npx vite --port 5173 --host 127.0.0.1`
- O frontend em dev faz proxy de `/api` para `http://localhost:8000` (configurado no `vite.config.js`).
- Em producao, o backend serve os arquivos estaticos do frontend (buildado em `frontend/dist/`), entao so o backend precisa rodar.

## Riscos

- Nunca commitar `backend/gestao.db`, `backup.env`, arquivos `.xlsx`, ou a pasta `backups/`.
- Nao alterar `SECRET_KEY` em producao sem planejamento — invalidara todos os tokens JWT existentes.
- O Render free tier hiberna apos inatividade; a primeira requisicao apos hibernacao pode demorar ~30s para responder (cold start).
- O banco local e recriado por migrations quando apagado; os dados nao sobrevivem.
- Scripts `.bat` e `.ps1` tem caminhos absolutos da maquina do autor (`C:\Python314\`, `C:\Users\fsbor\`). Nao funcionam em outras maquinas sem ajuste.
