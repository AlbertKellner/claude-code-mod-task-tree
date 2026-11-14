# Pesquisa web: hover/tooltip em painel de mod (desktop) — 2026-11-09

Legenda: [LIDO] = página aberta por subagente. [RESUMO] = só resultado de busca. [OPINIÃO] = inferência minha.

## Achados
1. [LIDO] Bug aberto, sem resposta de mantenedor: Svg com isInteractive nunca mostra tooltip de `<title>` no Code tab do desktop. Claude Code 2.1.294, app 2.31226.1, macOS, aberto em 8/out. https://github.com/anthropics/claude-code/issues/100536
   - Sondas do autor: `svg:hover{opacity:.3}` DIMINUIU a barra (CSS :hover chegava ao frame); `title~rect` provou que o `<title>` chega ao frame; o tooltip nativo não aparecia.
   - Ou seja: já em 2.1.294 o tooltip por `<title>` não funcionava. O "funcionou em 21/10" do task-tree pode ter sido outro mecanismo (ver Hipóteses).
2. [LIDO] Pedido de recurso aberto (6/nov, Claude Code 2.1.317 desktop): hover em link de mod. Título de link Markdown não mostra tooltip; Box com `display:"none"` + `hover:{display:"flex"}` não revela em linha de transcrição; clique (onLinkPress) funciona. O autor afirma que Svg isInteractive "mostra tooltips de <title>", o que CONFLITA com o item 1 (versões diferentes; não resolvido). https://github.com/anthropics/claude-code/issues/107811
3. [LIDO] Mod de terceiro desistiu: PR #7 fechado ("works up to the frame and stops there"); PR #8 mesclado removeu a promessa de tooltip ("no tooltip is reachable on this build"). https://github.com/zexion7873/usage-band/pull/7 e /pull/8
4. [LIDO] Svg isInteractive no desktop vira `<iframe sandbox="" srcdoc>`; sem width/height fica 300x150 (bug aberto, 2.1.311). Sem isInteractive some hover/CSS/title. https://github.com/anthropics/claude-code/issues/105465
5. [RESUMO] #100797: o frame é reconstruído a cada re-render do AbovePrompt (quadro em branco). https://github.com/anthropics/claude-code/issues/100797
6. [LIDO] CHANGELOG 2.1.309 a 2.1.319 (https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md): NENHUMA entrada sobre hover, tooltip, isInteractive, pointer, iframe ou Svg. Entradas de mod sem relação: 2.1.310 Image no tmux; 2.1.318 registro da resposta ao ligar mods, `effort` em `$.model.fork`; 2.1.317 "don't ask again" em tool call de mod. 2.1.313 e 2.1.315 sem cabeçalho no texto lido.
7. [LIDO] Doc https://code.claude.com/docs/en/plugins/mods/reference: `hover` listado como prop de Box, Text e Button, sem descrever forma nem valor; "VS Code ignora hover". Não menciona tooltip nem BoxHoverProps. Remete a `types/claude-code.d.ts` para a API completa. Página cobre CLI/Desktop até v2.1.290.
8. [RESUMO] Pedido separado: dicas de hover de título de link Markdown e `<abbr title>` em mensagens. https://github.com/anthropics/claude-code/issues/95508

## Não achei
- Nota de versão do app desktop (4.16336 → 4.23118) sobre hover; o changelog do Claude Code não cobre o app. Não achei changelog público do app com esse detalhe.
- Qualquer resposta oficial, flag, permissão ou prop nova de tooltip. Nenhuma forma documentada de tooltip em painel.
- Issue sobre regressão de hover de Box/CSS entre 2.1.309 e 2.1.317. Não há issue que diga "parou de funcionar"; só "nunca funcionou" (#100536) e "não funciona" (#107811).
- Os arquivos .d.ts de tipos (não lidos): vale comparar `HoverProps` do `types/claude-code.d.ts` gerado pelo `validate` com o de versão antiga.

## Hipóteses [OPINIÃO]
- A hipótese "o app removeu o hover" NÃO tem suporte nas fontes: nenhuma menciona remoção. O que existe: hover de Box nunca foi visto funcionando em transcrição (#107811) e `<title>` nunca mostrou tooltip (#100536).
- CSS :hover dentro do Svg isInteractive funcionava em 2.1.294. Se hoje nem isso reage, pode ser regressão do app (4.23118) ou o frame não estar interativo (isInteractive perdido, ou re-render recriando o frame, #100797). Vale testar um Svg mínimo com `svg:hover{opacity:.3}`.
- Alternativa que independe do app: tooltip desenhado por nós. Com isInteractive, `:hover` por CSS funciona (#100536), então um `<g>` oculto que aparece com `g:hover > .tip{display:inline}` dentro do próprio SVG dá um "tooltip" sem depender do `<title>` nativo (CSS :hover confirmado só em 2.1.294; não testado em 2.1.317).
