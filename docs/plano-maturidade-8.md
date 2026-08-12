# Plano de execução — maturidade 5 → 8

Este plano existe para levar o repositório do estado de hoje até o ponto em que
**uma pessoa sem experiência em programação, apoiada por um modelo de IA fraco,
consiga evoluir o sistema sem quebrá-lo.**

Quem executa é um agente (Codex). Quem aprova é o dono do sistema.

> **Ao terminar:** marque todos os itens como concluídos e mova este arquivo para
> `docs/historico/`. Plano com caixa vazia para trabalho já entregue é ruído que
> mente sobre o estado do projeto — a regra está em
> [`docs/estrutura-do-repositorio.md`](estrutura-do-repositorio.md).

---

## 1. Ponto de partida (medido em 2026-08-11)

| Métrica | Hoje | Alvo | Onde é verificada |
|---|---:|---:|---|
| Maior arquivo (linhas) | 1380 | **≤ 300** | `quality/gate.py` |
| Arquivos acima de 300 linhas | 13 | **0** | `quality/gate.py` |
| Pior complexidade ciclomática | 27 | **≤ 15** | `quality/gate.py` |
| Funções acima de CCN 10 | 42 | **≤ 25** | `quality/gate.py` |
| Cobertura frontend | 10,3% | **≥ 20%** | `quality/gate.py` |
| Cobertura backend | 77,9% | **≥ 77,9%** | `quality/gate.py` |
| Duplicação | 6,23% | **≤ 6,23%** | `quality/gate.py` |
| Chamadas de `alert()` | 80 | **0** | `rg -o 'alert\(' frontend/src | wc -l` |
| Fluxos end-to-end cobertos | 0 | **6** | `frontend/e2e/` |
| Receitas de manutenção escritas | 0 | **4** | `docs/receitas/` |

O que já está bom e **não** faz parte deste plano: 184 testes backend verdes,
autorização em todos os 22 routers, schema só por migration, nenhum segredo
versionado, branch `main` protegida com `quality-gate` obrigatório, catraca
ativa no pre-commit (`core.hooksPath = quality/hooks`), backup diário.

---

## 2. Regras de execução — leia antes da primeira tarefa

1. **Uma tarefa = um branch = um PR.** Nunca juntar duas tarefas no mesmo commit.
   Se uma tarefa parecer grande demais, ela deve ser dividida, não acelerada.
2. **Ao fim de toda tarefa, os três comandos do [`AGENTS.md`](../AGENTS.md)
   precisam passar:**
   ```bash
   cd backend && .venv/bin/python -m pytest tests/
   ```
   ```bash
   cd frontend && npm run build
   ```
   ```bash
   python3 quality/gate.py
   ```
3. **`quality/baseline.json` só muda na tarefa 5.1.** Em nenhuma outra, em
   nenhuma circunstância. Baseline alterado no mesmo commit que o código anula a
   catraca — é o item 4 da rubrica de review.
4. **Refatoração não muda comportamento.** Nenhuma tarefa da Fase 1 pode alterar
   o que a tela faz, o que a API devolve ou o que o usuário vê. Se durante a
   quebra você encontrar um bug, **não conserte junto** — anote no PR e abra
   tarefa separada.
5. **Antes de abrir cada PR, releia [`quality/review.md`](../quality/review.md)**,
   em especial a seção 1 (modularização falsa). Quebrar arquivo grande é
   exatamente a operação que aquela seção existe para vigiar.
6. **Invariantes que nenhuma tarefa pode violar:** linha de `stock_movements`
   nunca é apagada nem reescrita; mudança de model exige migration; nada de
   `.env`, `.db` ou `.xlsx` no commit.
7. **Nada sobe para produção dentro deste plano.** A Fase 5 prepara homologação;
   publicar continua sendo passo manual com autorização explícita.
8. **A partir da tarefa 0.9, rode também `npm run test:e2e --prefix frontend`.**
   Os testes E2E são uma verificação separada do Vitest e do gate e precisam
   continuar verdes em todas as tarefas seguintes.

---

## 3. Ordem das fases e por quê

