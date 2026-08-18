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

## Fechar a origem com Authenticated Origin Pulls

Esta seção é um procedimento operacional separado do deploy da aplicação. Ela
exige autorização explícita do dono do sistema e deve ser executada somente
depois de um inventário do Caddy compartilhado.

### 1. Inventário antes da mudança

Não presuma o nome do container nem o caminho do Caddyfile. Identifique-os no
servidor e registre o resultado antes de editar qualquer configuração:

```bash
export CADDY_CONTAINER="nome-do-container-caddy"
export CADDYFILE="caminho-do-caddyfile-efetivo"

docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
docker inspect "$CADDY_CONTAINER" \
  --format '{{json .Mounts}} {{json .NetworkSettings.Networks}}'
docker exec "$CADDY_CONTAINER" caddy version
docker exec "$CADDY_CONTAINER" caddy adapt --config "$CADDYFILE" --pretty
```

Se o Caddy rodar diretamente no host, use os mesmos comandos sem `docker
exec`. Liste todos os sites no Caddyfile/adaptação e confirme, com o dono de
cada sistema, quais dependem de acesso direto à origem. A mudança abaixo deve
ficar exclusivamente no bloco `gestao.pazesousa.com.br`; não aplique
autenticação de cliente no bloco global nem nos demais sites.

Falta uma pergunta neste inventário, e é ela que decide se a mudança é segura:
**algum sistema deste servidor acessa a origem por IP com o `Host` sobrescrito?**
Monitoramento externo, healthcheck, cron interno e script de status costumam
fazer exatamente isso. Exigir certificado de cliente no bloco do Gestão liga o
`strict_sni_host` para o listener inteiro — o porquê está na seção 4 — e esses
acessos passam a receber `421`. Levante a lista agora; depois do reload você
descobre pelo sistema que parou.

### 2. Preparar o certificado do cliente

Use uma CA privada e um certificado de cliente com uso `clientAuth`. A chave
privada da CA e a chave privada do cliente ficam fora do repositório e não são
copiadas para a origem. Um exemplo de preparação em uma máquina administrativa
é:

```bash
umask 077
export AOP_WORKDIR="$(mktemp -d)"

openssl genrsa -out "$AOP_WORKDIR/gestao-aop-ca.key" 4096
openssl req -x509 -new -nodes \
  -key "$AOP_WORKDIR/gestao-aop-ca.key" \
  -sha256 -days 3650 \
  -subj '/CN=Gestao Cloudflare AOP CA' \
  -out "$AOP_WORKDIR/gestao-aop-ca.crt"

openssl genrsa -out "$AOP_WORKDIR/cloudflare-gestao-aop.key" 2048
openssl req -new \
  -key "$AOP_WORKDIR/cloudflare-gestao-aop.key" \
  -subj '/CN=gestao.pazesousa.com.br' \
  -out "$AOP_WORKDIR/cloudflare-gestao-aop.csr"

cat > "$AOP_WORKDIR/client-ext.cnf" <<'EOF'
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = clientAuth
EOF

openssl x509 -req \
  -in "$AOP_WORKDIR/cloudflare-gestao-aop.csr" \
  -CA "$AOP_WORKDIR/gestao-aop-ca.crt" \
  -CAkey "$AOP_WORKDIR/gestao-aop-ca.key" \
  -CAcreateserial -out "$AOP_WORKDIR/cloudflare-gestao-aop.crt" \
  -days 825 -sha256 -extfile "$AOP_WORKDIR/client-ext.cnf"
openssl x509 -in "$AOP_WORKDIR/cloudflare-gestao-aop.crt" -noout -purpose
```

No Cloudflare, carregue `cloudflare-gestao-aop.crt` e sua chave privada na
configuração de Authenticated Origin Pulls por hostname e associe o certificado
somente a `gestao.pazesousa.com.br`. Nunca coloque a chave privada em
`.env.ionos`, no Caddyfile ou em um commit. Copie apenas
`gestao-aop-ca.crt` para o volume/configuração de certificados que o Caddy já
usa e defina, no ambiente do serviço Caddy, `GESTAO_AOP_CA_FILE` apontando para
esse arquivo.

