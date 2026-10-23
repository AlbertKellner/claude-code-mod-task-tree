import { describe, expect, test } from 'claude-code/testing'
import { MAIN, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Group, Panel, TaskNode, Turn } from '../types'

// A session's card goes under the task its message was sent from. The plans reuse level-1 ids
// between requests ("1", "2", "3" again in the next request): when a new plan reuses the id of a
// closed task, the closed one is renamed ("ab12:1") and the new one takes the id. The sessions'
// ties (anchor, lastAnchor, the rounds' anchors) kept the bare id, so every card of every earlier
// request fell under the newest task with that id (the person's panel: a request with no message
// sent showed the cards of the whole day under its task). Here: the cards stay with the task that
// sent the message, drawn or renamed, and a request that sent nothing shows no card.

const task = (id: string, title: string, status: TaskNode['status'] = 'open', extra: Partial<TaskNode> = {}): TaskNode => ({ id, short: id.split('/').pop() as string, title, status, children: [], ...extra })
const turn = (id: number, at: number, extra: Partial<Turn> = {}): Turn => ({ id, title: `Pedido ${id}`, at, ...extra })
const main = (tasks: TaskNode[], turns?: Turn[]): Group => ({ agent: MAIN, label: '', tasks, ...(turns ? { turns } : {}) })
const panel = (tasks: TaskNode[], turns?: Turn[], extra: Partial<Panel> = {}): Panel => ({ groups: [main(tasks, turns)], waits: [], children: [], ...extra })
const child = (id: string, name: string, p: Panel, extra: Partial<Child> = {}): Child => ({ id, name, title: name, running: false, archived: false, panel: p, ...extra })
const model = (groups: Group[], children: Child[] = [], extra: Partial<Model> = {}): Model => ({ groups, waits: [], children, sends: [], view: 'full', work: [], ...extra })
const titles = (rows: Row[]) => rows.map(r => `${'  '.repeat(r.depth)}${r.tone === 'section' ? '§ ' : r.session ? '⑂ ' : r.tone === 'reply' ? '↩ ' : ''}${r.title}`)
const T0 = 1_000_000
const NOW = 2_000_000
const ME = 'local_eu'

describe('cartões ficam na tarefa que mandou a mensagem, mesmo com o id reutilizado', () => {
  test('layout: a rodada ancorada em "1" quando "1" era a tarefa velha (depois renomeada) fica na velha, não na nova', () => {
    // Request 1 planned "1" (Velha), sent the message, closed; request 2 planned "1" again (Nova):
    // the old one is now "ab12:1". The round's anchor is still "1".
    const velha = task('ab12:1', 'Velha', 'done', { turn: 1, plannedAt: T0, startedAt: T0, endedAt: T0 + 800 })
    const nova = task('1', 'Nova', 'open', { turn: 2, started: 1, plannedAt: T0 + 1000, startedAt: T0 + 1000 })
    const mother = main([velha, nova], [turn(1, T0), turn(2, T0 + 1000)])
    const filha = child('local_f', 'filha', panel([task('F', 'Feito', 'done', { turn: 1, plannedAt: T0 + 510, startedAt: T0 + 510, endedAt: T0 + 700 })], [turn(1, T0 + 505, { reply: 'ok' })]), {
      anchor: '1',
      lastAnchor: '1',
      rounds: [{ at: T0 + 500, anchor: '1' }],
    })
    const rows = layout(model([mother], [filha]), {}, NOW, ME)
    expect(titles(rows)).toEqual(['Pedido 1', '  Velha', '    ⑂ filha', '      Feito', '      ↩ resposta', 'Pedido 2', '  Nova'])
    // The same in the summary view: the current work (Nova) has no card.
    const summary = layout(model([mother], [filha], { view: 'summary', work: ['1'] }), {}, NOW, ME)
    expect(titles(summary).some(t => t.includes('filha'))).toBe(false)
  })

  test('layout: duas renomeações do mesmo id: cada rodada vai à tarefa que era "1" quando a mensagem saiu', () => {
    const a = task('ab12:1', 'Primeira', 'done', { turn: 1, plannedAt: T0, startedAt: T0, endedAt: T0 + 900 })
    const b = task('cd34:1', 'Segunda', 'done', { turn: 2, plannedAt: T0 + 1000, startedAt: T0 + 1000, endedAt: T0 + 1900 })
    const c = task('1', 'Terceira', 'open', { turn: 3, started: 1, plannedAt: T0 + 2000, startedAt: T0 + 2000 })
    const mother = main([a, b, c], [turn(1, T0), turn(2, T0 + 1000), turn(3, T0 + 2000)])
    const filha = child(
      'local_f',
      'filha',
      panel(
        [task('F1', 'Um', 'done', { turn: 1, plannedAt: T0 + 510, startedAt: T0 + 510, endedAt: T0 + 700 }), task('F2', 'Dois', 'done', { turn: 2, plannedAt: T0 + 1510, startedAt: T0 + 1510, endedAt: T0 + 1700 })],
        [turn(1, T0 + 505, { reply: 'um' }), turn(2, T0 + 1505, { reply: 'dois' })],
      ),
      { anchor: '1', lastAnchor: '1', rounds: [{ at: T0 + 500, anchor: '1' }, { at: T0 + 1500, anchor: '1' }] },
    )
    const rows = layout(model([mother], [filha]), {}, NOW, ME)
    const t = titles(rows)
    expect(t.indexOf('    ⑂ filha')).toBeGreaterThan(t.indexOf('  Primeira'))
    expect(t.filter(x => x === '    ⑂ filha').length).toBe(2)
    expect(t.slice(t.indexOf('  Terceira'))).toEqual(['  Terceira'])
    expect(t.indexOf('      Um')).toBeLessThan(t.indexOf('  Segunda'))
    expect(t.indexOf('      Dois')).toBeGreaterThan(t.indexOf('  Segunda'))
    expect(t.indexOf('      Dois')).toBeLessThan(t.indexOf('Pedido 3'))
  })
})

