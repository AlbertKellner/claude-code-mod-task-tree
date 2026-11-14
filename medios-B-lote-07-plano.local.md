# Lote 07: uma noção só de "nada em execução na tarefa"

Planejador B, 2026-11-14, sobre `6d5e026`. Caminhos do mod relativos a `task-tree/`. Um commit.

## 1. O que cobre

Duas correções diretas da mesma causa, nenhuma decisão nova:

- "Os dois fechamentos automáticos de tarefa (entrega da carta e fim dos subagentes) usam condições
  diferentes e incompletas" (a parte que é bug).
- "'Nada mais em execução nela' é medido diferente no fechamento automático e no desenho".

Não reabrir: a entrega da fila conclui a tarefa mesmo com o turno desta sessão em curso (2026-10-30,
"Sim, conclusão automática como hoje").

## 2. Causa confirmada na ponta

- Entrega de carta a sessão: `hooks/sessions.ts:185-195` (fim de `watchSends`). Fecha a tarefa do envio
  quando ela está aberta e sem subtarefa aberta. Não olha subagente vivo da tarefa, outra carta dela
  ainda na fila, nem pergunta aberta nela.
- Entrega de carta a subagente (PR 38): `hooks/agents.ts:331-343` (`takeSubSend`). Tem condição própria:
  não fecha se um subagente da sessão lançado da tarefa ainda roda. Não olha outra carta na fila nem
  pergunta aberta.
- Fim dos subagentes: `hooks/agents.ts:274-278` (`busy`, em `settleBySubs`). Sessão viva é só a aberta
  naquela tarefa (`c.anchor === id`) e só rodando ou abrindo; a espera é casada só pelo id da tarefa
  (`w.anchor === id`), sem o dono.
- O desenho: uma sessão está "na tarefa" pela rodada atual dela (`roundAt`, `draw/layout.ts:535`) e está
  viva também quando espera a pessoa (`live`, `:145`).

Efeitos, todos lidos no código:

1. Tarefa com subagente rodando e carta na fila: a sessão destino toma a carta e a tarefa fecha ✓ com o
   subagente ainda trabalhando; se ele falhar depois, ela já está ✓. Contra
   `subagentes.um-rodando-mantem-o-pai`.
2. Duas cartas na fila da mesma tarefa, para sessões diferentes: a primeira entrega fecha a tarefa com a
   outra ainda azul. Contra `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila`.
3. No fim do turno, a tarefa fecha ✓ pelos subagentes com uma sessão trabalhando na rodada dela ali
   (mensagem mandada dessa tarefa a uma sessão aberta em outra), ou com a sessão aberta ali esperando a
   pessoa. Contra o "Dado" de `subagentes.pai-conclui-no-fim-do-turno` ("nenhuma sessão filha viva").
4. A pergunta aberta de um subagente, numa tarefa dele com o mesmo id de uma folha da sessão, segura a
   folha da sessão.

## 3. O que muda

Uma função pura nova, exportada de `draw/layout.ts` (ali estão `live`, `roundAt` e `subLive`): "o que
ainda está em execução na tarefa `id` do dono `owner`". Recebe os grupos, as filhas, os envios e as
esperas. Responde sim quando há:

- (a) um subagente vivo lançado dessa tarefa por esse dono;
- (b) outra carta dessa tarefa ainda na fila (`!taken && !cut`), só para a sessão principal;
- (c) uma pergunta, um plano a aprovar ou uma escolha aberta desse mesmo dono nessa tarefa
  (`w.agent === owner && w.anchor === id`);
- (d) uma sessão filha viva ali, só para a sessão principal: não arquivada, e trabalhando, abrindo ou
  esperando a pessoa, aberta nessa tarefa (`anchor`) ou com a rodada atual nela (`lastAnchor`).

Uso:

- `hooks/agents.ts`, `settleBySubs`: `busy` passa a ser a função, com os quatro termos. Corrige os
  efeitos 3 e 4.
