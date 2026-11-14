# Lote 12: a linha recolhida leva os chips e a faixa

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

## 1. O que cobre

Correção direta: "Recolher uma linha muda os chips e a faixa do cabeçalho". Nenhuma decisão nova; aplica
`cabecalho.numeros-somam-o-desenhado` ("os números somam o que o painel mostra, e recolher não muda
nada"; 2026-10-23: "as colapsada, mas que estao nessa visao, tambem entram").

## 2. Causa confirmada na ponta

- `hooks/render.tsx:279-296`: o "d de n", o tempo e os chips de tarefa saem das tarefas que cada linha
  desenhada representa (`Row.nodes`), e a linha recolhida leva as tarefas do que esconde. Mas os chips
  "aguardando" (avisos e sessão que espera sem aviso próprio), "aguardando sessão" (carta na fila),
  "sessões ativas" e "subagentes" são contados por linha desenhada: `tally(...)` em `:281`, `:293` e
  `:294`, e a soma de `r.subs` em `:294`. O estado geral (`headerState`, `:296`) e o relógio do cabeçalho
  (`:282`) usam os mesmos números.
- `draw/layout.ts`: a linha recolhida não leva o que esconde além das tarefas. Tarefa: `:1151-1159`
  (recolhida, `rest` fica vazio; some o aviso, a carta, o cartão da sessão e os subagentes de baixo).
  Pedido: `:1225-1226`. Cartão de sessão: `:1294-1301` (o cabeçalho do cartão segue contando a própria
  sessão, mas não as sessões, avisos, cartas e subagentes de dentro). Cartão de subagente: `:1616-1622`.
  Cartão de grupo: `:1552` (recolhido, só o cabeçalho, que já leva os vivos em `subs`).

No painel, lido no código: a filha pede permissão e a pessoa recolhe o cartão, a tarefa de origem ou o
pedido: o chip "1 aguardando" some e a faixa passa de "aguardando" a "sessão ativa" ou "em andamento".
Recolher a tarefa com o cartão de uma filha trabalhando tira "1 sessão ativa"; com carta na fila, tira
"aguardando sessão"; com subagentes, tira o chip deles.

## 3. O que muda

- `draw/layout.ts`, tipo `Row`: um campo opcional novo, só na linha recolhida, com o que as linhas
  escondidas contariam: avisos de espera (as linhas de aviso e as sessões que esperam sem aviso próprio),
  cartas na fila, sessões vivas e subagentes vivos.
- `draw/layout.ts`, onde uma linha recolhe (`rows`, `turnRows`, `session`, `draw` e `groupCard`): as
  linhas de dentro são sempre montadas (em `session` e em `draw` já são; em `rows` e `turnRows` passam a
  ser), somadas por uma função só (cada linha conta por si, mais o que ela mesma esconde), e descartadas
  quando a linha está recolhida. A soma vai no campo novo. A linha aberta não ganha o campo.
- `hooks/render.tsx`: os quatro números (`waitingNow` sem a parte `resting`, cartas na fila, sessões
  vivas, subagentes) passam a somar, além das linhas desenhadas, o campo novo de cada linha. `headTime`
  e `headerState` usam os números assim somados.
- A linha "+N pedidos anteriores" fechada não entra: o que ela guarda saiu do trabalho, e um cartão vivo
  de lá já é desenhado solto no fim. As linhas cortadas pelo limite ("+N linhas") também não (decisão 31
  e lote 22).

No painel: recolher a tarefa, o pedido ou o cartão não muda nenhum chip nem a cor da faixa.

Custo: as linhas de uma subárvore recolhida passam a ser calculadas (e jogadas fora). O cartão de sessão
recolhido já calculava o painel dele duas vezes (`:1294-1296`); o implementador aproveita para calcular
uma vez só.

## 4. Impacto

`npm run impacto -- task-tree/draw/layout.ts task-tree/hooks/render.tsx`: todos os cenários (núcleo).
Golden pelo mapa: os quatro; nenhum tem linha recolhida, e o campo novo só existe na linha recolhida: o
desenho não muda.

## 5. Testes

Novos, em `tests/cabecalho.test.ts` (o kit recolhe com `montar` e `recolher`; os chips por
`cabecalho(...)`; a pílula de subagentes pelo texto do cabeçalho, "▸ N", como em
`tests/subagentes.test.ts:132`; o estado geral por `estadoGeral(await noApp($))`):

1. "recolher a tarefa de origem ou o pedido não tira a sessão ativa, a carta na fila nem os subagentes
   dos chips". Cenário novo `cabecalho.recolher-nao-muda-chips-nem-faixa` e
   `cabecalho.numeros-somam-o-desenhado`. Roteiro: host com uma filha trabalhando (id `local_<uuid>`) e
   `local_x`; `lancaveis` com dois ids; `responderEnvio`; pedido; plan com "Um", "Dois" e "Três"; start em
   "Um" e `abrirSessao`; start em "Dois" e `envio` a `local_x` (fila); start em "Três" e dois `lancar`;
   `aviso`. Guarda os chips (`ativas` 1, `sessao` 1) e "▸ 2". Recolhe "Um", depois "Dois", depois "Três",
   depois a linha do pedido, relendo a cada vez. Afirma: os mesmos chips e a mesma pílula em todas as
   leituras; o "d de n" igual. Falha hoje na primeira recolhida ("ativas" vai a 0).
2. "recolher o cartão da filha que espera, a tarefa de origem ou o pedido não tira o 'aguardando' nem
   muda a faixa". Mesmos cenários. Roteiro: filha aberta sob "Um"; depois `aguardando = true`; `aviso`.
   Guarda `chips.aguardando` e o estado geral ("aguardando"). Recolhe a tarefa "Um"; depois o pedido.
   Afirma: o chip e o estado geral iguais. Falha hoje ao recolher "Um".
3. "recolher a tarefa com a pergunta aberta não tira o 'aguardando'". Mesmos cenários. Roteiro:
   `responderDepois(on, relogio, 'AskUserQuestion', …)`; pedido; plan; start; a pergunta aberta
   (`ferramenta` sem esperar, `relogio.settle()`); guarda `chips.aguardando` (1); recolhe a tarefa.
   Afirma 1. Depois `relogio.advance` e espera a resposta. Falha hoje (0).

Testes existentes: nenhum muda (`tests/cabecalho.test.ts:13-33`, o da regra, só lê os números).

## 6. Catálogo e selos

`regras/cabecalho.md`:

- Cenário novo `### cabecalho.recolher-nao-muda-chips-nem-faixa`
  - Título: "Recolher uma linha não muda os chips nem a faixa do cabeçalho."
  - Dado um aviso de espera, uma carta na fila, uma sessão filha viva ou subagentes vivos embaixo de uma
    tarefa, de um pedido ou dentro de um cartão
  - Quando a pessoa recolhe essa linha
  - Então os chips "aguardando", "aguardando sessão", "sessões ativas" e "subagentes" e a cor da faixa
    ficam como estavam: a linha recolhida conta o que esconde
  - `Origem: auditoria 2026-11-10 (os chips e a faixa eram contados por linha desenhada); aplica
    cabecalho.numeros-somam-o-desenhado (decisão do usuário, 2026-10-23: "as colapsada, mas que estao
    nessa visao, tambem entram") aos chips e à faixa, sem mudar a regra.`
  - `Código: hooks/render.tsx`
  - `Estado: coberto`
- `cabecalho.numeros-somam-o-desenhado`: no Então, acrescentar ", nos números, nos chips e na faixa
  (cabecalho.recolher-nao-muda-chips-nem-faixa)". Linha nova: `Reescrito: 2026-11-14, texto: a regra vale
  também para os chips e a faixa (auditoria 2026-11-10); o teste deste cenário não muda.`

Selos (`novo`) para os três testes, com os nomes finais e o motivo "a linha recolhida leva os chips e a
faixa". Forma:

    npm run regras:selar -- "task-tree/tests/cabecalho.test.ts::recolher a tarefa de origem ou o pedido não tira a sessão ativa, a carta na fila nem os subagentes dos chips" --tipo novo --motivo "a linha recolhida leva os chips e a faixa"

## 7. Documentação

`DESENVOLVIMENTO.md`: em "Desenho", onde se lê que o cabeçalho soma os `nodes` das linhas desenhadas
(procurar `count` dos `nodes`), acrescentar o campo novo e que os chips também saem dele. `CLAUDE.md`:
nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Com uma filha real pedindo permissão: recolher o cartão, a tarefa e o pedido; o chip "aguardando" e a
faixa âmbar claro ficam. Clicar de novo abre sem piscar.

## 10. Dependências e conflitos

- Depois do lote 11 (cada carta uma vez). Antes dos lotes 13 (aviso de espera no cartão de grupo, que
  conta pelo mesmo campo), 14 (tarefas do subagente nas linhas recolhidas), 15 e 16 (o que conta como
  "em andamento").
- Triagem A, decisões 11 ("Vira linha resumida", filha arquivada antiga) e 12 ("Substituída, cinza",
  rodada largada): criam ou mudam linhas de cartão em `session`; ao recolher, devem preencher o campo
  novo pelo mesmo caminho. Conflito de merge provável em `session` e em `rows`.
- Triagem C, decisão 43 ("Ampliar o golden"): um cenário de golden com linha recolhida passaria a ter o
  campo na árvore só se o desenho o usasse; ele não é desenhado, então não aparece.

## 11. Bloqueio

Nenhum.
