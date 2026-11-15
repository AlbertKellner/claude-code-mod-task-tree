// The texts the mod hands the model: the panel's rules in the system prompt, the tools' and the
// command's descriptions, the reminders prompt.submit adds to each prompt, the warnings in the
// results of done, wrap_up and the other tool calls, and the notes about sessions this one opened.
// All in one place, so what the model reads about the same thing is said once: the limit of the ↩
// summary (BRIEF) is interpolated here, in every text that names it. Pure strings and functions of
// strings; the hooks module imports them. The tests read them by their effect (tests/lembretes.test.ts
// and the others), not letter by letter. Each text has a scenario in the catalog (regras/) that says
// when it goes out, with a test of when and of its essential words; changing when a text goes out
// changes a rule (a decision of the person), its wording stays free.

// The ↩ line says the answer in at most BRIEF characters: it is done's `summary`, and a request with
// none has no ↩ line (see brief in the hooks).
export const BRIEF = 120
const LIMIT = `até ${BRIEF} caracteres`
const EXAMPLE = '(ex.: "Commit 946f653 no PR #5; 151 testes ok")'
// How to redo a closed parent, said the same in the rules, in start's description and in its refusal.
const REDO_PARENT = 'para refazer um pai concluído, chame start nas subtarefas a refazer (isso reabre os pais), ou replaneje com ids novos'

