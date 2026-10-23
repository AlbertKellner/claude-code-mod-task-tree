import { describe, expect, test } from 'claude-code/testing'
import { MAIN, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Group, Panel, TaskNode, Turn } from '../types'
import { REAL } from './fixtures/orquestradora-real'
import type { Published } from '../types'

// The real orchestrator's state (fixtures/orquestradora-real.ts), as layout.test.ts builds it.
const own: any = REAL.own
const ME_REAL = REAL.me as string
const AT_REAL = own.at as number
function childOfReal(c: any, file: Published): Child {
  return { id: c.id, name: c.name, title: c.title, running: c.running, archived: c.archived, waiting: file.waiting, context: file.context?.percent, engine: file.engine, anchor: c.anchor, lastAnchor: c.lastAnchor, rounds: c.rounds, panel: { groups: file.groups ?? [], waits: file.waits ?? [], children: file.children ?? [], ...(file.work ? { work: file.work } : {}), ...(file.received ? { received: file.received } : {}), ...(file.sends ? { sends: file.sends } : {}) } }
}
const realModel = (view: 'full' | 'summary'): Model => ({ groups: own.groups, waits: [], children: own.children.map((c: any) => childOfReal(c, JSON.parse(REAL.files[c.id]))), sends: [], view, work: own.work })

// A session's card shows under the task that sent its message, open, from the first drawing; only the
// person's click folds it, and the fold stays with that card. Two ways this broke:
// - The fold of a card was keyed by its index among the session's rounds (`#k`). The rounds are kept to
//   the last 20: at the cap every new message drops the oldest and shifts every index by one, so a fold
//   the person made moved to another card, and a new card could come folded (the person's panel: an
//   open card came back folded, at the end, after a new request of the orchestrator).
// - In the summary view a card at work whose task was done in an earlier request was drawn loose at the
//   end of the list, at the root; in the full view it went with its request out of the last three. A
//   task with a session at work under it is still going on: its request stays in sight, with the card
//   under the task that sent the message (the person's words: "se existirem tarefas em andamento, essas
//   tarefas devem continuar sendo mostradas").

const task = (id: string, title: string, status: TaskNode['status'] = 'open', extra: Partial<TaskNode> = {}): TaskNode => ({ id, short: id.split('/').pop() as string, title, status, children: [], ...extra })
const turn = (id: number, at: number, extra: Partial<Turn> = {}): Turn => ({ id, title: `Pedido ${id}`, at, ...extra })
const main = (tasks: TaskNode[], turns?: Turn[]): Group => ({ agent: MAIN, label: '', tasks, ...(turns ? { turns } : {}) })
const panel = (tasks: TaskNode[], turns?: Turn[], extra: Partial<Panel> = {}): Panel => ({ groups: [main(tasks, turns)], waits: [], children: [], ...extra })
const child = (id: string, name: string, p: Panel, extra: Partial<Child> = {}): Child => ({ id, name, title: name, running: false, archived: false, panel: p, ...extra })
const model = (groups: Group[], children: Child[] = [], extra: Partial<Model> = {}): Model => ({ groups, waits: [], children, sends: [], view: 'full', work: [], ...extra })
const titles = (rows: Row[]) => rows.map(r => `${'  '.repeat(r.depth)}${r.tone === 'section' ? '§ ' : r.session ? '⑂ ' : r.tone === 'reply' ? '↩ ' : ''}${r.title}`)
const T0 = 1_000_000
const NOW = 9_000_000
const ME = 'local_eu'
const KID = 'local_filha'

// The mother: one request with one level-1 task per message, each sending it (m1, m2, …); the child:
// one turn per message, with one task each (f1, f2, …), taken up just after the message.
function story(n: number, keep = 20) {
  const STEP = 10_000
  const mtasks: TaskNode[] = []
  const mturns: Turn[] = [turn(1, T0)]
  const ftasks: TaskNode[] = []
  const fturns: Turn[] = []
  const rounds: { at: number; anchor?: string }[] = []
  for (let k = 1; k <= n; k++) {
    const at = T0 + k * STEP
    mtasks.push(task(`m${k}`, `Mandar a mensagem ${k}`, 'done', { turn: 1, plannedAt: at, startedAt: at, endedAt: at + 100 }))
    rounds.push({ at: at + 50, anchor: `m${k}` })
    fturns.push(turn(k, at + 60, { title: `Mensagem ${k}` }))
    ftasks.push(task(`f${k}`, `Trabalho da mensagem ${k}`, 'done', { turn: k, plannedAt: at + 70, startedAt: at + 70, endedAt: at + 90 }))
  }
  return { mtasks, mturns, ftasks, fturns, rounds: rounds.slice(-keep) }
}