A rede vem antes do bisturi. A Fase 1 mexe em 4.700 linhas de código que hoje
não têm teste nenhum de fluxo — fazer isso sem os testes end-to-end da Fase 0
seria refatorar no escuro.

```text
Fase 0  Rede de proteção (E2E)           9 tarefas   ← primeiro, sem exceção
Fase 1  Quebra e simplificação          12 tarefas
Fase 2  Padrão único de erro             4 tarefas
Fase 3  Receituário                      6 tarefas
Fase 4  Homologação e observabilidade    3 tarefas
Fase 5  Fechamento                       2 tarefas
                                        ─────────
                                        36 tarefas
```

---

## FASE 0 — Rede de proteção

Objetivo: seis fluxos reais do sistema passam a ser verificados de ponta a ponta,
para que a Fase 1 possa mexer no código com prova de que nada quebrou.

### Tarefa 0.1 — Instalar o Playwright fora do alcance do gate

**Objetivo:** ter infraestrutura de teste end-to-end sem alterar nenhuma métrica
do gate.

**Onde:** `frontend/e2e/`, `frontend/playwright.config.js`, `frontend/package.json`.

**Passos:**
- `npm install -D @playwright/test --prefix frontend` e
  `cd frontend && npx playwright install chromium`.
- Configurar `playwright.config.js` com `webServer` apontando para o Vite em
  `127.0.0.1:5173` e `baseURL` correspondente.
- Adicionar os scripts `"test:e2e": "playwright test"` e
  `"test:e2e:ui": "playwright test --ui"` ao `package.json`.
- Criar `frontend/e2e/exemplo.spec.js` com um único teste que abre `/login` e
  confere que o campo de e-mail existe.
- Adicionar `frontend/playwright-report/` e `frontend/test-results/` ao `.gitignore`.

**Critério de aceite:**
- `npm run test:e2e --prefix frontend` passa.
- `python3 quality/gate.py` não mostra **nenhuma** métrica alterada.

**Risco a vigiar:** os specs precisam ficar em `frontend/e2e/`, **nunca** em
`frontend/src/`. O gate mede eslint, complexidade, duplicação, tamanho de
arquivo e cobertura Vitest sobre `frontend/src` — spec dentro de `src` polui
todas essas contas de uma vez.

---

### Tarefa 0.2 — Banco de teste determinístico para os fluxos E2E

**Objetivo:** todo spec começa do mesmo estado conhecido, sem depender do
`seed.py` de demonstração nem de dado deixado por rodada anterior.

**Onde:** `backend/seed_e2e.py` (novo), `frontend/e2e/fixtures/`.

**Passos:**
- Criar um seed dedicado que cria: 1 admin, 1 usuário comum com acesso a um
  depósito, 2 depósitos, 1 unidade, 1 categoria, 3 produtos, 1 conta financeira,
  1 tipo de pagamento, 1 contato. Valores fixos, sem `random`, sem `datetime.now()`
  em campo que o teste vá comparar.
- O seed deve ser **idempotente**: rodar duas vezes não duplica nada.
- Documentar em `frontend/e2e/README.md` como derrubar e recriar o banco de e2e.

**Critério de aceite:**
- Rodar o seed duas vezes seguidas produz o mesmo estado.
- Nenhum segredo no arquivo — credencial do admin de teste vem de variável de
  ambiente com padrão só de teste.

---

### Tarefas 0.3 a 0.8 — Os seis fluxos

Um spec por tarefa, um PR por tarefa. Cada spec cobre **o caminho feliz completo**,
da tela de login até a confirmação visível na interface, e faz pelo menos uma
asserção sobre dado que veio do backend (não só sobre a existência do botão).

