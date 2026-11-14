# Lote 04: status "Tarefas d/n" igual à sessão inteira

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

## 1. O que cobre

Correção direta: "Status 'Tarefas d/n' sob a caixa de mensagem diverge do cabeçalho e do total da
sessão". Nenhuma decisão do usuário.

## 2. Causa confirmada na ponta

- `hooks/panel.ts:342-353` (`showStatus`): soma `total({ groups: stayed(groups, queuedFrom), waits: [],
  children })`, sem repartir as filhas em cartões de rodada e sem marcar a filha "encerrada".
- `hooks/render.tsx:218-224`: a "sessão inteira" do cabeçalho faz as duas coisas: passa a `total` um
  repartidor (`split` de cada filha, e `settle` de cada cartão contra as tarefas da sessão e os envios).
- `draw/layout.ts:497-508` (`total`): a rodada descartada só é pulada, e as pendentes da filha encerrada
  só saem (`inCount`), quando o repartidor é passado.
- Efeito: filha parada só com pendentes e tarefa de origem fechada (cartão "encerrada"): o cabeçalho
  mostra "4 de 4, 100%" e o status fica em "Tarefas 4/5" para sempre. O mesmo com uma rodada antiga
  abandonada com tarefa aberta. Contra `sessoes.filha-parada-com-origem-fechada-sai-da-contagem` ("saem
  da contagem") e `sessoes.rodada-descartada-fora-da-contagem`. Escrito no código.

## 3. O que muda

- `draw/layout.ts`: uma função exportada nova, a conta da sessão inteira, que recebe os grupos, as
  filhas, os envios e o id próprio e devolve feitas, total e interrompidas: o que `hooks/render.tsx`
  faz hoje nas linhas 218-224 (as tarefas paradas com Esc lidas por `stayed`, cada filha repartida por
  `split` com as tarefas da sessão como dono, cada cartão passado por `settle`, e `total` com esse
  repartidor).
- `hooks/render.tsx`: usa a função no lugar do trecho de hoje. O resultado (`ad`, `an`) é o mesmo.
- `hooks/panel.ts`, `showStatus`: usa a mesma função (os envios do state, que ela já lê, e `knownId()`).
  O texto continua "Tarefas d/n", apagado quando d é igual a n, e só é enviado ao app quando muda
  (`lastStatus`).
- Comportamento novo no painel: o status embaixo da caixa de mensagem mostra sempre o mesmo par da
  "sessão inteira" do cabeçalho; com a filha "encerrada" ou com uma rodada descartada, ele deixa de
  contar o que o cabeçalho já não conta (no exemplo, some, porque fica 4 de 4).

## 4. Impacto

`npm run impacto -- task-tree/hooks/panel.ts task-tree/hooks/render.tsx task-tree/draw/layout.ts`:
todos os cenários (`hooks/render.tsx` é do núcleo). Golden pelo mapa: os quatro cenários; o desenho não
muda (o status não é desenhado no painel, e o total do cabeçalho sai igual).

## 5. Testes

O kit não lê o status: `fixar` ocupa o `ui.status` com um stub que descarta o texto, e um segundo `on`
do mesmo evento não entra (ver o comentário de `tests/lembretes.test.ts:171`). Mudança no kit:

- `tests/kit/ambiente.ts`, `fixar`: o stub de `ui.status` guarda o último texto, e `fixar` devolve
  também `status()` (o último texto enviado, `undefined` quando apagado ou nunca enviado). Nada mais
  muda no kit. É arquivo do kit: selo próprio (seção 6).

Novo, em `tests/sessoes.test.ts` (o ajudante `parada` do arquivo devolve o que `fixar` devolve):

1. "filha encerrada: o status sob a caixa de mensagem conta como a sessão inteira". Cenários novo
   `cabecalho.status-igual-a-sessao-inteira` e `sessoes.filha-parada-com-origem-fechada-sai-da-contagem`.
   Roteiro: `const { status } = await parada($, on)`; `painel`. Afirma: o cabeçalho 4 de 4 (como o
   teste vizinho) e `status()` indefinido (apagado, porque 4 de 4). Falha hoje: "Tarefas 4/5".
2. "com a origem aberta, o status conta as pendentes da filha". Mesmos cenários. Roteiro: `parada($, on,
   'aberta', false)`. Afirma: `status()` igual a "Tarefas d/n" com o mesmo d e n de `cabecalho(p)`
   (nada escondido nesse painel, então o desenhado é a sessão inteira). Passa hoje (fixa o lado que não
   muda).

Testes existentes: nenhum muda.

## 6. Catálogo e selos

`regras/cabecalho.md`, cenário novo:

- `### cabecalho.status-igual-a-sessao-inteira`
- Título: "O status 'Tarefas d/n' embaixo da caixa de mensagem conta o mesmo que a sessão inteira do
  cabeçalho."
- Dado tarefas desta sessão e das filhas, com uma filha "encerrada" ou uma rodada descartada
- Quando o status é escrito
- Então ele diz "Tarefas d/n" com as feitas e o total da sessão inteira, os mesmos do cabeçalho: sem as
  pendentes da filha encerrada, sem a rodada descartada e sem as interrompidas; com tudo feito, some
- `Origem: auditoria 2026-11-10 (o status somava sem repartir as rodadas nem tirar a filha encerrada);
  aplica sessoes.filha-parada-com-origem-fechada-sai-da-contagem e
  sessoes.rodada-descartada-fora-da-contagem, sem mudar nenhuma regra.`
- `Código: hooks/panel.ts`
- `Estado: coberto`

`regras/visual.md`, `visual.status-embaixo-da-caixa`: no Então, acrescentar ", com o número da sessão
inteira (cabecalho.status-igual-a-sessao-inteira)"; linha nova `Reescrito: 2026-11-14, texto: o número é
o da sessão inteira; a regra do que o app mostra não muda.` O estado segue `checklist`.

Selos:

    node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo refatoracao --motivo "fixar guarda o último texto do status e o devolve; nada do que os testes afirmam muda"
    npm run regras:selar -- "task-tree/tests/sessoes.test.ts::filha encerrada: o status sob a caixa de mensagem conta como a sessão inteira" --tipo novo --motivo "o status usa a conta da sessão inteira"
    npm run regras:selar -- "task-tree/tests/sessoes.test.ts::com a origem aberta, o status conta as pendentes da filha" --tipo novo --motivo "o status usa a conta da sessão inteira"

Se o selo do kit recusar `refatoracao` (o hash de `ambiente.ts` muda e os testes que usam `fixar` têm
as declarações de topo no hash), seguir a mensagem do script; nenhuma asserção diminui.

## 7. Documentação

`DESENVOLVIMENTO.md`: o parágrafo "Contador" (procurar `Contador: \`total\``) e a frase de `showStatus`
em "Fluxo de dados" (procurar `Tarefas d/n`): dizer que o status e a sessão inteira do cabeçalho saem da
mesma função. `CLAUDE.md`: nada (o item "status embaixo da caixa de mensagem" do checklist do app fica).

## 8. Golden

Não muda.

## 9. Checklist do app

Com uma filha real parada só com pendentes e a tarefa de origem fechada: o status embaixo da caixa de
mensagem some (ou mostra o mesmo par do cabeçalho), em vez de ficar com as pendentes dela.

## 10. Dependências e conflitos

- Nenhum lote antes. O lote 06 (total da sessão inteira na linha "+N pedidos anteriores") usa a função
  criada aqui.
- Lote 14 (tarefas do subagente contam): `total` já soma as tarefas de todos os grupos, as dos
  subagentes também; nada a adaptar.
- Triagem A, decisão 15 ("Rodada fora da conta (Recomendado)", filha parada com Esc) e decisão 3 ("✕ fora
  do x/y (Recomendado)"): mexem em `discarded` e em `total`; a função nova só os chama, então herda o
  que A mudar.
- Triagem C, decisão 35 ("Enxugar e esvaziar", arquivos publicados): não toca o status.

## 11. Bloqueio

Nenhum.
