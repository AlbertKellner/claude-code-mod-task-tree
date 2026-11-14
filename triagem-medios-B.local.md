# Triagem dos achados médios: Envios (cartas), Subagentes e Desenho do painel e cabeçalho

Escrito pelo agente de triagem B em 2026-11-13. Só leitura do repositório
(`claude-code-mod-task-tree`, branch `fix/pendencias-auditoria`, ponta `1f9e8c1`). Os caminhos são
relativos a `task-tree/`, salvo indicação. Nada foi executado além de `git log` e
`npm run impacto -- hooks/sessions.ts hooks/agents.ts` (67 cenários afetados: todos os de envios, quase
todos os de sessões e de subagentes).

## Contagem

31 achados médios (11 de envios, 10 de subagentes, 10 de desenho).

| Classe | Envios | Subagentes | Desenho | Total |
|---|---|---|---|---|
| Resolvido ou obsoleto | 0 | 1 | 0 | 1 |
| Tratado à parte (já decidido e em planejamento) | 0 | 1 | 1 | 2 |
| Correção direta | 7 | 4 | 4 | 15 |
| Decisão do usuário | 3 | 4 | 5 | 12 |
| Não confirmado | 1 | 0 | 0 | 1 |

Observações:
- Nenhum achado médio do desenho ficou obsoleto com o painel nativo: todos falam de contagem, tempo,
  corte de linhas e estado geral, que vivem em `draw/layout.ts` e `hooks/render.tsx` e não mudaram. O que
  mudou foi o lugar de algumas evidências (`draw/svg.ts` e `draw/geometry.ts` viraram `draw/head.tsx`);
  está dito em cada item.
- Três achados têm duas metades de classes diferentes; contei pela metade principal e a outra está
  descrita no item (fechamentos automáticos, a carta cinza "interrompida" e o corte de linhas).
- As 12 decisões viram 14 perguntas (a da faixa do cabeçalho são duas; o corte de linhas soma uma).

---

# Envios (cartas)

## 1. Recarga do mod faz um recibo antigo fechar a segunda mensagem ainda na fila
**Classe: correção direta.** Tamanho: médio.

- De pé: `hooks/sessions.ts:109` (`usedReceipts` é variável do módulo; o próprio comentário das linhas
  105-106 diz "a reload starts it over") e `:133` (o recibo só é descartado se estiver nesse conjunto).
  A tabela de durabilidade registra a perda (`state/durability.ts:104`).
- No painel: duas mensagens na fila de uma filha ocupada, de duas tarefas. A filha toma a primeira
  (tarefa 1 ✓, carta 1 verde, carta 2 azul). Salva-se um arquivo do mod (recarga em todas as sessões) ou
  o processo reinicia: na releitura seguinte o recibo da primeira volta a valer e fecha a tarefa 2 ✓, com
  a carta 2 verde e a mensagem ainda na fila; o modelo recebe "recebimento confirmado".
- Correção: guardar no próprio envio o recibo que o confirmou (o envio já vive no state, no store e no
  arquivo publicado) e derivar daí os recibos usados, contando recibos de mesmo horário (entrega em lote)
  e lembrando o maior recibo já usado por destino, porque os envios tomados saem da lista (corte em 20).
- Arquivos: `hooks/sessions.ts`, `types/index.d.ts` (campo opcional em `Send`), `state/durability.ts`
  (a linha de `usedReceipts`), `tests/durabilidade.test.ts` ou `tests/envios.test.ts` (teste em duas
  partes, como os de recarga), `regras/durabilidade.md` ou `regras/envios.md` (cenário novo).
- Não contraria decisão: aplica `envios.fica-ate-entrega` ("a carta fica azul até a entrega").
- Nota: o achado baixo "watchSends marca os envios pelo índice de uma leitura antiga" mexe nas mesmas
  linhas; não foi triado aqui (é baixo), mas convém o planejador saber.

## 2. Carta, sessão ou subagente disparados antes do plan do pedido novo ancoram no pedido anterior
**Classe: decisão do usuário.**

- De pé: `hooks/panel.ts:255-272`. Sem nada em andamento, o "pedido atual" é o maior `turn` entre as
  tarefas existentes; com o pedido novo ainda sem plan, é o pedido anterior. Os três chamadores usam a
  mesma função (`hooks/tool-call.ts:119`, `hooks/sessions.ts:234`, `hooks/agents.ts:48-53`).
- Parte já resolvida: o cartão do subagente ancorado em tarefa já concluída agora é desenhado (commit
  `e4f1dfa`, cenário `subagentes.cartao-fica-com-a-origem-fechada`). O resto segue: a pendente esquecida
  do pedido anterior recebe a âncora e depois fecha ✓ sozinha (pela entrega ou pelo fim do subagente do
  pedido novo); o plan que vem em seguida não traz o cartão para o pedido novo.
