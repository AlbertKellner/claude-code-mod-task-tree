// The desktop's lines and cards in the app's own elements (Box, Text, Button), with an Svg only where
// a drawing is needed: the state icon, the envelope, the bust of a session, the context ring
// (./icons). The person, 2026-11-13: "migrar todo o Mod para o hibrido de nativo e mantendo somente o
// que for obrigatório em SVG"; no tooltip and no hover; the same keys to press (fold:<key>, open:<sid>).
// The tree's guides are thin native boxes with a fill, not box-drawing characters: the person,
// 2026-11-13, "Caixas finas nativas (Recomendado)", undoing "Caracteres (Recomendado)" of the same day
// (a glyph is not as tall as the line, so every bar had a gap between one line and the next).
// The terminal keeps the characters (./svg, prefix).
// No `$` here: the presses come ready from hooks/render.tsx (`acts`), where `$` is.
//
// The contract with the tests' reading of the drawing (tests/kit/leitura.ts): each line is a
// `Box key="r<i>"`, at any depth (inside the `Box key="c<i>"` of a card); its title is a Text whose one
// child is the Row's title, cut by the app (wrap truncate-end); its time and its count are Texts of
// their own, after it; the icon's alt is rowAlt(r) whole; the ring's, "contexto da sessão <nome>: <N>%".
// A card is the Box with a borderStyle that is the direct child of a `Box key="c<i>"`; its fill and
// border (backgroundColor, borderColor) are read by the kit, as are the header's (`Box key="head"`).
// A line's guides are the `Box key="guides"`, direct child of its `r<i>`; a card's strip at its left,
// the `Box key="strip"`, direct child of its `c<i>`; one cell per column in them, and every Box with a
// fill inside them is a stroke of a guide.
// A line's height is the `height` of its `r<i>`, its content centered by `alignItems="center"` on the
// boxes inside it (never on the `r<i>`, so the guides still stretch). A card's room above and below is
// its Box's first and last child, empty boxes `PAD_Y` high; its room at the sides, its `paddingX`. In
// a strip, the last cell's connector comes after a piece of bar `PAD_Y` high.
// No element has a hover or display none, no Svg is interactive.

import { guides, labelCols } from './layout'
import type { GitLabel, Guide, Row } from './layout'
import { RING_LABEL, ULTRA, clockText, gitTerm, progress, rateText, rowAlt, sessionState } from './svg'
import { ICON, bustIcon, msgIcon, ringIcon, stateIcon } from './icons'

// The presses of a line, made in hooks/render.tsx: each returns the function its Button calls (the
// render registers it under the Button's key, see act in hooks/panel.ts).
export type Acts = { fold: (r: Row) => () => void; open: (r: Row) => () => void }

// The label of a Button laid over an icon: an em space, so the native highlight covers the icon.
const OVER = ' '

// The guides, as boxes: their color (the guides' gray of the Svg drawing the person validated,
// #888780 at .55, translucent so it shows on the dark pane, the light one and any card's fill), the
// width of a bar in columns (about 1.1 px) and the height of an arm in lines (about 1.2 px).
export const GUIDE_COLOR = 'rgba(136,135,128,0.55)'
export const GUIDE_W = 0.15
export const GUIDE_H = 0.06
// The height of a line: the rows and the connector of a card's strip (at its header's height). 1.4
// lines, about the 28 px of the Svg drawing: the person, 2026-11-13, "aumente um pouco o padding
// interno tambem, os textos estão muito colados, tando dentro do cartao, quanto fora", and for the
// height, "1,4". The room above and below a card's content, in lines (the Svg drawing's 6 px PAD).
const ROW_H = 1.4
const PAD_Y = 0.3

