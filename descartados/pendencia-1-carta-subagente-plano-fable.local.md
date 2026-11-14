# Pendência 1: carta para subagente parado antes de receber (plano)

Planejador, 2026-11-14. Só leitura do repositório (`fix/pendencias-auditoria`, ponta `1f9e8c1`).
Decisão do usuário, 2026-11-13: "Cinza \"não entregue\" (Recomendado)".

Resumo: plano pronto, sem bloqueio. Arquivos do mod que a mudança toca: `types/index.d.ts`,
`hooks/agents.ts`, `hooks/tool-call.ts`, `hooks/turn.ts`, `hooks/sessions.ts`, `text/rules.ts`.
Nenhum hook novo, nenhuma mudança de desenho, golden intacto. Há dois pontos para a orquestradora
conferir, no fim (seção 10): não contrariam decisão registrada, mas vale o usuário saber.

## 1. Causa confirmada

### O que está escrito no código

- Toda mensagem do loop principal que não falha vira um registro de envio, seja qual for o destino:
  `sentMessage`, `hooks/tool-call.ts:102-163`. O resultado com "queued", "held" ou "pending" e sem
  "turn has started" fica sem `taken`, isto é, carta azul "na fila" (linha 141 e linhas 149-154). Nada
  ali distingue sessão de subagente.
- Só um lugar muda um envio para entregue ou não entregue: `watchSends`,
  `hooks/sessions.ts:110-193`. Ele só conhece sessões:
  - entrega: procura o destino na lista de sessões do app, ou aceita um id que comece com `local_`;
    fora disso pula o envio (`sessions.ts:124-126`, o `continue` da linha 126). O id ou o nome de um
    subagente nunca passa;
  - não entregue: exige o destino na lista de sessões, arquivado (`sessions.ts:163-174`; a linha 170
    pula quem não está na lista).
- O fim de um subagente tem dois caminhos, e nenhum olha os envios: `subEnd`
  (`hooks/agents.ts:148-160`, chamado pelo `turn.complete` dele em `hooks/turn.ts:171-181`) e
  `checkSubs` (`hooks/agents.ts:191-248`: o cartão vivo que o app deixou de listar, ou lista como
  terminado, e o agente de workflow sem sinal há 30 minutos).
- Não há outra saída: o replano guarda o envio ainda não tomado (`hooks/tools.ts:110-113`), e só o
  `/clear` esvazia a lista (`hooks/session-start.ts:75`). Os envios vão ao store (linha `sends` de
  `state/durability.ts:59`), então a carta azul sobrevive ao reinício.
- Enquanto o envio está sem `taken` e sem `cut`, ele segura:
  - o relógio de 1 s do painel, que redesenha para sempre (`anyRunning`, `sessions.ts:297`);
  - o tempo de espera na linha da carta (`draw/layout.ts:1345`) e o chip "aguardando sessão"
    (`layout.ts:1025`);
  - a tarefa de origem: fica ◷ no fim do turno e no Esc (`layout.ts:1019`), não fecha pelo fim dos
    subagentes (`busy`, `agents.ts:272-276`), o `done` dela avisa de carta na fila
    (`tools.ts:169`) e o pedido dela fica à vista (`layout.ts:764`).

Conclusão escrita: para um destino que é subagente, a carta na fila não tem caminho para verde nem
para cinza. O defeito é maior que o descrito no item: ela fica azul para sempre também quando o
subagente recebe a mensagem. Por isso a correção precisa das duas saídas (seção 2): sem saber quando o
subagente recebeu, marcar "não entregue" no fim dele seria falso na maioria dos casos.

### O que é dedução (não dá para provar lendo o repositório)

Vem dos tipos gerados do motor (`task-tree/.claude-plugin/types/claude-code/index.d.ts`, ignorado pelo
git) e do relato do usuário:

- O resultado do `SendMessage` a um subagente rodando diz que a mensagem ficou na fila (casa com
  "queued"). O relato do usuário, carta azul, confirma indiretamente.
