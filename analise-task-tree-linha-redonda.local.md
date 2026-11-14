# Conector da árvore com canto arredondado

Pedido: "a linha que liga as tarefas aos pais é quadrada, dá pra deixar redonda?" (print 18: o └
em 90°). Decisão do usuário: **raio 6 px** (igual ao `CARD_RADIUS`).

## Onde o conector é desenhado
`draw/svg.ts`, `rowSvg` (~linhas 314–322), tudo num único `<path class="g">` de 1 px
(`stroke-opacity .55`), montado em `paths`:
1. `g.bars`: as verticais dos ancestrais que continuam (`M col(k) 0 V H`), uma por nível.
2. O conector da própria linha (linha 320):
   `M col(depth−1) 0 V (g.last ? cy : H)` — a vertical do pai, até o meio da linha (└, último
   filho) ou até o fim (├, com irmãos abaixo) — e `M col(depth−1) cy H x−BRANCH_GAP` (ramo
   horizontal de ~11 px até antes do ícone; num cartão de sessão, até `x − CARD_IN`, a borda do
   cartão).
3. `g.down`: a vertical que desce desta linha para as filhas (`M x cy+GUIDE_FROM V H`).
A geometria vem de `draw/geometry.ts` (`col`, `COL_STEP` 20, `BRANCH_GAP` 9, `CARD_IN` 12,
`GUIDE_FROM` 8, `CARD_RADIUS` 6). `labelSvg` (cartões) reaproveita o mesmo `paths`.

## Plano
1. Constante nova em `geometry.ts`: `BRANCH_RADIUS = 6` (ou reutilizar `CARD_RADIUS`, com
   comentário dizendo que o conector segue o raio do cartão).
2. Em `rowSvg`, trocar o conector (item 2) por um só subpath contínuo com arco:
   - └ (`g.last`): `M px 0 V cy−R A R R 0 0 0 px+R cy H xe`
     (desce até `cy − R`, arco de 90° no sentido horário até `(px + R, cy)`, segue até o fim do
     ramo `xe`);
   - ├ (não é o último): a vertical segue inteira até `H` e o ramo sai dela: `M px 0 V H` +
     `M px cy−R A R R 0 0 0 px+R cy H xe` (o arco sai da vertical; a vertical continua reta por
     baixo, como num ├ arredondado). Se o usuário preferir o ├ com canto reto (só o └ redondo),
     basta manter o `H` reto neste caso — a decidir na validação visual.
   Onde `px = col(depth−1)`, `R = min(BRANCH_RADIUS, xe − px, cy)` (o ramo tem ~11 px: 20 de
   coluna − 9 de `BRANCH_GAP`; no cartão, 20 − 12 = 8 px, então o arco de 6 px cabe nos dois).
3. Continuidade: o `+.5` de `col()` mantém o traço crisp; `stroke-linecap:round` nas pontas do
   ramo (ou `butt`, como hoje) não muda o canto. Como é um path só, nada de `linejoin` necessário
   (o arco já é suave). As verticais dos ancestrais (`g.bars`) e a `g.down` ficam retas.
4. Terminal: sem mudança (box-drawing `└ ├`).
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod e a validação visual: └ e ├
   em tarefas e em cartões de sessão (o ramo entra na borda do cartão), com e sem filhas abaixo.
