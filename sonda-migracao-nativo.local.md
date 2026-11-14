# Sonda da migração para o híbrido nativo (Etapa S) — 2026-11-13

Onde: worktree descartável `claude-code-mod-task-tree-wt/sonda` (detached em `b7d2a50`, a HEAD de
`feat/painel-nativo`), já removida. Binário: `claude-code\2.1.321\d020ce1b5d30\claude.exe`.
Arquivos da sonda: `task-tree/draw/sonda.tsx` (árvore de teste), ligada no ramo desktop de
`hooks/render.tsx` (retorno trocado), e `task-tree/tests/sonda.test.ts` (monta `surface: 'desktop'`
a 60 colunas, imprime `JSON.stringify(await ui.drawn())`, peso por linha e aperta dois botões).
`plugin test` não filtra arquivo (só `[dir]`): os outros testes foram tirados da pasta durante a
rodada (com eles, 213 passam e 18 falham, todos do desktop, como esperado com o retorno trocado).

## Respostas

| Pergunta | Resposta |
|---|---|
| `validate --strict` e `plugin test` aceitam JSX em `draw/*.tsx`? | **Aceitam.** `plugin validate task-tree --strict`: "✔ Validation passed" (só os avisos de diretório de sempre: LICENSE, ícone). `plugin test` passou, e `tsc --noEmit -p task-tree/tsconfig.json` saiu com 0. `draw/desktop.tsx` e `draw/head.tsx` podem ficar em `draw/`. |
| `height={0.2}` e `width="40%"`? | **Aceitos**, em `Box` solto e na barra aninhada (`Box flexGrow height=0.2` com filho `Box width="40%"`). Chegam ao `drawn()` sem mudança (`"height":0.2`, `"width":"40%"`). |
| `color="effortUltra"`, `backgroundColor="userMessageBackground"`, `rgba(136,135,128,0.25)` (e `rgba(239,159,39,.5)`)? | **Todos aceitos**, repassados literalmente. O harness não confere cor (o tipo `Color` admite qualquer string); se o app pinta as duas chaves fora de `ThemeKey` só o app mostra (checklist). |
| `Text` com `\n`? | **Aceito**: `children: ["│\n│\n│"]` chega inteiro. |
| `Box position="relative"` > `Box position="absolute" top/bottom/left/right={0}` > `Button label={' '} plain` com key e `onPress`? | **Aceito.** O label chega como U+2003 (código 8195). `ui.press({ key })` funciona nos dois (`probe-btn` e `fold:k1`). |
| A `key` de um `Text` chega ao `drawn()`? | **Não.** `<Text key="error" color="error">` chega como `{"type":"Text","props":{"color":"error"},...}`, sem key; nenhum `Text` do desenho tem key. A key de `Box` e de `Button` chega em `props.key`. Nada muda no kit; registrar no `DESENVOLVIMENTO.md`. |
| O que `drawn()` devolve para `Button` com press? | `{"type":"Button","props":{"key":"probe-btn","label":" ","plain":true},"press":{"plugin":"task-tree","handle":<n>}}`: `onPress` some das props e vira o campo `press` do elemento (fora de `props`). |
| Peso de uma linha de [D] 4.3 | Ver abaixo. |

Outras props exercitadas, todas aceitas e repassadas: `Text mono tabular wrap="truncate-end"`,
`size` (`heading`, `caption`, `footnote`), `weight` (`semibold`, `bold`), `dimColor`; `Box
borderStyle="round"` aninhado com `paddingY={0}` e `borderColor`/`borderDimColor`; `overflow="hidden"`,
`columnGap`, `marginBottom`; `Svg` 16×16 com `alt`.
Detalhe: `weight="semibold"` ou `"bold"` acrescenta `"bold": true` às props no `drawn()`.

## Controles (o harness valida, então "aceito" quer dizer algo)

- `Box hover={{ display: "none" }}`: recusado. Mensagem: `$.ui.mount: task-tree drew nothing on the desktop surface: task-tree's ui.render hook was skipped: task-tree: returned a tree Pane refuses: Box hover display "none" would hide it under the pointer; a hover only reveals (display "flex" on a Box drawn display "none")`.
- `Box position="fixed"`: recusado. `returned a tree Pane refuses: Box prop "position" must be one of relative, absolute`.
- `Text wrap="truncate-start"`: **aceito** pelo harness (não confere o valor de `wrap` de `Text`). Então o harness não garante que o app corta como pedido; o corte continua item do checklist.

## Peso por linha (JSON.stringify do `Box r<i>`; nós = elementos + strings)

| Linha | Bytes | Nós |
|---|---|---|
| tarefa simples (ícone `Svg` de 370 caracteres de fonte, título, contagem `1/2`, tempo `0:05`), sem botão | 1452 | 16 |
| a mesma, com o `Button fold:` sobre o ícone | 1717 | 18 |
| com colunas: guias, ícone (291) + botão, título + ` ⋯`, palavra, célula do busto vazia, barra nativa, contagem, tempo | 2251 | 29 |

Sem a fonte do `Svg`, a estrutura da linha simples tem ~1050 bytes: a fonte do ícone é ~28% da linha.
Calibração do teste de 600 KB: ~270 linhas com colunas, ~350 com botão, ~410 simples (fora o
cabeçalho; a árvore inteira da sonda, com cabeçalho e 3 linhas, deu 7,4 KB e 83 nós).
