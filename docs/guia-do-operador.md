# Guia do operador

Este é o seu papel quando pede uma tarefa a uma IA. São três passos e nenhum
exige saber programar. Tudo o que é técnico já está protegido pela catraca de
qualidade e pelos checks obrigatórios — o seu trabalho é só não abrir a porteira.

## 1. Como pedir uma tarefa

Todo prompt de implementação começa com este bloco, sempre, copiado literalmente:

```text
Trabalhe num branch novo a partir da main (nunca direto na main).
Ao terminar, faça push do branch e abra um Pull Request no GitHub.
Antes de abrir o PR, rode e deixe verdes:
  cd backend && .venv/bin/python -m pytest tests/
  cd frontend && npm run build
  python3 quality/gate.py
Siga a receita correspondente em docs/receitas/ se a tarefa for
adicionar campo, endpoint, tela ou corrigir bug.
```

Depois do bloco, descreva a tarefa em uma ou duas frases: o que deve mudar e
como você vai conferir que funcionou (qual tela abrir, qual botão clicar, o que
deve aparecer).

**Uma tarefa por vez.** Se a descrição precisa da palavra "e também", são duas
tarefas — peça a segunda depois que a primeira for aceita.

## 2. Como aceitar um PR

Abra o PR no GitHub e confira, nesta ordem:

1. **Todos os checks estão verdes?** (`quality-gate`, `e2e`, `backend-tests`,
   `frontend-build`). Se algum estiver vermelho, não leia mais nada: devolva
   para a IA com a mensagem "o check X está vermelho, corrija".
2. **O PR faz só o que foi pedido?** Se aparecem arquivos que não têm relação
   com a tarefa, pergunte por quê antes de aceitar.
3. **Passe as dez perguntas de [`quality/revisao-rapida.md`](../quality/revisao-rapida.md).**
   Todas têm resposta sim/não e comando pronto para verificar.

Se as três coisas estiverem certas, aceite o merge. Se tiver dúvida, não aceite:
peça explicação no próprio PR. PR parado não quebra nada; merge errado quebra.

## 3. O que nunca fazer

- **Nunca faça merge com check vermelho**, por mais que a IA explique que "é só
  um detalhe". O check vermelho é o sistema dizendo não.
- **Nunca use a opção de bypass/administrador** para forçar merge ou push na
  `main`. Ela existe para emergência do dono, não para o dia a dia.
- **Nunca aceite alteração em `quality/baseline.json` junto com código.** Esse
  arquivo só muda sozinho, em commit próprio, com explicação. Baseline alterado
  no meio de uma tarefa é a IA afrouxando a própria régua.
- **Nunca peça para a IA "dar um jeito" num teste que falha.** Teste que falha
  é informação; a tarefa certa é "descubra por que este teste falha e corrija a
  causa".

## Se algo der errado

Deu erro numa tela? O relato útil é a mensagem com o código de referência
(ex.: "deu erro `a3f9c1`") — com ele a ocorrência aparece no log do servidor.
Cole esse código na tarefa de correção e peça para seguir
[`docs/receitas/corrigir-bug.md`](receitas/corrigir-bug.md).