| Tarefa | Fluxo | Arquivo | O que precisa ser provado |
|---|---|---|---|
| **0.3** | Login e permissão | `e2e/01-login.spec.js` | Admin entra e vê o menu completo; usuário comum entra e **não** vê os itens de administração; senha errada não entra |
| **0.4** | Cadastro de produto | `e2e/02-produto.spec.js` | Criar produto com unidade e categoria; ele aparece na listagem; editar o nome persiste após recarregar |
| **0.5** | Entrada de estoque | `e2e/03-estoque.spec.js` | Lançar entrada em um depósito; o saldo do produto sobe exatamente pela quantidade lançada; a movimentação aparece no histórico |
| **0.6** | Venda | `e2e/04-venda.spec.js` | Criar venda com 2 itens; o total bate com a soma; o estoque baixa; a venda aparece na listagem |
| **0.7** | Lançamento financeiro | `e2e/05-financeiro.spec.js` | Criar uma despesa a pagar; marcar como paga; o saldo da conta muda no valor certo |
| **0.8** | Requisição entre depósitos | `e2e/06-requisicao.spec.js` | Criar requisição; aprovar; atender; receber; o saldo sai do depósito de origem e entra no de destino |

**Critério de aceite de cada uma:**
- O spec passa três vezes seguidas sem alteração (não é *flaky*).
- O spec falha se você quebrar de propósito a regra que ele cobre — teste a
  falha antes de abrir o PR. Teste que nunca ficou vermelho não protege nada.
- Nenhuma espera por tempo fixo (`waitForTimeout`); use asserções que aguardam.

---

### Tarefa 0.9 — E2E no CI

**Objetivo:** os seis fluxos passam a rodar em todo PR.

**Onde:** `.github/workflows/ci.yml`.

**Passos:**
- Novo job `e2e`, com PostgreSQL como service, rodando seed + Playwright.
- Fazer upload do relatório e dos screenshots de falha como artefato.
- Depois do merge, adicionar `e2e` aos required status checks da `main`
  (passo manual do dono, no GitHub — registrar no PR que está pendente).

**Critério de aceite:** o job aparece verde no PR e vermelho quando um spec falha.

> **Marco 0 — a partir daqui a Fase 1 pode começar.** Não inicie a quebra dos
> arquivos com qualquer spec vermelho ou faltando.

---

## FASE 1 — Quebra e simplificação

Objetivo: nenhum arquivo do sistema acima de 300 linhas, e nenhuma função nova
acima de complexidade 10. Este é o bloqueio número um para o cenário de IA fraca:
modelo com janela curta não lê 1.380 linhas — lê um pedaço, edita achando que
entendeu, e quebra o resto.

**Regras que valem para todas as tarefas da Fase 1:**

- **Comportamento idêntico antes e depois.** Os specs da Fase 0 são a prova.
- **Cada arquivo novo tem que ser legível sozinho.** Se para entender um você
  precisa manter outro aberto ao lado, o corte foi no lugar errado.
- **Nome descreve uma coisa, nunca uma posição.** `relatorio-fluxo-caixa.jsx`
  sim; `FinancialReports2.jsx`, `stock_part2.py`, `helpers.js` não.
- **Nenhum arquivo `utils`/`helpers`/`common` novo.** É onde a modularização
  falsa esconde entulho.
- **Nenhuma função pode ser partida em `_parte1`/`_parte2` para baixar a
  complexidade.** Se uma função está acima de CCN 10, o caminho é extrair uma
  operação com nome e significado próprios, não fatiar por linha.
- **Se um pedaço extraído contém regra (cálculo, formatação, validação), ele
  ganha um teste Vitest na mesma tarefa.** É assim que a cobertura frontend sobe
  de 10% para 20% sem inventar teste vazio.
- **`import_cycles` tem que continuar 0.** Se A importa B e B precisa de A, o
  corte foi errado — desfaça em vez de resolver com import tardio.

---

### Tarefa 1.1 — `FinancialReports.jsx`: 1380 linhas

O arquivo já é seis relatórios independentes morando juntos. O corte é natural.

**Estrutura alvo — `frontend/src/pages/relatorios-financeiros/`:**