- O destino vem como o id do agente ou como o nome dele: `AgentInfo.name`, "What SendMessage addresses
  it by" (tipos, linhas 176-183). O id é o mesmo dos eventos do subagente e de `$.agent.list()`.
- O subagente lê a mensagem na próxima rodada de ferramentas dele, isto é, ela vai no pedido seguinte
  dele ao modelo. O `session.receive` não serve de sinal: dispara quando a mensagem entra na fila do
  destino, não quando é lida ("Delivered means queued at the recipient... never read", tipos, linhas
  12727-12735).
- Mensagem a um subagente já terminado: o motor o retoma com ela (tipos, linhas 12640-12647; e
  `AgentStatus`, linhas 558-566). Fica fora deste item (seção 9).

## 2. O que muda

Sem código aqui: o que cada parte passa a fazer.

### 2.1 O envio sabe que o destino é um subagente

- `types/index.d.ts`, tipo `Send`: campo opcional novo com o id do subagente destino. Ausente quando o
  destino é sessão, e nos envios gravados por versões anteriores.
- `hooks/agents.ts`: função nova, exportada, que resolve o destino de uma mensagem para o id de um
  subagente desta sessão com cartão vivo (`subLive`), ou nada. Ordem:
  1. destino que é sessão (começa com `local_`, ou é id ou nome de uma sessão aberta por esta) não é
     subagente; não consulta mais nada. Em colisão de nome, a sessão vence, como hoje;
  2. destino igual ao id de um grupo com cartão vivo: é ele;
  3. só se existe algum cartão vivo: `$.agent.list()` dentro de try/catch; uma única entrada com
     `name` igual ao destino, que não seja teammate e cujo id tenha cartão vivo: é ela. Lista em erro,
     nenhuma ou mais de uma: nada.
  A lista só é consultada com cartão vivo de propósito: os testes de envio de hoje mandam para nomes
  ("analise-plano", "hora-extra"…) sem stub de `agent.list`, e não podem mudar.
- `hooks/tool-call.ts`, `sentMessage`: ao gravar o envio (linhas 149-154), grava também o subagente
  resolvido. O resto fica igual (âncora, texto, entrega imediata, aviso de fila).
- O campo só é gravado com o cartão vivo na hora do envio. Assim, envio com esse campo e cartão
  terminado quer dizer sempre "o subagente terminou depois do envio".

### 2.2 Entrega: o subagente faz um pedido ao modelo com a carta ainda na fila

- `hooks/turn.ts`, `turnStep`: no passo de um subagente, antes de repassar o passo (`next`), chama uma
  função nova de `hooks/agents.ts`. Falha dela não pode quebrar o passo (catch).
- A função nova marca como tomado todo envio ainda não tomado cujo subagente é esse. Se o envio estava
  "não entregue", volta atrás como o caso da sessão arquivada (`sessions.ts:165-167`): tira `cut` e
  `lost`, e o modelo é avisado da entrega.
- Tarefa de origem na entrega: o painel a conclui como em qualquer entrega (mesma regra de
  `sessions.ts:177-192`: folha aberta, sem filha aberta), menos quando há subagente ainda vivo ancorado
  nela. Nesse caso ela segue aberta e fecha pela regra dos subagentes, quando o último terminar
  (`settleBySubs`). É a soma de duas regras registradas, sem mudar nenhuma:
  envios.fica-ate-entrega ("na entrega, verde, e o painel conclui a tarefa que enviou") e
  subagentes.um-rodando-mantem-o-pai ("a tarefa não fecha… até o último terminar (e a carta ser
  entregue)").
- Depois de marcar: publicar o painel (`publishPanel`, que também grava os envios no store), como o
  `sentMessage` já faz.
- Custo: uma leitura do state dos envios por passo de subagente; sai cedo sem envio pendente para ele.

Por que esse sinal: o `turn.step` do subagente já chega ao mod e já foi validado no app (modelo,
esforço e toks/s do cartão vêm dele). A alternativa exata seria o anexo `queued_command` com o id do
subagente em `prompt.attachment`, mas não há prova de que o motor o emite para mensagem a subagente; se
não emitir, toda carta terminaria "não entregue". O erro possível do sinal escolhido é pequeno e raro
(seção 9).

