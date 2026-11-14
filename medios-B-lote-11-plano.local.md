# Lote 11: cartas dentro dos cartões (e a carta órfã de replano)

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit. Só
`draw/layout.ts` muda.

## 1. O que cobre

Correções diretas, nenhuma decisão nova:

- "A mesma carta aparece em todos os cartões de rodada da filha (e, no painel principal, a carta órfã de
  replano pendura em outro pedido)".
- "Carta cinza 'interrompida'", a parte que sobrou do desenho: no cartão de uma filha parada com Esc (ou
  arquivada), as cartas já entregues aparecem cinza "interrompida"; e a tarefa fechada ✕ pelo fim de um
  subagente deixa cinza a carta já entregue dela.

Não reabrir: a carta de uma tarefa interrompida por um plano novo é cinza já no plan, mesmo depois da
entrega (2026-11-12, "Cinza já no plan (Recomendado)").

## 2. Causa confirmada na ponta

- Carta repetida nos cartões: `draw/layout.ts:480-488` (`split`). Cada cartão de rodada recebe `...p`, o
  painel inteiro da filha, e só reparte grupos, avisos, sessões e trabalho; `sends` vai inteiro para
  todos. Em `panel`, a carta sem a tarefa de origem naquele cartão cai no último nível 1 dele
  (`levelOne`, `:1344-1349`, e `hostOf`, `:1350`). O chip "aguardando sessão" conta linhas de carta na
  fila (`hooks/render.tsx:294`), então a carta repetida conta duas vezes.
- Carta órfã no painel principal: o mesmo `levelOne`. Ele procura o pedido do envio (o último pedido
  aberto até o instante do envio) entre `main.tasks`, que no painel principal são só as tarefas do
  trabalho desenhado; sem nenhuma, cai em `main.tasks[main.tasks.length - 1]`, o último nível 1 do último
  pedido. E `openInSight` (`:784-799`) só segura à vista o pedido de uma carta na fila cujo `anchor` ainda
  é uma tarefa do pedido (`:791`): a carta cuja tarefa saiu num replano não segura nada, o pedido sai do
  trabalho no plan seguinte e a carta passa a pender do pedido novo.
- Carta entregue cinza no cartão: `:1316` e `:1361`. Num cartão, `cutHere` são as tarefas com estado
  "interrompida" do painel que `session` passa a `panel`, e esse painel já foi lido como parado
  (`panelOf`, `:171-182`: a filha parada com Esc tem as iniciadas lidas como interrompidas; a arquivada,
  todas as abertas). No painel da própria filha, o conjunto vem do state, antes de qualquer leitura de
  parada (`cutAt`, `:1055`). Contra `envios.esc-apos-entrega-imediata` ("a carta segue verde").
- Carta entregue cinza pela tarefa ✕ do subagente: `cutAt` e `cutHere` são "toda tarefa interrompida";
  a que `settleBySubs` fecha ✕ (`hooks/agents.ts:298-302`) entra, e a carta já entregue dela fica cinza.

Escrito no código. Como distinguir a tarefa interrompida por um plano novo: é a única que o plan
renomeia (`hooks/tools.ts:55` e `:80`, a cópia antiga vira `tag:id`); o fechamento pelos subagentes não
renomeia. `resolveAnchor` (`:262-273`) já lê essa convenção.

## 3. O que muda

Em `draw/layout.ts`:

1. `split`: os envios da filha são repartidos entre os cartões, como os avisos e as sessões. A carta vai
   ao cartão que tem a tarefa de origem (o `anchor` dela); sem tarefa de origem em nenhum cartão, ao
   cartão do turno em que foi enviada (o último turno da filha aberto até o instante do envio); sem isso,
   ao cartão principal da sessão (`lead`). O cartão único (sem repartição) segue com todos.
2. `panel`, `levelOne` e `hostOf`: a carta sem tarefa de origem pende do último nível 1 do pedido em que
   foi enviada, procurado entre todas as tarefas do painel (`main.whole ?? main.tasks`). Se esse pedido
   não está desenhado, a carta não é desenhada em outro pedido (ela fica com o pedido dela, em "+N pedidos
   anteriores"). A queda para o último nível 1 da lista fica só para o painel sem pedidos (formatos
   antigos).
3. `openInSight`: uma carta na fila (`!taken && !cut`) cuja tarefa não está mais no plano, enviada num
   dos pedidos à vista (pelo instante do envio contra os turnos), segura esse pedido à vista, como a
   carta com tarefa já segura. Assim o pedido fica no trabalho enquanto ela espera (a mesma linha da
   decisão de 2026-11-12, "Sim, fica à vista (Recomendado)").
