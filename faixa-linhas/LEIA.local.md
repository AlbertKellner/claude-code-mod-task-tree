# Faixa "Linhas" da migração para o nativo (2026-11-13)

Worktree: `<repo>-wt\faixa-linhas`
(detached em `b7d2a50`, a HEAD da integra). Lá ficam só os dois arquivos novos, sem commit:
`task-tree/draw/icons.ts` e `task-tree/draw/desktop.tsx`. `render.tsx` e `svg.ts` foram ligados só
para conferir e voltaram ao `HEAD`.

## O que foi verificado

- Com `svg-slim.diff` + `render-etapa1.diff` aplicados: `npx tsc --noEmit -p task-tree` = 0
  (`--listFiles` confirma `draw/icons.ts` e `draw/desktop.tsx` checados) e
  `claude plugin validate task-tree --strict` (2.1.321) "✔ Validation passed".
- Com `render-etapa2.diff` por cima: tsc = 0 e validate passou.
- `git apply --check` em sequência sobre `HEAD` (svg-slim → etapa1 → etapa2): ok.
- Fumaça fora do harness (transpilado com o typescript do repo e um `h` falso): `desktopTree` de 8
  linhas (pedido, folha, pai com filha, cartão de sessão com 2 linhas, seção, ✉) roda sem erro;
  ≈1,8 KB por linha, folha simples 1,4 KB (bate com a sonda).
- **Não rodado:** `plugin test` e `npm run check` (proibido nesta faixa). Nada visto no app.

## Como o integrador aplica

1. `git apply svg-slim.diff` (correção 9): `slim(svg, base = 'svg,text{cursor:default;user-select:none}')`,
   chave do cache `` `${base}#${classes}` ``, o conjunto de classes lido só de `classes`, e a folha
   começa por `${base}`. Com o padrão, nenhum byte do `rowSvg`/`headerSvg` muda. **Sem ele,
   `icons.ts` não compila** (`slim(x, '')` com 2 argumentos).
2. Copiar `icons.ts` e `desktop.tsx` para `task-tree/draw/`.
3. Etapa 1: `git apply render-etapa1.diff`. `drawDesktop($, ui, lines, W, cols, …)` (função de topo,
   correção 8) cria `acts` (mesmas keys e ações de hoje: `act('fold:…', pressOf($, r))`,
   `act('open:…', openSession…)`); linha sem cartão (`frames(lines)[i].cards.length === 0`) →
   `desktopRow(ui, r, i, leadOf(r, lanes[i]!, hides[i]), acts, cols)`; as de cartão seguem em `Svg`
   (o `rowSvg` só é montado para elas). `cols = bodyColumns || 40` desce ao lado de `W`.
4. Etapa 2: `git apply render-etapa2.diff` (sobre a etapa 1). `drawDesktop($, ui, lines, cols, top,
   alt, chrome)`: erro, `Box key="head"` com o `Svg` de hoje, `desktopTree(ui, lines, acts, cols)`.
   Saem `overlays`, `Placed`, `frames`, `rowSvg`, `rowHeight`, `rowAlt`, `RING_LABEL` dos imports
   (`lineWidth`, `W` e `headerSvg` ficam até a etapa 3). `guides`/`labelCols` ficam (terminal).
   `draw/icons.ts` não muda na etapa 2.

## API entregue

- `icons.ts`: `ICON = 16`, `stateIcon(tone)`, `msgIcon(state)`, `bustIcon(state)`,
  `ringIcon(percent, faded)`, `headBar(d, n)` (sem uso até a etapa 3; `width="100%" height="4"`,
  parte verde com piso de 2%). Cada uma lembrada num `Map` (limpo acima de 500).
- `desktop.tsx`: `Acts`, `cells(r, g, hide)`, `leadOf(r, g, hide)` (**a mais**, para a etapa 1),
  `iconCell(ui, svg, alt, press?)` (**recebe `ui`**, a assinatura de [D] não tinha), `desktopRow(ui,
  r, i, lead, acts, cols)` (tarefa, pedido, aviso, ↩, ✉, ferramenta de subagente, cabeçalho de
  cartão, seção e rótulo de sessão) e `desktopTree(ui, lines, acts, cols)`.

