# Brief: os 4 ajustes visuais do painel nativo (PR 37), com análise antes

Escrito pela orquestradora "Orq - TaskTree" em 2026-11-13. Só ela escreve aqui.

## Pedido do usuário (2026-11-13)

> Então, pra essas 4 alterações, volte ao que era, planeje usando subagente em fable alto, e implemente em opus baixo.

Motivo: os 4 ajustes abaixo foram aplicados no clone sem análise antes, contra a regra do repositório
("Toda mudança passa por análise antes da implementação, mesmo as triviais"). O clone voltou para a
ponta `22ad5de` de `feat/painel-nativo`, sem nada aplicado. O que tinha sido aplicado está guardado em
`ajustes-nativo-aplicados-sem-analise.diff` (nesta pasta), só como referência: não é o plano.

## Os 4 ajustes, com as palavras e as decisões dele

1. **O cartão não se destaca do painel.** "nao aparece nenhum card" (print
   `prints/2026-11-13-cartao-subagente-sem-destaque.png`). No tema escuro, o cartão de subagente e o
   de sessão têm o fundo igual ao do painel e a borda quase invisível. No `main`, o desenho em SVG
   tinha fundo `#20201f`/`#f9f9f7` e borda `#373736`/`#e1e1df` (escuro/claro; `draw/svg.ts` do
   `main`, classes `cd` e `cs`). Hoje `draw/desktop.tsx` usa `userMessageBackground` e a borda padrão.
2. **Comportamento estranho do segundo print.** "outro exemplo de comportamento estranho" (print
   `prints/2026-11-13-cartao-filha-estranho.png`). A análise anterior concluiu:
   - o cartão da sessão sem moldura é o mesmo problema do item 1;
   - os ícones do primeiro nível, o ▸ de "+N pedidos anteriores" e o cartão solto saem cortados pela
     metade na borda esquerda do painel;
   - os outros pontos (cartão sob o ✉ antes de a filha planejar, plano sob a mensagem do esforço, 0:00
     de etapas fechadas sem start) seguem as regras. Para o cartão sob o ✉, decisão dele: "Deixar como
     está". Não mexer nesses pontos.
3. **Guias contínuas.** As guias │ ├─ └─ em caracteres têm falhas entre as linhas. Decisão dele:
   "Caixas finas nativas (Recomendado)": guias como caixas nativas finas, contínuas entre as linhas,
   sem `Svg`. Isso reescreve a decisão de hoje "Caracteres (Recomendado)" (guias em caracteres de
   caixa): o cenário ganha `Reescrito: 2026-11-13, decisão do usuário ("Caixas finas nativas
   (Recomendado)")`.
4. **Contraste e espaço.** "aumente um pouco o contraste do card, deixando ele um pouco mais claro, e
   repita isso para cada card dentro de card. aumente um pouco o padding interno tambem, os textos
   estão muito colados, tando dentro do cartao, quanto fora". Ele usa o tema escuro; "mais claro" vale
   para ele. No claro, o mesmo contraste relativo.

## Regras

- Repositório: `<repo>`, branch
  `feat/painel-nativo`, ponta `22ad5de`. O mod é carregado a quente desse clone em todas as sessões.
- `CLAUDE.md` do repositório: análise antes; correção de bug traz teste e cenário no catálogo; teste
  existente que muda por decisão é selado `--tipo decisao`, teste novo `--tipo novo`; golden só se
  aprova com as palavras do usuário depois da validação no app (não rode `golden:aprovar`).
- Conta do GitHub: só AlbertKellner. Sem commit, sem push, sem `--no-verify` nesta etapa.
