import { describe, expect, test } from 'claude-code/testing'
import { REAL } from './fixtures/orquestradora-real'
import { layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Published } from '../types'

// Nothing folds by itself: with no choice of the person, every card comes open, with its lines, in
// both views. The person's panel (summary, desktop) showed some 14 cards "nome ⋯" stacked under the
// mother's task, folded with no click: the cards of the sisters' talk, now nested in the sender's card
// (see nest and cadeia-irmas.test.ts). The real state, read again, draws none folded or empty.

const own: any = REAL.own
const ME = REAL.me as string
const AT = own.at as number
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
const model = (view: 'full' | 'summary'): Model => ({
  groups: own.groups,
  waits: [],
  children: own.children.map((c: any) => childOf(c, JSON.parse(REAL.files[c.id]))),
  sends: [],
  view,
  work: own.work,
})
// The cards drawn folded, or with nothing below them: they read as folded.
const shut = (rows: Row[]) =>
  rows.flatMap((r, i) => (r.session && ((r.fold && !r.fold.open) || !(rows[i + 1] && rows[i + 1].depth > r.depth)) ? [`${r.title} ${r.fold?.key ?? '(sem dobra)'}`] : []))

describe('cartões abertos, nas duas visões', () => {
  test('sem escolha do usuário, nenhum cartão aparece recolhido ou sem linhas embaixo (estado real)', () => {
    for (const view of ['full', 'summary'] as const) {
      const rows = layout(model(view), {}, AT, ME)
      expect(rows.some(r => r.session)).toBe(true)
      expect([view, shut(rows)]).toEqual([view, []])
    }
  })
})
