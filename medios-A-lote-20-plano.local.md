# Lote 20: turnos digitados na filha, um cartão só

Planejado em 2026-11-14 sobre `6d5e026`, só lendo. Caminhos relativos a `task-tree/`, salvo `regras/`.
Um commit (uma decisão do usuário, que muda a de 2026-11-03).

## 1. O que cobre

- Achado "Cada turno aberto direto na filha vira um cartão separado e nunca é fundido; e "digitado pelo
  usuário" é qualquer prompt que não seja mensagem de sessão". A segunda metade (decidir "digitado" pela
  origem do prompt) é não confirmada e fica fora.
- Decisão 18, 2026-11-14: **"Um cartão só (Recomendado)"** (muda a decisão de 2026-11-03). A opção: "Um
  cartão só naquele ponto, com uma linha de pedido por turno: os turnos digitados entram no cartão que a
  sessão já tem ali; cartão novo só quando o pedido vigente da mãe é outro."

## 2. Causa confirmada na ponta atual

Escrito no código, `draw/layout.ts`, `split`:
- `layout.ts:404-407`: cada turno digitado na filha (`own`, fora o de abertura) recebe uma parte própria,
  de chave `-1 - índice`;
- `layout.ts:468`: o cartão de cada parte digitada pende de `inForce(turno)`: a última tarefa de nível 1
  do pedido da mãe vigente quando a pessoa digitou (`layout.ts:383-388`);
- `layout.ts:1261`: todos com o mesmo título, "<nome> · pedido do usuário na filha"; o texto digitado vai
  só no texto alternativo (`layout.ts:1263`, `ownTurn`).
- Num cartão, o pedido só ganha linha própria quando tem mais de uma tarefa de nível 1 ou veio por
  mensagem (`layout.ts:1466-1469`).

Decisão registrada que esta muda: `sessoes.turno-proprio-da-filha-no-pedido-vigente` (2026-11-03, "No
pedido vigente da orquestradora (Recomendado)"), que desenha um cartão por turno. O lugar do cartão (o
pedido vigente da mãe) não muda.

## 3. O que muda

Só `draw/layout.ts` (`split`, `session` e `body`).

- `split`: os turnos digitados que pendem do mesmo ponto (o mesmo pedido da mãe vigente: o mesmo
  resultado de `inForce`) formam **uma parte só**. A chave da parte é a do primeiro turno do grupo (a
  conta de hoje, `-1 - índice`, com o índice do primeiro), e `partAt` é a hora desse primeiro turno:
  assim a dobra e a chave do cartão de quem tinha um turno só não mudam. Turnos digitados sob pedidos
  vigentes diferentes seguem em cartões diferentes.
- Para a escolha da rodada da frente (lote 16), a parte dos turnos digitados conta pelo turno mais
  recente dela (senão, um turno novo digitado num cartão antigo perderia para uma rodada da mãe no meio).
- Título do cartão: o de hoje, "<nome> · pedido do usuário na filha". O texto alternativo: o texto do
  turno, quando é um só (como hoje); com vários, "Pedidos do usuário na filha: N".
- Dentro do cartão, com **dois ou mais** turnos digitados: cada turno ganha a sua linha de pedido (o
  título do turno, que é o começo do texto digitado) com as tarefas dele embaixo, na ordem dos turnos,
  mesmo quando o turno tem uma tarefa só. Com **um** turno só: como hoje, sem linha de pedido (as tarefas
  direto no cartão).
- A contagem, o tempo e as respostas ↩ do cartão somam os turnos dele, como em qualquer cartão.

Deduções do planejador (a decisão não detalha; escolhidas pelo menor desvio do que já foi validado):
- "o cartão que a sessão já tem ali" foi lido como o cartão de turnos digitados naquele ponto. Um turno
  digitado **não** entra no cartão de uma rodada aberta por mensagem da mãe, mesmo no mesmo pedido: os
  dois seguem cartões distintos (o da mensagem, sob a tarefa que a enviou; o digitado, no fim do
  pedido).
- Com um turno só, o cartão não ganha linha de pedido: os três testes selados da regra seguem valendo
  sem mudança.

Comportamento novo no painel: a pessoa digita duas vezes direto na filha, com o mesmo pedido da mãe em
curso: um cartão "<nome> · pedido do usuário na filha", com duas linhas de pedido, cada uma com as suas
tarefas. Se a mãe abriu outro pedido entre os dois, são dois cartões, um em cada pedido.

## 4. Impacto

`npm run impacto -- draw/layout.ts`: 110 cenários; os 4 do golden pelo mapa; ver 8.

## 5. Testes a escrever

