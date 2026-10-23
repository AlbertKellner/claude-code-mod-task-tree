import { describe, expect, test } from 'claude-code/testing'
import { MAIN, count, flat, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Group, Panel, TaskNode, Turn } from '../types'

// A session that ended its turn is not working: the tasks it left open no longer read as in progress.
// They are drawn with no close (interrupted, not done), with no clock running, and out of "em
// andamento". The person's panel: the card "docs-task-tree  parada" with its task and a subtask ◉, the
// clock running, the ↩ line already there.

const task = (id: string, title: string, status: TaskNode['status'] = 'open', extra: Partial<TaskNode> = {}): TaskNode => ({ id, short: id.split('/').pop() as string, title, status, children: [], ...extra })
const turn = (id: number, at: number, extra: Partial<Turn> = {}): Turn => ({ id, title: `Pedido ${id}`, at, ...extra })
const main = (tasks: TaskNode[], turns?: Turn[]): Group => ({ agent: MAIN, label: '', tasks, ...(turns ? { turns } : {}) })
const panel = (tasks: TaskNode[], turns?: Turn[], extra: Partial<Panel> = {}): Panel => ({ groups: [main(tasks, turns)], waits: [], children: [], ...extra })
const child = (id: string, name: string, p: Panel, extra: Partial<Child> = {}): Child => ({ id, name, title: name, running: false, archived: false, panel: p, ...extra })
const model = (groups: Group[], children: Child[] = [], extra: Partial<Model> = {}): Model => ({ groups, waits: [], children, sends: [], view: 'full', work: [], ...extra })
const T0 = 1_000_000
const NOW = 2_000_000
const ME = 'local_eu'
const row = (rows: Row[], title: string) => rows.find(r => r.title === title)

const docs = (running: boolean) =>
  child('local_docs', 'docs', panel(
    [task('H', 'Hunks do bug dos cliques', 'open', {
      turn: 1, started: 1, plannedAt: T0 + 10, startedAt: T0 + 10,
      children: [task('H/1', 'Ler o código e o doc', 'open', { started: 2, plannedAt: T0 + 10, startedAt: T0 + 20 }), task('H/2', 'Mandar os hunks', 'done', { plannedAt: T0 + 10, startedAt: T0 + 30, endedAt: T0 + 60 })],
    })],
    [turn(1, T0 + 5, { reply: 'Hunks enviados.', brief: 'Hunks enviados' })],
  ), { anchor: 'M', running })
const mother = () => main([task('M', 'Pedir a docs', 'open', { started: 1, plannedAt: T0, startedAt: T0 })])

describe('sessão que terminou o turno: as tarefas abertas dela não ficam em andamento', () => {
  test('parada: a tarefa e a subtarefa que ficaram abertas não estão acesas nem cronometrando, e saem do "em andamento"', () => {
    const rows = layout(model([mother()], [docs(false)]), {}, NOW, ME)
    expect(row(rows, 'docs')?.meta).toBe('parada')
    for (const title of ['Hunks do bug dos cliques', 'Ler o código e o doc']) {
      const r = row(rows, title) as Row
      expect([title, r.tone]).toEqual([title, 'interrupted'])
      // No clock running: not the time to now.
      expect(r.time === undefined || r.time === null || (r.time as number) < NOW - T0 - 1000).toBe(true)
    }
    // The header's "em andamento": no open leaf of the stopped session (the mother's own task stays).
    const shown = rows.flatMap(r => r.nodes ?? [])
    expect(flat(shown).filter(t => t.status === 'open' && t.children.length === 0).map(t => t.title)).toEqual(['Pedir a docs'])
    // Not done either: of the leaves, the mother's open one and the closed subtask count (1 of 2), and
    // the subtask left open is interrupted, out of the count.
    expect(count(shown)).toEqual([1, 2, 1])
  })

  test('trabalhando: as mesmas tarefas seguem em andamento (regra mantida)', () => {
    const rows = layout(model([mother()], [docs(true)]), {}, NOW, ME)
    expect(row(rows, 'Ler o código e o doc')?.tone).toBe('current')
  })
})

// The same for this session's own pane ("vale para qualquer sessão, inclusive a principal"): once its
// turn ends, what it left open is drawn with no close and no clock, until the next prompt.
const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { top: 0, bodyRows: 60 }, view: {} } as any
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
function host(on: any) {
  let t = 1_000
  on('clock.now', () => ({ value: (t += 100) }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('fs.write', () => ({ value: undefined }) as any)
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }) as any)
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: '[]' }], isError: false } }) as any)
}
async function pane($: any): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  const root: any = await ui.drawn()
  await ui.unmount()
  return shown(root)
}
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })
const ask = ($: any, text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as any)
const end = ($: any) => $.turn.complete({ reason: 'answer', answer: 'Feito.', durationMs: 1, isAborted: false, turnId: 't' } as any)

describe('a própria sessão, depois do fim do turno', () => {
  test('a tarefa deixada aberta não fica acesa depois do fim do turno; volta com o próximo pedido', async ($, on) => {
    host(on)
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: 'R', title: 'Revisar', children: [{ id: '1', title: 'Ler' }, { id: '2', title: 'Escrever' }] }], request: 'um pedido' })
    await call($, 'start', { ids: ['R/1'] })
    expect(await pane($)).toContain('◉ Ler')
    await end($)
    const after = await pane($)
    expect(after).not.toContain('◉ Ler')
    expect(after).toContain('✕ Ler')
    await ask($, 'continue')
    expect(await pane($)).toContain('◉ Ler')
  })
})
