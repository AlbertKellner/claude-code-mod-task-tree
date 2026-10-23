import { describe, expect, test } from 'claude-code/testing'
import { MAIN, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Group, Panel, TaskNode, Turn } from '../types'

// The person: under the mother's task, only the cards of the messages she sent; a message a sister S
// sends C goes inside S's card, under the task of S that sent it. The cards of the sisters' talk were
// stacked under the mother's task (the chain put C's card under the task S's card hung from).

const task = (id: string, title: string, status: TaskNode['status'] = 'open', extra: Partial<TaskNode> = {}): TaskNode => ({ id, short: id.split('/').pop() as string, title, status, children: [], ...extra })
const turn = (id: number, at: number, extra: Partial<Turn> = {}): Turn => ({ id, title: `Pedido ${id}`, at, ...extra })
const main = (tasks: TaskNode[], turns?: Turn[]): Group => ({ agent: MAIN, label: '', tasks, ...(turns ? { turns } : {}) })
const panel = (tasks: TaskNode[], turns?: Turn[], extra: Partial<Panel> = {}): Panel => ({ groups: [main(tasks, turns)], waits: [], children: [], ...extra })
const child = (id: string, name: string, p: Panel, extra: Partial<Child> = {}): Child => ({ id, name, title: name, running: false, archived: false, panel: p, ...extra })
const model = (groups: Group[], children: Child[] = [], extra: Partial<Model> = {}): Model => ({ groups, waits: [], children, sends: [], view: 'full', work: [], ...extra })
const T0 = 1_000_000
const NOW = 2_000_000
const ME = 'local_eu'
const titles = (rows: Row[]) => rows.map(r => `${'  '.repeat(r.depth)}${r.tone === 'section' ? '§ ' : r.session ? '⑂ ' : r.tone === 'reply' ? '↩ ' : ''}${r.title}`)

// The mother sent impl a message from task 15; impl, in its turn, sent docs one from its task "Avisar a
// docs" (still waiting on it: its published send); docs took it up in a turn of its own. Later the
// mother sent docs a message herself, from task 16.
const impl = () =>
  child('local_impl', 'impl', panel(
    [task('1', 'Implementar', 'done', { turn: 1, startedAt: T0 + 10, endedAt: T0 + 50 }), task('2', 'Avisar a docs', 'open', { turn: 1, started: 1, startedAt: T0 + 60 })],
    [turn(1, T0 + 5)],
    { sends: [{ to: 'local_docs', anchor: '2', at: T0 + 90 }] },
  ), { anchor: '15', running: true, rounds: [{ at: T0 + 1, anchor: '15' }] })
const docs = (mine: boolean) =>
  child('local_docs', 'docs', panel(
    [task('1', 'Documentar', mine ? 'done' : 'open', { turn: 1, started: 1, startedAt: T0 + 110, ...(mine ? { endedAt: T0 + 150 } : {}) }), ...(mine ? [task('2', 'Revisar', 'open', { turn: 2, started: 2, startedAt: T0 + 310 })] : [])],
    [turn(1, T0 + 105), ...(mine ? [turn(2, T0 + 305)] : [])],
    { received: [{ from: 'local_impl', at: T0 + 100 }, ...(mine ? [{ from: ME, at: T0 + 300 }] : [])] },
  ), { running: true, ...(mine ? { anchor: '16', rounds: [{ at: T0 + 299, anchor: '16' }] } : {}) })
const mother = (both: boolean) =>
  main([task('15', 'Pedido 15', 'open', { started: 1, startedAt: T0 }), ...(both ? [task('16', 'Pedido 16', 'open', { started: 2, startedAt: T0 + 290 })] : [])])

describe('conversa entre irmãs: no cartão de quem mandou', () => {
  test('a mensagem de impl para docs fica dentro do cartão de impl, sob a tarefa que a mandou', () => {
    for (const view of ['full', 'summary'] as const) {
      const rows = layout(model([mother(false)], [impl(), docs(false)], { view }), {}, NOW, ME)
      expect([view, titles(rows)]).toEqual([view, ['Pedido 15', '  ⑂ impl', '    Pedido 1', '      Implementar', '      Avisar a docs', '        ⑂ docs', '          Documentar']])
      // The chain's card works inside impl's: the mother's task is at work too.
      expect(rows[0].tone).toBe('current')
    }
  })

  test('sob a tarefa da mãe, só os cartões das mensagens dela: a dela para docs fica sob a tarefa 16', () => {
    const rows = layout(model([mother(true)], [impl(), docs(true)]), {}, NOW, ME)
    expect(titles(rows)).toEqual([
      'Pedido 15',
      '  ⑂ impl',
      '    Pedido 1',
      '      Implementar',
      '      Avisar a docs',
      '        ⑂ docs',
      '          Documentar',
      'Pedido 16',
      '  ⑂ docs',
      '    Revisar',
    ])
  })

  test('sem o envio publicado, a tarefa da irmã é a que estava em andamento quando a mensagem chegou', () => {
    const quiet = impl()
    ;(quiet.panel as Panel).sends = []
    const rows = layout(model([mother(false)], [quiet, docs(false)]), {}, NOW, ME)
    expect(titles(rows)).toEqual(['Pedido 15', '  ⑂ impl', '    Pedido 1', '      Implementar', '      Avisar a docs', '        ⑂ docs', '          Documentar'])
  })
})
