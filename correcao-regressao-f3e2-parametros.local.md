# correcao-regressao · fase 3, etapa 2 — `sendsAt`, `drawNow`, `breaksMemo` viram parâmetros

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Item 2 da fase 3 do
`docs/analises/04-plano-de-aprofundamento.md` (parte do R12). Branch `refactor/fase-3-layout`, sobre
`8ea3ca5` (etapa 1). 2026-10-22.

## O que entrou

Só **`task-tree/draw/layout.ts`** (+38/−28). O `layout()` passa a ler nada além dos argumentos:

- **`drawNow`** (variável de módulo que o `layout()` gravava e o `split()` lia): sai. `split(c,
  sisters, me, owner, now, memo)` recebe `now` e usa no teste do `WAIT_ORIGIN`. Os dois chamadores
  (`panel` e `cut`) passam o `now` do `layout()`.
- **`breaksMemo`** (`WeakMap` de módulo, uma `Map` por lista de irmãs): sai. Entra o tipo
  `BreaksMemo = { lists: WeakMap<Child[], number>; next: number; hits: Map<string, Break[]> }` e
  `newBreaksMemo()`. O `layout()` cria um por desenho e passa a `split` → `breaks` (e à recursão de
  `breaks`). A chave de `hits` é explícita: `${lista}|${me}|${caminho}|${id}|${parte}`, onde `lista`
  é o número da lista de irmãs na ordem em que foi vista (`lists`): a mesma partição do cache de
  antes (uma lista de irmãs → um espaço de chaves), agora dita na chave.
- **`sendsAt`** (mapa local ao `layout()` que o `panel` escrevia por escopo e o `rows` lia): sai.
  O `panel` calcula `pending = level > 0 ? p.sends não tomadas : queued` e o `body` passa a
  `rows`/`turnRows` como parâmetro `pending: Send[]` (`g.agent === MAIN ? pending : []`, porque só
  o grupo principal manda mensagens; antes, `sendsAt[inScope]` dos subagentes caía em `[]`).
  `rows` lê `pending.filter(s => s.anchor === t.id)` onde lia `(sendsAt[scope] ?? [])`.
  `work` deixou de ter default no `rows` (o `body` já passava `work ?? (() => idle)` a `turnRows`;
  agora passa aos dois).

`register.tsx` não mudou: ele não usa `split`, `breaks`, `drawNow` nem `breaksMemo`.

## Por que é idêntico

- `drawNow` era gravado com o mesmo `now` no início do `layout()`; nenhum leitor entre a gravação e o
  `split`.
- O cache: antes, uma `Map` nova por lista de irmãs **por módulo** (o `WeakMap` vivia enquanto a
  lista existisse; entre desenhos, as listas são objetos novos do state, então na prática uma por
  desenho). Agora, uma por desenho, por construção; a chave inclui a lista. O caso de uma lista
  reaproveitada entre desenhos (mesmo objeto) não acontece: `children` vem do `$.state.get` a cada
  render.
- `sendsAt[\`${scope}${MAIN}|\`]` só era gravado para `level > 0`; para `level 0` valia o preset
  `queued`. `pending` reproduz os dois casos; os escopos de subagente nunca tinham entrada.

## Testes

- **267 pass / 0 fail** (os mesmos 267). `claude plugin validate task-tree` e `validate .` ok.
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11 657 / 11 775 /
  47 400 / 48 158), reinício/recarga, publicado, durabilidade, limite de linhas: iguais.

## O que conferir no app

Nada muda. Se quiser olhar: um cartão de sessão com rodadas (split) e uma tarefa com ✉ (mensagem na
fila) no painel principal e dentro de um cartão.

## Fase 3, próximo

Etapa 3: testes de layout diretos (sem `mount`), com o fixture real: ordem dos cartões, âncoras,
supressão do ↩, chips. Etapa 4: `drawDesktop`/`drawTerminal` com `overlay()` e a regra de
não-sobreposição.
