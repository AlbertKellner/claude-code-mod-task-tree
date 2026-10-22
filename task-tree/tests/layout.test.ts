import { describe, expect, test } from 'claude-code/testing'
import { REAL } from './fixtures/orquestradora-real'
import { MAIN, count, flat, layout, total } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Group, Panel, Published, TaskNode, Turn } from '../types'

// The layout alone: layout(model, choices, now, ownId) → Row[], with no mount and no SVG. The model is
// built as the hooks build it from the state (refreshChildren: a Child per session the host lists,
// its panel from its published file). First the real orchestrator's state
// (fixtures/orquestradora-real.ts), then small made-up ones for each rule.
// A test that reveals a bug marks it in KNOWN (the kit has no skip/todo) and says so.

const KNOWN: Record<string, string> = {
  'chip em andamento com ✉ de filha': 'o cabeçalho conta como "em andamento" a tarefa ✉ de um cartão de filha (sentIds só tem as mensagens desta sessão); ela já conta em "aguardando sessão"',
}
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
// A session's Child as refreshChildren builds it from the host's row and its published file.
function childOf(c: any, file: Published): Child {
  return {
    id: c.id,
    name: c.name,
    title: c.title,
    running: c.running,
    archived: c.archived,
    waiting: file.waiting,
    context: file.context?.percent,
    engine: file.engine,
    anchor: c.anchor,
    lastAnchor: c.lastAnchor,
    rounds: c.rounds,
    panel: {
      groups: file.groups ?? [],
      waits: file.waits ?? [],
      children: file.children ?? [],
      ...(file.work ? { work: file.work } : {}),
      ...(file.received ? { received: file.received } : {}),
      ...(file.sends ? { sends: file.sends } : {}),
    },
  }
}
const realKids = (): Child[] => own.children.map((c: any) => childOf(c, JSON.parse(REAL.files[c.id])))
const realModel = (view: 'full' | 'summary'): Model => ({ groups: own.groups, waits: [], children: realKids(), sends: [], view, work: own.work })

const titles = (rows: Row[]) => rows.map(r => `${'  '.repeat(r.depth)}${r.tone === 'section' ? '§ ' : r.session ? '⑂ ' : r.tone === 'reply' ? '↩ ' : ''}${r.title}`)
const cards = (rows: Row[]) => rows.filter(r => r.session)
// The header's numbers as the render takes them from the rows (see ui.render): the count of the
// drawn lines' nodes, and the chips' tallies.
function header(rows: Row[], sentIds: string[] = []) {
  const shown = rows.flatMap(r => r.nodes ?? [])
  const [d, n, x] = count(shown)
  const tally = (pick: (r: Row) => boolean | undefined) => rows.filter(pick).length
  const active = flat(shown).filter(t => t.status === 'open' && t.children.length === 0 && !sentIds.includes(t.id)).length
  return { d, n, x, active, waiting: tally(r => (r.tone === 'wait' && r.label === '') || r.pending), live: tally(r => r.live), sent: tally(r => r.tone === 'sent') }
}
// The row right below `row` that is one level deeper, and all the rows under it.
const under = (rows: Row[], i: number) => {
  const out: Row[] = []
  for (let j = i + 1; j < rows.length && rows[j].depth > rows[i].depth; j++) out.push(rows[j])
  return out
}
const at = (rows: Row[], key: string) => rows.findIndex(r => r.fold?.key === key)

