import { describe, expect, test } from 'claude-code/testing'
import { REAL } from './fixtures/orquestradora-real'

// Reinício e recarga, com o estado real da orquestradora (fixtures/orquestradora-real.ts).
//
// Três camadas guardam o painel: o `$.state` (sobrevive à recarga a quente do módulo, morre com o
// processo), o `$.store` (sobrevive a tudo) e as variáveis do módulo (morrem na recarga). No kit,
// cada teste é um módulo novo com `$.state` vazio: isso é um **reinício do processo** (crash do
// hooks worker, `/model`); o store passa de um teste ao outro por um objeto compartilhado deste
// arquivo. A **recarga a quente** é simulada semeando o `$.state` pelo teste (`seedState`), sem store
// e sem `session.start`, que a recarga não roda.
//
// Um cenário que revela um bug não é corrigido aqui (R8 é só rede de proteção): ele entra em KNOWN
// com o motivo, o teste imprime "TODO …" e passa; quando o bug for corrigido o teste falha pedindo
// para tirá-lo da lista. É o skip/todo que o kit não tem.

const KNOWN: Record<string, string> = {}
function known(name: string, ok: boolean, detail: string) {
  if (name in KNOWN) {
    if (ok) throw new Error(`"${name}" passou: o bug conhecido (${KNOWN[name]}) parece corrigido; tire-o de KNOWN.`)
    console.log(`TODO ${name}: ${KNOWN[name]} (${detail})`)
    return
  }
  if (!ok) throw new Error(`${name}: ${detail}`)
}

const own: any = REAL.own
const ME = REAL.me as string
const AT = own.at as number
const ANALISE = own.children[0].id as string
const CODIGO = own.children[1].id as string
const NEW = 'local_99999999-9999-9999-9999-999999999999'

const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })
const text = (r: any) => String(r?.result ?? r?.text ?? '')
const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} } as any
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
async function rows($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  const root: any = await ui.drawn()
  await ui.unmount()
  return (root.children as any[]).filter(c => typeof c === 'object').map(t => shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd())
}
const cards = (lines: string[]) => lines.filter(l => l.includes('⑂ '))
// A card at the root starts with the icon; under a task it follows the guides.
const atRoot = (line: string) => /^⑂ /.test(line)

// The store as the orchestrator's session left it.
function storeOf(): Record<string, unknown> {
  return {
    'session:uuid-eu': JSON.parse(JSON.stringify(own.groups)),
    'work:uuid-eu': [...own.work],
    'view:uuid-eu': 'full',
    'links:uuid-eu': {
      children: own.children.map((c: any) => ({ id: c.id, name: c.name, title: c.title, anchor: c.anchor, lastAnchor: c.lastAnchor, rounds: c.rounds })),
      sends: [],
      received: [],
      launches: [],
    },
  }
}
const hostRows = (ids: string[] = own.children.map((c: any) => c.id)) => [
  { sessionId: 'local_pai', title: 'Pai', isRunning: false },
  ...own.children.filter((c: any) => ids.includes(c.id)).map((c: any) => ({ sessionId: c.id, name: c.name, title: c.title, isRunning: c.running, isArchived: c.archived, startedBy: ME })),
]