`tests/sessoes.test.ts`, regra `sessoes.turno-proprio-da-filha-no-pedido-vigente` (reescrita):
1. **"dois turnos digitados na filha com o mesmo pedido da mãe em curso ficam num cartão só, com uma linha
   de pedido por turno"**. Roteiro: `const { h, relogio } = await abrirNoPedidoAntigo($, on)`;
   `relogio.advance(1000)`; `pedido($, 'Pedido atual')`; `plan` de "V" "Limpeza" com "v1"; `start(['v1'])`;
   `relogio.advance(1000)`; a filha passa a publicar o turno 1 (como está), o turno 2 digitado
   (`own: true`, `at: AGORA + 1500`, título "primeiro pedido") com "A2" concluída, e o turno 3 digitado
   (`at: AGORA + 1800`, título "segundo pedido") com "A3" iniciada; `aviso`.
   Afirma: `cartoes(p, PROPRIO)` tem um cartão só, sob "Limpeza", com as tarefas `['primeiro pedido',
   'A2', 'segundo pedido', 'A3']`; `cabecalho(p).chips.ativas` 1.
   Falha hoje: são dois cartões com o mesmo título.
2. **"turnos digitados com pedidos diferentes da mãe em curso ficam em cartões diferentes"**. Roteiro: o
   primeiro turno digitado com `at` antes do "Pedido atual" (pende de "Reescrita") e o segundo depois
   (pende de "Limpeza"). Afirma: `cartoes(p, PROPRIO).map(c => c.sob)` igual a `['Reescrita',
   'Limpeza']`.
   Passa hoje: protege "cartão novo só quando o pedido vigente da mãe é outro". (O pedido antigo precisa
   seguir à vista: usar `comHistorico` ou deixar uma tarefa dele aberta.)

Testes existentes da regra (`sessoes.test.ts:424`, `:443`, `:780`): um turno digitado só; não mudam.

## 6. Catálogo e selos

`regras/sessoes.md`, `sessoes.turno-proprio-da-filha-no-pedido-vigente`: o título e o "Então" passam a:
- Título: "Os turnos que o usuário abriu digitando na filha ficam num cartão só, no pedido da mãe vigente
  quando ele digitou."
- "Então": "o cartão fica no fim do pedido da mãe vigente quando ele digitou (o último pedido da mãe
  planejado antes; sem nenhum, o de origem), com "pedido do usuário na filha" no título; os turnos
  digitados com o mesmo pedido da mãe em curso entram no mesmo cartão, cada um com a sua linha de pedido
  e as suas tarefas embaixo (com um turno só, as tarefas direto no cartão e o texto digitado no texto
  alternativo do ícone); cartão novo só quando o pedido vigente da mãe é outro; enquanto a filha
  trabalha nele, o pedido onde ele está segue desenhado".
- Antes do `Estado:`: `Reescrito: 2026-11-14, decisão do usuário ("Um cartão só (Recomendado)"); desfaz
  "um cartão por turno" da decisão de 2026-11-03. Os testes existentes não mudam.`

`sessoes.cartao-sob-a-tarefa-de-origem` cita essa regra no "Então": sem mudança de texto.

Selos: `--tipo novo` para os dois testes novos, com o motivo `decisão do usuário, 2026-11-14: "Um cartão
só (Recomendado)"`.

## 7. Documentação

`DESENVOLVIMENTO.md`: o trecho de `split` sobre os turnos próprios (as chaves negativas, uma por turno),
com o grupo por pedido vigente; entrada em "Decisões (histórico)".

## 8. Golden

Não muda (nenhum cenário do golden tem turno digitado na filha).

## 9. Checklist do app

- Digitar duas vezes direto numa filha real: na mãe, um cartão só, com as duas linhas de pedido; o
  cartão que estava recolhido segue recolhido depois do segundo turno.

## 10. Dependências e conflitos

- Depois dos lotes 16 (rodada da frente pelo tempo), 17 e 19 (todos em `split` e `session`).
- Lote 08: o turno sem tarefa e com resumo vai ao cartão da parte dele; para um turno digitado sem
  tarefa, é o cartão dos turnos digitados daquele ponto, se existir.
- Triagem B: "a mesma carta aparece em todos os cartões de rodada" (`split`). Triagem C: nada aqui.

## 11. Bloqueio

Nenhum. Fica para a orquestradora a leitura escolhida de "o cartão que a sessão já tem ali" (seção 3): se
o usuário quis dizer que o turno digitado entra também no cartão de uma rodada da mãe no mesmo pedido,
é outra mudança (título do cartão e tarefa de onde ele pende), não coberta aqui.
