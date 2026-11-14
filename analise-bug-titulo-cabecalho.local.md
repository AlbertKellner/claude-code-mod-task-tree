# Título do cabeçalho "Plano B" depois de start/done em "Um" (análise)

Base: `e9ba27c`. Nada foi editado no repositório. A reprodução foi feita numa cópia de `HEAD` no scratchpad, com um teste temporário.

## Essencial

- **Não é a regra que está errada; é o empate de horários no teste.** O kit fixa o relógio (`mock.clock`, parado), então `start b1` e `start 1` têm o mesmo `startedAt`.
  - `startedLast` (`draw/layout.ts:537`) resolve empate pela **posição na árvore** (`>=`, o último no `flat`), não pela ordem dos starts. O que vem depois na árvore é o plano B, então ganha "b1".
  - Daí o título "Plano B" e o B ◉: o caminho da "última iniciada" (`trail`) é o de b1.
- **Reproduzido:**
  - sem avançar o relógio → título "Plano B", B ◉, A ◷;
  - com `relogio.advance(1000)` entre os starts → título **"Plano A"**, A ◉, B ◷; um `start b2` depois → "Plano B".
- **No uso real**, os starts acontecem em milissegundos diferentes e o comportamento é o decidido pelo usuário: "o título é o do passo iniciado por último", e o pai ◉ só no caminho da última iniciada.
- **Correção:**
  - (a) o teste avança o relógio entre os starts, o que é realista. Não é ajuste ao bug: o cenário com relógio parado não acontece no app;
  - (b) **opcional, recomendado:** tornar o empate determinístico pela ordem dos starts. Isso cobre o caso raro de dois starts no mesmo milissegundo (por exemplo, `start(['b1','1'])` numa chamada só, com dois `done` depois).
- Nenhuma decisão do usuário é contrariada. A dúvida 1 é só se ele quer a correção (b).

## 1. Causa (código)

- O título (`hooks/render.tsx` ~l. 346): `now0 = current(mainTasks).anchor ?? startedLast(mainTasks)?.id`; o título é o nível 1 que contém `now0`.
  - Depois dos dois `done`, nada está aberto e iniciado; `current()` não dá âncora, e vale `startedLast`.
- `startedLast` (`layout.ts:537–544`): percorre `flat(list)` e fica com `t` quando `t.startedAt >= pick.startedAt`.
  - Num empate, ganha o último em ordem de árvore. O comentário diz por quê: "a parent starts with its child", então o filho, que vem depois do pai, ganha.
  - O empate entre **irmãos de planos diferentes** também cai nessa regra, e aí a ordem da árvore não diz nada sobre qual foi iniciado por último.
- `trail(list, since)` (`layout.ts:550`) usa o mesmo `startedLast`, por isso o B fica ◉ e o A ◷ (o A tem algo feito e nada aceso → `resting` → ◷).
- `begin` grava `started: seq` (uma sequência crescente) **e** `startedAt`, mas `finish` apaga `started`. Depois do `done`, só sobra a hora para ordenar.

## 2. É bug ou regra?

- A **regra** (decisão do usuário, histórico de 2026-10-23, "o título é o do passo iniciado por último"; pai ◉ no caminho da última iniciada, 2026-10-27) está certa no código para horários distintos. Confirmado com `advance(1000)`.
- O **empate** é um defeito pequeno do plugin. Ele só aparece quando dois starts têm o mesmo `startedAt`:
  - no kit, com o relógio parado (sempre);
  - no app, só com dois starts no mesmo milissegundo. Isso acontece de fato numa chamada `start` com dois ids, porque o `now` é o mesmo e os dois ganham o mesmo `startedAt`. Se os dois forem concluídos e nada mais for iniciado, o título e o ◉ vão para o que estiver depois na árvore, não para o último da lista do `start`. É raro.

## 3. Plano de correção

**(a) Teste realista** (`tests/cabecalho.test.ts`, regra `cabecalho.titulo-e-a-ultima-iniciada`, hoje pendente):
- planos A › {Um, Dois} e B › {b1, b2} no mesmo pedido;
- `start b1`, `done b1`, `relogio.advance(1000)`, `start 1`, `done 1` → título "Plano A"; "Plano A" `andamento`; "Plano B" `aguardando`;
- `relogio.advance(1000)`, `start b2` → título "Plano B".

