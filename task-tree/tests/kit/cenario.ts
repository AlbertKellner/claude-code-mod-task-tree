// Roteiro dos cenários: as tools do painel chamadas como o modelo chama.

export type No = { id: string; title: string; children?: No[] }
export type Resposta = { texto: string; erro: boolean }

async function chamar($: any, nome: string, args: object): Promise<Resposta> {
  const r = await $.tool.call({ tool: `mcp__task-tree__${nome}`, ...args })
  return { texto: String(r?.result ?? r?.text ?? ''), erro: r?.isError === true }
}

export const plan = ($: any, tarefas: No[], request?: string) =>
  chamar($, 'plan', request === undefined ? { tasks: tarefas } : { tasks: tarefas, request })
export const start = ($: any, ids: string[]) => chamar($, 'start', { ids })
export const done = ($: any, ids: string[], summary?: string) =>
  chamar($, 'done', summary === undefined ? { ids } : { ids, summary })

// Uma mensagem da pessoa: abre um pedido (turno) novo.
export const pedido = ($: any, texto: string) => $.prompt.submit({ text: texto })

// O fim normal do turno do modelo.
export const fimDoTurno = ($: any) =>
  $.turn.complete({ reason: 'end_turn', answer: '', durationMs: 1, isAborted: false, turnId: 't' })

// O turno parado pela pessoa (Esc, stop).
export const esc = ($: any) =>
  $.turn.complete({ reason: 'end_turn', answer: '', durationMs: 1, isAborted: true, turnId: 't' })