// The panel's rules, added to the system prompt of every request that offers its tools,
// so the mod behaves the same on any machine with nothing in CLAUDE.md.
export const RULES = [
  '# Painel de tarefas (task-tree)',
  '',
  'O usuário acompanha o trabalho num painel lateral de tarefas. Regras:',
  '',
  '- Todo pedido abre pelo menos uma tarefa no painel, mesmo uma pergunta simples ou respondida só com ' +
    'pesquisa ou leitura de arquivos. Se a mensagem conclui ou substitui tarefas ainda abertas (por exemplo, ' +
    'a da pergunta que ela responde), feche-as primeiro com mcp__task-tree__done (as substituídas, com ' +
    '`cancel`); depois disso, a primeira chamada de ferramenta é mcp__task-tree__plan com a árvore ' +
    'de tarefas: até 3 níveis (nível 1 genérico, nível 3 mais granular), ids únicos dentro do plano ' +
    '("1", "1.2", "1.2.3"). Uma tarefa basta para um pedido simples.',
  '- Abaixo do nível 1 os ids ganham o id dele como prefixo ("D/1.2"). done e start aceitam o id curto ' +
    'quando não é ambíguo (preferem a tarefa aberta) ou o completo, e avisam no resultado ids ' +
    'inexistentes, ambíguos ou de outro agente.',
  '- No primeiro plan de cada mensagem do usuário, passe em `request` um título curto do que foi pedido: ' +
    'no painel, as tarefas de nível 1 ficam agrupadas pela mensagem em que foram planejadas, com esse título. ' +
    'O título do pedido é o do primeiro plan: um `request` em outro plan da mesma mensagem não o troca.',
  '- Etapa por etapa, no momento em que acontece: mcp__task-tree__start ao começar cada tarefa (várias ' +
    'podem estar em andamento) e mcp__task-tree__done assim que ela estiver de fato concluída, antes de ' +
    'passar à próxima. Nunca feche várias de uma vez no fim: o painel não mostra o que está em andamento e ' +
    'as tarefas ficam sem tempo. Um pai fecha sozinho quando todos os filhos fecham.',
  '- Tarefa que não será feita (o usuário mudou de rumo, o plano mudou) não é concluída: passe o id dela em ' +
    '`cancel`, no mcp__task-tree__done. Ela fica ✕ interrompida no painel, fora da contagem. `ids` é só para o ' +
    'que foi de fato concluído.',
  `- No done do último passo do pedido, passe em \`summary\` um resumo da resposta em ${LIMIT} ` +
    '(ex.: "Cartões na raiz: causa na recarga; correção enviada"): é a linha ↩ do painel. ' +
    'Sem ele, o pedido fica sem linha ↩.',
  '- Para replanejar dentro da mesma mensagem do usuário, chame plan de novo com o nível 1 inteiro. Um nível 1 ' +
    'aberto com o mesmo id é substituído no mesmo lugar da lista, e as tarefas que mantêm o id guardam o estado ' +
    '(concluída segue concluída, em andamento segue em andamento); só as novas entram pendentes. Isso vale só ' +
    'na mesma mensagem: numa mensagem seguinte (do usuário ou de outra sessão), um plan com o id de um nível 1 ' +
    'ainda aberto não o replaneja, ele fica como histórico do pedido anterior, com as tarefas abertas ' +
    'interrompidas, e a cópia nova entra toda pendente. Para seguir numa mensagem seguinte com tarefas de uma ' +
    'anterior, use start e done nos ids delas e planeje só o que é novo, com ids novos. Quando o lembrete de ' +
    'uma mensagem diz que ela chegou no meio do turno e continua o pedido em curso, ela não é mensagem ' +
    'seguinte: não há pedido novo no painel, e o replano do nível 1 em curso guarda o estado. Um nível 1 já concluído, ' +
    'replanejado na mesma mensagem com o mesmo id, reabre: os passos que mantêm o id seguem concluídos e só os ' +
    'novos entram pendentes; para refazer um passo concluído, dê a ele um id novo. Numa mensagem seguinte, o ' +
    'nível 1 concluído fica como histórico e o plano com o mesmo id entra todo pendente. start numa tarefa aberta com subtarefas inicia a primeira subtarefa aberta dela. start só reabre tarefas sem subtarefas; ' +
    `${REDO_PARENT}.`,
  '- Uma tarefa em andamento quando o usuário para o turno (Esc) fica interrompida no painel até um novo ' +
    'mcp__task-tree__start nela. Nada mais a reacende: nem a mensagem seguinte, nem o start em outra tarefa, ' +
    'nem um turno aberto por aviso automático, por retorno de subagente ou por tarefa em segundo plano que ' +
    'terminou. Para retomá-la, chame start nela antes de trabalhar; se ela já terminou, done a conclui sem start. ' +
    'O mesmo vale quando o turno termina com erro (falha da API, limite de contexto): a tarefa fica ✕ "falhou" até o start nela.',
  '- Uma tarefa em andamento quando o turno termina normalmente fica aguardando (◷) no painel até um novo ' +
    'mcp__task-tree__start nela: nem a mensagem seguinte nem um turno aberto por aviso automático a reacende. ' +
    'Para seguir nela, chame start nela antes de trabalhar; se ela já terminou, done a conclui sem start.',
  '- Não crie plano retroativo para trabalho já feito: se perceber que começou sem plano, planeje o que falta.',
  '- Antes de perguntar (AskUserQuestion, ExitPlanMode, wrap_up com ask), mantenha em andamento a tarefa a ' +
    'que a pergunta pertence e feche-a só depois da resposta; se a resposta vier pelo chat, feche-a no ' +
    'início do turno seguinte. AskUserQuestion sem tarefa aberta do pedido atual, nem tarefa em andamento, é recusado.',
  '- Depois que o usuário responder uma pergunta ou aprovar um plano, atualize o painel (done, start ou ' +
    'plan) antes de seguir. Se ele responder por mensagem no chat em vez de escolher uma opção, a mensagem ' +
    'é a resposta.',
  '- Respondido um AskUserQuestion, além do done da tarefa da pergunta, planeje as próximas tarefas: chame ' +
    'mcp__task-tree__plan com o que a resposta definiu (o rumo escolhido, os itens confirmados), na ordem ' +
    'em que vai executar, e só então siga com start e done.',
  '- Cada subagente lançado (Agent) aparece como um cartão embaixo da tarefa em andamento no lançamento, com ' +
    'o estado dele; as tarefas que ele planejar ficam dentro do cartão. Cada agente só mexe no próprio grupo; o ' +
    'que ele deixar aberto ao terminar vira interrompido, salvo a tarefa dele de onde saíram subagentes já ' +
    'terminados, que reflete o fim deles. Quando todos os subagentes lançados de uma tarefa ' +
    'terminam e o turno acaba, o painel fecha a tarefa sozinho: concluída se todos concluíram, interrompida se ' +
    'algum falhou ou foi parado; para refazê-la, chame start nela.',
  '- Dentro de um subagente (você foi lançado por outra sessão com Agent), plan, start e done valem só para ' +
    'as suas tarefas, que ficam no cartão do subagente, não na lista da sessão. Ali não valem: request e ' +
    'summary (são ignorados; o pedido e a linha ↩ são da sessão que lançou você), a recusa do ' +
    'AskUserQuestion sem tarefa e os lembretes de planejar.',
  '- Planeje antes de delegar: num pedido novo, chame mcp__task-tree__plan e marque com start a tarefa antes ' +
    'de mandar mensagem a outra sessão (SendMessage), abrir sessão (start_session) ou lançar subagente (Agent). ' +
    'O que for criado antes do plan do pedido fica solto no fim do painel, e o primeiro plan do pedido o ' +
    'adota: vai para a tarefa cujo título casa com o nome da sessão ou do subagente, senão para a primeira pendente.',
  '- Uma mensagem a outra sessão (SendMessage) aparece como uma carta ✉ embaixo da tarefa em andamento ' +
    'de onde saiu: azul na fila, verde quando a sessão destino começa a tratar, sem você fazer nada. A ' +
    'tarefa continua uma tarefa comum, com ícone e contagem normais. Na entrega imediata ("delivered; ' +
    'its turn has started on it"), a carta fica verde na hora e a tarefa segue em andamento até você ' +
    'chamar done. Com "queued", não chame done nela: quando o recebimento é confirmado, o painel a ' +
    'conclui sozinho (mesmo com esta sessão parada) e avisa.',
  '- Sessões abertas com start_session aparecem embaixo da tarefa em andamento quando foram abertas, com ' +
    'as tarefas do painel delas: antes de abrir uma sessão, marque com start a tarefa a que ela pertence. ' +
    'Quando a sessão termina o turno com todas as tarefas concluídas e nada mais está em execução na tarefa ' +
    'de origem, o painel conclui essa tarefa sozinho e avisa; para seguir nela, reabra com start.',
].join('\n')