O teste roda sozinho, sem mudança no mod, e foi verificado na cópia no scratchpad.

**(b) Empate pela ordem dos starts** (opcional, recomendado):
- `state/tasks.ts` `begin`: além de `started` (que o `done` apaga), gravar uma sequência persistente `order` (ou `startedSeq`) com o mesmo `seq`.
- `types/index.d.ts` `TaskNode`: `startedSeq?: number`, com o comentário "a ordem do start, guardada depois do done".
- `draw/layout.ts` `startedLast`: com `startedAt` igual, desempatar por `startedSeq` maior; sem `startedSeq` nos dois (painéis antigos), manter a ordem da árvore, como hoje.
  - Pai e filho seguem certos: o `begin` do filho dá `startedSeq` só ao filho, e o pai fica sem, ou com o seu antigo. Nesse caso, o filho com `startedSeq` maior ganha.
- O `startedSeq` sobrevive a `carry` (replano), porque `carry` copia o estado: entra na lista de campos herdados.
- Teste da (b): `start(['b1', '1'])` numa chamada só, sem `advance`, `done b1`, `done 1` → título "Plano A" (o último da lista do start). Regra nova `cabecalho.titulo-desempata-pela-ordem-do-start` (coberto), origem "regra do painel; correção do empate achada no teste da tarefa 6, 2026-10-28".

## 4. Impacto nas travas e nas regras cobertas

- **(a):** só um teste novo (`--tipo novo`). `cabecalho.titulo-e-a-ultima-iniciada` passa a `coberto`. Nenhum teste existente muda.
- **(b):** muda o mod (`state/tasks.ts`, `types/index.d.ts`, `draw/layout.ts`; `carry` em `state/tasks.ts`).
  - A etapa `regressao` roda os testes de `HEAD` contra o código novo. Nenhum depende de empate por posição na árvore com planos diferentes; os de pai e filho (`arvore`, `turnos`, `pedidos`, `envios`) seguem iguais, porque o filho mantém a vitória.
  - Se algum teste antigo falhar, é regressão: corrige-se o código.
  - Selo: só o teste novo. Nenhum kit muda.
- **Âncora do envio sem nada em andamento** (`sendAnchor` → `startedLast` quando não há pendente): também passa a desempatar pela ordem do start. É coerente com `envios.sem-andamento-vai-a-pendente-planejada-por-ultimo` ("sem pendente, à última iniciada").
- **Recarga do clone:** a (b) toca três arquivos do mod; escrever de uma vez e rodar `npm run check`.

## 5. Dúvida para o usuário

1. No caso raro de duas tarefas iniciadas no mesmo instante (um `start` com dois ids), o título e o ◉ devem ir para a **última iniciada na ordem do start** (correção (b), recomendada), em vez de ir para a que vem depois na árvore, como hoje?
   - Sem a (b), fica só o teste realista (a), e o empate segue resolvido pela posição na árvore.

## 6. Brief para a Implementação

Na branch `test/regressivos-automacao-testes`, depois de `e9ba27c`. Sem push.

- **Commit 1 (sempre):** `test(task-tree): título do cabeçalho é o nível 1 da última tarefa iniciada`.
  - O teste da seção 3(a) em `tests/cabecalho.test.ts`, com `// Regra: cabecalho.titulo-e-a-ultima-iniciada`, selado `--tipo novo`.
  - `regras/cabecalho.md` com a regra `coberto`.
  - `npm run check` verde.
- **Commit 2 (se o usuário aprovar a dúvida 1):** `fix(task-tree): empate de horário entre starts resolvido pela ordem do start`.
  - `begin` grava `startedSeq`; `carry` o herda; `startedLast` desempata por ele; o tipo ganha o campo.
  - O teste da seção 3(b) e a regra nova `cabecalho.titulo-desempata-pela-ordem-do-start` (coberto, selo `novo`).
  - Escrever de uma vez; `npm run check` verde, incluindo a etapa `regressao`.
  - O relato traz `npm run testes:alterados` (deve dizer "nenhum teste existente mudou").
- **O usuário valida no app:** com dois planos no mesmo pedido, depois de concluir uma tarefa de cada um em sequência, o título é o plano da última concluída e só ele fica ◉.