4. Cor da carta (`letters`): "cinza interrompida" só para a carta de uma tarefa interrompida por um
   plano novo (a cópia renomeada pelo plan), no painel principal e nos cartões. O conjunto sai sempre das
   tarefas como a sessão as publicou (num cartão, do painel publicado da filha, não da leitura de
   parada). Uma função pequena ao lado de `resolveAnchor` diz se a tarefa é a cópia renomeada por um
   plan. A ordem dos estados fica: não entregue ("lost"); cortada (`cut` do envio, ou tarefa
   interrompida por plano); entregue; e, num cartão de sessão arquivada, a carta não tomada segue cinza
   como hoje; senão, na fila.
5. `panelOf`, ramo da filha parada: a leitura de parada passa a poupar as tarefas com carta da própria
   filha ainda na fila (os `anchor` dos `sends` publicados não tomados), como o painel dela faz (`halt`
   com `sent`): a tarefa aparece ◷ com a carta azul, não ✕ com a carta cinza. Se a `regressao` acusar um
   teste coberto por causa deste item, o implementador o tira do commit e relata; os itens 1 a 4 não
   dependem dele.

No painel:

- filha com dois cartões que mandou sinal a uma irmã: a carta "Para <irmã>: …" aparece uma vez, sob a
  tarefa de origem, no cartão dela; o chip "aguardando sessão" conta uma;
- carta na fila cuja tarefa saiu num replano: segue sob o nível 1 do pedido em que foi enviada, e esse
  pedido segue à vista até a entrega, mesmo com um pedido novo;
- cartão de filha parada com Esc ou arquivada: a carta já entregue segue verde, como no painel dela;
- tarefa que fechou ✕ "falhou" (ou "interrompida") pelo subagente: a carta já entregue dela segue verde.

## 4. Impacto

`npm run impacto -- task-tree/draw/layout.ts`: 110 cenários. Golden pelo mapa: os quatro. O desenho dos
quatro não deve mudar: no `envios` as três cartas são do painel principal, de tarefas não renomeadas (a
terceira está na fila depois do Esc, azul hoje e depois); nenhum cenário tem carta em cartão de filha.
Se o golden `envios` acusar diferença, é erro da implementação, não desenho novo.

## 5. Testes

Novos:

1. `tests/sessoes.test.ts`: "a carta da filha com dois cartões aparece uma vez, no cartão da tarefa de
   origem". Cenário novo `envios.carta-uma-vez-no-cartao-da-origem`. Roteiro: uma filha com duas rodadas
   (o ajudante `duasRodadas` do arquivo, ou a montagem dele), publicando `envios: [{ to: <irmã ou
   'local_y'>, anchor: <id da tarefa da segunda rodada>, at: <depois do turno dela> }]`. Afirma: uma só
   linha "Para …" no painel, sob a tarefa da segunda rodada; `cabecalho(p).chips.sessao` igual a 1. Falha
   hoje: duas linhas (a outra sob o último nível 1 do primeiro cartão) e chip 2.
2. `tests/envios.test.ts`: "a carta na fila cuja tarefa saiu num replano segue no pedido dela, que fica à
   vista com o pedido novo". Cenários `envios.carta-uma-vez-no-cartao-da-origem` e
   `pedidos.replano-mantem-envio-ate-entrega`. Roteiro: o do teste de `:172-192` até o replano que tira
   "Um" (a carta pende de "Plano A"); `done` no que resta; fim do turno; relógio avança; pedido dois;
   plan de um nível 1 "Plano B". Afirma: "Plano A" segue desenhado, com a carta na fila sob ele; nenhuma
   carta sob "Plano B". Falha hoje: o pedido um sai do trabalho e a carta pende de "Plano B".
3. `tests/sessoes.test.ts`: "no cartão da filha parada com Esc, a carta já entregue segue verde".
   Cenário `envios.esc-apos-entrega-imediata`. Roteiro: uma filha com uma tarefa iniciada e `envios: [{
   to: 'local_y', anchor: <id dela>, at: …, taken: true }]`; depois de aberta, `rodando = false` e
   `aborted = true`; `aviso`. Afirma: a carta sob a tarefa, entregue. Falha hoje: interrompida.
4. `tests/envios.test.ts`: "a carta já entregue de uma tarefa que fechou ✕ pelo subagente que falhou
   segue verde". Cenário `envios.cor-por-estado`. Roteiro: `lancaveis`; `responderEnvio` em modo
   `entregue`; pedido; plan com "Um"; start; `envio`; `lancar`; `fimDoSubagenteCom(…, { erro: true })`;
   fim do turno. Afirma: "Um" interrompida com "falhou" e a carta sob ela entregue. Falha hoje: carta
   interrompida.

