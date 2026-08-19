# Operação na IONOS

Este é o runbook do deploy Docker do Sistema de Gestão no servidor IONOS. A
preparação destes arquivos não acessa o servidor, não altera DNS e não publica
produção; o deploy só deve ser feito depois de uma autorização explícita.

## Arquitetura

- GitHub Actions constrói `Dockerfile` e publica `ghcr.io/karellima/gestao` com as
  tags `main` e `sha-<commit>`.
- `docker-compose.ionos.yml` executa a imagem da aplicação e um PostgreSQL 16.
  O volume `postgres_data` é persistente; a porta do banco não é publicada.
- O FastAPI serve o frontend compilado na porta `8000` do container. No host
  IONOS ele fica disponível apenas no loopback pela porta definida em
  `APP_PORT` (`127.0.0.1:8001` neste servidor, pois a `8000` pertence ao
  Portainer).
- O serviço `app` também entra na rede Docker estável `gestao_proxy`, com o
  alias `gestao-app`. O Caddy do servidor deve entrar nessa rede e encaminhar
  `gestao.pazesousa.com.br` diretamente para `gestao-app:8000`.
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

Como o Caddy é compartilhado por outros sistemas neste servidor, conecte-o à
rede do Gestão e acrescente o bloco abaixo ao Caddyfile central:

```bash
docker network connect gestao_proxy caddy
```

```caddyfile
gestao.pazesousa.com.br {
    encode gzip
    reverse_proxy gestao-app:8000
}
```

Registre também `gestao.pazesousa.com.br` no DNS apontando para o IP público do
IONOS. Valide o Caddyfile antes de recarregá-lo. Para que a conexão sobreviva à
recriação do Caddy, declare `gestao_proxy` como rede externa no Compose que
gerencia o proxy.

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

## Fechar a origem com Cloudflare Tunnel

Enquanto o Gestão for atendido pelo Caddy, o servidor aceita conexão de entrada
em `:443` e qualquer um que descubra o IP da origem fala com a aplicação
passando por cima da Cloudflare. O túnel resolve isso invertendo o sentido: quem
abre a conexão é um container daqui, para fora. Não sobra IP para descobrir nem
porta para varrer.

Isto também é o que torna o `CF-Connecting-IP` confiável. O rate limit do login
chaveia por esse cabeçalho, e ele só vale alguma coisa se nada além do túnel
alcançar a aplicação.

### Por que não é Authenticated Origin Pulls

O AOP foi tentado antes e **não serve neste plano**. Certificado próprio
(zone-level ou per-hostname) é recurso de Business/Enterprise: o painel aceita o
upload e marca `Active`, mas a borda não apresenta o certificado, e a origem que
passar a exigi-lo recusa a própria Cloudflare. Foi exatamente o que aconteceu num
ensaio — o site respondeu `520` até o rollback.

Resta o AOP **Global**, que existe no plano Free mas usa um certificado
compartilhado entre todos os clientes da Cloudflare: garante que a requisição vem
da rede da Cloudflare, não que vem da *sua* zona. O túnel é gratuito e fecha de
verdade, então é o caminho escolhido.

### O desenho

O serviço `cloudflared` vive no próprio `docker-compose.ionos.yml`, no mesmo
padrão do túnel que já roda para o `logps` neste servidor
(`/home/karel/pazesousa/ops/production/compose.yaml`): imagem pinada por digest,
token em Docker secret lido de arquivo, `watchtower` desativado por rótulo.

Ele está atrás do profile `tunnel`. **Sem `--profile tunnel`, nada muda** — o
Compose sobe só `db` e `app`, e o Caddy continua atendendo. É isso que permite
provar o túnel antes de desligar o caminho antigo.

### 1. Criar o túnel na Cloudflare

Em Zero Trust → Networks → Tunnels, crie um túnel do tipo **Cloudflared** e copie
o token. Não configure o hostname público ainda.

### 2. Guardar o token no servidor

`/opt/gestao` pertence ao usuário da aplicação, então não precisa de `sudo`:

