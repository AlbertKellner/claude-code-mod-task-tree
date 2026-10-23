// The texts the mod hands the model: the panel's rules in the system prompt, the tools' and the
// command's descriptions, the reminders prompt.submit adds to each prompt, the warnings in the
// results of done, wrap_up and the other tool calls, and the notes about sessions this one opened.
// All in one place, so what the model reads about the same thing is said once: the limit of the ↩
// summary (BRIEF) is interpolated here, in every text that names it. Pure strings and functions of
// strings; the hooks module imports them. tests/textos.test.ts keeps them letter by letter against
// tests/golden/textos.ts.

// The ↩ line says the answer in at most BRIEF characters (done's `summary`, else the first
// sentence of the answer; see brief in the hooks).
export const BRIEF = 120
const LIMIT = `até ${BRIEF} caracteres`
const EXAMPLE = '(ex.: "Commit 946f653 no PR #5; 151 testes ok")'

// The panel's rules, added to the system prompt of every request that offers its tools,
// so the mod behaves the same on any machine with nothing in CLAUDE.md.
export const RULES = [
  '# Painel de tarefas (task-tree)',
  '',
  'O usuário acompanha o trabalho num painel lateral de tarefas. Regras:',
  '',
  '- Todo pedido abre pelo menos uma tarefa no painel, mesmo uma pergunta simples ou respondida só com ' +
    'pesquisa ou leitura de arquivos. A primeira chamada de ferramenta é mcp__task-tree__plan com a árvore ' +
    'de tarefas: até 3 níveis (nível 1 genérico, nível 3 mais granular), ids únicos dentro do plano ' +
    '("1", "1.2", "1.2.3"). Uma tarefa basta para um pedido simples.',
  '- Abaixo do nível 1 os ids ganham o id dele como prefixo ("D/1.2"). done e start aceitam o id curto ' +
    'quando não é ambíguo (preferem a tarefa aberta) ou o completo, e avisam no resultado ids ' +
    'inexistentes, ambíguos ou de outro agente.',
  '- No primeiro plan de cada mensagem do usuário, passe em `request` um título curto do que foi pedido: ' +
    'no painel, as tarefas de nível 1 ficam agrupadas pela mensagem em que foram planejadas, com esse título.',
  '- Etapa por etapa, no momento em que acontece: mcp__task-tree__start ao começar cada tarefa (várias ' +
    'podem estar em andamento) e mcp__task-tree__done assim que ela estiver de fato concluída, antes de ' +
    'passar à próxima. Nunca feche várias de uma vez no fim: o painel fica parado na primeira e pula para ' +
    'a última, com 0:00 nas do meio. Um pai fecha sozinho quando todos os filhos fecham.',
  `- No done do último passo do pedido, passe em \`summary\` um resumo da resposta em ${LIMIT} ` +
    '(ex.: "Cartões na raiz: causa na recarga; correção enviada"): é a linha ↩ do painel, com a resposta ' +
    'inteira no tooltip. Sem ele, o painel usa a primeira frase da resposta.',
  '- Para replanejar, chame plan de novo com o nível 1 inteiro. Um nível 1 aberto com o mesmo id é ' +
    'substituído do zero no mesmo lugar da lista: remarque com done o que já estava concluído. Um nível 1 ' +
    'já concluído fica como histórico. start só reabre tarefas sem subtarefas; para refazer um pai ' +
    'concluído, replaneje o nível 1.',
  '- Não crie plano retroativo para trabalho já feito: se perceber que começou sem plano, planeje o que falta.',
  '- Antes de perguntar (AskUserQuestion, ExitPlanMode, wrap_up com ask), mantenha em andamento a tarefa a ' +
    'que a pergunta pertence e feche-a só depois da resposta; se a resposta vier pelo chat, feche-a no ' +
    'início do turno seguinte. AskUserQuestion sem tarefa aberta é recusado.',
  '- Depois que o usuário responder uma pergunta ou aprovar um plano, atualize o painel (done, start ou ' +
    'plan) antes de seguir. Se ele responder por mensagem no chat em vez de escolher uma opção, a mensagem ' +
    'é a resposta.',
  '- Subagentes que usam o painel ganham um grupo próprio, mostrado embaixo da tarefa em que foram ' +
    'lançados. Cada agente só mexe no próprio grupo; o que ele deixar aberto ao terminar vira interrompido.',
  '- Uma tarefa de enviar mensagem a outra sessão (SendMessage) fica com o ícone de mensagem (✉) do ' +
    'envio até a sessão destino começar a tratar a mensagem, mesmo quando a entrega é imediata ' +
    '("delivered; its turn has started on it"). Não chame done nela: quando o recebimento é confirmado, ' +
    'o painel a conclui sozinho (mesmo com esta sessão parada). Com "queued", o painel também avisa.',
  '- Sessões abertas com start_session aparecem embaixo da tarefa em andamento quando foram abertas, com ' +
    'as tarefas do painel delas: antes de abrir uma sessão, marque com start a tarefa a que ela pertence.',
].join('\n')