### 2.3 Não entregue: o cartão do subagente destino termina com a carta ainda na fila

- `hooks/agents.ts`: função nova de reconciliação, pelo estado e não pelo evento. Para cada envio com
  subagente destino, não tomado e ainda não marcado, cujo cartão existe e não está vivo: marca `cut` e
  `lost`, os mesmos campos da sessão arquivada. Se marcou algum: publica o painel; e, com o turno
  desta sessão terminado, roda `settleBySubs`, para a tarefa de origem refletir o fim na mesma passada.
- Chamada em três pontos, para cobrir todos os modos de parar sem receber:
  1. `subEnd`, depois de gravar o fim do cartão e antes do `settleBySubs` que já existe ali: cobre o
     fim normal, a falha e a parada (TaskStop, Esc) quando o `turn.complete` do subagente chega;
  2. `checkSubs`, depois de aplicar os fins e antes do `settleBySubs` dali: cobre o fim que não chega
     (o app parou o subagente, reinício do app, `/model`, retomada) e o agente de workflow sem sinal;
  3. `refreshChildren` (`hooks/sessions.ts:38`), logo depois do `checkSubs`, a cada releitura de 3 s:
     rede de segurança para a corrida entre o fim do subagente e a gravação do envio, e para o estado
     que volta do store. Sai cedo sem envio pendente.
- Sem mudança no desenho: `lost` já desenha cinza "não entregue", sem tempo (`layout.ts:1334-1345`), e
  `cut` já tira a carta do relógio (`sessions.ts:297`), do chip (`layout.ts:1025`), da espera da tarefa
  (`layout.ts:1019`), do `busy` (`agents.ts:276`), do aviso do `done` (`tools.ts:169`) e do que segura
  o pedido à vista (`layout.ts:764`).

### 2.4 A tarefa de origem (o que o item pediu para dizer)

Com a carta "não entregue", a tarefa volta a ser comum, como em envios.destino-arquivado-nao-entregue,
e passa a valer a regra dos subagentes que já existe:

- turno em curso: segue como está (◉); o `done` dela não avisa de carta na fila; no Esc fica ✕ como
  qualquer outra;
- turno terminado, tarefa com subagentes, todos terminados e nada mais rodando nela: reflete o fim
  deles (subagentes.pai-reflete-falha-ou-interrupcao e subagentes.pai-conclui-no-fim-do-turno):
  ✕ "interrompida" se o subagente foi parado, ✕ "falhou" se falhou, ✓ se terminou normalmente sem ler
  a mensagem. Hoje ela fica ◷ para sempre;
- tarefa sem subagente (a carta foi para outra tarefa que a do cartão): segue ◷ "aguardando" como
  qualquer iniciada no fim do turno, até o `done` do modelo; não segura mais o pedido depois de
  concluída;
- o modelo é avisado uma vez.

### 2.5 Textos ao modelo (`text/rules.ts`) e `takenNote` (`hooks/sessions.ts:196-214`)

- `takenNote` separa os envios a subagente dos envios a sessão, nas duas listas (tomados e não
  entregues), e usa textos próprios. Os de sessão não mudam.
- Texto novo, não entregue a subagente. Precisa dizer: começa com "mensagem não entregue" (a mesma
  frase do texto de sessão, que os testes procuram); o subagente terminou ou foi parado antes de
  recebê-la; destino e tarefa do envio; a tarefa deixou de esperar por ela e é tratada como qualquer
  outra.
- Texto novo, entrega a subagente. Precisa dizer: "recebimento confirmado"; o subagente começou a
  tratar a mensagem; destino e tarefa do envio; a tarefa deixou de esperar a entrega, e o painel a
  conclui quando nenhum subagente dela estiver rodando (na hora, se não há nenhum); se ainda tinha algo
  a fazer, reabrir com `mcp__task-tree__start`. Tem de valer nos dois casos de 2.2.
- `SEND.queued` e o parágrafo de `RULES` sobre a carta seguem falando em "sessão". Fora do item.

