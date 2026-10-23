import { describe, expect, test } from 'claude-code/testing'

// Nothing is in progress until the model calls start (the person's decision, after the visual test:
// "sem start, nada aceso"). The first open task used to light up by default, and everything that asks
// "which task is in progress now" took it: a message sent between two tasks was anchored to the NEXT
// pending task (its card came out under "Passo 2", then the delivery closed "Passo 3" ✓ without a
// start), a never-started "Passo 4" ran a clock (◉ 3:30), and the header's title named it. Now: a
// message sent with no task in progress is anchored to the task started last in the current request
// (done or not); with none started, to the request's last level-1 task (the end of the request).

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
const rowsOf = (lines: Line[]) => lines.filter(l => l.title !== undefined)
const line = (lines: Line[], title: string) => lines.find(l => l.title === title)
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })
const ask = ($: any, text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as any)
const KID = 'local_77777777-7777-7777-7777-777777777777'

// The host: a clock the test moves, and the session this one opened (filha) with its published
// panel: the opening turn (O, in progress) and, once it took up the message sent at `sent`, a turn
// of that message with one task ("Trabalho novo").
function host(on: any) {
  const h = { t: 100, taken: false, sent: 0 }
  const task = (id: string, title: string, status: string, turn: number, started?: number) => ({ id, short: id, title, status, turn, ...(started ? { started } : {}), children: [] })
  const panel = () => ({
    waiting: false,
    ...(h.taken ? { received: [{ from: 'local_eu', at: h.sent + 50 }] } : {}),
    groups: [{
      agent: '',
      label: '',
      turns: [{ id: 1, title: 'abertura', at: 50 }, ...(h.taken ? [{ id: 2, title: 'mensagem', at: h.sent + 50 }] : [])],
      tasks: [task('O', 'Velha em andamento', 'open', 1, 1), ...(h.taken ? [task('N', 'Trabalho novo', 'open', 2)] : [])],
    }],
    waits: [],
    children: [],
  })
  on('clock.now', () => ({ value: h.t }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('fs.write', () => ({ value: undefined }) as any)
  on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('77777777') ? JSON.stringify(panel()) : '{}' }) as any)
  on('prompt.submit', (_$: any, e: any) => e)
  on('mcp.call', () => ({
    value: {
      content: [{ type: 'text', text: JSON.stringify([
        { sessionId: 'local_pai', title: 'Pai', isRunning: false },
        { sessionId: KID, name: 'filha', title: 'Filha', isRunning: true, isArchived: false, startedBy: 'local_eu' },
      ]) }],
      isError: false,
    },
  }) as any)
  on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'queued' }))
  on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
  return h
}
const open = ($: any) => $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
// Sends the message at `at` and lets the session take it up; the app's notice reads the list again.
async function sendAndTake($: any, h: ReturnType<typeof host>, at: number) {
  h.t = at
  h.sent = at
  await $.tool.call({ tool: 'SendMessage', to: KID, message: 'faça' } as any)
  h.taken = true
  await $.prompt.submit({ text: '<side-sessions-event>filha</side-sessions-event>' } as any)
}
// The lines' texts and the index of a title; the cards of the session (⑂ filha).
const texts = async ($: any) => rowsOf(await view($)).map(l => l.text)
const at = (ts: string[], s: string) => ts.findIndex(t => t.includes(s))
const cards = (ts: string[]) => ts.map((t, i) => [t, i] as const).filter(([t]) => /^[│ ]*⑂ filha/.test(t)).map(([, i]) => i)