| Arquivo novo | Origem |
|---|---|
| `index.jsx` | o componente de página, só a navegação entre relatórios |
| `PayableReceivableReport.jsx` | linhas 99–200 |
| `CashFlowReport.jsx` | linhas 201–295 |
| `MonthlySummaryReport.jsx` | linhas 296–398 |
| `ByCategoryReport.jsx` | linhas 399–479 |
| `ByAccountReport.jsx` | linhas 480–556 |
| `ByContactReport.jsx` | linhas 557 em diante |
| `PrintAwareReport.jsx` | linhas 26–43 |
| `ReportActions.jsx` | linhas 44–58 |
| `ReportFilters.jsx` | linhas 59–98 |

**Ponto de atenção — duplicação:** os seis relatórios repetem o mesmo bloco de
estado de período (`startDate`/`endDate` com o mesmo cálculo inicial) e o mesmo
`useEffect` de carga. Extraia um hook `usePeriodoRelatorio` **só se os seis usos
forem realmente idênticos**. Se algum tiver comportamento diferente, deixe
separado: fundir coisas que só parecem iguais numa função com flag é trocar
duplicação por acoplamento, e o gate só enxerga o lado bom disso.

**Complexidade a resolver na mesma tarefa:** o bloco que o lizard registra como
`diffIcon` (linhas 934–1183) tem 234 linhas e CCN 16. Precisa ficar ≤ 10.

**Critério de aceite:** nenhum arquivo novo acima de 300 linhas; `largest_file_lines`
cai de 1380 para o próximo maior; os specs 0.3–0.8 continuam verdes; a tela de
relatórios financeiros funciona idêntica em navegação manual.

---

### Tarefa 1.2 — `Deposits.jsx`: 796 linhas

São quatro modais e uma página.

**Estrutura alvo — `frontend/src/pages/depositos/`:**

| Arquivo novo | Origem |
|---|---|
| `index.jsx` | a página e a listagem |
| `TransferModal.jsx` | linhas 17–185 |
| `AvariaModal.jsx` | linhas 186–364 |
| `MovementsModal.jsx` | linhas 365–519 |
| `StockBalanceModal.jsx` | linhas 520 em diante |

**Complexidade a resolver na mesma tarefa:** este arquivo carrega a **pior função
do repositório**.

| Função | Linhas | CCN |
|---|---|---:|
| `addItem` | 53–338 | **27** |
| `MovementsModal` | 340–482 | 19 |
| `Deposits` | 539–741 | 12 |

As três ficam ≤ 10 ao fim da tarefa. `addItem` aparece com 286 linhas de extensão
porque o lizard atribui a ela as funções aninhadas do `TransferModal` — o número
diz exatamente o problema: não dá para saber onde uma coisa termina e a outra
começa.

**Ponto de atenção:** `TransferModal` e `AvariaModal` compartilham quase toda a
lógica de itens (`balOf`, `addItem`, `changeQty`, `updateQty`, `removeItem`).
Aqui a extração de um hook `useItensDeMovimentacao` é legítima — é o mesmo
comportamento, não duas coisas parecidas. Ele deve ganhar teste Vitest próprio.

**Critério de aceite:** os specs 0.5 e 0.8 verdes; `complexity_max` cai de 27;
transferência e avaria funcionam idênticas em navegação manual.

---

### Tarefa 1.3 — `Requisicoes.jsx`: 627 linhas

Mais difícil que as anteriores: é um único componente com ~20 handlers, não
sub-componentes já separados. Corte por **etapa do fluxo**, não por tipo de função.

**Estrutura alvo — `frontend/src/pages/requisicoes/`:**

| Arquivo novo | Conteúdo |
|---|---|
| `index.jsx` | página, listagem e filtro de status |
| `RequisicaoForm.jsx` | criação e edição (`form`, `addItem`, `removeItem`, `updateItem`, `handleSubmit`) |
| `AtendimentoModal.jsx` | `openFulfill`, `handleFulfill`, `fulfillQty`, `parentBalance` |
| `RecebimentoModal.jsx` | `openReceive`, `handleReceive`, `receiveQty` |
| `impressao.jsx` | `handlePrint` (linhas 251–300) |
| `permissoes.js` | `canManage`, `canFulfill`, `canReceive` — **com teste Vitest** |
| `SearchInput.jsx` | linhas 24–50 |

