import { describe, expect, test } from 'claude-code/testing'

// The summary view follows the person's requests. The person's rule (after the visual test): "as
// tarefas concluídas deveriam ficar do jeito que estão até todas as tarefas estarem concluídas, só
// então o painel seria resetado com um novo turno; senão, as tarefas vão sendo adicionadas no painel".
// A new message with anything open in sight (a task of a request in sight, or a card under one with
// an open task, the session stopped or not) keeps everything in sight, done requests included, and
// is added below; with nothing open in sight, it clears the summary. A live session under a request
// out of sight does not pull it back (see resumida-tudo-aberto.test.ts).

const KID = 'local_11111111-1111-1111-1111-111111111111'
const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { top: 0, bodyRows: 60 }, view: {} } as any
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })

async function summary($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  await ui.press({ key: 'view:summary' })
  await ui.unmount()
  const again = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  const root: any = await again.drawn()
  await again.unmount()
  return (root.children as any[]).filter(c => typeof c === 'object').map(t => shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd())
}

type Host = { t: number; running: boolean; childTasks: unknown[] }
// A host with one child session (opened by this one), its published panel and a clock.
function host(on: any, childTasks: unknown[], running = false): Host {
  const h: Host = { t: 1_000, running, childTasks }
  on('clock.now', () => ({ value: (h.t += 100) }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('fs.write', () => ({ value: undefined }) as any)
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }) as any)
  on('fs.read', (_$: any, e: any) =>
    ({ value: String(e.path).includes('11111111') ? JSON.stringify({ version: 1, waiting: false, groups: [{ agent: '', label: '', tasks: h.childTasks }], waits: [], children: [] }) : '{}' }) as any)
  on('mcp.call', (_$: any, e: any) => {
    if (e.tool === 'get_session') return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any
    return { value: { content: [{ type: 'text', text: JSON.stringify([{ sessionId: KID, name: 'filha', title: 'Filha', isRunning: h.running, isArchived: false, startedBy: 'local_eu' }]) }], isError: false } } as any
  })
  on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
  return h
}
const ask = ($: any, text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as any)
const end = ($: any) => $.turn.complete({ reason: 'answer', answer: 'Feito.', durationMs: 1, isAborted: false, turnId: 't' } as any)
// A child that stopped with a task left open (it never closed it): an open leaf in its panel.
const STALE = [{ id: 'X', short: 'X', title: 'Esquecida pela filha', status: 'open', children: [] }]
const has = (lines: string[], s: string) => lines.some(l => l.includes(s))

describe('visão resumida: só as tarefas do pedido atual e o que ainda corre', () => {
  test('dois pedidos concluídos e uma filha parada com folha aberta: a folha aberta segura os dois, e o novo entra embaixo', async ($, on) => {
    host(on, STALE)
    await ask($, 'primeiro pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Abrir a filha' }], request: 'primeiro pedido' })
    await call($, 'start', { ids: ['A'] })
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await call($, 'done', { ids: ['A'] })
    await end($)
    await ask($, 'segundo pedido')
    await call($, 'plan', { tasks: [{ id: 'B', title: 'Segundo pedido feito' }], request: 'segundo pedido' })
    await call($, 'done', { ids: ['B'] })
    await end($)
    await ask($, 'terceiro pedido')
    await call($, 'plan', { tasks: [{ id: 'C', title: 'Terceiro pedido novo' }], request: 'terceiro pedido' })
    await call($, 'start', { ids: ['C'] })
    const lines = await summary($)
    expect(has(lines, 'Terceiro pedido novo')).toBe(true)
    expect(has(lines, 'Segundo pedido feito')).toBe(true)
    expect(has(lines, 'Abrir a filha')).toBe(true)
    expect(has(lines, 'Esquecida pela filha')).toBe(true)
    expect(has(lines, 'pedidos anteriores')).toBe(false)
  })

  test('um pedido anterior com tarefa ainda aberta continua, e o concluído também (nada sai)', async ($, on) => {
    host(on, STALE)
    await ask($, 'primeiro pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Abrir a filha' }], request: 'primeiro pedido' })
    await call($, 'start', { ids: ['A'] })
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await call($, 'done', { ids: ['A'] })
    await end($)
    await ask($, 'segundo pedido')
    await call($, 'plan', { tasks: [{ id: 'B', title: 'Ainda aberto', children: [{ id: '1', title: 'Passo feito' }, { id: '2', title: 'Passo pendente' }] }], request: 'segundo pedido' })
    await call($, 'done', { ids: ['B/1'] })
    await end($)
    await ask($, 'terceiro pedido')
    await call($, 'plan', { tasks: [{ id: 'C', title: 'Terceiro pedido novo' }], request: 'terceiro pedido' })
    await call($, 'start', { ids: ['C'] })
    const lines = await summary($)
    expect(has(lines, 'Terceiro pedido novo')).toBe(true)
    expect(has(lines, 'Ainda aberto')).toBe(true)
    expect(has(lines, 'Passo pendente')).toBe(true)
    expect(has(lines, 'Abrir a filha')).toBe(true)
  })

  // A live session with an open task under a done task of an earlier request: its card holds
  // everything in sight (the other done requests too), with the card under the task that opened it.
  test('uma sessão trabalhando com tarefa aberta sob uma tarefa concluída segura tudo à vista, com o cartão no lugar', async ($, on) => {
    const h = host(on, [{ id: 'X', short: 'X', title: 'Trabalho da filha', status: 'open', started: 1, children: [] }], true)
    await ask($, 'primeiro pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Abrir a filha' }], request: 'primeiro pedido' })
    await call($, 'start', { ids: ['A'] })
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await call($, 'done', { ids: ['A'] })
    await end($)
    await ask($, 'segundo pedido')
    await call($, 'plan', { tasks: [{ id: 'B', title: 'Segundo pedido feito' }], request: 'segundo pedido' })
    await call($, 'done', { ids: ['B'] })
    await end($)
    await ask($, 'terceiro pedido')
    await call($, 'plan', { tasks: [{ id: 'C', title: 'Terceiro pedido novo' }], request: 'terceiro pedido' })
    await call($, 'start', { ids: ['C'] })
    expect(h.running).toBe(true)
    const lines = await summary($)
    expect(has(lines, 'Terceiro pedido novo')).toBe(true)
    expect(has(lines, 'Segundo pedido feito')).toBe(true)
    // The card right under the task that opened the session, in its request.
    const origin = lines.findIndex(l => l.includes('Abrir a filha'))
    expect(origin).toBeGreaterThanOrEqual(0)
    expect(lines[origin + 1]).toContain('⑂ filha')
    expect(has(lines, 'Trabalho da filha')).toBe(true)
  })

  test('no mesmo pedido, um plano depois de tudo concluído soma ao trabalho atual (regra mantida)', async ($, on) => {
    host(on, [])
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Primeira parte' }], request: 'um pedido' })
    await call($, 'done', { ids: ['A'] })
    await call($, 'plan', { tasks: [{ id: 'B', title: 'Segunda parte' }] })
    await call($, 'start', { ids: ['B'] })
    const lines = await summary($)
    expect(has(lines, 'Primeira parte')).toBe(true)
    expect(has(lines, 'Segunda parte')).toBe(true)
  })
})
