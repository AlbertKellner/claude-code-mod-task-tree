# Pendência 1: carta para subagente parado antes de receber (plano)

Planejador do item 1, 2026-11-14. Base: `fix/pendencias-auditoria` em `d3b1078` (o `1f9e8c1` mais o commit
da frase do lembrete), árvore limpa. Só li código, catálogo, kit e testes; nada foi escrito no clone.

Decisão do usuário (2026-11-13, "Cinza \"não entregue\" (Recomendado)"): a carta mandada a um subagente
que para antes de recebê-la fica cinza "não entregue" e o relógio para, como na sessão destino
arquivada (`envios.destino-arquivado-nao-entregue`, decisão de 2026-11-12).

## 1. Causa

### Escrito no código do mod

- `hooks/tool-call.ts`, `sentMessage`, linhas 141 e 149-154: o `SendMessage` do loop principal cuja
  resposta diz "queued" grava em `sends` `{ to, anchor, at, text }` na fila. Nada liga o envio ao
  subagente: `to` é o id ou o nome que o modelo usou.
- `hooks/sessions.ts`, `watchSends` (110-193), é o único lugar em que um envio sai da fila (`taken`)
  ou vira não entregue (`lost` com `cut`). Ele só reconhece sessões:
  - linhas 124-126: `to` sem linha na lista de sessões do app e sem o prefixo `local_` dá `continue`;
  - linhas 169-170: a conferência de arquivamento exige uma linha da lista (`same.length === 0`, `continue`).
  Resultado: o envio a um subagente nunca fica entregue nem não entregue. Isso vale também quando ele
  recebe a mensagem: a carta a um subagente fica azul para sempre, receba ou não.
- `hooks/agents.ts`: `subEnd` (148-160, o fim pelo `turn.complete` do subagente: concluído, falhou,
  interrompido) e `checkSubs` (191-248, o cartão encerrado pela lista do app: processo reiniciado,
  agente parado sem o fim chegar, agente de workflow sem sinal) não olham os envios ao agente que
  termina. E `settleBySubs` (272-276, `busy`) conta o envio na fila: a tarefa de onde ele saiu nunca
  fecha pelo fim do subagente.
- Consequências, todas porque o envio segue `!taken && !cut`:
  - `hooks/sessions.ts:297` (`anyRunning`): o relógio de 1 s não para; o tempo da carta cresce sem fim;
  - `draw/layout.ts:1019-1025`: no fim do turno (normal ou Esc) a tarefa de origem é poupada e fica ◷,
    e o chip "aguardando sessão" conta a carta;
  - `hooks/tools.ts:169-171`: o `done` da tarefa avisa "ainda está na fila, sem confirmação de recebimento";
  - `draw/layout.ts:764` e `176`: a carta segura o pedido à vista.

### Escrito no motor (binário do app 2.1.321, lido com grep, só leitura)

- Subagente rodando: o `SendMessage` responde "Message queued for delivery to X at its next tool round.
  If it finishes first, it is resumed with the message and notifies again…". O "queued" casa com o
  `waitsDelivery` do mod.
- A mensagem fica nas pendentes do agente. Na rodada de ferramentas seguinte, o motor as drena: para
  cada uma chama `receiveAgentMessage`, a ponte de plugins (o `session.receive` com o `agentId` do
  subagente; uma resposta `consumed` tira a mensagem), e só então a vira anexo `queued_command` do
  pedido do subagente.
