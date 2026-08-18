# Revisão rápida

Use esta lista antes de abrir ou aprovar um PR. Cada resposta deve ser **sim**;
se for **não**, corrija ou registre o bloqueio antes de seguir. Ela complementa
`quality/review.md` e não substitui a leitura do diff.

1. **O diff contém somente arquivos do objetivo?**
   ```bash
   git diff --name-only <ponto-inicial>...HEAD
   ```

2. **Nenhum segredo, banco, planilha ou backup foi incluído?**
   ```bash
   git diff --cached --name-only | rg '(^|/)(\.env|.*\.db$|.*\.xlsx$|backups/)'
   ```
   O comando deve não retornar linhas.

3. **Todo arquivo novo permanece com no máximo 300 linhas?**
   ```bash
   git diff --numstat <ponto-inicial>...HEAD
   ```
   Confirme as linhas adicionadas dos arquivos novos contra `quality/baseline.json`.

4. **Mudança de model veio acompanhada de migration?**
   ```bash
   git diff --name-only <ponto-inicial>...HEAD | rg 'backend/app/models|backend/alembic/versions'
   ```
   Se houver model no resultado, deve haver migration correspondente.

5. **Todo endpoint novo tem autenticação e guard de módulo?**
   ```bash
   rg -n 'get_current_user|require_module|require_any_module' backend/app/routers
   ```
   Confira o router tocado; esconder um item no menu não conta como autorização.

6. **O código não apagou nem reescreveu `stock_movements`?**
   ```bash
   git diff <ponto-inicial>...HEAD -- backend | rg 'delete\(|StockMovement|stock_movements'
   ```
   Qualquer correção de estoque deve criar compensação e preservar o ledger.

7. **Não há supressões novas que escondam defeitos?**
   ```bash
   git diff <ponto-inicial>...HEAD | rg 'noqa|eslint-disable|type: ignore|pytest\.skip'
   ```
   Cada ocorrência precisa ser intencional, mínima e explicada no diff.

8. **Há teste para o comportamento alterado, e E2E quando a tela mudou?**
   ```bash
   cd frontend && npm run test:run
   cd frontend && npm run test:e2e
   ```
   O build sozinho não responde esta pergunta.

9. **A catraca e as suítes obrigatórias estão verdes?**
   ```bash
   cd backend && .venv/bin/python -m pytest tests/
   cd frontend && npm run build
   python3 quality/gate.py
   ```

10. **A baseline ficou intacta fora da tarefa 5.1 e não houve deploy?**
    ```bash
    git diff <ponto-inicial>...HEAD -- quality/baseline.json
    git log --oneline <ponto-inicial>..HEAD
    ```
    O primeiro comando deve não retornar linhas; o segundo não deve conter
    deploy, infraestrutura ou publicação não autorizada.
