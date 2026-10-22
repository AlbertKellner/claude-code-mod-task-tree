import { describe, expect, test } from 'claude-code/testing'
import { REAL } from './fixtures/orquestradora-real'
import { CELL, NAME_MIN, RING_CELLS, crossings, lineWidth, overlay, overlays, spanOf } from '../draw/geometry'
import { MAIN, frames, layout } from '../draw/layout'
import type { Model, Row } from '../draw/layout'
import type { Child, Published } from '../types'

// The Boxes laid over a line (the icon's Button, the ring's Button, the name layer) come from one
// function, overlays(), with one rule: no two of them cross on a line. Checked here on the real
// orchestrator's panel and on small lines, with no mount: overlays() takes what the drawing takes
// (the row, the cards it is inside, the width, whether its name is cut).
// A scenario that reveals a bug is in KNOWN (the kit has no skip/todo): it prints TODO and passes.

const KNOWN: Record<string, string> = {}
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
function childOf(c: any, file: Published): Child {
  return {
    id: c.id, name: c.name, title: c.title, running: c.running, archived: c.archived, waiting: file.waiting, context: file.context?.percent, engine: file.engine,
    anchor: c.anchor, lastAnchor: c.lastAnchor, rounds: c.rounds,
    panel: { groups: file.groups ?? [], waits: file.waits ?? [], children: file.children ?? [], ...(file.work ? { work: file.work } : {}), ...(file.received ? { received: file.received } : {}), ...(file.sends ? { sends: file.sends } : {}) },
  }
}
const realModel = (view: 'full' | 'summary'): Model => ({ groups: own.groups, waits: [], children: own.children.map((c: any) => childOf(c, JSON.parse(REAL.files[c.id]))), sends: [], view, work: own.work })

// What the drawing hands overlays() for each row: whether it folds, whether it is a session card
// with a ring, how many cards it is inside, and whether its name is cut (`hover`, given here).
const placedOf = (rows: Row[], W: number, hover: (r: Row) => boolean) => {
  const cards = frames(rows)
  return rows.map((r, i) => overlays({ depth: r.depth, folds: !!r.fold, ring: !!(r.session && r.sid && r.ring), hover: hover(r) }, Math.max(0, cards[i].cards.length - 1), W))
}

describe('sobreposições: uma regra, nenhum par de Box se cruza na mesma linha', () => {
  test('overlays() dá os mesmos Boxes que overlay() dava, um por um, e na ordem de desenho', () => {
    const W = lineWidth(100)
    for (let depth = 0; depth < 7; depth++) {
      for (let nested = 0; nested < 4; nested++) {
        const all = overlays({ depth, folds: true, ring: true, hover: true }, nested, W)
        expect(all.map(p => p.kind)).toEqual(['icon', 'ring', 'name'])
        expect(all[0]).toEqual({ kind: 'icon', ...overlay('icon', depth) })
        expect(all[1]).toEqual({ kind: 'ring', ...overlay('ring', nested) })
        // With a ring on the line, the name layer stops at the ring's Box; without, at the right end.
        expect(all[2]).toEqual({ kind: 'name', ...overlay('name', depth, W, nested) })
        expect(overlays({ depth, folds: true, ring: false, hover: true }, nested, W)[1]).toEqual({ kind: 'name', ...overlay('name', depth, W) })
        expect(all[1].width).toBe(RING_CELLS)
      }
    }
    expect(overlays({ depth: 1, folds: false, ring: false, hover: false }, 0, W)).toEqual([])
    expect(overlays({ depth: 1, folds: true, ring: false, hover: false }, 0, W).map(p => p.kind)).toEqual(['icon'])
  })

  test('os spans em px: Box pela esquerda, pela direita e a camada do nome', () => {
    const W = 472
    expect(spanOf({ kind: 'icon', left: 1, width: 3 }, W)).toEqual([CELL, 4 * CELL])
    expect(spanOf({ kind: 'ring', right: 2, width: 4 }, W)).toEqual([W - 6 * CELL, W - 2 * CELL])
    expect(spanOf({ kind: 'name', left: 5, width: 100 }, W)).toEqual([5 * CELL, 5 * CELL + 100])
    expect(crossings([{ kind: 'icon', left: 0, width: 3 }, { kind: 'name', left: 3, width: 10 }], W)).toEqual([])
    expect(crossings([{ kind: 'icon', left: 0, width: 3 }, { kind: 'name', left: 2, width: 10 }], W).length).toBe(1)
  })

  test('estado real, as duas visões, larguras de 30 a 112 colunas: nenhum cruzamento nas linhas desenhadas', () => {
    for (const view of ['full', 'summary'] as const) {
      const rows = layout(realModel(view), {}, AT, ME)
      // The real names are short (the fixture's are anonymized to the same length): no name is cut
      // on any width here, as the golden shows (no tooltip layer in the SVG scenarios).
      for (const columns of [30, 40, 60, 80, 100, 112]) {
        const W = lineWidth(columns)
        const crossed = placedOf(rows, W, () => false).flatMap((list, i) => crossings(list, W).map(pair => ({ i, pair })))
        expect(crossed, `${view} ${columns} colunas`).toEqual([])
      }
    }
  })

  test('o ícone e o anel nunca se cruzam, em qualquer profundidade, aninhamento e largura', () => {
    for (const columns of [30, 40, 60, 100, 112]) {
      const W = lineWidth(columns)
      for (let depth = 0; depth < 8; depth++) {
        for (let nested = 0; nested < 4; nested++) {
          const list = overlays({ depth, folds: true, ring: true, hover: false }, nested, W)
          expect(crossings(list, W), `${columns} colunas, profundidade ${depth}, ${nested} cartões`).toEqual([])
        }
      }
    }
  })

  test('o ícone e a camada do nome nunca se cruzam: a camada começa depois do Box do ícone', () => {
    for (const columns of [30, 60, 112]) {
      const W = lineWidth(columns)
      for (let depth = 0; depth < 8; depth++) {
        const list = overlays({ depth, folds: true, ring: false, hover: true }, 0, W)
        expect(crossings(list, W), `${columns} colunas, profundidade ${depth}`).toEqual([])
        const [icon, name] = list.map(p => spanOf(p, W))
        expect(name[0]).toBeGreaterThanOrEqual(icon[1])
      }
    }
  })

  test('sessão com nome cortado e anel: a camada do nome encerra onde o Box do anel começa, em qualquer largura e aninhamento', () => {
    for (const columns of [30, 40, 60, 100, 112]) {
      const W = lineWidth(columns)
      for (let depth = 0; depth < 6; depth++) {
        for (let nested = 0; nested < 4; nested++) {
          const list = overlays({ depth, folds: true, ring: true, hover: true }, nested, W)
          expect(crossings(list, W), `${columns} colunas, profundidade ${depth}, ${nested} cartões`).toEqual([])
          const [, ring, name] = list.map(p => spanOf(p, W))
          // Touching, not crossing: the layer ends on the ring Box's left edge (or at its minimum).
          expect(name[1] <= ring[0] || name[1] - name[0] === NAME_MIN).toBe(true)
          if (name[1] - name[0] > NAME_MIN) expect(name[1]).toBe(ring[0])
        }
      }
    }
    // Without a ring the layer still runs to the right end.
    const W = lineWidth(60)
    expect(spanOf(overlays({ depth: 2, folds: true, ring: false, hover: true }, 1, W)[1], W)[1]).toBe(W)
  })
})
