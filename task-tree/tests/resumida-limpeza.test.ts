import { describe, expect, test } from 'claude-code/testing'

// When the summary view is cleared, in the person's words: "quando eu enviar novas mensagens, em novos
// turnos, se existirem tarefas em andamento, essas tarefas devem continuar sendo mostradas. o painel
// só deve ser limpo quando enviar uma mensagem em um novo turno e todas as tarefas estiverem
// finalizadas." A task waiting on a message not yet delivered (✉) is not finished: it stays in sight,
// in its request, until the delivery is confirmed.

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
  return (root.children as any[]).filter(c => typeof c === 'object').map(t => shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd()).slice(2)
}

function host(on: any, sendResult = 'delivered; its turn has started on it') {
  let t = 1_000
  on('clock.now', () => ({ value: (t += 100) }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('fs.write', () => ({ value: undefined }) as any)
  on('fs.read', () => ({ value: '{}' }) as any)
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }) as any)
  on('mcp.call', (_$: any, e: any) => {
    if (e.tool === 'get_session') return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any
    // The other session is busy: the message waits for its turn (✉).
    return { value: { content: [{ type: 'text', text: JSON.stringify([{ sessionId: KID, name: 'outra', title: 'Outra', isRunning: true, isArchived: false }]) }], isError: false } } as any
  })
  on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: sendResult }))
}
const ask = ($: any, text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as any)
const end = ($: any) => $.turn.complete({ reason: 'answer', answer: 'Feito.', durationMs: 1, isAborted: false, turnId: 't' } as any)
const has = (out: string[], s: string) => out.some(l => l.includes(s))

describe('resumida: limpa só com tudo finalizado', () => {
  test('nova mensagem com tudo finalizado: limpa, só o pedido novo', async ($, on) => {
    host(on)
    await ask($, 'primeiro pedido')
    await call($, 'plan', { tasks: [{ id: 'a1', title: 'Tarefa do primeiro' }], request: 'primeiro pedido' })
    await call($, 'done', { ids: ['a1'] })
    await end($)
    await ask($, 'segundo pedido')
    await call($, 'plan', { tasks: [{ id: 'b1', title: 'Tarefa do segundo' }], request: 'segundo pedido' })
    const out = await summary($)
    expect(has(out, 'Tarefa do segundo')).toBe(true)
    expect(has(out, 'primeiro pedido')).toBe(false)
    expect(has(out, 'Tarefa do primeiro')).toBe(false)
  })

  test('nova mensagem com uma tarefa ainda em andamento: ela continua à vista, no pedido dela', async ($, on) => {
    host(on)
    await ask($, 'primeiro pedido')
    await call($, 'plan', { tasks: [{ id: 'a1', title: 'Ainda em andamento' }, { id: 'a2', title: 'Já feita' }], request: 'primeiro pedido' })
    await call($, 'start', { ids: ['a1'] })
    await call($, 'done', { ids: ['a2'] })
    await end($)
    await ask($, 'segundo pedido')
    await call($, 'plan', { tasks: [{ id: 'b1', title: 'Tarefa do segundo' }], request: 'segundo pedido' })
    const out = await summary($)
    const first = out.findIndex(l => l.includes('primeiro pedido'))
    const second = out.findIndex(l => l.includes('segundo pedido'))
    expect(first).toBeGreaterThanOrEqual(0)
    expect(out.findIndex(l => l.includes('Ainda em andamento'))).toBeGreaterThan(first)
    expect(out.findIndex(l => l.includes('Ainda em andamento'))).toBeLessThan(second)
    expect(has(out, 'Tarefa do segundo')).toBe(true)
  })

  test('tarefa com mensagem pendente de entrega (✉) não está finalizada: continua à vista com o ✉', async ($, on) => {
    host(on, 'Message queued for local_11111111-1111-1111-1111-111111111111; it is busy and will see it when its turn ends.')
    await ask($, 'primeiro pedido')
    await call($, 'plan', { tasks: [{ id: 'r1', title: 'Passar a regra adiante' }], request: 'primeiro pedido' })
    await call($, 'start', { ids: ['r1'] })
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'a regra' } as any)
    await end($)
    await ask($, 'segundo pedido')
    await call($, 'plan', { tasks: [{ id: 'b1', title: 'Tarefa do segundo' }], request: 'segundo pedido' })
    const out = await summary($)
    const line = out.find(l => l.includes('Passar a regra adiante'))
    expect(line).toBeDefined()
    expect(line).toContain('✉')
    expect(has(out, 'Tarefa do segundo')).toBe(true)
  })
})

// Two messages queued to the same busy session, from two tasks: the session takes up the first (its
// published file lists one message received from this one); only that task closes. The second is
// still waiting for delivery and keeps its ✉. Any message received (or any turn) after a send counted
// as that send taken up, so the first delivery closed both tasks and the second vanished from sight.
describe('✉ pendente: cada envio fecha só com a sua entrega', () => {
  test('duas mensagens na fila para a mesma sessão; ela recebe uma: só a primeira tarefa fecha, a segunda continua com ✉', async ($, on) => {
    let t = 1_000
    let received: { from: string; at: number }[] = []
    on('clock.now', () => ({ value: (t += 100) }) as any)
    on('clock.every', () => ({ deny: 'sem relógio' }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('ui.status', () => ({ value: undefined }) as any)
    on('ui.log', () => ({ value: undefined }) as any)
    on('fs.write', () => ({ value: undefined }) as any)
    on('fs.read', (_$: any, e: any) =>
      ({ value: String(e.path).includes('11111111') ? JSON.stringify({ version: 1, waiting: false, groups: [{ agent: '', label: '', tasks: [] }], waits: [], children: [], received }) : '{}' }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    on('mcp.call', (_$: any, e: any) => {
      if (e.tool === 'get_session') return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any
      return { value: { content: [{ type: 'text', text: JSON.stringify([{ sessionId: KID, name: 'outra', title: 'Outra', isRunning: true, isArchived: false }]) }], isError: false } } as any
    })
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${KID}; it is busy and will see it when its turn ends.` }))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (outra)` }))
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: 'r1', title: 'Primeira mensagem' }, { id: 'e1', title: 'Segunda mensagem' }], request: 'um pedido' })
    await call($, 'start', { ids: ['r1'] })
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'primeira' } as any)
    await call($, 'start', { ids: ['e1'] })
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'segunda' } as any)
    // The session takes up one message (the first), after both were sent.
    t += 1_000
    received = [{ from: 'local_eu', at: t }]
    // The list and the files read again (a start_session reads them at once).
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const out = await summary($)
    const first = out.find(l => l.includes('Primeira mensagem'))
    const second = out.find(l => l.includes('Segunda mensagem'))
    expect(first).toContain('✓')
    expect(second).toBeDefined()
    expect(second).toContain('✉')
  })
})
