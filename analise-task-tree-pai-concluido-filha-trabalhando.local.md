# Tarefa concluída (✓) com a sessão filha pendurada ainda trabalhando

Pedido: "a linha 'enviar o item a analise', está marcada como concluida, mas a sessão ainda está
trabalhando. as linha pai anteriores somente deveriam ficar como concluidas, quando as filhas fossem
concluidas." (print 29: "Enviar o item à Análise" ✓ 4/7, com o cartão da implementação trabalhando
1/4 embaixo; o pedido acima com ◷.)

## Decisões do usuário
- A tarefa do envio **e todos os pais** ficam **em andamento (◉) enquanto a filha trabalha** e
  viram ✓ sozinhos quando ela termina. O done da principal fica guardado, sem aparecer.
- Âncora com vários envios em andamento: **pela ordem** — cada SendMessage vai para a primeira tarefa
  em andamento que ainda não tem envio (1º envio na 1ª iniciada, 2º na 2ª).

## Causa 1: o tom ignora sessões vivas sob tarefa concluída
- O painel conclui a tarefa do envio quando a filha começa a tratar a mensagem (`watchSends`, regra
  em `text/rules.ts:54–57`), e a principal também chama `done` logo depois do SendMessage.
- O tom da linha (`draw/layout.ts:879–894`): `sent` → `interrupted` → **`w.busy`** → `done`…
  `w.busy` vem de `atWork` (`layout.ts:423–453`): `hereOpen = here.filter(c =>
  counted.includes(roundAt(c)))`, e `counted = open(t)` **só inclui tarefas não concluídas**. Com
  a tarefa do envio concluída, a sessão viva da rodada dela não conta → `busy` falso → ✓.
- O pedido (`turnRows`, linha 957) usa o mesmo `busy` (soma dos `ws`) → também não vê a filha e
  cai em `paused` (◷) por causa das outras tarefas.
- Contagem 4/7 está certa (conta as folhas da filha); só o tom erra.

## Causa 2: os cartões na tarefa errada
- `sendAnchor` (`hooks/panel.ts:117–145`): com algo em andamento, a âncora é `current(list).anchor`
  = **a tarefa iniciada por último** (mais uma folha pendente planejada depois dela, se houver).
  Com "Pedir à Governança…" (20.1) e "Enviar o item à Análise" (21.1) iniciadas juntas e os dois
  SendMessage em seguida, as duas mensagens caem na mesma tarefa (a última iniciada); o arquivo
  publicado mostra as rodadas trocadas (análise em 20.1, governança em 21.1). A implementação foi
  depois para 21.1 pela mesma regra, quando a mensagem saiu durante outra tarefa.

## Plano
1. **Tom** (`draw/layout.ts`, `atWork`): `busy` passa a considerar a sessão viva cuja rodada atual
   (`roundAt(c)`) está na subárvore de `t`, **concluída ou não**:
   `busy: here.some(live)` (sem o filtro `counted`). `live` já existe no retorno (`here.some(live)`);
   na prática `busy` e `live` passam a ser o mesmo para o tom. Manter `mine`/`tasks` (relógio) como
   estão.
   - Tom da tarefa: `w.busy` já vem antes de `t.status === 'done'` na cadeia → a linha fica
     `current` (◉) enquanto a filha trabalha, mesmo com `done`.
   - Pais: a cadeia é por linha; o pai acima da tarefa do envio também chama `atWork(pai)`, cuja
     subárvore inclui a tarefa do envio → `busy` → ◉. O pedido (`turnRows`) soma `ws.some(busy)` →
     ◉. Nenhuma mudança extra.
   - Quando a filha termina (`live` falso), tudo volta ao status gravado: ✓ se concluído.
   - Conferir os efeitos colaterais já tratados antes: a visão resumida (`trimToWork`/
     `openInSight`, que já usam rodada atual e `live`), o título do cabeçalho (`headTask`, que já
     procura `atWork(...).live`) e o chip "em andamento" (conta folhas iniciadas da principal; a
     tarefa ✓-mas-◉ não é folha iniciada aberta → não entra; conferir se deve entrar: decidir na
     validação, o usuário pediu só o tom).
2. **Âncora pela ordem** (`hooks/panel.ts`, `sendAnchor` e quem o chama em `hooks/tool-call.ts`):
   - Quando houver **mais de uma folha em andamento** (`status open` e `started`), a âncora do envio
     é a **primeira delas, na ordem de início** (`startedAt`, empate pela ordem do plano), que ainda
     **não tem envio** nesta rodada (nenhum `sends` com `anchor` igual, nem rodada de filha com
     `roundAt` igual depois do início dela). Se todas já têm, cai na regra atual (última iniciada).
   - Uma só em andamento: igual a hoje.
   - O `sends` já guarda `anchor` por envio; usar para saber quais tarefas já receberam um.
3. `text/rules.ts`: sem mudança (o painel continua concluindo o envio na entrega; o tom é que passa a
   refletir a filha).
4. Sem testes nem docs (memória do projeto). Validar a recarga do mod. Validação visual:
   - start em duas tarefas de envio, SendMessage às duas sessões, done nas duas: cada cartão sob a
     sua tarefa; as duas linhas ◉ enquanto as filhas trabalham; ✓ quando terminam; o pedido ◉ até
     a última terminar;
   - mensagem a uma terceira sessão durante outra tarefa: o cartão vai para a tarefa em andamento
     (regra atual).