- Subagente que conclui com mensagem pendente: o motor a dá como encalhada e o retoma com ela. A
  retomada passa pelo `agent.spawn` com `resume` (a doc do tipo diz: "`prompt` is the resuming
  message"). Se a retomada falha ou é negada, o app mostra "Failed to deliver queued message to agent"
  e a mensagem é dada como não entregável.
- `SendMessage` a um subagente já concluído: o motor o retoma na hora ("Resuming agent X", sem
  "queued"). O mod já grava esse envio entregue na hora (verde): fica como está.
- `SendMessage` a um agente parado pela pessoa: responde "was stopped" e não entrega.
- Tipos (`claude-code/index.d.ts`): o `session.receive` tem `agentId` "the loop the delivery is for";
  "An agent's message raises `session.send` … then this with the receiver's inside its turn".
  `AgentInfo.name`: "What SendMessage addresses it by". `AgentSpawnInput.resume`: presente quando o run
  retoma um subagente.

### Dedução (não provado; vai ao checklist do app)

- Agente parado (Esc, TaskStop) ou que falhou não é retomado com as mensagens pendentes. No código, só a
  conclusão normal dispara a retomada da encalhada; a falha e a parada mudam o estado sem dispará-la.
  Esses são os casos "parado antes de receber".
- O `origin` do `session.receive` de main para o próprio subagente é `coordinator`, como a doc descreve.
- O harness despacha `$.session.receive(...)` e um `$.agent.spawn` com `resume`, como despacha os
  outros eventos (o kit ainda não usa nenhum dos dois).

## 2. O que muda

Comportamento novo no painel, para a carta (✉ "Para <subagente>: …") de um envio a um subagente desta
sessão:

- **Entregue** (verde, "entregue", sem tempo, fora do chip "aguardando sessão"): quando o subagente a
  recebe na rodada seguinte (o `session.receive` dele) ou quando o motor o retoma com ela depois de ele
  terminar primeiro (o `agent.spawn` de retomada). Hoje isso nunca acontece: é bug, corrigido pela regra
  que já existe (`envios.fica-ate-entrega`). Sem esse sinal não há como separar "parou antes de
  receber" de "parou depois de receber".
- **Não entregue** (cinza, "não entregue", sem tempo, fora do chip, relógio parado): quando o subagente
  termina sem recebê-la, de qualquer modo: Esc, TaskStop, falha, fim normal sem retomada, ou cartão
  encerrado pela conferência da lista do app (reinício, parada sem fim, workflow sem sinal). A marca vem
  pela releitura de 3 s, só depois de `SUB_CONFIRM` (3 s) do fim do cartão e com a lista do app sem o
  agente rodando. Motivo: num fim normal o motor retoma o subagente com a mensagem, e marcar na hora
  pintaria a carta de cinza e logo de verde (o checklist pede "nada pisca à toa"). É o mesmo "em poucos
  segundos" do destino arquivado. Recebida depois (retomada ou rodada), a carta volta a verde e o modelo
  é avisado da entrega, como no arquivado.
- **Modelo avisado uma vez** pelo `takenNote` (no lembrete da chamada seguinte do loop principal ou do
  próximo prompt), com texto próprio de subagente (os de hoje falam de "sessão arquivada" e "a sessão
  começou a tratar"). Os textos novos mantêm as expressões "mensagem não entregue" e "recebimento
  confirmado", que os testes procuram.

### A tarefa de origem (a que espera a confirmação para fechar)

- Na fila, nada muda: no fim do turno ou no Esc fica ◷; o `done` avisa de fila; a carta segura o pedido
  à vista.
- **Entregue:** o painel conclui a tarefa sozinho, como em qualquer entrega (`envios.fica-ate-entrega`),
  se ela está aberta, sem subtarefa aberta e **sem subagente lançado dela ainda rodando**
  (`subagentes.um-rodando-mantem-o-pai`). É o caso comum: o envio sai da tarefa que lançou o subagente,
  e esse subagente está vivo quando recebe. Nesse caso a tarefa fica como está, e o fim dele decide
  (`settleBySubs`, no fim do turno ou no fim do subagente depois do turno). Ver o ponto a confirmar na
  seção 10.
- **Não entregue:** a tarefa volta a ser comum, como em `envios.destino-arquivado-nao-entregue`:
  - com o turno em curso: segue em andamento; o `done` não avisa de fila;
  - concluída: segue ✓ e não segura o pedido à vista;
  - com o turno já terminado: `settleBySubs` roda logo após a marca, e a tarefa reflete o fim do subagente
    lançado dela (✕ "interrompida" no Esc ou TaskStop, ✕ "falhou", ✓ no fim normal), como em
    `subagentes.pai-conclui-no-fim-do-turno` e `subagentes.pai-reflete-falha-ou-interrupcao`;
  - depois de um Esc da principal: a tarefa já marcada `stopped` deixa de ser poupada e fica ✕, ou é
    fechada pelo `settleBySubs` conforme o fim do subagente;
  - sem subagente lançado dela (envio ancorado noutra tarefa): fica como qualquer tarefa aberta no fim
    do turno.

### Arquivos e funções

1. `types/index.d.ts` (núcleo): `Send` ganha `agent?: string`, o id do subagente desta sessão a que o
   envio foi. Atualizar o comentário do tipo: entregue pelo recebimento ou pela retomada; não entregue
   quando o subagente terminou sem recebê-la.
2. `hooks/tool-call.ts`, `sentMessage`:
   - para `to` sem o prefixo `local_`, resolver o subagente pela lista do motor (`$.agent.list()`,
     `id === to` ou `name === to`), excluído o teammate (`type === 'teammate'` ou com `teammateId`);
   - gravar `agent` no envio quando achar;
   - lista que falha ou lança: sem `agent`, como hoje (try/catch obrigatório: há testes sem stub de
     `agent.list`).
3. `hooks/agents.ts`:
   - função de entrega (ex.: `takeSubSend($, agentId, texto, porOrdem)`): entre os envios com
     `agent === agentId` ainda não `taken` (na fila ou não entregues), escolhe o primeiro cujo `text`
     (normalizado como em `sentMessage`) está contido no texto recebido, normalizado igual. Sem
     casamento e com `porOrdem`, escolhe o mais antigo. Marca entregue (`taken`, desfaz `cut`, `lost` e
     `noted`; sem `delivered`, para o modelo ser avisado). Fecha a tarefa de origem com a mesma edição de
     `watchSends` (`fillStarts` + `finish` + `settle`), só se ela está aberta, sem subtarefa aberta e
     sem grupo de subagente vivo ancorado nela (`subLive`, `parent` MAIN). Depois `publishPanel`.
   - `agentSpawn`: com `e.resume?.agentId`, antes do `return` antecipado que já existe, chama a entrega
     com o `prompt` da retomada e `porOrdem` ligado. O resto da retomada segue ignorado, como hoje.
   - função nova `strandedSends($)`, chamada por `refreshChildren` logo depois de `checkSubs`, antes da
     lista de sessões, porque não depende dela. Para cada envio com `agent`, nem `taken` nem `lost`,
     marca `cut` e `lost` quando:
     - o grupo do agente tem `sub` que não está vivo (`!subLive`);
     - já passou `SUB_CONFIRM` do fim (`sub.end`, senão `seen`, senão `at`);
     - a lista do motor não o mostra `running`, `pending`, `waiting` ou `idle` (lido só quando há
       candidato; lista que falha: não julga, como `checkSubs`).

     Sem grupo (agente sem cartão): não julga, como hoje. Com alguma marca: grava `sends`, roda
     `settleBySubs` se `turnEnded` é número, e `publishPanel`.
   - nova função de hook `agentReceive($, e, next)` (`session.receive`): primeiro `next(e)`; resposta
     `consumed`, ou `e.agentId` ausente: devolve a resposta e nada mais. Senão chama a entrega com
     `e.text` e `porOrdem` só quando `e.origin?.kind === 'coordinator'`. Devolve a resposta de `next`.
4. `hooks/register.tsx` (núcleo): `on('session.receive', agentReceive)`, sem filtro.
5. `hooks/sessions.ts`:
   - `refreshChildren`: chamar `strandedSends` depois de `checkSubs`;
   - `watchSends`: pular os envios com `agent` nos dois laços (linhas 122 e 163), para que uma sessão de
     mesmo nome não os confirme nem os dê por arquivados;
   - `takenNote`: separar entregues e não entregues de subagente (com `agent`) dos de sessão, cada grupo
     com o seu texto.
6. `text/rules.ts`:
   - `SESSION`: textos novos para subagente que recebeu e para subagente que parou sem receber,
     separados de `taken` e `lost` (estes seguem para sessões, sem mudar). O de recebimento diz que a
     tarefa do envio deixou de esperar e fecha sozinha, ou fecha com o fim do subagente lançado dela. O
     de não entregue diz que o subagente parou antes de receber e que a tarefa deve ser tratada como
     qualquer outra; se a mensagem ainda importa, mandar de novo (o motor retoma um subagente concluído).
   - `SEND.queued` fala de "sessão": opcional, variante de subagente ("o painel avisa quando ele a
     receber"). Se for feita, `sentMessage` escolhe pelo `agent`.

Fora do escopo (relatar, não corrigir aqui):
- o cartão do subagente retomado segue "concluído" enquanto ele roda de novo (`agentSpawn` ignora a
  retomada);
- o título da carta mostra o id cru quando o modelo endereça pelo id (`nameOf` só conhece sessões);
- teammates e agentes de workflow (sem `name` na lista) seguem como hoje.

## 3. Matriz de impacto

`npm run impacto -- task-tree/hooks/agents.ts task-tree/hooks/sessions.ts task-tree/hooks/tool-call.ts task-tree/hooks/register.tsx task-tree/types/index.d.ts task-tree/text/rules.ts`

- O núcleo é tocado (`hooks/register.tsx`, `types/index.d.ts`): todos os cenários cobertos, 160 na saída;
  o check roda todos.
- Sem o núcleo, só os quatro outros arquivos: 87 cenários, entre eles todos de `envios.*`,
  `subagentes.*`, `sessoes.*`, `lembretes.*`, `durabilidade.*` e `taxa.*`.
- Checklist do app afetado: `envios.destino-arquivado-no-app`, `subagentes.cartao-no-app`,
  `subagentes.lancados-juntos-no-app`, `subagentes.neto-no-app`, `subagentes.sem-fim-no-app` (e, pelo
  núcleo, os `visual.*`).
- Golden: pelo núcleo, os 4 desenhos. Nenhum deve mudar (ver a seção 7).
- Fora do mapa: nenhum.

## 4. Testes de verificação

Em `task-tree/tests/envios.test.ts` (a área), pelo kit. Um stub local de `SendMessage` responde o texto
do motor para subagente ("Message queued for delivery to sub-1 at its next tool round. If it finishes
first, it is resumed…", com `success` verdadeiro). O cenário usa `lancaveis(on, ['sub-1'])`, `pedido`,
`plan(A)`, `start(['1'])`, `lancar` e `envio($, 'sub-1', …)`. Para avançar a releitura:
`relogio.advance(3000)` e/ou `aviso($)` (o aviso também chama `refreshChildren`). O implementador prova
cada "falha hoje" rodando o teste contra `d3b1078`.

1. "a carta para um subagente parado com Esc antes de recebê-la fica cinza não entregue, sem tempo e
   fora do chip; o modelo é avisado uma vez; a tarefa fica interrompida". Cita
   `envios.subagente-parado-nao-entregue`.
   - Na fila: carta "fila" sob "Um", chip ✉ 1.
   - `esc($)`, `fimDoSubagenteCom(…, { parado: true })`, avança 3 s, `aviso`: carta "interrompida" (o
     cinza do kit), texto com "não entregue" e sem `\d:\d\d`, chip ✉ 0, "Um" "interrompida".
   - O aviso contém "mensagem não entregue"; o segundo aviso não.
   - Falha hoje: a carta segue "fila" com tempo, o chip segue 1 e "Um" segue ◷ "aguardando".
2. "carta para subagente que falha antes de recebê-la: não entregue, e o done da tarefa não avisa de
   fila". Cita o mesmo cenário.
   - `fimDoSubagenteCom(…, { erro: true })`, avança 3 s, `aviso`: carta cinza.
   - `done(['1'])` sem "na fila" na resposta; "Um" concluída.
   - Falha hoje: o `done` avisa "ainda está na fila" e a carta segue azul.
3. "subagente que termina antes da rodada seguinte e é retomado com a mensagem: a carta fica verde, sem
   passar por não entregue". Cita `envios.subagente-recebe-fica-verde`.
   - `fimDoSubagente`; logo depois, carta ainda "fila", não "interrompida": nada pisca.
   - Retomada (helper novo do kit) com o mesmo texto: carta "entregue".
   - Avança 6 s: segue "entregue"; o aviso contém "recebimento confirmado".
   - Falha hoje: segue "fila".
4. "subagente que termina sem ser retomado: depois da conferência a carta fica não entregue e a tarefa
   de onde ele saiu fecha pelo fim dele". Cita `envios.subagente-parado-nao-entregue`.
   - `fimDoSubagente`, `fimDoTurno`, avança 3 s duas vezes: carta cinza e "Um" "concluida" (o fim
     concluído do subagente, `settleBySubs`).
   - Falha hoje: carta azul e "Um" não fecha (`busy`).
5. "subagente parado sem o fim chegar (some da lista do app): o cartão fica interrompido e a carta não
   entregue". Cita `envios.subagente-parado-nao-entregue`.
   - `agent.list` local e mutável (como o `listaDoApp` de `subagentes.test.ts`), com `name` "revisor"
     para também cobrir o envio pelo nome: `envio($, 'revisor', …)`.
   - Tira o agente da lista; `fimDoTurno`; avança 3 s três vezes.
   - Cartão com "interrompido", carta cinza, "Um" "interrompida".
   - Falha hoje: carta azul (o cartão já fica interrompido hoje).
6. "o subagente recebe a mensagem na rodada seguinte: a carta fica verde; a tarefa de onde ela saiu
   conclui sozinha, e a que lançou o subagente espera o fim dele". Cita
   `envios.subagente-recebe-fica-verde`.
   - Plano com "Um" e "Dois": `start(['1'])`, `lancar`, depois `start(['2'])`, `envio` (vai a "Dois",
     o lote recente).
   - Recebimento pelo subagente (helper novo) com o mesmo texto: carta "entregue" sob "Dois", "Dois"
     "concluida", chip ✉ 0, aviso com "recebimento confirmado".
   - Num segundo envio, sob "Um" (com "Dois" já fechada), o recebimento deixa a carta verde e "Um"
     "andamento". `fimDoSubagente` e `fimDoTurno` deixam "Um" "concluida".
   - Falha hoje: as cartas seguem "fila" e "Dois" não conclui.

Testes existentes: nenhum muda. Nenhum teste de hoje manda mensagem a um subagente. Os envios a nomes
(`envios.test.ts:354`, `385`) não casam com a lista do motor: o `agent.list` de `lancaveis` não tem
`name`. O de 385 (lote com subagente) deve passar igual; o implementador confere.

Kit (selo novo, um por arquivo):
- `tests/kit/ambiente.ts`:
  - `fixar` ganha o eco de `session.receive`, que devolve `{ text: e.text }`, como o de `prompt.submit`;
  - `lancaveis` responde a uma retomada (`e.resume?.agentId`) com o próprio id, em vez do próximo da
    lista.
- `tests/kit/cenario.ts`:
  - `recebidaPeloSubagente($, agente, texto)`: `$.session.receive` com `agentId` e
    `origin: { kind: 'coordinator' }`;
  - `retomadaDoSubagente($, agente, texto)`: `$.agent.spawn` com `resume: { agentId }` e `prompt`.

Se o harness não despachar `session.receive`, relatar. A alternativa é o `prompt.attachment`
`queued_command` com `agentId`, que o motor cria na mesma drenagem: registrar com o filtro `{ type:
'queued_command' }`, casar pelo texto e devolver `next(e)`. Escolher só uma das duas.

## 5. Catálogo (`regras/envios.md`)

Novos, depois de `envios.destino-arquivado-no-app`:

- `envios.subagente-parado-nao-entregue`: "A carta para um subagente que para antes de recebê-la fica
  cinza, 'não entregue'."
  - Dado: uma tarefa com a carta dela na fila para um subagente desta sessão.
  - Quando: o subagente termina sem recebê-la (Esc, TaskStop, falha, fim sem ser retomado com ela, ou o
    cartão encerrado pela lista do app).
  - Então: em poucos segundos a carta fica cinza com "não entregue", sem tempo, e sai do chip
    "aguardando sessão". A tarefa volta a ser comum: no Esc fica ✕; o done não avisa de fila;
    concluída, não segura o pedido à vista; com o turno terminado, reflete o fim do subagente lançado
    dela. O modelo é avisado uma vez. Recebida depois (retomado com ela), fica verde e o modelo é
    avisado da entrega.
  - Origem: decisão do usuário, 2026-11-13 ("Cinza \"não entregue\" (Recomendado)"), à pendência "carta
    para subagente parado antes de receber"; aplica `envios.destino-arquivado-nao-entregue` ao subagente
    e limita `envios.fica-ate-entrega`, `envios.fila-nao-interrompe-no-fim-do-turno` e
    `envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila` à mensagem que ainda pode ser
    entregue.
  - Código: `hooks/agents.ts, text/rules.ts` (a área já traz `hooks/tool-call.ts` e `hooks/sessions.ts`).
  - Estado: coberto.
- `envios.subagente-recebe-fica-verde`: "A carta para um subagente fica verde quando ele a recebe."
  - Dado: uma tarefa com a carta dela na fila para um subagente.
  - Quando: ele a recebe na rodada seguinte de ferramentas, ou termina antes e o app o retoma com ela.
  - Então: a carta fica verde, "entregue", sem tempo e fora do chip. O painel conclui a tarefa de onde
    ela saiu, salvo se dela ainda roda um subagente: aí ela fecha com o fim dele. O modelo é avisado da
    entrega uma vez.
  - Origem: análise da pendência 1, 2026-11-14 (a entrega a um subagente nunca era conferida, e a carta
    ficava azul mesmo recebida); aplica `envios.fica-ate-entrega` ("na entrega, verde, e o painel
    conclui a tarefa que enviou") e `subagentes.um-rodando-mantem-o-pai`, sem mudar nenhuma delas.
  - Código: `hooks/agents.ts, text/rules.ts`.
  - Estado: coberto.
- `envios.subagente-no-app`: "No app, a carta para um subagente real fica verde ao ser recebida e cinza
  'não entregue' quando ele para antes."
  - Dado: uma mensagem na fila para um subagente real em segundo plano.
  - Quando: ele a recebe; noutra vez, é parado com TaskStop (ou Esc) antes da rodada seguinte; noutra,
    termina antes e é retomado.
  - Então: verde nos casos de recebimento e retomada, sem passar por cinza; cinza "não entregue" em
    poucos segundos no parado; nos dois temas, com o tempo parado.
  - Origem: a mesma decisão; o que o harness não alcança.
  - Estado: checklist (subagente real, o motor e o relógio de 1 s não rodam no harness).

Reescritos, todos sem mudar teste (texto: `Reescrito: 2026-11-13, decisão do usuário ("Cinza \"não
entregue\" (Recomendado)"); … Os testes deste cenário não mudam.`):
- `envios.fica-ate-entrega`: o Então cita também o subagente parado antes de recebê-la
  (`envios.subagente-parado-nao-entregue`).
- `envios.cor-por-estado`: o Quando acrescenta "ou o subagente parado antes de recebê-la".
- `envios.carta-sob-a-tarefa`: "não entregue" também quando o subagente para antes de recebê-la.
- `subagentes.um-rodando-mantem-o-pai`: a carta não entregue não segura a tarefa. É de outra área; o
  reescrito pode ficar só nos três de envios, se preferirem.

Selos:
- os seis testes novos, cada um com `npm run regras:selar -- "task-tree/tests/envios.test.ts::<nome
  exato>" --tipo novo --motivo "pendência 1: carta para subagente (decisão do usuário, 2026-11-13,
  Cinza \"não entregue\" (Recomendado))"`;
- o kit: `node scripts/selos.mjs --kit task-tree/tests/kit/ambiente.ts --tipo novo --motivo "kit:
  eco do session.receive; lancaveis responde a retomada"`;
- o kit: `node scripts/selos.mjs --kit task-tree/tests/kit/cenario.ts --tipo novo --motivo "kit:
  recebidaPeloSubagente, retomadaDoSubagente"`.

## 6. Documentação

- `task-tree/DESENVOLVIMENTO.md`:
  - tabela de hooks: linha nova `session.receive` → `agentReceive` (agents.ts);
  - linha do `agent.spawn`: a retomada entrega a carta pendente;
  - linha do `turn.complete` sem mudança;
  - na parte dos envios ✉: `Send.agent`; a entrega a subagente pelo recebimento ou pela retomada; o não
    entregue pela releitura (`strandedSends`, depois de `SUB_CONFIRM`, com o motivo da espera); o fecho
    da tarefa que respeita o subagente vivo;
  - os fatos do motor citados na seção 1.
- `CLAUDE.md`, checklist do app: no item "sessões filhas reais (cartão, ✉ e entrega, …)", acrescentar
  "carta a subagente real (recebida, parado antes de receber, retomado)".

## 7. Golden

Não muda. O desenho de carta cinza "não entregue" já existe (cenário arquivado), e os 4 cenários do
golden não mandam mensagem a subagente. Se `golden.test.ts` falhar, é regressão: corrigir, não aprovar.

## 8. Checklist do app (o que o harness não vê)

- Um subagente real em segundo plano recebendo um `SendMessage` e, na rodada seguinte, a carta verde.
- TaskStop (e, noutra vez, Esc) antes da rodada seguinte: em poucos segundos, cinza "não entregue", nos
  dois temas, o tempo parado, o chip ✉ apagado. A tarefa de origem fica ✕ ou ✓ conforme o fim.
- Subagente que termina antes da rodada e é retomado com a mensagem: verde, sem pintar de cinza antes.
- Isso confirma as deduções da seção 1: o `session.receive` com `agentId` na drenagem e a retomada pelo
  `agent.spawn`.

## 9. Riscos e interações

- Núcleo tocado: o check roda tudo. A `regressao` (testes de `HEAD` contra o código novo) deve passar
  sem decisão: nenhum teste antigo muda.
- O `session.receive` passa a ser interceptado em toda entrega, inclusive as mensagens de outras
  sessões ao loop principal. O hook sempre devolve a resposta de `next(e)` e não faz nada sem
  `agentId`. Ele roda dentro do turno do subagente: não pode esperar `$.prompt.submit`.
- Um `$.agent.list()` a mais por `SendMessage` que não é a uma sessão, com try/catch.
- O casamento pelo texto evita confirmar o envio errado quando dois envios ao mesmo subagente estão na
  fila, ou quando uma mensagem de outro subagente chega a ele (sem texto igual e com `origin` diferente
  de `coordinator`, não confirma).
- A espera de `SUB_CONFIRM` deixa a carta azul, com o tempo correndo, por 3 a 6 s depois do fim.
  Alternativa (não recomendada): marcar na hora no Esc e na falha, e esperar só no fim normal.
- Ordem com os outros itens: este vem primeiro. O item 2 (histórico e aviso) mexe no corte do desenho
  (`render.tsx`/`layout.ts`), não nos envios. O item 3 já está em `d3b1078` e mexeu nas `RULES` de
  `text/rules.ts`; este acrescenta só em `SESSION`/`SEND`. Sem conflito de arquivo além de
  `text/rules.ts`, em trechos diferentes.
- Editar de uma vez (scratchpad e cópia junta): `types`, `tool-call`, `agents`, `sessions`, `register`
  e `rules` se referem entre si; um estado parcial quebra a recarga.

## 10. Ponto a confirmar (não bloqueia)

O fecho na entrega combina duas decisões: `envios.fica-ate-entrega` ("na entrega … o painel conclui a
tarefa que enviou") e `subagentes.um-rodando-mantem-o-pai` ("com um subagente ainda rodando, a tarefa de
onde saiu não fecha"). No caso comum (o envio sai da tarefa que lançou o subagente), as duas se
cruzam. O plano segue a opção A, que não desfaz nenhuma. Se a orquestradora quiser a palavra do
usuário:

Pergunta: "Quando um subagente recebe a mensagem mandada da mesma tarefa que o lançou, a tarefa…"
- A, "Espera o fim do subagente (Recomendado)": a carta fica verde e a tarefa fecha com o fim do
  subagente, como hoje sem carta.
- B, "Fecha na entrega": a carta fica verde e a tarefa é concluída na hora, com o subagente ainda
  rodando sob ela.
