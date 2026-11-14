# Lote 05: "+N pedidos anteriores" decidido por pedido

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

## 1. O que cobre

Correção direta: "'+N pedidos anteriores' conta também o pedido que segue desenhado em parte, e esse
pedido perde os níveis 1 fechados". Nenhuma decisão nova; aplica a decisão de 2026-10-23 ("somente limpe
os itens quando todos estiverem concluidos e quando iniciarem novas tarefas",
`pedidos.resumida-mantem-anteriores-com-algo-aberto`).

## 2. Causa confirmada na ponta

`draw/layout.ts:1426-1439` (dentro de `body`, na função `panel`):

- `recent` são os últimos pedidos (3 no painel, 3 no cartão); `over` diz que há mais que isso.
- `recentOnly` (`:1431`) filtra por tarefa de nível 1: fica a de um pedido recente, a que tem algo
  aberto (`hasOpen([t])`) ou a que tem sessão viva embaixo. Num pedido antigo com um nível 1 aberto e
  outro fechado, só o aberto fica.
- `out` (`:1437`) é tudo o que não ficou, e `left` (`:1438`) conta os pedidos distintos de `out`: o
  pedido que segue desenhado em parte entra na conta por causa do nível 1 fechado que saiu.
- A linha do pedido (`turnRows`, chamada em `:1474` com `drawn.filter(t => t.turn === u.id)`) soma só os
  níveis 1 que ficaram: o x/y do pedido antigo perde os fechados.

Escrito no código. Caso real da auditoria: 35 pedidos, 4 desenhados e "+32".

## 3. O que muda

`draw/layout.ts`, no mesmo trecho: a escolha passa a ser por pedido.

- Um pedido fica desenhado quando é um dos recentes, ou quando algum nível 1 dele tem algo aberto ou
  sessão viva embaixo (as mesmas duas condições de hoje, aplicadas ao pedido).
- Desenhado, o pedido vem inteiro: todos os níveis 1 dele que estão na lista, os fechados também.
- A tarefa de nível 1 sem pedido (painéis de antes dos pedidos) segue a regra de hoje, por tarefa.
- `left` conta só os pedidos sem nenhum nível 1 desenhado. O resto (a linha do histórico, a chave
  `sec:turns`, os cartões soltos de um pedido cortado, o corte do trabalho) não muda.

No painel: com mais de três pedidos no trabalho, o pedido antigo que ainda tem algo aberto aparece com
os níveis 1 já concluídos dele, o x/y dele volta a contar todos, e ele não entra em "+N pedidos
anteriores". O "d de n" do cabeçalho passa a somar esses níveis 1 (estão desenhados). Vale igual dentro
do cartão de uma filha.

## 4. Impacto

`npm run impacto -- task-tree/draw/layout.ts`: 110 cenários. Checklist: `envios.destino-arquivado-no-app`,
os quatro de subagentes no app, `ultracode.cor-e-corte`. Golden pelo mapa: os quatro cenários; nenhum
tem mais de três pedidos, então o desenho não muda.

## 5. Testes

Novo, em `tests/pedidos.test.ts`:

1. "com mais de três pedidos, o pedido antigo com algo aberto fica inteiro e não entra em '+N pedidos
   anteriores'". Cenários `pedidos.resumida-mantem-anteriores-com-algo-aberto` e
   `cabecalho.limites-de-linhas`. Roteiro (ids de nível 1 diferentes em cada pedido, para não haver
   renomeação): pedido um com dois níveis 1, "Fechada" e "Aberta": start e done em "Fechada", "Aberta"
   fica pendente; fim do turno. Pedidos dois, três, quatro e cinco, cada um com um nível 1 iniciado e
   concluído e o fim do turno (o relógio avança entre eles). Como "Aberta" segue aberta, o trabalho
   mantém os cinco. Afirma: "Fechada" está no painel, concluída; "Aberta" pendente; a linha do pedido um
   mostra 1/2; existe exatamente uma linha "+1 pedidos anteriores" (o pedido dois) e nenhuma "+2".
   Falha hoje: "Fechada" some, a linha diz "+2 pedidos anteriores" e o pedido um mostra 0/1.

Testes existentes: nenhum deve mudar (`tests/cabecalho.test.ts:152-171`, "só os três últimos pedidos…",
tem todos os pedidos concluídos). Se a `regressao` acusar um teste que afirmava o pedido antigo
desenhado só com o nível 1 aberto, o implementador para e relata: não há decisão que proteja esse
desenho, mas o teste é selado.

## 6. Catálogo e selos

`regras/cabecalho.md`, `cabecalho.limites-de-linhas`: no Então, depois de "no máximo três pedidos sem
nada aberto ficam desenhados", acrescentar "; um pedido anterior com algo aberto fica desenhado inteiro,
com os níveis 1 já concluídos, e não entra na conta de '+N pedidos anteriores'". Linha nova: `Reescrito:
2026-11-14, texto: o pedido anterior com algo aberto é desenhado inteiro e não é contado em "+N"
(auditoria 2026-11-10); aplica a decisão de 2026-10-23 ("somente limpe os itens quando todos estiverem
concluidos e quando iniciarem novas tarefas"), sem mudar a regra. Os testes deste cenário não mudam.`

`regras/pedidos.md`, `pedidos.resumida-mantem-anteriores-com-algo-aberto`: no Então, depois de "o painel
mantém os dois", acrescentar "(o anterior inteiro, com o que já concluiu)". Mesma linha `Reescrito` de
texto, com a data 2026-11-14.

Selo:

    npm run regras:selar -- "task-tree/tests/pedidos.test.ts::com mais de três pedidos, o pedido antigo com algo aberto fica inteiro e não entra em '+N pedidos anteriores'" --tipo novo --motivo "o corte dos pedidos anteriores é por pedido, não por nível 1"

## 7. Documentação

`DESENVOLVIMENTO.md`: onde o limite de três pedidos é descrito (procurar `SHOWN_TURNS` e `pedidos
anteriores`), uma frase: a escolha é por pedido. `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Numa sessão longa real (mais de três pedidos, um antigo com tarefa aberta): o pedido antigo aparece com
as tarefas já concluídas dele e o número de "+N pedidos anteriores" bate com os pedidos escondidos.

## 10. Dependências e conflitos

- Nenhum lote antes. O lote 06 escreve na mesma linha "+N pedidos anteriores" (o título dela): vem
  depois deste.
- Lotes 21 e 22 (corte de linhas) dependem da linha do histórico como este lote a deixa (a chave
  `sec:turns` não muda).
- Triagem A, decisão 6 ("Pedido próprio (Recomendado)", ↩ de pedido sem tarefa) e decisão 11 ("Vira linha
  resumida", filha arquivada antiga): mexem na mesma função `body`; conflito de merge possível no trecho
  `:1426-1458`.
- Triagem C, decisão 44 ("Do primeiro start", base do tempo de pai e pedido): mexe em `turnRows`, não
  neste trecho.

## 11. Bloqueio

Nenhum.