// A cell of the guides: blank, an ancestor's bar, or the connector to the line, a branch (the line
// has a sibling after it) or an end (it is the last).
export type Cell = 'blank' | 'bar' | 'branch' | 'end'
// The tree's guides of a line, one cell per column, the bar in the cell's middle (under the middle of
// the parent's icon): the ancestors' bars, then the connector to the line. `col`: the column each cell
// stands for, so a card can take the cells of its own columns and leave the outer ones to the strip at
// its left (desktopTree). `hide`: a session label's columns (labelCols), left out as in the terminal:
// the card's tasks start under the label's bust. A session's label has its connector like any line:
// it is the branch into its card.
export const cells = (r: Row, g: Guide, hide: number[] = []) => {
  const out: { col: number; kind: Cell }[] = []
  if (r.depth === 0) return out
  g.bars.forEach((on, k) => {
    if (!hide.includes(k)) out.push({ col: k, kind: on ? 'bar' : 'blank' })
  })
  if (!hide.includes(r.depth - 1)) out.push({ col: r.depth - 1, kind: g.last ? 'end' : 'branch' })
  return out
}

// The strokes: a bar (no height: it stretches to its container's height), the arm from the bar's
// right to the cell's right edge, centered on the line's height (the mini bar's arrangement).
const LAYER = { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }
const barBox = (Box: any) => <Box width={GUIDE_W} backgroundColor={GUIDE_COLOR} />
// A connector's three boxes in a row: an empty half, the bar (whole for a branch, down to the middle
// for an end), the arm. No box over another: translucent, an overlap would show as a darker dot.
const joint = (Box: any, kind: Cell, props: Record<string, unknown>) => (
  <Box {...props}>
    <Box flexGrow={1} />
    {kind === 'branch' ? (
      barBox(Box)
    ) : (
      <Box width={GUIDE_W} flexDirection="column">
        <Box flexGrow={1} backgroundColor={GUIDE_COLOR} />
        <Box flexGrow={1} />
      </Box>
    )}
    <Box flexGrow={1} alignItems="center">
      <Box flexGrow={1} height={GUIDE_H} backgroundColor={GUIDE_COLOR} />
    </Box>
  </Box>
)
// The cell of a guide, as wide as the icon's cell by the same mono spacer (three spaces), its strokes
// in a layer over it. With no height of its own, it stretches to its line's height (or to its card's,
// in a strip). `strip`: the last column of a card's strip: a piece of bar as high as the card's room
// above (PAD_Y), its connector one line high at the header, and for a branch the bar going on to the
// card's foot. The piece is shaped as the end's half bar (a fill with no width and no height), so the
// kit still reads an end as an end.
function guideCell(ui: any, kind: Cell, key: string, strip = false) {
  const { Box, Text } = ui
  const strokes =
    kind === 'blank' ? null : kind === 'bar' ? (
      <Box {...LAYER} justifyContent="center">
        {barBox(Box)}
      </Box>
    ) : strip ? (
      <Box {...LAYER} flexDirection="column">
        <Box height={PAD_Y} justifyContent="center">
          <Box width={GUIDE_W} flexDirection="column">
            <Box flexGrow={1} backgroundColor={GUIDE_COLOR} />
          </Box>
        </Box>
        {joint(Box, kind, { height: ROW_H })}
        {kind === 'branch' ? (
          <Box flexGrow={1} justifyContent="center">
            {barBox(Box)}
          </Box>
        ) : null}
      </Box>
    ) : (
      joint(Box, kind, LAYER)
    )
  return (
    <Box key={key} position="relative" flexShrink={0}>
      <Text mono wrap="truncate-end">{'   '}</Text>
      {strokes}
    </Box>
  )
}

// The cell of an icon: as wide as three mono characters (the guides' cell), the Svg centered in it,
// and over it, when the line folds, a Button with an empty label the same size (the Button takes no
// Svg child, and the app draws only its label).
export function iconCell(ui: any, svg: string, alt: string, press?: { key: string; fn: () => void }) {
  const { Box, Text, Svg, Button } = ui
  return (
    <Box position="relative" flexShrink={0}>
      <Text mono wrap="truncate-end">{'   '}</Text>
      <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
        <Svg source={svg} alt={alt} width={ICON} height={ICON} />
      </Box>
      {press ? (
        <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
          <Button key={press.key} label={OVER} plain onPress={press.fn} />
        </Box>
      ) : null}
    </Box>
  )
}

