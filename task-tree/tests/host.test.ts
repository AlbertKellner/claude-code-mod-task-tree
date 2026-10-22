import { describe, expect, test } from 'claude-code/testing'
import { PUBLISHED_FILES } from './fixtures/publicados'
import { deriveChildren, engineText, listSessions, mineOf, panelOf, parseSessions, readFiles } from '../io/host'
import type { HostRow, Read } from '../io/host'
import { parsePublished } from '../io/publish'
import type { Child } from '../types'

// Reading the sessions this one opened is four steps (io/host.ts); the first three run here without
// the app, on a fake `$` (mcp.call, fs.read, env.get, ui.log) or on plain inputs. The fourth, the
// publication, is io/publish.ts, tested in publicado*.test.ts. The composition (refreshChildren, in
// the hooks module) is covered by the mounted tests (task-tree, publicado, reinicio).

const ME = 'local_eu'
const A = 'local_aaaaaaaa-0000-0000-0000-000000000001'
const B = 'local_bbbbbbbb-0000-0000-0000-000000000002'
const C = 'local_cccccccc-0000-0000-0000-000000000003'
const text = (v: unknown) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }], isError: false })

// A `$` with only what the three steps use. `files`: the published file of each session id; a
// missing one is unreadable (as a file not there). `models`: what get_session answers per id.
type Fake = { $: any; logs: string[]; asked: string[] }
function fake(opts: { list?: unknown; files?: Record<string, string>; models?: Record<string, { model: string; effort?: string }> } = {}): Fake {
  const f: Fake = { logs: [], asked: [], $: undefined }
  f.$ = {
    mcp: {
      call: async (_server: string, tool: string, args: any) => {
        if (tool === 'list_sessions') return opts.list
        if (tool === 'get_session') {
          f.asked.push(String(args?.session_id))
          const m = opts.models?.[String(args?.session_id)]
          return m ? text({ sessionId: args.session_id, ...m }) : text({ sessionId: args.session_id })
        }
        return text('{}')
      },
    },
    env: { get: async () => 'C:/home' },
    fs: {
      read: async (path: string) => {
        const id = Object.keys(opts.files ?? {}).find(k => path.includes(k))
        if (id === undefined) throw new Error(`ENOENT ${path}`)
        return (opts.files as Record<string, string>)[id]
      },
    },
    ui: { log: async (t: string) => void f.logs.push(t) },
  }
  return f
}
const row = (sessionId: string, more: Partial<HostRow> = {}): HostRow => ({ sessionId, name: 'filha', title: 'Filha', isRunning: false, isArchived: false, startedBy: ME, ...more })
const empty: Read = { waiting: [], panels: {}, contexts: {}, engines: {} }
const none = () => undefined

describe('1. a lista do host', () => {
  test('parseSessions: a lista em JSON vira linhas; "No other sessions found" vira lista vazia; erro do app lança o texto', () => {
    const rows = [{ sessionId: A, startedBy: ME, isRunning: true }]
    expect(parseSessions(text(rows))).toEqual(rows)
    expect(parseSessions(text('No other sessions found.'))).toEqual([])
    expect(parseSessions(text('  No linked sessions found'))).toEqual([])
    expect(() => parseSessions({ ...text('sem permissão'), isError: true })).toThrow('sem permissão')
    expect(() => parseSessions(text('<html>'))).toThrow()
  })

  test('listSessions: linhas quando o app responde; o motivo, cortado em 200, quando falha', async () => {
    const rows = [{ sessionId: A, startedBy: ME }]
    expect(await listSessions(fake({ list: text(rows) }).$)).toEqual({ rows })
    const failed = await listSessions(fake({ list: { ...text('x'.repeat(300)), isError: true } }).$)
    expect('error' in failed).toBe(true)
    if ('error' in failed) {
      expect(failed.error.length).toBe(200)
      expect(failed.error.startsWith('Error: xxx')).toBe(true)
    }
    const thrown = await listSessions({ mcp: { call: async () => { throw new Error('sem app') } } })
    expect(thrown).toEqual({ error: 'Error: sem app' })
  })

  test('mineOf: as linhas abertas por quem a lista não traz; nada quando todo starter está listado', () => {
    const rows: HostRow[] = [
      { sessionId: 'local_pai', title: 'Pai', isRunning: false },
      row(A), row(B, { startedBy: 'local_pai' }), row(C),
    ]
    expect(mineOf(rows)?.map(r => r.sessionId)).toEqual([A, C])
    // Every starter is a listed session: none is this one's.
    expect(mineOf([row(A, { startedBy: 'local_pai' }), { sessionId: 'local_pai' }])).toBeUndefined()
    expect(mineOf([])).toBeUndefined()
    // The first starter not listed wins, in the list's order.
    expect(mineOf([row(A, { startedBy: 'local_x' }), row(B, { startedBy: 'local_y' })])?.map(r => r.sessionId)).toEqual([A])
  })
})