### 3. Ativar sem interromper o domínio público

Primeiro habilite o certificado por hostname no Cloudflare e confirme que o
domínio público ainda responde. Depois faça uma cópia do Caddyfile e acrescente
`tls` somente ao site do Gestão:

```bash
export CADDYFILE_BACKUP="${CADDYFILE}.before-gestao-aop.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$CADDYFILE" "$CADDYFILE_BACKUP"
```

```caddyfile
gestao.pazesousa.com.br {
    encode gzip

    tls {
        client_auth {
            mode require_and_verify
            trust_pool file {$GESTAO_AOP_CA_FILE}
        }
    }

    reverse_proxy gestao-app:8000
}
```

Valide a configuração efetiva antes de recarregar. Se o Caddy instalado não
aceitar a sintaxe acima, pare e consulte a versão instalada; não substitua por
uma configuração global nem recarregue uma adaptação não validada:

```bash
docker exec "$CADDY_CONTAINER" caddy validate --config "$CADDYFILE"
docker exec "$CADDY_CONTAINER" caddy reload --config "$CADDYFILE"
```

### 4. Verificação

Antes de testar, saiba o que os testes precisam procurar. O `strict_sni_host`
do Caddy é ligado sozinho quando há autenticação de cliente, e é uma opção **por
servidor**, não por site: ao exigir certificado no bloco do Gestão, todos os
sites que dividem o listener `:443` passam a exigir que o `Host` da requisição
bata com o `ServerName` do ClientHello, e respondem `421 Misdirected Request`
quando não bate. Está documentado em
<https://caddyserver.com/docs/caddyfile/options>.

Isso é o que fecha a origem de verdade — sem ele, bastaria abrir o TLS com o SNI
de outro site do servidor e mandar `Host: gestao.pazesousa.com.br` para desviar
do certificado. Mas o efeito não para no Gestão, e os dois `curl` abaixo não
pegam o estrago: eles vão pelo DNS normal, onde SNI e Host sempre coincidem.

Use um hostname no SNI ao testar o IP da origem. Um `Host` isolado não prova que
o bloco TLS correto foi selecionado:

```bash
export ORIGIN_IP="IP_PUBLICO_DA_ORIGEM"
curl --fail --silent --show-error \
  https://gestao.pazesousa.com.br/api/health

curl --resolve gestao.pazesousa.com.br:443:"$ORIGIN_IP" \
  --fail --silent --show-error \
  https://gestao.pazesousa.com.br/api/health
```

O primeiro comando deve devolver `200`. O segundo, sem certificado cliente,
deve falhar no handshake. Repita a verificação pública para todos os outros
domínios inventariados e abra o Gestão no navegador para confirmar que o login
continua funcionando através do Cloudflare.

Por último, procure `421` no log do Caddy — para todos os sites, não só para o
Gestão. Um `421` que não existia antes do reload é um cliente legítimo que
dependia de `Host` diferente do SNI, e ele é a razão de existir a pergunta da
seção 1:

```bash
docker logs --since 15m "$CADDY_CONTAINER" 2>&1 | grep -F '"status":421'
```

Saída vazia significa que nenhum sistema do servidor dependia desse
comportamento. Saída não vazia é rollback, não ajuste: volte pela seção 5 e
trate o cliente afetado antes de tentar de novo.

### 5. Rollback

Se a validação falhar, remova primeiro o `tls.client_auth` do bloco do Gestão,
restaure a cópia conferida e valide antes de recarregar:

```bash
cp "$CADDYFILE_BACKUP" "$CADDYFILE"
docker exec "$CADDY_CONTAINER" caddy validate --config "$CADDYFILE"
docker exec "$CADDY_CONTAINER" caddy reload --config "$CADDYFILE"
```

Somente depois que o tráfego público estiver normal, desabilite o certificado
por hostname no Cloudflare. Não restaure o Caddyfile inteiro de outro sistema e
não remova autenticação dos demais sites. A tarefa seguinte, rate limit do
login, depende deste fechamento: sem ele, qualquer cliente que alcance a
origem poderia forjar `CF-Connecting-IP` e escolher um novo balde a cada
tentativa.

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
