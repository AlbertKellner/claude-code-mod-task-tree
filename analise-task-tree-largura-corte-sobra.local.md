# Largura do painel: corte em outros devs, sobra aqui (análise)

## Causa (a mesma para os dois sintomas)

A largura W de todas as Svgs vem de uma estimativa: `W = bodyColumns * COL_PX`
(`task-tree/draw/geometry.ts:19-24`, chamada em `task-tree/hooks/render.tsx:401`).

- `bodyColumns` é a largura do painel dividida pelo avanço da fonte de código da superfície
  (`index.d.ts:10925-10933`, `RenderViewport`). Esse avanço muda de máquina para máquina (fonte
  instalada, fallback do Windows, zoom/escala do app).
- `COL_PX = 8.6` foi medido nesta máquina (77 colunas ≈ 670 px). Em outra máquina, px por coluna é
  outro valor, então W não bate com o painel real:
  - avanço menor que 8.6 px (mais colunas para a mesma largura) → W > painel → corte à direita
    (print do outro dev, 0.7.7: cartão, barras e ≡ passam da borda);
  - avanço maior, ou painel largo além do ponto medido → W < painel → sobra à direita
    (print daqui: cartão termina ~730 de ~809 px, ≡/▤ ficam fora dele, pois os botões são
    ancorados na borda real e o desenho em W).
- Em 0.7.6/0.7.7 (main) a Svg é desenhada com `width={W}` fixo (`render.tsx`, antes do `12a27c8`),
  então o erro da estimativa aparece direto.

Observação: o checkout aqui está em `main` (0.7.6); o `12a27c8` (Svg a 100%) só existe na branch
`fix/task-tree-serie-12` (PR #24). Conferir qual código o mod instalado aqui está carregando: se for
main, o print daqui é exatamente a sobra de W < painel. Se for a série 12 e ainda sobrar, as partes
esticadas por CSS (`slot(W)`, `toRight` com `translateX(calc(...))`, `rect` com `width` em `style`)
não estão sendo aplicadas na imagem e o desenho fica em W — validar isso visualmente.

## Plano de correção

1. Parar de depender de `COL_PX` para o tamanho final: as Svgs do cabeçalho e das linhas ficam a
   100% da largura do slot (o que o `12a27c8` já faz), com tudo que é contado da direita ancorado
   pela borda real. Isso resolve o corte e a sobra ao mesmo tempo, independente da fonte.
2. Se a imagem não aplicar o CSS (`max(100%, Wpx)`, `translateX(calc)`, `rect` com width em style):
   trocar por um layout em que a parte da direita seja uma segunda Svg/Box ancorada à direita do
   slot (`Box` com `right`, como os botões ≡/▤ já fazem), e o miolo (fundo do cartão, barras)
   esticado pelo flex do Box em vez de calc dentro da Svg.
3. `slot(W) = max(100%, Wpx)` corta quando o painel é menor que W: usar `100%` puro (sem o piso W)
   e deixar o cálculo de encaixe (`svg.ts`, `room = end - left`, ~l. 387-397) trabalhar com um W
   conservador (ex.: `COL_PX` menor, 8.0) para que o que some por falta de espaço saia antes, nunca
   que passe da borda.
4. Os hovers interativos com `width={W - 64}` / `p.width` (`render.tsx` ~l. 121 e 133) também são
   larguras fixas em W: conferir que não passam da borda num painel menor que W.
5. Validação visual nas duas situações: painel estreito (~427 px) e largo (~809 px), e de
   preferência na máquina do outro dev (fonte diferente).