```bash
mkdir -p /opt/gestao/secrets && chmod 700 /opt/gestao/secrets
printf '%s' 'COLE_O_TOKEN_AQUI' > /opt/gestao/secrets/cloudflare_tunnel_token
chmod 600 /opt/gestao/secrets/cloudflare_tunnel_token
```

Use `printf`, não `echo`: o `echo` acrescenta uma quebra de linha ao token e o
`cloudflared` recusa a credencial sem dizer por quê.

O arquivo não é versionado. Confira que `secrets/` está coberto pelo
`.gitignore` antes de seguir.

### 3. Subir o túnel sem tocar no tráfego

```bash
cd /opt/gestao
docker compose --env-file .env.ionos -f docker-compose.ionos.yml --profile tunnel up -d cloudflared
docker compose --env-file .env.ionos -f docker-compose.ionos.yml ps cloudflared
```

Espere o estado ficar `healthy`. Se ficar reiniciando, o problema é o token — veja
`docker logs gestao-cloudflared-1`. **Nada mudou para quem usa o sistema:** o
domínio continua sendo servido pelo Caddy.

### 4. Provar o caminho inteiro num hostname de teste

Não aponte o domínio de produção para o túnel antes de saber que ele funciona. No
painel do túnel, crie um **public hostname** temporário:

- Subdomain: `gestao-tunnel`
- Domain: `pazesousa.com.br`
- Service: `HTTP` → `app:8000`

O destino é `app:8000`, o nome do serviço na rede interna do Compose — não
`gestao-app:8000`, que é o alias usado pelo Caddy na rede do proxy.

```bash
curl --fail --silent --show-error https://gestao-tunnel.pazesousa.com.br/api/health
```

Deve devolver `{"status":"ok",...}`. Abra o sistema nesse endereço e faça um
login real: é o teste que prova que o túnel serve o SPA e a API, não só o
healthcheck.

### 5. Cortar o domínio de produção para o túnel

Só depois do passo 4 passar. No mesmo painel, troque o public hostname de
`gestao-tunnel` para `gestao`. A Cloudflare reescreve o DNS sozinha, substituindo
o registro que apontava para o IP da origem.

```bash
curl --fail --silent --show-error https://gestao.pazesousa.com.br/api/health
```

Confirme login real e permissões administrativas antes de seguir para o passo 6.

**Rollback deste passo:** devolva o public hostname para `gestao-tunnel` e
recrie o registro DNS de `gestao` apontando para o IP da origem. O bloco do Caddy
ainda está lá, então o caminho antigo volta a funcionar sozinho.

### 6. Só então tirar o Gestão do Caddy

Este é o passo que fecha a origem, e o único irreversível sem edição manual.
Guarde a cópia antes:

```bash
cp ~/services/Caddyfile ~/services/Caddyfile.bak-pre-tunnel-$(date -u +%Y%m%dT%H%M%SZ)
```

Remova o bloco entre `# BEGIN gestao.pazesousa.com.br` e
`# END gestao.pazesousa.com.br`, e valide antes de recarregar:

```bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Tire também a publicação da porta no `docker-compose.ionos.yml` (`ports:
127.0.0.1:8001`) se não usar mais o acesso local, e a rede `proxy` do serviço
`app` — com o Caddy fora do caminho, nenhuma das duas tem função.

### 7. Verificação final

```bash
# deve responder 200
curl --fail --silent --show-error https://gestao.pazesousa.com.br/api/health

# deve falhar: nao ha mais nada atendendo o Gestao na origem
curl --max-time 15 --resolve gestao.pazesousa.com.br:443:IP_DA_ORIGEM \
  https://gestao.pazesousa.com.br/api/health
