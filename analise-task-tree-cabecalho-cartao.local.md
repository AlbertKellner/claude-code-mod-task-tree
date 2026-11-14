# Cabeçalho do painel dentro de um cartão, sem a linha divisória

Pedido: "coloque todo esse cabeçalho dentro de um painel com as mesmas cores do painel de sessão, e
remova a barra horizontal de divisão" (print 22).

## Decisões do usuário
- Botões ≡/▤ **dentro do cartão**, no canto superior direito (sobre a linha do título, como hoje).
- Margem interna **12 px** (texto e barra em relação à borda), **8 px** de espaço até a primeira
  linha da lista; altura fixa passa de 88 para ~100 px.
- Largura **de borda a borda**, como as linhas: 2,5 px de folga em cada lado (`CARD_RIGHT`).

## Onde está hoje (`draw/svg.ts` `headerSvg`, linhas ~497–543; `draw/geometry.ts` 72–77)
- Um SVG de altura fixa `HEADER_H = 88` com `HEADER_PAD = 8` de recuo: título em y 18, contagem em
  y 36 (com toks/s, repo e branch na mesma linha), barra em y 46 (4 px), chips em y 68–72, e a
  **linha divisória** `path.ln` em `H − 0,5` (linha 539).
- Os botões ≡/▤ são Boxes do app sobre o SVG, ancorados à direita (`hooks/render.tsx:131`,
  `position absolute right 0`), e o título reserva `ICONS_W = 72` px para eles.
- A camada de tooltip do título (`hoverLayer`, `W − 64` × 24) fica sobre a linha do título.
- O cartão de sessão é `cardSlice(L, R, y0, y1, …)` com classes `cd` (fundo) e `cs` (borda),
  raio `CARD_RADIUS = 6`.

## Plano
1. `geometry.ts`: `HEADER_PAD` passa a **12 + 2,5** (recuo interno a partir da borda do cartão,
   que fica a `CARD_RIGHT` = 2,5 px do limite do SVG); `HEADER_H` = **100** (fixa: 2,5 de borda +
   ~92 de conteúdo + 2,5 + 8 de respiro embaixo, ver passo 3). `ICONS_W` segue 72 (os botões
   ficam dentro, deslocados 2,5 px para dentro da borda; ajustar o `right` do Box para
   `CARD_RIGHT + 4` células? O Box é posicionado em células: manter `right 0` e dar ao cartão a
   folga de 2,5 px, que cabe no botão).
2. `headerSvg`: desenhar primeiro a moldura, `cardSlice(CARD_RIGHT, W − CARD_RIGHT, 2.5, H − 8 − 2.5,
   true, true)` (fundo `cd`, borda `cs`, raio 6), e **remover** o `path.ln` da linha 539. Deslocar
   todos os `y` em +4 (título 22, contagem 40, barra 50, chips 72/76) para a margem interna de 12
   (a borda do cartão fica em y 2,5; o título a 12 px dela). `L = CARD_RIGHT + 12`,
   `R = W − CARD_RIGHT − 12`.
3. Espaço até a lista: os 8 px abaixo do cartão ficam **dentro do SVG do cabeçalho** (altura fixa
   100 = 92 do cartão + 8), para a altura não variar e a primeira linha não pular (regra do 7577d14).
4. Estado vazio ("Nenhuma tarefa planejada"): mesmo cartão e mesma altura, textos dentro.
5. `hooks/render.tsx`: a camada de tooltip do título passa a `top 4` (ou mantém 24 px de altura a
   partir de 0: cobre o título a y 22 do mesmo jeito); os botões continuam no Box `right 0`, agora
   visualmente dentro da moldura. Conferir que o `hoverLayer` não cobre os botões (hoje `W − 64`).
6. Terminal: sem mudança (não há cartão nem divisória desenhados lá; conferir se há `─` e manter).
7. Sem testes nem docs (memória do projeto). Validar a recarga do mod; validação visual nos dois
   temas: cartão com a cor e a borda iguais aos cartões de sessão, botões dentro do canto, sem
   linha divisória, 8 px até a primeira linha, chips aparecendo e sumindo sem a lista pular.