describe('cartões: recolher fica com o cartão, mesmo quando as rodadas passam do teto', () => {
  test('a pessoa recolhe o cartão da mensagem 15; uma mensagem nova (21ª, com o teto de 20): o 15 continua recolhido e o novo vem aberto', () => {
    // 20 messages: rounds 1..20.
    const a = story(20)
    const kidA = child(KID, 'filha', panel(a.ftasks, a.fturns), { anchor: 'm1', rounds: a.rounds })
    const rowsA = layout(model([main(a.mtasks, a.mturns)], [kidA]), {}, NOW, ME)
    const card15 = rowsA.find(r => r.session && rowsA[rowsA.indexOf(r) + 1]?.title === 'Trabalho da mensagem 15')
    expect(card15?.fold?.key).toBeDefined()
    // The person folds it.
    const choices = { [card15!.fold!.key]: true }
    // 21 messages: the oldest round dropped (the cap of 20), indices shifted.
    const b = story(21)
    const kidB = child(KID, 'filha', panel(b.ftasks, b.fturns), { anchor: 'm1', rounds: b.rounds })
    const rowsB = layout(model([main(b.mtasks, b.mturns)], [kidB], { work: [] }), choices, NOW, ME)
    const cardOf = (k: number) => {
      const i = rowsB.findIndex((r, j) => r.session && (rowsB[j + 1]?.title === `Trabalho da mensagem ${k}` || (r.fold?.open === false && (r.nodes ?? []).some((t: any) => t.title === `Trabalho da mensagem ${k}`))))
      return rowsB[i]
    }
    expect(cardOf(15)?.fold?.open).toBe(false)
    expect(cardOf(21)?.fold?.open).toBe(true)
    expect(cardOf(16)?.fold?.open).toBe(true)
  })
})

describe('cartões: o cartão de uma sessão trabalhando fica sob a tarefa que mandou a mensagem', () => {
  // Request 1 sent the message from "z1" (done); requests 2, 3 and 4 came later; the child is at work on
  // that message. The current work holds requests 1 and 4 (the card with an open task kept request 1
  // in sight; requests 2 and 3 were planned with nothing open and left).
  const build = () => {
    const at = (k: number) => T0 + k * 10_000
    const mturns = [1, 2, 3, 4].map(k => turn(k, at(k), { title: `Pedido ${k}` }))
    const mtasks = [
      task('z1', 'Mandar o bug à filha', 'done', { turn: 1, plannedAt: at(1), startedAt: at(1), endedAt: at(1) + 100 }),
      task('b2', 'Outra coisa feita', 'done', { turn: 2, plannedAt: at(2), startedAt: at(2), endedAt: at(2) + 100 }),
      task('c3', 'Mais uma feita', 'done', { turn: 3, plannedAt: at(3), startedAt: at(3), endedAt: at(3) + 100 }),
      task('v4', 'Pedido atual', 'open', { turn: 4, plannedAt: at(4), startedAt: at(4), started: 1 }),
    ]
    const kid = child(KID, 'filha', panel([task('G', 'Trabalhando no bug', 'open', { turn: 1, plannedAt: at(1) + 70, startedAt: at(1) + 70, started: 1 })], [turn(1, at(1) + 60)]), {
      anchor: 'z1',
      lastAnchor: 'z1',
      running: true,
      rounds: [{ at: at(1) + 50, anchor: 'z1' }],
    })
    return { mother: main(mtasks, mturns), kid }
  }

  test('resumida: o cartão aparece sob "Mandar o bug à filha", no pedido dela, não solto no fim', () => {
    const { mother, kid } = build()
    const t = titles(layout(model([mother], [kid], { view: 'summary', work: ['z1', 'v4'] }), {}, NOW, ME))
    const origin = t.findIndex(x => x.trim() === 'Mandar o bug à filha')
    const card = t.findIndex(x => x.trim() === '⑂ filha')
    expect(origin).toBeGreaterThanOrEqual(0)
    expect(card).toBe(origin + 1)
    expect(t.some(x => x.includes('Pedido atual'))).toBe(true)
    // Requests out of the work are not drawn.
    expect(t.some(x => x.includes('Outra coisa feita'))).toBe(false)
  })

  test('completa: o pedido com a sessão trabalhando fica à vista (além dos 3 últimos), com o cartão sob a tarefa', () => {
    const { mother, kid } = build()
    const t = titles(layout(model([mother], [kid], { work: ['v4'] }), {}, NOW, ME))
    const origin = t.findIndex(x => x.trim() === 'Mandar o bug à filha')
    expect(origin).toBeGreaterThanOrEqual(0)
    expect(t[origin + 1]?.trim()).toBe('⑂ filha')
  })
})

