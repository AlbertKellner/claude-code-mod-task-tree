# correcao-regressao · H6.1 — reinício sem `session.start` zerava o painel no store

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Bug 1 dos três confirmados no R8. 2026-10-22.
Primeira mudança de comportamento do `register.tsx` nesta frente.

## O bug

Depois de um reinício do processo sem `session.start` (respawn do hooks worker), o `$.state` nasce
vazio e nada o repõe: `change()` partia de `cur ?? []`, `persist()` sobrescrevia `session:<id>` com
o painel reduzido (97 → 0 tarefas no fixture), o painel desenhava "Nenhuma tarefa planejada." e
`publishWait` publicava o painel vazio às outras sessões. Teste que reproduz:
`reinicio.test.ts` › "sem session.start (respawn do hooks worker)".

## A correção (`task-tree/hooks/register.tsx`)

- `keptGroups($, id)`: o painel como o store o guarda, com as tarefas dos subagentes interrompidas
  (extraído de `restore`, que agora o usa).
- `groupsLoaded` + `ensureGroups($)`: no estilo do `linksLoaded`. Se o módulo ainda não viu os grupos
  e o state está vazio, lê o store e grava no state. Devolve os grupos que trouxe, para quem não
  consegue escrever o state usá-los; só marca `groupsLoaded` quando o state ficou de fato com eles
  (ou quando já tinha, ou quando o store não tem nada), para a próxima escrita tentar de novo.
- Chamado em: `change()` (toda escrita), `publishWait()` (toda publicação), `nothingOpen()` (decide
  se um plan abre trabalho novo, antes do `change`) e no `ui.render` (desenho: `held = state ??
  brought`). `session.start` marca `groupsLoaded = true` depois do `restore` que já fazia.

Achado no caminho: um `$.state.set` feito de dentro do `ui.render` não vinga no kit (a leitura do
store acontece, o desenho continua vazio); por isso o render usa o valor devolvido e a flag só sobe
com a escrita confirmada. Vale registrar como armadilha no DESENVOLVIMENTO.md ("render não escreve
state").

Também no caminho: o validador do kit recusa uma função que recebe `$` com o mesmo nome de uma
variável atribuída em outro lugar (`saved` → renomeada `keptGroups`): "the function handed $
"saved" is assigned to elsewhere".

## O que NÃO entrou (de propósito)

- `view` e `work` continuam só restaurados em `session.start`. Pôr `restoreView` no guarda mudaria o
  padrão do desenho sem `session.start` (`'full'` no render × `'summary'` no restore) e quebraria o
  golden; `restoreWork` é inócuo, mas fica para o R13 (tabela de durabilidade) junto com `view`.
- H3.2 e `lastBrief` seguem em KNOWN.

## Testes

- `reinicio.test.ts`: H6.1 saiu de KNOWN; o teste "sem session.start" agora exige: desenho com as
  tarefas do store (títulos de nível 1 iguais aos do painel restaurado por `session.start`; cartões
  de sessão não, porque a lista do host só é lida no `session.start` ou pelo poll), `start(['98'])`
  encontra a tarefa, store continua com 97 níveis 1, e o arquivo publicado leva os 97.
- Golden do SVG (R7): inalterado. Orçamento (R6): inalterado.
- Resultado da suíte e validação: no relato.

## O que conferir no app

Com o plugin recarregado desta pasta: o painel continua igual (nenhuma mudança visual). O cenário
corrigido só aparece após um crash do hooks worker ou `/model`: se ocorrer, o painel deve continuar
mostrando as tarefas em vez de "Nenhuma tarefa planejada." e o `~/.claude/task-tree-waits/<id>.json`
deve manter os grupos. Não dá para forçar no app sem derrubar o worker.