## 3. Matriz de impacto

`npm run impacto -- task-tree/hooks/agents.ts task-tree/hooks/tool-call.ts task-tree/hooks/turn.ts
task-tree/hooks/sessions.ts task-tree/text/rules.ts task-tree/types/index.d.ts`:

- `types/index.d.ts` é núcleo: "todos os cenários cobertos" (161 afetados). A mudança ali é um campo
  opcional num tipo.
- Sem o arquivo de tipos: 108 cenários (102 cobertos), nas áreas envios, subagentes, sessões, pedidos,
  turnos, lembretes, perguntas, durabilidade, taxa e ultracode.
- Checklist do app: envios.destino-arquivado-no-app, subagentes.cartao-no-app,
  subagentes.lancados-juntos-no-app, subagentes.neto-no-app, subagentes.sem-fim-no-app,
  ultracode.cor-e-corte (com o núcleo, a matriz lista também cabecalho.aviso-de-painel-grande-volta,
  visual.largura-real e visual.clique, que esta mudança não toca).
- Golden: com o núcleo a matriz lista os 4 cenários; sem ele, "nenhum cenário". O desenho não muda
  (seção 7).
- Fora do mapa: nenhum.

## 4. Testes

Todos novos, em `task-tree/tests/envios.test.ts`, pelo kit que já existe (`lancaveis`, `lancar` com
`segundoPlano`, `envio`, `responderEnvio` em modo fila, `passos` com `agente`, `fimDoSubagente`,
`fimDoSubagenteCom`, `fimDoTurno`, `esc`, `aviso`, `cartaSob`, `cabecalho`). O kit não muda (nenhum selo
de kit). Os imports do arquivo crescem; o selo não conta imports (`scripts/selos.mjs:53`).

Cuidado com os selos: não alterar nenhuma declaração de topo que já existe nos arquivos de teste (`A`,
`cartaDe`, `NAO_ENTREGUE`, `contexto`, e em `subagentes.test.ts` `listaDoApp`, `listado`): elas entram
no hash dos testes que as usam. Helper novo ganha nome novo, que nenhum teste existente use.

Roteiro comum: `fixar`, `host(on, [])`, `lancaveis(on, ['sub-1'])`, `responderEnvio`; pedido, plano `A`,
`start` em "Um", `lancar` em segundo plano, `envio($, 'sub-1', …)`.

1. **"carta a subagente parado antes de receber: cinza não entregue, sem tempo e fora do chip; o modelo
   é avisado uma vez"**. Cita envios.subagente-parado-nao-entregue. Afirma: depois do envio, carta
   "fila" com "na fila" e chip de sessão 1; depois de `fimDoSubagenteCom` parado, carta cinza
   (`'interrompida'` no kit) com "não entregue", sem tempo (`/\d:\d\d/`), chip 0, "Um" segue em
   andamento e no total; o `aviso` seguinte traz "mensagem não entregue" e fala em subagente; o
   segundo `aviso` não traz. Falha hoje: a carta segue "fila" depois do fim (`sessions.ts:126` e 170).

2. **"fim normal e falha do subagente sem receber: a carta também fica não entregue"**. Cita
   envios.subagente-parado-nao-entregue. Dois subagentes, duas tarefas, uma carta para cada; um termina
   com `fimDoSubagente`, o outro com `fimDoSubagenteCom` erro. Afirma as duas cartas cinza "não
   entregue". Falha hoje: as duas seguem "fila".

3. **"o fim do subagente que não chega ao painel: a lista de agentes do app encerra o cartão e a carta
   fica não entregue"**. Cita envios.subagente-parado-nao-entregue e
   subagentes.sem-fim-vira-interrompido. Stub próprio de `agent.spawn` e `agent.list` com lista
   mutável (helper novo no arquivo). Subagente listado como rodando, envio; a lista passa a dizê-lo
   `killed` (e, num segundo subagente, deixa de listá-lo); duas releituras de 3 s. Afirma os cartões
   "interrompido" e as cartas cinza "não entregue". Falha hoje: cartas "fila".