const foldPress = (r: Row, acts: Acts) => (r.fold ? { key: `fold:${r.fold.key}`, fn: acts.fold(r) } : undefined)
const folded = (r: Row) => r.fold !== undefined && !r.fold.open
const len = (s: string) => Array.from(s).length
// A folder's path, cut at its start (the app cuts only at the end): its end says the most.
const FOLDER_MAX = 28
const cutStart = (s: string, max: number) => (len(s) <= max ? s : '…' + Array.from(s).slice(-(max - 1)).join(''))
// A session's place as text, with the terminal's glyphs (gitTerm): "repo ⑂ branch", "⑂ branch" with
// the repository left out, "▭ folder" (left out whole with the repository).
const gitText = (g: GitLabel, repo: boolean) => (g.folder ? (repo ? `▭ ${cutStart(g.repo, FOLDER_MAX)}` : '') : repo ? gitTerm(g) : `⑂ ${g.branch ?? ''}`)

// The guides before a line's icon, one cell per column, never cut.
function guidesOf(ui: any, cs: Cell[]) {
  const { Box } = ui
  return cs.length > 0 ? (
    <Box key="guides" flexShrink={0}>
      {cs.map((k, n) => guideCell(ui, k, `g${n}`))}
    </Box>
  ) : null
}

// A session's label, the first line of its card: the bust (the Button that folds the card), the
// name, its state word, the repository and branch; at the right end the output rate, the model and
// effort (with "ultracode"), and the context ring, the Button that opens the session. What does not
// fit goes first the repository, then the model with ultracode, then the rate (the person's order);
// counted in characters against the card's columns, a caption's character as 0.8 of a column (the
// caption size is smaller than the body's: counted whole, the repository and the model went at 60
// columns with room left for them); the branch and then the name are cut by the app.
const CAPTION = 0.8
const cap = (s: string) => len(s) * CAPTION
function labelRow(ui: any, r: Row, i: number, lead: Cell[], acts: Acts, cols: number) {
  const { Box, Text, Svg, Button } = ui
  const ringed = r.ring !== undefined
  const engLen = r.engine || r.ultracode ? (r.engine ? cap(r.engine) + 1 : 0) + (r.ultracode ? cap(ULTRA) + 1 : 0) : 0
  const rateLen = r.rate ? cap(rateText(r.rate.toks)) + 1 : 0
  // The guides, the bust's cell, the paddings, the name and its ⋯, the word, the ring's cell.
  const room = cols - 3 * lead.length - 3 - 2 - len(r.title) - (folded(r) ? 2 : 0) - (r.meta ? cap(r.meta) + 1 : 0) - (ringed ? 4 : 0)
  const need = (repo: boolean, eng: boolean, rate: boolean) => (r.git ? cap(gitText(r.git, repo)) + 1 : 0) + (eng ? engLen : 0) + (rate ? rateLen : 0)
  let repo = r.git !== undefined
  let eng = engLen > 0
  let rate = r.rate !== undefined
  if (need(repo, eng, rate) > room) repo = false
  if (need(repo, eng, rate) > room) eng = false
  if (need(repo, eng, rate) > room) rate = false
  const git = r.git ? gitText(r.git, repo) : ''
  const ring = r.ring
  return (
    <Box key={`r${i}`} height={ROW_H}>
      {guidesOf(ui, lead)}
      {iconCell(ui, bustIcon(sessionState(r.tone)), rowAlt(r), foldPress(r, acts))}
      <Box flexShrink={1} minWidth={0} paddingLeft={1} alignItems="center">
        <Text size="footnote" weight="semibold" color="inactive" wrap="truncate-end">
          {r.title}
        </Text>
        {folded(r) ? (
          <Box flexShrink={0}>
            <Text color="inactive" wrap="truncate-end">
              {' ⋯'}
            </Text>
          </Box>
        ) : null}
      </Box>
      {r.meta ? (
        <Box flexShrink={0} paddingLeft={1} alignItems="center">
          <Text size="caption" color={r.meta === 'aguardando' ? 'warning' : 'inactive'}>
            {r.meta}
          </Text>
        </Box>
      ) : null}
      {git ? (
        <Box flexShrink={100} minWidth={0} paddingLeft={1} alignItems="center">
          <Text size="caption" color="inactive" wrap="truncate-end">
            {git}
          </Text>
        </Box>
      ) : null}
      <Box flexGrow={1} />
      {rate && r.rate ? (
        <Box flexShrink={0} paddingLeft={1} alignItems="center">
          <Text size="caption" color="inactive" tabular dimColor={!r.rate.live || undefined}>
            {rateText(r.rate.toks)}
          </Text>
        </Box>
      ) : null}
      {eng ? (
        <Box flexShrink={0} paddingLeft={1} alignItems="center">
          {r.engine ? (
            <Text size="caption" color="inactive">
              {r.engine}
            </Text>
          ) : null}
          {r.ultracode ? (
            <Text size="caption" color="effortUltra" wrap="truncate-end">
              {r.engine ? ` ${ULTRA}` : ULTRA}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {ring ? (
        <Box position="relative" flexShrink={0} paddingX={1} alignItems="center">
          <Svg source={ringIcon(ring.percent, ring.faded === true)} alt={`contexto da sessão ${ring.name}: ${ring.percent}%`} width={ICON} height={ICON} />
          {r.session && r.sid ? (
            <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
              <Button key={`open:${r.sid}`} label={RING_LABEL} plain onPress={acts.open(r)} />
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  )
}

// One line of the desktop: a task, a request, a notice, a ↩, a ✉, a subagent's tool, a card's header,
// a section, or a session's label. `lead`: the cells of the guides drawn before it (desktopTree passes
// the cells of the columns inside the line's container). `cols`: the columns the line has
// (the pane's, less the strips and the cards around it), for what fits on a session's label.
// Every line ROW_H high, with no gap between lines: the guides' boxes stretch to it and meet. Taller
// than its text (1.4, the person's "1,4"), so what it shows is centered on its height by the boxes in
// it (alignItems), the guides' arm in the middle meeting the icon; not on the `r<i>` itself, which
// would stop the guides from stretching.
export function desktopRow(ui: any, r: Row, i: number, lead: Cell[], acts: Acts, cols: number): any {
  if (r.session) return labelRow(ui, r, i, lead, acts, cols)
  const { Box, Text, Svg, Button } = ui
  const section = r.tone === 'section'
  const quiet = r.tone === 'done' || r.tone === 'interrupted' || r.tone === 'archived' || r.tone === 'wait' || r.tone === 'reply' || section
  const dim = r.tone === 'interrupted' || r.tone === 'archived'
  const env = r.msg ?? r.recv
  // The icon: none on a section; on a section that opens, its ▸/▾ is the Button that folds it.
  const icon = section ? (
    r.fold ? (
      <Box flexShrink={0} width={3} justifyContent="center" alignItems="center">
        <Button key={`fold:${r.fold.key}`} label={r.fold.open ? '▾' : '▸'} plain dimColor onPress={acts.fold(r)} />
      </Box>
    ) : null
  ) : (
    iconCell(ui, env ? msgIcon(env) : stateIcon(progress(r)), rowAlt(r), foldPress(r, acts))
  )
  // On the right, as the Svg had it: a task, turn or card line (`tabular`) in columns from the right,
  // the same on every one of them (the word, the bust of a line with a session below, the bar, the
  // count, the time), empty cells kept; one with no count and no bust keeps no empty columns, its title
  // runs to its time. Any other line: its count and word, then its time.
  const tabular = r.bar === true || r.card === true
  const t = typeof r.time === 'number' ? clockText(r.time) : tabular && r.time === null ? '—' : ''
  const forked = r.kids === true
  const columns = tabular && (r.sub !== undefined || forked)
  const small = { size: 'footnote', color: 'inactive', tabular: true }
  const time = (width?: number) =>
    width !== undefined ? (
      <Box key="time" flexShrink={0} width={width} justifyContent="flex-end">
        {t ? <Text {...small}>{t}</Text> : null}
      </Box>
    ) : t ? (
      <Box key="time" flexShrink={0}>
        <Text {...small}>{t}</Text>
      </Box>
    ) : null
  const word = r.meta ? (
    <Box key="meta" flexShrink={0}>
      <Text size="footnote" color="inactive">
        {r.meta}
      </Text>
    </Box>
  ) : null
  const right: any[] = []
  if (columns) {
    const sub = r.sub
    right.push(
      word,
      <Box key="bust" flexShrink={0} width={3} justifyContent="center" alignItems="center">
        {forked ? <Svg source={bustIcon(r.kidsState ?? 'parada')} alt="com sessão filha" width={ICON} height={ICON} /> : null}
      </Box>,
      <Box key="bar" flexShrink={0} width={5} alignItems="center">
        {sub ? (
          <Box flexGrow={1} height={0.2} backgroundColor="rgba(136,135,128,0.25)">
            {sub[1] > 0 && sub[0] > 0 ? <Box width={`${Math.max(11, Math.round((sub[0] / sub[1]) * 100))}%`} backgroundColor="success" /> : null}
          </Box>
        ) : null}
      </Box>,
      <Box key="count" flexShrink={0} width={5} justifyContent="flex-end">
        {sub ? (
          <Text {...small} dimColor={dim || undefined}>
            {`${sub[0]}/${sub[1]}`}
          </Text>
        ) : null}
      </Box>,
      time(7),
    )
  } else if (tabular) {
    right.push(word, time())
  } else {
    if (r.sub) {
      right.push(
        <Box key="count" flexShrink={0}>
          <Text {...small}>{`${r.sub[0]}/${r.sub[1]}`}</Text>
        </Box>,
      )
    }
    if (r.meta) {
      right.push(
        <Box key="meta" flexShrink={0}>
          <Text size="footnote" color="inactive" wrap="truncate-end">
            {r.sub ? `· ${r.meta}` : r.meta}
          </Text>
        </Box>,
      )
    }
    if (typeof r.time === 'number') right.push(time())
  }
  const shown = right.filter(x => x !== null)
  return (
    <Box key={`r${i}`} height={ROW_H}>
      {guidesOf(ui, lead)}
      {icon}
      <Box flexGrow={1} flexShrink={1} minWidth={0} paddingLeft={icon ? 1 : 0} alignItems="center">
        <Text wrap="truncate-end" color={quiet ? 'inactive' : undefined} dimColor={dim || undefined} weight={r.strong ? 'semibold' : undefined}>
          {r.title}
        </Text>
        {folded(r) ? (
          <Box flexShrink={0}>
            <Text color="inactive" wrap="truncate-end">
              {' ⋯'}
            </Text>
          </Box>
        ) : null}
      </Box>
      {shown.length > 0 ? (
        <Box flexShrink={0} columnGap={1} paddingLeft={1} alignItems="center">
          {shown}
        </Box>
      ) : null}
    </Box>
  )
}

// A card: a session's or subagent's header and every line after it deeper than it. Its fill and
// border are raw translucent grays (the neutral of the Svgs, #888780): the theme key the terminal
// uses for it (userMessageBackground) has no counterpart in the desktop, which drew the card with the
// pane's own fill and its default border (#222222 on #191919). The person, 2026-11-13: "nao aparece
// nenhum card". Translucent, the same values lighten the dark pane and darken the light one without
// the mod knowing the theme. A card inside a card lays its fill over the outer one's, so each level
// has its own alpha: the person, 2026-11-13, "aumente um pouco o contraste do card, deixando ele um
// pouco mais claro, e repita isso para cada card dentro de card". The fill of level k is a/(1-k*a),
// a = 0.10, so every card goes the same 10 % of what is left from the pane to the gray, whatever the
// pane; the border, b/(1-(k+1)*a), b = 0.22, 22 % of that same distance past its own card's fill.
// Rounded to 3 places, as a table (the color's text stays stable); level 4 on repeats level 4. Level 0
// on the dark pane (#191919): fill #242423, border #3c3c3a; level 1, #2f2f2e and #484744; on the light
// one (#ffffff): #f3f3f2, #d9d9d6; level 1, #e7e7e6 and #cdcdca. The header (./head) takes level 0's.
const LEVELS: [string, string][] = [
  ['0.1', '0.244'],
  ['0.111', '0.275'],
  ['0.125', '0.314'],
  ['0.143', '0.367'],
  ['0.167', '0.44'],
]
const gray = (a: string) => `rgba(136,135,128,${a})`
export const CARD_FILL = gray(LEVELS[0]![0])
export const CARD_BORDER = gray(LEVELS[0]![1])
// A card's props at a level (how many cards are around it). Its room at the sides is its paddingX
// (the person, 2026-11-13: "nos 4 lados"); above and below, the empty PAD_Y boxes desktopTree puts in.
const card = (level: number) => {
  const [fill, border] = LEVELS[Math.min(level, LEVELS.length - 1)]!
  return { borderStyle: 'round', borderColor: gray(border), paddingX: 2, paddingY: 0, flexDirection: 'column', flexGrow: 1, minWidth: 0, backgroundColor: gray(fill) }
}
// What a card takes of its container's columns besides its strip: the two sides of its border and
// padding (4 ch of padding and 2 px of border, counted 5).
const CARD_COLS = 5

// The whole list of lines, the cards nested in Boxes. Inside a container every line starts at its
// content's edge and its guides go one cell (three mono spaces wide) a column, so they line up with one
// another whatever the border and padding around them. A card takes the cells of its own columns; the
// cells of the columns outside it (the ancestors' bars and its header's connector) go into a strip at
// its left, one cell per column, in a row with it, stretched to the card's height. The strip is the
// same on every line of the card, so it is taken from the header's: the ancestors' bars run from the
// card's top to its foot, and the connector meets the header (the branch's bar goes on to the foot).
export function desktopTree(ui: any, lines: Row[], acts: Acts, cols: number): any[] {
  const { Box } = ui
  const lanes = guides(lines)
  const hides = labelCols(lines)
  const cut = (i: number, from: number, to: number) =>
    cells(lines[i]!, lanes[i]!, hides[i])
      .filter(c => c.col >= from && c.col < to)
      .map(c => c.kind)
  // The children of a container whose content starts at column `base`, for the lines [a, b), in
  // `room` columns.
  // `level`: how many cards are around them.
  const block = (a: number, b: number, base: number, room: number, level: number): any[] => {
    const out: any[] = []
    for (let i = a; i < b; ) {
      const r = lines[i]!
      if (!r.card) {
        out.push(desktopRow(ui, r, i, cut(i, base, Infinity), acts, room))
        i++
        continue
      }
      let j = i + 1
      while (j < b && lines[j]!.depth > r.depth) j++
      const strip = cut(i, base, r.depth)
      const wide = 3 * strip.length
      const inner = Math.max(10, room - wide - CARD_COLS)
      out.push(
        <Box key={`c${i}`}>
          {wide > 0 ? (
            <Box key="strip" flexShrink={0}>
              {strip.map((k, n) => guideCell(ui, k, `g${n}`, n === strip.length - 1))}
            </Box>
          ) : null}
          <Box {...card(level)}>
            <Box height={PAD_Y} flexShrink={0} />
            {desktopRow(ui, r, i, [], acts, inner)}
            {block(i + 1, j, r.depth, inner, level + 1)}
            <Box height={PAD_Y} flexShrink={0} />
          </Box>
        </Box>,
      )
      i = j
    }
    return out
  }
  return block(0, lines.length, 0, cols, 0)
}