- `hooks/sessions.ts`, `watchSends`: a entrega só conclui a tarefa quando (a), (b) e (c) não valem,
  conferido depois de marcar as cartas tomadas nesta passada (a carta que acabou de ser entregue não
  conta como "outra na fila"; duas entregues juntas, nenhuma conta). O termo (d) não entra na entrega:
  a sessão que acabou de tomar a carta está, por definição, viva na rodada dessa tarefa, e a decisão de
  2026-10-30 manda concluir a tarefa na entrega; o desenho já mantém a linha ◉ enquanto a sessão
  trabalha (`sessoes.filha-trabalhando-mantem-pais-em-andamento`). A função recebe essa diferença como
  argumento (com ou sem as sessões); é a única entre os dois fechamentos, e fica escrita no comentário.
- `hooks/agents.ts`, `takeSubSend`: a mesma chamada da entrega (sem as sessões), no lugar da condição
  própria. Ganha (b) e (c).
- Quando a entrega não conclui, quem conclui depois: o fim do último subagente (`settleBySubs`, pelo
  `subEnd` com o turno terminado ou no fim do turno); a entrega da outra carta (`watchSends`); com
  pergunta aberta, o `done` do modelo depois da resposta. Nenhum gatilho novo.

No painel:

- carta entregue com subagente da tarefa rodando: carta verde, tarefa segue ◉ (ou ◷ com o turno
  terminado), cartão "trabalhando"; quando ele termina, a tarefa reflete o fim dele (✓, ou ✕ "falhou");
- duas cartas da mesma tarefa: na primeira entrega, uma verde e uma azul, tarefa aberta; na segunda, as
  duas verdes e a tarefa ✓;
- fim do turno com os subagentes da tarefa terminados e uma sessão viva nela (aberta ali ou na rodada
  atual, inclusive esperando a pessoa): a tarefa não fecha; o x/y não a conta como feita.

O lembrete do lote 01 (`SESSION.takenOpen`) já cobre "aberta … com algo ainda em execução nela".

## 4. Impacto

`npm run impacto -- task-tree/hooks/sessions.ts task-tree/hooks/agents.ts task-tree/draw/layout.ts`: a
soma de `draw/layout.ts` (110 cenários) com os de sessões, envios e subagentes já contidos nela.
Checklist: `envios.destino-arquivado-no-app`, `envios.subagente-no-app`, os quatro de subagentes no app.
Golden pelo mapa: os quatro cenários; o desenho não muda (no `envios`, cada carta sai de uma tarefa
diferente e não há subagente; no `subagente`, nenhuma carta).

## 5. Testes

Novos:

1. `tests/envios.test.ts`: "com um subagente da tarefa ainda rodando, a entrega da carta não conclui a
   tarefa; o fim dele, sim". Cenários novo `envios.entrega-espera-o-que-ainda-roda-na-tarefa` e
   `subagentes.um-rodando-mantem-o-pai`. Roteiro: `lancaveis(['sub-1'])`; host com `{ id: 'local_x',
   rodando: false }` (a sessão destino parada, para ela não segurar a tarefa pelo termo (d) depois);
   `responderEnvio`; pedido; plan com "Um"; start; `lancar` em segundo plano; `envio` (fila); fim do
   turno; `h.recebeu`; `aviso`. Afirma: carta sob "Um" entregue; "Um" não concluída; `cabecalho.feitas`
   0. Depois `fimDoSubagente('sub-1')` e `fimDoTurno` (o aviso abriu um turno, e o fechamento pelos
   subagentes só roda com o turno terminado): "Um" concluída. Falha hoje: "Um" fica concluída na entrega.
2. `tests/envios.test.ts`: "duas cartas na fila da mesma tarefa: a primeira entrega não a conclui; a
   segunda, sim". Cenários `envios.entrega-espera-o-que-ainda-roda-na-tarefa` e
   `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila`. Roteiro: host com `local_x` e
   `local_y`; pedido; plan com "Um"; start; dois envios (as duas cartas sob "Um"); `h.recebeu('local_x',
   AGORA)`; `aviso`. Afirma: as cartas, na ordem, entregue e fila; "Um" não concluída. Depois
   `h.recebeu('local_y', AGORA)` e `aviso`: as duas entregues e "Um" concluída. Falha hoje: "Um"
   concluída na primeira entrega.