// The summary view is the full view with fewer requests (the finished ones of earlier turns left out):
// it never moves a card. The person, with two pictures of one moment: "a visão completa parece mais
// correta que a resumida" (in the summary the card had moved under the current request).
describe('resumida: a completa sem os pedidos finalizados, cartões nas mesmas âncoras', () => {
  // The parent of each card: the nearest line above it one level up.
  const parents = (rows: Row[]) =>
    rows.flatMap((r, i) => {
      if (!r.session) return []
      let j = i - 1
      while (j >= 0 && rows[j].depth >= r.depth) j--
      return [`${r.fold?.key ?? r.title} ⟵ ${j >= 0 ? rows[j].title : '(raiz)'}`]
    })

  test('sessão sem rodadas (aberta numa tarefa de um pedido em andamento) e a última mensagem de outra tarefa: o cartão não muda de lugar na resumida', () => {
    const at = (k: number) => T0 + k * 10_000
    const mturns = [1, 2].map(k => turn(k, at(k), { title: `Pedido ${k}` }))
    const mtasks = [
      task('a1', 'Investigar ainda', 'open', { turn: 1, plannedAt: at(1), startedAt: at(1), started: 1 }),
      task('b2', 'Pedido atual', 'open', { turn: 2, plannedAt: at(2), startedAt: at(2), started: 2 }),
    ]
    // Opened on a1; its last message went from b2 (lastAnchor), with no round recorded (older data).
    const kid = child(KID, 'filha', panel([task('G', 'Trabalho da filha', 'open', { plannedAt: at(1) + 70, startedAt: at(1) + 70, started: 1 })]), { anchor: 'a1', lastAnchor: 'b2', running: true })
    const m = main(mtasks, mturns)
    const full = layout(model([m], [kid], { work: ['a1', 'b2'] }), {}, NOW, ME)
    const summary = layout(model([m], [kid], { work: ['a1', 'b2'], view: 'summary' }), {}, NOW, ME)
    expect(parents(full)).toEqual(['s:local_filha ⟵ Investigar ainda'])
    expect(parents(summary)).toEqual(parents(full))
  })

  test('estado real: cada cartão da resumida está sob a mesma linha que na completa', () => {
    const full = layout(realModel('full'), {}, AT_REAL, ME_REAL)
    const summary = layout(realModel('summary'), {}, AT_REAL, ME_REAL)
    const inFull = new Set(parents(full))
    for (const p of parents(summary)) expect(inFull.has(p) ? p : `fora da completa: ${p}`).toBe(p)
  })
})

