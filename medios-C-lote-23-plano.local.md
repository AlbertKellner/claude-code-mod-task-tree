# Lote 23 (triagem C): passo ○ de pedido anterior não libera a pergunta

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "A recusa da pergunta confere só 'tarefa aberta'…", segunda pergunta.
- Decisão 40: "Não (Recomendado)". A opção: "Não: a pergunta precisa de tarefa aberta do pedido
  atual, ou de uma em andamento. No pedido novo sem plano, a pergunta é recusada e o modelo planeja
  antes."

## 2. Causa confirmada na ponta

- Escrito, `hooks/tool-call.ts:53-59` (`asked`): o `AskUserQuestion` do loop principal só é recusado
  quando não há nenhuma tarefa aberta no grupo principal, de qualquer pedido.
- Escrito, `text/rules.ts:184-188` (`ASK.refused`) e a regra da linha 56 ("AskUserQuestion sem tarefa
  aberta é recusado").
- Escrito, `regras/perguntas.md`, `perguntas.sem-tarefa-recusada`: "Dado nenhuma tarefa aberta". É o
  cenário coberto que a decisão reescreve.
- Dedução: um passo ○ esquecido de um pedido anterior libera a pergunta de um pedido novo sem tarefa
  nenhuma, e o aviso fica solto (ou, depois do lote 22, sob a tarefa do pedido errado).

## 3. O que muda

- `hooks/tool-call.ts` (`asked`): a pergunta do loop principal passa quando há tarefa aberta do
  pedido atual (a noção de "pedido atual" do lote 21, em `hooks/panel.ts`), ou uma tarefa em
  andamento de qualquer pedido (aberta, iniciada e não parada com Esc). Fora disso, é recusada. Um
  painel antigo sem pedidos gravados segue pela regra de hoje (qualquer aberta).
- `text/rules.ts`: `ASK.refused` passa a "não há tarefa aberta deste pedido no painel, nem tarefa em
  andamento, e uma pergunta sempre fica sob uma tarefa do pedido. Abra (mcp__task-tree__plan) ou
  reabra (mcp__task-tree__start) a tarefa a que esta pergunta pertence e pergunte de novo; feche-a só
  depois da resposta."; a regra da linha 56 passa a "AskUserQuestion sem tarefa aberta do pedido
  atual, nem tarefa em andamento, é recusado."
- O ExitPlanMode e o wrap_up com pergunta seguem livres (decisão 39).

Em termos do painel: num pedido novo sem plano, a pergunta não abre; o modelo planeja, e a espera
aparece sob a tarefa do pedido (lote 22).

## 4. Impacto

`npm run impacto -- hooks/tool-call.ts text/rules.ts`: 39 cenários (envios 17, lembretes 11,
perguntas 8). Checklist: `envios.destino-arquivado-no-app`, `envios.subagente-no-app` (não tocados).
Golden: nenhum.

## 5. Testes

Novos (`tests/perguntas.test.ts`), regra `perguntas.sem-tarefa-recusada`:
- "no pedido novo sem plano, um passo pendente do pedido anterior não libera a pergunta": pedido um,
  plan A, start e done numa das duas, fim do turno; pedido dois; a pergunta é recusada (`erro`), o
  texto da recusa contém "deste pedido", e o painel não mostra espera. Falha hoje: a pergunta passa.
- "uma tarefa em andamento de um pedido anterior libera a pergunta": pedido um, plan, start, fim do
  turno; pedido dois; a pergunta passa e a espera fica sob a tarefa em andamento.
- "depois do plan do pedido novo, a pergunta passa": pedido dois, plan, pergunta: aceita.

Existentes: nenhum muda de corpo. "sem tarefa aberta, a pergunta é recusada" (linha 13) segue
passando (sem tarefa nenhuma). Os testes de `envios.test.ts:111-116` e `lembretes.test.ts:241-255`
perguntam com tarefa em andamento do próprio pedido.

## 6. Catálogo (`regras/perguntas.md`) e selos

`perguntas.sem-tarefa-recusada`, reescrito:
- título: "A pergunta sem tarefa aberta do pedido atual, nem tarefa em andamento, é recusada.";
- "Dado nenhuma tarefa aberta do pedido atual e nenhuma tarefa em andamento (uma tarefa só pendente
  de um pedido anterior não conta)";
- "Quando o modelo chama AskUserQuestion";
- "Então a chamada é recusada, com o pedido de planejar ou dar start antes, e o painel não mostra
  espera; o ExitPlanMode e a escolha do wrap_up não são recusados";
- linha nova: `Reescrito: 2026-11-14, decisão do usuário ("Não (Recomendado)"): um passo ○ de um pedido anterior não libera a pergunta de um pedido novo.`
- `Código: text/rules.ts`.

Selos: os testes novos, `npm run regras:selar -- "task-tree/tests/perguntas.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: a pergunta precisa de tarefa do pedido atual ou em andamento"`. O
teste existente da linha 13 não muda, então não é selado de novo.

## 7. Documentação

Comentário de `asked` (`hooks/tool-call.ts:45-54`, já mexido no lote 15).

## 8. Golden

Não muda.

## 9. Checklist do app

- Num pedido real novo, se o modelo perguntar antes de planejar, a pergunta é recusada uma vez e
  volta depois do plan, com o aviso sob a tarefa.

## 10. Dependências e conflitos

- Depois do lote 21 (a função do "pedido atual") e do 22 (mesma função `asked`).
- Triagem A, lote 07 (decisão 5: a ◷ segue ◷ até o start): redefine "em andamento" depois de uma
  mensagem nova. Se uma tarefa ◷ de turno anterior deixar de contar como em andamento, o segundo
  teste novo daqui muda de resultado (a pergunta passa a ser recusada até o start): quem vier depois
  ajusta o teste e o texto do cenário, sem nova decisão (a 40 diz "ou de uma em andamento").
- Triagem A, lote 06 e lote 11: outros trechos de `tool-call.ts` e `prompt-submit.ts`.

## 11. Bloqueio

Nenhum.
