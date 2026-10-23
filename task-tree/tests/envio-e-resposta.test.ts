import { describe, expect, test } from 'claude-code/testing'
import { MAIN, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Group, Panel, Send, TaskNode, Turn } from '../types'

// Two things the person saw in the panel:
// - A level-1 task whose subtask waits on a message not yet delivered (✉) was drawn as not started (an
//   empty circle), and so was its request, while the work was going on: the parent of a task waiting
//   on a session is in progress.
// - The ↩ line of a request (and of a card's turn) with no summary showed the placeholder "resposta".
//   The person, before: never the answer's text cut ("quero que seja um resumo da resposta, super
//   curto"); now: the ↩ line only with real text. So with no summary there is no ↩ line.

const task = (id: string, title: string, status: TaskNode['status'] = 'open', extra: Partial<TaskNode> = {}): TaskNode => ({ id, short: id.split('/').pop() as string, title, status, children: [], ...extra })
const turn = (id: number, at: number, extra: Partial<Turn> = {}): Turn => ({ id, title: `Pedido ${id}`, at, ...extra })
const main = (tasks: TaskNode[], turns?: Turn[]): Group => ({ agent: MAIN, label: '', tasks, ...(turns ? { turns } : {}) })
const panel = (tasks: TaskNode[], turns?: Turn[], extra: Partial<Panel> = {}): Panel => ({ groups: [main(tasks, turns)], waits: [], children: [], ...extra })
const child = (id: string, name: string, p: Panel, extra: Partial<Child> = {}): Child => ({ id, name, title: name, running: false, archived: false, panel: p, ...extra })
const model = (groups: Group[], children: Child[] = [], extra: Partial<Model> = {}): Model => ({ groups, waits: [], children, sends: [], view: 'full', work: [], ...extra })
const T0 = 1_000_000
const NOW = 2_000_000
const ME = 'local_eu'
const row = (rows: Row[], title: string) => rows.find(r => r.title === title)

describe('pai de uma tarefa à espera de uma mensagem (✉) está em andamento', () => {
  // Request 1: "Bug" holds only "Mandar à correção" (planned to send and sent, with no start: its message
  // is queued), 0/1. Request 2: "Outra coisa" is the task started now (the lit one).
  const groups = () => [
    main(
      [
        task('B', 'Bug: tarefas com ✉ somem', 'open', { turn: 1, plannedAt: T0, children: [task('B/1', 'Mandar à correção', 'open', { plannedAt: T0 + 200 })] }),
        task('X', 'Outra coisa', 'open', { turn: 2, plannedAt: T0 + 1000, startedAt: T0 + 1000, started: 1 }),
      ],
      [turn(1, T0, { title: 'Bug do ✉' }), turn(2, T0 + 1000, { title: 'Pedido seguinte' })],
    ),
  ]
  const sends: Send[] = [{ to: 'local_correcao', anchor: 'B/1', at: T0 + 300 }]

  test('a subtarefa mostra ✉; o nível 1 e o pedido aparecem em andamento, não como não iniciados', () => {
    const rows = layout(model(groups(), [], { sends }), {}, NOW, ME)
    expect(row(rows, 'Mandar à correção')?.tone).toBe('sent')
    expect(row(rows, 'Bug: tarefas com ✉ somem')?.tone).toBe('current')
    expect(row(rows, 'Bug do ✉')?.tone).toBe('current')
  })

  test('sem mensagem pendente, o mesmo nível 1 continua aberto, como antes', () => {
    const rows = layout(model(groups()), {}, NOW, ME)
    expect(row(rows, 'Bug: tarefas com ✉ somem')?.tone).toBe('open')
  })
})

describe('linha ↩ só com texto de verdade', () => {
  test('pedido concluído sem summary: sem linha ↩ (nem o marcador "resposta"); com summary, a linha traz o summary', () => {
    const rows = layout(
      model([main(
        [task('A', 'Sem resumo', 'done', { turn: 1, plannedAt: T0, startedAt: T0, endedAt: T0 + 100 }), task('C', 'Com resumo', 'done', { turn: 2, plannedAt: T0 + 1000, startedAt: T0 + 1000, endedAt: T0 + 1100 })],
        [turn(1, T0, { title: 'Pedido sem resumo', reply: 'Feito. Um texto longo de resposta que não deve aparecer cortado.' }), turn(2, T0 + 1000, { title: 'Pedido com resumo', reply: 'Resposta inteira.', brief: 'Resumo do pedido' })],
      )]),
      {},
      NOW,
      ME,
    )
    const replies = rows.filter(r => r.tone === 'reply').map(r => r.title)
    expect(replies).toEqual(['Resumo do pedido'])
  })

  test('cartão de sessão: o turno sem summary não tem linha ↩; o com summary tem', () => {
    const kid = child('local_filha', 'filha', panel(
      [task('F1', 'Um', 'done', { turn: 1, plannedAt: T0 + 10, startedAt: T0 + 10, endedAt: T0 + 20 }), task('F2', 'Dois', 'done', { turn: 2, plannedAt: T0 + 30, startedAt: T0 + 30, endedAt: T0 + 40 })],
      [turn(1, T0 + 5, { reply: 'sem resumo aqui' }), turn(2, T0 + 25, { reply: 'com resumo aqui', brief: 'Resumo da filha' })],
    ), { anchor: 'A' })
    const rows = layout(model([main([task('A', 'Origem', 'done', { turn: 1, plannedAt: T0, startedAt: T0, endedAt: T0 + 100 })], [turn(1, T0)])], [kid]), {}, NOW, ME)
    expect(rows.filter(r => r.tone === 'reply').map(r => r.title)).toEqual(['Resumo da filha'])
  })
})