`permissoes.js` é a peça mais valiosa desta tarefa: são três regras de autorização
hoje escondidas no meio da tela. Isoladas e testadas, viram algo que uma IA fraca
consegue ler e não quebrar.

**Complexidade a resolver na mesma tarefa:** dois blocos anônimos acima do teto —
linhas 280–288 (CCN 14) e 353–384 (CCN 14).

**Critério de aceite:** spec 0.8 verde; as três funções de permissão com teste
cobrindo admin, requisitante e usuário de depósito.

---

### Tarefa 1.4 — `backend/app/routers/stock.py`: 612 linhas

O corte aqui é em **pacote de router**, não em arquivos soltos que se importam.

**Estrutura alvo — `backend/app/routers/stock/`:**

| Arquivo novo | Endpoints |
|---|---|
| `__init__.py` | monta o `APIRouter` único e inclui os sub-routers |
| `movements.py` | `list_movements`, `create_movement`, `update_movement`, `delete_movement`, `_load_correctable_movement` |
| `balance.py` | `stock_balance`, `stock_movement_report` |
| `transfers.py` | `transfer_stock`, `transfer_report` |
| `avarias.py` | `register_avaria`, `list_avarias` |
| `repair.py` | `repair` |

**Regras específicas:**
- O prefixo e as tags da API **não mudam**. Nenhuma URL pode mudar — o frontend
  e os specs dependem delas.
- Router não importa router. O que for compartilhado (`_is_admin`, `parse_utc`)
  desce para `app/services/` ou `app/utils/`, nunca sobe de um router para outro.
- Regra de negócio que estiver dentro de handler deve descer para
  `app/services/stock_ledger.py`, que já existe. Handler traduz HTTP e delega.
- Quatro funções deste arquivo estão acima do teto e todas ficam ≤ 10 ao fim:
  `transfer_stock` (418–493, CCN 16), `stock_balance` (291–361, CCN 16),
  `stock_movement_report` (365–414, CCN 15) e `register_avaria` (497–560, CCN 14).

**Critério de aceite:** os 184 testes backend continuam verdes **sem alteração nos
testes**; `GET /openapi.json` lista exatamente os mesmos caminhos de antes
(compare antes/depois e anexe ao PR).

---

### Tarefas 1.5 a 1.9 — os arquivos restantes

Mesmas regras. Uma tarefa por linha da tabela.

| Tarefa | Arquivo | Linhas | Corte sugerido | Funções acima do teto |
|---|---|---:|---|---|
| **1.5** | `frontend/src/pages/StockReports.jsx` | 471 | um arquivo por relatório, espelhando a 1.1 | nenhuma |
| **1.6** | `backend/app/routers/reports.py` | 446 | pacote `routers/reports/` por assunto; cálculo desce para `services/` | `get_dashboard` (32–286, CCN 12) — 162 linhas num handler |
| **1.7** | `backend/app/routers/requisicoes.py` | 435 | handlers finos; o fluxo de estado vai para `services/requisition_workflow.py`, que já existe | `receive_requisicao` (329–409, CCN 20) |
| **1.8a** | `frontend/src/pages/Financial.jsx` | 404 | a tela financeira inteira, incluindo os dois componentes irmãos abaixo | `(anônima)` 177–191 **CCN 27**; `Financial` 55–395 CCN 25; `handleSubmit` 204–232 CCN 19; `handleEdit` 265–283 CCN 15 |
| **1.8b** | `frontend/src/pages/Pricing.jsx` | 380 | separar o cálculo de preço da tela — o cálculo ganha teste Vitest | `Pricing` (76–347, CCN 19) |
| **1.8c** | `frontend/src/pages/Contacts.jsx` | 364 | corte por seção do cadastro | nenhuma |
| **1.9** | `Products.jsx` (334) + `sales.py` (321) + `Accounts.jsx` (307) | — | os três já estão perto do limite; corte pequeno resolve | `Products` 13–310 CCN 15; `update_sale` 199–250 CCN 16; `handleEdit` (Accounts) 59–68 CCN 13 |

