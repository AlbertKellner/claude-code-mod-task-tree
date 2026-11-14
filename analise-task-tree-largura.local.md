# Ajuste 1: linhas ocupam a largura toda do painel

## Causa
- Toda linha (e o cabeçalho) é um `Svg` com largura fixa em px `W = lineWidth(bodyColumns)` =
  `clamp(240, colunas × 8 − 8, 900)` (`draw/geometry.ts:19`, chamado em `hooks/render.tsx:283`).
- `Svg.width` é em px CSS e não estica: sem `width`, toma a largura do próprio markup. Ou seja, o
  desenho mede exatamente `W`, nunca a largura real do slot.
- `W` subestima o slot: perde-se uma célula (`− CELL`) e a conversão colunas→px usa 8 px, enquanto a
  largura real do corpo do painel é maior. No print, o cabeçalho e as linhas terminam em ~607 px e o
  slot vai até ~670 px (≈ 10% a mais); os botões ≡/▤ (Box `position=absolute right=0`,
  `render.tsx:80`) estão ancorados na borda real, por isso ficam fora da área desenhada e a faixa à
  direita fica vazia. A barra do cabeçalho também acaba em ~607, não na borda.
- O tempo já é alinhado ao fim de `R = W − EDGE_PAD`; corrigindo `W`, tempos, barras, anéis e
  cartões vão para a borda sozinhos (todos são relativos à borda direita).

## Plano de implementação
1. Medir: registrar (log do mod, `io/log.ts`) `bodyColumns` no desktop e comparar com a largura real
   do painel no print do usuário, para achar px/coluna real do desktop. Se não der para medir só por
   log, usar a razão do print (slot ≈ 670 / W ≈ 607 com o mesmo `bodyColumns`).
2. Ajustar `lineWidth` em `draw/geometry.ts`:
   - tirar o `− CELL` (a célula a menos reservava nada útil: os ícones ≡/▤ ficam sobre o SVG, e o
     título já reserva `ICONS_W`);
   - usar o px real por coluna do desktop (constante nova, ex. `COL_PX`, separada de `CELL`, que
     continua valendo para posicionar Boxes) se a medição mostrar que não é 8;
   - manter `MAX_W` alto o bastante (900 hoje) ou subir, para painéis largos.
   - Cuidar para não passar da borda: se `W` ficar maior que o slot, aparece rolagem horizontal ou
     corte; preferir errar 1–2 px para menos.
3. Conferir os overlays (`overlays`, ancorados pela borda mais próxima): o anel e o ⑂ são contados
   a partir da direita, então seguem a borda nova; o hover do cabeçalho (`W − 64`) idem.
4. Atualizar o texto de `DESENVOLVIMENTO.md:465` só se a regra da fórmula mudar (a memória diz sem
   docs no task-tree: então apenas não deixar o comentário de `geometry.ts` desatualizado).
5. Validar a recarga do mod (`validate`) e o usuário confere visualmente: tempos encostando na borda
   direita (com `EDGE_PAD` de 8 px), alinhados com o fim da barra do cabeçalho e com o ▤.

## Riscos
- O px por coluna pode variar com o zoom/escala (o comentário de `geometry.ts` mediu 7,87 px reais
  numa escala 1,25). Se a razão não for constante, alternativa: deixar uma folga fixa pequena em vez
  de calibrar.
