# Pai ✕ "interrompida" com filhas concluídas

Pedido: "nessas tarefas, pq a tarefa pai tem o icone de interrompida? se existem tarefas concluidas
como filhas, o pai nunca pode ficar como interrompido" (print 36). Branch `fix/task-tree-serie-12`
(12a27c8).

Caso: na principal, "Refazer a largura com Box em coluna" ✕ interrompida; filhas "Enviar o plano à
Implementação" (✉ verde, entregue, concluída) e "Validação visual do usuário" (iniciada e deixada
aberta de propósito no fim do turno, à espera do usuário) ✕ interrompida.

## Causa
1. `draw/layout.ts` `halt` (l. 47–57), aplicado em `layout` (l. 852) quando o turno da principal
   termina (`model.ended`): toda folha **iniciada e não fechada** vira `interrupt` (✕), sem distinguir
   o fim normal do turno (o modelo deixou a tarefa aberta esperando a pessoa) do turno parado pela
   pessoa (`isAborted`). A "Validação visual" vira ✕.
2. No mesmo `halt`, o pai: `hasOpen(children) ? mantém aberto : interrupt(pai)`. Com a validação já
   ✕ e o ✉ concluído, não sobra filha aberta e o pai vira ✕, **ignorando a filha concluída**.
3. O tom também força ✕ em outros dois lugares: `layout.ts` l. 904–906, um pai `done` com alguma
   filha interrompida sai `interrupted`; e l. 997–998, o pedido (linha do turno) sem nada aberto e
   com alguma interrompida sai `interrupted`, mesmo com folhas concluídas.

## Decisões do usuário
- **Folha deixada aberta no fim normal do turno: ◷ "Aguardando"** (âmbar, relógio parado). ✕ só no
  turno parado pela pessoa (Esc/parar) e na sessão arquivada.
- **Pai com filhas mistas, nada em andamento, ao menos uma concluída: ◷ "Aguardando"** (o mesmo ◷
  que o painel já usa no pai aberto com algo concluído, `resting`, l. 463), relógio parado na
  última conclusão. ✕ só se nenhuma descendente foi concluída. **O pedido (linha de cima) segue a
  mesma regra.**

## Plano de implementação
1. **Saber se o turno foi parado**: `hooks/render.tsx` (l. 322–329) lê `turnAbortedState` (já
   gravado em `hooks/turn.ts:125`, `e.isAborted`) e põe `aborted: true` no `model`; o tipo `Model`
   (`layout.ts` ~l. 830) ganha `aborted?: boolean`.
2. **`halt(at, sent, all, aborted = true)`** (`layout.ts` l. 47):
   - folha iniciada e aberta, **sem `aborted`**: fica `open`, com `started: undefined` (sai do
     `current`, não acende) e `endedAt: stop(t, at)` (relógio parado). É a marca de "aguardando": uma
     folha `open` com `startedAt` e `endedAt` só nasce aqui (o `halt` é só no desenho; no próximo
     prompt o `ended` some e ela volta a ser a tarefa em andamento). Com `aborted`, `interrupt` como
     hoje.
   - folha nunca iniciada: igual a hoje (`all` → ✕; senão ○).
   - pai: se sobra filha aberta (inclusive uma em espera), mantém aberto e relógio parado (como
     hoje). **Sem filha aberta, mas com alguma descendente `done`: também mantém aberto** (relógio
     parado), em vez de `interrupt`. ✕ só sem nenhuma `done` abaixo.
   - `layout` l. 852 passa `model.aborted === true`.
3. **Predicado** `held = (t) => t.status === 'open' && t.children.length === 0 && t.startedAt !==
   undefined && t.endedAt !== undefined`, e `resting(list)` passa a ser
   `flat(list).some(k => k.status === 'done' || held(k))` (um pai cuja única filha espera também sai
   ◷, não ○).
4. **Tom** (`layout.ts` l. 897–912), na ordem de hoje:
   - folha `held` → `'paused'` (antes do `lit`/`open`; ícone ◷ âmbar, rótulo "Aguardando", já
     existentes em `svg.ts:332` e na tabela de rótulos l. 937);
   - `t.status === 'interrupted'` com filhas e alguma descendente `done` → `'paused'` (vale também
     para um pai interrompido por `interrupt` de subagente ou de sessão, regra "nunca ✕ com filha
     concluída");
   - `t.status === 'done'` com alguma interrompida abaixo (l. 905) → `'paused'` em vez de
     `'interrupted'`;
   - o resto igual.
   - `meta` (l. 941) só põe "interrompida" quando o tom é `interrupted`: sai sozinho.
   - `sub` (l. 939) e o tempo: `'paused'` já usa `stillSpan` (l. 945); a contagem `d/n` aparece como
     num pai aberto.
5. **Pedido** (`layout.ts` l. 990–999): sem nada aberto, `some(interrupted)` → `'paused'` se houver
   alguma `done` em `flat(list)`, senão `'interrupted'`; `resting(list)` com o novo predicado já cobre
   o caso de uma folha em espera.
6. **Cabeçalho** (`render.tsx` l. 362–368): a folha `held` não é ◉ (`active` já exclui `endedAt`),
   mas hoje cairia em "pendentes"; contá-la no chip de espera (o 2º argumento de `chips`, hoje as
   linhas `wait`) e tirá-la de `pending`.
7. **Cartões de sessão** (`panelOf`, l. 115–121): `halt(undefined, [], true, c.aborted === true)`, a
   mesma regra: numa sessão que terminou o turno normalmente, a tarefa iniciada e aberta fica ◷ (como
   aparece no painel da própria sessão), as nunca iniciadas seguem ✕ (decisão anterior,
   "reaproveitar o interrompida"); parada pela pessoa (`aborted`) ou arquivada (`interrupt`, l. 120),
   ✕. O pai com filha concluída nunca ✕ (item 4).
   - `count` (l. 79): a folha `held` conta no total como aberta (não é `interrupted`); um cartão
     "parado" com uma em espera mostra `3/4`, não `3/3`.
8. Sem testes nem docs. `claude plugin validate task-tree`, mudança em um passo só (recarga do mod).
   Commit `fix(task-tree): tarefa aberta no fim do turno fica ◷ aguardando; pai com filha concluída
   nunca ✕`.

## Validação visual
- Repetir o caso do print 36: a principal envia o plano (✉ entregue), deixa "Validação visual"
  iniciada e termina o turno → validação ◷ (relógio parado), o pai ◷ "Aguardando" com `1/2`
  (o ✉ não conta) e o pedido de cima ◷.
- Turno parado com Esc com uma tarefa em andamento → ela ✕; o pai ✕ só se nada abaixo dele estava
  concluído, senão ◷.
- Próxima mensagem do usuário: a validação volta a ◉ em andamento (o `ended` some), sem start novo.
- Chips: a tarefa em espera entra em "aguardando", não em "pendentes" nem em "em andamento".
- Cartão de uma filha que terminou o turno com uma tarefa iniciada aberta: ◷ no cartão e no painel
  dela; as nunca iniciadas ✕; arquivada: ✕ nas abertas, pai com filha ✓ ◷.
