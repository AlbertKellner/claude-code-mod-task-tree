# Animação de entrada das linhas de tarefa: parece cortada até acabar

Pedido: "as animacoes ficam cortadas até a animacao acabar, e ai ficam normais ... faça outra
animação para as linhas de tarefa do painel. a animacao dos icones está boa, não mexa nessas".
Print 26 (durante a animação: faixas escuras entre as linhas dentro dos cartões).

## Causa
`draw/motion.ts` `fadeIn` (linhas ~84–90): a linha que entra recebe
`piece('in', '.mv', opacity 0,3→1, translateY(−6px→0))`, e `.mv` é o grupo que `animate()`
cria em volta do **desenho inteiro da linha** — inclusive o pedaço do cartão (`path.cd` fundo e
`path.cs` borda, de `cardSlice`), as guias da árvore (`path.g`) e o ícone. Então, enquanto anima:
1. o desenho sobe até 6 px: o topo sai da caixa do SVG da linha (recortado) e sobra uma faixa vazia
   embaixo; os pedaços de cartão e as guias das linhas vizinhas não se encontram mais;
2. com opacidade de 30 %, o fundo do cartão fica transparente e o painel aparece por trás.
O resultado são as faixas entre as linhas e a impressão de "linha cortada, menor, que cresce" até o
último quadro (500 ms, `DUR`).

## Testes com o usuário (variantes sem commit, já retiradas com `git checkout`)
Em todas, a moldura do cartão (`cd`, `cs`) e as guias (`g`) ficaram **fixas e opacas**; só o
conteúdo animava (seletor `.mv>:not(.cd):not(.cs):not(.g)`, e `:not(.ic)` para o ícone fixo).
1. **Esmaecer** (opacidade 0,3→1, sem mover): "Sem corte, mas fraco".
2. **Deslizar** (−8 px→0 na horizontal + esmaecer): "Bom, sem corte".
3. **Revelar** da esquerda para a direita (`clip-path: inset(0 X% 0 0)` com X 100→0, por
   elemento): na primeira rodada "Não vi"; repetida, **escolhida: "REVELAR"**.
4. Revelar com o ícone **junto** × **fixo**: escolhido **"Ícone fixo"**.

## Decisão
**Revelar da esquerda para a direita, com o ícone fixo.** Moldura e guias fixas. A animação dos
ícones (troca de estado, `pop`) e as de barra e chips não mudam.

## Plano de implementação
1. `draw/motion.ts`, `fadeIn(ago)`:
   - seletor: `.mv>:not(.cd):not(.cs):not(.g):not(.ic)` (só o conteúdo: título, ⋯, `meta`, barra,
     x/y, tempo, ícone de sessão à direita, repo/branch e toks/s no cartão);
   - valores por quadro: `clip-path:inset(0 ${lerp(100, 0, k)}% 0 0)` com o `phase(ago)` atual
     (estático no quadro + trecho CSS de 100 ms até o próximo, como as outras);
   - nada de `opacity` nem `transform` na entrada; atualizar o comentário ("fades in and slides 6
     px down" → revela da esquerda para a direita, só o conteúdo).
   - Observação do teste: o `inset` é por elemento (cada texto se abre na sua própria caixa), e foi
     assim que o usuário aprovou. Uma revelação única da linha inteira exigiria agrupar o conteúdo
     num `<g>` em `rowSvg`/`labelSvg`; não é necessária.
2. `REDUCE` (prefers-reduced-motion) segue cobrindo a regra.
3. `hooks/render.tsx`: sem mudança (`motion(i)` continua chamando `fadeIn` só para `enter`).
4. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual: linhas
   novas num cartão e na lista principal se abrem da esquerda para a direita, sem faixas entre as
   linhas, com o ícone já no lugar; troca de estado do ícone e barra iguais a antes.