4. **"com o turno terminado, a tarefa de origem reflete o fim do subagente que não recebeu"**. Cita
   envios.subagente-parado-nao-entregue, subagentes.pai-reflete-falha-ou-interrupcao e
   subagentes.pai-conclui-no-fim-do-turno. Três tarefas, três subagentes em segundo plano, três
   cartas; `fimDoTurno` com as cartas na fila (as tarefas ◷ "aguardando"); depois um parado, um com
   erro, um normal. Afirma: três cartas cinza; tarefas ✕ com "interrompida", ✕ com "falhou" e ✓.
   Falha hoje: as três seguem ◷ com carta azul (`agents.ts:276`).

5. **"o subagente que recebe a mensagem: carta verde; a tarefa segue aberta enquanto ele trabalha e
   fecha quando ele termina"**. Cita envios.entrega-a-subagente e subagentes.um-rodando-mantem-o-pai.
   Depois do envio, um passo do subagente (`passos`, `agente: 'sub-1'`). Afirma: carta "entregue",
   chip 0, "Um" não concluída; o `aviso` traz "recebimento confirmado" e não traz "mensagem não
   entregue"; `fimDoTurno` não a fecha; `fimDoSubagente` a deixa ✓ e a carta segue verde, nunca "não
   entregue". Falha hoje: a carta segue "fila" depois do passo, e a tarefa nunca fecha.

6. **"carta a subagente sob outra tarefa: na entrega o painel conclui a tarefa do envio"**. Cita
   envios.entrega-a-subagente. `start` em "Um", `lancar`, `done` em "Um", `start` em "Dois", envio ao
   subagente (a carta vai sob "Dois"); passo do subagente. Afirma: carta sob "Dois" verde, "Dois" ✓, e
   o `aviso` com "recebimento confirmado". Falha hoje: carta "fila", "Dois" aberta.

7. **"mensagem pelo nome do subagente: recebida fica verde; parado antes, não entregue"**. Cita
   envios.entrega-a-subagente e envios.subagente-parado-nao-entregue. Stub próprio de `agent.list` com
   `name` nas entradas; dois subagentes nomeados, duas tarefas; envio pelo nome a cada um; um dá um
   passo, o outro é parado. Afirma uma carta verde e uma cinza. Falha hoje: as duas "fila".

8. **"não entregue e depois tomada: fica verde e o modelo é avisado da entrega"**. Cita
   envios.subagente-parado-nao-entregue. Subagente parado com a carta na fila (cinza); depois um passo
   dele (o motor o retomou). Afirma carta verde, sem "não entregue", e o `aviso` com "recebimento
   confirmado". Falha hoje: carta "fila" o tempo todo.

9. **Guarda (passa hoje, e tem de seguir passando): "carta a subagente vivo segue na fila"**. Cita
   envios.fica-ate-entrega. Subagente listado como rodando, envio, três releituras de 3 s, sem passo
   dele. Afirma carta "fila" e o tempo de espera na linha. Protege contra a correção dar por perdido
   um subagente vivo.

Testes existentes que mudam: nenhum. Conferido: os envios de hoje vão a `local_…` ou a nomes sem
cartão de subagente vivo (não consultam `agent.list`); o único teste que mistura carta e subagente
("com uma carta na fila na mesma tarefa, o subagente concluído não a fecha", `subagentes.test.ts:241`)
manda para sessão; o passo de subagente de `taxa.test.ts:52` não tem envio.

## 5. Catálogo (`regras/envios.md`, `regras/subagentes.md`)

### Cenários novos

