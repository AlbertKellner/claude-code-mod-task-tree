// Roteiro dos cenários: as tools do painel chamadas como o modelo chama.

export type No = { id: string; title: string; children?: No[] }
export type Resposta = { texto: string; erro: boolean }

// Uma recusa de hook vem como `{ deny }`; o erro da própria ferramenta, como isError.
const resposta = (r: any): Resposta =>
  typeof r?.deny === 'string' ? { texto: r.deny, erro: true } : { texto: String(r?.result ?? r?.text ?? ''), erro: r?.isError === true }

// `agente`: a chamada de um subagente (o agentId dele); sem ela, a do loop principal.
async function chamar($: any, nome: string, args: object, agente?: string): Promise<Resposta> {
  return resposta(await $.tool.call({ tool: `mcp__task-tree__${nome}`, ...args, ...(agente === undefined ? {} : { agentId: agente }) }))
}

export const plan = ($: any, tarefas: No[], request?: string, agente?: string) =>
  chamar($, 'plan', request === undefined ? { tasks: tarefas } : { tasks: tarefas, request }, agente)
export const start = ($: any, ids: string[], agente?: string) => chamar($, 'start', { ids }, agente)
export const done = ($: any, ids: string[], summary?: string, agente?: string) =>
  chamar($, 'done', summary === undefined ? { ids } : { ids, summary }, agente)

// Uma ferramenta qualquer chamada pelo modelo (pergunta, plano, wrap_up), já com o stub registrado.
export const ferramenta = async ($: any, tool: string, args: object = {}): Promise<Resposta> =>
  resposta(await $.tool.call({ tool, tool_use_id: `${tool}-1`, ...args }))

// O modelo manda uma mensagem a outra sessão (SendMessage); o stub está em responderEnvio.
export const envio = ($: any, para: string, texto = 'oi') => ferramenta($, 'SendMessage', { to: para, message: texto })

// O modelo abre uma sessão filha (start_session); o stub do host devolve o id da próxima filha dele.
export const abrirSessao = ($: any) => ferramenta($, 'mcp__ccd_session__start_session', { title: 'filha' })

// Um processo novo: o session.start, com a lista do host e os arquivos lidos em segundo plano.
export const iniciarSessao = async ($: any) => {
  await $.session.start({ cwd: '.' })
  await new Promise(r => (globalThis as any).setTimeout(r, 150))
}
// A retomada de uma sessão (o state passa a ser o do store dela) e o /clear.
export const retomar = ($: any, id: string) => $.classic.SessionStart({ source: 'resume', session_id: id })
export const limpar = ($: any) => $.classic.SessionStart({ source: 'clear' })

// Troca a visão, como /task-tree resumida | completa.
export const visao = ($: any, v: 'resumida' | 'completa') => $.command.run({ command: 'task-tree', args: v })

// Uma mensagem de outra sessão: abre um pedido marcado como recebido.
export const mensagemDe = ($: any, de: string, texto: string) =>
  $.prompt.submit({ text: `<cross-session-message from="${de}" name="outra">${texto}</cross-session-message>` })

// Uma mensagem da pessoa: abre um pedido (turno) novo.
export const pedido = ($: any, texto: string) => $.prompt.submit({ text: texto })

// Um aviso do app (uma sessão terminou): não abre pedido.
export const aviso = ($: any) => $.prompt.submit({ text: '<side-sessions-event>sessão terminou</side-sessions-event>' })

// O fim normal do turno do modelo.
export const fimDoTurno = ($: any) =>
  $.turn.complete({ reason: 'end_turn', answer: '', durationMs: 1, isAborted: false, turnId: 't' })

// O fim do turno de um subagente (ele termina).
export const fimDoSubagente = ($: any, agente: string) =>
  $.turn.complete({ reason: 'end_turn', answer: '', durationMs: 1, isAborted: false, turnId: 't', agentId: agente })

// O turno parado pela pessoa (Esc, stop).
export const esc = ($: any) =>
  $.turn.complete({ reason: 'end_turn', answer: '', durationMs: 1, isAborted: true, turnId: 't' })
