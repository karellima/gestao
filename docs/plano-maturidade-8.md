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
Fase 0  Rede de proteção (E2E)          13 tarefas   ← primeiro, sem exceção
Fase 1  Quebra e simplificação          23 tarefas
Fase 2  Padrão único de erro             5 tarefas
Fase 3  Receituário                      6 tarefas
Fase 4  Homologação e observabilidade    3 tarefas
Fase 5  Fechamento                       2 tarefas
                                        ─────────
                                        52 tarefas
```

---

## FASE 0 — Rede de proteção

Objetivo: os fluxos reais do sistema passam a ser verificados de ponta a ponta,
para que a Fase 1 possa mexer no código com prova de que nada quebrou.

O desenho original elegeu seis fluxos, e são eles que definem o Marco 0. O sétimo
— movimentação entre depósitos, tarefa 0.11 — foi acrescentado durante a Fase 1,
quando a falta dele apareceu na prática. Se a Fase 1 revelar outro buraco desses,
o lugar de registrá-lo é aqui, não num comentário de PR.

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
| **0.3** ☑ | Login e permissão | `e2e/01-login.spec.js` | Admin entra e vê o menu completo; usuário comum entra e **não** vê os itens de administração; senha errada não entra |
| **0.4** ☑ | Cadastro de produto | `e2e/02-produto.spec.js` | Criar produto com unidade e categoria; ele aparece na listagem; editar o nome persiste após recarregar |
| **0.5** ☑ | Entrada de estoque | `e2e/03-estoque.spec.js` | Lançar entrada em um depósito; o saldo do produto sobe exatamente pela quantidade lançada; a movimentação aparece no histórico |
| **0.6** ☑ | Venda | `e2e/04-venda.spec.js` | Criar venda com 2 itens; o total bate com a soma; o estoque baixa; a venda aparece na listagem |
| **0.7** ☑ | Lançamento financeiro | `e2e/05-financeiro.spec.js` | Criar uma despesa a pagar; marcar como paga; o saldo da conta muda no valor certo |
| **0.8** ☑ | Requisição entre depósitos | `e2e/06-requisicao.spec.js` | Criar requisição; aprovar; atender; receber; o saldo sai do depósito de origem e entra no de destino |

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

**O que foi entregue além do texto acima** (PR #18): o job `backend-tests` passou
a exportar `POSTGRES_TEST_DATABASE_URL`. Os cinco testes de concorrência —
dois de pagamento financeiro (0.7) e três de venda e estoque (0.6) — eram
pulados em silêncio por falta dessa variável e agora rodam em todo PR. O pytest
do CI saiu de `203 passed, 5 skipped` para `208 passed, 0 skipped`.

**Proteção da `main`** — passo manual concluído em 2026-08-12. São obrigatórios
`quality-gate`, `e2e`, `backend-tests` e `frontend-build`, com `strict: true`.
Antes só `quality-gate` barrava merge, o que deixava passar PR com teste de
backend quebrado.

---

### Tarefa 0.10 ☑ — Suíte E2E repetível

Tarefa criada durante a execução, depois que a 1.1 revelou o problema. Concluída
no PR #21.

**O que estava errado:** rodar a suíte duas vezes seguidas contra o mesmo banco
degradava o resultado de 9/9 para 5/9. O CI não enxergava porque cria banco novo
a cada execução. Isso contrariava o critério da tarefa 0.2 — "todo spec começa do
mesmo estado conhecido" — e esvaziava o critério de aceite dos seis fluxos, que
exige passar três vezes seguidas.

**Causa:** o spec `02-produto` cria produto com SKU fixo, e `sku` tem constraint
`unique`. Na segunda rodada o POST colidia. Os demais specs acumulavam registros
e o `06-requisicao` movia estoque a cada execução.

**Solução:** `globalSetup` do Playwright recria o banco antes de toda rodada
(`backend/reset_e2e.py`, protegido por exigir `e2e` no nome do banco), roda as
migrations e o seed. `pool_pre_ping` no `database.py` faz o backend descartar
conexões invalidadas pelo reset.

> **Marco 0 — alcançado em 2026-08-12.** Os seis fluxos estão cobertos, rodam em
> todo PR, o job fica vermelho quando um spec quebra e a suíte é repetível sem
> preparação manual. A Fase 1 está liberada.

---

### Tarefa 0.11 ☑ — E2E de movimentação entre depósitos

Tarefa criada durante a execução, depois que a 1.2 revelou o buraco. **Ela não
reabre o Marco 0**: o Marco cobria os seis fluxos escolhidos no desenho original,
e todos os seis continuam cobertos e verdes. Este é um sétimo fluxo, que só ficou
visível quando alguém precisou da rede para refatorar a tela de depósitos e ela
não estava lá.

**O que está descoberto:** nenhum dos seis specs navega para `/depositos`. Os
specs de estoque e de venda usam o nome do depósito como dado de fixture, mas
ninguém abre a tela nem aciona os cinco botões dela — Abastecer, Devolver, Avaria,
Saldo e Movimentações. A tarefa 1.2 refatorou 796 linhas dessa tela sem prova de
fluxo, apoiada só em fidelidade textual verificada à mão.

**Por que isso é urgente e não pode esperar a Fase 2:** a tarefa **1.4 quebra
`backend/app/routers/stock.py`**, e quatro dos endpoints que ela move são
exatamente os que essa tela consome — `transfer_stock`, `register_avaria`,
`stock_balance` e `stock_movement_report`. Do lado do backend existe cobertura de
pytest para eles, então a 1.4 não está cega; o que não existe é prova de que a
tela continua conversando com eles. **Faça a 0.11 antes da 1.4.**

**Escopo do spec — `frontend/e2e/07-deposito.spec.js`:**

| Etapa | Verificação |
|---|---|
| Abrir `/depositos` | os depósitos do seed aparecem, o sub-depósito vem indentado |
| Abastecer | saldo sai do pai e entra no filho, nas duas leituras de `/stock/balance/` |
| Devolver | o saldo volta, e o total dos dois depósitos fecha igual ao inicial |
| Avaria | o saldo diminui e não reaparece em lugar nenhum |
| Saldo | o modal mostra o mesmo número que a API devolve |
| Movimentações | a lista traz os lançamentos criados acima, na ordem certa |

**Regras que valem, herdadas da Fase 0:**
- Ler o saldo pela API antes e depois, e comparar números — não conferir texto de
  tela, que muda de formatação.
- Nada de `waitForTimeout`: espere a resposta HTTP, como fazem os specs 04 e 06.
- Idempotente. A suíte tem que passar três vezes seguidas (tarefa 0.10).
- O spec entra no job `e2e` do CI automaticamente; nada a mudar no `ci.yml`.

**Critério de aceite:** o spec passa três vezes seguidas; quebrar de propósito uma
linha de `frontend/src/pages/depositos/` deixa o job `e2e` vermelho — anexe a
evidência no PR, como foi feito na 0.9.

**Concluída no PR #26 — e ela achou um defeito maior que ela mesma.**

Com o sétimo spec somado, a suíte passou a falhar de forma intermitente. Medido
três vezes em cada configuração: com 5 workers, 1 de 3 rodadas verde; com 1
worker, 3 de 3. A falha típica era de saldo, não de infraestrutura:

```text
06-requisicao.spec.js:152
expect(await readBalance(...)).toBe(initialSourceBalance)
Expected: 7   Received: 6
```

**Causa:** três specs disputam `Arroz E2E` no `Depósito Central E2E` ao mesmo
tempo, contra o banco único que a tarefa 0.2 estabeleceu — o 03 dá entrada de 7 e
assere o delta exato, o 06 move 5 entre os depósitos, e o 07 transfere 1 e dá
baixa de 1 por avaria. Cada um lê um saldo inicial e compara no fim; concorrentes,
um altera o que o outro já mediu.

Isso **já era frágil entre o 03 e o 06** desde a tarefa 0.8. O 07 foi o terceiro
concorrente e estourou a conta. O CI nunca viu porque o runner do GitHub tem 2
núcleos e o Playwright usa metade — 1 worker; uma máquina de 10 núcleos usa 5.

**Solução:** `workers: 1` no `playwright.config.js`, com o motivo comentado na
linha de cima. A suíte compartilha um banco por desenho — rodar arquivos em
paralelo contra ele é defeito de correção, não escolha de performance. Custa ir
de ~6s para ~12s. **Não "otimize" isso de volta** sem antes dar a cada spec o seu
próprio banco.

---

### Tarefa 0.12 ☑ — Corpo de resposta lido depois de uma navegação

Encontrada durante a 0.11 e não corrigida lá, porque aquela tarefa proibia alterar
os seis specs existentes. Concluída no PR #28.

**O que está errado:** `frontend/e2e/05-financeiro.spec.js:127` guarda o objeto
`Response` do `GET /api/accounts/`, executa `page.reload()`, e só então chama
`response.json()`. O Chromium pode descartar o corpo da resposta depois que a
navegação associada a ela termina, e aí a leitura falha sem que exista erro de
HTTP, de saldo ou de banco.

**Não era só o `05`.** A varredura na execução achou o mesmo padrão em mais dois
lugares, e consertar um terço de um defeito não é consertar: o `06` lia
`/api/deposits/mine` e `/api/products/` depois do `goto('/requisicoes')`, e o `07`
fazia o mesmo em `openDeposits`. O `02` e o `04` já estavam corretos — recarregam
e conferem pelo DOM.

**Duas soluções foram tentadas, e a primeira estava errada.** Ler o corpo mais
cedo, encadeando `.then(r => r.json())` na promessa antes da navegação, **não
resolve** — a leitura continua sendo assíncrona, e se a navegação disparar durante
o round-trip do CDP o corpo já foi descartado. O Playwright diz isso com todas as
letras:

```text
Response body is not available for a response that was navigated away from.
Read response.body() before triggering any navigation.
```

**Solução que vale:** da resposta produzida por uma navegação, confira **apenas o
`.ok()`**; o dado vem de um `fetch` próprio disparado de dentro da página via
`page.evaluate`, que não depende do cache de rede do Chromium. O `06` e o `07` já
usavam exatamente esse padrão para ler saldo — agora usam para tudo.

**Regra para os próximos specs: nunca chame `.json()` num `Response` que veio de
um `goto` ou de um `reload`.**

**Critério de aceite:** nenhum spec lê corpo de resposta de navegação; a suíte
passa três vezes seguidas em série.

**Correção de critério.** A versão original desta tarefa exigia que a suíte
passasse também com `--workers=5`. **Isso é inalcançável e o critério estava
errado** — a disputa de banco entre o `03`, o `06` e o `07`, registrada na tarefa
0.11, é justamente o que o `workers: 1` existe para evitar. Medido depois do
conserto, em cinco rodadas com 5 workers: o `05` **não falhou nenhuma vez**, e as
falhas restantes foram todas do `06` e do `07`, por saldo e por movimentação
alheia. Foi assim que se provou que este defeito morreu — não pela suíte inteira
ficar verde em paralelo, o que depende de dar um banco a cada spec.

---

### Tarefa 0.13 — E2E da tela de contatos

Registrada durante a tarefa 1.8c. **Nenhum spec abre `/contacts`**: o `01-login`
cita o caminho só dentro da lista de itens de menu, e o `04-venda` usa um contato
como dado ao escolher o cliente. A 1.8c refatorou 364 linhas dessa tela apoiada
apenas em fidelidade textual verificada — 11 endpoints e 45 strings visíveis
idênticos —, que prova que nada mudou de texto, não que os fluxos continuam
funcionando.

**O que precisa ser coberto em `frontend/e2e/08-contato.spec.js`:** cadastrar um
contato; editar e conferir que persiste; remover; o CRUD de seguimentos (adicionar,
renomear, remover); e as buscas por CNPJ e por CEP.

**Regra específica:** as duas buscas chamam a API externa `brasilapi.com.br`. O
spec **tem que interceptar a rota** (`page.route`) e devolver resposta fixa — não
pode bater na internet, senão o CI fica dependente de terceiro e de rede.

Valem as regras herdadas da Fase 0: nada de `waitForTimeout`, idempotente, e a
suíte precisa passar três vezes seguidas.

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

### Tarefa 1.1 ☑ — `FinancialReports.jsx`: 1380 linhas

Concluída no PR #20. **A tabela abaixo estava errada quando foi escrita** e fica
registrada como foi corrigida na execução, porque o erro é instrutivo.

O arquivo não tinha seis relatórios: tinha **dez**. A tabela omitia
`OverdueReport`, `ForecastReport`, `PeriodComparisonReport` e `DPEReport` —
cerca de 474 linhas. E a linha "`ByContactReport.jsx` | linhas 557 em diante",
seguida ao pé da letra, produziria um arquivo de 792 linhas: o próprio
`ByContactReport` tinha 318 e precisou de um segundo corte, em
`ByContactPrintView` e `ByContactTransactionTable`.

O `diffIcon` de CCN 16 citado adiante **era artefato de medição**, não
complexidade real: `diffIcon` é um ternário de uma linha, e o lizard erra o
parse de JSX atribuindo a ele um bloco que atravessa dois componentes. Separar
os arquivos resolveu o número sozinho.

**Lição para as tarefas seguintes da Fase 1: confira o mapa contra o arquivo
antes de cortar.** As contagens desta seção foram feitas na leitura do plano, não
na medição do código.

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

### Tarefa 1.2 ☑ — `Deposits.jsx`: 796 linhas

Concluída no PR #23. São quatro modais e uma página.

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

**Correção registrada na execução — duas coisas que este critério errava.**

O `complexity_max` **não caiu**, e está certo que não tenha caído. Havia dois CCN
27 no repositório, não um: o do `addItem` daqui, que sumiu com a separação, e o
comparador anônimo de `frontend/src/pages/Financial.jsx:177-191`, que segue
intocado e agora é o pior número do repo sozinho. Ele é alvo da tarefa 1.8a.
No recorte de `depositos/`, nenhuma função ficou acima de CCN 10 — a tabela acima
foi cumprida, e mais uma vez sem ninguém simplificar função nenhuma: os três
números eram o lizard atribuindo a uma função as funções aninhadas dela.

Os specs 0.5 e 0.8 **não provam** o que este critério diz que provam. Nenhum spec
E2E navega para `/depositos`: os fluxos de estoque e venda usam o nome do depósito
como dado, mas ninguém abre a tela, clica em Abastecer, Devolver, Avaria, Saldo ou
Movimentações. A suíte verde provou que nada mais quebrou, não que os quatro
modais continuam funcionando. A evidência aceita no lugar foi a fidelidade textual
verificada — os 11 endpoints e todas as strings visíveis idênticos antes e depois
— mais build e eslint limpos. Daí nasceu a tarefa 0.11.

**Lição, e vale para as dez tarefas restantes da Fase 1: antes de escrever
"o spec X é a prova", abra o spec e confirme que ele passa pela tela.**

---

### Tarefa 1.3 ☑ — `Requisicoes.jsx`: 627 linhas

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

### Tarefa 1.4 ☑ — `backend/app/routers/stock.py`: 636 linhas

> **Pré-requisito satisfeito.** Esta tarefa exigia a 0.11 antes, porque quatro dos
> endpoints movidos aqui — `transfer_stock`, `register_avaria`, `stock_balance` e
> `stock_movement_report` — são os que a tela de depósitos consome, e nenhum spec
> E2E passava por essa tela. Desde o PR #26 o `07-deposito.spec.js` cobre os
> quatro pela interface. **A 1.4 está liberada.**

O corte aqui é em **pacote de router**, não em arquivos soltos que se importam.

**Números remedidos em 2026-08-13:** o arquivo cresceu de 612 para 636 linhas com
o trabalho de concorrência das tarefas 0.6 e 0.7, e as quatro funções acima do
teto se deslocaram — `transfer_stock` (439–515, CCN 17), `stock_balance`
(312–382, CCN 16), `stock_movement_report` (386–435, CCN 15) e `register_avaria`
(519–584, CCN 15). Confira contra o arquivo antes de cortar; os números abaixo são
os do desenho original.

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
| **1.5** ☑ | `frontend/src/pages/StockReports.jsx` | 471 | ~~um arquivo por relatório, espelhando a 1.1~~ — **descrição errada**, ver nota | nenhuma |
| **1.6** ☑ | `backend/app/routers/reports.py` | 446 | pacote `routers/reports/` por assunto; cálculo desce para `services/` | `get_dashboard` (32–286, CCN 12) — ~~162~~ **254** linhas num handler |
| **1.7** | `backend/app/routers/requisicoes.py` | **441** | handlers finos; o fluxo de estado vai para `services/requisition_workflow.py`, que já existe | `receive_requisicao` (329–415, CCN **22**) |
| **1.8a** | `frontend/src/pages/Financial.jsx` | 404 | a tela financeira inteira, incluindo os dois componentes irmãos abaixo | `(anônima)` 177–191 **CCN 27**; `Financial` 55–395 CCN 25; `handleSubmit` 204–232 CCN 19; `handleEdit` 265–283 CCN 15 |
| **1.8b** | `frontend/src/pages/Pricing.jsx` | 380 | separar o cálculo de preço da tela — o cálculo ganha teste Vitest | `Pricing` (76–347, CCN 19) |
| **1.8c** | `frontend/src/pages/Contacts.jsx` | 364 | corte por seção do cadastro | nenhuma |
| **1.9a** | `backend/app/routers/sales.py` (348) | 348 | pacote `routers/sales/`; acesso e precificação descem para `services/` | `update_sale` 205–268 CCN 19 |
| **1.9b** ☑ | `frontend/src/pages/Products.jsx` (334) | 334 | corte por responsabilidade da tela | `Products` 13–311 CCN 15; `handleSubmit` 125–143 CCN 14; `handleEdit` 145–159 CCN 14 |
| **1.9c** | `frontend/src/pages/Accounts.jsx` (307) | 307 | corte por responsabilidade da tela | `handleEdit` 59–68 CCN 13; `(anonymous)` 97–176 CCN 12; `handleSubmit` CCN 11 |

`Financial.jsx` é a tarefa mais pesada de toda a Fase 1: sozinha, concentra
quatro funções acima do teto, incluindo uma de CCN **27** em apenas 15 linhas —
que é o padrão mais difícil de todos para um modelo fraco, porque parece pequena
e não é.

**Correções registradas na execução — leia antes de usar as linhas restantes.**

A **1.5** dizia "um arquivo por relatório, espelhando a 1.1". Não espelhava: a
1.1 eram dez componentes independentes no mesmo arquivo, e o `StockReports.jsx`
era **um** componente com três abas dividindo filtro, busca, exportação e
impressão — o estado `balance` alimentava duas delas. Seguir a descrição teria
cortado no meio do fluxo. O corte que funcionou foi por peça da tela, não por
relatório.

A **1.6** dizia "162 linhas num handler". Eram **254**. As linhas e o CCN do
`get_dashboard` estavam certos; o tamanho, não.

A **1.7** ainda diz 435 linhas e CCN 20. Os números atuais são **441** linhas e
`receive_requisicao` em **329–415, CCN 22** — o arquivo cresceu depois do plano
ser escrito.

Isso já são quatro tabelas da Fase 1 com número ou descrição errados. **Confira
cada linha restante contra o arquivo antes de cortar** — é a mesma lição que a
1.1 deixou, e ela continua valendo para a 1.7, a 1.8 e a 1.9.

**Correções registradas na execução da 1.7 (2026-08-13).** A medição confirmou
441 linhas e CCN 22 em `receive_requisicao`, mas o arquivo tinha 9 endpoints,
não 10. O bloco completo de cinco `joinedload` aparecia 10 vezes (70 linhas),
não 11; as duas posições restantes eram consultas só dos itens, e uma
ocorrência do recebimento estava fora da lista do mapa. O Lizard instalado não
aceita `-T ccn=10`; a medição equivalente usa
`-T cyclomatic_complexity=10`.

**Correção registrada na execução da 1.8b.** A descrição "separar o cálculo de preço da tela —
o cálculo ganha teste Vitest" estava errada: não há cálculo de preço no frontend. A tela chama
`POST /pricing/calculate` e exibe o resultado; a conta vive em `backend/app/routers/pricing.py`.
O que existia para extrair e testar eram as conversões entre o formato da tela e o da API
(`toPayload`, `fromConfig`, `maskInt`, `fmtMoney`, `fmtPct`) e a persistência de percentuais em
`localStorage`. Seguir a descrição ao pé da letra levaria a duplicar no frontend uma conta que
já existe no backend. É a quinta tabela da Fase 1 com número ou descrição errados.

**Correção registrada na execução da 1.8c.** A coluna "funções acima do teto" dizia "nenhuma";
eram duas: `Contacts` (8–337, CCN 12) e `handleEdit` (103–112, CCN **11 em 10 linhas** — a
cadeia de nove `|| ''`). Havia ainda um bloco anônimo em 140–149 exatamente no teto (CCN 10).
É a sexta tabela da Fase 1 com número ou descrição errados.

**Correção registrada na execução da 1.9a.** A linha original juntava três tarefas e dizia que
`sales.py` tinha 321 linhas; a medição confirmou **348**. O `update_sale` está em **205–268,
CCN 19**, não em 199–250 com CCN 16. A tabela também omitia quatro funções acima do teto: além
de `Products` (13–311, CCN 15), há `handleSubmit` (125–143, CCN 14) e `handleEdit` (145–159,
CCN 14) em Products; e, em Accounts, `handleEdit` (59–68, CCN 13), o bloco `(anonymous)`
(97–176, CCN 12) e `handleSubmit` (39–57, CCN 11). São **sete funções** acima do teto nas três
subtarefas, não três.

**Correção registrada na execução da 1.9b — tarefa 1.14 promovida.** `_resolve_price` chama `_client_table_prices` uma vez
por item, e essa função consulta `Contact` e `PriceTable` repetidamente. Uma venda de 20 itens
faz até 40 consultas para buscar a mesma tabela. A extração do cache por venda fica registrada
como a tarefa **1.14** na tabela de acompanhamento; não faz parte da 1.9a nem da 1.9b.

**Correção registrada na execução da 1.9b.** A medição obrigatória confirmou 334 linhas no
arquivo, em acordo com o plano. `Products` está em **13–311, CCN 15**, e não termina na linha
310 como dizia o plano. O plano não informava as faixas dos dois handlers: `handleSubmit` está
em **125–143, CCN 14**, e `handleEdit` em **145–159, CCN 14**. A tabela foi corrigida para
registrar as três faixas e os CCNs medidos.

**Registro de comportamento preservado na execução da 1.9b.** A tela mantém três pendências
conhecidas fora do escopo do refactor: `fmtVal` recebe `unit` a mais nas duas chamadas da
tabela; `handleUnitChange` fixa duas casas em vez de consultar `formDecimals`; e SKU duplicado
continua devolvendo 500, cuja correção pertence à 1.11. A ordenação genérica foi promovida para
`pages/ordenacao.js` e reutilizada por Financeiro, evitando uma segunda implementação.

---

### Tarefa 1.10 — Os complexos que não são grandes

Estes arquivos estão abaixo de 300 linhas, então a Fase 1 passaria por cima
deles — mas carregam funções acima do teto de complexidade. Sem esta tarefa, a
meta de `complexity_max ≤ 15` não é atingida.

| Subtarefa | Alvo | Pior CCN |
|---|---|---:|
| **1.10a** | `components/FinancialTransactionTable.jsx` + `components/FinancialTransactionForm.jsx` | **21** |
| 1.10b | `pages/Dashboard.jsx` | 20 |
| 1.10c | `components/NavigationSidebar.jsx` | 18 |
| 1.10d | `pages/Stock.jsx` (4 funções) + `pages/Users.jsx` | 14 |
| 1.10e | `backend/app/services/stock_repair.py` | 15 |
| 1.10f | `components/ImportExcelModal.jsx` + `pages/SaleDetail.jsx` | 12 |

`1.10a` corta a tabela por linha e célula (`TransacaoLinha`, vencimento,
descrição, conta e ações) e o formulário por bloco (campos básicos,
classificação, cartão e parcelas). `dueDaysInfo` fica em módulo próprio com
teste Vitest. As props públicas dos dois componentes permanecem inalteradas;
o agrupamento em objetos fica para uma tarefa posterior.

`services/stock_repair.py` merece cuidado extra: mexe no histórico de estoque.
Nenhuma alteração ali pode apagar ou reescrever linha de `stock_movements` —
leia [`backend/docs/estoque-historico-imutavel.md`](../backend/docs/estoque-historico-imutavel.md)
antes de tocar no arquivo.

**Correções registradas antes da execução da 1.10a.** A medição foi refeita
com `backend/.venv/bin/python -m lizard backend/app frontend/src -T
cyclomatic_complexity=10`. A linha do formulário dizia 7–133/CCN 24, mas o
código media 7–121/CCN 13; `repair_stock` dizia 126–219/CCN 14, mas media
139–243/CCN 15. A tabela dizia que `Stock.jsx` tinha apenas a função `Stock`
em CCN 14; o scan também encontrou três funções acima do teto no arquivo:
`(anônima)` 49–61/CCN 11, `handleSubmit` 98–118/CCN 11 e `(anônima)`
147–165/CCN 13. A tabela original ainda omitia `ImportExcelModal.jsx`
(CCN 12) e `SaleDetail.jsx`, com `handleShare` e `updateItem` em CCN 12;
ambos passam a ser a 1.10f.

**Estado da divisão.** A 1.10a foi concluída: a pior função dos dois
componentes foi extraída, `dueDaysInfo` ganhou os cinco cenários pedidos e os
demais alvos permanecem pendentes nas subtarefas 1.10b–1.10f.

### Tarefa 1.11 — SKU duplicado devolve 500

Bug encontrado durante a tarefa 0.10 e deliberadamente não corrigido lá, para não
misturar tarefas. Estava registrado como tarefa 2.5 e foi **antecipado para a
Fase 1 por decisão do dono em 2026-08-13**: é a única falha de comportamento
conhecida e ativa do sistema, e esperar a Fase 2 inteira não se justificava.

`sku` tem constraint `unique` em `backend/app/models/product.py`. Cadastrar
produto com SKU já existente estoura a constraint e a API responde **500**, em
vez de erro de validação com mensagem clara. Quem está cadastrando vê "erro no
servidor" e não descobre que o problema é SKU repetido.

**Onde:** o router de produtos.

> **O que a antecipação custa, dito de frente.** A versão original desta tarefa
> vivia na Fase 2 porque dependia do padrão de erro da tarefa 2.1, que ainda não
> existe. Antecipando, o conserto sai **sem** esse padrão: o backend passa a
> devolver 4xx com mensagem clara, e a tela mostra o que já sabe mostrar hoje.
> Quando a 2.2 e a 2.3 migrarem as telas, esta mensagem entra na migração como
> qualquer outra. **É retrabalho pequeno e consciente**, aceito em troca de não
> deixar um 500 conhecido de pé até a Fase 2.

**Critério de aceite:** cadastrar produto com SKU repetido devolve 4xx com
mensagem que nomeia o campo em conflito; teste de backend cobrindo o caso;
nenhum outro caminho de erro do router de produtos muda de status.

> **Nota:** desde a tarefa 0.10 os specs E2E deixaram de alcançar este 500,
> porque o banco é recriado antes de cada rodada. O defeito continua existindo —
> só parou de ser exercitado por acidente. Por isso o teste de backend é
> obrigatório aqui: sem ele, nada exercita o caso.

### Tarefa 1.12 — Idempotência da entrada de requisição

Dívida registrada durante a tarefa 1.7. O recebimento protege a saída com
`existing_saida`, mas não tem guarda equivalente para a entrada. O endpoint
normal não reprocessa uma requisição já recebida, então a assimetria é
pré-existente e não foi alterada na refatoração. A correção futura deve manter
o histórico de estoque imutável e tratar a idempotência da entrada
separadamente.

### Tarefa 1.13 — Decidir a proteção do botão Novo Contato

Dívida registrada durante a tarefa 1.8c, pela regra 4 do plano. Em `Contacts.jsx`
original (linha 186, agora em `frontend/src/pages/contatos/index.jsx`), `canManage`
protege o botão **Seguimentos**, mas não protege o botão **Novo Contato**. Pode ser
intencional ou pode ser uma falha de autorização na interface.

Não consertar junto com a 1.8c: o backend ainda valida a permissão, e o risco
registrado aqui é de interface. A tarefa futura deve decidir a intenção e cobrir o
comportamento correspondente.

---

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

### Tarefa 2.5 — movida para a Fase 1, como tarefa 1.11

Por decisão do dono em 2026-08-13: era a única falha de comportamento conhecida e
ativa do sistema, e esperar a Fase 2 inteira para consertá-la não se justificava.
**O número 2.5 não será reaproveitado**, para não confundir quem procurar o
histórico. Veja a [tarefa 1.11](#tarefa-111--sku-duplicado-devolve-500).

---

### Tarefa 2.6 — Contrato verificável nos endpoints de relatório

Dívida técnica encontrada durante a tarefa 1.6 e registrada por decisão do dono
em 2026-08-13, para tratar com calma no próximo ciclo.

**O que está errado:** os três endpoints GET de `app/routers/reports/` devolvem
`dict` cru, sem `response_model`:

| Endpoint | Chaves na resposta | Testes que conferem |
|---|---:|---|
| `/api/reports/dashboard` | 22 | 2, e ambos só olham `total_products` |
| `/api/reports/financial-summary` | 5 | nenhum |
| `/api/reports/stock-movements-summary` | 3 | nenhum |

Sem `response_model`, o schema da resposta **não existe no OpenAPI**. Dá para
renomear, trocar de tipo ou perder uma chave e o OpenAPI continuar idêntico — o
frontend quebra em produção e nada no caminho acusa.

**Por que isso importa mais do que parece:** foi exatamente essa lacuna que
obrigou a tarefa 1.6 a inventar a prova dela do zero, capturando as respostas
antes e depois. Numa refatoração isso é caro; num descuido, é invisível. Com
`response_model`, a comparação de OpenAPI passa a proteger estes endpoints
sozinha, como já protege os de `/api/stock`.

**Onde:** `backend/app/schemas/` ganha os modelos; `app/routers/reports/`
declara `response_model` nos três.

**Cuidado que define a tarefa:** o `/dashboard` devolve estruturas aninhadas —
`overdue_pagar`, `next_receber` e afins são dicionários com `total`, `count` e
`list`, e `next_due_total`, `next_due_count` e `next_due_list` são derivadas por
soma e concatenação. O schema precisa descrever isso como está hoje. **Declarar
o modelo é registrar o contrato existente, não redesenhá-lo** — se algo parecer
errado no formato, anote e não conserte junto.

**Critério de aceite:** os três endpoints com `response_model`; a resposta de
cada um idêntica antes e depois, provada por captura como na 1.6; os caminhos do
OpenAPI inalterados e os schemas agora presentes; nenhum teste alterado.

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
| 0.5 | E2E entrada de estoque | ☑ |
| 0.6 | E2E venda | ☑ |
| 0.7 | E2E lançamento financeiro | ☑ |
| 0.8 | E2E requisição entre depósitos | ☑ |
| 0.9 | E2E no CI | ☑ |
| 0.10 | Suíte E2E repetível | ☑ |
| 0.11 | E2E movimentação entre depósitos | ☑ |
| 0.12 | Corpo de resposta lido depois de uma navegação | ☑ |
| 0.13 | E2E da tela de contatos | ☐ |
| 1.1 | `FinancialReports.jsx` (1380) | ☑ |
| 1.2 | `Deposits.jsx` (796) | ☑ |
| 1.3 | `Requisicoes.jsx` (627) | ☑ |
| 1.4 | `routers/stock.py` (636) | ☑ |
| 1.5 | `StockReports.jsx` (471) | ☑ |
| 1.6 | `routers/reports.py` (446) | ☑ |
| 1.7 | `routers/requisicoes.py` (441) | ☑ |
| 1.8a | `Financial.jsx` (404) — 4 funções acima do teto | ☑ |
| 1.8b | `Pricing.jsx` (380) | ☑ |
| 1.8c | `Contacts.jsx` (364) | ☑ |
| 1.9a | `backend/app/routers/sales.py` — pacote de router e serviços de acesso/preço | ☑ |
| 1.9b | `frontend/src/pages/Products.jsx` | ☑ |
| 1.9c | `frontend/src/pages/Accounts.jsx` | ☐ |
| 1.10a | `FinancialTransactionTable.jsx` + `FinancialTransactionForm.jsx` | ☑ |
| 1.10b | `Dashboard.jsx` | ☐ |
| 1.10c | `NavigationSidebar.jsx` | ☐ |
| 1.10d | `Stock.jsx` + `Users.jsx` | ☐ |
| 1.10e | `services/stock_repair.py` | ☐ |
| 1.10f | `ImportExcelModal.jsx` + `pages/SaleDetail.jsx` | ☐ |
| 1.11 | SKU duplicado devolve 500 — **antecipada da 2.5** | ☐ |
| 1.12 | Idempotência da entrada de requisição | ☐ |
| 1.13 | `canManage` no botão Novo Contato | ☐ |
| 1.14 | N+1 de `_resolve_price` — cache da tabela de preços por venda | ☐ |
| 2.1 | Padrão de notificação e erro | ☐ |
| 2.2 | Migrar as 4 telas de maior volume | ☐ |
| 2.3 | Migrar as 18 telas restantes | ☐ |
| 2.4 | `no-alert` no eslint | ☐ |
| 2.5 | ~~SKU duplicado devolve 500~~ — movida para a 1.11 | — |
| 2.6 | Contrato verificável nos relatórios (`response_model`) | ☐ |
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