`Financial.jsx` é a tarefa mais pesada de toda a Fase 1: sozinha, concentra
quatro funções acima do teto, incluindo uma de CCN **27** em apenas 15 linhas —
que é o padrão mais difícil de todos para um modelo fraco, porque parece pequena
e não é.

---

### Tarefa 1.10 — Os complexos que não são grandes

Estes arquivos estão abaixo de 300 linhas, então a Fase 1 passaria por cima
deles — mas carregam funções acima do teto de complexidade. Sem esta tarefa, a
meta de `complexity_max ≤ 15` não é atingida.

| Arquivo | Função | Linhas | CCN |
|---|---|---|---:|
| `components/FinancialTransactionForm.jsx` | `FinancialTransactionForm` | 7–133 | **24** |
| `components/FinancialTransactionTable.jsx` | `(anônima)` | 53–108 | 21 |
| `pages/Dashboard.jsx` | `(anônima)` | 55–228 | 20 |
| `components/NavigationSidebar.jsx` | `NavigationSidebar` | 115–211 | 18 |
| `pages/Stock.jsx` | `Stock` | 10–247 | 14 |
| `pages/Users.jsx` | `Users` | 12–253 | 14 |
| `services/stock_repair.py` | `repair_stock` | 126–219 | 14 |

Os dois primeiros são da mesma tela do `Financial.jsx` — faça-os junto com a
1.8a, ou logo depois, para não reabrir o mesmo contexto duas vezes.

`services/stock_repair.py` merece cuidado extra: mexe no histórico de estoque.
Nenhuma alteração ali pode apagar ou reescrever linha de `stock_movements` —
leia [`backend/docs/estoque-historico-imutavel.md`](../backend/docs/estoque-historico-imutavel.md)
antes de tocar no arquivo.

> **Marco 1 — a catraca fecha a porta para sempre.** Terminada a Fase 1,
> `files_over_limit` chega a **0**. Como o gate é catraca, a partir desse momento
> **nenhum commit futuro consegue criar um arquivo acima de 300 linhas** — nem o
> seu amigo, nem a IA fraca, nem você num dia ruim. Essa é a barreira mais
> valiosa do plano inteiro, e ela só existe depois que o número chega a zero.

---

## FASE 2 — Padrão único de erro

Objetivo: acabar com os 80 `alert()` e fazer com que erro apareça de forma útil
para quem está testando e rastreável para quem vai corrigir.

Hoje o `frontend/src/services/api.js` só trata 401. Todo o resto vira
`alert('Erro ao salvar')`, que não diz nada — na fase de teste diária, isso
significa que o relato de bug que chega até você é literalmente "deu erro".

### Tarefa 2.1 — Criar o padrão

**Onde:** `frontend/src/services/api.js`, `frontend/src/components/Notificacao.jsx`,
`frontend/src/contexts/NotificacaoContext.jsx`.

**Passos:**
- Interceptor de resposta que extrai a mensagem real do FastAPI (`error.response.data.detail`),
  com fallback claro por faixa de status: 4xx → mensagem do servidor; 5xx →
  "Erro no servidor. Nada foi salvo." + código de referência; sem resposta →
  "Sem conexão com o servidor."
- Um contexto de notificação com `notificar.erro()`, `.sucesso()` e `.aviso()`.
- Componente visual que empilha e some sozinho, exceto erro (que exige fechar).

**Critério de aceite:** teste Vitest cobrindo as quatro faixas de erro do
interceptor. Nenhum `alert()` removido ainda — esta tarefa só cria o padrão.

---

### Tarefa 2.2 — Migrar as telas de maior volume

`Deposits` (14), `Contacts` (10), `Requisicoes` (9), `SaleDetail` (6).
Total: 39 dos 80. Um PR só, porque a substituição é mecânica.

### Tarefa 2.3 — Migrar as 18 telas restantes

Os 41 `alert()` que sobram.

**Critério de aceite de 2.2:** `rg -n 'alert\('` devolve zero nos quatro módulos
migrados nesta tarefa. **Critério de aceite de 2.3:**
`rg -n 'alert\(' frontend/src` devolve zero globalmente. Em ambas, os specs da
Fase 0 continuam verdes (ajuste os specs se dependiam do `dialog` do navegador).

