// The desktop's lines and cards in the app's own elements (Box, Text, Button), with an Svg only where
// a drawing is needed: the state icon, the envelope, the bust of a session, the context ring
// (./icons). The person, 2026-11-13: "migrar todo o Mod para o hibrido de nativo e mantendo somente o
// que for obrigatório em SVG"; the tree's guides in box-drawing characters, as in the terminal; no
// tooltip and no hover; the same keys to press (fold:<key>, open:<sid>).
// No `$` here: the presses come ready from hooks/render.tsx (`acts`), where `$` is.
//
// The contract with the tests' reading of the drawing (tests/kit/leitura.ts): each line is a
// `Box key="r<i>"`, at any depth (inside the `Box key="c<i>"` of a card); its title is a Text whose one
// child is the Row's title, cut by the app (wrap truncate-end); its time and its count are Texts of
// their own, after it; the icon's alt is rowAlt(r) whole; the ring's, "contexto da sessão <nome>: <N>%".
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

// The tree's guides of a line, one cell of three mono characters per column, the bar in the cell's
// middle (under the middle of the parent's icon): the ancestors' bars, then the connector to the line
// (├─ or └─). `col`: the column each cell stands for, so a card can take the cells of its own columns
// and leave the outer ones to the strip at its left (desktopTree). `hide`: a session label's columns
// (labelCols), left out as in the terminal: the card's tasks start under the label's bust. A
// session's label has its connector like any line: it is the branch into its card.
export const cells = (r: Row, g: Guide, hide: number[] = []) => {
  const out: { col: number; text: string }[] = []
  if (r.depth === 0) return out
  g.bars.forEach((on, k) => {
    if (!hide.includes(k)) out.push({ col: k, text: on ? ' │ ' : '   ' })
  })
  if (!hide.includes(r.depth - 1)) out.push({ col: r.depth - 1, text: g.last ? ' └─' : ' ├─' })
  return out
}
// All of a line's guides as one text: a line outside every card (desktopRow's `lead`).
export const leadOf = (r: Row, g: Guide, hide: number[] = []) =>
  cells(r, g, hide)
    .map(c => c.text)
    .join('')

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

