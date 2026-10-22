import { describe, expect, test } from 'claude-code/testing'
import { TEXTOS } from './golden/textos'

// The texts the mod hands the model (rules, descriptions, reminders, warnings) compared letter by
// letter with golden/textos.ts: a change in any of them is a change in what the model reads, to
// approve on purpose. They all cite the same limit for the ↩ summary (BRIEF, 120).

const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })
const KID = 'local_11111111-1111-1111-1111-111111111111'
const rows = (running: boolean) => [
  { sessionId: 'local_pai', title: 'Pai', isRunning: false },
  { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: running, isArchived: false, startedBy: 'local_eu' },
]
// A host with a child session: the list the app gives, its empty published file, start_session
// opening it and SendMessage queuing (the message not taken up at once).
function host(on: any, running: () => boolean) {
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify(rows(running())) }], isError: false } }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('fs.read', () => ({ value: '{}' }) as any)
  on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
  on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${KID}; it is busy and will see it when its turn ends.` }))
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
  on('tool.call', { tool: 'Read' }, async () => ({ result: 'ok' }))
  on('prompt.submit', (_$: any, e: any) => e)
}
const refresh = ($: any) => $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
const contexts = (r: any): string[] => (r?.context ?? []).map(String)
const result = (r: any) => String(r?.result ?? r?.deny ?? '')
// A warning of done's result ("Concluídas: … Avisos: a; b.") or a note of a tool call's context.
const warnings = (r: any) => result(r).replace(/^.*? Avisos: /, '').replace(/\.$/, '')

const got: Record<string, string> = {}
const keep = (name: string, text: string | undefined) => {
  got[name] = text ?? '<ausente>'
}

describe('textos de regra, letra por letra', () => {
  test('registro: regras do prompt, descrições das ferramentas e do comando', async ($, on) => {
    const registered: Record<string, string> = {}
    on('command.register', (_$: any, e: any) => {
      registered[`comando ${e.name}`] = String(e.description)
      return { value: {} } as any
    })
    on('tool.register', (_$: any, e: any) => {
      registered[`tool ${e.name}`] = String(e.description)
      const summary = e.inputSchema?.properties?.summary?.description
      if (summary) registered[`tool ${e.name}: summary`] = String(summary)
      return { value: {} } as any
    })
    on('session.start', () => ({ cwd: '.' }) as any)
    on('ui.open', () => ({ value: { isPlaced: true } }) as any)
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: '[]' }], isError: false } }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'x', scope: 'shared' }] }) as any)
    await $.session.start({ cwd: '.' } as any)
    for (const [k, v] of Object.entries(registered)) keep(k, v)
    const r: any = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: ['mcp__task-tree__plan'], outputStyle: null, traits: [] } as any)
    keep('regras (prompt.compose)', r.sections.find((s: any) => s.id === 'task-tree:regras')?.text)
    expect(Object.keys(registered).length).toBe(5)
  })

  test('prompt.submit: lembrete do pedido, tarefas abertas, resposta pelo chat, tarefa em segundo plano, subagente e aviso do app', async ($, on) => {
    host(on, () => true)
    on('tool.call', { tool: 'AskUserQuestion' }, async () => ({ result: 'The user did not answer; sent a message instead' }))
    const fresh = contexts(await $.prompt.submit({ text: 'pedido' } as any))
    keep('prompt.submit: lembrete', fresh[fresh.length - 1])
    expect(fresh.length).toBe(1)
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Pedido', children: [{ id: '1', title: 'Perguntar' }] }] })
    await call($, 'start', { ids: ['1'] })
    const asked = contexts(await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any))
    keep('AskUserQuestion: respondida pelo chat', asked[0])
    const answered = contexts(await $.prompt.submit({ text: 'resposta' } as any))
    keep('prompt.submit: tarefas abertas, resposta pelo chat', answered[0])
    expect(answered.length).toBe(2)
    const again = contexts(await $.prompt.submit({ text: 'outro' } as any))
    keep('prompt.submit: tarefas abertas', again[0])
    keep('prompt.submit: tarefa em segundo plano', contexts(await $.prompt.submit({ text: 'x', origin: { kind: 'task-notification' } } as any))[0])
    keep('prompt.submit: subagente terminou', contexts(await $.prompt.submit({ text: '<agent-message from="a1">[Subagent hand-back] feito</agent-message>' } as any))[0])
    keep('prompt.submit: aviso do app', contexts(await $.prompt.submit({ text: 'x', origin: { kind: 'unclassified' } } as any))[0])
  })

  test('AskUserQuestion: recusada sem tarefa aberta; respondida por opção', async ($, on) => {
    host(on, () => true)
    on('tool.call', { tool: 'AskUserQuestion' }, async () => ({ result: 'ok' }))
    keep('AskUserQuestion: sem tarefa aberta', result(await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)))
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Pedido' }] })
    keep('AskUserQuestion: respondida', contexts(await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any))[0])
  })

  test('done: falta o summary; etapas fechadas juntas sem start; mensagem ainda na fila', async ($, on) => {
    host(on, () => true)
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Pedido', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }] })
    keep('done: etapas juntas sem start, falta o summary', warnings(await call($, 'done', { ids: ['1', '2'] })))
    await call($, 'plan', { tasks: [{ id: 'B', title: 'Envio', children: [{ id: '1', title: 'Abrir' }, { id: '2', title: 'Avisar' }] }] })
    await call($, 'start', { ids: ['1'] })
    await refresh($)
    await call($, 'done', { ids: ['1'] })
    await call($, 'start', { ids: ['2'] })
    keep('SendMessage: na fila', contexts(await $.tool.call({ tool: 'SendMessage', to: KID, message: 'm' } as any))[0])
    keep('done: mensagem na fila', warnings(await call($, 'done', { ids: ['2'], summary: 'ok' })))
  })

  test('wrap_up: falta o resumo e tarefas abertas; chamada sem plano', async ($, on) => {
    host(on, () => true)
    keep('tool.call: sem plano', contexts(await $.tool.call({ tool: 'Read', file_path: 'a' } as any))[0])
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Pedido', children: [{ id: '1', title: 'Um' }] }] })
    await call($, 'start', { ids: ['1'] })
    const notes = contexts(await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r' } as any))
    keep('wrap_up: falta o resumo', notes[0])
    keep('wrap_up: tarefas abertas', notes[1])
    expect(notes.length).toBe(2)
  })

  test('sessão: terminou o turno; recebimento confirmado', async ($, on) => {
    let running = true
    host(on, () => running)
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Avisar' }] }] })
    await call($, 'start', { ids: ['1'] })
    await refresh($)
    running = false
    keep('sessão: terminou o turno', contexts(await refresh($))[0])
    await call($, 'done', { ids: ['1'] })
    await call($, 'start', { ids: ['2'] })
    running = true
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'm' } as any)
    running = false
    await refresh($)
    running = true
    keep('sessão: recebimento confirmado', contexts(await refresh($))[0])
  })

  test('todos iguais ao golden, e todos citam o mesmo limite do resumo', async () => {
    const names = Object.keys(got).sort()
    const diff = names.filter(n => TEXTOS[n] !== got[n]).concat(Object.keys(TEXTOS).filter(n => !(n in got)))
    if (diff.length > 0) console.log('TEXTOS-NEW ' + JSON.stringify(Object.fromEntries(names.map(n => [n, got[n]]))))
    expect(diff).toEqual([])
    // Every text that names the summary's limit names the same one.
    const limits = names.flatMap(n => [...got[n].matchAll(/até (\d+) caracteres/g)].map(m => ({ name: n, limit: m[1] })))
    expect(limits.length).toBeGreaterThanOrEqual(6)
    expect(limits.filter(l => l.limit !== '120')).toEqual([])
  })
})