// The /task-tree command and the three tools, as the model sees them.
export const COMMAND = 'Abre o painel da árvore de tarefas e diz o estado dele; com resumida ou completa, troca a visão'
export const TOOLS = {
  plan:
    'Adiciona um plano à árvore de tarefas do painel lateral do usuário. As tarefas de nível 1 anteriores são mantidas; ' +
    'uma aberta com o mesmo id é substituída (replanejamento, que recomeça tudo dentro dela). ' +
    'Até 3 níveis: nível 1 genérico, nível 3 mais granular. Ids únicos dentro do plano (ex.: "1", "1.2", "1.2.3"); ' +
    'abaixo do nível 1 eles ganham o id dele como prefixo ("D/1.2"), então planos diferentes podem repetir ids. ' +
    'Use no início de todo pedido (uma tarefa basta para um pedido simples) e ao replanejar. ' +
    'No primeiro plan de cada mensagem do usuário, passe em request um título curto do que foi pedido: ' +
    'o painel agrupa as tarefas de nível 1 por mensagem, com esse título.',
  done:
    'Marca tarefas do painel como concluídas, pelos ids, assim que cada uma termina. ' +
    'Aceita o id curto ("1.2") quando não é ambíguo, ou o completo ("D/1.2"). ' +
    'Um pai fica concluído quando todos os filhos estão; marcar um pai conclui a subárvore. ' +
    `No done da última etapa do turno, passe summary: a resposta do turno em manchete de ${LIMIT} ` +
    `${EXAMPLE}. Sem etapa a fechar, chame done só com summary.`,
  summary:
    `Resumo curto da resposta deste turno, em ${LIMIT} (o que mudou e o resultado), tipo manchete ` +
    `${EXAMPLE}. Vira a linha ↩ do painel; a resposta inteira fica no tooltip.`,
  start:
    'Marca tarefas do painel como em andamento (destacadas em amarelo) ao começar cada uma. ' +
    'Várias podem estar em andamento; sem nenhuma marcada, nenhuma tarefa aparece em andamento. ' +
    'Em uma tarefa concluída sem subtarefas, reabre a tarefa e os pais dela; ' +
    'para refazer um pai concluído, replaneje o nível 1 com plan. Ids como no done.',
}

// Every reminder and warning opens with this.
const PANEL = 'Painel de tarefas (task-tree): '