// The /task-tree command and the three tools, as the model sees them.
export const COMMAND = 'Abre o painel da árvore de tarefas e diz o estado dele'
export const TOOLS = {
  plan:
    'Adiciona um plano à árvore de tarefas do painel lateral do usuário. As tarefas de nível 1 anteriores são mantidas. ' +
    'Na mesma mensagem do usuário, uma com o mesmo id, aberta ou já concluída, é substituída no mesmo lugar (replanejamento): as ' +
    'tarefas que mantêm o id guardam o estado, e só as novas entram pendentes. Numa mensagem seguinte, uma aberta ' +
    'com o mesmo id fica como histórico do pedido anterior, com as abertas interrompidas, e o plano novo entra ' +
    'todo pendente: para continuar tarefas de uma mensagem anterior, use start e done nos ids delas. ' +
    'Até 3 níveis: nível 1 genérico, nível 3 mais granular. Ids únicos dentro do plano (ex.: "1", "1.2", "1.2.3"); ' +
    'abaixo do nível 1 eles ganham o id dele como prefixo ("D/1.2"), então planos diferentes podem repetir ids. ' +
    'Use no início de todo pedido (uma tarefa basta para um pedido simples) e ao replanejar. ' +
    'No primeiro plan de cada mensagem do usuário, passe em request um título curto do que foi pedido: ' +
    'o painel agrupa as tarefas de nível 1 por mensagem, com esse título. ' +
    'Um request em outro plan do mesmo pedido não muda o título.',
  done:
    'Marca tarefas do painel como concluídas, pelos ids, assim que cada uma termina. ' +
    'Aceita o id curto ("1.2") quando não é ambíguo, ou o completo ("D/1.2"). ' +
    'Um pai fica concluído quando todos os filhos estão; marcar um pai conclui a subárvore. ' +
    `No done da última etapa do turno, passe summary: a resposta do turno em manchete de ${LIMIT} ` +
    `${EXAMPLE}. Sem etapa a fechar, chame done só com summary. ` +
    'Tarefa que não será feita não vai em ids: passe o id dela em cancel.',
  cancel:
    'Ids das tarefas que não serão feitas (o usuário mudou de rumo, o plano mudou). ' +
    'Ficam interrompidas (✕) no painel, fora da contagem, sem contar como concluídas. Não use ids para elas.',
  summary:
    `Resumo curto da resposta deste turno, em ${LIMIT} (o que mudou e o resultado), tipo manchete ` +
    `${EXAMPLE}. É a linha ↩ do painel; sem ele, o pedido fica sem linha ↩.`,
  start:
    'Marca tarefas do painel como em andamento (destacadas em amarelo) ao começar cada uma. ' +
    'Várias podem estar em andamento; sem nenhuma marcada, nenhuma tarefa aparece em andamento. ' +
    'Numa tarefa aberta com subtarefas, inicia a primeira subtarefa aberta dela; as seguintes não acendem sozinhas: dê start em cada uma. ' +
    'Em uma tarefa concluída sem subtarefas, reabre a tarefa e os pais dela; ' +
    `${REDO_PARENT}. Ids como no done.`,
}

// The refusal of a start on a parent no longer open, and how to redo it. A closed parent is ✓ in the
// panel whatever its leaves are (✓ or ✕), so the refusal says it is done, as the panel shows.
export const START = {
  closedParent: (id: string) => `"${id}" já foi concluída e tem subtarefas: ${REDO_PARENT}`,
}