type Host = { store: Record<string, unknown>; rows: any[]; published: string[] }
function host(on: any, store: Record<string, unknown>, listed: any[] = hostRows()): Host {
  const h: Host = { store, rows: listed, published: [] }
  on('clock.now', () => ({ value: AT }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('session.id', () => ({ value: 'uuid-eu' }) as any)
  on('session.start', () => ({ cwd: '.' }) as any)
  on('command.register', () => ({ value: {} }) as any)
  on('tool.register', () => ({ value: {} }) as any)
  on('ui.open', () => ({ value: { isPlaced: true } }) as any)
  on('ui.panes', () => ({ value: [{ id: 'task-tree', isPlaced: true, isShown: true }] }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }) as any)
  on('store.set', (_$: any, e: any) => {
    h.store[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined } as any
  })
  on('store.get', (_$: any, e: any) => ({ value: h.store[e.key] }) as any)
  on('fs.write', (_$: any, e: any) => {
    h.published.push(String(e.text))
    return { value: undefined } as any
  })
  on('fs.read', (_$: any, e: any) => {
    const id = Object.keys(REAL.files).find(k => String(e.path).includes(k))
    return ({ value: id ? REAL.files[id] : '{}' }) as any
  })
  on('mcp.call', (_$: any, e: any) => {
    if (e.tool === 'get_session') {
      const id = e.args?.session_id === 'self' ? ME : String(e.args?.session_id ?? '')
      return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: id, model: 'claude-opus-5-5', effort: 'high' }) }], isError: false } } as any
    }
    if (e.tool === 'list_sessions') return { value: { content: [{ type: 'text', text: JSON.stringify(h.rows) }], isError: false } } as any
    return { value: { content: [{ type: 'text', text: '{}' }], isError: false } } as any
  })
  on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${NEW} (nova)` }))
  return h
}

// A hot reload keeps the host's `$.state`: here the test holds it. Beneath the kit's own state, the
// hooks mirror every write into `state` and answer a read the kit has nothing for with what `state`
// holds (until the module writes that key). So a test can hand the next one (a new module) the state
// the last one built, and the kit's versions stay its own.
function seedState(on: any, state: Record<string, unknown>) {
  const written = new Set<string>()
  on('state.get', async (_$: any, e: any, next: any) => {
    const r = await next(e)
    if (r?.value?.value === undefined && !written.has(e.key) && state[e.key] !== undefined) return { value: { ...r.value, value: state[e.key] } }
    return r
  })
  on('state.set', async (_$: any, e: any, next: any) => {
    written.add(e.key)
    const r = await next(e)
    state[e.key] = e.value === undefined ? undefined : JSON.parse(JSON.stringify(e.value))
    return r
  })
}

const startUp = async ($: any) => {
  await $.session.start({ cwd: '.' } as any)
  // The host's list and the children's files are read in the background at the start.
  await new Promise(r => setTimeout(r, 150))
}
const linksOf = (store: Record<string, unknown>) => (store['links:uuid-eu'] as any)?.children ?? []
const tasksOf = (store: Record<string, unknown>) => ((store['session:uuid-eu'] as any[]) ?? []).find((g: any) => g.agent === '')?.tasks ?? []

// Shared across the tests below, in order: the store a restart finds, the panel drawn before it, and
// the state the module built from the store (what a hot reload would keep).
const SHARED = storeOf()
let before: string[] = []
const HOTSTATE: Record<string, unknown> = {}

describe('reinício do processo (state vazio, store cheio)', () => {
  test('com session.start, 1/2: o painel volta do store; os cartões ficam sob as tarefas de origem e as respostas ↩ voltam', async ($, on) => {
    seedState(on, HOTSTATE)
    host(on, SHARED)
    await startUp($)
    before = await rows($)
    expect(before.length).toBeGreaterThan(10)
    // Case C: the cards hang under their tasks, none fell to the root.
    const cs = cards(before)
    expect(cs.length).toBeGreaterThan(0)
    expect(cs.filter(atRoot)).toEqual([])
    expect(cs.some(l => l.includes('analise-task-tree'))).toBe(true)
    // The turns' answers (↩) are part of the groups, so they come back with them.
    expect(before.some(l => l.includes('↩'))).toBe(true)
    // The links came back whole.
    expect(linksOf(SHARED).find((c: any) => c.id === ANALISE)?.anchor).toBe('92')
    expect(linksOf(SHARED).find((c: any) => c.id === CODIGO)?.rounds?.length).toBe(20)
  })

  test('com session.start, 2/2: outro processo, mesmo store: desenha igual; start/done gravam o painel inteiro de volta', async ($, on) => {
    host(on, SHARED)
    await startUp($)
    expect(await rows($)).toEqual(before)
    // Case F: a start and a done after the restart act on the restored tasks and keep them all.
    const n = tasksOf(SHARED).length
    const s = await call($, 'start', { ids: ['98'] })
    expect(text(s)).not.toContain('não existe')
    const d = await call($, 'done', { ids: ['98'], summary: 'Reinício conferido' })
    expect(text(d)).not.toContain('não existe')
    expect(tasksOf(SHARED).length).toBe(n)
    expect(tasksOf(SHARED).find((t: any) => t.id === '98')?.status).toBe('done')
    expect(linksOf(SHARED).find((c: any) => c.id === ANALISE)?.anchor).toBe('92')
  })

  test('sem session.start (respawn do hooks worker): o painel desenha, start/done acham as tarefas do store e o store não encolhe', async ($, on) => {
    const store = storeOf()
    const h = host(on, store)
    const n = tasksOf(store).length
    // Drawn before any write: the tasks come back from the store (not the empty panel). The
    // sessions' cards are not there yet: the host's list is read at session.start or by the poll.
    const title = (l: string) => /^[✓◉○] (.*?)(?:  |$)/.exec(l)?.[1]
    const drawn = await rows($)
    const titles = drawn.map(title).filter(Boolean)
    expect(titles.length).toBeGreaterThan(0)
    for (const t of before.map(title).filter(Boolean)) expect(titles).toContain(t)
    expect(drawn).toContain('+67 pedidos anteriores')
    const s = await call($, 'start', { ids: ['98'] })
    expect(text(s)).not.toContain('não existe')
    expect(tasksOf(store).length).toBe(n)
    expect(tasksOf(store).find((t: any) => t.id === '98')?.status).toBe('open')
    // The published file carries the whole panel too.
    const last = JSON.parse(h.published[h.published.length - 1] ?? '{}')
    expect(last.groups?.[0]?.tasks?.length).toBe(n)
  })

  test('sem session.start: a visão e o trabalho atual voltam do store no primeiro uso; o plan seguinte soma ao trabalho em vez de sobrescrevê-lo', async ($, on) => {
    const store = storeOf()
    store['view:uuid-eu'] = 'summary'
    const h = host(on, store)
    // Drawn before any write: the summary view the person had chosen, not the default (full).
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
    const root: any = await ui.drawn()
    await ui.unmount()
    const lines = (root.children as any[]).filter(c => typeof c === 'object').map(shown)
    expect(lines.find(l => l.includes('≡'))).toContain('[≡]')
    expect(lines.length).toBeLessThan(before.length)
    // The next plan joins the current work (the store's), instead of writing its own over it.
    const r = await call($, 'plan', { tasks: [{ id: 'N', title: 'Nova etapa' }] })
    expect(text(r)).toContain('Plano exibido')
    const work = store['work:uuid-eu'] as string[]
    expect(work).toEqual(expect.arrayContaining([...own.work, 'N']))
    expect(store['view:uuid-eu']).toBe('summary')
    // The file published by that plan (before the work joined it, as always) carries the restored
    // work, not an empty one.
    const last = JSON.parse(h.published[h.published.length - 1] ?? '{}')
    expect(last.work).toEqual(expect.arrayContaining(own.work))
  })

  test('sem session.start: a primeira gravação das ligações traz as antigas do store (guarda linksLoaded)', async ($, on) => {
    const store = storeOf()
    host(on, store, [...hostRows(), { sessionId: NEW, name: 'nova', title: 'Nova', isRunning: true, isArchived: false, startedBy: ME }])
    await call($, 'plan', { tasks: [{ id: 'N', title: 'Abrir outra' }] })
    await call($, 'start', { ids: ['N'] })
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const links = linksOf(store)
    expect(links.find((c: any) => c.id === ANALISE)?.anchor).toBe('92')
    expect(links.find((c: any) => c.id === CODIGO)?.rounds?.length).toBe(20)
    expect(links.find((c: any) => c.id === NEW)?.anchor).toBe('N')
  })

  test('sem session.start, lista do host parcial (H3.2): as ligações das filhas que o host não listou ficam no store e voltam quando ele as lista de novo', async ($, on) => {
    const store = storeOf()
    // The host lists only one child (and the new one) when the links are first written back.
    const h = host(on, store, [...hostRows([ANALISE]), { sessionId: NEW, name: 'nova', title: 'Nova', isRunning: true, isArchived: false, startedBy: ME }])
    await call($, 'plan', { tasks: [{ id: 'N', title: 'Abrir outra' }] })
    await call($, 'start', { ids: ['N'] })
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const codigo = linksOf(store).find((c: any) => c.id === CODIGO)
    expect(codigo?.rounds?.length).toBe(20)
    expect(codigo?.lastAnchor).toBe('90')
    expect(linksOf(store).map((c: any) => c.id)).toEqual(expect.arrayContaining([...own.children.map((c: any) => c.id), NEW]))
    // Not drawn while the host leaves it out: the published children are the listed ones.
    const shown = (JSON.parse(h.published[h.published.length - 1] ?? '{}').children ?? []).map((c: any) => c.id)
    expect(shown).not.toContain(CODIGO)
    // Listed again (a refresh): back with its ties.
    h.rows = [...hostRows(), { sessionId: NEW, name: 'nova', title: 'Nova', isRunning: true, isArchived: false, startedBy: ME }]
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const back = (JSON.parse(h.published[h.published.length - 1] ?? '{}').children ?? []).find((c: any) => c.id === CODIGO)
    expect(back?.rounds?.length).toBe(20)
    expect(back?.lastAnchor).toBe('90')
    expect(linksOf(store).find((c: any) => c.id === CODIGO)?.rounds?.length).toBe(20)
  })
})

describe('recarga a quente (state mantido, módulo novo, sem session.start)', () => {
  test('o painel desenha igual ao de antes da recarga e start/done gravam o painel inteiro no store', async ($, on) => {
    // The state the first restart test built, as the host would keep it through a reload.
    const state: Record<string, unknown> = JSON.parse(JSON.stringify(HOTSTATE))
    expect(Array.isArray(state.groups)).toBe(true)
    const store: Record<string, unknown> = {}
    seedState(on, state)
    host(on, store)
    const drawn = await rows($)
    // Drawn from the state alone: the same panel the restart drew from the store.
    expect(drawn).toEqual(before)
    const s = await call($, 'start', { ids: ['98'] })
    expect(text(s)).not.toContain('não existe')
    await call($, 'done', { ids: ['98'], summary: 'Recarga conferida' })
    expect(tasksOf(store).length).toBe(own.groups[0].tasks.length)
    expect(tasksOf(store).find((t: any) => t.id === '98')?.status).toBe('done')
  })

  // The two tests share this state: the first writes the summary, the second (a new module) ends
  // the turn.
  const HOT: Record<string, unknown> = {}
  test('summary antes da recarga, 1/2: o done guarda o resumo na variável do módulo', async ($, on) => {
    seedState(on, HOT)
    host(on, {})
    await $.prompt.submit({ text: 'conferir a recarga' } as any)
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Conferir' }], request: 'Conferir a recarga' })
    await call($, 'done', { ids: ['A'], summary: 'Recarga conferida, nada perdido' })
    expect((HOT.groups as any[])[0].tasks[0].status).toBe('done')
  })

  test('summary antes da recarga, 2/2: o turno termina no módulo novo e o ↩ traz o resumo', async ($, on) => {
    seedState(on, HOT)
    host(on, {})
    await $.turn.complete({ reason: 'answer', answer: 'A recarga foi conferida e nada se perdeu no painel.', durationMs: 1, isAborted: false, turnId: 't1' } as any)
    const turn = ((HOT.groups as any[])[0].turns ?? []).slice(-1)[0]
    expect(turn?.brief).toBe('Recarga conferida, nada perdido')
    expect(turn?.reply).toBe('A recarga foi conferida e nada se perdeu no painel.')
    // Spent with the turn: the next one starts with none.
    expect(HOT.brief).toBe('')
  })
})
