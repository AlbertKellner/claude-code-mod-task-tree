# Lote 10 (triagem C): subagentes terminados sem tarefas saem do estado

Planejador C, 2026-11-14, só leitura, ponta `6d5e026`. Caminhos do mod relativos a `task-tree/`.

## 1. O que cobre

- Achado "Os grupos de subagente nunca saem do estado: crescem sem limite e são regravados a cada
  mudança".
- Decisão 34: "Apagar os sem tarefas (Recomendado)". A opção: "Apagar os que terminaram sem planejar
  tarefas no painel e manter os que têm tarefas próprias. No trabalho atual nada muda; ao abrir '+N
  pedidos anteriores', esses cartões não aparecem mais sob as tarefas antigas, e um start que reabra
  uma tarefa antiga não os traz de volta." A pergunta dizia quando: "quando o pedido deles sai do
  trabalho atual".

## 2. Causa confirmada na ponta

- Escrito, `hooks/agents.ts:83-97`: cada lançamento acrescenta um grupo; nada tira grupos além do
  `/clear` e da retomada.
- Escrito, `hooks/panel.ts:374-381` e `355-361`: cada mudança regrava todos os grupos no state, no
  store e no arquivo publicado.
- Medido pela triagem (não refeito): uma sessão com 524 grupos de subagente, 148 KB dos 166 KB do
  painel dela; 204 KB dos 478 KB de painéis guardados.
- Decisões registradas que a resposta limita: `subagentes.cartao-fica-com-a-origem-fechada` (o cartão
  "sai junto com o pedido da tarefa, quando ele sai do trabalho ('+N pedidos anteriores')") e
  `subagentes.terminado-segue-cartao`. A resposta de 2026-11-14 cobre as duas.

## 3. O que muda

`hooks/panel.ts` (`joinWork`, o ponto em que o trabalho atual muda) com o que `hooks/tools.ts` já chama
no `plan` e no `start` do loop principal:

- Quando começa trabalho novo (a mensagem seguinte da pessoa ou de outra sessão, com o plan ou start
  dela), depois de gravar o trabalho, saem do painel os grupos de subagente que cumprem tudo isto:
  - terminou (o cartão não está "trabalhando" nem "em segundo plano"); um grupo antigo sem cartão
    (sem `sub`) conta como terminado;
  - não planejou nenhuma tarefa (lista de tarefas vazia);
  - o pedido dele saiu do trabalho: a tarefa de nível 1 de onde ele saiu (subindo por quem o lançou
    até o loop principal) não está no trabalho novo, ou ele não tem tarefa de origem;
  - nada vivo depende dele: nenhum subagente lançado por ele ainda rodando, nenhuma espera dele, e
    nenhuma mensagem a ele ainda na fila (não tomada nem dada como não entregue).
- Um grupo com tarefas próprias fica, como hoje, com tudo o que tem.
- A saída é uma gravação só do painel (o `change`), feita apenas quando há o que tirar.
- `draw/layout.ts`: nenhuma mudança esperada (grupo que não existe não é desenhado).

Em termos do painel: no trabalho atual nada muda; o cartão do subagente terminado segue sob a tarefa
✓ enquanto o pedido dela está à vista. Quando o pedido sai para "+N pedidos anteriores", abrir essa
linha mostra as tarefas antigas sem os cartões dos subagentes que não tinham tarefas; os que tinham
tarefas continuam lá. Um start que reabre uma tarefa antiga não traz os cartões de volta. O estado, o
store e o arquivo publicado deixam de crescer a cada workflow.

## 4. Impacto

`npm run impacto -- hooks/panel.ts hooks/tools.ts draw/layout.ts` (com o `layout.ts` por precaução):
147 cenários, o golden inteiro. Sem `draw/layout.ts`: `hooks/panel.ts hooks/tools.ts` afeta as áreas
de envios, turnos, pedidos, árvore, durabilidade, perguntas e 1 de subagentes. Checklist: os quatro
"no app" de subagentes valem como conferência.

## 5. Testes de verificação (`tests/subagentes.test.ts`)

Com `lancaveis`, `host(on, [])` (para ler o arquivo publicado) e os roteiros `lancar`,
`fimDoSubagente`, `comHistorico`:
- "o subagente terminado sem tarefas sai quando o pedido dele sai do trabalho". Regra:
  `subagentes.terminado-sem-tarefas-sai-com-o-pedido`. Pedido um, plan, start, um lançamento que
  termina, done com summary, fim do turno; pedido dois e plan. Afirma: com "+1 pedidos anteriores"
  aberto, a tarefa antiga aparece e o cartão do subagente não; o arquivo publicado (`h.proprio()`) só
  tem o grupo principal. Falha hoje: o cartão aparece sob a tarefa antiga e o grupo segue publicado.
- "o subagente com tarefas próprias fica no histórico". Mesma regra: o subagente planeja uma tarefa
  (`plan` com o id dele), termina; depois do pedido dois, o histórico aberto mostra o cartão com a
  tarefa dele. Passa hoje; protege o "manter os que têm tarefas próprias".