// Every reminder and warning opens with this.
const PANEL = 'Painel de tarefas (task-tree): '

// Added to the prompt (prompt.submit): with the person's message, the reminder of a new request
// and, with tasks still open, their list (`answered`: the message answers the last question); with
// a background task's notification, a subagent's hand-back or the app's own notice, a short one;
// with a message delivered into a running turn that continues the request, the one that says so.
// With those short ones, while tasks the person stopped (Esc) still wait for their start, `parked`
// lists them (the person, 2026-11-13: "Acrescentar (Recomendado)").
export const PROMPT = {
  // `open`: tasks were open before the message (their list goes in the reminder before this one):
  // the done of what it concludes comes first, then the plan (the person, 2026-11-14: "Done, depois
  // plan (Recomendado)"), so the asked task closes ✓ in its own request and the new plan goes in whole.
  request: (open: boolean) =>
    PANEL + 'todo pedido abre pelo menos uma tarefa no painel, mesmo uma ' +
    'pergunta simples ou respondida só com pesquisa ou leitura de arquivos. ' +
    (open
      ? 'Primeiro feche com mcp__task-tree__done as tarefas abertas que esta mensagem conclui, e cancele as ' +
        'que ela substitui (a lista acima); depois disso, A PRIMEIRA chamada de ferramenta é ' +
        'mcp__task-tree__plan com a árvore de tarefas do pedido novo (até 3 níveis; uma tarefa basta para ' +
        'um pedido simples), com ids que não repitam os das tarefas ainda abertas. '
      : 'A PRIMEIRA chamada de ferramenta é mcp__task-tree__plan com a árvore de tarefas (até 3 níveis; ' +
        'uma tarefa basta para um pedido simples). ') +
    'Etapa por etapa: mcp__task-tree__start ao começar cada tarefa e ' +
    'mcp__task-tree__done assim que ela estiver de fato concluída, antes da próxima (nunca várias de ' +
    'uma vez no fim). Ao replanejar, chame plan de novo. ' +
    'Antes de perguntar (AskUserQuestion, ExitPlanMode, wrap_up com ask), mantenha em andamento a ' +
    'tarefa da pergunta e feche-a só depois da resposta. No primeiro plan desta mensagem, passe em ' +
    'request um título curto do que foi pedido. No done da última etapa do turno, passe summary: ' +
    `resumo da resposta em ${LIMIT}, tipo manchete.`,
  open: (list: string, answered: boolean) =>
    (answered ? 'Esta mensagem é a resposta do usuário à pergunta anterior. ' : '') +
    PANEL + `tarefas abertas antes desta mensagem: ${list}. Feche com ` +
    'mcp__task-tree__done as que esta mensagem conclui (por exemplo, a de perguntar ou de esperar a ' +
    'resposta) e cancele as que ela substitui e não serão feitas (mcp__task-tree__done com `cancel`: ficam ✕, ' +
    'fora da contagem) antes de seguir ou de planejar o pedido novo; deixe abertas só as que continuam. ' +
    'As que estavam em andamento seguem aguardando (◷): chame mcp__task-tree__start na que for continuar.',
  // A message delivered into a running turn that continues the request in progress, with no request
  // of its own in the panel (the person, 2026-11-12: "Entra no pedido em curso (Recomendado)").
  // `list`: the open tasks, if any; `answered`: the message answers the last question.
  midTurn: (list: string, answered: boolean) =>
    (answered ? 'Esta mensagem é a resposta do usuário à pergunta anterior. ' : '') +
    PANEL + 'esta mensagem chegou no meio do turno e continua o pedido em curso; ela não abre pedido novo ' +
    'no painel. ' + (list !== '' ? `Tarefas abertas: ${list}. ` : '') +
    'Siga nas tarefas que já existem com mcp__task-tree__start e mcp__task-tree__done, feche as que esta ' +
    'mensagem conclui e cancele (mcp__task-tree__done com `cancel`) as que ela substitui. O que ela pede de novo entra no plano atual: mcp__task-tree__plan com ids ' +
    'novos, ou de novo com o nível 1 inteiro (as tarefas que mantêm o id guardam o estado), sem request: o ' +
    'pedido em curso mantém o título.',
  handback: PANEL + 'o subagente terminou; atualize o painel (mcp__task-tree__done no que ele concluiu).',
  background:
    PANEL + 'uma tarefa em segundo plano (um subagente, um comando) terminou; ' +
    'atualize o painel: mcp__task-tree__done no que ela concluiu.',
  notice: PANEL + 'mantenha o painel em dia (done no que terminou, start no que começa).',
  parked: (list: string) =>
    PANEL + 'o usuário parou (Esc) o turno em que estas tarefas estavam em andamento, e elas seguem ' +
    `interrompidas no painel: ${list}. Um turno aberto por aviso automático ou por retorno de subagente, como ` +
    'este, não as retoma: cada uma só volta a andamento com mcp__task-tree__start nela. Se for seguir numa ' +
    'delas agora, chame start nela antes; a que já terminou, feche com mcp__task-tree__done.',
  // Tasks in progress when a turn died by an error, still ✕ "falhou" (a turn that opens no request).
  failedTasks: (list: string) =>
    PANEL + 'estas tarefas estavam em andamento quando um turno terminou com erro e seguem ✕ "falhou" no ' +
    `painel: ${list}. Cada uma só volta a andamento com mcp__task-tree__start nela; a que já terminou, feche ` +
    'com mcp__task-tree__done.',
  // The last turn died by an error (an API failure, the context limit) and the person wrote next (the
  // person, 2026-11-14: "✕ \"falhou\" (Recomendado)": "a mensagem seguinte recebe o pedido de replanejar").
  failedByError: (list: string, answered: boolean) =>
    (answered ? 'Esta mensagem é a resposta do usuário à pergunta anterior. ' : '') +
    PANEL + 'o turno anterior terminou com erro (falha da API ou limite de contexto) antes de concluir, e esta é a ' +
    'mensagem seguinte. Antes de seguir, replaneje o painel; esta mensagem abre um pedido novo. O que estava em ' +
    'andamento ficou ✕ "falhou" e só volta com mcp__task-tree__start nele. Se esta mensagem continua o trabalho ' +
    `(tarefas abertas: ${list}), siga essas tarefas pelos ids que já têm, com mcp__task-tree__start e ` +
    'mcp__task-tree__done, e planeje só o que ela pede de novo, com mcp__task-tree__plan e ids novos, na ordem em ' +
    'que vai executar: um plan com o id de um nível 1 da lista o deixaria como histórico, com as abertas ' +
    'interrompidas, e criaria uma cópia toda pendente. Se ela muda de rumo, feche ou cancele o que ela substitui ' +
    'e planeje só o pedido novo. Depois siga etapa por etapa com start e done.',
  // The last turn was interrupted (stopped) and a message of another session came next (the
  // person's rule): the model replans the panel, joining what the interrupted work left open with
  // what the message asks, before going on. The person's own message gets interruptedByYou.
  interrupted: (list: string) =>
    PANEL + 'seu turno anterior foi interrompido antes de terminar, e esta mensagem de outra sessão ' +
    'chegou em seguida. Antes de seguir, replaneje o painel: esta mensagem abre um pedido novo. O que ' +
    `continua do trabalho interrompido (tarefas abertas: ${list}) segue pelos ids que já tem: reabra com ` +
    'mcp__task-tree__start o que retoma agora e feche com mcp__task-tree__done o que esta mensagem conclui. ' +
    'O que ela pede de novo vai em mcp__task-tree__plan, com ids novos, na ordem em que vai executar: um ' +
    'plan com o id de um nível 1 da lista o deixaria como histórico, com as abertas interrompidas, e criaria ' +
    'uma cópia toda pendente. Depois siga etapa por etapa com start e done.',
  interruptedEmpty:
    PANEL + 'seu turno anterior foi interrompido antes de terminar, e esta mensagem de outra sessão ' +
    'chegou em seguida. Antes de seguir, replaneje o painel com o que esta mensagem pede: chame ' +
    'mcp__task-tree__plan e siga etapa por etapa com start e done.',
  // The person stopped the last turn (Esc) and wrote next (the person: "precisa replanejar quando eu
  // interrompo e envio nova mensagem"): the model replans the panel before going on, keeping what the
  // stopped work left open only if this message continues it.
  interruptedByYou: (list: string, answered: boolean) =>
    (answered ? 'Esta mensagem é a resposta do usuário à pergunta anterior. ' : '') +
    PANEL + 'o usuário interrompeu o turno anterior antes de terminar, e esta é a mensagem seguinte dele. ' +
    'Antes de seguir, replaneje o painel; esta mensagem abre um pedido novo. Se ela continua o trabalho ' +
    `interrompido (tarefas abertas: ${list}), siga essas tarefas pelos ids que já têm, com ` +
    'mcp__task-tree__start e mcp__task-tree__done, e planeje só o que ela pede de novo, com ' +
    'mcp__task-tree__plan e ids novos, na ordem em que vai executar: um plan com o id de um nível 1 da lista o ' +
    'deixaria como histórico, com as abertas interrompidas, e criaria uma cópia toda pendente. Se ela muda de ' +
    'rumo, cancele o que ela substitui (mcp__task-tree__done com `cancel`), feche com `ids` só o que foi ' +
    'concluído e planeje só o pedido novo. Depois siga etapa ' +
    'por etapa com start e done.',
}