```

Confira também que os outros domínios do Caddy continuam respondendo, e que o
`logps` — que usa o próprio túnel — não foi afetado.


## Cabeçalhos de segurança

Hoje o sistema não devolve cabeçalho de segurança nenhum. Esta seção acrescenta
quatro ao bloco do Gestão. Como as outras mudanças de proxy, ela exige
autorização explícita e vale só para `gestao.pazesousa.com.br` — o Caddy é
compartilhado.

### Por que a CSP entra pela metade

Dos quatro, três são inertes: `nosniff`, `Referrer-Policy` e o HSTS não mudam
como a página é montada. O quarto, `Content-Security-Policy`, entra **só com a
diretiva `frame-ancestors`**.

Uma CSP completa (`script-src`, `style-src`, `default-src`) quebra estilo inline
de biblioteca num SPA Vite, e quebra numa tela específica, dias depois, longe de
quem mexeu. `frame-ancestors` sozinho não tem esse risco: ele não governa o que
a página carrega, só quem pode enquadrá-la. É a parte que resolve
*clickjacking* sem custo de investigação.

A CSP completa fica registrada como pendência, **sem data**, e exige passar pelo
ambiente de homologação com todas as telas exercitadas antes de ir para
produção. Não a acrescente junto com esta mudança.

### 1. Aplicar

Faça a cópia do Caddyfile antes de editar, como na seção anterior:

```bash
export CADDYFILE_BACKUP="${CADDYFILE}.before-gestao-headers.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$CADDYFILE" "$CADDYFILE_BACKUP"
```

Acrescente o bloco `header` ao site do Gestão. **Comece com `max-age` curto** —
o porquê está logo abaixo:

```caddyfile
gestao.pazesousa.com.br {
    encode gzip

    header {
        Strict-Transport-Security "max-age=300"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Content-Security-Policy "frame-ancestors 'none'"
    }

    reverse_proxy gestao-app:8000
}
```

```bash
docker exec "$CADDY_CONTAINER" caddy validate --config "$CADDYFILE"
docker exec "$CADDY_CONTAINER" caddy reload --config "$CADDYFILE"
```

### 2. O HSTS é o único que não tem rollback

Os outros três somem no reload seguinte. O HSTS não: o navegador **guarda** a
instrução por `max-age` segundos e recusa falar HTTP com o domínio durante todo
esse tempo, mesmo que você tire o cabeçalho do Caddy no minuto seguinte. Um
`max-age` de um ano aplicado por engano é um ano de domínio presos a HTTPS, e
não há o que editar no servidor para desfazer no navegador de quem já visitou.

Por isso a subida é em dois tempos: `max-age=300` primeiro, tudo verificado, e
só então o valor definitivo:

```caddyfile
Strict-Transport-Security "max-age=31536000; includeSubDomains"
```

Não use `preload`. Ele coloca o domínio numa lista embutida nos navegadores, de
onde sair leva meses e não depende de você.

### 3. Verificação

```bash
curl -sS -D - -o /dev/null https://gestao.pazesousa.com.br/api/health \
  | grep -iE 'strict-transport|content-type-options|referrer-policy|content-security'
```

Os quatro devem aparecer. Depois, no navegador e com o cache limpo:

- Abrir o sistema e **exercitar as telas de verdade** — login, estoque, vendas,
  financeiro, relatórios, precificação. `nosniff` só se manifesta em recurso
  servido com MIME errado, e isso aparece como arquivo que não carrega, não como
  erro na tela.
- Conferir o console do navegador: violação de CSP aparece lá, não no log do
  servidor.
- Confirmar que o PWA (`sw.js`) continua registrando.
- Tentar abrir o sistema dentro de um `<iframe>` em qualquer página e confirmar
  que não carrega — é o `frame-ancestors` funcionando.

Repita o `curl` público nos outros domínios do Caddy para confirmar que nenhum
deles passou a devolver estes cabeçalhos.

### 4. Rollback

```bash
cp "$CADDYFILE_BACKUP" "$CADDYFILE"
docker exec "$CADDY_CONTAINER" caddy validate --config "$CADDYFILE"
docker exec "$CADDY_CONTAINER" caddy reload --config "$CADDYFILE"
```

Vale o aviso da seção 2: isto devolve três dos quatro. O HSTS já entregue
continua valendo no navegador de quem visitou, até o `max-age` expirar — mais um
motivo para os 300 segundos iniciais.


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
