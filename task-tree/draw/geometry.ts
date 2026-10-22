// The geometry of the desktop drawing: where things sit on a line, in px inside its Svg, and the
// cells of the Boxes laid over it (the Buttons that fold a line or open a session, the tooltip
// layer). Pure numbers and functions, nothing of the kit: the hooks module imports them.
//
// Two units meet here. Inside an Svg everything is px. A Box over it is placed in whole cells, the
// desktop's column unit, declared 8 px (CELL). The real cell is a little under that: measured
// ≈7.87 px on the person's screen (scale 1.25). So a Box counted in cells from one edge of the line
// drifts from the px it should cover, about 0.13 px per cell: after some 57 cells, 7 px (the ring's
// Box, counted from the left, landed 7 px left of the ring). Hence the one rule every overlay
// follows (see `overlay`): anchor by the nearest edge of the line, so the count is a few cells and
// the drift a fraction of a pixel. The icon and the name sit a few cells in from the left; the ring
// sits a few cells in from the right.

// The desktop's cell, in px, as it declares it (the real one ≈7.87; see above).
export const CELL = 8
// The line's width from the pane's columns: a cell per column, less one, within bounds.
export const MIN_W = 240
export const MAX_W = 900
export const lineWidth = (columns: number) => Math.max(MIN_W, Math.min(MAX_W, columns * CELL - CELL))

// Columns of the tree: the icon of depth k sits at `col(k)`, and the guides run through it. The
// first column is COL_0 px in, each depth COL_STEP px further; +.5 keeps 1 px lines crisp.
export const COL_0 = 12
export const COL_STEP = 20
export const col = (k: number) => COL_0 + k * COL_STEP + 0.5
// A line's title starts TEXT_IN px right of its icon's column (a section's, 6 px left of it).
export const TEXT_IN = 13
export const SECTION_TEXT_OUT = 6
// A card's left edge is CARD_IN px left of its header's column; the branch from a parent ends
// CARD_IN px before a card's column and BRANCH_GAP px before a task's.
export const CARD_IN = 12
export const BRANCH_GAP = 9
// Cards on the right: the outermost ends CARD_RIGHT px before the line's right edge, each nested one
// CARD_NEST px inside the one around it; the text on the right keeps EDGE_PAD px inside the
// innermost card (or the line's edge, with no card).
export const CARD_RIGHT = 2.5
export const CARD_NEST = 6
export const EDGE_PAD = 8
// The right edge of the m-th nested card (0 the outermost), and the right end of the text inside
// `inner` nested cards.
export const cardRight = (W: number, m: number) => W - CARD_RIGHT - CARD_NEST * m
export const textRight = (W: number, inner: number) => cardRight(W, inner) - EDGE_PAD
// The gap between what a line draws on the right (time, count, bar, words) and the next thing left
// of it; the bar's width.
export const RIGHT_GAP = 12
export const BAR_W = 36
// The gap between the bar and the count right of it.
export const BAR_GAP = 8
// A card's corner radius, and the px its edges add above its first line and below its last.
export const CARD_RADIUS = 6
export const PAD = 6
// A card's top edge is drawn CARD_EDGE px above its first line's top (inside PAD), its bottom edge
// CARD_EDGE px below its last line's bottom.
export const CARD_EDGE = 3.5
// A line's height: a level-0 line (not a wait) is taller.
export const ROW_H = 28
export const ROW_H_TOP = 30
// The branch (⑂) of a line with a session below is drawn BRANCH_IN px left of the bar.
export const BRANCH_IN = 12
// The guide below an icon starts GUIDE_FROM px under the line's middle.
export const GUIDE_FROM = 8

// The header: its text and bar start HEADER_PAD px in from each edge; its height by what it shows
// (nothing planned, the count and bar, or those and a line of chips); the view icons at its right
// end take ICONS_W px of the title's line.
export const HEADER_PAD = 8
export const HEADER_H_EMPTY = 44
export const HEADER_H = 66
export const HEADER_H_CHIPS = 88
export const ICONS_W = 72

// The context ring: RING_D px across (radius 5.5, stroke 2), drawn RING_D px inside the innermost
// card's right edge (so its middle is RING_IN px from the line's right end on the outermost card,
// CARD_NEST more per nested card). Its Button's label is an em space, whose native highlight is
// 32 px wide, RING_CELLS cells: the Box is exactly that wide, and the ring is drawn at its middle.
// The model and effort end RING_GAP px left of the ring's edge.
export const RING_D = 15
export const RING_IN = CARD_RIGHT + RING_D
export const RING_CELLS = 4
export const RING_GAP = 8

