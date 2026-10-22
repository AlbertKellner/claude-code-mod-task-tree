import { describe, expect, test } from 'claude-code/testing'

// The published file (~/.claude/task-tree-waits/<id>.json) is the contract between sessions, which
// may run different versions of the mod: what this session reads of a child's file (refreshChildren,
// watchSends) goes through parsePublished. A valid file draws the child's panel; one missing fields
// draws what it has; one from before `version` (only `tasks`) is read as the old shape; one of
// another version, corrupted or of the wrong type is ignored, said once in the debug log, and the
// drawing goes on with the child's row alone.

const KID = 'local_11111111-1111-1111-1111-111111111111'
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })
const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} } as any
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
async function rows($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  const root: any = await ui.drawn()
  await ui.unmount()
  return (root.children as any[]).filter(c => typeof c === 'object').map(t => shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd())
}

const TASKS = [
  {
    id: 'X',
    short: 'X',
    title: 'Trabalho da filha',
    status: 'open',
    children: [
      { id: 'X/1', short: '1', title: 'Passo feito', status: 'done', children: [] },
      { id: 'X/2', short: '2', title: 'Passo atual', status: 'open', started: 1, children: [] },
    ],
  },
]
const GROUPS = [{ agent: '', label: '', tasks: TASKS }]
const VALID = { version: 1, waiting: true, at: 5, tasks: TASKS, groups: GROUPS, waits: [{ agent: '', kind: 'question', tool: 'AskUserQuestion', key: 'k' }], children: [], context: { percent: 42, at: 1 }, engine: 'Opus 5.5 · high', work: ['X'], received: [], sends: [] }

type Host = { file: string; logs: string[]; written: string[]; running: boolean }
function host(on: any, file: string): Host {
  const h: Host = { file, logs: [], written: [], running: true }
  on('clock.now', () => ({ value: 1_000 }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', (_$: any, e: any) => {
    h.logs.push(String(e.text ?? e.message ?? JSON.stringify(e)))
    return { value: undefined } as any
  })
  on('fs.write', (_$: any, e: any) => {
    h.written.push(String(e.text))
    return { value: undefined } as any
  })
  on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? h.file : '{}' }) as any)
  on('mcp.call', (_$: any, e: any) => {
    if (e.tool === 'get_session') return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any
    return { value: { content: [{ type: 'text', text: JSON.stringify([
      { sessionId: 'local_pai', title: 'Pai', isRunning: false },
      { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: h.running, isArchived: false, startedBy: 'local_eu' },
    ]) }], isError: false } } as any
  })
  on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
  return h
}
// Opens the child on the task in progress; a second call reads the host's list (and the file) again.
async function open($: any) {
  await call($, 'plan', { tasks: [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }] })
  await call($, 'start', { ids: ['1'] })
  await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
}
const refresh = ($: any) => $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
const ignored = (h: Host) => h.logs.filter(l => l.includes(`arquivo publicado de ${KID} ignorado`))
const card = (lines: string[]) => lines.filter(l => /⑂ filha|Trabalho da filha|Passo feito|Passo atual|Aguardando/.test(l))

