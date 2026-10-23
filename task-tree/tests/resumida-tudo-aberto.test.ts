import { describe, expect, test } from 'claude-code/testing'

// The summary view, in the person's words after the visual test: "as tarefas concluídas deveriam ficar
// do jeito que estão até todas as tarefas estarem concluídas, só então o painel seria resetado com um
// novo turno; senão, as tarefas vão sendo adicionadas no painel". So: a new request with ANYTHING open
// in sight (a task of a request in sight, or a card under one with an open task) keeps everything, done
// requests included, and is added below; only with everything in sight closed does the new request
// clear the summary. A live session under a request out of sight does not pull that request back.

const KID = 'local_11111111-1111-1111-1111-111111111111'
const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { top: 0, bodyRows: 60 }, view: {} } as any
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
// The task lines only: the header's title is the task started last, whatever the view shows.
const has = (lines: string[], s: string) => lines.slice(2).some(l => l.includes(s))
const at = (lines: string[], s: string) => lines.findIndex((l, i) => i >= 2 && l.includes(s))

describe('resumida: nada sai enquanto houver algo aberto à vista', () => {
  test('pedido concluído fica enquanto outro pedido à vista tem tarefa aberta; o pedido novo é acrescentado embaixo', async ($, on) => {
    host(on, [])
    await ask($, 'primeiro pedido')
    await call($, 'plan', { tasks: [{ id: 'B', title: 'Passo 5', children: [{ id: '1', title: 'Ocupar' }, { id: '2', title: 'Mensagem 2' }] }], request: 'primeiro pedido' })
    await call($, 'start', { ids: ['B/1'] })
    await call($, 'done', { ids: ['B/1'] })
    await end($)
    // A request done while "Mensagem 2" is still open: it stays with the open one.
    await ask($, 'segundo pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Erro de recarga do plugin' }], request: 'segundo pedido' })
    await call($, 'start', { ids: ['A'] })
    await call($, 'done', { ids: ['A'] })
    await end($)
    await ask($, 'pode seguir')
    await call($, 'plan', { tasks: [{ id: 'C', title: 'Seguir' }], request: 'pode seguir' })
    const lines = await summary($)
    expect(has(lines, 'Passo 5')).toBe(true)
    expect(has(lines, 'Erro de recarga do plugin')).toBe(true)
    expect(at(lines, 'Passo 5')).toBeLessThan(at(lines, 'Erro de recarga do plugin'))
    expect(at(lines, 'Erro de recarga do plugin')).toBeLessThan(at(lines, 'Seguir'))
  })

  test('um cartão com tarefa aberta sob um pedido concluído segura o painel (a sessão parada)', async ($, on) => {
    host(on, [{ id: 'O1', short: 'O1', title: 'Lote: ocupado', status: 'open', children: [] }], false)
    await ask($, 'repetir o passo 5')
    await call($, 'plan', { tasks: [{ id: 'M3', title: 'Mensagem 3 na fila' }], request: 'repetir o passo 5' })
    await call($, 'start', { ids: ['M3'] })
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await call($, 'done', { ids: ['M3'] })
    await end($)
    await ask($, 'passo 5 do zero')
    await call($, 'plan', { tasks: [{ id: 'Z', title: 'Ocupar de novo' }], request: 'passo 5 do zero' })
    const lines = await summary($)
    expect(has(lines, 'Mensagem 3 na fila')).toBe(true)
    expect(has(lines, 'Lote: ocupado')).toBe(true)
    expect(has(lines, 'Ocupar de novo')).toBe(true)
  })

  test('tudo à vista concluído, cartões inclusive: a mensagem nova limpa, mesmo com a sessão ainda viva', async ($, on) => {
    host(on, [{ id: 'X', short: 'X', title: 'Trabalho feito', status: 'done', children: [] }], true)
    await ask($, 'primeiro pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Abrir a filha' }], request: 'primeiro pedido' })
    await call($, 'start', { ids: ['A'] })
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await call($, 'done', { ids: ['A'] })
    await end($)
    await ask($, 'segundo pedido')
    await call($, 'plan', { tasks: [{ id: 'B', title: 'Pedido novo' }], request: 'segundo pedido' })
    const lines = await summary($)
    expect(has(lines, 'Pedido novo')).toBe(true)
    // The live session under the done request does not pull the request back.
    expect(has(lines, 'Abrir a filha')).toBe(false)
    expect(has(lines, '⑂ filha')).toBe(false)
  })
})
