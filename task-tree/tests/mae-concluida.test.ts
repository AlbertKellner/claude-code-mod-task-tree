import { describe, expect, test } from 'claude-code/testing'
import { MAIN, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Group, Panel, TaskNode, Turn } from '../types'

// A task the mother closed with done is done, even with a session still at work under it: the
// session's progress stays in its card. It was drawn in progress with the sessions' tasks summed in its
// count (the person's panel: "Conferir o clone e retomar a correção", closed, shown ◉ "45/46", and its
// request too). An open task keeps the rule it had: a session at work under it keeps it in progress and
// adds to its count.

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

// The child at work: 3 of its 4 tasks done.
const working = () =>
  child('local_filha', 'filha', panel(
    [task('W', 'Trabalho da filha', 'open', { started: 1, plannedAt: T0 + 10, startedAt: T0 + 10, children: [1, 2, 3, 4].map(k => task(`W/${k}`, `Passo ${k}`, k < 4 ? 'done' : 'open', { plannedAt: T0 + 10, startedAt: T0 + 10, ...(k < 4 ? { endedAt: T0 + 20 } : { started: 1 }) })) })],
  ), { anchor: 'rt', running: true })

describe('tarefa da mãe concluída com uma sessão ainda trabalhando embaixo', () => {
  test('a tarefa e o pedido aparecem concluídos, sem somar as tarefas da sessão; o cartão mostra o progresso dela', () => {
    const mother = main([task('rt', 'Conferir o clone e retomar', 'done', { turn: 1, plannedAt: T0, startedAt: T0, endedAt: T0 + 5 })], [turn(1, T0, { title: 'Retomar a série' })])
    const rows = layout(model([mother], [working()]), {}, NOW, ME)
    expect(row(rows, 'Conferir o clone e retomar')?.tone).toBe('done')
    // Its own count only (a task with a session below shows one): the session's tasks are not in it.
    expect(row(rows, 'Conferir o clone e retomar')?.sub).toEqual([1, 1])
    expect(row(rows, 'Retomar a série')?.tone).toBe('done')
    expect(row(rows, 'Retomar a série')?.sub).toEqual([1, 1])
    // The card, under the task, still shows the session at work and its own count.
    expect(row(rows, 'filha')?.tone).toBe('running')
    expect(row(rows, 'Trabalho da filha')?.sub).toEqual([3, 4])
  })

  test('tarefa aberta com a sessão trabalhando embaixo continua em andamento e somando (regra mantida)', () => {
    const mother = main([task('rt', 'Conferir o clone e retomar', 'open', { turn: 1, plannedAt: T0 })], [turn(1, T0, { title: 'Retomar a série' })])
    const rows = layout(model([mother], [working()]), {}, NOW, ME)
    expect(row(rows, 'Conferir o clone e retomar')?.tone).toBe('current')
    expect(row(rows, 'Conferir o clone e retomar')?.sub).toEqual([3, 5])
  })
})
