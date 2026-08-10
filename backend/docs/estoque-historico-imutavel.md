# Histórico de estoque imutável

## A regra

Movimentação de estoque gravada é fato consumado. Nada a apaga e nada a
reescreve — nem o usuário, nem o reparo, nem o boot da aplicação.

Erro se corrige por **compensação**: grava-se a movimentação inversa, que
aponta para a original em `compensates_movement_id`. As duas ficam no extrato,
o saldo fecha certo, e continua sendo possível responder *o que foi lançado
errado, quando, e quem corrigiu*.

`products.current_stock` é **cache derivado**, não fonte da verdade. A verdade
é a soma das movimentações. Recalcular o cache é inócuo; apagar movimentação
para "acertar" o saldo, não.

## O que mudou

Até esta alteração, todo import de `app/main.py` — ou seja, todo deploy e todo
worker do uvicorn — apagava as saídas de requisições ainda não recebidas e
reescrevia o `current_stock` de todos os produtos. Um conserto pontual de dados
legados tinha virado rotina permanente, sem registro de quem/quando e sem
ninguém ter pedido.

O boot deixou de mexer em dados. Depois, deixou também de mexer em schema: hoje
não aplica DDL nenhuma, e a coluna `compensates_movement_id` usada aqui é criada
por migration (`9e3f6a2c5b74`), não pela subida do app — ver
[migrations.md](migrations.md).

## O comando de reparo

Simula por padrão. Só grava com `--apply`.

```bash
cd backend
python -m app.cli.repair_stock            # simula e imprime o relatório
python -m app.cli.repair_stock --apply    # aplica
python -m app.cli.repair_stock --json     # relatório em JSON, para arquivar
```

Flags: `--user-id` registra o responsável nas compensações; `--skip-orphans` e
`--skip-resync` desligam cada metade do reparo.

Mesma operação por HTTP, restrita a admin (útil no Render, onde shell é
incômodo):

```
POST /api/stock/repair
{ "dry_run": true, "compensate_orphans": true, "resync_cache": true }
```

O reparo faz duas coisas, de naturezas diferentes:

| | o que é | como corrige |
|---|---|---|
| Saídas de requisições nunca recebidas | histórico | grava a compensação (`source="reparo"`) |
| `current_stock` divergente do histórico | cache | reescreve a partir da soma das movimentações |

É idempotente: rodar duas vezes não duplica compensação — uma movimentação já
estornada deixa de ser considerada órfã.

## Depois de subir esta versão

O boot deixou de re-sincronizar o `current_stock` sozinho. Se a base já vinha
dependendo disso, **rode o reparo uma vez**, em dry-run primeiro:

```bash
python -m app.cli.repair_stock          # confira o relatório
python -m app.cli.repair_stock --apply
```

## Editar e excluir movimentação

As rotas continuam as mesmas, por compatibilidade com o frontend, mas nenhuma
delas destrói nada:

- `DELETE /api/stock/movements/{id}` → grava o estorno. A linha original fica.
- `PUT /api/stock/movements/{id}` → grava o estorno **e** o lançamento
  corrigido. Ficam três linhas no extrato; a resposta é o lançamento novo.

Recusadas com 400: movimentação gerada por requisição, estorno, e movimentação
que já foi estornada (nesse caso, corrija o lançamento que a substituiu).

## Testes

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest
```

`tests/test_boot_nao_altera_historico.py` é a regressão do ticket: sobe o app
num processo separado, com uma requisição não recebida e um `current_stock`
propositalmente incoerente, e confere que o boot não tocou em nenhum dos dois.