describe('2. os arquivos publicados', () => {
  test('panelOf: groups e o resto do arquivo; tasks (versões antigas) como grupo principal; nada sem os dois', () => {
    const groups = [{ agent: '', label: '', tasks: [] }]
    expect(panelOf({ waiting: false, waits: [], children: [], groups })).toEqual({ groups, waits: [], children: [] })
    expect(panelOf({ waiting: false, waits: [], children: [], groups, work: ['1'], received: [{ from: ME, at: 1 }], sends: [] })).toEqual({ groups, waits: [], children: [], work: ['1'], received: [{ from: ME, at: 1 }], sends: [] })
    const tasks = [{ id: '1', short: '1', title: 'T', status: 'open', children: [] }] as any
    expect(panelOf({ waiting: false, waits: [], children: [], tasks })).toEqual({ groups: [{ agent: '', label: '', tasks }], waits: [], children: [] })
    expect(panelOf({ waiting: true, waits: [], children: [] })).toBeUndefined()
    // Every shape ever published: a panel when the file has groups or tasks.
    for (const f of PUBLISHED_FILES) {
      const parsed = parsePublished(f.file)
      if (!('ok' in parsed)) throw new Error(f.label)
      const raw = JSON.parse(f.file)
      expect(panelOf(parsed.ok) !== undefined, f.label).toBe(raw.groups !== undefined || raw.tasks !== undefined)
    }
  })

  test('readFiles: espera, contexto, modelo e painel de cada arquivo; sem arquivo, só a linha; modelo pedido ao app quando o arquivo não o traz', async () => {
    const withAll = JSON.stringify({ version: 1, waiting: true, waits: [{ agent: '', kind: 'question', tool: 'AskUserQuestion', key: 'k' }], children: [], groups: [{ agent: '', label: '', tasks: [] }], context: { percent: 42, at: 1 }, engine: 'Opus 5.5 · high' })
    const noEngine = JSON.stringify({ version: 1, waiting: false, waits: [], children: [], groups: [{ agent: '', label: '', tasks: [] }] })
    const f = fake({ files: { [A]: withAll, [B]: noEngine }, models: { [B]: { model: 'claude-sonnet-5-5[1m]', effort: 'low' } } })
    const read = await readFiles(f.$, [row(A), row(B), row(C)])
    expect(read.waiting).toEqual([A])
    expect(read.contexts).toEqual({ [A]: 42 })
    expect(read.engines).toEqual({ [A]: 'Opus 5.5 · high', [B]: 'Sonnet 5.5 · low' })
    expect(Object.keys(read.panels)).toEqual([A, B])
    expect(read.panels[A].waits.length).toBe(1)
    // The app was asked only for the sessions whose file lacks the model (C has no file: asked too).
    expect(f.asked).toEqual([B, C])
    expect(f.logs).toEqual([])
  })

  test('readFiles: arquivo de outra versão ou corrompido é ignorado, dito uma vez no log, e a sessão fica só com a linha', async () => {
    // Ids of their own: engineOf keeps what the app answered per session for a minute.
    const V = 'local_vvvvvvvv-0000-0000-0000-000000000099'
    const J = 'local_jjjjjjjj-0000-0000-0000-000000000098'
    const f = fake({ files: { [V]: JSON.stringify({ version: 99, waiting: true }), [J]: '{ não é json' } })
    const read = await readFiles(f.$, [row(V), row(J)])
    expect(read).toEqual(empty)
    expect(f.logs.length).toBe(2)
    expect(f.logs[0]).toContain(`arquivo publicado de ${V} ignorado: versão 99`)
    expect(f.logs[1]).toContain(`arquivo publicado de ${J} ignorado: JSON inválido`)
    // Read again: the same reasons are not said twice.
    await readFiles(f.$, [row(V), row(J)])
    expect(f.logs.length).toBe(2)
  })

  test('readFiles lê cada formato já publicado (fixture) sem nada no log', async () => {
    const ids = PUBLISHED_FILES.map((_, i) => `local_f${i}f${i}f${i}f${i}-0000-0000-0000-00000000000${i}`)
    const files = Object.fromEntries(PUBLISHED_FILES.map((f, i) => [ids[i], f.file]))
    const f = fake({ files })
    const read = await readFiles(f.$, ids.map(id => row(id)))
    expect(f.logs).toEqual([])
    for (const [i, file] of PUBLISHED_FILES.entries()) {
      const raw = JSON.parse(file.file)
      expect(read.waiting.includes(ids[i]), file.label).toBe(raw.waiting === true)
      expect(ids[i] in read.panels, file.label).toBe(raw.groups !== undefined || raw.tasks !== undefined)
      expect(read.contexts[ids[i]], file.label).toBe(raw.context?.percent)
    }
  })

  test('engineText: nome legível do modelo, com o esforço quando há', () => {
    expect(engineText('claude-opus-5-5', 'high')).toBe('Opus 5.5 · high')
    expect(engineText('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5')
    expect(engineText('claude-fable-5-1-20261001', 'medium')).toBe('Fable 5.1 · medium')
    expect(engineText('claude-haiku-5', '')).toBe('Haiku 5')
    expect(engineText('um-modelo-que-ninguem-conhece-e-longo')).toBe('um-modelo-que-ninguem-co')
  })
})

describe('3. as filhas e as que terminaram', () => {
  const known = (c: Partial<Child> & { id: string }): Child => ({ name: 'filha', title: 'Filha', running: false, archived: false, ...c })

  test('da lista ao estado: nome, título, running, archived, waiting (nunca de arquivada), contexto e modelo do arquivo', () => {
    const read: Read = { waiting: [A, C], panels: {}, contexts: { [A]: 30 }, engines: { [A]: 'Opus 5.5 · high' } }
    const { children, ended } = deriveChildren([row(A, { isRunning: true }), row(B, { name: undefined, title: undefined }), row(C, { isArchived: true })], [], read, none)
    expect(ended).toEqual([])
    expect(children.map(c => [c.id, c.running, c.archived, c.waiting])).toEqual([[A, true, false, true], [B, false, false, false], [C, false, true, false]])
    expect(children[0]).toMatchObject({ name: 'filha', title: 'Filha', context: 30, engine: 'Opus 5.5 · high', starting: undefined })
    expect(children[1]).toMatchObject({ name: '', title: B })
  })

  test('ended: só quem corria ou esperava antes e parou agora; não quem acaba de abrir, está arquivada ou segue esperando', () => {
    const before = [
      known({ id: A, running: true }),
      known({ id: B, waiting: true }),
      known({ id: C, running: true, starting: true }),
      known({ id: 'local_d', running: true }),
      known({ id: 'local_e', running: true }),
    ]
    const now = [row(A), row(B), row(C), row('local_d', { isArchived: true }), row('local_e'), row('local_f')]
    const { ended, children } = deriveChildren(now, before, { ...empty, waiting: ['local_e'] }, none)
    expect(ended).toEqual([A, B])
    // A session still starting and not yet seen stays starting; one seen running loses the mark.
    expect(children.find(c => c.id === C)?.starting).toBe(true)
    expect(deriveChildren([row(C, { isRunning: true })], before, empty, none).children[0].starting).toBeUndefined()
    // A new row the state never saw is not ended.
    expect(ended.includes('local_f')).toBe(false)
  })

  test('o que a leitura não trouxe fica do conhecido: painel, contexto, modelo; tasks antigas saem quando há painel novo', () => {
    const panel = { groups: [{ agent: '', label: '', tasks: [] }], waits: [], children: [] }
    const before = [known({ id: A, panel, context: 10, engine: 'Opus 5.5', tasks: [] as any }), known({ id: B, tasks: [] as any })]
    const { children } = deriveChildren([row(A), row(B)], before, { ...empty, panels: { [B]: panel } }, none)
    expect(children[0]).toMatchObject({ panel, context: 10, engine: 'Opus 5.5', tasks: [] })
    // B got a panel now: its legacy tasks go.
    expect(children[1].panel).toBe(panel)
    expect(children[1].tasks).toBeUndefined()
  })

  test('laços: do conhecido primeiro, senão da cópia do store (sessão que o host voltou a listar)', () => {
    const kept = (id: string) => (id === B ? { id, name: 'filha', title: 'Filha', anchor: '1', lastAnchor: '2', rounds: 3 } : undefined)
    const before = [known({ id: A, anchor: 'A/1', lastAnchor: 'A/2', rounds: 9 })]
    const { children } = deriveChildren([row(A), row(B), row(C)], before, empty, kept)
    expect(children[0]).toMatchObject({ anchor: 'A/1', lastAnchor: 'A/2', rounds: 9 })
    expect(children[1]).toMatchObject({ anchor: '1', lastAnchor: '2', rounds: 3 })
    expect(children[2]).toMatchObject({ anchor: undefined, lastAnchor: undefined, rounds: undefined })
  })

  test('a lista parcial do host: uma filha que saiu da lista sai do estado; ao voltar, volta sem ser ended e com os laços do store', () => {
    const before = [known({ id: A, running: true, anchor: 'A/1' }), known({ id: B, running: true, anchor: 'B/1' })]
    const partial = deriveChildren([row(A, { isRunning: true })], before, empty, none)
    expect(partial.children.map(c => c.id)).toEqual([A])
    expect(partial.ended).toEqual([])
    const back = deriveChildren([row(A, { isRunning: true }), row(B)], partial.children, empty, id => (id === B ? { id, name: '', title: '', anchor: 'B/1' } : undefined))
    expect(back.children.map(c => [c.id, c.anchor])).toEqual([[A, 'A/1'], [B, 'B/1']])
    // B was not in the state when it came back: it is not "ended", whatever it did meanwhile.
    expect(back.ended).toEqual([])
  })
})
