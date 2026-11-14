# Ajuste 3: tarefas de outra conversa piscando no painel

Resposta do usuário: as tarefas que piscaram eram "de outra conversa, de outra sessão"; ele acha
que o "Ler o plano 40:28" também é de outra sessão.

## Achado 1: "Ler o plano 40:28" é da própria implementação, com o início errado
- O arquivo publicado da implementação (`~/.claude/task-tree-waits/local_84cfe49f-….json`) traz
  "Ler o plano" com `plannedAt` 1792789423438 e `startedAt` 1792786998262: o início é 40 min antes
  do plano. Ele é o `endedAt` de "Ficar à espera do primeiro plano", a tarefa do pedido anterior.
- Causa: `fill` (`state/tasks.ts:74–85`). Uma tarefa fechada sem `start` ganha como início
  `t.startedAt ?? prev ?? parentStart ?? t.plannedAt`, onde `prev` é o fim da irmã fechada anterior,
  ainda que essa irmã seja de outro pedido e anterior ao plano.
- Correção: nunca começar antes de ser planejada:
  `from = max(prev ?? parentStart, t.plannedAt)` quando houver `plannedAt` (e `min(now)` como hoje).
  Valer também para os filhos (o `parentStart` repassado).
- A tarefa é da sessão certa (implementação); só o relógio está errado.

## Achado 2: tarefas de outra família por 1–2 s (hipótese principal)
- O painel da principal desenha os cartões das sessões que ela abriu. Quem são essas sessões sai de
  `mineOf` (`io/host.ts:42–48`): ele **deduz** o id da própria sessão como o primeiro `startedBy`
  que não aparece na lista `list_sessions {linked:true, include_archived:true, limit:100}`, e filtra
  as linhas com esse `startedBy`.
- Se uma leitura da lista vier diferente por um instante (a recarga do mod pela implementação, uma
  linha de outra família, a principal ou uma filha faltando na lista, ou a ordem mudando), o
  "primeiro `startedBy` não listado" pode ser o de outra sessão. Aí a principal desenha os cartões e
  as tarefas publicadas das filhas daquela outra sessão. A leitura seguinte, 3 s depois (`poller`),
  corrige: bate com "um ou dois segundos".
- O mod já sabe o próprio id (`selfId`/`ownId`, `hooks/panel.ts:299–315`, via
  `get_session {session_id:'self'}`), mas `mineOf` não o usa.

### Plano
1. `mineOf(rows, self?)`: com o id próprio conhecido, filtrar `startedBy === self` e ignorar a
   dedução. Sem o id (fora do app, falha do `get_session`), manter a dedução atual. Também
   descartar o resultado quando a dedução for ambígua (mais de um `startedBy` não listado): devolver
   `undefined`, que mantém os filhos já conhecidos.
2. No `refreshChildren` (hooks), passar `await selfId($)` para `mineOf`. Depois de uma recarga,
   `ownId` volta vazio e é pedido de novo: garantir que a primeira leitura espere o `selfId`, e não
   use a dedução, enquanto estiver no app.
3. Defesa extra em `deriveChildren`: uma leitura que troca **todos** os filhos conhecidos por
   outros, sem nenhum em comum, é suspeita. Ela só é aceita se se repetir na leitura seguinte. É
   opcional e deve ser feita só se o passo 1 não bastar.
4. Log (`debug`) quando `mineOf` com id e sem id discordarem, para pegar o caso real se voltar.

### Outras fontes descartadas ou de menor peso
- `$.store` (`plugins/store/task-tree_*.json`) é um arquivo só para todas as sessões, mas cada
  chave leva o id da sessão (`storeKey`), e `ensureGroups`/`restore` usam `$.session.id()`. Pode
  haver perda de escrita entre processos, mas não troca de conteúdo entre sessões.
- O `$.state` é por sessão e sobrevive à recarga. Variáveis de módulo (`ownId`, `keptLinks`,
  `lastLinks`) são do processo da sessão.

## Observações à parte (fora do escopo; só registrar, decidir com o usuário)
- Título do cabeçalho antigo ("Abrir sessões filhas em espera"): `current()`/`headTask`
  (`hooks/render.tsx:233–238`) pega a tarefa iniciada por último. Com tudo concluído, cai num pedido
  antigo em vez do mais recente.
- O "40:28" é o achado 1 (relógio), não tarefa alheia.

## Validação
Sem testes nem docs (memória do projeto). Validar a recarga do mod. Validação visual: no próximo
pedido da implementação, a primeira tarefa sem `start` deve mostrar o tempo a partir do plano.
Repetir uma recarga do mod com filhas trabalhando e conferir que nenhum cartão alheio aparece.