describe('sem start, nada aceso', () => {
  test('um plano sem start: nenhuma tarefa em andamento, nem a primeira aberta; o chip conta as folhas abertas', async ($, on) => {
    host(on)
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Sessão A', children: [{ id: '1', title: 'Sub 1' }, { id: '2', title: 'Sub 2' }] }, { id: 'B', title: 'Item B' }], request: 'um pedido' })
    const lines = await view($)
    expect(lines.filter(l => l.glyph === '◉').map(l => l.title)).toEqual([])
    expect(line(lines, 'Sub 1')?.glyph).toBe('○')
    expect(lines[1].text).toContain('● 3')
  })

  test('entre duas tarefas (a primeira concluída, a seguinte sem start), a seguinte não acende nem cronometra', async ($, on) => {
    const h = host(on)
    await ask($, 'passos')
    await call($, 'plan', { tasks: [{ id: 'e1', title: 'Passo 1' }, { id: 'e2', title: 'Passo 2' }, { id: 'e3', title: 'Passo 3' }], request: 'passos' })
    h.t = 1_000
    await call($, 'start', { ids: ['e1'] })
    h.t = 5_000
    await call($, 'done', { ids: ['e1'] })
    h.t = 90_000
    const lines = await view($)
    expect(line(lines, 'Passo 2')?.glyph).toBe('○')
    expect(line(lines, 'Passo 2')?.text).not.toMatch(/\d:\d\d/)
    // The header's title: the task started last, not the next pending one.
    expect(lines[0].text.startsWith('Passo 1')).toBe(true)
  })
})

describe('tarefa de origem de um envio sem tarefa em andamento', () => {
  test('mensagem mandada depois de concluir A e antes de iniciar B sai de A (a última iniciada): o cartão fica sob A', async ($, on) => {
    const h = host(on)
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Pedir' }, { id: 'B', title: 'Conferir' }], request: 'um pedido' })
    await call($, 'start', { ids: ['A'] })
    await open($)
    h.t = 200
    await call($, 'done', { ids: ['A'] })
    await sendAndTake($, h, 500)
    const ts = await texts($)
    const [first, second] = cards(ts)
    expect(cards(ts).length).toBe(2)
    expect(ts[second + 1]).toContain('Trabalho novo')
    // Both cards under "Pedir", before "Conferir": the message left A, not the next pending task.
    expect(at(ts, 'Pedir')).toBeLessThan(first)
    expect(second).toBeLessThan(at(ts, 'Conferir'))
  })

  test('sessão aberta depois de concluir A e antes de iniciar B fica sob A', async ($, on) => {
    const h = host(on)
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Pedir' }, { id: 'B', title: 'Conferir' }], request: 'um pedido' })
    await call($, 'start', { ids: ['A'] })
    h.t = 200
    await call($, 'done', { ids: ['A'] })
    h.t = 300
    await open($)
    const ts = await texts($)
    const [card] = cards(ts)
    expect(at(ts, 'Pedir')).toBeLessThan(card)
    expect(card).toBeLessThan(at(ts, 'Conferir'))
  })

  test('sem nenhuma iniciada no pedido, a mensagem sai da última tarefa do pedido (o fim dele), não da primeira', async ($, on) => {
    const h = host(on)
    await ask($, 'um pedido')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Pedir' }, { id: 'B', title: 'Conferir' }], request: 'um pedido' })
    await open($)
    await sendAndTake($, h, 500)
    const ts = await texts($)
    // Opened and messaged with nothing started: both cards at the end of the request, after "Conferir".
    expect(cards(ts).length).toBe(2)
    for (const i of cards(ts)) expect(at(ts, 'Conferir')).toBeLessThan(i)
  })

  test('a última iniciada é a do pedido atual: uma iniciada num pedido anterior não vale', async ($, on) => {
    const h = host(on)
    await ask($, 'antigo')
    await call($, 'plan', { tasks: [{ id: 'V', title: 'Velha' }], request: 'antigo' })
    await call($, 'start', { ids: ['V'] })
    await open($)
    h.t = 200
    await call($, 'done', { ids: ['V'] })
    h.t = 300
    await ask($, 'novo')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Pedir' }, { id: 'B', title: 'Conferir' }], request: 'novo' })
    await sendAndTake($, h, 500)
    const ts = await texts($)
    const [, second] = cards(ts)
    expect(cards(ts).length).toBe(2)
    expect(ts[second + 1]).toContain('Trabalho novo')
    // The new request has nothing started: the card of its message ends it, after "Conferir".
    expect(at(ts, 'Conferir')).toBeLessThan(second)
  })
})
