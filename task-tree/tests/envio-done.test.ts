import { describe, expect, test } from 'claude-code/testing'
import { MAIN, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Group, Panel, TaskNode, Turn } from '../types'

// Two rules from the visual test. (1) The ✉ of a message not yet taken up stays on its task until the
// delivery, also when the model closed the task with done right after sending (the person: the panel
// must not depend on the model leaving the task open); the done used to drop the send, and the task
// came out ✓ at once. (2) A request whose tasks are all closed but one of them interrupted is not ✓:
// it reads interrupted (the docs card showed "✓ 1/1" with a ✕ inside).

const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { top: 0, bodyRows: 60 }, view: {} } as any
const GLYPHS = /^[○◉✓✕◷⑂▸✉↩]$/
type Line = { text: string; glyph?: string; title?: string }
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
async function view($: any): Promise<Line[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  const root: any = await ui.drawn()
  await ui.unmount()
  return (root.children as any[])
    .filter(c => typeof c === 'object')
    .map(t => {
      const parts = (t.children as any[]).filter(c => typeof c === 'object')
      const icon = parts.find(p => GLYPHS.test(shown(p)))
      const title = icon ? parts[parts.indexOf(icon) + 1] : undefined
      return { text: shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd(), glyph: icon ? shown(icon) : undefined, title: title ? shown(title).trim() : undefined }
    })
}
const line = (lines: Line[], title: string) => lines.find(l => l.title === title)
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })
const KID = 'local_99999999-9999-9999-9999-999999999999'

// The host: the session the message goes to, running or stopped as the test says; its file has no
// `received`, so the delivery is read from its state (stopped after the send, then running again).
function host(on: any) {
  const h = { running: true }
  on('clock.now', () => ({ value: 100 }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('fs.write', () => ({ value: undefined }) as any)
  on('fs.read', () => ({ value: '{}' }) as any)
  on('prompt.submit', (_$: any, e: any) => e)
  on('mcp.call', () => ({
    value: {
      content: [{ type: 'text', text: JSON.stringify([
        { sessionId: 'local_pai', title: 'Pai', isRunning: false },
        { sessionId: KID, name: 'filha', title: 'Filha', isRunning: h.running, isArchived: false, startedBy: 'local_eu' },
      ]) }],
      isError: false,
    },
  }) as any)
  on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'Message queued; it will be delivered later' }))
  on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
  return h
}
const refresh = ($: any) => $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)

describe('✉ depois do done', () => {
  test('a tarefa de envio concluída com done logo depois de mandar continua ✉ até a entrega; entregue, fica ✓', async ($, on) => {
    const h = host(on)
    await $.prompt.submit({ text: 'um pedido', origin: { kind: 'composer' } } as any)
    await call($, 'plan', { tasks: [{ id: 'M2', title: 'Mensagem 2 na fila' }, { id: 'M3', title: 'Mensagem 3 na fila' }], request: 'um pedido' })
    await call($, 'start', { ids: ['M2'] })
    await refresh($)
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'faça' } as any)
    const r = await call($, 'done', { ids: ['M2'] })
    // The done is accepted (with the warning), and the task keeps the envelope.
    expect(String(r.result)).toContain('Concluídas')
    expect(line(await view($), 'Mensagem 2 na fila')?.glyph).toBe('✉')
    // The session stops (the message is queued) and runs again: it took the message up.
    h.running = false
    await refresh($)
    expect(line(await view($), 'Mensagem 2 na fila')?.glyph).toBe('✉')
    h.running = true
    await refresh($)
    expect(line(await view($), 'Mensagem 2 na fila')?.glyph).toBe('✓')
  })
})

// A request's line with its tasks all closed: ✓ only if none is interrupted.
const task = (id: string, title: string, status: TaskNode['status'], extra: Partial<TaskNode> = {}): TaskNode => ({ id, short: id, title, status, children: [], ...extra })
const turn = (id: number, at: number): Turn => ({ id, title: `Pedido ${id}`, at })
const main = (tasks: TaskNode[], turns: Turn[]): Group => ({ agent: MAIN, label: '', tasks, turns })
const model = (groups: Group[]): Model => ({ groups, waits: [], children: [], sends: [], view: 'full', work: [] })
const row = (rows: Row[], title: string) => rows.find(r => r.title === title)
const T0 = 1_000_000

describe('pedido com tarefa interrompida', () => {
  test('tudo fechado e uma interrompida: o pedido é ✕, não ✓; só concluídas: ✓', () => {
    const mixed = main([task('1', 'Feita', 'done', { turn: 1, startedAt: T0, endedAt: T0 + 10 }), task('2', 'Cortada', 'interrupted', { turn: 1, startedAt: T0 + 10, endedAt: T0 + 20 })], [turn(1, T0)])
    expect(row(layout(model([mixed]), {}, T0 + 100, 'local_eu'), 'Pedido 1')?.tone).toBe('interrupted')
    const deep = main([task('H', 'Hunks', 'done', { turn: 1, startedAt: T0, endedAt: T0 + 20, children: [task('H/1', 'Ler', 'interrupted', { startedAt: T0, endedAt: T0 + 5 }), task('H/2', 'Mandar', 'done', { startedAt: T0 + 5, endedAt: T0 + 20 })] })], [turn(1, T0)])
    expect(row(layout(model([deep]), {}, T0 + 100, 'local_eu'), 'Pedido 1')?.tone).toBe('interrupted')
    const clean = main([task('1', 'Feita', 'done', { turn: 1, startedAt: T0, endedAt: T0 + 10 }), task('2', 'Outra', 'done', { turn: 1, startedAt: T0 + 10, endedAt: T0 + 20 })], [turn(1, T0)])
    expect(row(layout(model([clean]), {}, T0 + 100, 'local_eu'), 'Pedido 1')?.tone).toBe('done')
  })
})