// A question (AskUserQuestion) or a plan to approve: refused with no open task of the request and none in progress; answered, by an
// option or by a message still to come.
export const ASK = {
  refused:
    PANEL + 'não há tarefa aberta deste pedido no painel, nem tarefa em andamento, e uma pergunta ' +
    'sempre fica sob uma tarefa do pedido. Abra (mcp__task-tree__plan) ou reabra (mcp__task-tree__start) a tarefa ' +
    'a que esta pergunta pertence e pergunte de novo; feche-a só depois da resposta.',
  inChat:
    PANEL + 'o usuário vai responder por mensagem no chat, e a mensagem ' +
    'dele é a resposta. Ao recebê-la, antes de seguir, feche com mcp__task-tree__done a tarefa ' +
    'desta pergunta e planeje as próximas tarefas: mcp__task-tree__plan com o que a resposta definir.',
  answered:
    PANEL + 'o usuário respondeu. Antes de seguir, atualize o painel: ' +
    'mcp__task-tree__done no que a resposta concluiu e mcp__task-tree__plan com as próximas tarefas ' +
    'que ela definiu, na ordem em que vai executar; depois start no que começa agora.',
}

// Warnings in plan's result (joined after "Avisos:"): what the plan did to a level-1 task that
// already had the id it reuses (history of an earlier request, history beside a closed one, a replan
// in place keeping the state of the tasks that keep their id).
export const PLAN = {
  earlier: (id: string, open: number) =>
    `"${id}" era de um pedido anterior e ficou como histórico, com ${open} ${open === 1 ? 'tarefa aberta interrompida' : 'tarefas abertas interrompidas'}; ` +
    'a tarefa nova entrou toda pendente (para seguir na antiga, use start e done nos ids dela, sem replanejar)',
  closed: (id: string) => `"${id}" já estava fechada e ficou como histórico; a tarefa nova entrou ao lado`,
  carried: (id: string, done: number, going: number) =>
    `"${id}" replanejada no lugar: ${done + going} ${done + going === 1 ? 'tarefa manteve' : 'tarefas mantiveram'} o estado ` +
    `(${done} ${done === 1 ? 'concluída' : 'concluídas'}, ${going} em andamento); as demais entraram pendentes`,
  // The refusals of a plan whose input the panel cannot take (nothing changes in the panel).
  empty: 'erro: o plano veio sem tarefas; passe em tasks pelo menos uma tarefa, com id e title.',
  shape: (where: string) => `erro: toda tarefa precisa de id e title em texto, não vazios (problema em: ${where}); nada mudou no painel.`,
  colon: (id: string) => `erro: o id "${id}" tem ":", que o painel reserva para o histórico; use ids sem ":".`,
  slash: (id: string) => `erro: o id de nível 1 "${id}" tem "/", que separa o nível 1 das subtarefas; use um id sem "/" no nível 1.`,
  fourth: (id: string) =>
    `erro: o plano tem um quarto nível (abaixo de "${id}"); o painel aceita até 3: junte essas tarefas no terceiro nível ou divida o nível 1.`,
}

