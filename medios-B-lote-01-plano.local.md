# Lote 01: textos e catálogo dos envios, sem regra nova

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

## 1. O que cobre

Três correções diretas, nenhuma decisão do usuário:

- "O cenário do envio 'sem nada em andamento' diz 'pendente planejada por último', o Reescrito diz 'a
  primeira ainda sem carta', e dois desempates do código não estão escritos" (catálogo, teste novo,
  documentação).
- "Carta cinza 'interrompida'", parte que sobrou: o lembrete "recebimento confirmado" afirma que o painel
  concluiu a tarefa do envio mesmo quando não concluiu.
- "Carta cinza 'interrompida'", outra parte que sobrou: o texto de `envios.cor-por-estado` diz "cinza
  descartada antes da entrega" e o teste ligado afirma cinza depois da entrega.

Não reabrir: a cor da carta de plano interrompido (2026-11-12, "Cinza já no plan (Recomendado)").

## 2. Causa confirmada na ponta

- Ordem do envio sem nada em andamento, escrita no código: `hooks/panel.ts:257-273` (dentro de
  `sendAnchor`). Com nada iniciado e aberto: (a) o "pedido atual" é o maior `turn` entre os níveis 1
  (`:258-260`); (b) entre as pendentes sem subtarefas dele, a única cujo título casa com o nome
  (`byName`, `:262-263`); (c) senão o lote planejado por último, isto é, as pendentes com o mesmo
  `plannedAt` da mais nova (`:264-268`): a primeira na ordem do plano sem uso registrado (`used`: carta,
  rodada de sessão, sessão aberta, subagente lançado), e, todas com uso, a última do lote (`:269-270`; o
  `reduce` com `>=` fica com a última da ordem); (d) sem pendente, a iniciada por último, mesmo
  concluída (`startedLast`), e, sem nenhuma iniciada, o último nível 1 do pedido (`:272`).
- O cenário (`regras/envios.md`, `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo`) só diz
  "vai à pendente planejada por último; sem pendente, à última iniciada", mais a linha `Reescrito` de
  2026-11-09. Os dois testes ligados têm uma pendente só (`tests/envios.test.ts:126-152`).
- O lembrete: `hooks/sessions.ts:199-224` (`takenNote`) monta `SESSION.taken(what)` para todo envio
  tomado, e `text/rules.ts:242-244` diz sempre "O painel já concluiu a tarefa do envio". Mas
  `watchSends` (`hooks/sessions.ts:185-195`) só conclui a tarefa quando ela está aberta e sem subtarefa
  aberta: a tarefa interrompida por um plano novo (renomeada `tag:id`, ✕), a que saiu do plano e a que
  tem subtarefa aberta não são concluídas, e o texto diz que foram. Escrito no código; nada deduzido.
- `envios.cor-por-estado`: o Então diz "cinza descartada antes da entrega ou não entregue"; o teste
  `tests/envios.test.ts:33-52` ("a mensagem de um plano interrompido fica cinza depois da entrega")
  afirma cinza depois da entrega, que é o que o desenho faz (`draw/layout.ts:1361`, `cutHere`).

## 3. O que muda

Comportamento novo, em termos do painel: nada no desenho. Só o texto que o modelo recebe na entrega.

- `text/rules.ts`, `SESSION`: `taken` fica para os envios cuja tarefa está ✓ no painel; entra
  `takenOpen` para os outros. Textos exatos (os dois começam igual, porque os testes existentes leem
  "recebimento confirmado"):
  - `taken` (sem mudança): "…recebimento confirmado, a sessão começou a tratar a mensagem: <lista>. O
    painel já concluiu a tarefa do envio; se ela ainda tinha algo a fazer, reabra com
    mcp__task-tree__start."
  - `takenOpen` (novo): "…recebimento confirmado, a sessão começou a tratar a mensagem: <lista>. O painel
    não concluiu a tarefa do envio: ela segue como está no painel (aberta com subtarefa aberta ou com
    algo ainda em execução nela, interrompida por um plano novo, ou fora do plano). Se o trabalho dela
    terminou, feche-a com mcp__task-tree__done."
