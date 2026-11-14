# Animações no painel do task-tree

## O que o kit permite (confirmado)
- O painel desktop é feito de `Svg` (`draw/svg.ts`), um por linha e um para o cabeçalho. Sem
  `isInteractive`, é desenhado como imagem; com ele, num frame sandbox (só as camadas de tooltip).
- **Prova feita (sem commit, já retirada):** no cabeçalho, desenhado como imagem, uma bolinha com
  SMIL (`<animate attributeName="opacity" … repeatCount="indefinite">`) e outra com CSS
  (`<style>@keyframes …</style>` + `animation`). O usuário viu **as duas pulsarem**.
- Limites:
  - Cada vez que o `source` de uma linha muda, o SVG dela é recriado e a animação recomeça. As
    linhas com relógio mudam a cada 1 s (`keepTime`).
  - Não há "de onde veio": a barra não desliza de 40% a 60%, só pode entrar do zero até o valor.
  - Sumir não se anima: a linha sai do desenho na hora.
  - Sem JS (o frame não tem scripts).

## Escolha do usuário
"Fade-in de linhas e cartões", "Ícone com transição de estado" e "Chips e barra suaves". O pulso em
laço no ◉ não foi escolhido.

## Mecanismo comum: animar só no desenho em que algo mudou
- Memória de módulo (como `drawn`/`breaksMemo`) `seen: Map<string, { tone; n; d; at }>`, por
  chave estável da linha (a de dobra `fold.key`, senão `scope + id` da tarefa ou do cartão; o
  `layout` já gera essas chaves). Para os chips, a chave é o `tone` deles. Para a barra do
  cabeçalho e das linhas, a chave é o `d/n`.
- Em `render`, comparar com o desenho anterior e marcar em cada `Row` o que é novo:
  `enter` (chave não vista) e `changed` (tom ou `d/n` diferente). O `rowSvg`/`headerSvg` só
  escrevem a animação quando a marca existe.
- Para o próximo redesenho (o relógio, 1 s depois) não reiniciar, a marca vale só até
  `at + DUR` (ex. 400 ms): passado isso, o SVG sai sem a animação, no estado final, sem salto,
  porque a animação termina no estado final. As animações duram ≤ 300 ms, menos que o tique de 1 s.
- Depois de uma recarga do mod, `seen` começa vazio: não animar no primeiro desenho do módulo (tudo
  seria "novo").
- `prefers-reduced-motion`: dentro do `<style>`, `@media (prefers-reduced-motion: reduce)
  { * { animation: none } }`.

## Animações
1. **Fade-in de linhas e cartões** (`enter`): no `<svg>` da linha, `<style>` com
   `@keyframes in{from{opacity:0;transform:translateY(-3px)}to{opacity:1}}` e o grupo raiz
   `animation: in .2s ease-out`. Nos cartões, a moldura (`cd`/`cs`) e o cabeçalho do cartão entram
   juntos. As linhas que entram juntas podem ter um atraso de 30 ms por índice, até 150 ms.
2. **Ícone com transição de estado** (`changed` de tom): só o `<g>` do ícone
   (`icon()`/`GLYPH`, `draw/svg.ts` ~180–210) recebe `@keyframes pop{0%{opacity:0;transform:
   scale(.6)}100%{opacity:1;transform:scale(1)}}` em .25s, com `transform-origin` no centro do
   ícone (`transform-box: fill-box`). O ✓ pode desenhar o traço (`stroke-dasharray` /
   `stroke-dashoffset` de 12 a 0).
3. **Chips e barra suaves**:
   - chip novo (tom não visto no desenho anterior): fade-in 200 ms no `<g>` do chip em
     `headerSvg`. O chip que some não se anima. Com o cabeçalho de altura fixa (plano da linha de
     chips), nada pula;
   - barra (cabeçalho `grf` e linhas `ratioBar`/`rect.grf`): quando o `d/n` muda, o `rect` da
     parte verde anima `width` de 0 ao valor (SMIL `<animate attributeName="width" from="0"
     to="W" dur=".3s" fill="freeze">`) ou com `transform: scaleX` de 0 a 1 (`transform-origin:
     left`). É "entra do zero", como dito ao usuário.
4. Terminal: sem mudança (texto).

## Riscos
- Tamanho do desenho (`DRAW_LIMIT`): o `<style>` vai só nas linhas marcadas, poucas por desenho.
- O desenho fica impuro (depende de `seen` e do relógio): manter a comparação em `render` e passar
  as marcas para as funções puras por `Row`.
- Validar a recarga do mod e fazer a validação visual: planejar 3 tarefas (fade das linhas), dar
  start/done (ícone ○ → ◉ → ✓, barra) e abrir uma filha (cartão e chip "sessão ativa"). Sem testes
  nem docs (memória do projeto).
