# Lote 24 (triagem C): mensagem nova com tarefas abertas, done e depois plan

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "Os lembretes da mesma mensagem dão ordens opostas (done primeiro x 'a PRIMEIRA chamada é
  plan'); com ids reutilizados, o plan primeiro deixa a tarefa antiga ✕ e o done seguinte fecha a
  tarefa nova".
- Decisão 41: "Done, depois plan (Recomendado)". A opção: "Primeiro done no que a mensagem conclui,
  depois plan. É o que três dos quatro textos já dizem; mudam o lembrete de pedido novo e a primeira
  regra do painel. A tarefa da pergunta respondida fica ✓ no pedido dela, e o plano novo entra
  intacto."

## 2. Causa confirmada na ponta

- Escrito, `text/rules.ts:115-125` (`PROMPT.request`): "A PRIMEIRA chamada de ferramenta é
  mcp__task-tree__plan". `126-130` (`PROMPT.open`): "Feche com mcp__task-tree__done as que esta
  mensagem conclui ou substitui … antes de seguir ou de planejar o pedido novo".
- Escrito, `hooks/prompt-submit.ts:159-167`: os dois saem juntos na mesma mensagem quando há tarefas
  abertas (também com os lembretes de depois do Esc, `interrupted` e `interruptedByYou`).
- Escrito, `text/rules.ts:22-25` (a primeira regra): "A primeira chamada de ferramenta é
  mcp__task-tree__plan".
- Escrito, `state/tasks.ts:32-46`: o done pelo id curto prefere a tarefa aberta, que depois do plan é
  a nova.
- Os testes existentes conferem o trecho "A PRIMEIRA chamada" também em mensagens com tarefas abertas
  (`tests/lembretes.test.ts:205-212` e `231`) e "deixe abertas só as que continuam": os dois trechos
  ficam nos textos novos, e nenhum teste existente muda.

## 3. O que muda

`text/rules.ts`:
- `PROMPT.request` passa a ter duas formas. Sem tarefas abertas antes da mensagem: o texto de hoje.
  Com tarefas abertas (a lista vai no lembrete ao lado): "… Primeiro feche com mcp__task-tree__done
  as tarefas abertas que esta mensagem conclui ou substitui (a lista acima); depois disso, A PRIMEIRA
  chamada de ferramenta é mcp__task-tree__plan com a árvore de tarefas do pedido novo (até 3 níveis;
  uma tarefa basta para um pedido simples), com ids que não repitam os das tarefas ainda abertas. …"
  e o resto igual (etapa por etapa, antes de perguntar, request, summary).
- A primeira regra do painel: "Todo pedido abre pelo menos uma tarefa no painel… Se a mensagem
  conclui ou substitui tarefas ainda abertas (por exemplo, a da pergunta que ela responde), feche-as
  primeiro com mcp__task-tree__done; depois disso, a primeira chamada de ferramenta é
  mcp__task-tree__plan com a árvore de tarefas: …" (o resto da regra igual).
- `PROMPT.open`, `ASK.answered`, `ASK.inChat` e os lembretes de depois do Esc já dizem done antes do
  plan: não mudam.

`hooks/prompt-submit.ts` (linha 166): escolhe a forma do lembrete de pedido novo por haver ou não
tarefas abertas antes da mensagem (o mesmo `hasOpen` que decide o lembrete da lista).

Em termos do painel: a tarefa da pergunta respondida (ou a que a mensagem conclui) fica ✓ no pedido
dela, e o plano novo entra intacto, em vez de a antiga virar ✕ e o done fechar a tarefa nova.

## 4. Impacto

`npm run impacto -- text/rules.ts hooks/prompt-submit.ts`: 45 cenários (turnos 14, pedidos 14,
lembretes 11, envios 4). Checklist: nenhum. Golden: nenhum.

## 5. Testes de verificação (`tests/lembretes.test.ts`)

Regra dos três: `lembretes.done-antes-do-plan`.
- "com tarefas abertas, o lembrete de pedido novo manda fechar com done antes do plan": plan, start,
  fim do turno; o contexto do pedido seguinte contém "Primeiro feche com mcp__task-tree__done" antes
  (na posição) de "A PRIMEIRA chamada", e contém "depois disso". Falha hoje: não há "Primeiro feche".
- "sem tarefas abertas, o lembrete de pedido novo manda o plan primeiro": pedido numa sessão vazia
  (e outro depois de tudo concluído): contém "A PRIMEIRA chamada" e não contém "Primeiro feche".
- "a primeira regra do painel diz done antes do plan quando a mensagem conclui tarefas abertas": as
  regras (pelo `prompt.compose`) contêm "feche-as primeiro com mcp__task-tree__done".
- Testes existentes: nenhum muda.

## 6. Catálogo (`regras/lembretes.md`) e selos

Novo, `coberto`:

```markdown
### lembretes.done-antes-do-plan
Com tarefas abertas, a mensagem nova pede primeiro o done do que ela conclui, depois o plan.

- Dado tarefas abertas quando chega uma mensagem que abre pedido novo
- Quando o modelo recebe os lembretes dela, e quando lê a primeira regra do painel
- Então a ordem é uma só: fechar com done o que a mensagem conclui ou substitui e, depois disso, plan com o pedido novo, sem repetir os ids das tarefas ainda abertas; sem tarefas abertas, o lembrete segue mandando o plan como primeira chamada

Origem: decisão do usuário, 2026-11-14 ("Done, depois plan (Recomendado)"); muda a regra de uso "a primeira chamada é plan", que vinha desde a entrada do mod (465b09e), para o caso da mensagem com tarefas abertas.
Estado: coberto
```

`lembretes.fim-normal-lista-abertas` não muda.

Selos: `npm run regras:selar -- "task-tree/tests/lembretes.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: done, depois plan"`, um por teste novo.

## 7. Documentação

O comentário de `PROMPT` em `text/rules.ts:108-113`. `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda.

## 9. Checklist do app

- Responder a uma pergunta pelo chat num pedido real: a tarefa da pergunta fica ✓ no pedido dela, e
  o plano novo aparece inteiro no pedido novo.

## 10. Dependências e conflitos

- Depois dos lotes 15 a 23 (mesmo arquivo de textos) e do 17 (o aviso na resposta do plan cobre o
  caso em que o modelo ainda planeja primeiro).
- Triagem A, lote 14 (decisão 13: "as regras pedem planejar antes de abrir sessão ou lançar
  subagente") e lote 03 (o título do pedido é o do primeiro plan): mexem na primeira regra e em
  `PROMPT.request`. Em sequência.
- Triagem A, lote 07 e lote 11: mexem em `prompt-submit.ts`.
- Triagem B, lotes 01, 02 e 26: outras frases de `text/rules.ts`.

## 11. Bloqueio

Nenhum.
