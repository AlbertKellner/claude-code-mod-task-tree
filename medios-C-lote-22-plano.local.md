# Lote 22 (triagem C): pergunta sem tarefa em andamento, o aviso fica sob a pendente

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "A recusa da pergunta confere só 'tarefa aberta', não 'em andamento'; com tarefa só pendente
  a espera fica solta no fim, e ExitPlanMode e wrap_up com ask não têm a mesma exigência", primeira
  pergunta.
- Decisão 39: "Pendurar na pendente (Recomendado)". A opção: "Aceitar e pendurar o aviso sob a tarefa
  pendente do pedido atual, como já se faz com a carta. O aviso aparece sob a tarefa ○. ExitPlanMode e
  wrap_up com pergunta seguem livres, com o aviso sob a última tarefa do pedido."

## 2. Causa confirmada na ponta

- Escrito, `hooks/tool-call.ts:92-96` (`askAnchor`): a espera só guarda tarefa quando há uma em
  andamento (`current`).
- Escrito, `draw/layout.ts:1391` e as linhas do `body` que usam `anchor`: o desenho pendura os avisos
  de espera do grupo sob a tarefa em andamento **na hora do desenho** (`current(g.tasks)`), não sob a
  tarefa guardada na espera; sem nenhuma em andamento, os avisos fecham a lista ("With no task to go
  under, a notice goes under the header, or ends the main list").
- Escrito, `hooks/panel.ts:233-287` (`sendAnchor`): a carta, sem nada em andamento, vai à pendente do
  pedido atual; sem pendente, à iniciada por último do pedido; sem nenhuma, ao último nível 1 dele.

## 3. O que muda

- `hooks/tool-call.ts` (`askAnchor`, para a pergunta, o plano a aprovar e a escolha do wrap_up): com
  tarefa em andamento, como hoje; sem nenhuma, a tarefa que a carta escolheria (a regra de
  `sendAnchor`, sem contar cartas nem cartões: a pendente do pedido atual; sem pendente, a iniciada
  por último do pedido; sem nenhuma, o último nível 1 dele). A espera guarda essa tarefa.
- `draw/layout.ts` (o `body` do grupo): com tarefa em andamento, os avisos seguem sob ela, como hoje;
  sem nenhuma, cada aviso vai sob a tarefa que a espera guardou, se ela está desenhada; só sem ela
  (painel sem tarefas, tarefa fora de vista) fecha a lista. A tarefa pendente segue ○: o aviso
  embaixo não a acende nem muda contagem.
- A recusa da pergunta não muda aqui (segue "sem nenhuma tarefa aberta"; o lote 23 a aperta).

Em termos do painel: com um plano recém-feito e nenhum start, a pergunta mostra ◷ "Aguardando sua
resposta" logo abaixo da tarefa ○ do pedido, um nível para dentro, em vez de solta no fim. A escolha
do wrap_up feita com tudo concluído aparece sob a última tarefa trabalhada do pedido.

## 4. Impacto

`npm run impacto -- hooks/tool-call.ts draw/layout.ts` (o `text/rules.ts` do índice não é preciso):
cerca de 130 cenários e o golden inteiro, por `draw/layout.ts`. Checklist: os de subagentes e
`ultracode.cor-e-corte` valem como conferência geral.

## 5. Testes de verificação (`tests/perguntas.test.ts`)

Regra dos três: `perguntas.espera-sob-a-pendente`.
- "pergunta com tarefa pendente e nenhuma em andamento: a espera fica sob a pendente": pedido, plan A
  (sem start), `AskUserQuestion` aberta (`responderDepois`, como o teste da linha 133). Afirma: a
  linha "Aguardando sua resposta" é a seguinte à tarefa pendente escolhida, um nível para dentro, e a
  tarefa segue pendente. Falha hoje: a espera é a última linha do painel.
- "a escolha do wrap_up com tudo concluído fica sob a última tarefa trabalhada": plan A, start e done
  nas duas, wrap_up com `ask`; "Aguardando sua escolha" logo abaixo da tarefa iniciada por último.
  Falha hoje: solta no fim.
- "com uma tarefa em andamento, a espera segue sob ela mesmo havendo pendente": passa hoje; protege
  `perguntas.espera-sob-a-tarefa`.
- Testes existentes: nenhum muda (todos perguntam com uma tarefa em andamento).

## 6. Catálogo (`regras/perguntas.md`) e selos

Novo, `coberto`:

```markdown
### perguntas.espera-sob-a-pendente
Sem tarefa em andamento, a espera fica sob a tarefa do pedido, não solta no fim.

- Dado tarefas abertas e nenhuma em andamento
- Quando o modelo pergunta (AskUserQuestion), pede a aprovação de um plano (ExitPlanMode) ou termina o turno com a escolha do wrap_up
- Então o aviso de espera aparece sob a tarefa pendente do pedido atual, a mesma que uma carta escolheria; sem pendente, sob a última tarefa iniciada do pedido; a tarefa segue ○ (ou ✓), sem acender nem mudar a contagem; com uma tarefa em andamento, o aviso fica sob ela

Origem: decisão do usuário, 2026-11-14 ("Pendurar na pendente (Recomendado)"); mantém perguntas.espera-sob-a-tarefa.
Código: hooks/panel.ts
Estado: coberto
```

Selos: `npm run regras:selar -- "task-tree/tests/perguntas.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: espera sob a tarefa pendente"`, um por teste novo.

## 7. Documentação

Comentários de `askAnchor` e de `current` em `draw/layout.ts:676-681` (onde o aviso vai).

## 8. Golden

Não deve mudar: nenhum dos 4 roteiros tem espera aberta. Se a etapa acusar diferença, regravar com
`npm run golden:aprovar -- <cenário> --motivo "\"Validar só no fim (Recomendado)\", 2026-11-14"`.

## 9. Checklist do app

- Pergunta real logo depois de um plan sem start: o aviso âmbar aparece sob a tarefa ○, com a guia da
  árvore ligada a ela; a faixa do cabeçalho segue "aguardando".

## 10. Dependências e conflitos

- Antes do lote 23 (mesma função `asked`).
- Triagem B, lote 02 (decisão 19: carta com tarefa em andamento e passo novo pendente vai sob a em
  andamento) e lote 03 (casamento só no nome): mudam `sendAnchor`. A espera usa a regra da carta como
  estiver; com a decisão 19 nada muda para a espera (com tarefa em andamento ela já fica sob ela).
- Triagem B, lote 13 (aviso de espera no cartão de grupo) e lote 12 (linha recolhida leva chips e
  faixa): mexem nas mesmas linhas de aviso do `body` em `draw/layout.ts`. Em sequência.
- Triagem A, lote 06 (a espera do wrap_up só é criada depois de a chamada dar certo): mesma função
  `wrapUpAsk`; a tarefa guardada é calculada do mesmo jeito, na hora em que a espera for criada.

## 11. Bloqueio

Nenhum. Dedução assumida: para o ExitPlanMode e a escolha do wrap_up vale a mesma ordem da pergunta
(pendente do pedido, depois a última iniciada, depois o último nível 1); a frase da opção, "sob a
última tarefa do pedido", é o que essa ordem dá no caso comum do wrap_up (tudo concluído).
