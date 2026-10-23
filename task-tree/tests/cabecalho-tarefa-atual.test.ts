import { describe, expect, test } from 'claude-code/testing'

// The header's title is the level-1 task of the work in progress now: the task started last. It took the
// first of the lit tasks, the one started longest ago, so a task an earlier request left open and started
// won over the current one (the person's panel: the header showed "Abrir a sessão de correção (Fable,
// esforço médio) e conferir modelo", from many requests before, while "Corrigir com TDD" was in progress).

const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { top: 0, bodyRows: 60 }, view: {} } as any
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })

async function header($: any, view: 'full' | 'summary'): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  await ui.press({ key: `view:${view}` })
  await ui.unmount()
  const again = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  const root: any = await again.drawn()
  await again.unmount()
  return shown((root.children as any[]).find(c => typeof c === 'object'))
}

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
const ask = ($: any, text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as any)
const end = ($: any) => $.turn.complete({ reason: 'answer', answer: 'Feito.', durationMs: 1, isAborted: false, turnId: 't' } as any)

describe('cabeçalho: a tarefa em andamento agora', () => {
  test('uma tarefa iniciada e deixada aberta num pedido antigo não toma o título; vale a iniciada por último', async ($, on) => {
    host(on)
    await ask($, 'pedido antigo')
    await call($, 'plan', { tasks: [{ id: 'a1', title: 'Abrir a sessão de correção e conferir modelo', children: [{ id: '1', title: 'Abrir' }, { id: '2', title: 'Conferir' }] }], request: 'pedido antigo' })
    await call($, 'start', { ids: ['a1/1'] })
    await end($)
    await ask($, 'pedido atual')
    await call($, 'plan', { tasks: [{ id: 'c1', title: 'Corrigir com TDD' }], request: 'pedido atual' })
    await call($, 'start', { ids: ['c1'] })
    for (const view of ['full', 'summary'] as const) {
      const head = await header($, view)
      expect(head.slice(0, 'Corrigir com TDD'.length)).toBe('Corrigir com TDD')
    }
  })

  test('sem nenhuma iniciada, o título é a primeira aberta (regra mantida)', async ($, on) => {
    host(on)
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: 'p1', title: 'Primeira aberta' }, { id: 'p2', title: 'Segunda aberta' }], request: 'um pedido' })
    expect((await header($, 'full')).slice(0, 'Primeira aberta'.length)).toBe('Primeira aberta')
  })
})