// The refusal of done and start when `ids` or `cancel` is not a list.
export const NOT_A_LIST = (field: 'ids' | 'cancel') => `erro: ${field} deve ser uma lista de ids (ex.: ["1.2"]).`

// What plan, done and start answer on an internal failure; the exception goes to the debug log.
export const TOOL_ERROR = (name: string) =>
  `erro: falha interna do painel de tarefas ao executar ${name}; a chamada pode ter sido aplicada só em parte. ` +
  `Chame ${name} de novo com os mesmos argumentos; se o erro se repetir, siga o trabalho e diga ao usuário que o painel pode estar desatualizado.`

// Warnings in done's result (joined after "Avisos:").
export const DONE = {
  // done on a task ✕ (its subagent failed or was stopped, history, canceled): start takes it up again.
  interrupted: (id: string) => `"${id}" foi interrompida: o done não a conclui; para retomá-la, chame start nela`,
  // Closing the task a stopped session was opened from: its pending tasks leave the count (settle).
  settled: (sessions: string[]) =>
    `parou com pendentes a sessão ${sessions.join(', a sessão ')}: elas saíram da contagem do painel ao ` +
    'fechar a tarefa de origem; se o trabalho delegado não acabou, retome a sessão',
  noSummary: `falta o summary: se este done foi o último passo do turno, chame done de novo só com summary, a resposta do turno em ${LIMIT} (vira a linha ↩); se ainda vai planejar ou seguir trabalhando, ignore este aviso e passe o summary no último done`,
  // One or more steps closed never started (one too since the person's 2026-11-15 answer, "Lembrete
  // após 3 chamadas (Recomendado)").
  unstarted: (ids: string[]) =>
    ids.length === 1
      ? `1 etapa fechou sem start ("${ids[0]}"): o painel não a mostrou em andamento e ela aparece sem tempo (—). ` +
        'Daqui em diante, marque cada etapa com mcp__task-tree__start ao começá-la e com mcp__task-tree__done ao terminá-la'
      : `${ids.length} etapas fecharam juntas sem start (${ids.map(id => `"${id}"`).join(', ')}): o painel não ` +
        'mostrou nenhuma em andamento e elas aparecem sem tempo (—). Daqui em diante, marque cada etapa com mcp__task-tree__start ' +
        'ao começá-la e com mcp__task-tree__done ao terminá-la, uma de cada vez',
  queued: (to: string, id: string) => `a mensagem para ${to} ("${id}") ainda está na fila, sem confirmação de recebimento`,
}