- `hooks/sessions.ts`, `takenNote`: separa os envios tomados de sessão (`sub(taken, false)`) em dois
  grupos pelo estado da tarefa do envio no momento do lembrete (a tarefa achada pelo `anchor` no grupo
  principal): `status === 'done'` vai a `SESSION.taken`; qualquer outro caso (interrompida, aberta, sem
  tarefa achada, sem `anchor`) vai a `SESSION.takenOpen`. A ordem das frases no lembrete: `taken`,
  `takenOpen`, `lost`, `takenSub`, `lostSub`. Os de subagente (`takenSub`, `lostSub`, do PR 38) não
  mudam: o texto deles já diz "o painel a concluiu, ou a conclui com o fim do subagente".
- `hooks/panel.ts`: só os comentários de `sendAnchor` (o bloco acima de `Used`, `:193-206`, e o de
  dentro, `:234-238`), reescritos com a ordem completa da seção 2. Nenhuma linha de código.
- `regras/envios.md`: seção 6.

## 4. Impacto

`npm run impacto -- task-tree/hooks/sessions.ts task-tree/text/rules.ts task-tree/hooks/panel.ts`:
103 cenários (todos os de envios, lembretes, pedidos, perguntas, sessões, durabilidade, parte de
cabeçalho e de árvore). Checklist do app: `envios.destino-arquivado-no-app`, `envios.subagente-no-app`.
Golden: nenhum cenário.

## 5. Testes

Novos, em `tests/envios.test.ts` (o arquivo já tem `cartasDe`, `contexto`, `responderEnvio`):

1. "sem nada em andamento, três envios e duas pendentes planejadas juntas: a primeira, a segunda e de
   novo a última". Cenário `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo`. Roteiro: host
   com três sessões (`local_x`, `local_y`, `local_z`), `responderEnvio`, pedido, `plan` de um nível 1
   com "Um" e "Dois", sem start; três envios com textos diferentes. Afirma: a carta do primeiro sob
   "Um"; as do segundo e do terceiro sob "Dois". Passa hoje (registra o desempate que não tinha teste).
2. "sem nada em andamento, o envio vai à pendente do plan mais recente do pedido, não à do primeiro".
   Mesmo cenário. Roteiro: pedido, `plan` A ("Um", "Dois"), relógio avança 1000 ms, `plan` de outro
   nível 1 no mesmo pedido com uma pendente "Novo", um envio. Afirma: a carta sob "Novo"; nenhuma
   carta sob "Um" nem "Dois". Passa hoje.
3. "a entrega de uma carta cuja tarefa um plano novo interrompeu não diz que o painel concluiu a
   tarefa". Cenário novo `envios.aviso-da-entrega-diz-o-que-o-painel-fez`. Roteiro igual ao do teste
   de `:33-52` (pedido um, plan, start, envio na fila, fim do turno, pedido dois, plan que reusa o id,
   `h.recebeu`, `aviso`), lendo o contexto do aviso (`contexto(aviso($))`). Afirma: contém
   "recebimento confirmado"; não contém "já concluiu a tarefa do envio"; contém "não concluiu a tarefa
   do envio". Falha hoje: o texto é sempre "O painel já concluiu a tarefa do envio".
4. "a entrega que conclui a tarefa diz que o painel a concluiu". Mesmo cenário novo. Roteiro: pedido,
   plan, start, envio na fila, `h.recebeu`, `aviso`. Afirma: a tarefa ✓ e o contexto com "já concluiu
   a tarefa do envio". Passa hoje (fixa o lado que não muda).

Testes existentes: nenhum muda. Os quatro que leem "recebimento confirmado"
(`tests/envios.test.ts:482`, `:507`, `:609`, `:665`) seguem passando com os dois textos.

## 6. Catálogo e selos

`regras/envios.md`:

- `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo`, título e corpo reescritos, sem mudar a
  regra:
  - Título: "Sem nada em andamento, o envio vai às pendentes planejadas por último, pela ordem."
  - Dado nada em andamento no pedido atual (o último pedido com tarefas)
  - Quando sai uma mensagem
  - Então ela vai, nesta ordem: à pendente cujo título casa com o nome da sessão destino
    (envios.carta-pelo-nome-da-sessao); senão, entre as pendentes do plan mais recente do pedido, à
    primeira na ordem do plano ainda sem carta, sessão ou subagente; todas já com um deles, à última
    delas; sem nenhuma pendente, à tarefa iniciada por último, mesmo concluída; sem nenhuma iniciada,
    ao último nível 1 do pedido
  - Linha nova antes do `Estado:`: `Reescrito: 2026-11-14, texto completado com a ordem que o código já
    segue (auditoria 2026-11-10: o corpo dizia só "a pendente planejada por último"); nenhuma regra muda
    e os testes existentes não mudam.`
