import { describe, expect, test } from 'claude-code/testing'

// After a hot reload of the mod (a saved edit of the clone reloads it in every session), the 1 s clock
// that redraws the pane (keepTime/tick → $.ui.invalidate) was a variable of the old module, gone with
// it, and it came back only with the next event that starts it (a tool call, a refresh, a start). With
// a task timing and no event, the pane stood still (the orchestrator's pane "froze" while the clone was
// being edited). The app draws the pane again when the mod loads: that drawing starts the clocks.

const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} } as any

// A hot reload keeps the host's `$.state`: the test seeds it beneath the kit's own state.
function seedState(on: any, state: Record<string, unknown>) {
  const written = new Set<string>()
  on('state.get', async (_$: any, e: any, next: any) => {
    const r = await next(e)
    if (r?.value?.value === undefined && !written.has(e.key) && state[e.key] !== undefined) return { value: { ...r.value, value: state[e.key] } }
    return r
  })
  on('state.set', async (_$: any, e: any, next: any) => {
    written.add(e.key)
    return next(e)
  })
}

type Clocks = { every: number[] }
function host(on: any): Clocks {
  const h: Clocks = { every: [] }
  on('clock.now', () => ({ value: 50_000 }) as any)
  on('clock.every', (_$: any, e: any) => {
    h.every.push(Number(e?.ms ?? e?.args?.[0] ?? 0))
    return { deny: 'sem relógio no teste' } as any
  })
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('fs.write', () => ({ value: undefined }) as any)
  on('fs.read', () => ({ value: '{}' }) as any)
  on('store.get', () => ({ value: undefined }) as any)
  on('store.set', () => ({ value: undefined }) as any)
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: '[]' }], isError: false } }) as any)
  return h
}

const RUNNING = {
  groups: [{ agent: '', label: '', turns: [{ id: 1, title: 'Pedido', at: 10_000 }], tasks: [{ id: 'A', short: 'A', title: 'Cronometrando', status: 'open', started: 1, plannedAt: 10_000, startedAt: 10_000, turn: 1, children: [] }] }],
  work: ['A'],
  view: 'full',
}
const IDLE = {
  groups: [{ agent: '', label: '', turns: [{ id: 1, title: 'Pedido', at: 10_000 }], tasks: [{ id: 'A', short: 'A', title: 'Feita', status: 'done', plannedAt: 10_000, startedAt: 10_000, endedAt: 20_000, turn: 1, children: [] }] }],
  work: ['A'],
  view: 'full',
}

describe('relógio depois de uma recarga do mod', () => {
  test('com uma tarefa cronometrando, o desenho da recarga já pede o relógio de 1 s, sem nenhum outro evento', async ($, on) => {
    seedState(on, JSON.parse(JSON.stringify(RUNNING)))
    const h = host(on)
    // The new module's first drawing (the app draws the pane on plugin load): no tool call, prompt or start.
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
    await ui.drawn()
    await ui.unmount()
    expect(h.every).toContain(1000)
  })

  test('sem nada cronometrando, o desenho não liga o relógio de 1 s', async ($, on) => {
    seedState(on, JSON.parse(JSON.stringify(IDLE)))
    const h = host(on)
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
    await ui.drawn()
    await ui.unmount()
    expect(h.every).not.toContain(1000)
  })
})