- `envios.subagente-parado-nao-entregue`: "A carta cujo subagente destino termina antes de recebê-la
  fica cinza, 'não entregue'."
  - Dado uma tarefa com a carta dela na fila para um subagente desta sessão.
  - Quando o subagente termina sem fazer outro pedido ao modelo: parado (TaskStop, Esc), fim normal,
    falha, ou o fim não chega e a lista de agentes do app encerra o cartão.
  - Então a carta fica cinza com "não entregue", sem tempo, e sai do chip "aguardando sessão"; a
    tarefa volta a ser comum e, com o turno terminado e nada mais rodando nela, reflete o fim dos
    subagentes; o modelo é avisado uma vez; tomada mesmo assim, fica verde e o modelo é avisado.
  - Fora deste cenário: teammates; mensagem a subagente já terminado; cartas a subagente gravadas por
    versão anterior.
  - Origem: decisão do usuário, 2026-11-13 ("Cinza \"não entregue\" (Recomendado)"), como
    envios.destino-arquivado-nao-entregue (2026-11-12); aplica
    subagentes.pai-reflete-falha-ou-interrupcao e subagentes.pai-conclui-no-fim-do-turno.
  - Código: hooks/agents.ts, hooks/turn.ts, text/rules.ts, draw/layout.ts, draw/svg.ts, draw/icons.ts.
  - Estado: coberto.
- `envios.entrega-a-subagente`: "A carta para um subagente fica verde quando ele faz o pedido seguinte
  ao modelo."
  - Dado uma carta na fila para um subagente desta sessão; quando ele faz um pedido ao modelo depois
    do envio; então a carta fica verde, sai do chip, o modelo é avisado, e o painel conclui a tarefa do
    envio, salvo com subagente ainda rodando nela, quando ela fecha ao último terminar.
  - Origem: pendência 1 (2026-11-13; carta a subagente sem saída); aplica envios.fica-ate-entrega e
    subagentes.um-rodando-mantem-o-pai, sem mudar nenhuma.
  - Código: hooks/agents.ts, hooks/turn.ts, text/rules.ts. Estado: coberto.
- `envios.subagente-parado-no-app`: o que o harness não alcança (seção 8). Origem: a mesma decisão de
  2026-11-13. Estado: checklist (subagente real parado no app; o relógio de 1 s e a pintura não rodam
  no harness).

### Cenários reescritos (linha `Reescrito: 2026-11-13, decisão do usuário ("Cinza \"não entregue\" (Recomendado)")`; "os testes deste cenário não mudam")

- `envios.fica-ate-entrega`, `envios.cor-por-estado`, `envios.carta-sob-a-tarefa`: onde dizem "se a
  sessão destino for arquivada", acrescentar o subagente destino que termina antes de receber.
- `subagentes.um-rodando-mantem-o-pai`: "(e a carta ser entregue)" passa a "(e a carta ser entregue ou
  dada como não entregue)".
- Descrição da área em `regras/envios.md`: "As mensagens a outras sessões e a subagentes (✉)."

### Selos (depois de escrever os testes; a chave é `arquivo::nome`, com o nome final de cada teste)

Um por teste novo, por exemplo:

    npm run regras:selar -- "task-tree/tests/envios.test.ts::carta a subagente parado antes de receber: cinza não entregue, sem tempo e fora do chip; o modelo é avisado uma vez" --tipo novo --motivo "pendência 1: carta a subagente parado, decisão de 2026-11-13"

Ou os nove de uma vez: `node scripts/selos.mjs --novos --motivo "pendência 1: carta a subagente
parado, decisão de 2026-11-13"`. Nenhum selo `decisao` nem `refatoracao`.

## 6. Documentação

- `task-tree/DESENVOLVIMENTO.md`:
  - tabela "Os 14 hooks": a linha de `turn.step` ganha "confirma a carta a subagente";
  - "Fluxo de dados" e o item "Mensagens a outras sessões" (perto da linha 1386): o campo novo do
    envio, a entrega pelo passo do subagente, a não entrega pelo fim do cartão e os três pontos de
    chamada;
  - "O que só é verificável no app": os itens da seção 8.
- `CLAUDE.md`, checklist do app: uma linha em "sessões filhas reais…" para a carta a subagente real.
- Comentário do tipo `Send` em `types/index.d.ts`.

## 7. Golden

Não muda. Os cenários "envios" e "subagente" de `tests/golden.test.ts` não têm carta para subagente
(os envios vão a `local_x`), e nenhum arquivo de `draw/` é tocado. Se o check acusar "o desenho de …
mudou", é regressão da implementação, não aprovação a pedir.

