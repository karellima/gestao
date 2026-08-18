# Receita: adicionar um campo

## Quando usar esta receita

Use quando uma informação nova precisa atravessar banco, API, interface e teste.

## Os arquivos que você vai tocar

- `backend/app/models/<dominio>.py`
- `backend/alembic/versions/<revision>_<descricao>.py` (novo)
- `backend/app/schemas/<dominio>.py`
- `backend/app/routers/<dominio>.py`
- `frontend/src/pages/<tela>/index.jsx` ou o componente que exibe o campo
- `backend/tests/test_<dominio>.py` (ou o teste de integração mais próximo)

Não crie migration dentro de `backend/app/` e não altere o banco pelo startup.

## Passo a passo

1. Comece pelo model. Em `backend/app/models/product.py`, os campos são
   declarados como colunas SQLAlchemy, por exemplo:

   ```python
   sku = Column(String(100), unique=True, nullable=True, index=True)
   ```

   Escolha nulabilidade, tipo, índice e valor padrão antes de escrever a tela.

2. Gere a migration a partir do model, com uma descrição que explique a
   mudança:

   ```bash
   cd backend
   .venv/bin/alembic revision --autogenerate -m "adiciona campo ao produto"
   .venv/bin/alembic upgrade head
   ```

   A migration gerada deve ter `upgrade()` e `downgrade()`. Confira o trecho
   real em `backend/alembic/versions/c6f4a8d2e1b0_unique_stock_compensation.py`:

   ```python
   def upgrade() -> None:
       op.create_unique_constraint(
           "uq_stock_movements_compensates_movement_id",
           "stock_movements",
           ["compensates_movement_id"],
       )
   ```

   Se o autogenerate produzir alteração que você não pediu, pare e revise a
   migration; não a aplique cegamente.

3. Exponha o campo no schema Pydantic. `backend/app/schemas/stock.py` usa o
   padrão de leitura do model assim:

   ```python
   class StockMovementResponse(BaseModel):
       id: int
       product_id: int
       created_at: datetime | None = None
       model_config = ConfigDict(from_attributes=True)
   ```

   Para entrada, use um schema separado (`Create`/`Update`) e valide limites
   com `Field`, como `quantity: float = Field(gt=0)`.

4. Faça o router devolver o schema, mantendo o router fino. Em
   `backend/app/routers/stock/movements.py`:

   ```python
   @router.post("/movements/", response_model=StockMovementResponse)
   def create_movement(
       movement: StockMovementCreate,
       db: Session = Depends(get_db),
       current_user: User = Depends(get_current_user),
       _=Depends(require_module("stock_movements", "edit")),
   ):
   ```

   O serviço continua responsável pela regra de negócio; o router não deve
   duplicar cálculo nem contornar a migration.

5. No frontend, adicione o controle ao estado e envie-o pelo objeto que já é
   usado pela tela. O formulário de produtos, por exemplo, recebe o estado e
   as ações como propriedades:

   ```jsx
   <ProdutoForm
     open={showModal}
     editingProduct={editingProduct}
     form={form}
     setForm={setForm}
   />
   ```

   Use `services/api.js` para a chamada, o padrão de erro da Fase 2 para falhas
   e `notificar.sucesso()` apenas depois da resposta ter sido persistida.

6. Escreva primeiro o caso que prova o campo no limite relevante. O padrão dos
   testes de produto em `backend/tests/test_product_sku.py` é fazer a chamada
   pela fronteira HTTP e conferir status e payload:

   ```python
   response = client.post("/api/products/", json=payload, headers=auth_headers)
   assert response.status_code == 201
   assert response.json()["sku"] == "SKU-001"
   ```

## Como verificar que deu certo

Execute, nesta ordem, a partir da raiz do repositório:

```bash
cd backend && .venv/bin/python -m pytest tests/
cd frontend && npm run test:run
cd frontend && npm run build
python3 quality/gate.py
```

Depois confira a migration em um banco vazio (`.venv/bin/alembic upgrade head`)
e em um banco existente. Se a tela mudou, rode também os specs E2E aplicáveis.

## O que nunca fazer nesta receita

- Nunca mudar model sem migration versionada e reversível.
- Nunca deixar o app criar ou alterar schema durante o boot.
- Nunca colocar segredo, `.db`, `.env` ou `.xlsx` no commit.
- Nunca confiar apenas no build: comportamento precisa de teste.
- Nunca apagar ou reescrever `stock_movements`; estoque é corrigido por compensação.
