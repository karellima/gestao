# Migrations

## A regra

O app **não cria nem altera schema**. Subir o processo não emite DDL nenhuma.
O schema muda por migration, e só quando alguém manda:

```bash
cd backend
alembic upgrade head
```

Se o banco não estiver migrado, o app recusa subir com a instrução do que rodar
(`app/startup.py`) — em vez de morrer com um `no such table` no meio de um seed.

## Por que

`app/main.py` criava o schema inteiro no import, a partir dos models, e ainda
corrigia colunas com dois blocos de `ALTER` — um para SQLite, outro para
Postgres. Rodava a cada deploy e a cada worker do uvicorn. Consequências:

- o schema era o que os models dissessem no instante da subida — nada revisável
  em code review, nada reproduzível entre ambientes, nada reversível;
- dois workers subindo juntos aplicavam DDL concorrente no mesmo banco;
- uma correção pontual de dados legados virava rotina permanente.

## A cadeia

```
<base> -> 3f9bdb34aa4d  baseline: o schema inteiro, 26 tabelas, DDL explícita
       -> 7a1c4e9b2d18  reconciliação das correções que o boot aplicava
       -> 9e3f6a2c5b74  stock_movements.compensates_movement_id
```

**Uma raiz só.** Duas baselines com `down_revision = None` fariam
`alembic upgrade head` recusar a subir com *Multiple head revisions* — foi o que
aconteceu quando duas frentes escreveram baseline em paralelo.
`tests/test_migrations.py::test_existe_uma_unica_head` existe para isso.

A revisão `7a1c4e9b2d18` é no-op em banco novo (a baseline já criou tudo) e
corretiva em banco velho. Cada passo é guardado por "a coluna existe?", porque
ela precisa servir aos dois sem saber em qual está.

## Banco novo

```bash
cd backend && alembic upgrade head
```

Resultado idêntico aos models — garantido por
`test_banco_novo_sobe_ate_o_schema_dos_models`.

## Banco que já existia (produção)

Um banco que já rodava antes das migrations existirem já tem as tabelas. Rodar a
baseline nele **falha**: as tabelas já existem. O banco entra na cadeia sendo
*adotado* — marcado como já estando na baseline, sem executá-la:

```bash
cd backend
alembic stamp 3f9bdb34aa4d   # adota o schema atual como baseline
alembic upgrade head         # aplica só o que falta (reconciliação + coluna nova)
```

> **Este `stamp` é obrigatório antes do primeiro deploy desta versão.**
> Sem ele o `alembic upgrade head` do start falha e o deploy não sobe. É uma
> falha segura — o Render mantém a versão anterior no ar —, mas o deploy só
> passa depois do stamp. `test_stamp_nao_recria_tabela_existente` documenta
> exatamente esse modo de falha.

Para migrar um banco específico (um restore, uma homologação) sem mexer no
ambiente:

```bash
alembic -x db_url=postgresql://... upgrade head
```

## No deploy

As migrations rodam no **start**, não no build: o build não alcança o banco e
roda por artefato, não por release.

- `ops/entrypoint.sh`: `alembic upgrade head` antes do `uvicorn`, sob `set -e`.
  É o `ENTRYPOINT` da imagem Docker, então vale para qualquer ambiente que suba
  o container — inclusive o `docker-compose.ionos.yml` da produção.

Migration quebrada derruba o start, e um app nunca sobe apontando para um banco
em estado indefinido.

## Criar uma migration

```bash
cd backend
alembic revision --autogenerate -m "descricao curta"
```

Revise o arquivo gerado antes de commitar — autogenerate erra em rename de
coluna (vira drop + add, com perda de dados) e em mudança de tipo.

Cuidados que já custaram caro aqui, os dois no SQLite:

- `ADD COLUMN` com default não-constante (`CURRENT_TIMESTAMP`) é recusado:
  adicione a coluna sem default e faça `UPDATE` em seguida;
- `ADD COLUMN` com chave estrangeira é recusado: crie a FK só nos dialetos que
  aceitam, ou use batch mode.

## Testes

```bash
cd backend && .venv/bin/python -m pytest tests/test_migrations.py
```

Cobrem: raiz única, banco novo == models, adoção por stamp + reconciliação,
backfill de `source`, idempotência, e o boot não emitindo DDL (checado na árvore
sintática de `main.py`, não por grep — comentário não é código).
