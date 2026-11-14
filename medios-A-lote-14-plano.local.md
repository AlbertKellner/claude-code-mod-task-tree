# Lote 14: carta e cartão criados antes do plan do pedido: soltos no fim, e o plan os adota

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário, que junta um achado da triagem A e um da B; a triagem B não a planeja).

## 1. O que cobre

- Achado da triagem A "Cartão sem âncora some do painel quando a filha conclui, e sem a linha "+N pedidos
  anteriores" não há como vê-lo" (decisão 10: resposta livre do usuário, "Se existe uma sessão filha ou
  subagente criados antes do plan, eles deveriam se planejadas para mostrar corretamente na lista, o que
  acha?", levada de novo como a 13).
- Achado da triagem B "Carta, sessão ou subagente disparados antes do plan do pedido novo ancoram no
  pedido anterior".
- Decisão 13, 2026-11-14: **"Sim, o plan adota (Recomendado)"**: "soltos no fim só até o primeiro plan do
  pedido, que os adota sob a tarefa pelo nome da sessão, senão a primeira pendente; as regras pedem
  planejar antes de abrir sessão ou lançar subagente". A opção da pergunta da B, por inteiro: "até o
  plan, a carta e o cartão ficam soltos no fim do painel; quando o plan do pedido chega, passam para a
  tarefa dele escolhida pela regra de sempre (o nome da sessão, senão a primeira pendente). Nenhuma
  tarefa do pedido anterior ganha carta nem fecha por causa deles."

## 2. Causa confirmada na ponta atual

Escrito no código:
- `hooks/panel.ts:255-272` (`sendAnchor`, sem nada em andamento): o "pedido atual" é o maior `turn` entre
  as tarefas existentes; com o pedido novo ainda sem plan, é o pedido anterior. A carta, a sessão e o
  subagente vão para uma pendente dele, senão para a última iniciada, senão para o último nível 1.
- Os três chamadores usam a mesma função: `hooks/tool-call.ts:119` (mensagem), `hooks/sessions.ts:244`
  (`recordStart`), `hooks/agents.ts:48-56` (`anchorIn`, o lançamento).
- `hooks/sessions.ts:180-195` (`watchSends`): na entrega, o painel conclui a tarefa do envio; aqui, a
  pendente do pedido anterior.
- `hooks/agents.ts:267-308` (`settleBySubs`): o fim do subagente fecha a folha de onde saiu.
- `draw/layout.ts:1344-1350` (`levelOne`/`hostOf`): a carta sem tarefa no plano pende do último nível 1 do
  pedido em que foi enviada e, sem tarefa nesse pedido, do último nível 1 do painel inteiro.
- `layout.ts:1640-1642`: o cartão de sessão sem tarefa de origem só é desenhado no fim enquanto vivo
  (`alive`); concluído, some (a linha "+N cartões antigos" só existe com o histórico aberto).
- Teste selado que afirma o comportamento de hoje: `tests/subagentes.test.ts:375` ("lançado num pedido
  sem plano depois de um pedido todo concluído, o cartão aparece sob a última tarefa iniciada").

Decisão anterior que esta refina: 2026-10-23, "envio feito sem tarefa em andamento ancora na última
iniciada do pedido atual, mesmo concluída; sem nenhuma iniciada, no fim do pedido" (não previa o pedido
ainda sem tarefas).

## 3. O que muda

`hooks/panel.ts`, `hooks/tool-call.ts`, `hooks/sessions.ts`, `hooks/agents.ts`, `hooks/tools.ts`,
`draw/layout.ts`, `text/rules.ts`, `types/index.d.ts`.

### 3.1 Antes do plan: sem tarefa de origem

- `sendAnchor` ganha o pedido aberto agora (o id do último turno do grupo principal). No ramo "nada em
  andamento": se nenhuma tarefa de nível 1 é desse pedido, devolve `undefined` (sem tarefa de origem).
  Com algo em andamento (o modelo deu start numa tarefa neste turno), nada muda. Para o grupo de um
  subagente (sem turnos), nada muda.
- Os três chamadores passam o pedido aberto. A carta (`Send`), a entrada da sessão (`Child.anchor`, a
  rodada) e o grupo do subagente (`Group.anchor`) ficam sem tarefa de origem.
- Consequência direta: nenhuma tarefa do pedido anterior ganha carta, cartão ou fecha por causa deles
  (`watchSends` e `settleBySubs` só agem em quem tem tarefa de origem).

### 3.2 Desenho dos soltos (`draw/layout.ts`)

- Carta sem tarefa: `levelOne` só usa o último nível 1 do painel quando não dá para saber o pedido do
  envio; quando o pedido do envio é conhecido e não tem tarefa, a carta não tem onde pender. As cartas
  sem onde pender são desenhadas no fim da lista do painel (antes dos cartões soltos), no nível da base,
  com o mesmo texto, cor e palavra de hoje; só as do pedido aberto agora (enviadas desde o começo do
  último turno) ou ainda na fila. Vale também dentro do cartão de uma filha (as cartas dela).
- Cartão de sessão sem tarefa: além dos vivos, o cartão sem tarefa de origem aberto no pedido aberto
  agora (`openedAt` desde o começo do último turno) é desenhado no fim mesmo concluído, com o nome
  simples (sem "do pedido …").
- Cartão de subagente sem tarefa: já termina a lista (`lost`, `layout.ts:1479`); não muda.

### 3.3 O plan adota (`planTool`, só o loop principal)

Depois de gravar as tarefas, quando o plan deu tarefas ao pedido aberto agora e o turno tem hora (`at`):
- órfãos do pedido: as cartas sem tarefa enviadas desde o começo do turno; as sessões sem tarefa de
  origem abertas desde então (e as rodadas delas sem tarefa, do mesmo período); os grupos de subagente
  do loop principal sem tarefa, lançados desde então;
- na ordem em que foram criados, cada um recebe a tarefa que `sendAnchor` devolve agora (a regra de
  sempre: o nome da sessão ou do subagente contra os títulos; senão, com nada em andamento, a primeira
  pendente planejada junto ainda sem carta, e a última quando todas têm), contando os já adotados como
  uso da tarefa. A carta e a rodada do mesmo envio vão para a mesma tarefa;
- as ligações adotadas vão ao store junto (o `publishPanel` do fim do plan já chama `saveLinks`).

Dedução do planejador (não está na decisão; escolhido por segurança): a adoção é só de lugar. A tarefa
que adota **não fecha sozinha** por causa do adotado:
- a carta adotada leva uma marca nova (`Send.adopted`), e a entrega dela não conclui a tarefa
  (`watchSends`, `sessions.ts:182`, e `takeSubSend`, `agents.ts:331-343`, pulam a marcada);
- o subagente adotado foi lançado antes de a tarefa ser planejada, e `ofLeaf` (`agents.ts:264-266`) já o
  deixa fora do fechamento automático.
Motivo: a tarefa que adota é a "primeira pendente", que o modelo não ligou àquela mensagem; fechá-la na
entrega marcaria como feito um trabalho que não começou.

### 3.4 Textos ao modelo (`text/rules.ts`), texto exato

- `RULES`, item novo antes do item da mensagem a outra sessão: "- Planeje antes de delegar: num pedido
  novo, chame mcp__task-tree__plan e marque com start a tarefa antes de mandar mensagem a outra sessão
  (SendMessage), abrir sessão (start_session) ou lançar subagente (Agent). O que for criado antes do plan
  do pedido fica solto no fim do painel, e o primeiro plan do pedido o adota: vai para a tarefa cujo
  título casa com o nome da sessão ou do subagente, senão para a primeira pendente."

### Comportamento novo no painel

Pedido novo, e o modelo manda uma mensagem (ou abre uma sessão, ou lança um subagente) antes do plan:
a carta e o cartão aparecem no fim do painel, fora de qualquer tarefa; a pendente esquecida do pedido
anterior segue ○ e não fecha na entrega. Quando o plan do pedido chega, a carta e o cartão passam para
baixo da tarefa dele que casa pelo nome, senão da primeira pendente, e ficam lá. Sem plan nenhum no
pedido, seguem soltos enquanto o pedido é o aberto (o cartão vivo segue solto depois, como hoje).

## 4. Impacto

`npm run impacto -- hooks/panel.ts hooks/tool-call.ts hooks/sessions.ts hooks/agents.ts hooks/tools.ts
draw/layout.ts text/rules.ts types/index.d.ts`: núcleo tocado (`types/index.d.ts`): todos os 159 cenários
cobertos; os 4 do golden e o checklist inteiro aparecem. Ver 8.

## 5. Testes

Novos:
1. `tests/envios.test.ts`, regra `envios.antes-do-plan-fica-solta-e-o-plan-adota` (nova):
   **"a carta enviada antes do plan do pedido novo fica solta no fim, não fecha tarefa do pedido anterior,
   e o plan do pedido a adota"**. Roteiro: `const { relogio } = fixar(on)`; `const h = host(on, [{ id:
   'local_x', nome: 'outra', rodando: false }])`; `responderEnvio(on)`; `pedido`; `plan(A)` ("Um" e
   "Dois"); `start(['1'])`; `done(['1'])`; `fimDoTurno`; `relogio.advance(1000)`; `pedido($, 'Pedido
   dois')`; `envio($, 'local_x', 'Revise')`; `aviso`.
   Afirma: `cartaSob(p, 'Dois')` e `cartaSob(p, 'Um')` indefinidas; a linha "Para outra: Revise" existe,
   com `carta` "fila", depois da última linha de pedido; "Dois" pendente. Depois `h.recebeu('local_x',
   AGORA + 1000)` e `aviso`: "Dois" segue pendente e a carta fica "entregue". Depois `plan` de "B" com
   "b1" "Bê um" e "b2" "Bê dois": `cartaSob(p, 'Bê um')` é "entregue" e "Bê um" segue pendente.
   Falha hoje: a carta nasce sob "Dois", e a entrega conclui "Dois".
2. `tests/sessoes.test.ts`, regra `sessoes.aberta-antes-do-plan-e-adotada` (nova):
   **"a sessão aberta antes do plan do pedido fica solta no fim, mesmo concluída, e o plan a adota pelo
   nome"**. Roteiro: `fixar` com relógio; `host` com K1 de nome "pesquisa-web", parada
   (`rodando: false`), com uma tarefa concluída; `pedido`; `plan(A3)`; `start(['1'])`; `done(['1'])`;
   `fimDoTurno`; avançar; `pedido($, 'Pedido dois')`; `abrirSessao`; `aviso`.
   Afirma: há o cartão "pesquisa-web" e `cartoes(p, 'pesquisa-web')[0].sob` não é "Um", "Dois" nem
   "Três" (o cartão está depois da última linha de pedido). Depois `plan` de "N" com "n1"
   "Implementação" e "n2" "Pesquisa web: changelog", e `aviso`: `cartoes(...).map(c => c.sob)` igual a
   `['Pesquisa web: changelog']`.
   Falha hoje: o cartão nasce sob uma pendente do pedido um.
3. `tests/sessoes.test.ts`, mesma regra: **"sem nome que case, a sessão aberta antes do plan vai à
   primeira pendente do plan"**: como em 2, com a filha de nome "filha-um" e o plan com "n1" e "n2" de
   títulos sem relação: sob "n1".
4. `tests/subagentes.test.ts`, regra `subagentes.lancado-antes-do-plan-e-adotado` (nova):
   **"o subagente lançado antes do plan do pedido termina a lista, o plan o adota e o fim dele não fecha a
   tarefa que o adotou"**. Roteiro: `fixar`; `lancaveis(on, ['sub-1'])`; pedido um com "Investigar"
   concluída; `fimDoTurno`; `pedido($, 'Pedido dois')`; `lancar($, { descricao: 'conferir o diff' })`;
   `fimDoSubagente($, 'sub-1')`; `plan` de "B" com "b1" "Conferir"; `fimDoTurno`.
   Afirma: `abaixo(p, 'Conferir')` contém "Explore: conferir o diff"; "Conferir" pendente; "Investigar"
   não tem o cartão embaixo.
   Falha hoje: o cartão fica sob "Investigar".
5. `tests/subagentes.test.ts`, regra `subagentes.cartao-fica-com-a-origem-fechada`:
   **"no mesmo pedido, com tudo concluído, o lançamento vai à última tarefa iniciada, já fechada"**.
   Roteiro: `pedido`; `plan` com "Investigar"; `start`; `done`; `lancar`. Afirma: o cartão sob
   "Investigar", com "trabalhando". Passa hoje: mantém coberta a parte do cenário que não muda.
6. `tests/lembretes.test.ts`, regra `lembretes.planejar-antes-de-delegar` (nova): **"as regras pedem o
   plan antes de mandar mensagem, abrir sessão ou lançar subagente"**: as regras do prompt de sistema
   contêm "Planeje antes de delegar" e "o primeiro plan do pedido o adota".

Teste existente que muda (decisão registrada), `tests/subagentes.test.ts:375`, **mantendo o nome** (a
`regressao` libera pela chave; se a correção da triagem C para renomear teste por decisão já estiver na
ponta, renomear com ela para "lançado num pedido sem plano, o cartão termina a lista e não vai a tarefa do
pedido anterior"):
- "lançado num pedido sem plano depois de um pedido todo concluído, o cartão aparece sob a última tarefa
  iniciada". O corpo mantém o roteiro e passa a afirmar: `abaixo(p, 'Investigar')` **não** contém
  "Explore: conferir o diff"; a linha "Explore: conferir o diff" existe, depois da linha "Investigar", e
  contém "trabalhando". Duas asserções viram três. Um comentário acima do teste diz que o nome ficou
  por causa do selo e que a regra mudou em 2026-11-14.

Varredura feita: nenhum outro teste manda mensagem, abre sessão ou lança subagente num pedido ainda sem
plan nem start. Outro teste de `HEAD` que falhe: relatar.

## 6. Catálogo e selos

Cenários novos:

```markdown
### envios.antes-do-plan-fica-solta-e-o-plan-adota
A carta enviada antes do plan do pedido fica solta no fim, e o plan do pedido a adota.

- Dado um pedido novo ainda sem plano, com ou sem tarefas abertas de pedidos anteriores, e nada em andamento
- Quando o modelo manda uma mensagem a outra sessão, e depois planeja o pedido
- Então, até o plan, a carta fica no fim do painel, fora de qualquer tarefa, e nenhuma tarefa de pedido anterior ganha carta nem fecha na entrega; no primeiro plan do pedido, a carta passa para a tarefa dele escolhida como em qualquer envio (o nome da sessão, senão a primeira pendente ainda sem carta) e fica lá; a tarefa que a adotou não fecha sozinha na entrega

Origem: decisão do usuário, 2026-11-14 ("Sim, o plan adota (Recomendado)"), sobre os achados da auditoria de 2026-11-10 (a carta ia a uma pendente do pedido anterior, que fechava sozinha). Refina "envio feito sem tarefa em andamento ancora na última iniciada do pedido atual" (2026-10-23) para o pedido ainda sem tarefas.
Código: hooks/tools.ts, draw/layout.ts, text/rules.ts
Estado: coberto
```

```markdown
### sessoes.aberta-antes-do-plan-e-adotada
A sessão aberta antes do plan do pedido fica solta no fim, e o plan do pedido a adota.

- Dado um pedido novo ainda sem plano e nada em andamento
- Quando o modelo abre uma sessão filha, e depois planeja o pedido
- Então, até o plan, o cartão fica no fim do painel, mesmo se a filha já concluiu, sem tarefa de pedido anterior; no primeiro plan do pedido, o cartão passa para a tarefa cujo título casa com o nome da sessão, senão para a primeira pendente, e segue lá, vivo ou concluído

Origem: decisão do usuário, 2026-11-14 ("Sim, o plan adota (Recomendado)"; antes, na resposta livre: "Se existe uma sessão filha ou subagente criados antes do plan, eles deveriam se planejadas para mostrar corretamente na lista").
Código: hooks/tools.ts, hooks/panel.ts
Estado: coberto
```

```markdown
### subagentes.lancado-antes-do-plan-e-adotado
O subagente lançado antes do plan do pedido termina a lista, e o plan do pedido o adota.

- Dado um pedido novo ainda sem plano e nada em andamento
- Quando o modelo lança um subagente, e depois planeja o pedido
- Então, até o plan, o cartão termina a lista, sem tarefa de pedido anterior; no primeiro plan do pedido, passa para a tarefa cujo título casa com a descrição ou o tipo dele, senão para a primeira pendente; o fim dele não fecha a tarefa que o adotou (subagentes.lancado-antes-da-tarefa-nao-conta)

Origem: decisão do usuário, 2026-11-14 ("Sim, o plan adota (Recomendado)").
Código: hooks/tools.ts, hooks/panel.ts
Estado: coberto
```

```markdown
### lembretes.planejar-antes-de-delegar
As regras do painel pedem o plan antes de mandar mensagem, abrir sessão ou lançar subagente.

- Dado as regras do painel no prompt de sistema
- Quando o modelo as lê
- Então elas dizem para planejar e dar start antes de delegar, e que o que for criado antes do plan fica solto no fim até o primeiro plan do pedido, que o adota

Origem: decisão do usuário, 2026-11-14 ("Sim, o plan adota (Recomendado)": "as regras pedem planejar antes de abrir sessão ou lançar subagente").
Estado: coberto
```

Cenários que ganham `Reescrito: 2026-11-14, decisão do usuário ("Sim, o plan adota (Recomendado)")`:
- `subagentes.cartao-fica-com-a-origem-fechada`: no "Quando", "ou já fechada quando o lançamento vai a
  ela" ganha "(no mesmo pedido; num pedido ainda sem plano vale subagentes.lancado-antes-do-plan-e-adotado)".
  O teste `subagentes.test.ts:375` muda.
- `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo`: no "Dado", "nada em andamento no pedido
  atual" ganha ", que já tem plano (sem plano: envios.antes-do-plan-fica-solta-e-o-plan-adota)". Os
  testes não mudam.
- `sessoes.cartao-sob-a-tarefa-de-origem`: acrescentar ao "Então" "; a sessão aberta num pedido ainda sem
  plano fica solta até o plan (sessoes.aberta-antes-do-plan-e-adotada)". Os testes não mudam.

Selos: `--tipo decisao` para "task-tree/tests/subagentes.test.ts::lançado num pedido sem plano depois de
um pedido todo concluído, o cartão aparece sob a última tarefa iniciada", com `--motivo "decisão do
usuário, 2026-11-14: \"Sim, o plan adota (Recomendado)\"; num pedido sem plano o cartão termina a lista"`;
`--tipo novo` para os seis nomes novos da seção 5, com o motivo `decisão do usuário, 2026-11-14: "Sim, o
plan adota (Recomendado)"`.

## 7. Documentação

`DESENVOLVIMENTO.md`: o parágrafo "Sem start, nada aceso" e o item "Tarefa que enviou a mensagem
(`sendAnchor`…)" (~1292-1297), com o pedido ainda sem plano e a adoção; a linha do `planTool` em "Os 14
hooks"; entrada em "Decisões (histórico)". Comentário de `Send` em `types/index.d.ts:212-224` com a marca
nova.

## 8. Golden

Não deve mudar: nenhum cenário do golden envia, abre sessão ou lança subagente num pedido sem plano. Se
mudar, conferir.

## 9. Checklist do app

- No app, num pedido novo, mandar mensagem a uma filha antes do plan: a carta aparece no fim do painel
  (linha sem guia de árvore, no nível dos pedidos), e passa para a tarefa quando o plan chega.
- Abrir uma sessão antes do plan: o cartão no fim, e sob a tarefa depois do plan.

## 10. Dependências e conflitos

- Depois dos lotes 02 e 03 (`planTool`), 07 (com ele, "em andamento" é só o que recebeu start no turno)
  e 12 (`recordStart`, `sentMessage`).
- Lote 15 (cartão cuja tarefa sai do plano) mexe em `planTool` e no desenho dos soltos: vem depois.
- Triagem B, na mesma função `sendAnchor`: decisão 19 ("Sob a em andamento": sai o ramo da pendente
  planejada depois do início) e decisão 20 ("Só no nome": o casamento por palavra); a correção do
  cenário "sem nada em andamento" e os dois desempates. A adoção chama `sendAnchor` como estiver na
  ponta. As correções "os dois fechamentos automáticos usam condições diferentes" e "nada mais em
  execução nela" mexem em `watchSends`, `takeSubSend` e `settleBySubs`: manter a carta adotada fora do
  fechamento. A correção "a mesma carta aparece em todos os cartões de rodada… a carta órfã de replano
  pendura em outro pedido" mexe em `levelOne`/`hostOf`: juntar com a regra da carta sem onde pender.
- Triagem C: decisão 32 (/clear com filhas: "Some na hora") e as correções das ligações mexem em
  `children` e `sends`.

## 11. Bloqueio

Nenhum. Um ponto fica dito para a orquestradora: a regra "a tarefa que adota não fecha sozinha" é
dedução do planejador (seção 3.3); se o usuário preferir que a adotada feche na entrega como qualquer
tarefa de envio, é só tirar a marca.
