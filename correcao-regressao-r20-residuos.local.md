# correcao-regressao · R20 — resíduos

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Último item da fase 1 do
`docs/analises/04-plano-de-aprofundamento.md`. 2026-10-22.

## Cada resíduo do `02` §7 / `03` R20

| Resíduo | Conferência | Decisão |
|---|---|---|
| `tests:109–119`: `desktop()` junta "dois Svgs em volta do Button" | `grep alt=""` no register: só nas camadas interativas de tooltip (`hoverLayer`); no golden (12 cenários) nenhum Svg não interativo com alt vazio | **Removido**: o helper só mapeia e filtra as camadas |
| `rowSvg` com `r.ring` em linha de tarefa | `Row.ring` só é posto na linha de sessão (`session: true`, `ring: ringOf(c)`), e `rowSvg` devolve `labelSvg` para `r.session` antes de chegar ao ramo | **Removido** o ramo de `rowSvg` e o `<Text>` do anel na linha de tarefa do terminal (o da linha de sessão fica) |
| `atWork` calcula `ring`; `Work.ring`; `topRing` | nenhum `.ring` lido de um `Work` (`grep "\.ring"` só acha `r.ring`/`c.ring`) | **Removidos** `Work.ring`, `topRing` e o cálculo; `ringOf` fica (usado na linha de sessão) |
| `rows(..., pinned, ...)` e `turnRows(..., pinned, ...)` | o parâmetro só era repassado; `const pinned` em `body()` só alimentava as chamadas | **Removidos** parâmetro, const e argumentos |
| `prefix(r, g, _up, hide)` e `up[r.depth] = r` no desenho do terminal | `_up` não lido; `up` só servia ao `prefix` | **Removidos** parâmetro, array e atribuição; comentário ajustado |
| `DESENVOLVIMENTO.md:133` (`GUTTER`), "linha inteira × só ícone" | documentação | **Não é meu**: fica para a sessão de documentação (R19) |
| `plugin.json` 0.7.4 inalterado | governança (R5) | **Não é meu**: fica para a governança |

Nada com uso real foi removido: cada item foi conferido por grep e pela suíte (golden do SVG, orçamento, reinício e arquivo publicado iguais).

## Resultado

- `task-tree/hooks/register.tsx`: −25 linhas líquidas. `task-tree/tests/task-tree.test.ts`: helper
  `desktop()` com −11 linhas.
- 194 pass / 0 fail (6 arquivos); `claude plugin validate task-tree` e `validate .` ok; golden,
  orçamento, reinicio e publicado inalterados (os testes passam sem regerar nada).

## O que conferir no app

Nada: só código morto saiu; o desenho é idêntico (golden prova o desktop; os testes de terminal, o
terminal).

## Estado da fase 1

**Concluída**: R6 (fixture + orçamento), R7 (golden do SVG), R8 (reinício/recarga) com os 3 bugs
corrigidos (H6.1, H3.2, lastBrief), R9 (contrato `Published`), R15 (`MAX_ROWS`), R20 (resíduos).
Critério do `04` ("um teste falha se o desenho crescer 50% ou se qualquer SVG mudar sem golden novo")
atendido.

## Fase 2 (extrações sem mudança de comportamento), pela ordem do `04`

1. `draw/geometry.ts` (R14): mover constantes e `overBox`/`ringRight`/`nameLayer-left` para funções
   nomeadas, com `CELL = 8` explícito; golden tem de ficar idêntico.
2. `text/rules.ts` (R16): `RULES`, descrições das tools, lembretes num lugar; teste de que citam o
   mesmo `BRIEF`.
3. `state/durability.ts` (R13): tabela de durabilidade + `load/save`; `view`/`work` ganham o guarda
   que `groups` e `links` já têm; `lastRecap` para o state.

Condição já respondida (pergunta 2 do `04`): o kit aceita `import` relativo de arquivos do plugin
(só `import()` dinâmico não). Vale um módulo descartável antes da primeira extração para testar a
armadilha "`$` passado a função fora do topo do arquivo" em arquivos importados.
