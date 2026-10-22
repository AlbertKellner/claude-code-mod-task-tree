import { describe, expect, test } from 'claude-code/testing'
import { PUBLISHED_FILES } from './fixtures/publicados'
import { PUBLISHED_VERSION, parsePublished } from '../io/publish'

// The published file (~/.claude/task-tree-waits/<id>.json) changed shape as the mod grew: first
// `waiting` and `at` alone, then `tasks`, then `groups`/`waits`/`children`, then `context`, `work`
// and `received`, then `engine`, `panes` and `sends`, and at last `version` with `drawSize` and
// `rows`. A child may run any of them. fixtures/publicados.ts keeps one real file of each shape
// (anonymized): every one is read by this version, the drawing shows the child's card from it, and
// the last one is the shape this version writes.

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

type Host = { file: string; logs: string[]; written: string[] }
function host(on: any, file: string): Host {
  const h: Host = { file, logs: [], written: [] }
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
      { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: 'local_eu' },
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
const ignored = (h: Host) => h.logs.filter(l => l.includes('arquivo publicado de'))
// The titles the child's card would show: its main group's (or, before groups, its `tasks`).
const titles = (raw: any): string[] => {
  const main = (raw.groups ?? []).find((g: any) => g.agent === '')?.tasks ?? raw.tasks ?? []
  return main.map((t: any) => String(t.title))
}
const LAST = PUBLISHED_FILES[PUBLISHED_FILES.length - 1]

describe('arquivo publicado: uma leitura para cada formato já escrito', () => {
  test('o fixture tem um arquivo de cada formato, do primeiro ao desta versão', () => {
    expect(PUBLISHED_FILES.length).toBeGreaterThanOrEqual(6)
    const shapes = PUBLISHED_FILES.map(f => Object.keys(JSON.parse(f.file)).join(','))
    expect(new Set(shapes).size).toBe(PUBLISHED_FILES.length)
    expect(shapes[0]).toBe('waiting,at')
    expect(JSON.parse(LAST.file).version).toBe(PUBLISHED_VERSION)
    for (const f of PUBLISHED_FILES.slice(0, -1)) expect(JSON.parse(f.file).version, f.label).toBeUndefined()
  })

  test('parsePublished lê cada formato sem erro, com a espera, as listas e a versão como estão', () => {
    for (const f of PUBLISHED_FILES) {
      const raw = JSON.parse(f.file)
      const parsed = parsePublished(f.file)
      expect('ok' in parsed, `${f.label}: ${'error' in parsed ? parsed.error : ''}`).toBe(true)
      if (!('ok' in parsed)) continue
      const ok = parsed.ok
      expect(ok.waiting).toBe(raw.waiting === true)
      expect(ok.at).toBe(raw.at)
      expect(ok.version).toBe(raw.version)
      expect(ok.waits).toEqual(raw.waits ?? [])
      expect(ok.children).toEqual(raw.children ?? [])
      expect(ok.tasks).toEqual(raw.tasks)
      expect(ok.groups).toEqual(raw.groups)
      expect(ok.work).toEqual(raw.work)
      expect(ok.received).toEqual(raw.received)
      expect(ok.sends).toEqual(raw.sends)
      expect(ok.engine).toBe(raw.engine)
      expect(ok.context).toEqual(raw.context)
      // What is kept for reading the file by hand is not for the readers.
      expect('panes' in ok).toBe(false)
      expect('drawSize' in ok).toBe(false)
      expect('rows' in ok).toBe(false)
    }
  })

  test('uma filha com um arquivo de cada formato: o cartão desenha o que o arquivo tem, nada vai ao log', async ($, on) => {
    const h = host(on, PUBLISHED_FILES[0].file)
    await open($)
    for (const f of PUBLISHED_FILES) {
      h.file = f.file
      await refresh($)
      const lines = await rows($)
      expect(lines.some(l => l.includes('⑂ filha')), f.label).toBe(true)
      for (const title of titles(JSON.parse(f.file))) expect(lines.some(l => l.includes(title)), `${f.label}: ${title}`).toBe(true)
      expect(ignored(h), f.label).toEqual([])
    }
  })

  test('o que esta versão escreve tem as chaves do último formato, na mesma ordem', async ($, on) => {
    const h = host(on, '{}')
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Uma' }] })
    const written = JSON.parse(h.written[h.written.length - 1] ?? '{}')
    const keys = Object.keys(JSON.parse(LAST.file))
    // JSON drops what is undefined here (work before a start, context, engine, panes); the rest keeps the order.
    expect(keys.filter(k => k in written)).toEqual(Object.keys(written))
    expect(Object.keys(written)).toEqual(expect.arrayContaining(['version', 'waiting', 'at', 'tasks', 'groups', 'waits', 'children', 'received', 'sends']))
    expect(written.version).toBe(PUBLISHED_VERSION)
  })
})