### Tarefa 2.4 — Trancar a porta

**Onde:** `frontend/eslint.config.js`.

Adicionar `"no-alert": "error"`. Como `lint_eslint` está em 0 no baseline e a
catraca não deixa subir, **qualquer `alert()` novo passa a reprovar o commit
automaticamente.** Barreira permanente, custo de uma linha.

---

## FASE 3 — Receituário

Objetivo: dar ao seu amigo (e ao modelo fraco que o ajuda) um caminho de cópia.
`AGENTS.md` diz as regras e `quality/review.md` diz o que julgar — nenhum dos
dois responde "como eu faço". Modelo fraco não deriva padrão a partir de
princípio; ele copia exemplo.

**Formato obrigatório de cada receita** (o mesmo nos quatro arquivos):

1. **Quando usar esta receita** — em uma frase.
2. **Os arquivos que você vai tocar** — lista fechada, com caminho exato.
3. **Passo a passo numerado**, cada passo com o trecho de código real do repo
   servindo de modelo (não pseudocódigo).
4. **Como verificar que deu certo** — os comandos, na ordem.
5. **O que nunca fazer nesta receita** — a lista curta de erros previsíveis.

| Tarefa | Arquivo | Cobre |
|---|---|---|
| **3.1** | `docs/receitas/adicionar-campo.md` | Model → migration → schema → router → tela → teste. É a mudança mais comum e a que mais quebra por esquecer a migration |
| **3.2** | `docs/receitas/adicionar-endpoint.md` | Router fino + service + guard de autorização (`require_module`) + teste. Deixar explícito: **endpoint sem guard é bug** |
| **3.3** | `docs/receitas/adicionar-tela.md` | Página + rota + item de menu + chamada via `services/api.js` + notificação de erro no padrão da Fase 2 |
| **3.4** | `docs/receitas/corrigir-bug.md` | Reproduzir → escrever o teste que falha → corrigir → ver o teste passar. Inclui a regra de estoque: erro em movimentação se corrige por compensação, nunca apagando linha |

### Tarefa 3.5 — Checklist curto de revisão

**Onde:** `quality/revisao-rapida.md` (novo), referenciado de `AGENTS.md`.

`quality/review.md` é excelente e continua valendo — mas foi escrito para um
revisor competente, e no cenário real não vai existir um. Esta tarefa produz a
versão executável: **no máximo 10 perguntas de sim/não**, cada uma verificável
sem julgamento de arquitetura. Exemplos do tipo certo: "algum arquivo novo passou
de 300 linhas?", "o `baseline.json` mudou junto com código?", "apareceu `noqa` ou
`eslint-disable` no diff?", "endpoint novo tem guard?", "mudou model sem
migration?".

### Tarefa 3.6 — Atualizar as portas de entrada

`AGENTS.md` e `README.md` passam a apontar para `docs/receitas/` **antes** de
qualquer outra coisa, com uma linha do tipo: *"Vai mexer no sistema? Comece pela
receita da tarefa que você quer fazer."*

---

## FASE 4 — Homologação e observabilidade

Objetivo: a fase de teste diária acontece longe do dado bom, e o erro chega até
você sem depender de alguém descrever.

### Tarefa 4.1 — Ambiente de homologação

**Onde:** `docker-compose.homologacao.yml`, `.env.homologacao.example`,
seção nova em `docs/operacao-ionos.md`.

Mesma imagem de produção, banco separado, dados de demonstração. Deixar
inequívoco no documento: **é onde o teste do dia a dia acontece.** Sem isso, o
primeiro erro de fluxo mexe em estoque real — e movimentação de estoque é
imutável por design, então a correção é sempre por compensação, nunca por desfazer.

### Tarefa 4.2 — Ensaiar o restore

Backup que ninguém restaurou é backup hipotético. Hoje existe `ops/backup.sh`
rodando diariamente e `ops/restore.sh` que nunca foi exercitado.