- Por que é decisão: a regra registrada (2026-10-23, "envio feito sem tarefa em andamento ancora na
  última iniciada do pedido atual, mesmo concluída; sem nenhuma iniciada, no fim do pedido") não prevê o
  pedido que ainda não tem tarefas, e testes de envio existentes esperam a âncora no pedido anterior.
- Pergunta:
  > Num pedido novo, quando o modelo manda uma mensagem a outra sessão, abre uma sessão ou lança um
  > subagente ANTES de planejar as tarefas desse pedido, a carta e o cartão hoje vão para uma tarefa do
  > pedido anterior (uma pendente esquecida, que depois fecha sozinha, ou a última iniciada, já ✓). Onde
  > devem ficar?
  - **No pedido novo, sob a tarefa dele (Recomendado):** até o plan, a carta e o cartão ficam soltos no
    fim do painel; quando o plan do pedido chega, passam para a tarefa dele escolhida pela regra de sempre
    (o nome da sessão, senão a primeira pendente). Nenhuma tarefa do pedido anterior ganha carta nem fecha
    por causa deles.
  - **Soltos no fim do painel:** ficam no fim do painel, sem tarefa, também depois do plan.
  - **No pedido anterior, como hoje:** ficam sob a tarefa do pedido anterior e podem ir para
    "+N pedidos anteriores" junto com ele.

## 3. Carta cinza "interrompida": vence "entregue", depende de o plano novo repetir o id, e a carta cinza ainda na fila segue contando como espera
**Classe: correção direta (o que sobrou); a pergunta do achado já foi respondida.** Tamanho: pequeno.

- A pergunta ("cinza mesmo depois de entregue, ou o estado real da mensagem?") está decidida: 2026-11-12,
  "Cinza já no plan (Recomendado)" (`orq-decisoes-altos.local.md`, itens 1 e 2; a alternativa "azul até a
  entrega" foi oferecida e não escolhida; `regras/envios.md:56-57`). Não reabrir.
- Sobra, sem contrariar essa decisão:
  1. O lembrete "recebimento confirmado" afirma que "o painel já concluiu a tarefa do envio" mesmo quando
     não concluiu nada (tarefa interrompida pelo plano novo, fora do plano, ou com subtarefa aberta):
     `hooks/sessions.ts:196-214` e `text/rules.ts:227-229`. Corrigir para só dizer que concluiu quando
     concluiu.
  2. No cartão de uma filha parada com Esc (ou arquivada), as cartas já entregues das tarefas dela
     aparecem cinza "interrompida", enquanto no painel da própria filha seguem verdes: o cartão tira as
     "interrompidas" do painel já lido como parado (`draw/layout.ts:1289`, com `panelOf` em `:171-182`).
     Contraria `envios.esc-apos-entrega-imediata` ("a carta segue verde"). Corrigir usando o que a filha
     publicou, não a leitura de parada. Do mesmo jeito, a tarefa fechada ✕ pelo fim de um subagente que
     falhou (`hooks/agents.ts:296-300`) deixa cinza a carta já entregue dela: o cinza é da tarefa cortada
     por um plano novo, não de qualquer ✕.
  3. O texto de `envios.cor-por-estado` diz "cinza descartada antes da entrega" e o teste ligado afirma
     cinza "depois da entrega" (`tests/envios.test.ts:33-52`): alinhar o texto do cenário (sem tocar no
     teste selado).
- Arquivos: `hooks/sessions.ts`, `text/rules.ts`, `draw/layout.ts`, `regras/envios.md`,
  `tests/envios.test.ts` e `tests/lembretes.test.ts` (testes novos).
- Atenção: o item 2 muda o desenho de cartas dentro de cartão; conferir se o golden `envios` tem esse
  caso (se tiver, passa pela validação do usuário no app).

## 4. O destino da mensagem é casado por nome sem tratar nomes repetidos nem o formato "nome [ref]"
**Classe: não confirmado.**

- O código continua casando por id ou por nome: `hooks/tool-call.ts:118` e `:130-132` (todas as sessões
  com aquele nome ganham a rodada e o `lastAnchor`), `hooks/sessions.ts:124-126` (a primeira linha da
  lista que casa) e `:169-173` (só é "não entregue" se todas as de mesmo nome estiverem arquivadas; este
  último veio do PR 36 e cobre parte do caso).
- O que faltou: saber se o app aceita, entre sessões, o destino por nome, por nome repetido ou como
  "nome [ref]". Os tipos do kit descrevem o `to` do `SendMessage` para agentes ("a name from ListAgents
  (append its " [ref]" ...)", `.claude-plugin/types/claude-code-tools/index.d.ts:717`) e mandam usar o id
  `local_…` entre sessões (`claude-code-mcp/index.d.ts:292`). Com o id, que é o que as regras do usuário
  mandam, nada disso ocorre. Precisa de um ensaio no app (enviar por nome e por nome repetido) antes de
  virar correção.

## 5. Mensagem enviada pela ferramenta antiga do app (`mcp__ccd_session_mgmt__send_message`) não gera carta nem rodada
**Classe: correção direta, com dois pontos a conferir no app antes.** Tamanho: médio.

- De pé: `hooks/tool-call.ts:104` e `:216` comparam o nome exato `SendMessage`. A ferramenta antiga
  segue chamável nesta instalação (`claude-code-mcp/index.d.ts:292-298`: "this older tool stays callable
  for now"; campos `session_id` e `message`; aceita id, nome curto ou "parent").
- No painel: mensagem enviada por ela não mostra carta sob a tarefa, não é acompanhada (sem aviso de
  fila, sem conclusão na entrega) e o cartão do turno que ela abre na filha é colocado por palpite.
- Correção: tratar a ferramenta antiga como o `SendMessage` (destino por id ou nome). Pela regra do
  projeto ("Painel errado é bug do plugin: corrige-se o plugin, nunca o jeito de usar"), não basta dizer
  ao modelo para usar a outra.
- A conferir antes (o código não mostra): (a) o texto do resultado da ferramenta antiga, contra as
  expressões que decidem fila ou entrega (`tool-call.ts:141-148`); (b) como a mensagem chega na sessão
  destino: o tipo diz "a user turn labelled From …", e o recibo só é publicado para a tag
  `<cross-session-message from="local_…">` (`hooks/sessions.ts:91-98`); sem recibo, a carta ficaria azul
  para sempre. "parent" não tem como ser resolvido hoje (o mod não guarda quem abriu a sessão).
- Arquivos: `hooks/tool-call.ts`, `hooks/sessions.ts`, `hooks/prompt-submit.ts`, `text/rules.ts`,
  `tests/envios.test.ts`, `regras/envios.md`.

## 6. Com uma tarefa em andamento, a carta e o cartão vão para a pendente planejada depois dela
**Classe: decisão do usuário.**

- De pé: `hooks/panel.ts:274-286` (o ramo "planejada depois do início"); sem cenário nem teste.
- Contraria pedido registrado: `DESENVOLVIMENTO.md:1261` ("o segundo painel de implementacao deveria
  estar abaixo da tarefa de tooltip completo, foi ele quem enviou a mensagem de solicitação") e o
  comentário de `hooks/panel.ts:193-194`.
- Pergunta:
  > Com uma tarefa em andamento (◉) e um passo novo pendente (○) planejado depois dela no mesmo pedido,
  > a carta de uma mensagem enviada (ou o cartão de uma sessão aberta ou de um subagente lançado) fica
  > sob qual das duas?
  - **Sob a tarefa em andamento (Recomendado):** é o que as regras de uso dizem ao modelo; o passo novo
    segue ○ até o start e não fecha sozinho na entrega. Desfaz o seu pedido registrado ("o segundo painel
    de implementacao deveria estar abaixo da tarefa de tooltip completo, foi ele quem enviou a mensagem
    de solicitação").
  - **Sob o passo novo, como hoje:** a carta e o cartão vão para o ○ planejado por último; se a mensagem
    ficou na fila, a entrega conclui esse passo sozinha e a tarefa em andamento fica sem carta. As regras
    de uso passam a dizer isso ao modelo, e o caso ganha cenário e teste.

## 7. A mesma carta aparece em todos os cartões de rodada da filha (e, no painel principal, a carta órfã de replano pendura em outro pedido)
**Classe: correção direta.** Tamanho: pequeno a médio.

- De pé: `draw/layout.ts:480-488` (cada cartão de rodada recebe o painel da filha com todos os envios;
  só grupos, avisos, sessões e trabalho são repartidos) e `:1317-1323` (a carta sem tarefa no cartão cai
  sempre no último nível 1 dele). O chip conta linhas de carta na fila (`hooks/render.tsx:286`).
- No painel: uma filha com dois cartões que mandou sinal a uma irmã mostra a carta "Para <irmã>: …" sob
  a tarefa certa no segundo cartão e de novo no primeiro; com a carta na fila, o chip "aguardando sessão"
  conta duas. No painel principal: carta na fila cuja tarefa saiu num replano passa a pender do último
  nível 1 do pedido novo.
- Correção: repartir os envios entre os cartões como já se faz com avisos e sessões (a carta fica no
  cartão que tem a tarefa de origem; sem ela, no do turno em que foi enviada). No painel principal, a
  carta na fila só pende de um nível 1 do pedido em que foi enviada, e esse pedido fica à vista enquanto
  ela espera (mesma linha da decisão de 2026-11-12, "Sim, fica à vista (Recomendado)", para o id reusado).
- Arquivos: `draw/layout.ts`, `tests/sessoes.test.ts` e `tests/envios.test.ts` (testes novos),
  `regras/envios.md` (cenário novo ou nota em `envios.carta-sob-a-tarefa`).

## 8. O nome do destino na carta: irmã e mãe aparecem como 8 caracteres do id
**Classe: correção direta.** Tamanho: médio.

- De pé: `draw/layout.ts:1324-1329` (o nome só é procurado entre as filhas do painel desenhado e as de
  quem desenha; o resto vira `to.slice(6, 14)`).
- No painel: a filha manda sinal à irmã ou à mãe pelo id; no painel da filha a carta diz
  "Para 1a2b3c4d: …". No painel da mãe, o cartão da mesma filha mostra o nome da irmã, mas o código hex
  quando o destino é a própria mãe.
- Correção: um mapa id → nome com o que já se conhece (as linhas da lista de sessões ligadas, lidas em
  `hooks/sessions.ts:41-42` antes do filtro das filhas, e o nome de quem enviou cada mensagem recebida);
  no cartão desenhado pela mãe, a própria mãe é reconhecida pelo id próprio que o desenho já recebe.
- Arquivos: `hooks/sessions.ts`, `hooks/prompt-submit.ts`, `draw/layout.ts`, `hooks/render.tsx`,
  `state/durability.ts` (linha nova), `types/index.d.ts`, `io/publish.ts` se o mapa for publicado,
  testes novos em `tests/envios.test.ts`.
- Não contraria decisão; a palavra para a mãe, se o nome dela não for conhecido, fica como hoje.

## 9. Os dois fechamentos automáticos de tarefa (entrega da carta e fim dos subagentes) usam condições diferentes e incompletas
**Classe: correção direta (a parte que é bug); o resto já está decidido.** Tamanho: pequeno a médio.
Mesma causa do achado de subagentes "'Nada mais em execução nela' é medido diferente": ficam juntos.

- De pé: na entrega, a única condição é a tarefa aberta e sem subtarefa aberta
  (`hooks/sessions.ts:188`); no fim dos subagentes, "sessão viva" é só a aberta naquela tarefa e só
  rodando ou iniciando (`hooks/agents.ts:272-276`).
- Bug, contra `subagentes.um-rodando-mantem-o-pai` ("a tarefa não fecha … até o último terminar (e a
  carta ser entregue)"): tarefa com subagente rodando e carta na fila; a filha toma a carta e a tarefa
  fecha ✓ com o subagente ainda trabalhando (se ele falhar depois, a tarefa já está ✓). E, contra
  `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila`: duas cartas na fila da mesma tarefa
  para sessões diferentes, a primeira entrega fecha a tarefa com a outra ainda azul.
- Correção: uma só noção de "nada em execução na tarefa" (subagente vivo, sessão viva pela abertura ou
  pela rodada atual, inclusive a que espera a pessoa, outra carta na fila, pergunta aberta do próprio
  dono), usada nos dois fechamentos; a entrega só fecha quando ela vale, e o fechamento fica para quando
  o último terminar.
- Já decidido, não muda e não precisa de pergunta: a entrega da fila conclui a tarefa mesmo com o turno
  em curso (2026-10-30, "Sim, conclusão automática como hoje"; `regras/envios.md:15`).
- Arquivos: `hooks/sessions.ts`, `hooks/agents.ts` (ou a condição em `draw/layout.ts`, para o desenho
  usar a mesma), `tests/envios.test.ts` e `tests/subagentes.test.ts` (testes novos),
  `regras/subagentes.md` e `regras/envios.md`.

## 10. O casamento "pelo nome da sessão" também é aplicado a textos livres, por qualquer palavra de 4 letras
**Classe: decisão do usuário.**

- De pé: `hooks/panel.ts:218-227` (uma palavra de 4 letras basta; o nome inteiro como trecho do título,
  com 3 letras ou mais); os chamadores passam o título da sessão (`hooks/tool-call.ts:229-230`), a
  descrição e o tipo do subagente (`hooks/tool-call.ts:41`, `hooks/agents.ts:71`).
- Decisão registrada só para o nome da sessão: `regras/envios.md:93-95` ("Pelo nome"; "Sim, por palavra
  (Recomendado)", 2026-11-09). Para frases livres não há decisão.
- Pergunta:
  > A regra "pelo nome" (a carta ou o cartão vai à tarefa cujo título tem uma palavra de 4 letras ou
  > mais do nome da sessão) hoje também é aplicada ao título da sessão nova e à descrição e ao tipo do
  > subagente, que são frases livres. Com duas tarefas candidatas, uma palavra comum (ex.: "como", ou o
  > tipo "Plan" dentro de "Planejar…") manda o cartão para a tarefa errada. Onde o casamento por uma
  > palavra deve valer?
  - **Só no nome da sessão (Recomendado):** para o título da sessão e para a descrição e o tipo do
    subagente, o cartão só segue o texto quando o título da tarefa o contém inteiro (ou o texto contém o
    começo do título); senão vale a ordem de sempre (lote recente, a primeira sem carta).
  - **Nas frases livres, só com duas palavras em comum:** uma palavra só não decide; duas, sim.
  - **Também nas frases livres, como hoje:** qualquer palavra de 4 letras em comum com uma única tarefa
    candidata decide.

## 11. O cenário do envio "sem nada em andamento" diz "pendente planejada por último", o Reescrito diz "a primeira ainda sem carta", e dois desempates do código não estão escritos
**Classe: correção direta (catálogo, teste novo e documentação; nenhuma regra muda).** Tamanho: pequeno.

- De pé: `regras/envios.md:73-84` (título e Então antigos, só a linha `Reescrito` de 2026-11-09);
  o código faz as duas coisas em níveis diferentes (`hooks/panel.ts:264-272`: o lote planejado por
  último; dentro dele, a primeira sem carta; todas com carta, a última; sem pendente, a última iniciada;
  sem iniciada, o último nível 1); `DESENVOLVIMENTO.md:516` e `:529` ainda descrevem a regra anterior; os
  dois testes ligados têm uma pendente só (`tests/envios.test.ts:126-152`).
- Correção: reescrever o corpo do cenário com a ordem completa, sem mudar a regra; teste novo com duas
  pendentes e três envios; alinhar o `DESENVOLVIMENTO.md` e o comentário de `hooks/panel.ts:193-206`.
- Arquivos: `regras/envios.md`, `tests/envios.test.ts`, `regras/selos.json` (selo do teste novo),
  `DESENVOLVIMENTO.md`, `hooks/panel.ts` (comentário).

---

# Subagentes

## 1. Subagente fica "trabalhando" ou "em segundo plano" para sempre quando o fim dele não chega
**Classe: resolvido.**

- Corrigido no PR 36: commits `edca376` (conferência contra a lista de agentes do app) e `634bfde`
  (agentes de workflow, 30 minutos sem sinal). Código: `hooks/agents.ts:186-248` (`checkSubs`), chamado
  pela releitura de 3 s (`hooks/sessions.ts:38`). Cenários `subagentes.sem-fim-vira-interrompido`,
  `subagentes.vivo-de-verdade-segue-vivo` e `subagentes.workflow-sem-sinal-vira-interrompido`, cobertos;
  decisões de 2026-11-12 ("Sim, entra nesta rodada (Recomendado)"; "30 minutos sem sinal (Recomendado)").

## 2. Cada chamada de ferramenta de subagente com texto diferente regrava o painel inteiro antes de a ferramenta rodar
**Classe: correção direta.** Tamanho: médio.

- De pé: `hooks/agents.ts:142` (só não grava quando o texto é igual E passou menos de 1 s; como o texto
  leva arquivo, padrão ou comando, quase toda chamada grava), contra o comentário de `:25-26` ("at most
  once every THROTTLE ms per subagent"). Cada gravação passa por `change` (`hooks/panel.ts:374-381`):
  state, status, store e arquivo publicado; e a chamada espera por ela (`hooks/tool-call.ts:211`, antes
  do `next`).
- No painel: num workflow com dezenas de agentes, dezenas de gravações completas e redesenhos por
  segundo; o efeito (lentidão, cliques perdidos no redesenho) não foi medido, como o achado diz.
- Correção: freio por tempo de verdade (no máximo uma gravação por segundo, para todos os subagentes
  juntos), sem segurar a chamada da ferramenta; a gravação atrasada confere dentro da escrita se o
  subagente ainda está vivo, para não repor a ferramenta num cartão que já terminou. A linha
  "ferramenta · N chamadas" pode atrasar até 1 s; o teste coberto (avança 1500 ms) continua valendo.
- Arquivos: `hooks/agents.ts`, `hooks/tool-call.ts`, `tests/subagentes.test.ts` (teste novo).
- Não contraria decisão (`subagentes.corpo-e-as-tarefas-ou-a-ferramenta` não fixa a frequência).

## 3. O fechamento pelo fim dos subagentes: os dois gatilhos têm guardas diferentes e não há guarda de tempo
**Classe: decisão do usuário (o caso do Esc); a guarda de tempo já está resolvida.**

- Resolvido no PR 36 (commits `def10c8` e `4fdc25c`): a tarefa reaberta com start não fecha de novo
  pelo subagente antigo, nem a tarefa nova que reusa o id (`hooks/agents.ts:262-264`, `ofLeaf`; cenários
  `subagentes.reaberta-nao-fecha-pelo-subagente-antigo` e `subagentes.lancado-antes-da-tarefa-nao-conta`).
- De pé, e deixado de fora de propósito ("Fora deste cenário: … o fim de um subagente depois do Esc",
  `regras/subagentes.md:157`): depois de um Esc, o fim de um subagente em segundo plano dispara a varredura
  (`hooks/agents.ts:159`, que só olha se o turno acabou, não se foi parado), e a tarefa que o Esc deixou
  ✕ (aberta com a marca de parada, `state/tasks.ts:73-79`) é fechada ✓ no state, com as outras paradas
  cujos subagentes já tinham terminado. No fim normal do turno a mesma varredura é pulada quando houve
  Esc (`hooks/turn.ts:148`).
- Por que é decisão: duas regras suas se cruzam. `subagentes.pai-conclui-no-fim-do-turno` ("ou o último
  subagente em segundo plano termina depois do turno"; "Fecha de fato (Recomendado)") e
  `turnos.parada-segue-interrompida-ate-o-start` (2026-11-12, "Segue ✕ até novo start (Recomendado)":
  "só o start nela a reacende ◉ … e o done a conclui").
- Pergunta:
  > Você para o turno com Esc e uma tarefa iniciada fica ✕. Ela tinha um subagente em segundo plano, que
  > termina depois. Hoje o fim dele fecha a tarefa sozinho (✓ se ele concluiu), trocando o ✕ sem ninguém
  > agir, e fecha junto as outras tarefas paradas cujos subagentes já tinham terminado. O que o painel
  > deve fazer?
  - **Fica como o Esc deixou (Recomendado):** a tarefa segue ✕ até um start nela, como na sua decisão de
    2026-11-12 ("Segue ✕ até novo start"); o cartão do subagente mostra "concluído" embaixo dela.
  - **Fecha como no fim normal:** quando o último subagente termina, a tarefa fica ✓ (ou ✕ "falhou"),
    mesmo depois do Esc.

## 4. Subagente retomado ou acordado por mensagem: o primeiro fim de turno é tratado como fim definitivo e o cartão não volta a "trabalhando"
**Classe: correção direta.** Tamanho: médio. Depende da pendência "carta para subagente parado antes de
receber" (mensagem a um subagente é justamente o que o retoma): implementar depois dela.

- De pé: `hooks/agents.ts:67` (o lançamento com `resume` sai sem tocar no cartão), `:139` (chamadas de
  quem não está vivo são ignoradas) e `hooks/turn.ts:171-181` (todo fim de turno de subagente que não é
  teammate é o fim). O fluxo existe: os tipos do kit dizem que a retomada vem com o mesmo id
  (`.claude-plugin/types/claude-code/index.d.ts:380-393`) e que "a message may yet resume one, under the
  same id" (`:562-564`).
- No painel: o subagente retomado trabalha de novo, mas o cartão segue "concluído" (ou "interrompido"),
  sem ferramenta em uso e fora da pílula "N subagentes"; a tarefa de origem, se ainda aberta, fecha no
  fim do turno com ele trabalhando (contra `subagentes.um-rodando-mantem-o-pai`).
- Correção: na retomada, o cartão volta a "trabalhando" (ou "em segundo plano"), sem fim, e a contagem
  de chamadas continua de onde estava; o fim seguinte vale como fim. O que deriva de regras já
  registradas e não pede pergunta: as tarefas ✕ do grupo dele só reabrem com start (como a tarefa parada
  com Esc, 2026-11-12); a tarefa de origem já fechada não reabre (como em
  `subagentes.workflow-sem-sinal-vira-interrompido`: "a tarefa de origem já fechada não reabre"); ainda
  aberta, espera por ele.
- Arquivos: `hooks/agents.ts`, `hooks/turn.ts`, `tests/subagentes.test.ts`, `tests/kit/` se o roteiro
  não tiver a retomada (arquivo do kit muda com selo), `regras/subagentes.md` (cenário novo, mais um
  `checklist` para a retomada real no app).
- Se a orquestradora preferir confirmar os dois pontos derivados, cabe uma pergunta curta; não contrariam
  nada registrado.

## 5. Relançar um subagente depois de uma falha deixa a tarefa ✕ "falhou", mesmo com a nova tentativa concluída
**Classe: decisão do usuário.**

- De pé: `hooks/agents.ts:283` (falhou se qualquer um falhou, sem ordem no tempo).
- Regra coberta que a correção muda: `subagentes.pai-reflete-falha-ou-interrupcao` ("com fins mistos
  vale o pior …, derivado das respostas acima"; as suas palavras, 2026-11-09: "interrompido se é
  interrompido, falha se ele falhou"); teste selado do misto.
- Pergunta:
  > Um subagente falha (erro de API ou recusa); o modelo vê a falha e lança outro da mesma tarefa, que
  > conclui; o turno termina sem done. Hoje a tarefa fica ✕ "falhou" (vale o pior fim entre todos os
  > subagentes dela) e o done seguinte do modelo é recusado com "foi interrompida". Como a tarefa deve
  > ficar?
  - **✓, vale a última tentativa (Recomendado):** quando um subagente é lançado depois do fim de outro
    da mesma tarefa, conta o fim do último; lançados juntos, continua valendo o pior. O cartão do que
    falhou segue "falhou" embaixo da tarefa.
  - **✕ "falhou", como hoje:** vale o pior fim de todos; o modelo precisa dar start e done para
    corrigir.

## 6. As tarefas de um subagente contam no cabeçalho só enquanto o cartão dele está desenhado, e nunca na linha da tarefa ou do pedido
**Classe: decisão do usuário.**

- De pé: as tarefas do subagente entram no cabeçalho pelas linhas do cartão aberto ou pelo cartão
  recolhido (`draw/layout.ts:1590-1594`), mas a linha recolhida da tarefa ou do pedido leva só as tarefas
  das sessões (`:1131`, `:1199`), e a linha de um agente no cartão de grupo não leva nenhuma (`:1523`,
  `:1542`). Recolher a tarefa de cima muda o "d de n", contra `cabecalho.numeros-somam-o-desenhado`.
- Por que é decisão: `subagentes.fora-da-contagem` (2026-11-09, "Fora da contagem") fala do cartão; para
  as tarefas que o subagente planeja não há decisão.
- Pergunta:
  > Um subagente que usa o painel planeja as próprias tarefas dentro do cartão dele. Hoje elas entram no
  > "d de n" do cabeçalho enquanto o cartão está à vista (ex.: "0 de 4" com o pedido dizendo 0/2), somem
  > da conta quando você recolhe a tarefa de cima, e nunca entram no x/y da tarefa nem do pedido. As
  > tarefas de um subagente contam onde?
  - **Em lugar nenhum, só no cartão dele (Recomendado):** o "d de n" do cabeçalho e o x/y das linhas
    contam só as tarefas da sessão e das sessões filhas; as do subagente aparecem no cartão, com o x/y do
    próprio cartão. Igual à sua decisão "Fora da contagem" para o cartão.
  - **No cabeçalho e nas linhas acima:** entram no "d de n" e no x/y da tarefa de origem e do pedido,
    com o cartão aberto, recolhido ou em cartão de grupo.

## 7. Tarefa pendente com trabalho pendurado: sessão viva acende a tarefa, carta na fila acende só os pais, subagente rodando não acende nada
**Classe: decisão do usuário.**

- De pé: o tom da tarefa e o do pedido só olham sessão viva e carta na fila
  (`draw/layout.ts:1073-1090`, `:1157`); nenhum termo olha subagente vivo.
- Decisão registrada que a correção contraria na letra: `arvore.sem-start-nada-acende` (2026-10-23,
  "sem start, nada aceso"); a sessão filha é a exceção registrada.
- Pergunta:
  > O modelo lança um subagente de uma tarefa que não iniciou com start. Hoje a tarefa, o pai e o pedido
  > seguem ○ "pendente", o chip "em andamento" fica em zero com um cartão "trabalhando" logo abaixo, e no
  > fim do turno a tarefa pula de ○ direto para ✓. Com uma sessão filha no lugar do subagente, os três
  > ficam ◉. Enquanto o subagente roda, a tarefa deve aparecer em andamento?
  - **Sim, ◉ como com a sessão filha (Recomendado):** a tarefa, o pai e o pedido ficam ◉ enquanto o
    subagente roda; a tarefa iniciada com subagente em segundo plano segue ◉ depois do fim do turno, em
    vez de ◷. É uma exceção a "sem start, nada aceso" (2026-10-23), como a da filha.
  - **Não, como hoje:** sem start, a tarefa fica ○ com o cartão trabalhando embaixo.

## 8. `SendMessage` para subagente ou teammate vira carta de sessão; envio feito por subagente não tem carta mas mexe nos cartões
**Classe: tratado à parte (a primeira metade); a segunda metade não está confirmada.**

- Primeira metade (a carta para subagente, que pode ficar "na fila" para sempre): é a causa da pendência
  "carta para subagente parado antes de receber", decidida em 2026-11-13 ("Cinza \"não entregue\"
  (Recomendado)", `orq-decisoes-pendencias.local.md`, item 1) e em planejamento à parte. Essa decisão
  parte de que a mensagem a um subagente tem carta; por isso a pergunta da auditoria "mensagem a
  subagente vira carta?" perdeu o objeto, salvo se o usuário quiser reabri-la.
- Segunda metade (um subagente manda mensagem a uma sessão filha): o código confirma que não há registro
  (`hooks/tool-call.ts:222`, a chamada de subagente sai antes de tudo). O efeito descrito (a filha publica
  o recibo como vindo desta sessão, e ele confirma por engano um envio do loop principal que ainda espera)
  depende do remetente que o app põe na mensagem, que o código não mostra. Falta um ensaio no app.

## 9. No cartão de grupo (mais de três, ou workflow), o aviso de espera de um agente não aparece
**Classe: correção direta.** Tamanho: pequeno a médio.

- De pé: `draw/layout.ts:1528-1545` (a linha de cada agente vem fechada e mostra só a ferramenta ou o
  estado; os avisos do agente só existem dentro do cartão próprio dele) e `hooks/render.tsx:285` (o chip
  "aguardando" e a faixa contam linhas de aviso desenhadas).
- No painel: num "Workflow · 12 agentes", um agente pede permissão (ou abre uma pergunta); a linha dele
  segue "trabalhando" com a última ferramenta, nenhum "Aguardando permissão" aparece, nem no chip nem na
  faixa. Contra `perguntas.permissao-espera` ("aparece Aguardando permissão: <ferramenta>").
- Correção: a linha do agente com espera aberta mostra o aviso no lugar da ferramenta, com o tom de
  espera, e conta no chip "aguardando" e na faixa mesmo com a linha fechada.
- Arquivos: `draw/layout.ts`, `hooks/render.tsx`, `tests/subagentes.test.ts` ou
  `tests/perguntas.test.ts`, `regras/subagentes.md` ou `regras/perguntas.md`. Conferir o golden
  `subagente` (não deve mudar: o cenário não tem espera).
- Ligado a "Recolher uma linha muda os chips" (desenho): mesma ideia de a linha fechada levar o que
  esconde.

## 10. "Nada mais em execução nela" é medido diferente no fechamento automático e no desenho
**Classe: correção direta.** Tamanho: pequeno. Mesma causa do achado de envios "Os dois fechamentos
automáticos": ficam juntos.

- De pé: `hooks/agents.ts:272-276`. A sessão viva é só a aberta naquela tarefa (`c.anchor`) e só rodando
  ou iniciando; o desenho usa a rodada atual e conta também a que espera a pessoa
  (`draw/layout.ts:145`, `:535`, `:547-550`). E a espera é casada só pelo id da tarefa, sem o dono
  (`agents.ts:273`): a espera de um subagente cuja tarefa tem o mesmo id segura a folha da principal.
- No painel: a tarefa fecha ✓ de fato no fim do turno com a sessão trabalhando na rodada dela (mensagem
  entregue na hora a uma sessão aberta em outra tarefa) ou esperando o usuário; o desenho ainda a mostra
  em andamento, mas o x/y já a conta e nenhum done será pedido. Contra o "Dado" de
  `subagentes.pai-conclui-no-fim-do-turno` ("nenhuma sessão filha viva").
- Correção e arquivos: os do achado de envios "Os dois fechamentos automáticos".

---

# Desenho do painel e cabeçalho

## 1. Tempo do cabeçalho segue contra "agora" com o turno encerrado, mas o relógio de 1 s para
**Classe: decisão do usuário.** Junto com "O cronômetro da tarefa retomada" (as duas definem o tempo).

- De pé no painel nativo: `hooks/render.tsx:274` (basta haver tarefa aberta entre as desenhadas para o
  tempo ser medido até agora; ○ e ◷ continuam abertas depois do fim do turno) e
  `hooks/sessions.ts:286-299` (com o turno encerrado, sem filha viva nem carta na fila, o relógio de 1 s
  se cancela). O número fica o do último desenho e salta no seguinte.
- Sem regra registrada: não há cenário de tempo em `regras/cabecalho.md`; `turnos.iniciada-aguarda-no-fim`
  fala das linhas ("◷ com o relógio parado").
- Pergunta:
  > Com o turno encerrado e tarefas ainda abertas (○ ou ◷), o tempo das linhas fica parado, mas o do
  > cabeçalho continua medido até "agora" sem o relógio de 1 s: o número congela e salta quando qualquer
  > coisa redesenha o painel (uma hora depois, um clique numa dobra faz pular para 1:05:00). O que o
  > tempo do cabeçalho deve fazer com o turno encerrado?
  - **Parar no fim do turno, como as linhas (Recomendado):** o cabeçalho mostra o tempo até o fim do
    turno; com sessão filha trabalhando ou carta na fila, segue contando com o relógio ligado.
  - **Seguir contando, com o relógio ligado:** tempo de parede; o painel passa a redesenhar a cada
    segundo enquanto existir qualquer tarefa aberta, mesmo com tudo parado.

## 2. Recolher uma linha muda os chips e a faixa do cabeçalho
**Classe: correção direta.** Tamanho: médio.

- De pé no painel nativo: os números "d de n" vêm das tarefas que cada linha representa, mas os chips
  "aguardando", "aguardando sessão", "sessões ativas" e "subagentes" e a faixa são contados por linha
  desenhada (`hooks/render.tsx:273`, `:285-288`); a linha recolhida da tarefa, do pedido, do cartão de
  sessão e do cartão de grupo não leva o que esconde (`draw/layout.ts:1129-1131`, `:1198-1199`,
  `:1267-1274`, `:1525`).
- No painel: a filha pede permissão e a pessoa recolhe o cartão, a tarefa de origem ou o pedido: o chip
  "1 aguardando" some e a faixa passa de "aguardando" para "sessão ativa" ou "em andamento". Recolher a
  tarefa com o cartão de uma filha trabalhando tira "1 sessão ativa"; com carta na fila, tira
  "aguardando sessão"; com subagentes, tira o chip deles.
- Correção: a linha recolhida passa a levar o que as linhas de dentro contariam (avisos, cartas na fila,
  sessões vivas, subagentes vivos), e o cabeçalho soma esses valores em vez de contar linhas.
- Regra aplicada: `cabecalho.numeros-somam-o-desenhado` ("os números somam o que o painel mostra, e
  recolher não muda nada"; as suas palavras, 2026-10-23: "as colapsada, mas que estao nessa visao, tambem
  entram"). As palavras falam de tarefas; estender aos chips não contraria nada, mas convém registrar no
  cenário (`Reescrito` ou cenário novo) que a regra vale para chips e faixa. O teste selado da regra
  (`tests/cabecalho.test.ts:12-33`) não muda; teste novo.
- Arquivos: `draw/layout.ts`, `hooks/render.tsx`, `tests/cabecalho.test.ts`, `regras/cabecalho.md`.
  O golden não deve mudar (nada recolhido nos quatro cenários); conferir.
- A parte das tarefas de subagente sob linha recolhida espera a pergunta "As tarefas de um subagente
  contam onde?".

## 3. toks/s e "ultracode" do cabeçalho não são desenhados abaixo de 84 colunas; os testes não veem a falta
**Classe: decisão do usuário.**

- De pé no painel nativo, em outro arquivo: `draw/head.tsx:58-59` (`NARROW = 84`) e `:99-105` (abaixo de
  84 colunas do painel, sem toks/s e sem "ultracode"); o texto alternativo os diz sempre
  (`hooks/render.tsx:299-300`). O teste de `ultracode.cabecalho` lê o texto do cabeçalho junto com os
  textos alternativos, a 60 colunas (`tests/ultracode.test.ts:21`, `:47-64`), e passa sem a palavra estar
  desenhada. As evidências antigas (`draw/svg.ts:116-122`, `:648-649`, `geometry.ts`) não existem mais.
- Decisão registrada em parte: o cabeçalho estreito sem toks/s veio do desenho V4 aprovado ("gostei da
  V4", 2026-11-03; golden a 60 colunas). Para "ultracode" no estreito não há decisão, e
  `ultracode.cabecalho` e `visual.cabecalho-em-cartao` não escrevem a condição de largura.
- Pergunta:
  > Num painel com menos de 84 colunas (o painel lateral comum fica perto de 80; o desenho travado usa
  > 60), o cabeçalho mostra só o "%", o "d de n" e o tempo: o toks/s e a palavra "ultracode" existem
  > apenas no texto alternativo, que não aparece na tela. O que o cabeçalho estreito deve mostrar?
  - **"ultracode" sempre; toks/s só no largo (Recomendado):** a palavra aparece em qualquer largura
    quando o interruptor está ligado; o toks/s continua fora do estreito, como no V4 que você aprovou.
    Muda o desenho do cabeçalho estreito com ultracode ligado (passa pela sua validação no app).
  - **Os dois sempre:** toks/s e "ultracode" em qualquer largura, numa linha a mais ou apertando o
    bloco de números. Muda o desenho aprovado a 60 colunas e o golden.
  - **Omitir os dois no estreito, como hoje:** só se escreve a condição de largura no catálogo.
- Em qualquer resposta (sem pergunta): escrever a largura nos cenários e fazer o teste conferir o que é
  desenhado, sem contar o texto alternativo, numa largura de 84 colunas ou mais.

## 4. Status "Tarefas d/n" sob a caixa de mensagem diverge do cabeçalho e do total da sessão
**Classe: correção direta.** Tamanho: pequeno.

- De pé: `hooks/panel.ts:342-353`. O status soma o total sem repartir as filhas em rodadas e sem tirar
  as pendentes da filha "encerrada"; a "sessão inteira" do cabeçalho faz as duas coisas
  (`hooks/render.tsx:215-217`).
- No painel: uma filha para com 2 pendentes e a tarefa de origem é fechada; o cartão vira "encerrada", o
  cabeçalho mostra "4 de 4, 100%" e o status embaixo da caixa de mensagem fica em "Tarefas 4/6" para
  sempre. O mesmo com uma rodada antiga abandonada com tarefa aberta. Contra
  `sessoes.filha-parada-com-origem-fechada-sai-da-contagem` ("saem da contagem").
- Correção: o status usa o mesmo cálculo da "sessão inteira" (uma função só, usada pelos dois); registrar
  em `visual.status-embaixo-da-caixa` que o número é o da sessão inteira; acertar o parágrafo "Contador"
  do `DESENVOLVIMENTO.md`.
- Arquivos: `hooks/panel.ts`, `hooks/render.tsx`, `draw/layout.ts`, `tests/sessoes.test.ts` (se o kit lê
  o status; senão fica no checklist), `regras/visual.md`, `DESENVOLVIMENTO.md`.

## 5. Com "+N pedidos anteriores" aberto e mais de 400 linhas, a própria linha que fecha o histórico é cortada
**Classe: tratado à parte (já decidido).**

- Ainda de pé no código (`draw/layout.ts:718-737`: o corte procura o bloco a partir do índice 1, e a
  linha do histórico é a primeira de profundidade 0, `:1419-1427`), mas a decisão já foi tomada:
  2026-11-13, "Preservar a linha (Recomendado)" (`orq-decisoes-pendencias.local.md`, item 2B), e está na
  fila das pendências ("histórico e aviso"), com planejador próprio. Nada a fazer nesta triagem.
- Para o planejador de lá: o corte por tamanho (600 KB e 95.000 caracteres, PR 36 e PR 37) usa a mesma
  função com um teto menor (`hooks/render.tsx:370-376`), então a linha some com muito menos de 400 linhas.

## 6. Corte de linhas: um bloco pequeno depois do pedido gigante esconde o pedido inteiro; e no bloco único o corte guarda o começo, não a tarefa em andamento
**Classe: correção direta (o bloco pequeno) e decisão do usuário (a janela do bloco único).**

- De pé: `draw/layout.ts:722-736`. O corte aceita qualquer linha de profundidade 0 a partir da qual o
  resto cabe, e depois dos pedidos vêm nessa profundidade o aviso sem tarefa (`:1448`), os subagentes sem
  âncora (`:1453`), "+N cartões antigos" e os cartões soltos (`:1617-1618`). No bloco único, guarda o
  começo. Com o corte por tamanho do PR 36 (mesma função, teto menor), os dois casos ficaram mais fáceis
  de acontecer.
- Correção direta (tamanho pequeno a médio): o "último pedido" passa a ser o último bloco de pedido, e
  os blocos pequenos do fim (aviso, cartão solto, subagente sem tarefa) ficam com espaço reservado. Hoje:
  plano de 500 tarefas mais um cartão solto mostra "+501 linhas anteriores" e só o cartão; o plano some
  e o cabeçalho conta só o que restou. Contra `cabecalho.limite-de-linhas-do-desenho` ("se o último
  pedido sozinho passa do limite, ele é desenhado até o limite"). Arquivos: `draw/layout.ts`,
  `tests/cabecalho.test.ts`. Fazer depois da pendência do histórico (mesma função).
- Decisão (o desenho aprovado em 2026-10-22, "Sim, com o corte", diz "desenhado até o limite e fecha com
  +N linhas no fim dele", `regras/cabecalho.md:105`):
  > Quando um único pedido passa do limite de linhas do desenho (400, ou menos quando o desenho passa de
  > 600 KB), o painel mostra o começo dele e fecha com "+N linhas". Se a tarefa em andamento está depois
  > do corte, ela não aparece, o chip "em andamento" fica em 0 e a faixa do cabeçalho diz "aguardando"
  > com trabalho em curso. O que mostrar nesse caso?
  - **O trecho do pedido onde está a tarefa em andamento (Recomendado):** "+N linhas anteriores" antes e
    "+N linhas" depois; os chips e a faixa voltam a refletir o trabalho em curso. Muda o desenho aprovado
    em 2026-10-22.
  - **O começo, como hoje, mas contando o que ficou escondido:** o desenho não muda; os chips e a faixa
    passam a contar a tarefa em andamento que está depois do corte.
  - **Como hoje:** o começo do pedido, e o cabeçalho conta só o que está desenhado.

## 7. "Sessão inteira: a de b" não tem mais onde aparecer no desktop
**Classe: decisão do usuário.**

- Metade resolvida: o catálogo não fala mais em tooltip. `cabecalho.limites-de-linhas` diz "a sessão
  inteira, só no texto alternativo da barra do cabeçalho" (`regras/cabecalho.md:81`, `Reescrito` de
  2026-11-13) e `visual.cabecalho-barra-e-chips-desenhados` diz "no texto alternativo".
- De pé: no app o total só existe no texto alternativo da barra, que não aparece na tela
  (`hooks/render.tsx:284`, `:303`; `draw/head.tsx:15-18` recebe `whole` e não o desenha); no terminal
  aparece. Restos de texto (correção direta, pequena, junto com a resposta): os comentários de
  `hooks/render.tsx:208`, `:213` e `:270` e as linhas 1109-1110 e 1600 do `DESENVOLVIMENTO.md` ainda
  dizem "tooltip".
- Sem decisão sobre o total no app (`regras/visual.md:38-48` decide só o tooltip de texto cortado).
- Pergunta:
  > Com pedidos em "+N pedidos anteriores", o cabeçalho conta só o que está à vista (ex.: "1 de 1"). O
  > total da sessão inteira (ex.: "5 de 5") hoje, no app desktop, existe só no texto alternativo da
  > barra, que não aparece na tela; no terminal ele aparece. Quer ver esse total no app?
  - **Sim, na linha "+N pedidos anteriores" (Recomendado):** a linha passa a dizer, por exemplo,
    "+4 pedidos anteriores · sessão inteira: 5 de 5", só quando o total difere do mostrado.
  - **Sim, junto do "d de n" do cabeçalho:** por exemplo "1 de 1 · sessão 5 de 5" no bloco de números.
    Muda o desenho do cabeçalho.
  - **Não, fica só no texto alternativo, como hoje.**

## 8. O cronômetro da tarefa retomada soma o tempo parado entre turnos
**Classe: decisão do usuário.** Junto com "Tempo do cabeçalho segue contra 'agora'".

- De pé: `draw/layout.ts:119-123` (o tempo é agora menos o primeiro início) e `state/tasks.ts:124-127`
  (o start numa tarefa aberta mantém o primeiro início e apaga a parada; vale também para a tarefa parada
  com Esc). O fim do turno só para o relógio na cópia do desenho.
- Sem regra registrada: `turnos.iniciada-aguarda-no-fim` e `turnos.prompt-seguinte-retoma` não definem o
  tempo ao retomar.
- Pergunta:
  > Uma tarefa recebe start às 10:00 e o turno termina às 10:05 (◷, 5:00). Você volta às 14:00 e manda
  > "continue": a linha passa a mostrar 4:00:05 e contando, e o pai, o pedido e o cabeçalho inflam igual.
  > O tempo de uma tarefa que atravessa turnos deve contar o quê?
  - **Só o tempo com o turno em curso (Recomendado):** a tarefa retoma de 5:00; o tempo parado entre os
    turnos (e depois de um Esc) não entra, nem no pai, no pedido, no cabeçalho ou no cartão da filha
    visto pela mãe.
  - **Do primeiro start ao fechamento, como hoje:** tempo de parede, incluindo o que ficou parado.

## 9. "+N pedidos anteriores" conta também o pedido que segue desenhado em parte, e esse pedido perde os níveis 1 fechados
**Classe: correção direta.** Tamanho: pequeno.

- De pé: `draw/layout.ts:1399-1411`. Com mais de três pedidos no trabalho, o filtro é por tarefa de
  nível 1 (fica só a que tem algo aberto ou sessão viva) e a contagem "+N" soma o pedido de qualquer
  tarefa deixada de fora.
- No painel: um pedido antigo com um nível 1 aberto e outro fechado aparece só com o aberto; o fechado
  some e o mesmo pedido é contado em "+N pedidos anteriores" (caso real da auditoria: 35 pedidos, 4
  desenhados e "+32").
- Correção: decidir por pedido. O pedido antigo com algo aberto fica inteiro (todos os níveis 1 dele) e
  não entra na contagem. Segue a decisão registrada (2026-10-23, "somente limpe os itens quando todos
  estiverem concluidos e quando iniciarem novas tarefas", `regras/pedidos.md:114-121`,
  `pedidos.resumida-mantem-anteriores-com-algo-aberto`; "as tarefas concluídas deveriam ficar do jeito
  que estão até todas as tarefas estarem concluídas", citada em `draw/layout.ts:748-750`).
- Arquivos: `draw/layout.ts`, `tests/cabecalho.test.ts` ou `tests/pedidos.test.ts` (teste novo: mais de
  três pedidos no trabalho, o mais antigo com um nível 1 fechado e outro aberto).

## 10. Faixa e chips do cabeçalho divergem do que a árvore mostra: "aguardando" com linha ◉, e âmbar por tarefa da filha
**Classe: decisão do usuário (duas perguntas).**

- De pé no painel nativo: `hooks/render.tsx:279-288` e `draw/svg.ts:221-229` (`headerState`). O chip
  "em andamento" conta as folhas com relógio correndo entre todas as desenhadas, inclusive as dos cartões
  das filhas; `Row.active` ("In progress of its own") é calculado e nunca lido (`draw/layout.ts:1122`).
  Entre um done e o start seguinte não há folha com relógio, e o estado cai em "aguardando"
  (`svg.ts:228`); a tarefa de origem ◉ por filha viva, com o turno encerrado, entra no chip "aguardando"
  (`render.tsx:282`, `:285`).
- Decisão registrada: `visual.faixa-de-estado-geral` (2026-11-03: "Âmbar claro, 'aguardando'" para só
  pendentes, nada iniciado; "azul com só uma sessão filha trabalhando"). O estado "algo feito, algo
  pendente, turno em curso" não está no cenário; para a filha, o cenário diz azul e o código faz âmbar.
- Pergunta 1:
  > No meio de um turno, entre o done de uma tarefa e o start da seguinte, o pedido segue ◉ na árvore,
  > mas a faixa do cabeçalho passa a âmbar claro "aguardando" e volta a âmbar no start: ela alterna a
  > cada tarefa. Com o turno em curso e tarefas pendentes, a faixa deve ser qual?
  - **Âmbar "em andamento" enquanto o turno roda (Recomendado):** a faixa e o estado geral dizem "em
    andamento" durante o turno; o chip "em andamento" não muda (segue contando só as folhas iniciadas).
  - **Âmbar claro "aguardando", como hoje.**
- Pergunta 2:
  > Com tudo desta sessão concluído e só uma sessão filha trabalhando numa tarefa iniciada dela, a faixa
  > do cabeçalho hoje fica âmbar "em andamento" (a tarefa da filha conta como andamento próprio), e a
  > tarefa de origem, desenhada ◉ por causa da filha, entra no chip "aguardando". O cenário que você
  > aprovou em 2026-11-03 diz "azul com só uma sessão filha trabalhando". Qual vale?
  - **Azul "sessão ativa" (Recomendado):** as tarefas das filhas deixam de contar no chip "em andamento"
    (a filha conta no chip "sessões ativas"), e a tarefa de origem ◉ por causa da filha sai do chip
    "aguardando".
  - **Âmbar, como hoje:** o texto do cenário é corrigido para dizer que a tarefa iniciada da filha conta
    como "em andamento".

---

# Correções diretas, em lotes, na ordem sugerida

Um commit por item (regra do projeto); cada lote reúne o que mexe no mesmo trecho e pode ser planejado
junto. Tudo o que toca `draw/layout.ts` ou `hooks/render.tsx` afeta o catálogo inteiro pela matriz de
impacto e pede a conferência do golden.

1. **Textos e catálogo, sem código de comportamento** (pequeno):
   - o cenário do envio "sem nada em andamento" reescrito com a ordem completa, teste novo de duas
     pendentes e três envios, `DESENVOLVIMENTO.md` alinhado;
   - o lembrete "recebimento confirmado" só diz que o painel concluiu a tarefa quando concluiu; o texto
     de `envios.cor-por-estado` alinhado ao teste.
2. **Contagens do cabeçalho e do status** (pequeno cada um):
   - status "Tarefas d/n" igual à sessão inteira;
   - "+N pedidos anteriores" decidido por pedido.
3. **Fechamento automático da tarefa** (pequeno a médio): uma noção só de "nada em execução na tarefa",
   para a entrega da carta e para o fim dos subagentes (os dois achados de mesma causa).
4. **Recibo guardado no envio** (médio): a recarga do mod não reaproveita o recibo antigo.
5. **Cartas dentro dos cartões** (pequeno a médio): a carta não se repete em todos os cartões de rodada
   da filha; no cartão da filha parada com Esc, a carta entregue segue verde.
6. **O que a linha fechada leva para os chips e a faixa** (médio): recolher uma linha não muda chips nem
   faixa; o aviso de espera de um agente aparece e conta no cartão de grupo.
7. **Corte de linhas, bloco pequeno depois do pedido gigante** (pequeno a médio): só depois da pendência
   do histórico aberto, que mexe na mesma função.
8. **Gravações do cartão do subagente com freio por tempo** (médio).
9. **Subagente retomado volta a "trabalhando"** (médio): só depois da pendência da carta para subagente.
10. **Nome do destino na carta** (médio): mapa id → nome para irmã e mãe.
11. **Ferramenta antiga de mensagem acompanhada como o `SendMessage`** (médio): só depois de conferir no
    app o texto do resultado e o formato de chegada.

# Perguntas ao usuário (14), na ordem sugerida

Envios:
1. Carta e cartão disparados antes do plan do pedido novo: onde ficam (achado 2 de envios).
2. Tarefa em andamento e passo novo pendente: a carta e o cartão ficam sob qual (achado 6 de envios).
3. Casamento por uma palavra: só no nome da sessão ou também em frases livres (achado 10 de envios).

Subagentes:
4. Depois de um Esc, o fim do último subagente fecha a tarefa sozinho (achado 3 de subagentes).
5. Subagente falha, outro da mesma tarefa conclui: ✓ ou ✕ "falhou" (achado 5).
6. As tarefas que um subagente planeja contam onde (achado 6).
7. Tarefa sem start com subagente rodando aparece ◉ (achado 7).

Desenho e cabeçalho:
8. Tempo do cabeçalho com o turno encerrado (achado 1 de desenho).
9. Tempo da tarefa que atravessa turnos (achado 8).
10. Cabeçalho estreito: toks/s e "ultracode" (achado 3).
11. Total da sessão inteira visível no app (achado 7).
12. Faixa entre um done e o start seguinte (achado 10, pergunta 1).
13. Faixa com só a filha trabalhando (achado 10, pergunta 2).
14. Pedido único acima do limite de linhas: qual trecho mostrar (achado 6).

Dependências entre respostas e correções: a pergunta 6 decide a parte das tarefas de subagente no lote 6;
a pergunta 4 mexe na mesma varredura do lote 3 (fazer o lote 3 antes); as perguntas 8 e 9 definem juntas
o tempo; a pergunta 14 mexe na função do lote 7 e da pendência do histórico.

Não reabrir: a cor da carta de plano interrompido (2026-11-12, "Cinza já no plan (Recomendado)"); a
conclusão da tarefa na entrega da fila com o turno em curso (2026-10-30, "Sim, conclusão automática como
hoje"); a linha do histórico preservada no corte (2026-11-13, "Preservar a linha (Recomendado)"); a carta
para subagente parado (2026-11-13, "Cinza \"não entregue\" (Recomendado)").

A conferir no app antes de virar correção: o destino do `SendMessage` por nome, nome repetido e
"nome [ref]" entre sessões; o resultado e o formato de chegada da ferramenta antiga de mensagem; o
remetente que o app põe na mensagem enviada por um subagente a uma sessão.