// Added to the prompt (prompt.submit): with the person's message, the reminder of a new request
// and, with tasks still open, their list (`answered`: the message answers the last question); with
// a background task's notification, a subagent's hand-back or the app's own notice, a short one.
export const PROMPT = {
  request:
    PANEL + 'todo pedido abre pelo menos uma tarefa no painel, mesmo uma ' +
    'pergunta simples ou respondida só com pesquisa ou leitura de arquivos. A PRIMEIRA chamada de ' +
    'ferramenta é mcp__task-tree__plan com a árvore de tarefas (até 3 níveis; uma tarefa basta ' +
    'para um pedido simples). Etapa por etapa: mcp__task-tree__start ao começar cada tarefa e ' +
    'mcp__task-tree__done assim que ela estiver de fato concluída, antes da próxima (nunca várias de ' +
    'uma vez no fim). Ao replanejar, chame plan de novo. ' +
    'Antes de perguntar (AskUserQuestion, ExitPlanMode, wrap_up com ask), mantenha em andamento a ' +
    'tarefa da pergunta e feche-a só depois da resposta. No primeiro plan desta mensagem, passe em ' +
    'request um título curto do que foi pedido. No done da última etapa do turno, passe summary: ' +
    `resumo da resposta em ${LIMIT}, tipo manchete.`,
  open: (list: string, answered: boolean) =>
    (answered ? 'Esta mensagem é a resposta do usuário à pergunta anterior. ' : '') +
    PANEL + `tarefas abertas antes desta mensagem: ${list}. Feche com ` +
    'mcp__task-tree__done as que esta mensagem conclui ou substitui (por exemplo, a de perguntar ou de ' +
    'esperar a resposta) antes de seguir ou de planejar o pedido novo; deixe abertas só as que continuam.',
  handback: PANEL + 'o subagente terminou; atualize o painel (mcp__task-tree__done no que ele concluiu).',
  background:
    PANEL + 'uma tarefa em segundo plano (um subagente, um comando) terminou; ' +
    'atualize o painel: mcp__task-tree__done no que ela concluiu.',
  notice: PANEL + 'mantenha o painel em dia (done no que terminou, start no que começa).',
  // The last turn was interrupted (stopped) and a message of another session came next (the
  // person's rule): the model replans the panel, joining what the interrupted work left open with
  // what the message asks, before going on. Only for a turn another session's message opens; the
  // person's own prompt gets the usual reminders.
  interrupted: (list: string) =>
    PANEL + 'seu turno anterior foi interrompido antes de terminar, e esta mensagem de outra sessão ' +
    'chegou em seguida. Antes de seguir, replaneje o painel: chame mcp__task-tree__plan com o nível 1 ' +
    `inteiro, juntando o que ficou do trabalho interrompido (tarefas abertas: ${list}) e o que esta ` +
    'mensagem pede, na ordem em que vai executar. Remarque com mcp__task-tree__done o que já estava ' +
    'concluído. Depois siga etapa por etapa com start e done.',
  interruptedEmpty:
    PANEL + 'seu turno anterior foi interrompido antes de terminar, e esta mensagem de outra sessão ' +
    'chegou em seguida. Antes de seguir, replaneje o painel com o que esta mensagem pede: chame ' +
    'mcp__task-tree__plan e siga etapa por etapa com start e done.',
}

// A question (AskUserQuestion) or a plan to approve: refused with no open task; answered, by an
// option or by a message still to come.
export const ASK = {
  refused:
    PANEL + 'não há tarefa aberta no painel, e uma pergunta sempre fica sob ' +
    'uma tarefa em andamento. Abra (mcp__task-tree__plan) ou reabra (mcp__task-tree__start) a tarefa ' +
    'a que esta pergunta pertence e pergunte de novo; feche-a só depois da resposta.',
  inChat:
    PANEL + 'o usuário vai responder por mensagem no chat, e a mensagem ' +
    'dele é a resposta. Ao recebê-la, antes de seguir, feche com mcp__task-tree__done a tarefa ' +
    'desta pergunta e atualize o painel (start no que começa, plan se o plano mudou).',
  answered:
    PANEL + 'o usuário respondeu. Antes de seguir, atualize o painel: ' +
    'mcp__task-tree__done no que a resposta concluiu, mcp__task-tree__start no que começa agora, ' +
    'ou mcp__task-tree__plan se ela mudou o plano.',
}

// Warnings in done's result (joined after "Avisos:").
export const DONE = {
  noSummary: `falta o summary: chame done de novo só com summary, a resposta do turno em ${LIMIT} (vira a linha ↩)`,
  unstarted: (ids: string[]) =>
    `${ids.length} etapas fecharam juntas sem start (${ids.map(id => `"${id}"`).join(', ')}): o painel ficou ` +
    'parado na primeira e elas aparecem com 0:00. Daqui em diante, marque cada etapa com mcp__task-tree__start ' +
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
}
export const UNPLANNED =
  PANEL + 'há chamada de ferramenta sem plano aberto no painel. Todo pedido ' +
  'abre pelo menos uma tarefa: chame mcp__task-tree__plan agora, mcp__task-tree__start ao começar ' +
  'e mcp__task-tree__done só quando a tarefa estiver de fato concluída.'

// The sessions this one opened: one took up a queued message (`what`: each session, with the task
// it was sent from); one ended its turn with the task it was opened on still open (`sessions`: each
// with that task; `open`: the panel's open tasks).
export const SESSION = {
  taken: (what: string[]) =>
    PANEL + `recebimento confirmado, a sessão começou a tratar a mensagem: ${what.join('; ')}. ` +
    'O painel já concluiu a tarefa do envio; se ela ainda tinha algo a fazer, reabra com mcp__task-tree__start.',
  ended: (sessions: string[], open: string) =>
    PANEL + `terminou o turno a sessão ${sessions.join(', a sessão ')}, e a tarefa de ` +
    'origem continua aberta. Confira o relato e marque com mcp__task-tree__done o que o trabalho delegado ' +
    `concluiu. Tarefas abertas no painel: ${open}.`,
}