describe('layout: estado real da orquestradora', () => {
  test('visão completa: os 3 últimos pedidos, o resto contado; cartões só sob as tarefas de origem; nenhum na raiz', () => {
    const rows = layout(realModel('full'), {}, AT, ME)
    expect(rows.length).toBe(28)
    expect(rows[0]).toMatchObject({ depth: 0, tone: 'section', title: '+67 pedidos anteriores' })
    expect(rows[rows.length - 1]).toMatchObject({ depth: 0, tone: 'section', title: '+41 cartões antigos de sessões' })
    // The turns drawn: 71, 72, 73 (SHOWN_TURNS); 70, with a brief, is in the count line.
    expect(rows.filter(r => r.depth === 0 && r.fold).map(r => r.fold?.key)).toEqual(['|T:71', '|T:72', '|T:73'])
    // Every card hangs under a task: none at depth 0, each right under the task of its round.
    const cs = cards(rows)
    expect(cs.length).toBe(2)
    expect(cs.every(r => r.depth > 0)).toBe(true)
    expect(cs.map(r => r.sid)).toEqual([ANALISE, ANALISE])
    expect(cs.map(r => r.fold?.key)).toEqual([`s:${ANALISE}#2`, `s:${ANALISE}#7`])
    expect(rows[at(rows, '|t:97') + 1]).toBe(cs[0])
    expect(rows[at(rows, '|t:98') + 1]).toBe(cs[1])
    // The analysis session is at work: its last card runs, the one before is done.
    expect(cs.map(r => r.tone)).toEqual(['done', 'running'])
    expect(cs.map(r => r.engine)).toEqual(['Fable 5.1 · high', 'Fable 5.1 · high'])
    expect(cs.map(r => r.ring?.percent)).toEqual([43, 43])
  })

  test('↩: o pedido sem cartão mostra a resposta; os pedidos com cartão de filha não; o cartão mostra a resposta da filha por turno', () => {
    const rows = layout(realModel('full'), {}, AT, ME)
    const replies = (i: number) => under(rows, i).filter(r => r.tone === 'reply' && r.depth === rows[i].depth + 1)
    expect(replies(at(rows, '|T:71')).map(r => r.title)).toEqual(['resposta'])
    expect(replies(at(rows, '|T:72'))).toEqual([])
    expect(replies(at(rows, '|T:73'))).toEqual([])
    // The card of round #2: its turn's answer, with the child's brief, below its tasks.
    const card = at(rows, `s:${ANALISE}#2`)
    const inCard = under(rows, card)
    const reply = inCard.filter(r => r.tone === 'reply')
    expect(reply.length).toBe(1)
    expect(reply[0].depth).toBe(rows[card].depth + 1)
    expect(reply[0].title).not.toBe('resposta')
    expect(reply[0].whole).toBeDefined()
    expect(inCard[inCard.length - 1]).toBe(reply[0])
  })

  test('cabeçalho: conta só o que está desenhado (os nós das linhas), com os chips da visão', () => {
    const rows = layout(realModel('full'), {}, AT, ME)
    const h = header(rows)
    // The three turns' counts (1/1, 4/4, 3/9), not the session's 97 tasks and its children's.
    expect([h.d, h.n]).toEqual([8, 14])
    const [ad, an] = total({ groups: own.groups, waits: [], children: realKids() })
    expect(an).toBeGreaterThan(h.n)
    expect(ad).toBeGreaterThan(h.d)
    expect(h.x).toBe(0)
    // In progress: the open leaves drawn (one current, five open); one session at work; nothing waits.
    expect(h.active).toBe(6)
    expect(h.live).toBe(1)
    expect(h.waiting).toBe(0)
    expect(h.sent).toBe(0)
    // A folded turn stands for all its tasks and its sessions', so the header does not change.
    const folded = layout(realModel('full'), { '|T:73': true }, AT, ME)
    const t73 = folded[at(folded, '|T:73')]
    expect(t73.fold?.open).toBe(false)
    expect(under(folded, at(folded, '|T:73')).filter(r => r.tone !== 'section')).toEqual([])
    expect(count(t73.nodes ?? []).slice(0, 2)).toEqual([3, 9])
    expect([header(folded).d, header(folded).n]).toEqual([8, 14])
  })

  test('visão resumida: o trabalho atual (pedidos 70 a 73), sem os cartões antigos; as mesmas linhas da completa', () => {
    const full = layout(realModel('full'), {}, AT, ME)
    const summary = layout(realModel('summary'), {}, AT, ME)
    expect(summary.length).toBe(27)
    expect(summary[0]).toMatchObject({ tone: 'section', title: '+1 pedidos anteriores' })
    expect(summary.some(r => r.title.includes('cartões antigos'))).toBe(false)
    expect(titles(summary).slice(1)).toEqual(titles(full).slice(1, -1))
    expect([header(summary).d, header(summary).n]).toEqual([8, 14])
  })

  test('determinístico: duas chamadas iguais dão as mesmas linhas (o cache é por chamada)', () => {
    const a = layout(realModel('full'), {}, AT, ME)
    const b = layout(realModel('full'), {}, AT, ME)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

// Small models: a task tree, groups with turns, sessions with panels.
const task = (id: string, title: string, status: TaskNode['status'] = 'open', extra: Partial<TaskNode> = {}): TaskNode => ({ id, short: id.split('/').pop() as string, title, status, children: [], ...extra })
const turn = (id: number, at: number, extra: Partial<Turn> = {}): Turn => ({ id, title: `Pedido ${id}`, at, ...extra })
const main = (tasks: TaskNode[], turns?: Turn[]): Group => ({ agent: MAIN, label: '', tasks, ...(turns ? { turns } : {}) })
const panel = (tasks: TaskNode[], turns?: Turn[], extra: Partial<Panel> = {}): Panel => ({ groups: [main(tasks, turns)], waits: [], children: [], ...extra })
const child = (id: string, name: string, p: Panel, extra: Partial<Child> = {}): Child => ({ id, name, title: name, running: false, archived: false, panel: p, ...extra })
const model = (groups: Group[], children: Child[] = [], extra: Partial<Model> = {}): Model => ({ groups, waits: [], children, sends: [], view: 'full', work: [], ...extra })
const NOW = 2_000_000
const T0 = 1_000_000

describe('layout: regras, em modelos pequenos', () => {
  test('cartões sob a mesma tarefa saem na ordem em que o trabalho começou, não na ordem da lista', () => {
    const late = child('local_b', 'tarde', panel([task('1', 'x', 'done', { plannedAt: T0 + 500, startedAt: T0 + 500, endedAt: T0 + 600 })]), { anchor: 'A' })
    const early = child('local_a', 'cedo', panel([task('1', 'y', 'done', { plannedAt: T0 + 100, startedAt: T0 + 100, endedAt: T0 + 200 })]), { anchor: 'A' })
    const rows = layout(model([main([task('A', 'Origem', 'open', { started: 1, startedAt: T0 })])], [late, early]), {}, NOW, ME)
    expect(cards(rows).map(r => r.title)).toEqual(['cedo', 'tarde'])
    expect(cards(rows).every(r => r.depth === 1)).toBe(true)
  })

  test('cadeia: a mensagem de uma irmã põe o cartão sob a tarefa de origem da irmã, não na raiz', () => {
    // impl, opened on task 15, sent docs a message in its turn 1; docs (no anchor of its own) took it
    // up and opened its turn after it.
    const impl = child('local_impl', 'impl', panel([task('1', 'Implementar', 'done', { turn: 1, startedAt: T0 + 10, endedAt: T0 + 50 })], [turn(1, T0 + 5)]), { anchor: '15' })
    const docs = child('local_docs', 'docs', panel([task('1', 'Documentar', 'open', { turn: 1, started: 1, startedAt: T0 + 110 })], [turn(1, T0 + 105)], { received: [{ from: 'local_impl', at: T0 + 100 }] }), { running: true })
    const rows = layout(model([main([task('15', 'Pedido 15', 'open', { started: 1, startedAt: T0 })])], [impl, docs]), {}, NOW, ME)
    const cs = cards(rows)
    expect(cs.map(r => r.title)).toEqual(['impl', 'docs'])
    expect(cs.every(r => r.depth === 1)).toBe(true)
    expect(rows[0].title).toBe('Pedido 15')
    // The chain's card is at work: so is the task it hangs from.
    expect(rows[0].tone).toBe('current')
    expect(rows[0].kids).toBe(true)
  })

  test('filha de outra filha: o cartão da neta fica aninhado sob a tarefa da filha, e conta na filha e na tarefa', () => {
    const neta = child('local_neta', 'neta', panel([task('1', 'Fundo', 'done', { startedAt: T0 + 20, endedAt: T0 + 30 }), task('2', 'Mais', 'open')]), { anchor: 'c1', running: true })
    const filha = child('local_filha', 'filha', panel([task('c1', 'Delegar', 'open', { started: 1, startedAt: T0 + 10 })], undefined, { children: [neta] }), { anchor: 'A', running: true })
    const rows = layout(model([main([task('A', 'Origem', 'open', { started: 1, startedAt: T0 })])], [filha]), {}, NOW, ME)
    expect(titles(rows)).toEqual(['Origem', '  ⑂ filha', '    Delegar', '      ⑂ neta', '        Fundo', '        Mais'])
    // The daughter: her task and the granddaughter's two; the origin task: itself and the daughter's.
    expect(rows[1].sub).toEqual([1, 3])
    expect(rows[0].sub).toEqual([1, 4])
    expect(rows[3].sub).toEqual([1, 2])
    expect(cards(rows).map(r => r.depth)).toEqual([1, 3])
    // All three at work: the granddaughter runs, so do the task she hangs from and the origin.
    expect(rows.slice(0, 4).map(r => r.tone)).toEqual(['current', 'running', 'current', 'running'])
  })

  test('↩ por turno: cada pedido fechado mostra sua resposta (o resumo do done, senão "resposta"); um pedido com cartão de filha não', () => {
    const tasks = [task('1', 'Um', 'done', { turn: 1 }), task('2', 'Dois', 'done', { turn: 2 }), task('3', 'Três', 'done', { turn: 3 })]
    const turns = [turn(1, T0, { reply: 'Primeira resposta inteira.', brief: 'Primeira' }), turn(2, T0 + 10, { reply: 'Segunda.' }), turn(3, T0 + 20, { reply: 'Terceira.' })]
    const kid = child('local_k', 'filha', panel([task('1', 'x', 'done')]), { anchor: '3' })
    const rows = layout(model([main(tasks, turns)], [kid]), {}, NOW, ME)
    const replies = rows.filter(r => r.tone === 'reply')
    expect(replies.map(r => [r.title, r.whole])).toEqual([
      ['Primeira', 'Primeira resposta inteira.'],
      ['resposta', 'Segunda.'],
    ])
    // Under the third turn: its task, the card and the card's task; no ↩ of its own.
    expect(titles(under(rows, at(rows, '|T:3')))).toEqual(['  Três', '    ⑂ filha', '      x'])
    expect(under(rows, at(rows, '|T:3')).some(r => r.tone === 'reply')).toBe(false)
  })

  test('+N pedidos anteriores: só os 3 últimos pedidos são desenhados, e um pedido antigo com tarefa aberta fica', () => {
    const tasks = [1, 2, 3, 4, 5].map(k => task(String(k), `Tarefa ${k}`, k === 1 ? 'open' : 'done', { turn: k }))
    const turns = [1, 2, 3, 4, 5].map(k => turn(k, T0 + k))
    const rows = layout(model([main(tasks, turns)]), {}, NOW, ME)
    expect(rows[0]).toMatchObject({ tone: 'section', title: '+1 pedidos anteriores' })
    expect(rows.filter(r => r.depth === 0 && r.fold).map(r => r.fold?.key)).toEqual(['|T:1', '|T:3', '|T:4', '|T:5'])
    expect(header(rows).n).toBe(4)
  })

  test('mensagem na fila (✉): a tarefa de origem fica à espera da sessão, no painel e dentro de um cartão', () => {
    const kidPanel = panel([task('k1', 'Avisar', 'open', { started: 1, startedAt: T0 })], undefined, { sends: [{ to: 'local_outra', anchor: 'k1' }] })
    const kid = child('local_k', 'filha', kidPanel, { anchor: 'A/2', running: true })
    const tasks = [task('A', 'Orquestrar', 'open', { started: 1, startedAt: T0, children: [task('A/1', 'Abrir', 'done'), task('A/2', 'Mandar', 'open', { started: 2, startedAt: T0 + 1 })] })]
    const rows = layout(model([main(tasks)], [kid], { sends: [{ to: 'local_k', anchor: 'A/2' }] }), {}, NOW, ME)
    const mandar = rows.find(r => r.title === 'Mandar') as Row
    expect(mandar.tone).toBe('sent')
    expect(mandar.label).toBe('Aguardando confirmação de local_k')
    const avisar = rows.find(r => r.title === 'Avisar') as Row
    expect(avisar.tone).toBe('sent')
    expect(avisar.label).toBe('Aguardando confirmação de local_outra')
    expect(header(rows, ['A/2']).sent).toBe(2)
    // The header's "em andamento" leaves out this session's own queued tasks (sentIds), not a
    // card's: the child's ✉ task still counts as in progress there.
    known('chip em andamento com ✉ de filha', header(rows, ['A/2']).active === 0, `active = ${header(rows, ['A/2']).active}`)
  })

  test('aviso ao usuário: sob a tarefa em andamento do agente, e no chip de espera', () => {
    const tasks = [task('A', 'Pedido', 'open', { children: [task('A/1', 'Perguntar', 'open', { started: 1, startedAt: T0 }), task('A/2', 'Depois', 'open')] })]
    const rows = layout(model([main(tasks)], [], { waits: [{ agent: MAIN, kind: 'question', tool: 'AskUserQuestion', key: 'k' }] }), {}, NOW, ME)
    expect(titles(rows)).toEqual(['Pedido', '  Perguntar', '    Aguardando sua resposta', '  Depois'])
    expect(rows[2]).toMatchObject({ tone: 'wait', label: '' })
    expect(header(rows).waiting).toBe(1)
  })

  test('escolhas: uma linha fechada guarda em nodes o que estava embaixo, e as linhas somem', () => {
    const tasks = [task('A', 'Raiz', 'open', { children: [task('A/1', 'Um', 'done'), task('A/2', 'Dois', 'open')] })]
    const open = layout(model([main(tasks)]), {}, NOW, ME)
    const closed = layout(model([main(tasks)]), { '|t:A': true }, NOW, ME)
    expect(open.map(r => r.title)).toEqual(['Raiz', 'Um', 'Dois'])
    expect(closed.map(r => r.title)).toEqual(['Raiz'])
    expect(closed[0].fold).toEqual({ key: '|t:A', open: false })
    expect((closed[0].nodes ?? []).map(t => t.id)).toEqual(['A'])
    expect([header(closed).d, header(closed).n]).toEqual([1, 2])
  })

  test('corte de 400 linhas: os blocos antigos saem contados, os recentes ficam', () => {
    const tasks = Array.from({ length: 150 }, (_, i) => task(`G${i}`, `Grupo ${i}`, 'open', { children: Array.from({ length: 4 }, (_, k) => task(`G${i}/e${k}`, `Etapa ${k} do grupo ${i}`)) }))
    const rows = layout(model([main(tasks)]), {}, NOW, ME)
    expect(rows.length).toBeLessThanOrEqual(400)
    expect(rows[0]).toMatchObject({ depth: 0, tone: 'section' })
    expect(rows[0].title).toMatch(/^\+\d+ linhas anteriores$/)
    const counted = Number(/\d+/.exec(rows[0].title)?.[0])
    expect(counted + rows.length - 1).toBe(750)
    expect(rows[1].depth).toBe(0)
    expect(rows.some(r => r.title === 'Etapa 3 do grupo 149')).toBe(true)
    expect(rows.some(r => r.title === 'Grupo 0')).toBe(false)
  })
})
