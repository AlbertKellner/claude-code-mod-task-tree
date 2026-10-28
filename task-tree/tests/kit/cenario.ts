// Roteiro dos cenários: as tools do painel chamadas como o modelo chama.

export type No = { id: string; title: string; children?: No[] }
export type Resposta = { texto: string; erro: boolean }

// Uma recusa de hook vem como `{ deny }`; o erro da própria ferramenta, como isError.
const resposta = (r: any): Resposta =>
  typeof r?.deny === 'string' ? { texto: r.deny, erro: true } : { texto: String(r?.result ?? r?.text ?? ''), erro: r?.isError === true }

async function chamar($: any, nome: string, args: object): Promise<Resposta> {
  return resposta(await $.tool.call({ tool: `mcp__task-tree__${nome}`, ...args }))
}

export const plan = ($: any, tarefas: No[], request?: string) =>
  chamar($, 'plan', request === undefined ? { tasks: tarefas } : { tasks: tarefas, request })
export const start = ($: any, ids: string[]) => chamar($, 'start', { ids })
export const done = ($: any, ids: string[], summary?: string) =>
  chamar($, 'done', summary === undefined ? { ids } : { ids, summary })

// Uma ferramenta qualquer chamada pelo modelo (pergunta, plano, wrap_up), já com o stub registrado.
export const ferramenta = async ($: any, tool: string, args: object = {}): Promise<Resposta> =>
  resposta(await $.tool.call({ tool, tool_use_id: `${tool}-1`, ...args }))

// O modelo manda uma mensagem a outra sessão (SendMessage); o stub está em responderEnvio.
export const envio = ($: any, para: string, texto = 'oi') => ferramenta($, 'SendMessage', { to: para, message: texto })

// O modelo abre uma sessão filha (start_session); o stub do host devolve o id da próxima filha dele.
export const abrirSessao = ($: any) => ferramenta($, 'mcp__ccd_session__start_session', { title: 'filha' })

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

// O turno parado pela pessoa (Esc, stop).
export const esc = ($: any) =>
  $.turn.complete({ reason: 'end_turn', answer: '', durationMs: 1, isAborted: true, turnId: 't' })