3. `tests/subagentes.test.ts`: "com a sessão aberta na tarefa esperando a pessoa, o subagente concluído
   não a fecha no fim do turno". Cenário `subagentes.pai-conclui-no-fim-do-turno`. Roteiro: host com uma
   filha (id `local_<uuid>`); pedido; plan com "Investigar"; start; `abrirSessao`; `aviso`; a filha passa
   a `rodando = false` e `aguardando = true`; `aviso`; `lancar`; `fimDoSubagente`; fim do turno. Afirma:
   "Investigar" não concluída e `cabecalho.feitas` 0. Falha hoje: a sessão que espera a pessoa não conta
   e a tarefa fecha ✓.
4. `tests/subagentes.test.ts`: "com a sessão trabalhando na rodada dela nessa tarefa, o subagente
   concluído não a fecha no fim do turno". Mesmo cenário. Roteiro: `responderEnvio` em modo `entregue`;
   plan com "Um" e "Dois"; start em "Um"; `abrirSessao`; `aviso`; `done` em "Um"; start em "Dois";
   `envio` à filha (entrega imediata: a rodada atual dela passa a "Dois"); `lancar`; `fimDoSubagente`;
   fim do turno. Afirma: "Dois" não concluída. Falha hoje: só a sessão aberta ali conta, e "Dois" fecha.
5. `tests/subagentes.test.ts`: "a pergunta aberta de um subagente, numa tarefa dele de mesmo id, não
   segura a tarefa da sessão". Mesmo cenário. Roteiro: `lancaveis(['sub-1', 'sub-2'])`;
   `responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')`; pedido; plan da sessão com nível 1 "A" e
   a folha "1"; start; `lancar` duas vezes; o `sub-2` planeja um nível 1 "A" com a folha "1" (mesmo id
   completo, "A/1"), dá start nela e abre uma pergunta (`chamadaDoSubagente` com `AskUserQuestion`, sem
   esperar a resposta: `relogio.settle()`); `fimDoSubagente('sub-1')`... O `sub-2` segue vivo e seguraria
   a tarefa pelo termo (a): para isolar o termo (c), o `sub-2` tem de ser lançado de outra tarefa da
   sessão (plan com duas folhas, "1" e "2"; `sub-1` de "1", `sub-2` de "2", e a tarefa do `sub-2` com o
   id "A/1"). Afirma: no fim do turno, a folha "1" da sessão fica concluída. Falha hoje: a espera do
   `sub-2`, com `anchor` "A/1", segura a folha "A/1" da sessão. Se o roteiro não couber nos 5 s ou no
   kit, o implementador relata e deixa este caso só no cenário (o resto do lote não depende dele).

Testes existentes: nenhum muda. Conferidos na leitura: "com uma carta na fila na mesma tarefa, o
subagente concluído não a fecha" (`tests/subagentes.test.ts:241`), "a carta de envio é uma linha sob a
tarefa; a tarefa conta e o painel a conclui na entrega" (`tests/envios.test.ts:288`) e "o subagente
recebe a mensagem na rodada seguinte…" (`:652`) seguem valendo: a sessão destino viva não segura a
entrega, e a condição de `takeSubSend` só ganha termos.

## 6. Catálogo e selos

`regras/envios.md`, cenário novo:

- `### envios.entrega-espera-o-que-ainda-roda-na-tarefa`
- Título: "A entrega só conclui a tarefa quando nada mais está em execução nela."
- Dado uma tarefa com a carta dela na fila e, ainda, um subagente lançado dela rodando, outra carta dela
  na fila ou uma pergunta aberta nela
- Quando a sessão (ou o subagente) destino toma a carta
- Então a carta fica verde e a tarefa segue aberta; ela fecha quando o último termina: pelo fim do
  subagente (refletindo o fim dele), pela entrega da outra carta, ou pelo done do modelo depois da
  resposta; a sessão que tomou a carta e segue trabalhando não segura a conclusão (o desenho mantém a
  linha ◉ enquanto ela trabalha)
- `Origem: auditoria 2026-11-10 (os dois fechamentos automáticos usavam condições diferentes); aplica
  subagentes.um-rodando-mantem-o-pai ("até o último terminar (e a carta ser entregue)") e
  envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila, sem mudar a decisão de 2026-10-30 ("Sim,
  conclusão automática como hoje").`
