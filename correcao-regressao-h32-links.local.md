# correcao-regressao · H3.2 — lista parcial do host apagava links do store

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Bug 2 dos três confirmados no R8. 2026-10-22.

## O bug

`refreshChildren` reconstrói `children` (state) a partir da lista do host (`list_sessions`, com
arquivadas). Uma filha que o host deixa de listar por um momento sai do state; `saveLinks` gravava
`links:<id>` só com o que está no state → as ligações dela (`anchor`, `lastAnchor`, `rounds`)
sumiam do store para sempre. E `restoreLinks`, com `cur` não vazio, só devolvia ligações às filhas
já listadas (`cur.map`). Reproduzido em `reinicio.test.ts` › "lista do host parcial (H3.2)":
`codigo-task-tree` (20 rodadas) sumia.

## A correção (`task-tree/hooks/register.tsx`)

- `Link` (id, name, title, anchor, lastAnchor, rounds) e `linkOf(c)`.
- `keptLinks: Map<id, Link>`: cópia do módulo do que o store guarda. Preenchida em `restoreLinks`
  (todas as entradas salvas), atualizada em `saveLinks` com o que foi gravado.
- `saveLinks` grava a **união**: as filhas do state (com ligações atuais) + as entradas de `keptLinks`
  cujo id não está no state. O store não esquece mais ninguém.
- `refreshChildren`: uma filha nova para o state (`before` undefined) ganha `anchor`/`lastAnchor`/
  `rounds` de `keptLinks` — uma filha que o host volta a listar recupera as ligações.
- `recordStart`: idem para o `anchor` da filha recém-aberta (caso de reinício).

### Como tratei "não ressuscitar filhas arquivadas"

O desenho segue o host: só se desenha o que está no state, e o state só tem o que o host lista
(`include_archived: true`, então arquivada continua listada e marcada `archived`). As entradas de
`keptLinks`/store de filhas não listadas **não vão para o state nem para o desenho**: ficam só no
store, inertes, e só voltam a aparecer se o host listar o id de novo (então com as ligações). O teste
confirma: enquanto o host não lista `codigo`, o arquivo publicado não a traz; quando lista, volta com
20 rodadas e `lastAnchor 90`. Custo: o store pode guardar ids de sessões apagadas (limitado ao número
de sessões já abertas; nada lê essas entradas além do próprio save).

## Testes

- `reinicio.test.ts`: H3.2 saiu de KNOWN; o teste exige: `codigo` fica no store (20 rodadas,
  lastAnchor 90), todos os 5 ids + a nova no store, não desenhada enquanto não listada, e volta com
  as ligações quando listada de novo.
- Golden do SVG e orçamento: inalterados. Resultado da suíte e validação: no relato.

## O que conferir no app

Nada visual muda. O efeito aparece só quando a lista de sessões do app vier incompleta (ou depois de
uma sessão filha ser apagada e… não voltar). Sinal indireto: em `~/.claude/task-tree-waits/<id>.json`
nada muda; no store (`links:`) as filhas antigas deixam de desaparecer.
