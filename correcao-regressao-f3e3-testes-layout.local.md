# correcao-regressao · fase 3, etapa 3 — testes diretos do `layout()`

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 3 da fase 3 do
`docs/analises/04-plano-de-aprofundamento.md`. Branch `refactor/fase-3-layout`, sobre `f13ad73`
(etapa 2). 2026-10-22. Só testes: nenhum arquivo do mod mudou.

## O que entrou

**`task-tree/tests/layout.test.ts`** (novo, 14 testes), chamando `layout(model, choices, now,
ownId)` direto, sem `mount` e sem SVG. O `Model` é montado como o `refreshChildren` monta: um `Child`
por sessão do fixture (`own.children`) com o `panel` vindo do arquivo publicado (`REAL.files`).

Com o **fixture real** da orquestradora (5 testes):
1. Visão completa: 28 linhas; `+67 pedidos anteriores` no topo e `+41 cartões antigos de sessões` no
   fim; só os pedidos 71, 72, 73 desenhados (o 70, com resumo, fica na contagem); exatamente 2
   cartões, os dois da `analise-task-tree` (rodadas #2 e #7), nenhum na raiz, cada um logo abaixo
   da tarefa da sua rodada (97 e 98), tons `done`/`running`, motor e anel (43%) nos dois.
2. ↩: o pedido 71 (sem cartão) mostra `resposta`; os pedidos 72 e 73 (com cartão de filha) não
   mostram o ↩ próprio; o cartão #2 mostra a resposta da filha com o resumo dela, última linha do
   cartão.
3. Cabeçalho: a contagem é a dos nós desenhados (8/14 = 1/1 + 4/4 + 3/9), não a da sessão inteira
   (`total` > isso); chips: 6 em andamento (folhas abertas), 1 sessão ativa, 0 aguardando, 0 ✉. Um
   pedido recolhido guarda em `nodes` as tarefas dele e das sessões (3/9) e o cabeçalho não muda.
4. Visão resumida: 27 linhas, `+1 pedidos anteriores` (o 70 do trabalho atual 94–98), sem a linha de
   cartões antigos; as demais linhas idênticas às da completa.
5. Determinismo: duas chamadas iguais produzem as mesmas linhas (o cache de `breaks` é por chamada).

Com **modelos pequenos** (9 testes): ordem dos cartões pela ordem de execução (`begins`), não pela
lista; cadeia (mensagem de irmã põe o cartão sob a tarefa de origem da irmã, e a tarefa fica em
andamento com ⑂); filha de outra filha aninhada (profundidades 1 e 3, contagens 1/3 na filha e 1/4
na origem, tons `current`/`running` em cascata); ↩ por turno (resumo do `done`, senão `resposta`;
suprimido no pedido com cartão); `+N pedidos anteriores` com pedido antigo aberto mantido; ✉ no
painel e dentro de um cartão (`pending` por escopo), com o chip "aguardando sessão" = 2; aviso ao
usuário sob a tarefa em andamento e no chip; escolhas (linha fechada guarda `nodes`, cabeçalho
igual); corte de 400 linhas (750 → ≤ 400, `+N linhas anteriores`, soma fecha).

## Falha conhecida (bug revelado, não corrigido)

`KNOWN['chip em andamento com ✉ de filha']`: o cabeçalho conta como **"em andamento"** a tarefa ✉
de um cartão de filha. A fórmula do render (`active`) exclui só as tarefas de `sentIds`, as mensagens
na fila **desta** sessão; a tarefa da filha que espera outra sessão fica como folha aberta e entra no
"em andamento", embora já conte em "aguardando sessão". No cenário do teste: 1 em andamento + 2
aguardando sessão, quando o esperado seria 0 + 2. Está em `register.tsx` (`ui.render`, cálculo de
`active`), não no `layout()`. O teste imprime `TODO …` e passa; quando for corrigido, falha pedindo
para tirar de `KNOWN`.

## Expectativas corrigidas no caminho (não eram bugs)

- A tarefa de origem é folha e conta a si mesma mais as da filha (1/4), a filha 1/3.
- Sob um pedido com cartão `done`, as linhas são a tarefa, o cartão e a tarefa dentro do cartão.

## Testes

- **281 pass / 0 fail** (9 arquivos; +14), com um `TODO` impresso (a falha conhecida acima).
  `claude plugin validate task-tree` e `validate .` ok.
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11 657 / 11 775 /
  47 400 / 48 158) e todo o resto: iguais (nenhum arquivo do mod mudou).
- Os 14 testes rodam em ~130 ms no total: sem `mount`, o fixture real inteiro custa ~30 ms por
  `layout()`.

## O que conferir no app

Nada muda: só testes. O bug conhecido pode ser visto no app com uma filha que tenha ✉ numa tarefa:
o chip "em andamento" do cabeçalho conta essa tarefa.

## Fase 3, próximo

Etapa 4: `drawDesktop(rows, W)` / `drawTerminal(rows)` puros, sobreposições por `overlay()` e a regra
"nenhum par de Box na mesma linha se cruza" testável.
