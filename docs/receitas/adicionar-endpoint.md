# Receita: adicionar um endpoint

## Quando usar esta receita

Use quando uma capacidade nova precisa de uma operação HTTP autorizada e
testável, sem colocar regra de negócio dentro do router.

## Os arquivos que você vai tocar

- `backend/app/routers/<dominio>.py`
- `backend/app/services/<dominio>.py`
- `backend/app/schemas/<dominio>.py` (se o payload ou resposta for novo)
- `backend/tests/test_<dominio>.py`
- `backend/app/main.py` somente se o router ainda não estiver incluído

## Passo a passo

1. Defina entrada e saída em `backend/app/schemas/<dominio>.py`. O endpoint de
   transferência usa um objeto de entrada explícito:

   ```python
   class StockTransferCreate(BaseModel):
       source_deposit_id: int
       destination_deposit_id: int
       transfer_type: str
       items: list[StockTransferItem]
   ```

2. Extraia a regra para um service. Em `backend/app/services/stock_ledger.py`,
   a operação recebe sessão, dados validados e o usuário, em vez de conhecer
   detalhes de HTTP:

   ```python
   def transfer_stock(db: Session, data: StockTransferCreate, user_id: int) -> dict:
       source = _get_deposit(db, data.source_deposit_id)
       destination = _get_deposit(db, data.destination_deposit_id)
       # valida, grava movimentos e recalcula o estoque dentro da transação
   ```

   Coloque nele as validações de domínio, locks e commit. O service não deve
   importar `Request`, `HTTPException` ou depender do frontend.

3. Faça o router apenas adaptar HTTP para o service. O padrão atual em
   `backend/app/routers/stock/transfers.py` é:

   ```python
   @router.post("/transfer")
   def transfer_stock(
       data: StockTransferCreate,
       db: Session = Depends(get_db),
       current_user: User = Depends(get_current_user),
       _=Depends(require_module("stock_movements", "edit")),
   ):
       if not is_admin_user(db, current_user):
           allowed = user_deposit_ids(current_user)
           if data.source_deposit_id not in allowed or data.destination_deposit_id not in allowed:
               raise HTTPException(403, "Sem acesso a este depósito")
       return execute_transfer(db, data, current_user.id)
   ```

   **Endpoint sem guard é bug.** Escolha o módulo e nível (`view`/`edit`) que
   correspondem à ação e deixe `get_current_user` no endpoint. Não confie em
   esconder o botão no frontend como autorização.

4. Inclua o router em `backend/app/main.py` se necessário. Os routers são
   montados explicitamente com `app.include_router(...)`; não crie uma segunda
   forma de descoberta automática.

5. Escreva o teste pela fronteira HTTP. O conjunto de estoque já cobre o
   comportamento e as falhas de domínio:

   ```python
   response = client.post(
       "/api/stock/transfer",
       json=payload,
       headers=auth_headers,
   )
   assert response.status_code == 200
   ```

   Tenha pelo menos um caso autorizado, um sem permissão (`403`) e um caso de
   regra de negócio rejeitado. Para autorização por depósitos, use também um
   usuário limitado, como em `backend/tests/test_deposit_scope.py`.

## Como verificar que deu certo

Na raiz, rode na ordem:

```bash
cd backend && .venv/bin/python -m pytest tests/test_<dominio>.py
cd backend && .venv/bin/python -m pytest tests/
cd frontend && npm run test:run
cd frontend && npm run build
python3 quality/gate.py
```

Confira ainda `/docs` ou o OpenAPI gerado: o caminho deve existir, exigir
autenticação e declarar o schema de resposta quando houver resposta JSON.

## O que nunca fazer nesta receita

- Nunca criar endpoint sem `get_current_user` e `require_module`.
- Nunca confiar em permissão do frontend como controle de acesso.
- Nunca colocar consulta, lock ou regra de estoque no router.
- Nunca retornar `dict` sem schema quando o formato é contrato da API.
- Nunca apagar movimento de estoque para “desfazer” uma operação; use compensação.