- "o subagente ainda em segundo plano não sai com o pedido". Mesma regra: lançado em segundo plano,
  ainda rodando quando o pedido dois começa: o grupo segue no arquivo publicado, e sai na mensagem
  seguinte ao fim dele.
- "start numa tarefa antiga não traz o cartão de volta". Mesma regra: depois do primeiro caso, start
  na tarefa do pedido um; ela volta a andamento sem cartão embaixo.
- Testes existentes: nenhum muda. Os de `subagentes.cartao-fica-com-a-origem-fechada` conferem o
  cartão sob a tarefa ✓ dentro do trabalho atual, e seguem valendo (nenhum abre o histórico: busca por
  `comHistorico` e "pedidos anteriores" em `tests/subagentes.test.ts` sem resultado).

## 6. Catálogo (`regras/subagentes.md`) e selos

Reescrito (`subagentes.cartao-fica-com-a-origem-fechada`): no "Então", o trecho "sai junto com o
pedido da tarefa, quando ele sai do trabalho ('+N pedidos anteriores'), como o cartão da sessão e a
carta" passa a "quando o pedido da tarefa sai do trabalho, o cartão do subagente terminado que não
planejou tarefas é apagado, e não aparece ao abrir '+N pedidos anteriores'; o que tem tarefas próprias
vai com o pedido para o histórico, como o cartão da sessão e a carta". Linha nova antes do `Estado:`:

`Reescrito: 2026-11-14, decisão do usuário ("Apagar os sem tarefas (Recomendado)"): o cartão do subagente terminado sem tarefas não vai para o histórico.`

Novo, `coberto`:

```markdown
### subagentes.terminado-sem-tarefas-sai-com-o-pedido
O subagente terminado que não planejou tarefas é apagado quando o pedido dele sai do trabalho atual.

- Dado um pedido com subagentes já terminados, uns sem tarefas no painel e outros com tarefas próprias
- Quando o pedido sai do trabalho atual (a mensagem seguinte começa trabalho novo, sem nada aberto à vista nele)
- Então os cartões dos subagentes sem tarefas saem do painel, do que é guardado e do que é publicado: ao abrir "+N pedidos anteriores" as tarefas antigas aparecem sem eles, e um start que reabra uma tarefa antiga não os traz de volta; os que têm tarefas próprias ficam no histórico; o que ainda roda, ou tem quem dependa dele, fica até terminar; no trabalho atual nada muda

Origem: decisão do usuário, 2026-11-14 ("Apagar os sem tarefas (Recomendado)"), à pergunta sobre os cartões de subagentes terminados que ficavam guardados para sempre (uma sessão com 524 deles); limita ao trabalho atual subagentes.terminado-segue-cartao e subagentes.cartao-fica-com-a-origem-fechada.
Código: hooks/panel.ts, hooks/tools.ts
Estado: coberto
```

Selos: `npm run regras:selar -- "task-tree/tests/subagentes.test.ts::<nome>" --tipo novo --motivo "decisão 2026-11-14: subagentes terminados sem tarefas saem com o pedido"`, um por teste novo. Nenhum
teste existente é selado de novo (não mudam).

## 7. Documentação

Comentário de `joinWork` em `hooks/panel.ts` e o topo de `hooks/agents.ts` (o grupo existe do
lançamento até o pedido dele sair do trabalho). `DESENVOLVIMENTO.md`: no lote 30.

## 8. Golden

Não muda (o cenário "subagente" tem um pedido só).

## 9. Checklist do app

- Um pedido com um workflow ou vários subagentes; na mensagem seguinte, com tudo concluído, abrir "+N
  pedidos anteriores": as tarefas antigas sem os cartões dos subagentes sem tarefas.
- `/task-tree` antes e depois numa sessão antiga com muitos subagentes: o tamanho do desenho cai.

## 10. Dependências e conflitos

- Depois do lote 08 (o painel menor é o que mais alivia o store).
- Triagem B, lotes 07 e 08 (`settleBySubs`, relançar depois de falha), 23 (freio das gravações do
  cartão) e 24 (subagente retomado volta a "trabalhando"): todos em `hooks/agents.ts`. O lote 24 de B
  importa aqui: a condição "terminou" daqui usa o estado do cartão como estiver definido na hora. Um
  subagente retomado depois de o grupo dele ter sido apagado (retomado num pedido posterior ao dele)
  não ganha cartão de novo: hoje o `agentSpawn` sai cedo na retomada (`hooks/agents.ts:69`) e não cria
  grupo. Se o lote 24 de B quiser o cartão nesse caso, é lá que o grupo é recriado.
- Triagem B, lote 14 (as tarefas do subagente contam no cabeçalho): só grupos com tarefas, que aqui
  ficam.
- Triagem A, lote 14 (o plan adota cartões criados antes do plan): mexe em `hooks/tools.ts` e
  `hooks/panel.ts`, perto do `joinWork`.

## 11. Bloqueio

Nenhum.
