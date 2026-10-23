import { describe, expect, test } from 'claude-code/testing'
import { MAIN, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Group, Panel, TaskNode, Turn } from '../types'

// The person: "quando uma tarefa chama uma sessão, o painel não deve ficar dentro de outro. Ele deveria
// ficar na sequencia que será executado". The cards of a chain (the mother sends correção a message,
// correção sends governança one, governança sends correção one back) come one after the other, at the
// same level, in the order they ran, under the mother's task that started the chain: no card inside a
// card. They were nested three deep (correção ⊃ governança ⊃ correção), each inside the card of the
// session that sent its message.

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

// The mother, on "Responder a pergunta do J", sent correção a message; correção, on "Sinal do commit à
// governança", sent governança one; governança, on "Atualizar o PR e as labels", sent correção one, and
// correção took it up on "Retomar depois do hash".
const correcao = () =>
  child('local_corr', 'correcao', panel(
    [
      task('1', 'Sinal do commit à governança', 'done', { turn: 1, startedAt: T0 + 10, endedAt: T0 + 40 }),
      task('2', 'Retomar depois do hash', 'open', { turn: 2, started: 1, startedAt: T0 + 210 }),
    ],
    [turn(1, T0 + 5), turn(2, T0 + 205)],
    { received: [{ from: 'local_gov', at: T0 + 200 }], sends: [{ to: 'local_gov', anchor: '1', at: T0 + 30 }] },
  ), { anchor: 'M', running: true, rounds: [{ at: T0 + 1, anchor: 'M' }] })
const governanca = () =>
  child('local_gov', 'governanca', panel(
    [task('1', 'Atualizar o PR e as labels', 'done', { turn: 1, startedAt: T0 + 110, endedAt: T0 + 190 })],
    [turn(1, T0 + 105)],
    { received: [{ from: 'local_corr', at: T0 + 100 }], sends: [{ to: 'local_corr', anchor: '1', at: T0 + 180 }] },
  ))
const mother = () => main([task('M', 'Responder a pergunta do J', 'open', { started: 1, startedAt: T0 })])

describe('cadeia de sessões: um cartão depois do outro, nenhum dentro de outro', () => {
  test('mãe → correção → governança → correção: os três cartões sob a tarefa da mãe, no mesmo nível, na ordem em que rodaram', () => {
    for (const view of ['full', 'summary'] as const) {
      const rows = layout(model([mother()], [correcao(), governanca()], { view }), {}, NOW, ME)
      expect([view, titles(rows)]).toEqual([view, [
        'Responder a pergunta do J',
        '  ⑂ correcao',
        '    Sinal do commit à governança',
        '  ⑂ governanca',
        '    Atualizar o PR e as labels',
        '  ⑂ correcao',
        '    Retomar depois do hash',
      ]])
      // No card inside a card.
      expect(rows.filter(r => r.session).map(r => r.depth)).toEqual([1, 1, 1])
      // The chain still works under the mother's task: it is in progress.
      expect(rows[0].tone).toBe('current')
    }
  })

  test('a ordem é a da execução, não a das sessões na lista', () => {
    const rows = layout(model([mother()], [governanca(), correcao()]), {}, NOW, ME)
    expect(rows.filter(r => r.session).map(r => `${r.depth} ${r.title}`)).toEqual(['1 correcao', '1 governanca', '1 correcao'])
  })
})
