# Receita: corrigir um bug

## Quando usar esta receita

Use quando um comportamento existente está errado e a correção precisa ficar protegida contra regressão.

## Os arquivos que você vai tocar

- `backend/tests/test_<dominio>.py` ou `frontend/src/test/<Tela>.test.jsx`
- `backend/app/services/<dominio>.py`, `backend/app/routers/<dominio>.py` ou o componente responsável
- `frontend/e2e/<fluxo>.spec.js` quando o bug atravessar a interface
- `docs/plano-maturidade-8.md` ou `docs/historico/` somente para registrar o trabalho, quando pedido

Não comece editando o código de produção sem antes localizar uma reprodução.

## Passo a passo

1. Descreva a reprodução mínima: entrada, estado inicial, chamada, resposta observada e resposta esperada. Rode primeiro o fluxo existente para confirmar que o problema é real:

   ```python
   response = client.post(
       "/api/requisicoes/1/receive",
       json={"items": [{"product_id": 1, "quantity": 2}]},
       headers=auth_headers,
   )
   ```

2. Escreva o teste que falha antes de corrigir o código. O teste de idempotência de recebimento em `backend/tests/test_requisicoes.py` deve conferir estoque e ledger, não só status HTTP:

   ```python
   movimentos_antes = db.query(StockMovement).count()
   primeira = client.put(url, json=payload, headers=auth_headers)
   segunda = client.put(url, json=payload, headers=auth_headers)
   assert primeira.status_code == 200
   assert segunda.status_code == 200
   assert db.query(StockMovement).count() == movimentos_antes + len(payload["items"])
   ```

   Se o bug for frontend, reproduza com Testing Library ou Playwright e faça a asserção sobre texto, ação ou navegação observável — não sobre função interna.

3. Corrija no menor ponto de domínio que explica a falha. Em `backend/app/services/requisition_workflow.py`, a proteção idempotente consulta a entrada existente antes de registrar outra:

   ```python
   existing_entrada = {
       movement.product_id
       for movement in db.query(StockMovement).filter(
           StockMovement.movement_type == "entrada",
           StockMovement.reason.like(f"Recebimento Requisição #{requisicao.id}:%"),
       ).all()
   }
   ```

   Preserve a transação e a invariável que o teste protege. Não masque o erro com `except Exception: pass` nem faça o teste esperar menos.

4. Rode novamente o teste específico e confirme que passa. Depois rode a suíte do domínio e a suíte completa. Se a correção mexer em estoque, confira quantidade calculada e linhas de `stock_movements`.

5. Faça a revisão da mudança procurando o caso vizinho: reexecução, item parcial, permissão de outro usuário, erro de rede, estado vazio e concorrência quando aplicável. Só depois registre o trabalho no plano/histórico.

## Regra especial de estoque

`stock_movements` é um ledger imutável. Se uma movimentação foi errada, **nunca apague nem reescreva a linha original**. Use o endpoint de compensação, que grava a inversa e preserva o histórico:

```python
@router.delete("/movements/{movement_id}")
def delete_movement(...):
    return compensate_movement(db, movement, current_user.id)
```

O nome HTTP antigo não muda a regra: a operação é um estorno. O teste deve conferir a linha original, a compensação e o saldo derivado.

## Como verificar que deu certo

Na raiz, rode na ordem:

```bash
cd backend && .venv/bin/python -m pytest tests/test_<dominio>.py
cd backend && .venv/bin/python -m pytest tests/
cd frontend && npm run test:run
cd frontend && npm run build
python3 quality/gate.py
cd frontend && npm run test:e2e
```

Leia a saída do primeiro teste como prova do bug corrigido e a saída da suíte como prova de não regressão. Compare também as métricas com `quality/baseline.json`; o gate não substitui a leitura do diff.

## O que nunca fazer nesta receita

- Nunca corrigir antes de obter uma reprodução ou um teste falho.
- Nunca apagar/reescrever `stock_movements` para corrigir estoque.
- Nunca aumentar timeout ou relaxar uma asserção para esconder uma corrida.
- Nunca mudar a baseline para fazer o gate passar.
- Nunca misturar refatoração não relacionada com a correção observada.
