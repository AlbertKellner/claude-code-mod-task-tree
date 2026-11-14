# (1) Rodada de filha descartada sai das contas; (2) ícone de sessão só no pai imediato

Print 25. Palavras do usuário: (1) "as tarefas dessa sessão foram descartadas" (rodada interrompida
pelo stop_session: pai ✕ com uma ✓ e uma ✕; o pai do cartão mostra 2/2, o pedido 2/2, o topo "1
interrompida"); (2) "somente a tarefa que agrupa imediatamente acima deve mostrar o ícone de sessão".

## Decisões do usuário
- Rodada **descartada** = rodada **abandonada ou abortada**: rodada antiga que ficou com tarefa
  aberta quando outra mensagem começou a rodada seguinte, ou turno parado por stop/abort. A filha
  que só encerrou o turno com pendentes **não** é descartada (a regra 3/5 → 3/3 fica).
- Descartada: as folhas dela, **inclusive as ✓**, saem do x/y dos pais e do total do topo; o chip
  "N interrompida" **não** as conta.
- O cartão fica **sempre visível**, nada muda na visibilidade.
- Ícone de sessão (busto) só na **linha imediatamente acima do cartão** (a tarefa âncora); pedido
  e avós não o mostram (ficam só com barra e x/y).

## Onde está
- Contagem das sessões sob uma tarefa: `atWork` (`draw/layout.ts:~400–428`): `below` = cartões
  ancorados em qualquer tarefa da subárvore; `d/n` somam `total(panelOf(c))` de cada um; `cards`
  dá as folhas para o cabeçalho (`Row.nodes`) e para `kidsState`. O topo: `total()` (linha 369)
  e, para a visão, `count(shown)` sobre `Row.nodes`.
- Cartões por rodada: `split` (linha ~232–350) cria um `Child` por `part` com `tasks` da rodada,
  `lastAnchor` só no cartão líder (`at`), `running` só se líder ou com tarefa aberta. A rodada
  antiga com tarefa aberta é desenhada com ✕ ("earlier round's card never does", `atWork`).
- `panelOf` (linha ~100): sessão parada → `halt`; arquivada → `interrupt`.
- Ícone: `Row.kids`/`Row.kidsState` (linhas 884–885 na tarefa, 955–956 no pedido) → `forked` em
  `draw/svg.ts:422/451` desenha o busto. `kids = w.any`, e `w.any` é verdadeiro para **qualquer**
  tarefa da cadeia acima do cartão (a subárvore inclui a âncora), daí o busto no pai e no avô.
- O abort do turno: `turn.complete` traz `e.isAborted`; o mod guarda `turnAborted` no `$.state`
  (`hooks/turn.ts`) mas **não publica**. Sem isso a mãe não distingue "parada por stop" de "encerrou".

## Plano
### (1) Rodada descartada
1. **Publicar o abort**: `io/publish.ts` grava `aborted: true` quando o último turno terminou
   abortado (`turnAborted` do estado) e `false`/ausente quando não; `parsePublished` lê; `io/host.ts`
   leva a `Child.aborted`; um `prompt.submit` seguinte (a sessão retoma) zera (já zera o estado).
2. **Predicado `discarded(card)`** em `layout.ts`, para cartões de rodada (`part !== undefined`):
   - rodada **antiga** (não líder: `lastAnchor === undefined` no cartão) com alguma folha aberta
     (`hasOpen(tasks)`: no desenho vira ✕) → descartada;
   - cartão **líder** de sessão parada com `aborted` e folha aberta → descartada;
   - cartão líder de sessão parada **sem** abort (só encerrou o turno) → **não** descartada (3/3).
   - arquivada: como hoje (interrompidas fora do total, ✓ contam) — não muda.
3. **Contagem**: `atWork` e `total` passam a somar só os cartões não descartados (`d += …`, `n +=
   …` pulam os descartados; `cards` para `Row.nodes` idem, assim o topo por `count(shown)` também
   os ignora; o chip "interrompida" vem de `count` → deixa de contá-los). Como `atWork` e `total`
   recebem, na visão completa, os filhos **crus** (não divididos por rodada), fazer a divisão:
   usar `split(c, sessions, ownId, owner, now, memo)` nesses dois pontos (o `panel()` já tem
   `memo`, `now`, `ownId`; `total` do topo em `render.tsx` precisa recebê-los) e somar cartão a
   cartão; na resumida os `children` já vêm divididos (`cut`).
4. Desenho do cartão descartado: inalterado (✕ cinza, "interrompida", relógio parado); só a
   contagem muda. Conferir que a barra do pai e do pedido refletem a nova soma e que o `headTask`
   não muda.
### (2) Busto só no pai imediato
5. `atWork` ganha `direct: boolean` = alguma sessão/cartão com `anchor === t.id` ou
   `roundAt(c) === t.id` (ancorado **na própria** tarefa, não na subárvore). `Row.kids = w.direct`
   e `Row.kidsState = kidsState({...w, any: w.direct})` na tarefa (linha 884–885); no pedido
   (`turnRows`, 955–956) `kids` sempre `undefined` (o pedido nunca é âncora direta). A barra e o
   x/y continuam (`sub` usa `w.d/w.n`, inalterado).
6. Terminal: o `tail` com o glifo de sessão segue `r.kids` (mesma regra).
### Validação
7. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual com o
   print 25: "Enviar o logo de referência à Análise" e o pedido passam de 2/2 a **0/0 (sem x/y)**
   ou só com as tarefas próprias; topo sem "1 interrompida"; o cartão ✕ continua lá; busto só em
   "Enviar o logo…" e "Interromper a Análise…", não em "Ícone do Git…".
