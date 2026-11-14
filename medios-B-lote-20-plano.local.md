# Lote 20: toks/s e "ultracode" no cabeçalho em qualquer largura

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit (uma
decisão). Só `draw/head.tsx` muda.

## 1. O que cobre

- Achado: "toks/s e 'ultracode' do cabeçalho não são desenhados abaixo de 84 colunas; os testes não veem
  a falta".
- Decisão 27 (B), 2026-11-14: "Os dois sempre". Texto da opção: "toks/s e 'ultracode' em qualquer
  largura, numa linha a mais ou apertando o bloco de números. Muda o desenho aprovado a 60 colunas e o
  golden." (não era a recomendada; vale a resposta). Nota da orquestradora: "validação no app".
- Parte direta do mesmo achado: os cenários dizem a largura, e um teste confere o que é desenhado, sem
  contar o texto alternativo.

## 2. Causa confirmada na ponta

- `draw/head.tsx:58-59`: `NARROW = 84`. `:99-105`: abaixo de 84 colunas, `ultra` é falso e `rate` é
  indefinido; o bloco de números (`:134-157`) desenha o "%", o "d de n" e o tempo.
- `hooks/render.tsx:301-311`: o texto alternativo da barra diz o toks/s e "ultracode" sempre.
- `tests/ultracode.test.ts:21` e `:47-64`: o teste de `ultracode.cabecalho` lê `cabecalho.texto`, que
  junta o que é mostrado com o texto alternativo dos `Svg`, a 60 colunas: passa sem a palavra estar
  desenhada. O mesmo em `tests/taxa.test.ts:8` (`altTopo`).

Escrito no código. O cabeçalho estreito sem toks/s veio do desenho V4 aprovado em 2026-11-03 ("gostei da
V4"); a resposta de 2026-11-14 o muda.

## 3. O que muda

`draw/head.tsx`, só o cabeçalho estreito (menos de 84 colunas):

- o bloco de números ganha, abaixo do tempo, uma linha para o toks/s (quando há) e uma para "ultracode"
  (quando o interruptor está ligado), cada uma na letra pequena das outras, alinhadas à direita; o toks/s
  apagado quando é o do último turno, e "ultracode" na cor do rótulo do app (`effortUltra`), como no
  largo;
- sem toks/s e sem "ultracode", o cabeçalho estreito fica exatamente como hoje (nenhuma linha vazia a
  mais);
- a largura que o bloco reserva no cálculo do espaço da coluna da esquerda (`blockCols`) passa a
  considerar a linha mais larga do bloco estreito (até "1000 toks/s", 11 caracteres, e "ultracode", 9),
  para o título, o repositório e as pílulas não invadirem o bloco.

O cabeçalho largo (84 colunas ou mais) não muda: tempo, toks/s e "ultracode" na mesma linha.

No painel: no painel lateral comum (perto de 80 colunas) e no de 60, o cabeçalho mostra "%", "d de n", o
tempo e, embaixo, "N toks/s" e "ultracode", quando existem.

## 4. Impacto

`npm run impacto -- task-tree/draw/head.tsx`: 49 cenários (cabeçalho, ultracode, visual). Checklist: os
15 de `visual.*` e `ultracode.cor-e-corte`. Golden pelo mapa: os quatro. Nenhum dos quatro cenários tem
toks/s da própria sessão nem "ultracode" (não há passo do modelo nem o interruptor): o desenho deles não
muda. O desenho novo (60 colunas com toks/s e "ultracode") não está em nenhum cenário do golden: vai ao
checklist do app.

## 5. Testes

Novos. Um ajudante local em cada arquivo lê só o que o cabeçalho desenha: os pedaços de texto do
cabeçalho do app (`(await noApp($, { colunas })).cabecalho.pedacos`, os de `tipo === 'texto'`), sem os
textos alternativos.

1. `tests/ultracode.test.ts`: "com o interruptor ligado, 'ultracode' é desenhado no cabeçalho a 60 e a
   100 colunas, não só no texto alternativo". Cenário `ultracode.cabecalho` e o novo
   `cabecalho.toks-e-ultracode-em-qualquer-largura`. Roteiro: o do teste de `:47-64` até o
   `ultra_effort_enter`. Afirma: o texto desenhado contém "ultracode" a 60 e a 100 colunas; depois do
   `ultra_effort_exit`, em nenhuma. Falha hoje a 60 colunas.
2. `tests/taxa.test.ts`: "o toks/s do cabeçalho é desenhado a 60 e a 100 colunas". Cenários
   `taxa.velocidade-de-geracao` e `cabecalho.toks-e-ultracode-em-qualquer-largura`. Roteiro: o do
   primeiro teste do arquivo (um passo de 200 tokens em 2 s). Afirma: o texto desenhado contém "100
   toks/s" nas duas larguras. Falha hoje a 60 colunas.

Testes existentes: nenhum muda (os que leem o texto com o alternativo seguem passando).

## 6. Catálogo e selos

- `regras/cabecalho.md`, cenário novo `### cabecalho.toks-e-ultracode-em-qualquer-largura`
  - Título: "O cabeçalho desenha o toks/s e 'ultracode' em qualquer largura."
  - Dado a própria sessão com o toks/s medido ou o interruptor de ultracode ligado
  - Quando o cabeçalho é desenhado no app desktop, num painel estreito (menos de 84 colunas) ou largo
  - Então o toks/s e "ultracode" aparecem desenhados no bloco de números, não só no texto alternativo:
    no largo, na linha do tempo; no estreito, em linhas próprias abaixo do tempo; sem eles, o cabeçalho
    estreito fica como antes
  - `Origem: decisão do usuário, 2026-11-14 ("Os dois sempre"); desfaz, para o toks/s, o cabeçalho
    estreito sem ele do desenho V4 ("gostei da V4", 2026-11-03).`
  - `Código: hooks/render.tsx`
  - `Estado: coberto`
- `regras/ultracode.md`, `ultracode.cabecalho`: o Então vira "'ultracode' aparece desenhado no bloco de
  números do cabeçalho, em qualquer largura: no painel largo (84 colunas ou mais), na linha do tempo e do
  toks/s, depois deles; no estreito, numa linha própria abaixo (o cabeçalho não desenha o modelo)". Linha
  nova: `Reescrito: 2026-11-14, decisão do usuário ("Os dois sempre"): a palavra é desenhada também no
  cabeçalho estreito. O teste existente deste cenário não muda.`
- `regras/visual.md`, `visual.cabecalho-em-cartao`: no Então, depois de "(o % grande, 'd de n', o tempo e
  toks/s)", acrescentar "; no painel estreito, o toks/s e 'ultracode' em linhas próprias abaixo do
  tempo". Linha nova: `Reescrito: 2026-11-14, decisão do usuário ("Os dois sempre").` O estado segue
  `checklist`.