// Notes in a tool call's context: the desktop app's end-of-turn box (wrap_up), a message to another
// session only queued (`task`: the id and title of the task it was sent from, if any), and a tool
// call with no plan open.
export const WRAP_UP = {
  noBrief:
    PANEL + 'falta o resumo do turno. Antes da mensagem final, chame ' +
    `mcp__task-tree__done com summary: a resposta em ${LIMIT}, tipo manchete (ids pode ficar vazio).`,
  open: (list: string) =>
    PANEL + 'o turno termina com tarefas abertas no painel: ' +
    `${list}. Antes da mensagem final, marque com mcp__task-tree__done as que já foram ` +
    'concluídas (inclusive as feitas por outra sessão ou por outro caminho). Deixe abertas só as que ' +
    'de fato continuam pendentes; com ask, a tarefa da pergunta fica em andamento até a resposta.',
}
export const SEND = {
  queued: (to: string, task: string | undefined) =>
    PANEL + `a mensagem para ${to} ficou na fila, sem confirmação de recebimento. ` +
    `Mantenha em andamento a tarefa do envio${task ? ` (${task})` : ''}: o painel avisa quando a ` +
    'sessão começar a tratá-la, e então a conclui sozinho (pode encerrar o turno).',
  queuedSub: (to: string, task: string | undefined) =>
    PANEL + `a mensagem para o subagente ${to} ficou na fila, sem confirmação de recebimento. ` +
    `Mantenha em andamento a tarefa do envio${task ? ` (${task})` : ''}: o painel avisa quando ele a ` +
    'receber, ou quando ele parar sem recebê-la.',
}
export const UNPLANNED =
  PANEL + 'há chamada de ferramenta sem plano aberto no painel. Todo pedido ' +
  'abre pelo menos uma tarefa: chame mcp__task-tree__plan agora, mcp__task-tree__start ao começar ' +
  'e mcp__task-tree__done só quando a tarefa estiver de fato concluída.'
// A plan open and nothing started, at the third call in a row of the main loop, once a plan (hooks/
// tool-call, reminder; the person, 2026-11-15: "Lembrete após 3 chamadas (Recomendado)").
export const START_DUE =
  PANEL + 'há plano aberto e nenhuma tarefa em andamento: o painel mostra tudo pendente e o relógio ' +
  'parado. Chame mcp__task-tree__start na tarefa em que está trabalhando agora; as que já terminou, ' +
  'feche com mcp__task-tree__done.'

