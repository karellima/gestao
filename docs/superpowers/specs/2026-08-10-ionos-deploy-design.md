# Deploy do Sistema de Gestão na IONOS

Status: APPROVED FOR IMPLEMENTATION

## Objetivo

Preparar a execução do Sistema de Gestão no servidor IONOS do Karel, substituindo o
deploy transitório no Render como referência operacional. A preparação deve definir
a imagem da aplicação, o banco persistente, a publicação da imagem, o procedimento
de deploy autorizado e o backup diário, sem alterar o servidor de produção nesta
etapa.

## Arquitetura

- Uma imagem Docker multi-stage compila o frontend com Node e executa o FastAPI em
  uma imagem Python enxuta. O FastAPI continua servindo `frontend/dist`.
- O Compose de produção mantém a aplicação e um PostgreSQL em serviços separados.
  O banco usa volume Docker nomeado e não expõe a porta para a internet.
- Variáveis e segredos ficam em `.env.ionos` no servidor, fora do Git. O Compose
  recebe uma `DATABASE_URL` explícita para evitar problemas de escaping de senhas.
- O workflow do GitHub Actions constrói e publica tags SHA e `main` no GHCR. Ele não
  executa SSH nem atualiza produção automaticamente.
- O script de deploy é seguro por padrão: exibe a simulação. A aplicação exige a
  opção explícita `--apply`, faz `git pull --ff-only`, atualiza a imagem e verifica
  o endpoint de saúde no host.
- Um script de backup executado por systemd roda `pg_dump -Fc` dentro do container,
  grava atomicamente no host, gera SHA-256 e remove arquivos fora da retenção.

## Fluxos operacionais

1. Bootstrap: instalar Docker/Compose, clonar o repositório, criar `.env.ionos`,
   autenticar o Docker no GHCR e instalar o timer systemd.
2. Publicação: após autorização explícita, executar a simulação e depois `--apply`.
   O Render não faz parte desse fluxo.
3. Restore: parar a aplicação, restaurar um dump selecionado com `pg_restore`,
   iniciar a aplicação e verificar `/api/health`.
4. Rollback: escolher uma tag SHA anterior em `APP_IMAGE`, executar novamente o
   deploy autorizado e confirmar o healthcheck.

## Segurança e limites

- Nenhum segredo será versionado, impresso pelo script ou colocado no workflow.
- O PostgreSQL só é acessível na rede interna do Compose.
- Deploy e restore são operações destrutivas/externas e exigem uma confirmação
  explícita; esta tarefa não os executa.
- A migração de schema permanece compatível com o trabalho de migrações da onda 4:
  quando a árvore Alembic estiver disponível, o entrypoint executará `upgrade head`
  antes de iniciar a aplicação.

## Verificação

- `docker build` deve concluir sem incluir `.env`, bancos ou artefatos locais.
- O workflow deve conseguir construir a imagem e publicar no GHCR em `main`.
- O Compose deve reportar banco saudável e app saudável.
- O backup deve produzir dump e checksum, e a documentação deve conter comandos
  de listagem, restore e rollback.

## Decisões

- “Sem publicar produção nesta etapa”: a preparação não abre SSH, não executa
  Compose no servidor e não muda DNS.
- “Imagem no GHCR, pipeline sem deploy automático”: publicar a imagem é separado
  do ato autorizado de atualizar o servidor.
- “PostgreSQL em volume Docker”: os dados deixam de depender do banco transitório
  do Render, e o backup do host fornece recuperação independente.