Testes existentes: nenhum muda. Conferir em especial "a mensagem de um plano interrompido fica cinza
depois da entrega" (`tests/envios.test.ts:33-52`: a tarefa é a cópia renomeada, segue cinza) e "a
mensagem entre irmãs fica no cartão da remetente" (`tests/sessoes.test.ts:366-371`: um cartão só).

## 6. Catálogo e selos

`regras/envios.md`:

- Cenário novo `### envios.carta-uma-vez-no-cartao-da-origem`
  - Título: "Cada carta aparece uma vez: no cartão e no pedido da tarefa de onde saiu."
  - Dado uma filha com mais de um cartão que mandou uma mensagem, ou uma carta na fila cuja tarefa saiu
    do plano num replano
  - Quando o painel é desenhado
  - Então a carta da filha aparece só no cartão que tem a tarefa de origem (sem ela, no do turno em que
    foi enviada), e o chip "aguardando sessão" a conta uma vez; a carta cuja tarefa saiu do plano pende
    do nível 1 do pedido em que foi enviada, nunca de outro pedido, e esse pedido segue à vista enquanto
    ela está na fila
  - `Origem: auditoria 2026-11-10 (a carta se repetia em todos os cartões de rodada, e a carta órfã de
    replano passava ao pedido novo); aplica envios.carta-sob-a-tarefa,
    pedidos.replano-mantem-envio-ate-entrega e a decisão de 2026-11-12 ("Sim, fica à vista
    (Recomendado)"), sem mudar nenhuma regra.`
  - `Código: draw/layout.ts`
  - `Estado: coberto`
- `envios.esc-apos-entrega-imediata`: no Então, acrescentar "; no cartão que a sessão mãe desenha dessa
  filha, parada com Esc ou arquivada, a carta já entregue também segue verde". Linha nova: `Reescrito:
  2026-11-14, texto: o cartão da filha parada mostra a carta como o painel dela (auditoria 2026-11-10);
  nenhuma regra muda e os testes existentes não mudam.`
- `envios.cor-por-estado` (o lote 01 já acertou o texto do cinza): acrescentar no Então "; a tarefa que
  fecha ✕ pelo fim de um subagente não muda a cor da carta já entregue dela". Mesma forma de linha
  `Reescrito: 2026-11-14, texto: …`.

Selos (`novo`), com os nomes finais dos quatro testes; motivo "cada carta uma vez, no cartão e no pedido
da origem" para os dois primeiros e "a carta entregue segue verde no cartão parado e na tarefa ✕ pelo
subagente" para os outros dois. Forma:

    npm run regras:selar -- "task-tree/tests/sessoes.test.ts::a carta da filha com dois cartões aparece uma vez, no cartão da tarefa de origem" --tipo novo --motivo "cada carta uma vez, no cartão e no pedido da origem"

## 7. Documentação

`DESENVOLVIMENTO.md`: na parte do desenho das cartas (procurar `letters` ou "linha própria sob a
tarefa"), três frases: os envios são repartidos entre os cartões de rodada; a carta órfã fica no pedido
dela; o cinza é só o da tarefa interrompida por plano. `CLAUDE.md`: nada (o checklist já tem "sessões
filhas reais (cartão, ✉ e entrega, filha parada e arquivada)").

## 8. Golden

Não deve mudar (seção 4).

## 9. Checklist do app

Filha real com dois cartões que manda mensagem a uma irmã: uma carta só. Filha parada com Esc depois de
uma entrega: a carta verde no cartão dela, como no painel dela.

## 10. Dependências e conflitos

- Depois do lote 01 (texto de `envios.cor-por-estado`). Independente dos lotes 07 e 10 no código.
- Lote 12 (a linha recolhida leva os chips): passa a contar as cartas na fila que uma linha recolhida
  esconde; depende de a carta existir uma vez só (este lote). Este vem antes.
- Lote 25 (nome do destino na carta) mexe em `nameOf`, dentro da mesma função `panel`, ao lado de
  `letters`: conflito de merge provável, lógica separada.
- Triagem A, decisão 9 ("Sob o nível 1 (Recomendado)", cartão cuja tarefa de origem sai do plano num
  replano): é a mesma ideia para o cartão; A pode reusar o `levelOne` corrigido aqui. Decisão 13 ("Sim, o
  plan adota"): cartas soltas até o plan do pedido; o `hostOf` deste lote não desenha a carta sem pedido
  desenhado, e A define onde a solta aparece. Decisão 12 ("Substituída, cinza", cartão da rodada largada)
  e 18 ("Um cartão só", turnos digitados na filha): mexem em `split`; conflito de merge provável.

## 11. Bloqueio

Nenhum.
