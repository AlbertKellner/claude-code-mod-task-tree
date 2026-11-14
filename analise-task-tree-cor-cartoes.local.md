# Cor de fundo dos cartões das sessões filhas

Pedido: "essa imagem tem 2 cores, sao cores padrão do claude code. Quero que a cor de fundo do painel
de sessoes seja a cor da esquerda". Decisões do usuário: o "painel de sessões" são **os cartões das
sessões filhas** (a moldura sob as tarefas); no tema claro, usar o **equivalente claro do app**.

## Medição e origem das cores
- Imagem 16.png (302×140): esquerda **#151515**, direita **#1a1a19** (medido nos pixels).
- No CSS do app desktop (`AnthropicClaude/app-3.6556.2/resources/ion-dist/assets/v1/c6059c89c-….css`):
  - `--page: #151515` no escuro, **`#fcfcfb` no claro** (fundo da página/conteúdo);
  - `--bg: #1a1a19` no escuro, `#fff` no claro (fundo dos painéis laterais, onde o Tarefas fica);
  - `--line: #ffffff1a` no escuro, `#0b0b0b1a` no claro (linhas/bordas).
  Ou seja: a esquerda é o `--page` do app; o painel onde o Tarefas é desenhado está sobre `--bg`.

## Onde o fundo do cartão é definido hoje
- `draw/svg.ts`, tabelas `LIGHT`/`DARK` (linhas ~65–74): classe `cd` (fundo do cartão) =
  `#f1efe8` claro / `#444441` escuro; classe `cs` (borda) = `#b4b2a9` claro / `#888780` escuro.
  Cada SVG leva só as regras que usa (`slim`), com `@media (prefers-color-scheme: dark)` para o
  tema. O desenho do cartão é `cardSlice` (linha ~278): `path.cd` (preenchimento) + `path.cs`.
- O fundo do painel inteiro não é do mod (o SVG é transparente sobre o `--bg` do app).

## Plano
1. `draw/svg.ts`: `cd` passa a **`#151515`** no `DARK` e **`#fcfcfb`** no `LIGHT` (o `--page` de
   cada tema).
2. Contraste da borda: com o cartão quase da cor do painel (`#151515` sobre `#1a1a19`; `#fcfcfb`
   sobre `#fff`), a moldura é o que separa o cartão. Manter `cs` e, se ficar fraca, usar a
   `--line` do app: `#ffffff1a` no escuro e `#0b0b0b1a` no claro (via `stroke-opacity`), ou manter
   `#888780`/`#b4b2a9`. Decidir na validação visual.
3. Cartões aninhados (filha de filha, `CARD_NEST`): mesma cor em todos os níveis; a borda já os
   distingue. Nada a mudar, só conferir.
4. O texto `p`/`s` dentro do cartão não muda (já é o do tema).
5. Sem testes nem docs (memória do projeto). Validar a recarga do mod e a validação visual nos dois
   temas: cartão #151515 (escuro) e #fcfcfb (claro) com a borda visível.

## Reaberto (a6f4e48 não agradou): a terceira cor, extrapolando o degrau
Pedido: "calcule os valores que a cor da direita tem em relação à cor da esquerda, e calcule qual
seria a terceira cor à direita. essa cor deve ser a cor desses painéis".

### Conta (tema escuro)
- Esquerda A = #151515 = (21, 21, 21); direita B = #1a1a19 = (26, 26, 25).
- Degrau por canal RGB: B − A = (+5, +5, +4).
- Terceira cor C = B + degrau = (31, 31, 29) = **#1f1f1d**.
- Conferência em HSL: A (L 8,24 %, S 0), B (H 60°, L 10 %, S 1,96 %); extrapolando L e S:
  L 11,76 %, S 3,92 %, H 60° → **#1f1f1d**, o mesmo.
- Por razão (B/A por canal, ×1,24/×1,24/×1,19): #20201e, 1 unidade acima; descartado, porque o
  degrau do app é aditivo (a luminância relativa também sobe quase linear: 0,0075 → 0,0103 →
  0,0136).
- Escolha: **#1f1f1d**.
- Contrastes (WCAG): cartão #1f1f1d sobre o painel #1a1a19 = 1,06 (sutil, como o próprio degrau
  do app); borda `cs` #888780 sobre o cartão = 4,6; texto `p` #e8e6dc sobre o cartão = 13,2.
  A borda continua separando bem; o cartão fica um tom mais claro que o painel, como pedido.

### Tema claro (mesma lógica)
- No claro o app tem `--bg` #fff (painel) e `--page` #fcfcfb: degrau (−3, −3, −4).
- Terceira cor = #fcfcfb + degrau = **#f9f9f7**.
- Contrastes: cartão sobre #fff = 1,05; borda `cs` #b4b2a9 sobre o cartão = 2,0 (visível, como a
  borda atual sobre #f1efe8); texto `p` #2c2c2a sobre o cartão ≈ 14.

