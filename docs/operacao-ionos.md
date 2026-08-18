# Operação na IONOS

Este é o runbook do deploy Docker do Sistema de Gestão no servidor IONOS. A
preparação destes arquivos não acessa o servidor, não altera DNS e não publica
produção; o deploy só deve ser feito depois de uma autorização explícita.

## Arquitetura

- GitHub Actions constrói `Dockerfile` e publica `ghcr.io/karellima/gestao` com as
  tags `main` e `sha-<commit>`.
- `docker-compose.ionos.yml` executa a imagem da aplicação e um PostgreSQL 16.
  O volume `postgres_data` é persistente; a porta do banco não é publicada.
- O FastAPI serve o frontend compilado e fica disponível no host em
  `127.0.0.1:8000`. O proxy HTTPS do servidor deve encaminhar o domínio para essa
  porta.
- O timer systemd chama `ops/backup.sh` diariamente, às 03:15 (com atraso aleatório
  de até 15 minutos), mantendo 14 dias por padrão.

## Ambiente de homologação — teste diário

O ambiente de homologação é onde acontece o teste do dia a dia. Ele usa a mesma
imagem da aplicação que está em produção, mas tem um banco PostgreSQL e um volume
próprios. Dados de produção nunca são usados como atalho: o banco é inicializado
com os dados de demonstração do seed e com um administrador de teste.

Prepare o arquivo de ambiente sem colocá-lo no Git:

```bash
cp .env.homologacao.example .env.homologacao
chmod 600 .env.homologacao
```

No `.env.homologacao`, fixe `APP_IMAGE` na mesma tag SHA imutável atualmente
publicada em produção e troque as senhas de exemplo. Suba e confira o ambiente:

```bash
docker compose --env-file .env.homologacao \
  -f docker-compose.homologacao.yml up -d
docker compose --env-file .env.homologacao \
  -f docker-compose.homologacao.yml ps
curl --fail http://127.0.0.1:8001/api/health
```

O acesso local fica em `http://127.0.0.1:8001`. Para desligar sem remover os
dados de homologação:

```bash
docker compose --env-file .env.homologacao \
  -f docker-compose.homologacao.yml stop
```

O volume `gestao_homologacao_postgres_data` é deliberadamente diferente de
`postgres_data`, usado pelo compose de produção. Nunca aponte este arquivo para
`.env.ionos`, para `DATABASE_URL` de produção ou para o domínio de produção.
Correções de fluxo e de estoque devem ser exercitadas aqui primeiro; o histórico
de `stock_movements` continua imutável também neste ambiente.

## Bootstrap no servidor

Assumindo `/opt/gestao` como diretório da aplicação:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
# Instale Docker Engine e o plugin Compose conforme a documentação da distribuição.
sudo git clone https://github.com/karellima/gestao /opt/gestao
cd /opt/gestao
sudo cp .env.ionos.example .env.ionos
sudo chmod 600 .env.ionos
```

Edite `.env.ionos` e substitua `POSTGRES_PASSWORD` e `SECRET_KEY` por valores
aleatórios. A senha deve aparecer também na `DATABASE_URL`; se tiver caracteres
reservados em uma URL, faça o percent-encoding. Gere uma chave, por exemplo:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Para imagem privada, autentique o Docker no GHCR usando um token de curta duração
com `read:packages`; não coloque o token em arquivos versionados:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u SEU_USUARIO --password-stdin
```

Instale e ative o backup:

```bash
sudo install -m 0750 ops/backup.sh /opt/gestao/ops/backup.sh
sudo install -m 0644 ops/systemd/gestao-backup.service /etc/systemd/system/
sudo install -m 0644 ops/systemd/gestao-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gestao-backup.timer
systemctl list-timers gestao-backup.timer
```

## Deploy autorizado

O script é simulação por padrão:

```bash
./ops/deploy-ionos.sh --sim --image ghcr.io/karellima/gestao:sha-abc1234
```

Depois de autorização explícita, aplique a mesma tag e confirme o healthcheck:

```bash
./ops/deploy-ionos.sh --apply --yes --image ghcr.io/karellima/gestao:sha-abc1234
curl --fail https://SEU-DOMINIO/api/health
```

O script exige que a cópia remota esteja limpa e atualiza com `git pull
--ff-only`. Ele faz `docker compose pull`, recria app/banco quando necessário e
aguarda `/api/health`. A resposta esperada contém `"status":"ok"`.

## Backup e restore

Verifique uma execução manual antes de confiar no timer:

```bash
sudo systemctl start gestao-backup.service
sudo journalctl -u gestao-backup.service -n 50 --no-pager
sudo sha256sum -c /var/backups/gestao/gestao-*.dump.sha256
```

O dump é criado com `pg_dump -Fc`, renomeado atomicamente e acompanhado de SHA-256.
Para restaurar, escolha um dump e confirme explicitamente; a operação substitui
objetos do banco:

```bash
sudo ops/restore.sh \
  --path /var/backups/gestao/gestao-20260810T031500Z.dump \
  --confirm
curl --fail http://127.0.0.1:8000/api/health
```

O script para apenas o app, restaura no PostgreSQL, inicia o app novamente e
aguarda o healthcheck. Dumps fora de `/var/backups/gestao` são recusados, salvo
quando `--allow-external-path` for informado intencionalmente.

## Rollback

As tags SHA são imutáveis no pipeline. Para voltar a uma versão anterior, primeiro
rode a simulação e depois o deploy autorizado com a tag conhecida:

```bash
./ops/deploy-ionos.sh --sim --image ghcr.io/karellima/gestao:sha-OLD1234
./ops/deploy-ionos.sh --apply --yes --image ghcr.io/karellima/gestao:sha-OLD1234
curl --fail https://SEU-DOMINIO/api/health
```

Se a versão anterior também exigir uma migração incompatível, restaure o dump
correspondente antes do rollback da imagem e confirme os dados manualmente.

## Diagnóstico rápido

```bash
cd /opt/gestao
docker compose --env-file .env.ionos -f docker-compose.ionos.yml ps
docker compose --env-file .env.ionos -f docker-compose.ionos.yml logs --tail=100 app
docker compose --env-file .env.ionos -f docker-compose.ionos.yml logs --tail=100 db
systemctl status gestao-backup.timer
```

Não usar o banco transitório do Render como destino operacional deste fluxo. A
configuração de produção deve ser validada no próprio IONOS após um deploy
autorizado, incluindo HTTPS, backup e restore de teste.
