# Receita: adicionar uma tela

## Quando usar esta receita

Use quando uma funcionalidade precisa de uma página React protegida, acessível
por rota e visível no menu conforme a permissão do módulo.

## Os arquivos que você vai tocar

- `frontend/src/pages/<Tela>.jsx` ou `frontend/src/pages/<tela>/index.jsx`
- `frontend/src/App.jsx`
- `frontend/src/components/navegacao/menu-secoes.js`
- `frontend/src/services/api.js` somente se faltar uma capacidade comum de API
- `frontend/src/test/<Tela>.test.jsx` e/ou `frontend/e2e/<fluxo>.spec.js`

Não coloque uma página nova diretamente em `index.html` nem chame `fetch` sem o
cliente compartilhado.

## Passo a passo

1. Crie a página como um componente pequeno. A tela de Contas segue o formato
   usado no projeto:

   ```jsx
   import api from '../../services/api';

   export default function Accounts() {
     const [accounts, setAccounts] = useState([]);
     const load = useCallback(() => {
       api.get('/accounts/').then(res => setAccounts(res.data)).catch(() => {});
     }, []);
   ```

   Separe transformações de payload em `*-form.js` quando ficarem maiores que
   o componente. Use os elementos e classes existentes para manter foco,
   labels e responsividade.

2. Use `services/api.js` para todas as chamadas. Para operações que falham,
   use o contexto criado na Fase 2:

   ```jsx
   import { useNotificacao } from '../contexts/NotificacaoContext';

   const { notificar } = useNotificacao();

   try {
     await api.post('/accounts/', toPayload(form));
   } catch (err) {
     notificar.erro(err.response?.data?.detail || 'Erro ao salvar conta');
   }
   ```

   Validação do formulário é `notificar.aviso()`, confirmação de sucesso é
   `notificar.sucesso()` e erros de API são `notificar.erro()`. Não use
   `alert()`/`confirm()` diretamente; confirmações legadas passam por
   `utils/confirmar.js`.

3. Importe a página e adicione a rota em `frontend/src/App.jsx`, dentro de
   `PrivateRoute` e `Layout`, como as rotas atuais:

   ```jsx
   import Accounts from './pages/Accounts';

   <Route path="/accounts" element={<Accounts />} />
   ```

   A rota precisa permanecer protegida pelo `PrivateRoute`; uma rota pública
   acidental é falha de autorização, não apenas problema visual.

4. Adicione o item em `frontend/src/components/navegacao/menu-secoes.js`,
   usando o mesmo `path` da rota e o módulo que será checado:

   ```js
   { path: '/accounts', label: 'Contas/Cartões', icon: CreditCard },
   ```

   O `MODULE_MAP` e a ordem padrão em
   `frontend/src/components/navegacao/menu-secoes.js` precisam reconhecer
   o caminho. Se o módulo já existir, apenas reutilize o mapeamento; não crie
   uma segunda chave para a mesma permissão.

5. Escreva o teste de componente para estados importantes e um E2E para o
   fluxo que cruza a API. Os testes de menu em
   `frontend/src/test/permissoesDoMenu.test.js` mostram a fronteira de
   permissão; um E2E começa pela tela de login e usa seletores acessíveis:

   ```js
   await page.goto('/accounts');
   await expect(page.getByRole('heading', { name: 'Contas e Cartões de Crédito' })).toBeVisible();
   ```

   Intercepte serviços externos (como `brasilapi.com.br`) com `page.route()`;
   não faça o teste depender da internet.

## Como verificar que deu certo

Na raiz, rode na ordem:

```bash
cd frontend && npm run test:run
cd frontend && npm run build
cd backend && .venv/bin/python -m pytest tests/
python3 quality/gate.py
cd frontend && npm run test:e2e
```

Confirme manualmente a rota com uma permissão de visualização e outra de
edição. A tela deve existir sem conceder ações de escrita a quem só pode ver.

## O que nunca fazer nesta receita

- Nunca registrar a rota fora de `PrivateRoute`.
- Nunca esconder autorização apenas no menu; o backend também precisa de guard.
- Nunca chamar `fetch`, `alert` ou `window.confirm` diretamente na tela.
- Nunca considerar `npm run build` prova de interação.
- Nunca depender de API externa ao vivo nos E2E.