describe('arquivo publicado: contrato e validação', () => {
  test('o arquivo publicado leva a versão do contrato e os campos do painel', async ($, on) => {
    const h = host(on, '{}')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Uma' }] })
    const last = JSON.parse(h.written[h.written.length - 1] ?? '{}')
    expect(last.version).toBe(1)
    // `work` (and `context`, `engine`, `panes`) are left out while undefined: JSON drops them.
    expect(Object.keys(last)).toEqual(expect.arrayContaining(['version', 'waiting', 'at', 'tasks', 'groups', 'waits', 'children', 'received', 'sends']))
    expect(last.groups[0].tasks[0].title).toBe('Uma')
  })

  test('válido: o cartão traz as tarefas, a espera, o anel e o modelo', async ($, on) => {
    const h = host(on, JSON.stringify(VALID))
    await open($)
    const lines = await rows($)
    expect(card(lines).length).toBeGreaterThanOrEqual(4)
    expect(lines.some(l => l.includes('⑂ filha') && l.includes('42%'))).toBe(true)
    expect(lines.some(l => l.includes('Passo atual'))).toBe(true)
    expect(lines.some(l => l.includes('Aguardando'))).toBe(true)
    expect(ignored(h)).toEqual([])
  })

  test('faltando campos: só groups desenha as tarefas, sem espera nem anel; nada no log', async ($, on) => {
    const h = host(on, JSON.stringify({ groups: GROUPS }))
    await open($)
    const lines = await rows($)
    expect(lines.some(l => l.includes('Passo atual'))).toBe(true)
    expect(lines.some(l => l.includes('Aguardando'))).toBe(false)
    expect(lines.some(l => l.includes('42%'))).toBe(false)
    expect(ignored(h)).toEqual([])
  })

  test('arquivo vazio ({}): só a linha da sessão; depois, com arquivo, as tarefas; sem arquivo de novo, o último painel fica', async ($, on) => {
    const h = host(on, '{}')
    await open($)
    let lines = await rows($)
    expect(lines.some(l => l.includes('⑂ filha'))).toBe(true)
    expect(lines.some(l => l.includes('Passo atual'))).toBe(false)
    h.file = JSON.stringify(VALID)
    await refresh($)
    expect((await rows($)).some(l => l.includes('Passo atual'))).toBe(true)
    // A session whose file went missing keeps its last panel (as before this contract).
    h.file = '{}'
    await refresh($)
    lines = await rows($)
    expect(lines.some(l => l.includes('Passo atual'))).toBe(true)
    expect(ignored(h)).toEqual([])
  })

  test('versão antiga (só tasks, sem version): lida como o painel do grupo principal', async ($, on) => {
    const h = host(on, JSON.stringify({ waiting: false, tasks: TASKS }))
    await open($)
    const lines = await rows($)
    expect(lines.some(l => l.includes('Trabalho da filha'))).toBe(true)
    expect(lines.some(l => l.includes('Passo feito'))).toBe(true)
    expect(ignored(h)).toEqual([])
  })

  test('outra versão: ignorado, dito uma vez no log, e a sessão aparece só pela lista do host', async ($, on) => {
    const h = host(on, JSON.stringify({ ...VALID, version: 2 }))
    await open($)
    await refresh($)
    const lines = await rows($)
    expect(lines.some(l => l.includes('⑂ filha'))).toBe(true)
    expect(lines.some(l => l.includes('Passo atual'))).toBe(false)
    expect(lines.some(l => l.includes('42%'))).toBe(false)
    expect(ignored(h)).toHaveLength(1)
    expect(ignored(h)[0]).toContain('versão 2, esta é 1')
    // Fixed (a valid file again): read as before, and a later failure is said again (the last valid
    // panel stays drawn meanwhile).
    h.file = JSON.stringify(VALID)
    await refresh($)
    expect((await rows($)).some(l => l.includes('Passo atual'))).toBe(true)
    h.file = JSON.stringify({ ...VALID, version: 2 })
    await refresh($)
    expect(ignored(h)).toHaveLength(2)
    expect((await rows($)).some(l => l.includes('Passo atual'))).toBe(true)
  })

  test('corrompido ou do tipo errado: ignorado com o motivo, o desenho segue', async ($, on) => {
    const h = host(on, '{"groups": [')
    await open($)
    expect((await rows($)).some(l => l.includes('⑂ filha'))).toBe(true)
    expect(ignored(h)).toHaveLength(1)
    expect(ignored(h)[0]).toContain('JSON inválido')
    for (const [file, why] of [['[]', 'lista'], ['42', 'number'], ['"texto"', 'string'], ['null', 'object']] as const) {
      h.file = file
      await refresh($)
      expect((await rows($)).some(l => l.includes('⑂ filha'))).toBe(true)
      expect(ignored(h)[ignored(h).length - 1]).toContain(why)
    }
    // Fields of the wrong type are left out, the rest is read.
    h.file = JSON.stringify({ waiting: 'sim', groups: 'x', tasks: TASKS, context: { percent: 'alto' }, engine: 7, waits: null })
    await refresh($)
    const lines = await rows($)
    expect(lines.some(l => l.includes('Passo feito'))).toBe(true)
    expect(lines.some(l => l.includes('⑂ filha') && l.includes('%'))).toBe(false)
    expect(lines.some(l => l.includes('Aguardando'))).toBe(false)
  })

  test('mensagem na fila: o arquivo corrompido do destino não confirma nem derruba; o válido confirma', async ($, on) => {
    const h = host(on, '{"received": [')
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${KID}; it is busy and will see it when its turn ends.` }))
    await open($)
    await call($, 'done', { ids: ['1'] })
    await call($, 'start', { ids: ['2'] })
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'oi' } as any)
    await refresh($)
    let lines = await rows($)
    expect(lines.some(l => l.includes('✉'))).toBe(true)
    expect(ignored(h).length).toBeGreaterThanOrEqual(1)
    // The child says it got the message: taken up.
    h.file = JSON.stringify({ version: 1, waiting: false, groups: GROUPS, waits: [], children: [], received: [{ from: 'local_eu', at: 2_000 }] })
    await refresh($)
    lines = await rows($)
    expect(lines.some(l => l.includes('✉'))).toBe(false)
  })
})

// A poll with nothing changed (the host's list and the sessions' files as before) writes nothing:
// not the published file (its clocks and panes are left out of the comparison), not the links
// record in the store, not the status line; and the home folder is asked of the host once. A change
// in a session's file publishes again.
describe('publicar só quando muda', () => {
  type Counts = { t: number; file: string; written: string[]; stores: number; statuses: number; envs: number }
  function counting(on: any, file: string): Counts {
    const h: Counts = { t: 1_000, file, written: [], stores: 0, statuses: 0, envs: 0 }
    on('clock.now', () => ({ value: h.t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio' }) as any)
    on('env.get', () => {
      h.envs++
      return { value: 'C:/home' } as any
    })
    on('ui.status', () => {
      h.statuses++
      return { value: undefined } as any
    })
    on('ui.log', () => ({ value: undefined }) as any)
    on('fs.write', (_$: any, e: any) => {
      h.written.push(String(e.text))
      return { value: undefined } as any
    })
    on('store.set', () => {
      h.stores++
      return { value: undefined } as any
    })
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? h.file : '{}' }) as any)
    on('mcp.call', (_$: any, e: any) => {
      if (e.tool === 'get_session') return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any
      return { value: { content: [{ type: 'text', text: JSON.stringify([
        { sessionId: 'local_pai', title: 'Pai', isRunning: false },
        { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: 'local_eu' },
      ]) }], isError: false } } as any
    })
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    on('tool.call', { tool: 'Read' } as any, async () => ({ result: 'ok' }))
    return h
  }
  // A main-loop tool call with the list older than the poll's period reads the sessions again.
  async function poll($: any, h: Counts) {
    h.t += 4_000
    await $.tool.call({ tool: 'Read', file_path: 'x' } as any)
  }

  test('dois polls sem mudança não gravam o arquivo, o store nem o status; uma mudança na filha grava de novo', async ($, on) => {
    const h = counting(on, JSON.stringify({ groups: GROUPS }))
    await open($)
    expect(h.written.length).toBeGreaterThanOrEqual(1)
    const before = { written: h.written.length, stores: h.stores, statuses: h.statuses, envs: h.envs }
    await poll($, h)
    await poll($, h)
    expect(h.written.length).toBe(before.written)
    expect(h.stores).toBe(before.stores)
    expect(h.statuses).toBe(before.statuses)
    // The home folder is asked once per module: no env.get in the polls.
    expect(h.envs).toBe(before.envs)
    // The child's file changed (a step done there): published again, with the change inside.
    h.file = JSON.stringify(VALID)
    await poll($, h)
    expect(h.written.length).toBe(before.written + 1)
    const last = JSON.parse(h.written[h.written.length - 1])
    expect(JSON.stringify(last.children)).toContain('Passo atual')
    // And nothing again while it stays the same.
    await poll($, h)
    expect(h.written.length).toBe(before.written + 1)
  })

  test('o relógio e os painéis não contam como mudança, mas uma espera nova conta', async ($, on) => {
    const h = counting(on, '{}')
    let shown = false
    on('ui.panes', () => ({ value: [{ id: 'task-tree', isPlaced: true, isShown: shown }] }) as any)
    on('ui.open', () => ({ value: { isPlaced: true } }) as any)
    // A question's dialog: the kit wants the hook registered before the first call on $.
    on('tool.call', { tool: 'AskUserQuestion' } as any, async () => ({ result: 'ok' }))
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Uma', children: [{ id: '1', title: 'Passo' }] }] })
    const n = h.written.length
    // The same panel published again (/task-tree publishes it; the clock later, the pane now in
    // front): nothing written.
    h.t += 10_000
    shown = true
    await ($ as any).command.run({ command: 'task-tree', args: '' })
    await ($ as any).command.run({ command: 'task-tree', args: '' })
    expect(h.written.length).toBe(n)
    // A question opens a wait: `waiting` flips, so the file is written.
    await call($, 'start', { ids: ['1'] })
    const m = h.written.length
    expect(m).toBeGreaterThan(n)
    await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    expect(h.written.length).toBeGreaterThan(m)
  })
})