// Messages queued to a busy session and delivered together open one turn of it: the turn's card goes
// under the task of the first of those messages (the order the work ran in), not under the last one.
// The person's panel: messages from c1, f1, r1, e1, o1 and k1; f1 to k1 were delivered at once into one
// turn, and its card went under k1, the last; the person expected it under the first.
describe('cartões: um turno que recebeu várias mensagens de uma vez', () => {
  // The person: "quero ver as tarefas lineares andando de cima pra baixo. as paralelas vão andar fora de
  // ordem, normal, mas as lineares precisam seguir uma linha do tempo". A turn opened by messages
  // delivered together starts after the last of them: its card goes under that one's task, and the
  // earlier ones close with the delivery, with no card (it went under the first's).
  test('quatro mensagens na fila entregues juntas: o cartão do turno vai para a tarefa da última', () => {
    const at = (k: number) => T0 + k * 10_000
    const mturns = [turn(1, at(1), { title: 'Pedido' })]
    const ids = ['c1', 'f1', 'r1', 'e1', 'o1']
    const mtasks = ids.map((id, k) => task(id, `Mensagem de ${id}`, 'done', { turn: 1, plannedAt: at(1) + k * 1000, startedAt: at(1) + k * 1000, endedAt: at(1) + k * 1000 + 100 }))
    // c1's message opened the child's turn 1; f1, r1, e1, o1 went while it worked and were delivered
    // together, opening turn 2.
    const rounds = ids.map((id, k) => ({ at: at(1) + k * 1000 + 50, anchor: id }))
    const t1 = at(1) + 80
    const t2 = at(1) + 4 * 1000 + 500
    const kid = child(KID, 'filha', panel(
      [task('A', 'Trabalho da primeira', 'done', { turn: 1, plannedAt: t1, startedAt: t1, endedAt: t1 + 10 }), task('B', 'Trabalho das quatro', 'done', { turn: 2, plannedAt: t2, startedAt: t2, endedAt: t2 + 10 })],
      [turn(1, t1, { title: 'Mensagem c1' }), turn(2, t2, { title: 'Mensagens f1 a o1' })],
      { received: [{ from: ME, at: t1 - 10 }, { from: ME, at: t2 - 20 }, { from: ME, at: t2 - 20 }, { from: ME, at: t2 - 20 }, { from: ME, at: t2 - 20 }] },
    ), { anchor: 'c1', rounds })
    const t = titles(layout(model([main(mtasks, mturns)], [kid]), {}, NOW, ME))
    const under = (task: string) => t[t.findIndex(x => x.trim() === task) + 1]?.trim()
    expect(under('Mensagem de c1')).toBe('⑂ filha')
    expect(under('Mensagem de o1')).toBe('⑂ filha')
    expect(t[t.findIndex(x => x.trim() === 'Mensagem de o1') + 2]?.trim()).toBe('Trabalho das quatro')
    // The other messages of the batch have no card of their own (the work began after the last one).
    expect(under('Mensagem de f1')).not.toBe('⑂ filha')
    expect(under('Mensagem de r1')).not.toBe('⑂ filha')
    expect(under('Mensagem de e1')).not.toBe('⑂ filha')
  })

  test('o caso real: "uma rodada basta" e o bug dos cliques entregues juntos: o trabalho fica sob o pedido dos cliques', () => {
    const at = (k: number) => T0 + k * 10_000
    const mtasks = [
      task('s1x', 'Suíte uma vez só', 'done', { turn: 1, plannedAt: at(1), startedAt: at(1), endedAt: at(1) + 100 }),
      task('ck', 'Bug: clique nos ícones precisa repetir', 'done', { turn: 2, plannedAt: at(2), startedAt: at(2), endedAt: at(2) + 100 }),
    ]
    const rounds = [{ at: at(1) + 50, anchor: 's1x' }, { at: at(2) + 50, anchor: 'ck' }]
    const tl = at(2) + 500
    const kid = child(KID, 'filha', panel(
      [task('L', 'L: cliques falham ou demoram', 'open', { turn: 1, started: 1, plannedAt: tl, startedAt: tl })],
      [turn(1, tl, { title: 'Suíte uma vez; bug L dos cliques' })],
      { received: [{ from: ME, at: tl - 20 }, { from: ME, at: tl - 20 }] },
    ), { anchor: 's1x', rounds, running: true })
    const t = titles(layout(model([main(mtasks, [turn(1, at(1), { title: 'Suíte' }), turn(2, at(2), { title: 'Cliques' })])], [kid]), {}, NOW, ME))
    const next = (task: string) => t.slice(t.findIndex(x => x.trim() === task) + 1, t.findIndex(x => x.trim() === task) + 3).map(x => x.trim())
    expect(next('Bug: clique nos ícones precisa repetir')).toEqual(['⑂ filha', 'L: cliques falham ou demoram'])
    expect(next('Suíte uma vez só')[0]).not.toBe('⑂ filha')
  })

  test('uma mensagem por turno: cada cartão sob a tarefa da sua mensagem (regra mantida)', () => {
    const at = (k: number) => T0 + k * 10_000
    const mtasks = [task('a1', 'Abrir', 'done', { turn: 1, plannedAt: at(1), startedAt: at(1), endedAt: at(1) + 100 }), task('b1', 'Mandar outra', 'done', { turn: 1, plannedAt: at(2), startedAt: at(2), endedAt: at(2) + 100 })]
    const rounds = [{ at: at(1) + 50, anchor: 'a1' }, { at: at(2) + 50, anchor: 'b1' }]
    const t1 = at(1) + 80
    const t2 = at(2) + 80
    const kid = child(KID, 'filha', panel(
      [task('A', 'Do a1', 'done', { turn: 1, plannedAt: t1, startedAt: t1, endedAt: t1 + 10 }), task('B', 'Do b1', 'done', { turn: 2, plannedAt: t2, startedAt: t2, endedAt: t2 + 10 })],
      [turn(1, t1), turn(2, t2)],
      { received: [{ from: ME, at: t1 - 10 }, { from: ME, at: t2 - 10 }] },
    ), { anchor: 'a1', rounds })
    const t = titles(layout(model([main(mtasks, [turn(1, at(1))])], [kid]), {}, NOW, ME))
    const under = (task: string) => t.slice(t.findIndex(x => x.trim() === task) + 1, t.findIndex(x => x.trim() === task) + 3).map(x => x.trim())
    expect(under('Abrir')).toEqual(['⑂ filha', 'Do a1'])
    expect(under('Mandar outra')).toEqual(['⑂ filha', 'Do b1'])
  })
})