### Plano
1. `draw/svg.ts`: `cd` = **#1f1f1d** no `DARK` e **#f9f9f7** no `LIGHT`.
2. Bordas `cs` mantidas (#888780 / #b4b2a9). Se na validação o cartão parecer igual ao painel,
   a alternativa é um degrau a mais (#242422 / #f6f6f3), a decidir com o usuário.
3. Validar a recarga do mod e a validação visual nos dois temas.

## Complemento: a terceira cor calculada nos dois temas, pelo CSS do app
Pedido: "a terceira cor deve ser calculada para o tema claro e escuro".

### Escada de superfícies do app (CSS `c6059c89c-….css`, blocos `:root` claro e `html[data-mode=dark]`)
| token    | escuro   | claro    |
|----------|----------|----------|
| `--page` | #151515  | #fcfcfb  |
| `--bg`   | #1a1a19  | #ffffff  |
| `--surf` | #20201f  | #ffffff  |

### Escuro
- A = `--page` (21, 21, 21); B = `--bg` (26, 26, 25); degrau B − A = (+5, +5, +4).
- Extrapolação: B + degrau = (31, 31, 29) = #1f1f1d.
- O app já tem o terceiro tom: `--surf` = **#20201f** (32, 32, 31), 1–2 unidades acima da conta
  (o degrau real do app é (+6, +6, +6)). Contrastes: sobre `--bg` 1,07; borda #888780 sobre ele
  4,5; texto #e8e6dc 13,0.
- **Decisão do usuário: #20201f** (o token do app).

### Claro
- A = `--page` (252, 252, 251); B = `--bg` (255, 255, 255); degrau B − A = (+3, +3, +4).
- Extrapolação literal: B + degrau = (258, 258, 259) → **passa do branco**; cortado, #ffffff, que é
  exatamente o `--surf` claro do app (o app repete o branco porque não há tom acima).
- Alternativa: o mesmo degrau na única direção possível, a partir do `--page`:
  (252, 252, 251) − (3, 3, 4) = **#f9f9f7**. Contrastes: sobre `--bg` #fff 1,05; borda #b4b2a9
  2,0; texto #2c2c2a ≈ 14.
- **Decisão do usuário: #f9f9f7** (cartão levemente cinza, distinguível além da borda).

### Plano (substitui o anterior)
1. `draw/svg.ts`: `cd` = **#20201f** no `DARK` e **#f9f9f7** no `LIGHT`.
2. Bordas `cs` mantidas (#888780 / #b4b2a9).
3. Validar a recarga do mod e a validação visual nos dois temas.

## Rodada 3: a barra de texto (print 17) — "o fundo é o mesmo? use a mesma cor da borda"
### Medição no print (188×106, tema escuro)
- Fundo da caixa de texto: **#20201f** (14 100 px) — **é o mesmo** fundo do cartão do a563d70
  (`--surf` do app).
- Em volta: #151515 (`--page`).
- Borda da caixa: uma linha de 1 px em **#373736** (com um meio-pixel #323231 de suavização).
  #373736 é exatamente `--line` = #ffffff1a (branco a 10 %) composto sobre #20201f
  (32 × 0,898 + 255 × 0,102 ≈ 55 = 0x37). Não é `--bord` (#fff3 daria #4d4d4c).
### Tokens do app (CSS do desktop)
| token    | escuro                       | claro                        |
|----------|------------------------------|------------------------------|
| fundo (`--surf`) | #20201f              | #ffffff                      |
| borda (`--line`) | #ffffff1a → #373736 sobre #20201f | #0b0b0b1a → #e6e6e6 sobre #fff; #e1e1df sobre #f9f9f7 |

### Resposta
Sim, o fundo é o mesmo (#20201f = `--surf`). A borda do cartão hoje é #888780 (tema escuro), bem
mais clara que a da caixa de texto (#373736).

### Plano
1. `draw/svg.ts`, tema escuro: `cd` fica **#20201f** (já está); `cs` passa a **#373736** (ou
   `stroke:#ffffff;stroke-opacity:.1`, que dá o mesmo sobre o cartão; o hex fixo é mais previsível
   porque a borda também toca o painel #1a1a19).
2. Tema claro, duas opções a confirmar com o usuário:
   - **fiel à barra de texto**: `cd` **#ffffff** (`--surf` claro) e `cs` **#e6e6e6** (`--line`
     sobre branco). O cartão fica branco sobre o painel branco, separado só pela borda clara
     (contraste 1,2);
   - **manter o #f9f9f7** decidido antes, com `cs` **#e1e1df** (`--line` sobre #f9f9f7): cartão
     levemente cinza e borda no mesmo espírito da barra de texto. Recomendo esta, porque no claro o
     app não tem um terceiro tom e o cartão branco some no painel.
3. Validar a recarga do mod e a validação visual nos dois temas (cartão e borda lado a lado com a
   caixa de texto).