// The same through the tools: plan "1", open a session on it, close it, a new request plans "1"
// again (the old one is renamed): the card stays under the old task.
const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} } as any
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
async function lines($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  const root: any = await ui.drawn()
  await ui.unmount()
  return (root.children as any[]).filter(c => typeof c === 'object').map(t => shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd())
}
const KID = 'local_11111111-1111-1111-1111-111111111111'
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })

describe('cartões com ids reutilizados, pelas ferramentas', () => {
  test('plan "1" → sessão aberta nela → done → novo pedido planeja "1" de novo: o cartão fica na tarefa velha', async ($, on) => {
    let t = 1_000
    on('clock.now', () => ({ value: (t += 100) }) as any)
    on('clock.every', () => ({ deny: 'sem relógio' }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('ui.status', () => ({ value: undefined }) as any)
    on('ui.log', () => ({ value: undefined }) as any)
    on('fs.write', () => ({ value: undefined }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    on('turn.complete', () => ({ text: '' }) as any)
    const file = { version: 1, waiting: false, groups: [{ agent: '', label: '', tasks: [{ id: 'F', short: 'F', title: 'Feito pela filha', status: 'done', children: [] }] }], waits: [], children: [] }
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify(file) : '{}' }) as any)
    on('mcp.call', (_$: any, e: any) => {
      if (e.tool === 'get_session') return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any
      return { value: { content: [{ type: 'text', text: JSON.stringify([{ sessionId: KID, name: 'filha', title: 'Filha', isRunning: false, isArchived: false, startedBy: 'local_eu' }]) }], isError: false } } as any
    })
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    on('tool.call', { tool: 'Read' } as any, async () => ({ result: 'ok' }))
    await $.prompt.submit({ text: 'primeiro pedido', origin: { kind: 'composer' } } as any)
    await call($, 'plan', { tasks: [{ id: '1', title: 'Velha' }], request: 'primeiro pedido' })
    await call($, 'start', { ids: ['1'] })
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await call($, 'done', { ids: ['1'], summary: 'feito' })
    await $.turn.complete({ reason: 'answer', answer: 'Feito.', durationMs: 1, isAborted: false, turnId: 't1' } as any)
    await $.prompt.submit({ text: 'segundo pedido', origin: { kind: 'composer' } } as any)
    await call($, 'plan', { tasks: [{ id: '1', title: 'Nova' }], request: 'segundo pedido' })
    await call($, 'start', { ids: ['1'] })
    // The host's list read again: the ties come back from the state.
    t += 4_000
    await $.tool.call({ tool: 'Read', file_path: 'x' } as any)
    // The lines below the header and its bar.
    const out = (await lines($)).slice(2)
    const at = (s: string) => out.findIndex(l => l.includes(s))
    expect(at('Velha')).toBeGreaterThanOrEqual(0)
    expect(at('Nova')).toBeGreaterThan(at('Velha'))
    expect(at('filha')).toBeGreaterThan(at('Velha'))
    expect(at('filha')).toBeLessThan(at('Nova'))
    expect(at('Feito pela filha')).toBeLessThan(at('Nova'))
  })
})
