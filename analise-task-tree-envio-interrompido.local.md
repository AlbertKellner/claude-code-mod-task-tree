# Envio em fila (✉) vira "interrompida" quando o turno da principal termina

Pedido: "porque uma mensagem recém enviada muda o ícone pra carta, em seguida marca como
interrompida e depois mostra como processando? não mostre como interrompida, deixe como mensagem
até ela ser entregue". Print 19: "Enviar ajuste da linha redonda à Análise" com ✕ "interrompida" e o
chip "1 interrompida", enquanto o envio ainda estava na fila (`queued`).

## Sequência
plan → start → SendMessage (fila: a análise estava em turno) → a principal encerra o turno com a
tarefa do envio **aberta e iniciada** (regra do painel: a tarefa do ✉ só fecha quando a sessão
destino começa a tratar a mensagem) → ✕ → quando a análise começa a tratar, `watchSends` marca o
envio como `taken`, a tarefa fecha e a filha aparece processando.

## Causa (no desenho, não no estado)
1. `hooks/turn.ts:77`: ao fim do turno da principal, `turnEnded` recebe a hora. O estado das tarefas
   **não** muda (só subagentes têm `interrupt` gravado, linha 90).
2. `draw/layout.ts:773`: com `model.ended`, o desenho aplica **`halt(ended)`** (linhas 40–47) ao
   grupo principal: toda folha **aberta e iniciada** passa a `interrupted` no desenho, com o relógio
   parado em `ended`. A tarefa do ✉ está exatamente nesse estado (start feito, não fechada), então
   vira ✕. Um pai com algo aberto embaixo fica aberto; sem nada aberto, também ✕.
3. `draw/layout.ts:812–817`: o tom dá precedência a `interrupted` e, pior, **descarta o ✉** quando a
   tarefa está interrompida (`waitsOn = t.status !== 'interrupted' ? pending… : []`), então nem o
   tom `sent` sobrevive. O chip "1 interrompida" conta pela mesma função (`count`, status do
   desenho).
4. O 109b92d só cobre a tarefa **concluída** pelo `done` (mantém o ✉ até a entrega); a tarefa
   deixada **aberta** pela regra do `queued` cai no `halt`.

## Regra desejada
Tarefa com envio não confirmado fica ✉ "aguardando sessão" até a entrega, atravessando o fim do
turno; nunca "interrompida". Depois da entrega, o fluxo atual (fecha e vira ✓, filha processando).

## Plano
1. `halt` (`draw/layout.ts:40`) passa a receber as âncoras dos envios pendentes
   (`pending = model.sends.filter(s => !s.taken)`, já disponível em `layout`): `halt(at, sent)`.
   - Folha com `sent.includes(t.id)`: **devolvida como está** (aberta, iniciada, relógio correndo:
     o tempo do ✉ é o da espera pela entrega, como antes do fim do turno).
   - Pai: já fica aberto quando `hasOpen(children)` (a folha ✉ continua aberta), com o relógio
     parado em `at`; nada a mudar.
   - A chamada em `layout` (linha 773) passa `pending.map(s => s.anchor)`; a de `panelOf`
     (linha 97, sessões arquivadas) passa `[]`, como hoje.
2. Tom (`layout.ts:812`): manter a precedência atual; com o passo 1 a tarefa não chega
   interrompida. Por segurança, calcular `waitsOn` **antes** do status (um ✉ pendente vale mesmo
   que algo a marque interrompida) e pôr `sent` acima de `interrupted` na cadeia do tom.
3. Chips: "aguardando sessão" (já existe, `tally(r => r.tone === 'sent')`) passa a contar a tarefa;
   "interrompida" deixa de contá-la (vem do status do desenho).
4. Relógio da folha ✉ depois do fim do turno: `anyRunning`/`running()` deve continuar a redesenhar
   por segundo enquanto houver ✉ pendente (hoje `turnEnded` zera os relógios da principal em
   `anyRunning`: conferir em `hooks/sessions.ts` e incluir `sends` pendentes como motivo de relógio,
   ou aceitar o relógio parado em `ended` — decidir na validação; o usuário não pediu o relógio).
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual: enviar
   mensagem a uma filha ocupada, encerrar o turno da principal: a tarefa fica ✉ "aguardando sessão"
   (chip idem, sem "interrompida") até a filha começar; então ✓ e cartão processando.