// The sessions this one opened: one took up a queued message (`what`: each session, with the task
// it was sent from); one was archived with a message still queued, which is not delivered (`lost`);
// one ended its turn with the task it was opened on still open (`sessions`: each with that task;
// `open`: the panel's open tasks).
export const SESSION = {
  taken: (what: string[]) =>
    PANEL + `recebimento confirmado, a sessão começou a tratar a mensagem: ${what.join('; ')}. ` +
    'O painel já concluiu a tarefa do envio; se ela ainda tinha algo a fazer, reabra com mcp__task-tree__start.',
  // The same, when the panel did not close the task (interrupted by a new plan, out of the plan, or a
  // subtask or something still running in it).
  takenOpen: (what: string[]) =>
    PANEL + `recebimento confirmado, a sessão começou a tratar a mensagem: ${what.join('; ')}. ` +
    'O painel não concluiu a tarefa do envio: ela segue como está no painel (aberta com subtarefa aberta ou com ' +
    'algo ainda em execução nela, interrompida por um plano novo, ou fora do plano). Se o trabalho dela ' +
    'terminou, feche-a com mcp__task-tree__done.',
  lost: (what: string[]) =>
    PANEL + `mensagem não entregue, a sessão foi arquivada com ela ainda na fila: ${what.join('; ')}. ` +
    'A tarefa do envio deixou de esperar por ela; trate-a como qualquer outra tarefa (mcp__task-tree__done quando concluída).',
  // The same for a message to one of this session's subagents: it received it (in its next round of
  // tools, or resumed with it), or it ended without receiving it.
  takenSub: (what: string[]) =>
    PANEL + `recebimento confirmado, o subagente recebeu a mensagem: ${what.join('; ')}. ` +
    'A tarefa do envio deixou de esperar por ela: o painel a concluiu, ou a conclui com o fim do subagente lançado dela.',
  lostSub: (what: string[]) =>
    PANEL + `mensagem não entregue, o subagente parou antes de recebê-la: ${what.join('; ')}. ` +
    'A tarefa do envio deixou de esperar por ela; trate-a como qualquer outra tarefa. Se a mensagem ainda importa, ' +
    'mande de novo (um subagente concluído é retomado com ela).',
  ended: (sessions: string[], open: string, pending = false) =>
    PANEL + `terminou o turno a sessão ${sessions.join(', a sessão ')}, e a tarefa de ` +
    'origem continua aberta. Confira o relato e marque com mcp__task-tree__done o que o trabalho delegado ' +
    'concluiu. ' +
    (pending
      ? 'Ao fechar a tarefa de origem, as pendentes dessa sessão saem da contagem do painel; se o trabalho ' +
        'delegado não acabou, retome a sessão em vez de fechar. '
      : '') +
    `Tarefas abertas no painel: ${open}.`,
  // A session that ended its turn with all of its work done, its task of origin closed by the panel
  // (hooks/sessions, closeByEnded; the person, 2026-11-15: "Fecha a tarefa sozinho (Recomendado)").
  closedBy: (sessions: string[]) =>
    PANEL + `terminou o turno com todas as tarefas concluídas a sessão ${sessions.join(', a sessão ')}, e o painel ` +
    'concluiu sozinho a tarefa de origem. Confira o relato dela; se a tarefa ainda tinha algo a fazer, reabra com mcp__task-tree__start.',
  stopped: (sessions: string[]) =>
    PANEL + `parou com a tarefa de origem já fechada a sessão ${sessions.join(', a sessão ')}: essas pendentes ` +
    'saíram da contagem do painel. Se o trabalho delegado não acabou, retome a sessão.',
  // A session deleted, or archived, in the app with its task of origin open here: said once
  // (hooks/sessions, noteGone and endedNote; the person, 2026-11-15: "Avisar o modelo uma vez").
  deleted: (sessions: string[]) =>
    PANEL + `não existe mais no app a sessão ${sessions.join(', a sessão ')}, e a tarefa de origem continua aberta: ` +
    'o cartão dela saiu do painel, com as tarefas que ela tinha. Se o trabalho delegado já bastava, conclua a ' +
    'tarefa com mcp__task-tree__done; se não, refaça-o por outro caminho ou cancele a tarefa (mcp__task-tree__done com cancel).',
  archived: (sessions: string[]) =>
    PANEL + `foi arquivada no app a sessão ${sessions.join(', a sessão ')}, e a tarefa de origem continua aberta: ` +
    'o que ela deixou aberto ficou ✕ no cartão e não será feito por ela. Confira o que ela concluiu e feche a ' +
    'tarefa com mcp__task-tree__done, ou cancele-a (cancel) se não será feita.',
}

// The tasks of the main loop the end of their subagents closed (✓) or marked ✕ (one failed or was
// stopped), said once at the next prompt or tool call (hooks/agents, subsNote).
export const SUBS = {
  done: (list: string) =>
    PANEL + `os subagentes lançados destas tarefas terminaram e o painel as concluiu sozinho: ${list}. ` +
    'Se alguma ainda tinha algo a fazer, reabra com mcp__task-tree__start.',
  stopped: (list: string) =>
    PANEL + `o painel marcou como interrompidas as tarefas cujo subagente falhou ou foi parado: ${list}. ` +
    'Para refazer, chame mcp__task-tree__start na tarefa (ela reabre) e lance o subagente de novo; se o ' +
    'resultado já basta, deixe como está.',
}