## Contrato 2.1, como ficou

- Linha: `Box key="r<i>" height={1}`; cartão: `Box key="c<i>"` (faixa + `Box` do cartão com
  `borderStyle="round" paddingX={1} paddingY={0} flexDirection="column" flexGrow={1} minWidth={0}
  backgroundColor="userMessageBackground"`), aninhado em qualquer profundidade.
- Título: `Text wrap="truncate-end"` com o único filho `r.title`; ` ⋯` num `Text` próprio depois.
- Tempo, contagem: `Text` próprios (`size="footnote" color="inactive" tabular`), depois do título.
- `alt` do ícone/busto/✉ = `rowAlt(r)`; anel: `contexto da sessão <nome>: <N>%`; seção sem `Svg`.
- Botões: `fold:<key>` sobre ícone/busto (rótulo `'\u2003'`) e o ▸/▾ da seção (`plain dimColor`);
  `open:<sid>` sobre o anel (rótulo `RING_LABEL`, também U+2003), só com `r.session && r.sid`.
- Nenhum `hover`, `display`, `isInteractive` ou `<title>`.

## Decisões e desvios do plano

1. **Linha sem colunas com contagem** (não `tabular`, ex. "3/5 · concluída"): em vez de um `Text` só
   com `rightText(r)`, vão dois: `3/5` e `· concluída`. Motivo: a contagem fica um pedaço próprio
   (`/^\d+\/\d+$/`) em toda linha, como o contrato 2.1.5 pede para a linha com colunas.
2. **Células vazias** da linha com colunas são `Box` de largura fixa sem `Text` (nada de `Text ''`).
3. **Seção**: o ▸/▾ fica numa `Box width={3}` (alinha com a célula do ícone); sem ▸/▾ o título começa
   onde estaria o ícone (`paddingLeft` 0). Seção recolhida também ganha ` ⋯`, como no `rowSvg`.
4. **Anel sem `sid`** (não acontece hoje): desenhado sem `Button`. Anel em linha de tarefa (o
   `Row.ring` de turno/pedido): não desenhado, só no `alt`, como hoje.
5. **Colunas do cartão:** cada cartão tira da largura a faixa (3 por coluna) e 3 (borda + padding);
   piso de 10. O rótulo tira ainda guias, busto (3), paddings (2), nome, ⋯ (2), palavra, anel (4).
6. **Rótulo, o que cabe** conta 1 `ch` por caractere de `caption` (como [D] 4.5, erra para mais). Na
   fumaça a 60 colunas, um cartão em profundidade 2 com "trabalhando", "⑂ feat/x", 42 toks/s e
   "Opus 5.5 · xhigh ultracode" perdeu o repositório e o modelo com ultracode (seguem no `alt`).
   Se o usuário achar que some cedo demais, um fator ~0,8 nos textos `caption` resolve.
7. **`effortUltra`** no ` ultracode` (com espaço só quando há modelo); `aguardando` em `warning`.
8. Pasta sem repositório: `▭ …<últimos 27>` (28 no total); com o repositório tirado, some inteira.
9. `cells` dá conector (`├─`/`└─`) também ao rótulo de sessão e esconde as colunas de `labelCols`
   (as tarefas do cartão alinham com o busto): correção 22, diferença visual.

## Incerto (só o app mostra)

- Faixa lateral em `Text mono` com `\n` contra linhas de `height={1}` do corpo: a altura de linha do
  mono pode não bater com a do corpo e a faixa escorregar; com cartão dentro de cartão, ~2 px por nível.
- Sem `flexDirection` na linha (padrão `row` do app e do harness, como a sonda confirmou).
- Barra da linha com `height={0.2}` e `width="N%"` (aceitos pela sonda; a pintura é do app).
- Na etapa 1 o painel é misto: guias em caractere fora do cartão e em px dentro; não se alinham.