- `regras/ultracode.md`, `ultracode.cor-e-corte` (checklist): acrescentar ao Então "; no cabeçalho
  estreito, a mesma cor". Mesma linha `Reescrito`.

Selos (`novo`):

    npm run regras:selar -- "task-tree/tests/ultracode.test.ts::com o interruptor ligado, 'ultracode' é desenhado no cabeçalho a 60 e a 100 colunas, não só no texto alternativo" --tipo novo --motivo "decisão do usuário, 2026-11-14: Os dois sempre"
    npm run regras:selar -- "task-tree/tests/taxa.test.ts::o toks/s do cabeçalho é desenhado a 60 e a 100 colunas" --tipo novo --motivo "decisão do usuário, 2026-11-14: Os dois sempre"

## 7. Documentação

`DESENVOLVIMENTO.md`: no item "Cabeçalho V4" e na seção "Desenho nativo híbrido (2026-11-13)", onde o
cabeçalho estreito é descrito (procurar `NARROW` ou "84"), a decisão com as palavras e a data. O
comentário de `NARROW` em `draw/head.tsx:58`. `CLAUDE.md`, "Checklist do app", item do desenho nativo:
acrescentar "o toks/s e 'ultracode' no cabeçalho estreito, em linhas próprias, sem cortar o '%'".

## 8. Golden

Não muda nos quatro cenários de hoje (seção 4). Se o check acusar "o desenho de <cenário> mudou", o
cabeçalho estreito sem toks/s nem "ultracode" foi alterado sem querer: corrigir, não regravar.

## 9. Checklist do app

É a validação que a decisão pede. Num painel estreito (o lateral comum e o mais estreito possível), nos
dois temas: com o modelo respondendo, "N toks/s" aparece abaixo do tempo; com o ultracode ligado,
"ultracode" em roxo abaixo; o "%" e o "d de n" não são cortados; o título e as pílulas não encostam no
bloco; a altura do cabeçalho não muda quando as linhas aparecem ou somem. No painel largo, tudo como
antes.

## 10. Dependências e conflitos

- Independente dos outros lotes no código (os lotes 16, 18 e 19 mexem em `render.tsx` e `svg.ts`, não em
  `head.tsx`). Pode entrar em qualquer ponto depois do lote 06 (que só toca um comentário de
  `head.tsx`).
- Triagem C, decisão 43 ("Ampliar o golden (Recomendado)": "os desenhos novos passam pela validação dele
  no app antes do commit"): um cenário novo de golden com toks/s e "ultracode" a 60 colunas é de C; se C
  vier depois, grava o desenho deste lote. Decisão 42 ("Cenário por texto") não toca.

## 11. Bloqueio

Nenhum. A forma escolhida entre as duas que a opção oferecia ("numa linha a mais ou apertando o bloco de
números") foi a de linhas a mais, porque o bloco estreito tem 11 colunas e "N toks/s · ultracode" na
mesma linha não cabe.
