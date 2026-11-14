# correcao-regressao · bug 3 (fase 4) — teste instável: o orçamento estourava o tempo do kit sob carga

Sessão `correcao-regressao` (Fable 5.1, esforço médio). Branch `refactor/fase-4-io-e-eventos`, sobre
`8499b07` (etapa 1 da fase 4). 2026-10-22. Pedido da orquestradora: a governança viu 290/1 numa
rodada e 291/0 nas duas seguintes, sem saber qual teste falhou.

## Reprodução

- 16 rodadas da suíte, uma de cada vez: 0 falhas.
- 2 suítes ao mesmo tempo (a máquina carregada, como quando a governança rodou a dela enquanto outras
  sessões trabalhavam): **as duas falharam no mesmo teste**:

```
(fail) orçamento do desenho (estado real) > as quatro combinações ficam dentro da baseline, com folga [5029.11ms]
  Error: timed out after 5000 ms
```

- Causa: o teste único fazia 4 combinações × 5 desenhos (mais 4 trocas de visão e o início da sessão)
  num só teste, 1,4 s em máquina livre; o kit dá 5 s por teste; com a máquina carregada o tempo
  triplica e estoura. Não era o orçamento em si (size/lines/svgs iguais) nem os `press.handle`
  sorteados (esses só variam 14–16 bytes, dentro da folga).
- Dois outros pontos do mesmo teste e do golden dependiam do tempo de parede: a afirmação
  `ms < MAX_MS` (500 ms) e o `setTimeout(100)` que esperava a leitura de fundo das filhas depois do
  `session.start` (se a leitura demorasse mais, o golden compararia um painel sem filhas).

## A correção (só testes; nada no mod)

- **`task-tree/tests/orcamento.test.ts`** (+45/−17): um teste por combinação (4 testes, cada um com os
  seus 5 s), 3 desenhos por medida em vez de 5; a afirmação de tempo de parede sai (o `ms` segue no
  relatório `ORCAMENTO …` do stdout, só para o olho); a espera fixa vira `settled($, h)`: espera o
  fato, visto pelo host (mocks): o estado `children` com todas as filhas (`on('state.set')` por baixo
  do estado do kit, passando ao `next`) e uma publicação do painel depois disso (`fs.write`), até 4 s,
  com erro que diz onde parou.
- **`task-tree/tests/svg-golden.test.ts`** (+25/−5): a mesma espera pelo fato no teste do estado real,
  em vez de `setTimeout(100)`.
- Tentativa descartada: esperar "dois desenhos seguidos iguais" não funciona, porque os `handle` dos
  botões são sorteados a cada desenho.

## Testes

- Suíte: **294 pass / 0 fail** (291 + 3: o orçamento virou 4 testes). `validate task-tree` e
  `validate .` ok.
- Prova de estabilidade: 2 suítes simultâneas (a carga que reproduzia a falha) + 5 rodadas seguidas +
  1 rodada final no texto definitivo: ver o relato (todas 294/0).
- Golden do SVG, golden dos textos e baseline do orçamento: iguais (ORCAMENTO 11657 / 11775 / 47400 /
  48162, dentro da variação dos handles).

## Registrado, fora deste item

Esperas fixas da mesma família ainda existem em `durabilidade.test.ts` (150 ms), `reinicio.test.ts`
(150 ms) e `task-tree.test.ts` (20/50 ms e um laço de até 200 ms): não falharam em nenhuma das
rodadas, nem sob carga, mas são o mesmo padrão; se oscilarem, a troca pela espera por fato é a mesma.

## O que conferir no app

Nada: só testes mudaram.