// The guides before a line's icon, mono and dim, never cut.
function guidesOf(ui: any, lead: string) {
  const { Box, Text } = ui
  return lead ? (
    <Box flexShrink={0}>
      <Text mono color="inactive" dimColor wrap="truncate-end">
        {lead}
      </Text>
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
function labelRow(ui: any, r: Row, i: number, lead: string, acts: Acts, cols: number) {
  const { Box, Text, Svg, Button } = ui
  const ringed = r.ring !== undefined
  const engLen = r.engine || r.ultracode ? (r.engine ? cap(r.engine) + 1 : 0) + (r.ultracode ? cap(ULTRA) + 1 : 0) : 0
  const rateLen = r.rate ? cap(rateText(r.rate.toks)) + 1 : 0
  // The guides, the bust's cell, the paddings, the name and its ⋯, the word, the ring's cell.
  const room = cols - len(lead) - 3 - 2 - len(r.title) - (folded(r) ? 2 : 0) - (r.meta ? cap(r.meta) + 1 : 0) - (ringed ? 4 : 0)
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
    <Box key={`r${i}`} height={1}>
      {guidesOf(ui, lead)}
      {iconCell(ui, bustIcon(sessionState(r.tone)), rowAlt(r), foldPress(r, acts))}
      <Box flexShrink={1} minWidth={0} paddingLeft={1}>
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
        <Box flexShrink={0} paddingLeft={1}>
          <Text size="caption" color={r.meta === 'aguardando' ? 'warning' : 'inactive'}>
            {r.meta}
          </Text>
        </Box>
      ) : null}
      {git ? (
        <Box flexShrink={100} minWidth={0} paddingLeft={1}>
          <Text size="caption" color="inactive" wrap="truncate-end">
            {git}
          </Text>
        </Box>
      ) : null}
      <Box flexGrow={1} />
      {rate && r.rate ? (
        <Box flexShrink={0} paddingLeft={1}>
          <Text size="caption" color="inactive" tabular dimColor={!r.rate.live || undefined}>
            {rateText(r.rate.toks)}
          </Text>
        </Box>
      ) : null}
      {eng ? (
        <Box flexShrink={0} paddingLeft={1}>
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
// a section, or a session's label. `lead`: the guides drawn before it (leadOf for a line outside every
// card; desktopTree passes the cells of the columns inside the card). `cols`: the columns the line has
// (the pane's, less the strips and the cards around it), for what fits on a session's label.
// Every line one `lh` high, so the guides and the cards' strips line up.
export function desktopRow(ui: any, r: Row, i: number, lead: string, acts: Acts, cols: number): any {
  if (r.session) return labelRow(ui, r, i, lead, acts, cols)
  const { Box, Text, Svg, Button } = ui
  const section = r.tone === 'section'
  const quiet = r.tone === 'done' || r.tone === 'interrupted' || r.tone === 'archived' || r.tone === 'wait' || r.tone === 'reply' || section
  const dim = r.tone === 'interrupted' || r.tone === 'archived'
  const env = r.msg ?? r.recv
  // The icon: none on a section; on a section that opens, its ▸/▾ is the Button that folds it.
  const icon = section ? (
    r.fold ? (
      <Box flexShrink={0} width={3} justifyContent="center">
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
    <Box key={`r${i}`} height={1}>
      {guidesOf(ui, lead)}
      {icon}
      <Box flexGrow={1} flexShrink={1} minWidth={0} paddingLeft={icon ? 1 : 0}>
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
        <Box flexShrink={0} columnGap={1} paddingLeft={1}>
          {shown}
        </Box>
      ) : null}
    </Box>
  )
}

// A card: a session's or subagent's header and every line after it deeper than it (frames in
// ./layout). Its border and fill are the app's (borderStyle round, the first surface).
const CARD = { borderStyle: 'round', paddingX: 1, paddingY: 0, flexDirection: 'column', flexGrow: 1, minWidth: 0, backgroundColor: 'userMessageBackground' }
// What a card takes of its container's columns besides its strip: the two sides of its border and
// padding (2 ch of padding and 2 px of border, counted 3).
const CARD_COLS = 3

// The whole list of lines, the cards nested in Boxes. Inside a container every line starts at its
// content's edge and its guides go three mono characters a column, so they line up with one another
// whatever the border and padding around them. A card takes the cells of its own columns; the cells
// of the columns outside it (the ancestors' bars and its header's connector) go into a strip at its
// left, one text line per line of the card, in a Box in a row with it. Only the strip's first line
// must meet a line (the connector, at the header's height); the rest are bars or blanks.
export function desktopTree(ui: any, lines: Row[], acts: Acts, cols: number): any[] {
  const { Box, Text } = ui
  const lanes = guides(lines)
  const hides = labelCols(lines)
  const cut = (i: number, from: number, to: number) =>
    cells(lines[i]!, lanes[i]!, hides[i])
      .filter(c => c.col >= from && c.col < to)
      .map(c => c.text)
      .join('')
  // The children of a container whose content starts at column `base`, for the lines [a, b), in
  // `room` columns.
  const block = (a: number, b: number, base: number, room: number): any[] => {
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
      const strip = Array.from({ length: j - i }, (_, k) => cut(i + k, base, r.depth))
      const wide = strip.reduce((w, s) => Math.max(w, len(s)), 0)
      const inner = Math.max(10, room - wide - CARD_COLS)
      out.push(
        <Box key={`c${i}`}>
          {wide > 0 ? (
            <Box flexShrink={0}>
              <Text mono color="inactive" dimColor wrap="truncate-end">
                {strip.join('\n')}
              </Text>
            </Box>
          ) : null}
          <Box {...CARD}>
            {desktopRow(ui, r, i, '', acts, inner)}
            {block(i + 1, j, r.depth, inner)}
          </Box>
        </Box>,
      )
      i = j
    }
    return out
  }
  return block(0, lines.length, 0, cols)
}