- `envios.cor-por-estado`: no Então, trocar "cinza descartada antes da entrega ou não entregue" por
  "cinza quando a tarefa de onde saiu foi interrompida por um plano novo, desde o plan e também depois
  da entrega, ou quando não é entregue". Linha nova: `Reescrito: 2026-11-14, texto alinhado ao teste e à
  decisão de 2026-11-12 ("Cinza já no plan (Recomendado)"); nenhuma regra muda e os testes não mudam.`
- Cenário novo `envios.aviso-da-entrega-diz-o-que-o-painel-fez`:
  - Título: "O aviso da entrega só diz que o painel concluiu a tarefa quando ela ficou concluída."
  - Dado uma carta na fila
  - Quando a sessão destino toma a mensagem e o modelo recebe o aviso "recebimento confirmado"
  - Então o aviso diz que o painel concluiu a tarefa do envio só quando ela está ✓; se ela foi
    interrompida por um plano novo, saiu do plano ou segue aberta (subtarefa aberta, ou algo ainda em
    execução nela), diz que o painel não a concluiu e que o modelo a fecha quando o trabalho terminar
  - `Origem: auditoria 2026-11-10 (o lembrete "recebimento confirmado" dizia "o painel já concluiu a
    tarefa do envio" sem ter concluído); aplica envios.fica-ate-entrega, sem mudar nenhuma regra.`
  - `Código: text/rules.ts`
  - `Estado: coberto`

Selos (todos `novo`), depois de escrever os testes:

    npm run regras:selar -- "task-tree/tests/envios.test.ts::sem nada em andamento, três envios e duas pendentes planejadas juntas: a primeira, a segunda e de novo a última" --tipo novo --motivo "desempate do envio sem nada em andamento, sem teste até a auditoria de 2026-11-10"
    npm run regras:selar -- "task-tree/tests/envios.test.ts::sem nada em andamento, o envio vai à pendente do plan mais recente do pedido, não à do primeiro" --tipo novo --motivo "lote planejado por último, sem teste até a auditoria de 2026-11-10"
    npm run regras:selar -- "task-tree/tests/envios.test.ts::a entrega de uma carta cuja tarefa um plano novo interrompeu não diz que o painel concluiu a tarefa" --tipo novo --motivo "o aviso da entrega só diz que concluiu quando concluiu"
    npm run regras:selar -- "task-tree/tests/envios.test.ts::a entrega que conclui a tarefa diz que o painel a concluiu" --tipo novo --motivo "o aviso da entrega só diz que concluiu quando concluiu"

## 7. Documentação

`DESENVOLVIMENTO.md`: procurar `sendAnchor`. Em "Como é hoje" (fluxo de dados, onde o envio é
descrito), uma frase com a ordem completa da seção 2. Nas entradas do histórico que ainda dizem só "a
última iniciada" ou "a pendente planejada por último" (a de "Sem start, nada aceso" e a de "Tarefa que
enviou a mensagem"), acrescentar no fim "(regra de hoje: a ordem completa em Como é hoje)", sem
reescrever o histórico. Em "Textos para o modelo", citar `SESSION.takenOpen`. O `CLAUDE.md` não muda.

## 8. Golden

Não muda (nenhuma linha do desenho é tocada).

## 9. Checklist do app

Nada novo. Opcional: numa entrega real de carta cuja tarefa um plano novo interrompeu, ler o lembrete.

## 10. Dependências e conflitos

- Nenhum lote antes. Os lotes 02 e 03 mexem na mesma função (`sendAnchor`) e reescrevem de novo os
  comentários dela: este vem primeiro.
- Lote 07 (fechamento automático) muda quando a entrega conclui a tarefa; a separação `taken` /
  `takenOpen` deste lote, feita pelo estado da tarefa na hora do lembrete, continua valendo sem mudança.
- Triagem A, decisão 13 ("Sim, o plan adota (Recomendado)": carta e cartão criados antes do plan do
  pedido): muda o item (a) da ordem (o "pedido atual" quando o pedido novo ainda não tem tarefas). O
  texto do cenário reescrito aqui diz "o último pedido com tarefas"; o lote de A ajusta essa frase.
- Triagem C, decisão 42 ("Cenário por texto (Recomendado)"): se C criar um cenário por texto ao modelo,
  o `SESSION.takenOpen` entra na lista dela; o cenário novo daqui pode ser o dela.

## 11. Bloqueio

Nenhum.