## 8. Checklist do app (o harness não vê)

Com um subagente real em segundo plano preso numa chamada longa (um `sleep` de 2 minutos, por exemplo):

1. Mandar uma mensagem a ele: a carta aparece azul "na fila" com o tempo correndo. Confirma que o
   resultado real do `SendMessage` a subagente casa com "na fila".
2. Deixá-lo seguir: no pedido seguinte dele ao modelo a carta fica verde "entregue", e a tarefa segue
   aberta até ele terminar.
3. Repetir e pará-lo (TaskStop) antes de a chamada longa acabar: em instantes (até uns 6 s, se o fim
   não chegar ao painel) a carta fica cinza "não entregue", nos dois temas, e o tempo para de contar.
4. Com o turno terminado, a tarefa de origem reflete o fim do subagente (✕ "interrompida").
5. Mandar a mensagem pelo nome do subagente, se o modelo usar nome.
6. O aviso ao modelo aparece uma vez só.

## 9. Riscos e limites

- **Sinal de entrega aproximado.** Erra em dois casos raros: (a) mensagem enviada antes do primeiro
  pedido do subagente, e ele termina sem rodada de ferramentas: aparece "entregue" sem ter lido;
  (b) o subagente lê a mensagem nos milissegundos entre o motor enfileirar e o mod gravar o envio, e
  esse era o último pedido dele: aparece "não entregue" tendo lido. Qualquer pedido seguinte corrige (b).
- **Se o motor não entregar na rodada seguinte** (dedução da seção 1), o item 2 do checklist mostra.
- **Fora do item, segue como hoje:** mensagem a teammate; mensagem a subagente já terminado (o motor o
  retoma; o cartão não revive, `agents.ts:67`); a linha da carta mostra o id cru do subagente em "Para
  …"; `SEND.queued` e `RULES` falam em "sessão".
- **Cartas a subagente já presas em sessões abertas** não se curam: não têm o campo novo, e não dá para
  saber se o subagente estava vivo no envio. Saem com `/clear`.
- **Não entregue e depois tomada**: se o modelo reenviar e o motor retomar o subagente, o primeiro
  passo dele marca também a carta antiga como entregue, sem prova de que a antiga foi lida.
- **Recarga a quente**: mudança em seis arquivos; escrever numa cópia no scratchpad e copiar tudo
  junto, com `npm run check` antes do commit.
- **Store**: publicar depois de marcar. O merge dos envios é união por conteúdo
  (`state/durability.ts:139-144`); sem gravar, um reinício pode trazer de volta a cópia azul.
- **Interação com os outros itens** (histórico e aviso; frase do lembrete): arquivos diferentes
  (`draw/`, `hooks/render.tsx`, lembretes do `prompt.submit`). O único ponto comum é `text/rules.ts`:
  este item só acrescenta dois textos em `SESSION`, sem tocar `PROMPT`.

## 10. Bloqueio

Nenhum ponto contraria decisão registrada. Dois pontos para a orquestradora conferir, se quiser levar
ao usuário antes de implementar:

1. **A correção inclui a entrega, que o item não citava.** Sem ela, "não entregue" seria falso sempre
   que o subagente lesse a mensagem e terminasse depois. Aplica envios.fica-ate-entrega; é correção de
   bug, sem decisão nova.
2. **Tarefa de origem na entrega a um subagente que ainda roda nela.** O plano junta as duas regras
   registradas: a carta fica verde e a tarefa só fecha quando o último subagente dela termina. Se o
   usuário preferir outra coisa, a pergunta é: "Quando o subagente recebe a mensagem e ainda está
   rodando na tarefa de onde ela saiu, o painel:" com as opções "mantém a tarefa aberta até o
   subagente terminar (Recomendado)" e "conclui a tarefa na hora, como na entrega a uma sessão".
   Troca um trecho da função de entrega e as afirmações do teste 5.

Commit sugerido: `fix(task-tree): carta a subagente parado antes de receber fica cinza "não entregue"`.
