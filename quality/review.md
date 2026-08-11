# Rubrica de review — o que o gate não pega

O gate conta violações, complexidade, cobertura, duplicação, linhas e ciclos.
Todos esses números podem melhorar enquanto o código piora. Esta lista é o que
sobra para um humano (ou uma IA revisora) olhar no PR. Nada aqui é automático.

Use como checklist de leitura do diff. Se a resposta a alguma pergunta for
"sim", o PR precisa de conversa mesmo com o gate verde.

---

## 1. Modularização falsa

Cortar um arquivo grande em pedaços derruba `files_over_limit` e
`largest_file_lines` sem tornar nada mais simples.

- O corte caiu **no meio de uma função ou de um fluxo**, e as metades foram
  costuradas com imports cruzados? Se `a.py` importa de `b.py` e `b.py` precisa
  de `a.py` para fazer sentido, não houve modularização — houve mudança de
  endereço.
- Os arquivos novos são legíveis **isoladamente**? Abra cada um sozinho. Se para
  entender um deles você precisa manter o outro aberto ao lado, o corte foi no
  lugar errado.
- Os nomes dos arquivos novos descrevem uma **coisa** (`precificacao.py`) ou uma
  **posição** (`stock_part2.py`, `helpers2.py`, `utils_extra.js`)? Nome
  posicional é sintoma.
- Apareceu um arquivo `utils`/`helpers`/`common` novo, ou um existente cresceu?
  Esses são o depósito onde a modularização falsa esconde o entulho.
- Uma função foi partida em `_faz_x_parte1` / `_faz_x_parte2`, chamadas em
  sequência e só uma vez? Isso derruba a complexidade ciclomática por função sem
  reduzir a complexidade real de nada.

## 2. Fronteiras que não correspondem a responsabilidades reais

O repo tem uma separação declarada: `models/` (persistência), `schemas/`
(contrato de API), `routers/` (HTTP), `utils/`. Nem sempre ela é respeitada, e
o gate é cego a isso.

- Regra de negócio nova foi parar num `router`? Router deveria traduzir HTTP e
  delegar. Cálculo de estoque, preço ou saldo dentro de um handler é regra
  morando na camada de transporte.
- Um `model` passou a saber de HTTP, de request, ou de formatação para tela?
- Um `schema` virou lugar de lógica em vez de contrato?
- A fronteira nova foi desenhada por **tipo técnico** ("todos os validadores
  juntos") ou por **assunto** ("tudo de requisição junto")? Agrupar por tipo
  técnico espalha cada mudança futura por cinco arquivos.
- No frontend: lógica de domínio dentro de componente de página, ou chamada de
  API direto no JSX em vez de passar por `services/api.js`?
- Uma responsabilidade ficou em **dois** lugares? Ex.: cálculo de saldo no
  backend e replicado no `.jsx` para mostrar na tela. O gate até premia isso, se
  as duas cópias forem diferentes o bastante para o jscpd não notar.

## 3. Acoplamento novo entre módulos

`import_cycles` só pega o caso extremo — o ciclo fechado. Todo o resto do
acoplamento passa livre.

- O diff adicionou **imports novos atravessando fronteiras** que antes não se
  conheciam? Ex.: `routers/financial.py` passando a importar de
  `routers/stock.py`. Router importando router é quase sempre sinal de que falta
  uma camada abaixo dos dois.
- Um módulo passou a depender de **detalhe interno** de outro (função com `_`,
  estrutura de dado privada, ordem de execução implícita) em vez da interface
  pública?
- Apareceu dependência em **estado global** novo — variável de módulo, singleton,
  cache compartilhado, `os.environ` lido no meio da lógica?
- Alguém precisa lembrar de **chamar A antes de B** para o resultado ficar certo,
  sem que nada no código force isso?
- No frontend: contexto novo (`useContext`) consumido por componentes que não
  têm relação com ele, ou prop atravessando três níveis só de passagem?
- Uma mudança de uma linha aqui exigiu mudança correspondente lá? Se sim, os dois
  pontos estão acoplados, e o próximo mantenedor não vai saber.

## 4. Sinais de que a catraca foi contornada, não atendida

- Cobertura subiu com testes que **não asseguram comportamento** — testes que só
  chamam a função e conferem que não explodiu, ou que fazem `assert True`, ou que
  mockam justamente a parte que interessa.
- Violação de lint sumiu por `# noqa` / `eslint-disable` em vez de correção. O
  contador cai igual. Procure por essas linhas no diff — sempre.
- Duplicação caiu porque duas coisas **que só pareciam iguais** foram fundidas
  numa função com um parâmetro `tipo` ou flag booleana que muda o comportamento.
  Isso troca duplicação por acoplamento, e o gate só vê o lado bom.
- Complexidade caiu porque condicionais viraram dicionários de despacho ou
  ternários encadeados sem ninguém entender melhor o código.
- O `baseline.json` mudou no mesmo commit que o código. Aí a catraca não travou
  nada. Se foi deliberado, tem que estar explicado na mensagem do commit.

## 5. O que nenhuma das duas coisas pega

Nem os números nem os itens acima cobrem isto. Continua sendo leitura humana:

- A mudança está **correta**? O gate não sabe se a regra de negócio está certa.
- Trata os casos de borda — lista vazia, saldo negativo, concorrência, transação
  interrompida no meio?
- Mensagens de erro dizem ao usuário o que fazer?
- Migrações Alembic são reversíveis, e a ordem bate com o schema?
- Alguma coisa nova quebra o histórico imutável de estoque descrito em
  [`backend/docs/estoque-historico-imutavel.md`](../backend/docs/estoque-historico-imutavel.md)?
- Segredo, credencial ou URL de produção entrou no diff?