**Passos:** pegar um backup real, restaurar em homologação com `ops/restore.sh --confirm`,
conferir que os dados voltaram, **cronometrar**, e registrar em
`docs/operacao-ionos.md`: o tempo que levou, os passos exatos e o que deu errado
no caminho. Se o script precisar de correção, ela faz parte desta tarefa.

### Tarefa 4.3 — Erro visível em produção

**Onde:** `backend/app/main.py`, `backend/app/logging_config.py`.

- Handler global de exceção que loga stack trace com um identificador curto de
  requisição, e devolve esse mesmo identificador ao frontend.
- O frontend (padrão da Fase 2) mostra o identificador na mensagem de erro 5xx.
- Assim o relato vira "deu erro `a3f9c1`" e você acha a ocorrência no log em
  segundos, em vez de reconstruir o que a pessoa estava fazendo.
- Endpoint `/health` que confirma banco acessível.

---

## FASE 5 — Fechamento

### Tarefa 5.1 — Congelar o novo baseline

`python3 quality/gate.py --write-baseline`, em **commit isolado**, com mensagem
explicando cada número que mudou. Este é o único commit do plano em que
`baseline.json` e nada mais são alterados.

Conferir contra a tabela da seção 1. Se alguma meta não foi atingida, ela vira
tarefa aberta — não se congela um número pior fingindo que era o alvo.

### Tarefa 5.2 — Encerrar o plano

- Marcar todos os itens deste documento como concluídos.
- Mover para `docs/historico/plano-maturidade-8.md`.
- Atualizar `README.md` na seção de qualidade com os números novos.

---

## Anexo — mapa de acompanhamento

| # | Tarefa | Estado |
|---|---|---|
| 0.1 | Playwright instalado fora do gate | ☑ |
| 0.2 | Seed determinístico de e2e | ☑ |
| 0.3 | E2E login e permissão | ☑ |
| 0.4 | E2E cadastro de produto | ☑ |
| 0.5 | E2E entrada de estoque | ☐ |
| 0.6 | E2E venda | ☐ |
| 0.7 | E2E lançamento financeiro | ☐ |
| 0.8 | E2E requisição entre depósitos | ☐ |
| 0.9 | E2E no CI | ☐ |
| 1.1 | `FinancialReports.jsx` (1380) | ☐ |
| 1.2 | `Deposits.jsx` (796) | ☐ |
| 1.3 | `Requisicoes.jsx` (627) | ☐ |
| 1.4 | `routers/stock.py` (612) | ☐ |
| 1.5 | `StockReports.jsx` (471) | ☐ |
| 1.6 | `routers/reports.py` (446) | ☐ |
| 1.7 | `routers/requisicoes.py` (435) | ☐ |
| 1.8a | `Financial.jsx` (404) — 4 funções acima do teto | ☐ |
| 1.8b | `Pricing.jsx` (380) | ☐ |
| 1.8c | `Contacts.jsx` (364) | ☐ |
| 1.9 | `Products.jsx` + `sales.py` + `Accounts.jsx` | ☐ |
| 1.10 | Complexos que não são grandes (7 arquivos) | ☐ |
| 2.1 | Padrão de notificação e erro | ☐ |
| 2.2 | Migrar as 4 telas de maior volume | ☐ |
| 2.3 | Migrar as 18 telas restantes | ☐ |
| 2.4 | `no-alert` no eslint | ☐ |
| 3.1 | Receita: adicionar campo | ☐ |
| 3.2 | Receita: adicionar endpoint | ☐ |
| 3.3 | Receita: adicionar tela | ☐ |
| 3.4 | Receita: corrigir bug | ☐ |
| 3.5 | Checklist curto de revisão | ☐ |
| 3.6 | `AGENTS.md` e `README.md` apontam para as receitas | ☐ |
| 4.1 | Ambiente de homologação | ☐ |
| 4.2 | Restore ensaiado e cronometrado | ☐ |
| 4.3 | Erro rastreável em produção | ☐ |
| 5.1 | Baseline congelado | ☐ |
| 5.2 | Plano encerrado e arquivado | ☐ |
