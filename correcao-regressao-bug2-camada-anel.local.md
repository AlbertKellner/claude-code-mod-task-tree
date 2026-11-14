# correcao-regressao · bug 2 da fase 3 — a camada do nome cortado cobria o botão do anel

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Correção aprovada pelo usuário ("Sim,
corrija"); regra nova dele: "Sobre correção de bugs, não precisa me perguntar. Se encontrar, pode
corrigir". Branch `refactor/fase-3-layout`, sobre `ce87c54` (bug 1). 2026-10-22.

## O bug

Num cartão de sessão com nome cortado (…) e anel de contexto, a camada de tooltip do nome (um `Svg`
interativo com `pointer-events="all"`) ia da coluna do nome até a borda direita da linha
(`W − left·8` px) e ficava por cima do Box do anel (o último filho é desenhado por cima): o clique no
anel caía na camada, e a sessão não abria. Revelado por `sobreposicao.test.ts` (etapa 4), em `KNOWN`.

## A correção

- **`task-tree/draw/geometry.ts`**: `overlay('name', depth, W, ringNested?)` ganha o quarto
  parâmetro: com anel na linha, a camada encerra onde o Box do anel começa
  (`W − (ringRight(nested) + RING_CELLS)·CELL`), nunca abaixo de `NAME_MIN = 16` px; sem anel, até a
  borda, como antes. `overlays()` passa `line.ring ? nested : undefined`. A regra "nenhum par de Box
  se cruza" vale agora para os três pares.
- **`task-tree/tests/sobreposicao.test.ts`**: `KNOWN` vazio; o teste do cenário vira "a camada
  encerra onde o Box do anel começa" em 5 larguras × 6 profundidades × 4 aninhamentos (encosta, não
  cruza; sem anel segue até a borda); o teste de identidade com `overlay()` compara com e sem anel.
- `register.tsx` não mudou: já chamava `overlays()`.

## O que muda na tela

Só a área do tooltip do nome cortado num cartão **com anel**: para antes do anel (32 px a menos, ou
mais com cartões aninhados), e o anel volta a ser clicável nesses cartões. Nenhum pixel do SVG muda; o
golden do SVG não muda (a camada é um `Svg` com `alt` vazio, fora do golden, e o fixture real não tem
nome cortado em cartão).

## Testes

- **287 pass / 0 fail** (os mesmos 287; nenhum `TODO` impresso: `KNOWN` vazio nos dois arquivos).
  `claude plugin validate task-tree` e `validate .` ok.
- Golden do SVG (0 `GOLDEN-NEW`), golden dos textos (0 `TEXTOS-NEW`), orçamento (11 657 / 11 775 /
  47 400 / 48 158) e todo o resto: iguais.

## O que conferir no app

Sessão filha com nome longo (cortado com …) e anel: passar o mouse no nome mostra o tooltip; clicar
no anel abre a sessão.

## Fila de bugs

Vazia depois deste. Pendências que não são bugs, registradas: `panel(all)` sem escolhas com resultado
descartado e `elapsed` sem uso (etapa 1 da fase 3).
