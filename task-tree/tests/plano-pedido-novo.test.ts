import { describe, expect, test } from 'claude-code/testing'

// A plan in a new message of the person puts all its level-1 tasks under the new request, even when
// an id is the one of a level-1 task left open in an earlier request. Replacing an open task in its
// place (and in its request) is for a replan within the same request. The old one, abandoned by the
// new request, stays in its request as history: interrupted (the rule for work left open) and renamed
// (`tag:id`, as the plan already does for a closed task whose id is reused). The person's panel: the
// request "Verificar merge do PR 13" left its "1" open (done with only a summary); the next request
// planned "1", "2", "3": the new "1" took the old one's place under the old request, only "2" and "3"
// went under the new one, and the summary kept the old request in sight.

const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { top: 0, bodyRows: 60 }, view: {} } as any
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })

async function lines($: any, view: 'full' | 'summary'): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  await ui.press({ key: `view:${view}` })
  await ui.unmount()
  const again = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  const root: any = await again.drawn()
  await again.unmount()
  // Below the header and its bar.
  return (root.children as any[]).filter(c => typeof c === 'object').map(t => shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd()).slice(2)
}

type Host = { t: number; published: string[] }
function host(on: any): Host {
  const h: Host = { t: 1_000, published: [] }
  on('clock.now', () => ({ value: (h.t += 100) }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('fs.write', (_$: any, e: any) => {
    h.published.push(String(e.text))
    return { value: undefined } as any
  })
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }) as any)
  on('mcp.call', (_$: any, e: any) => {
    if (e.tool === 'get_session') return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any
    return { value: { content: [{ type: 'text', text: '[]' }], isError: false } } as any
  })
  return h
}
const ask = ($: any, text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as any)
const end = ($: any) => $.turn.complete({ reason: 'answer', answer: 'Feito.', durationMs: 1, isAborted: false, turnId: 't' } as any)
// Request 1 leaves its "1" open (done with only a summary); request 2 plans "1", "2", "3".
async function story($: any) {
  await ask($, 'Verificar merge do PR 13')
  await call($, 'plan', { tasks: [{ id: '1', title: 'Conferir main, PRs e estado do clone' }], request: 'Verificar merge do PR 13' })
  await call($, 'start', { ids: ['1'] })
  await call($, 'done', { ids: [], summary: 'PR 13 mesclado' })
  await end($)
  await ask($, 'Cenário de teste visual completo do task-tree')
  await call($, 'plan', {
    tasks: [
      { id: '1', title: 'Preparar ambiente de teste', children: [{ id: '1.1', title: 'Clonar' }, { id: '1.2', title: 'Instalar' }] },
      { id: '2', title: 'Montar o cenário' },
      { id: '3', title: 'Conferir o desenho' },
    ],
    request: 'Cenário de teste visual completo do task-tree',
  })
}
const at = (out: string[], s: string) => out.findIndex(l => l.includes(s))

describe('plan numa mensagem nova: todos os níveis 1 vão para o pedido novo', () => {
  test('completa: o "1" novo fica sob o pedido novo, não no lugar do "1" aberto do pedido antigo', async ($, on) => {
    host(on)
    await story($)
    const out = await lines($, 'full')
    const oldReq = at(out, 'Verificar merge do PR 13')
    const newReq = at(out, 'Cenário de teste visual completo')
    expect(oldReq).toBeGreaterThanOrEqual(0)
    expect(newReq).toBeGreaterThan(oldReq)
    // The new "1" and its subtasks are below the new request's line, with "2" and "3".
    expect(at(out, 'Preparar ambiente de teste')).toBeGreaterThan(newReq)
    expect(at(out, 'Montar o cenário')).toBeGreaterThan(at(out, 'Preparar ambiente de teste'))
    // The old "1" stays in its request, as history.
    expect(at(out, 'Conferir main, PRs e estado do clone')).toBeGreaterThan(oldReq)
    expect(at(out, 'Conferir main, PRs e estado do clone')).toBeLessThan(newReq)
  })

  test('resumida: só o pedido novo (o "1" antigo abandonado não o segura à vista)', async ($, on) => {
    host(on)
    await story($)
    const out = await lines($, 'summary')
    expect(at(out, 'Cenário de teste visual completo')).toBeGreaterThanOrEqual(0)
    expect(at(out, 'Preparar ambiente de teste')).toBeGreaterThanOrEqual(0)
    expect(at(out, 'Verificar merge do PR 13')).toBe(-1)
    expect(at(out, 'Conferir main, PRs e estado do clone')).toBe(-1)
  })

  test('estado publicado: o "1" novo no turno novo; o antigo renomeado e interrompido no turno antigo', async ($, on) => {
    const h = host(on)
    await story($)
    const file = JSON.parse(h.published[h.published.length - 1] ?? '{}')
    const main = (file.groups ?? []).find((g: any) => g.agent === '')
    const turns = main.turns as { id: number; title: string }[]
    const newTurn = turns.find(u => u.title.startsWith('Cenário'))?.id
    const oldTurn = turns.find(u => u.title.startsWith('Verificar'))?.id
    const novo = main.tasks.find((t: any) => t.id === '1')
    expect(novo.title).toBe('Preparar ambiente de teste')
    expect(novo.turn).toBe(newTurn)
    const velho = main.tasks.find((t: any) => t.title === 'Conferir main, PRs e estado do clone')
    expect(velho).toBeDefined()
    expect(velho.id).toMatch(/^[a-z0-9]+:1$/)
    expect(velho.turn).toBe(oldTurn)
    expect(velho.status).toBe('interrupted')
  })

  test('no mesmo pedido, replanejar um "1" aberto continua substituindo no lugar (regra mantida)', async ($, on) => {
    const h = host(on)
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: '1', title: 'Primeira versão' }, { id: '2', title: 'Outra' }], request: 'um pedido' })
    await call($, 'plan', { tasks: [{ id: '1', title: 'Segunda versão' }] })
    const out = await lines($, 'full')
    expect(at(out, 'Primeira versão')).toBe(-1)
    expect(at(out, 'Segunda versão')).toBeGreaterThanOrEqual(0)
    expect(at(out, 'Segunda versão')).toBeLessThan(at(out, 'Outra'))
    const file = JSON.parse(h.published[h.published.length - 1] ?? '{}')
    const main = (file.groups ?? []).find((g: any) => g.agent === '')
    expect(main.tasks.map((t: any) => t.id)).toEqual(['1', '2'])
  })
})