// The Box a Button is centered in over a glyph whose middle is `cx` px from the line's left: whole
// cells, 3 or 2 of them, whichever puts the Box's middle nearest the glyph (3 cells at an even
// depth, 2 at an odd one: the middle falls on col(depth) to half a pixel). Both the icon's and the
// name layer's Boxes use it, so the highlight keeps the same room around the glyph.
// `half`: half the glyph's width plus the room wanted on each side; a width that leaves less is
// passed over while another leaves enough.
export function overBox(cx: number, widths: number[] = [3, 2], half = 0): { left: number; width: number } {
  const fit = (width: number) => {
    const left = Math.max(0, Math.round((cx - (CELL / 2) * width) / CELL))
    const roomy = CELL * left <= cx - half && CELL * (left + width) >= cx + half
    return { left, width, off: Math.abs(CELL * left + (CELL / 2) * width - cx) + (roomy ? 0 : 1000) }
  }
  const best = widths.map(fit).reduce((a, b) => (b.off < a.off ? b : a))
  return { left: best.left, width: best.width }
}
// The ring's Box, counted from the line's right end (see the rule above): the cells its left edge
// is from the right, and the px from the right end to the ring's middle, the Box's middle.
export const ringRight = (m: number) => Math.max(0, Math.round((RING_IN + CARD_NEST * m) / CELL - RING_CELLS / 2))
export const ringFromRight = (m: number) => CELL * (ringRight(m) + RING_CELLS / 2)

// The Boxes laid over a line, each anchored by the nearest edge (the rule at the top):
// - `icon`: the Button that folds the line, over the icon at col(depth): from the left, in cells.
// - `ring`: the Button that opens the session, over the context ring at the innermost card's
//   right end (`nested` cards inside the outermost): from the right, in cells.
// - `name`: the tooltip layer over a cut name, from the left, in cells, clear of the icon's Box
//   and starting where the name is drawn; its width in px, to the line's right end (`W`).
export type Overlay = { left: number; width: number } | { right: number; width: number }
export function overlay(kind: 'icon' | 'name', depth: number, W?: number): { left: number; width: number }
export function overlay(kind: 'ring', nested: number): { right: number; width: number }
export function overlay(kind: 'icon' | 'ring' | 'name', n: number, W = 0): Overlay {
  if (kind === 'ring') return { right: ringRight(n), width: RING_CELLS }
  const box = overBox(col(n))
  if (kind === 'icon') return box
  const left = Math.max(box.left + box.width, Math.floor((col(n) + TEXT_IN) / CELL))
  return { left, width: Math.max(16, W - left * CELL) }
}

// Every Box laid over one line, in drawing order (the last on top): the icon's Button when the line
// folds, the ring's Button when the line is a session card with a ring (`nested` cards inside the
// outermost), the name layer when the name is cut (`hover`). `left`/`right` and the width of the
// Buttons are in cells; the name layer's width is in px (it is an Svg). One rule for all of them:
// no two Boxes on one line cross (see crossings), so a press lands on the Button it aims at.
export type Placed = { kind: 'icon' | 'ring' | 'name'; left?: number; right?: number; width: number }
export function overlays(line: { depth: number; folds: boolean; ring: boolean; hover: boolean }, nested: number, W: number): Placed[] {
  const out: Placed[] = []
  if (line.folds) out.push({ kind: 'icon', ...overlay('icon', line.depth) })
  if (line.ring) out.push({ kind: 'ring', ...overlay('ring', nested) })
  if (line.hover) out.push({ kind: 'name', ...overlay('name', line.depth, W) })
  return out
}
// The px a Box spans on a line of `W` px, from its left edge: cells become px at CELL each.
export function spanOf(p: Placed, W: number): [number, number] {
  if (p.kind === 'name') return [(p.left ?? 0) * CELL, (p.left ?? 0) * CELL + p.width]
  if (p.right !== undefined) return [W - (p.right + p.width) * CELL, W - p.right * CELL]
  return [(p.left ?? 0) * CELL, ((p.left ?? 0) + p.width) * CELL]
}
// The pairs of Boxes on one line that cross (overlap by more than touching edges).
export function crossings(list: Placed[], W: number): [Placed, Placed][] {
  const out: [Placed, Placed][] = []
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a0, a1] = spanOf(list[i], W)
      const [b0, b1] = spanOf(list[j], W)
      if (a0 < b1 && b0 < a1) out.push([list[i], list[j]])
    }
  }
  return out
}
