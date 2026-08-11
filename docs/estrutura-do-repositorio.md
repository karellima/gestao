# Estrutura do repositório

A raiz é curta de propósito. Quem abre o projeto pela primeira vez — pessoa ou
agente — lê a raiz para entender o que o projeto é. Se ela tiver trinta
arquivos, não informa nada.

## A regra

**Arquivo na raiz precisa justificar a posição.** Só mora na raiz o que uma
ferramenta exige encontrar ali, ou o que é porta de entrada do projeto.

Hoje a raiz tem — e só deve ter:

| Arquivo | Por que está na raiz |
|---|---|
| `README.md` | Porta de entrada para humanos |
| `AGENTS.md` | Porta de entrada para agentes |
| `Dockerfile` | Convenção do `docker build` |
| `docker-compose.yml`, `docker-compose.ionos.yml` | Convenção do `docker compose` |
| `.gitignore`, `.dockerignore` | As ferramentas exigem na raiz |
| `.env.ionos.example` | Modelo do env de produção, lido pelo compose de produção |

Todo o resto vai para uma pasta:

| Pasta | O que vai nela |
|---|---|
| `backend/` | Aplicação FastAPI. Configuração própria (`ruff.toml`, `pytest.ini`, `alembic.ini`) fica aqui, não na raiz. |
| `frontend/` | Aplicação React. Idem para `vite.config.js`, `eslint.config.js`, `tailwind.config.js`. |
| `scripts/` | O que o **desenvolvedor** roda na máquina dele: setup e dev. |
| `ops/` | O que roda **no servidor**: deploy, backup, restore, entrypoint, units systemd. |
| `quality/` | Catraca de qualidade, baseline e rubrica de review. |
| `docs/` | Documentação do projeto. |
| `backend/docs/` | Documentação técnica que só faz sentido junto do código do backend: migrations, invariantes de estoque. |
| `.github/workflows/` | CI e build da imagem. |

### Dentro de `docs/`

| Pasta | O que vai nela |
|---|---|
| `docs/*.md` | Guias operacionais vivos: ambiente local, operação IONOS. |
| `docs/seguranca/` | Incidentes e procedimentos de segurança. Nomeie com a data: `assunto-AAAA-MM-DD.md`. |
| `docs/historico/` | Registro de um momento que já passou. Não são guias — ninguém deve seguir o que está ali como instrução. |

### Plano e spec gerados por agente

Algumas skills escrevem um design e um plano com checkboxes antes de codificar.
Esses arquivos servem enquanto o trabalho está em curso. Terminado o trabalho,
**o que vale é o código e o guia operacional**, não o plano.

Um plano com 18 caixas vazias para um trabalho já entregue não é registro
inofensivo: ele afirma que existe coisa pendente. Ou se marca como concluído e
se move para `docs/historico/`, ou não se versiona. Foi o que aconteceu com
`docs/superpowers/`, removido em 2026-08-10 — os planos do ambiente local e do
deploy IONOS estavam com todos os passos em aberto enquanto os doze artefatos
que eles mandavam construir já estavam no repositório e em uso.

## `scripts/` ou `ops/`?

A pergunta é **quem executa**, não o que o script faz. Backup existe nos dois
mundos e mesmo assim não é ambíguo: quem tira backup do banco de produção é o
servidor, então `ops/backup.sh`.

- Roda na máquina de quem desenvolve → `scripts/`
- Roda no servidor de produção → `ops/`

Script novo em `scripts/` nasce em par: `.sh` para macOS/Linux e `.ps1` para
Windows. Um sem o outro deixa metade de quem trabalha no projeto sem caminho.

## Caminho absoluto é proibido

Nenhum script versionado pode conter o caminho de uma máquina específica
(`C:\Users\alguem\`, `/Users/alguem/`, `C:\Python314\`). Use caminho relativo ao
repositório, ou variável de ambiente com valor padrão — é o que `ops/backup.sh`
faz com `GESTAO_DIR`.

Foi exatamente esse tipo de arquivo que encheu a raiz: scripts `.bat`, `.ps1` e
`.vbs` apontando para pastas da máquina do autor original, que nunca rodaram em
outro lugar e ficaram ocupando espaço na porta de entrada do projeto.

## Quando uma fase termina, o arquivo dela vai embora

Este projeto rodou no Render antes de migrar para servidor próprio na IONOS. Os
arquivos daquela fase — `render.yaml`, `Procfile`, `runtime.txt`,
`backend/start.sh` — sobreviveram à migração e continuaram sendo lidos como
verdade, inclusive por um README que apontava para um host que não era mais o
destino.

Arquivo de infraestrutura obsoleto não é inofensivo: ele é **documentação errada
com aparência de código**. Quando a fase acabar, apague. O histórico do git
preserva o que foi apagado:

```bash
git log --diff-filter=D --name-only -- render.yaml
```

## Antes de criar arquivo na raiz

1. Alguma ferramenta **exige** que esteja na raiz? Se sim, pode ficar.
2. É porta de entrada do projeto? Se sim, pode ficar.
3. Caso contrário: já existe pasta para isso? Use.
4. Não existe? Crie e registre aqui neste documento.