- `Código: hooks/agents.ts, draw/layout.ts`
- `Estado: coberto`

Textos completados, cada um com `Reescrito: 2026-11-14, texto: … (auditoria 2026-11-10); nenhuma regra
muda e os testes existentes não mudam.`:

- `envios.fica-ate-entrega`: depois de "o painel conclui a tarefa que enviou", acrescentar ", quando nada
  mais está em execução nela (envios.entrega-espera-o-que-ainda-roda-na-tarefa)".
- `subagentes.pai-conclui-no-fim-do-turno`: o parêntese do Dado vira "(nenhum subagente rodando, nenhuma
  sessão filha viva nela, aberta ali ou com a rodada atual ali, trabalhando, abrindo ou esperando a
  pessoa, nenhuma carta na fila, nenhuma pergunta aberta do mesmo dono)".
- `subagentes.um-rodando-mantem-o-pai`: no Então, acrescentar "; a entrega de uma carta dela também não
  a fecha enquanto um subagente dela roda".

Selos (`novo`), com os nomes finais:

    npm run regras:selar -- "task-tree/tests/envios.test.ts::com um subagente da tarefa ainda rodando, a entrega da carta não conclui a tarefa; o fim dele, sim" --tipo novo --motivo "uma noção só de nada em execução na tarefa"
    npm run regras:selar -- "task-tree/tests/envios.test.ts::duas cartas na fila da mesma tarefa: a primeira entrega não a conclui; a segunda, sim" --tipo novo --motivo "uma noção só de nada em execução na tarefa"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::com a sessão aberta na tarefa esperando a pessoa, o subagente concluído não a fecha no fim do turno" --tipo novo --motivo "uma noção só de nada em execução na tarefa"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::com a sessão trabalhando na rodada dela nessa tarefa, o subagente concluído não a fecha no fim do turno" --tipo novo --motivo "uma noção só de nada em execução na tarefa"
    npm run regras:selar -- "task-tree/tests/subagentes.test.ts::a pergunta aberta de um subagente, numa tarefa dele de mesmo id, não segura a tarefa da sessão" --tipo novo --motivo "uma noção só de nada em execução na tarefa"

## 7. Documentação

`DESENVOLVIMENTO.md`: em "Fluxo de dados" (onde `watchSends` e o fechamento pelos subagentes são
descritos; procurar `settleBySubs` e `watchSends`), um parágrafo com a função e a única diferença entre
os dois usos. `CLAUDE.md`: nada.

## 8. Golden

Não muda.

## 9. Checklist do app

Com um subagente real em segundo plano e uma mensagem na fila da mesma tarefa: na entrega a carta fica
verde e a tarefa só fecha quando o subagente termina.

## 10. Dependências e conflitos

- Depois do lote 01 (o lembrete da entrega). Antes dos lotes 08 e 09 (mesma função `settleBySubs`), do
  lote 15 (tarefa ◉ com subagente rodando, que lê a mesma noção para o desenho) e do lote 24 (subagente
  retomado).
- Triagem A, decisão 7 ("Segue ◉/◷ (Recomendado)", Esc com filha ou subagente vivo sob a tarefa) e
  decisão 14/17 (espera e tempo com filha embaixo): A precisa da mesma pergunta "há algo vivo sob a
  tarefa?". A função deste lote é o lugar: se o lote de A vier antes e criar a sua, este lote a adota e
  só acrescenta os termos que faltarem; se vier depois, A usa esta.
- Triagem C, decisão 39 ("Pendurar na pendente", pergunta com tarefa aberta mas nenhuma em andamento):
  muda a tarefa em que a espera fica (`w.anchor`); o termo (c) lê o que C gravar.
- Lote 10 (recibo no envio) mexe no começo de `watchSends`; este, no fim. Conflito de merge pequeno.

## 11. Bloqueio

Nenhum. Ponto de leitura, sem bloquear: a triagem pedia "uma só noção … usada nos dois fechamentos"; o
plano mantém uma diferença, a sessão viva não segura a entrega, porque senão nenhuma entrega concluiria
a tarefa (a sessão que toma a carta está viva nela) e a decisão de 2026-10-30 seria desfeita.
