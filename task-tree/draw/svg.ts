// The desktop's SVG and the terminal's glyphs: what one line of the panel looks like, from its Row
// (../draw/layout) and its frame, and the header. Pure text builders: the render (hooks/render.tsx)
// puts them in the pane's Svg elements and lays the Buttons over them (../draw/geometry says where).

import {
  BAR_GAP, BAR_W, BRANCH_GAP, BRANCH_IN, BRANCH_RADIUS, CARD_EDGE, CARD_IN, CARD_RADIUS, CARD_RIGHT, EDGE_PAD, GUIDE_FROM, HEADER_GAP, HEADER_H, HEADER_PAD,
  ICONS_W, PAD, RIGHT_GAP, RING_D, RING_GAP, ROW_H, ROW_H_TOP, SECTION_TEXT_OUT, TEXT_IN, cardRight, col, ringFromRight, textRight,
} from './geometry'
import type { Tone, Row, Frame, Guide, SessionState } from './layout'

// "0:04", "6:12", "1:02:09".
export function clockText(ms: number): string {
  const s = Math.floor(ms / 1000)
  const two = (k: number) => String(k).padStart(2, '0')
  return s >= 3600 ? `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` : `${Math.floor(s / 60)}:${two(s % 60)}`
}

// Terminal: glyph and theme color of each tone; the guides as box-drawing text.
export const GLYPH: Record<Tone, [string, string]> = {
  open: ['○', 'inactive'],
  current: ['◉', 'warning'],
  done: ['✓', 'success'],
  interrupted: ['✕', 'inactive'],
  wait: ['◷', 'warning'],
  // A session (the desktop draws a bust): one glyph the terminal has, in the dim color.
  running: ['◍', 'inactive'],
  archived: ['✕', 'inactive'],
  agent: ['▸', 'text'],
  section: ['', 'inactive'],
  // A task waiting for another session to take up a message sent from it (see watchSends).
  sent: ['✉', 'permission'],
  // What a session answered when a turn ended (its card's last line for that turn): not a task.
  reply: ['↩', 'inactive'],
  // A parent open with part of it done and nothing below in progress: waiting to go on.
  paused: ['◷', 'warning'],
}
// Two columns at the left for the ▾/▸ of the level-1 lines; deeper, the ▾/▸ goes after the
// branch, so the guides below a line that has one move two columns right.
// No ▾/▸ column: a level-1 line starts at its icon; deeper, the guides of the ancestors and the
// branch, three columns each.
// Inside a session's card (`hide`, its label's depth) the label's column is left out: the card's
// roots start under the label, with no branch to it, and the label has none to its task (the
// siblings' line passes by).
export const prefix = (r: Row, g: Guide, hide: number[] = []) =>
  r.depth === 0
    ? ''
    : g.bars.map((on, k) => (hide.includes(k) ? '' : on ? '│  ' : '   ')).join('') +
      (hide.includes(r.depth - 1) ? '' : r.session ? (g.last ? '   ' : '│  ') : g.last ? '└─ ' : '├─ ')
export const ratioBar = (d: number, n: number, cells: number) => {
  const k = n > 0 ? Math.round((d / n) * cells) : 0
  return ['█'.repeat(k), '░'.repeat(cells - k)]
}

export const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
// A session's output rate, as the person asked it written: "n toks/s", n whole.
export const rateText = (toks: number) => `${Math.round(toks)} toks/s`
export const percent = (d: number, n: number) => (n > 0 ? Math.round((d / n) * 100) : 0)

// Desktop: each SVG is an image that does not follow the app's theme, so it carries its
// own colors for light and dark. A session's card (`cd`) is filled with the third step of the app's
// surfaces, past the page (`--page`: #151515 dark, #fcfcfb light) and the pane it sits on (`--bg`:
// #1a1a19, #fff): dark, the app's own `--surf`, #20201f; light, where `--surf` is white again, the
// same step taken down from the page, #f9f9f7 (the person's choice: "calcule qual seria a terceira
// cor"). A tone apart from the pane, with the border (`cs`) setting the card off: the app's `--line`
// (white or black at 10%) as it lands on the card's fill, #373736 dark and #e1e1df light, the same
// border the app's text box has (the person's words: "use a mesma cor da borda").
export const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif"
// `svg,text{cursor:default}`: in an interactive Svg (a cut name with its tooltip) the pointer stays
// the arrow over the text, not the text cursor.
// Each line is its own Svg, so each carries the rules it uses and no others: the whole sheet in
// every one came to 1 KB a line, 1.6 MB a drawing on a panel of some 700 lines (the orchestrator's),
// sent again every second, and the app stopped drawing the pane (the person's words: "o tasktree nao
// esta aparecendo na orquestradora").
export const LIGHT: [string, string][] = [
  ['p', 'fill:#2c2c2a'], ['s', 'fill:#5f5e5a'], ['am', 'stroke:#ba7517'], ['amf', 'fill:#ba7517'], ['gr', 'stroke:#639922'],
  ['grf', 'fill:#639922'], ['gy', 'stroke:#888780'], ['gyf', 'fill:#888780'], ['g', 'stroke:#888780;stroke-opacity:.55'],
  ['tr', 'fill:#888780;fill-opacity:.25'], ['ln', 'stroke:#888780;stroke-opacity:.45'], ['cd', 'fill:#f9f9f7'], ['cs', 'stroke:#e1e1df'],
  ['bl', 'stroke:#378add'], ['rd', 'stroke:#e24b4a'], ['tk', 'stroke:#888780;stroke-opacity:.3'],
]
export const DARK: [string, string][] = [
  ['p', 'fill:#e8e6dc'], ['s', 'fill:#b4b2a9'], ['am', 'stroke:#ef9f27'], ['amf', 'fill:#ef9f27'], ['gr', 'stroke:#97c459'], ['grf', 'fill:#97c459'],
  ['gy', 'stroke:#9c9a92'], ['gyf', 'fill:#9c9a92'], ['cd', 'fill:#20201f'], ['cs', 'stroke:#373736'], ['bl', 'stroke:#85b7eb'], ['rd', 'stroke:#f09595'],
]
export const STYLE = '<style data-slim></style>'
// The sheet of one Svg: its classes' rules, light and dark. The sheet depends on the set of classes
// alone, so it is built once per set (a drawing's lines share a handful of sets) and kept in a Map of
// the module; the string is the same the rules would give again.
const sheets = new Map<string, string>()
const CLASS = /class="([^"]+)"/g
export function slim(svg: string): string {
  // The key is the class attributes in the order they come (lines of one kind share it), read in
  // one pass; the set itself is only built when the sheet is not known yet.
  let key = ''
  CLASS.lastIndex = 0
  for (let m = CLASS.exec(svg); m !== null; m = CLASS.exec(svg)) key += m[1] + '|'
  let sheet = sheets.get(key)
  if (sheet === undefined) {
    const used = new Set(key.split(/[ |]/))
    const rules = (list: [string, string][]) => list.filter(([c]) => used.has(c)).map(([c, d]) => `.${c}{${d}}`).join('')
    const dark = rules(DARK)
    sheet = `<style>svg,text{cursor:default;user-select:none}${rules(LIGHT)}${dark ? `@media (prefers-color-scheme: dark){${dark}}` : ''}</style>`
    if (sheets.size > 1000) sheets.clear()
    sheets.set(key, sheet)
  }
  return svg.replace(STYLE, sheet)
}

export const xml = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// SVG text neither wraps nor clips: a rough width of system UI text, in px, to cut titles
// with "…" before they run into what is on the right. Wide scripts and emoji take ~1em.
export const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿가-힣豈-﫿！-｠\u{1f300}-\u{1faff}]/u
const emOf = (ch: string) =>
  WIDE.test(ch) ? 1 : /[\s.,:;'!|il1()[\]ftrj]/.test(ch) ? 0.32 : /[A-ZMWmw@%]/.test(ch) ? 0.7 : 0.56
// The width of each character is fixed: remembered once measured (three regex tests), as the same
// characters come up in every title of every drawing.
const ems = new Map<string, number>()
export const em = (ch: string) => {
  let w = ems.get(ch)
  if (w === undefined) {
    w = emOf(ch)
    ems.set(ch, w)
  }
  return w
}
export const textW = (s: string, size: number) => Array.from(s).reduce((w, ch) => w + em(ch) * size, 0)
// A name cut with … carries the whole one in a `<title>`: the tooltip under the mouse, drawn
// only by an interactive Svg (`hovers`), so the pane need not be widened to read it.
export const tip = (whole: string, shown: string) => (shown === whole ? '' : `<title>${xml(whole)}</title>`)
export const hovers = (source: string) => source.includes('<title>')
// The tooltip goes in a layer of its own over the line: a transparent interactive Svg holding only
// the whole name, whose source does not change with the clock. The line itself stays an image: an
// interactive Svg is a frame, reloaded (drawn blank for an instant) every time its source changes,
// and a line with a running time changes every second.
export function hoverLayer(source: string, w: number, h: number): string {
  const whole = /<title>([^<]*)<\/title>/.exec(source)?.[1] ?? ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    '<style>svg,rect{cursor:default}</style>' +
    `<rect width="${w}" height="${h}" fill="transparent" pointer-events="all"><title>${whole}</title></rect></svg>`
  )
}
export function fit(s: string, size: number, max: number): string {
  if (textW(s, size) <= max) return s
  // Linear in the title: the width of what is kept is accumulated as textW would add it (the same
  // terms in the same order, so the same floating-point sums and the same cut), instead of measuring
  // the whole prefix again for every character.
  const dots = em('…') * size
  let out = ''
  let w = 0
  for (const ch of Array.from(s)) {
    const next = w + em(ch) * size
    if (next + dots > max) break
    out += ch
    w = next
  }
  return out.trimEnd() + '…'
}

// A session's context ring, 14 px across, centered on (x, y): a gray track, an arc from the top,
// clockwise, as long as the share used (blue, amber from 70%, red from 85%); nothing inside.
export const ringClass = (p: number) => (p >= 85 ? 'rd' : p >= 70 ? 'am' : 'bl')
export function contextRing(percent: number, x: number, y: number): string {
  const r = 5.5
  const len = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, percent))
  const arc = (len * p) / 100
  return (
    `<circle class="tk" cx="${x}" cy="${y}" r="${r}" fill="none" stroke-width="2"/>` +
    (arc > 0
      ? `<circle class="${ringClass(p)}" cx="${x}" cy="${y}" r="${r}" fill="none" stroke-width="2" stroke-linecap="round" ` +
        `stroke-dasharray="${arc.toFixed(2)} ${len.toFixed(2)}" transform="rotate(-90 ${x} ${y})"/>`
      : '')
  )
}
export const ringTerm = (p: number) => (p >= 85 ? 'error' : p >= 70 ? 'warning' : 'permission')

// A session's icon, 14 px across, centered on (x, y): a bust (the person's choice, the "Agente"
// family), in the state's color of the tasks (amber at work, green done, gray stopped, and faded
// when archived). `kind`: a session of this one's (`filha`); one handed down (`herdada`), a smaller
// bust behind; a chain (`cadeia`), the bust with an arrow on. Only `filha` is drawn today: the
// others wait for the model to carry the kind.
export type SessionKind = 'filha' | 'herdada' | 'cadeia'
export function sessionIcon(kind: SessionKind, state: SessionState, x: number, y: number): string {
  const cls = state === 'ativa' ? 'am' : state === 'concluida' ? 'gr' : 'gy'
  const bust = (dx: number, dy: number, k = 1) =>
    `<g transform="translate(${dx} ${dy})${k !== 1 ? ` scale(${k})` : ''}"><circle cx="0" cy="-3" r="2.6"/>` +
    '<path d="M-5.5 5.5C-5.5 1.5 -3 .2 0 .2S5.5 1.5 5.5 5.5"/></g>'
  const body =
    kind === 'herdada'
      ? bust(4, -1, 0.55) + bust(-2, 1)
      : kind === 'cadeia'
        ? bust(-2.5, 0) + '<path d="M4 0H7M5.5 -1.6L7.2 0L5.5 1.6"/>'
        : bust(0, 0)
  return (
    `<g class="${cls}" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" ` +
    `transform="translate(${x} ${y})"${state === 'arquivada' ? ' opacity=".4"' : ''}>${body}</g>`
  )
}
// The state of a session's card for its icon, from the card's tone.
export const sessionState = (tone: Tone): SessionState =>
  tone === 'running' || tone === 'wait' ? 'ativa' : tone === 'archived' ? 'arquivada' : tone === 'paused' ? 'parada' : 'concluida'

// The branch icon, 14 px across, centered on (x, y), in the stroke class `cls`: it was the
// session's icon, and now marks the git branch beside a session's name and in the header (gitSvg).
export function branch(x: number, y: number, cls: string): string {
  return (
    `<g class="${cls}" fill="none" stroke-width="1.3"><circle cx="${x - 3}" cy="${y - 5}" r="1.8"/>` +
    `<circle cx="${x - 3}" cy="${y + 5}" r="1.8"/><circle cx="${x + 4}" cy="${y - 3}" r="1.8"/>` +
    `<path d="M${x - 3} ${y - 3.2}V${y + 3.2}M${x + 4} ${y - 1.2}C${x + 4} ${y + 2} ${x - 3} ${y + 1} ${x - 3} ${y + 3.2}"/></g>`
  )
}
// The repository icon, 14 px across, centered on (x, y): a cat's head, the GitHub mark drawn simply
// (the person asked for the GitHub icon; the Octocat itself is GitHub's mark, so only its outline
// is suggested here). `repoIcon` holds the path alone, to swap at the visual check.
export function repoIcon(x: number, y: number, cls: string): string {
  return (
    `<g class="${cls}" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x} ${y})">` +
    '<path d="M-4.4 -2.6C-4.4 -4 -4.6 -5.6 -4.2 -6.2 -3.4 -6 -2.4 -5.2 -1.6 -4.4 -0.5 -4.7 0.5 -4.7 1.6 -4.4 2.4 -5.2 3.4 -6 4.2 -6.2 4.6 -5.6 4.4 -4 4.4 -2.6 5.2 -1.4 5.4 0 5.2 1.4 4.6 4.2 2.4 5.8 0 5.8 -2.4 5.8 -4.6 4.2 -5.2 1.4 -5.4 0 -5.2 -1.4 -4.4 -2.6Z"/>' +
    '<path d="M-1.8 1.2H-1.2M1.2 1.2H1.8"/></g>'
  )
}
// A session's repository and branch side by side, `size` px text starting at x: the repository icon
// and name (left out with `repo` false: the first to go when the line is short), then the branch
// icon and name, the name cut to what fits in `max` px. Returns the markup and its width.
export function gitSvg(git: { repo: string; branch: string }, x: number, cy: number, size: number, repo: boolean, max: number): { svg: string; width: number } {
  const ICON = 17
  let svg = ''
  let w = 0
  if (repo) {
    svg += repoIcon(x + 7, cy, 'gy') + `<text class="s" x="${x + ICON}" y="${cy + 4}" font-size="${size}" opacity=".75">${xml(git.repo)}</text>`
    w += ICON + textW(git.repo, size) + 10
  }
  const name = fit(git.branch, size, Math.max(24, max - w - ICON))
  svg += branch(x + w + 7, cy, 'gy') + `<text class="s" x="${x + w + ICON}" y="${cy + 4}" font-size="${size}" opacity=".75">${xml(name)}</text>`
  w += ICON + textW(name, size)
  return { svg, width: w }
}
// The width gitSvg takes with these names whole.
export const gitW = (git: { repo: string; branch: string }, size: number, repo: boolean) => (repo ? 17 + textW(git.repo, size) + 10 : 0) + 17 + textW(git.branch, size)

// Every line keeps its progress icon; a session's card, and a task or turn with a session
// below it, add the session's icon beside it. A card's progress: in progress while it runs or waits.
export const PROGRESS: Partial<Record<Tone, Tone>> = { running: 'current', wait: 'current' }
export const progress = (r: Row): Tone => (r.session ? (PROGRESS[r.tone] ?? r.tone) : r.tone)

// One icon, 14 px across, centered on (x, y).
export function icon(tone: Tone, x: number, y: number): string {
  switch (tone) {
    case 'current':
      return `<circle class="am" cx="${x}" cy="${y}" r="5.5" fill="none" stroke-width="2"/><circle class="amf" cx="${x}" cy="${y}" r="2.2"/>`
    case 'done':
      return `<path class="gr" d="M${x - 4.5} ${y}l3 3.5l6 -7" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'interrupted':
    case 'archived':
      return `<path class="gy" d="M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7" stroke-width="1.6" stroke-linecap="round"/>`
    case 'wait':
    case 'paused':
      return `<circle class="am" cx="${x}" cy="${y}" r="5.5" fill="none" stroke-width="1.5"/><path class="am" d="M${x} ${y - 3}V${y}H${x + 2.5}" fill="none" stroke-width="1.2" stroke-linecap="round"/>`
    case 'running':
      return sessionIcon('filha', 'ativa', x, y)
    case 'agent':
      return `<path class="gyf" d="M${x - 2.5} ${y - 4}L${x + 3} ${y}L${x - 2.5} ${y + 4}Z"/>`
    case 'sent':
      return (
        `<g class="bl" fill="none" stroke-width="1.4" stroke-linejoin="round"><rect x="${x - 6}" y="${y - 4.5}" width="12" height="9" rx="1.5"/>` +
        `<path d="M${x - 6} ${y - 3.5}L${x} ${y + 1}L${x + 6} ${y - 3.5}"/></g>`
      )
    case 'reply':
      return `<path class="gy" d="M${x + 4.5} ${y - 4}V${y - 1}Q${x + 4.5} ${y + 2.5} ${x + 1} ${y + 2.5}H${x - 4.5}M${x - 1.5} ${y - 0.5}L${x - 4.5} ${y + 2.5}L${x - 1.5} ${y + 5.5}" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'section':
      return ''
    default:
      return `<circle class="gy" cx="${x}" cy="${y}" r="5" fill="none" stroke-width="1.5"/>`
  }
}

// A session's label: its name alone, small and dim, naming the card (no progress icon, bar, count
// or time); beside it the branch, the context ring and its state in a word, as a label's tags.
// Folded by the person: " ⋯" after the name.
// The label's name as drawn: fitted between its start and its tags.
export function labelName(r: Row, W: number, depth: number, inner: number): { name: string; whole: string; tx: number } {
  const R = textRight(W, inner)
  const tx = col(depth) + TEXT_IN
  const whole = r.fold && !r.fold.open ? `${r.title} ⋯` : r.title
  const tags = (r.ring ? 26 : 0) + (r.meta ? textW(r.meta, 11) + 8 : 0)
  return { name: fit(whole, 12, Math.max(24, R - tx - tags)), whole, tx }
}
export function labelSvg(r: Row, f: Frame, W: number, H: number, cy: number, x: number, cards: { L: number; Rc: number; svg: string }[], paths: string[]): string {
  const { name, whole, tx } = labelName(r, W, r.depth, Math.max(0, cards.length - 1))
  // The session's icon left of the name, where a task's icon is (it folds the card, see foldOver),
  // in the color of the card's state; the state word after the name; the context ring on its own at
  // the card's right end, in the column the lines below end their time in (the person's words: "deve
  // estar solto e na direita da mesma linha").
  const parts: string[] = [sessionIcon('filha', sessionState(r.tone), x, cy)]
  const at = tx + textW(name, 12) + 10
  if (r.ring) {
    const R = (cards.length > 0 ? cards[cards.length - 1].Rc : W) - EDGE_PAD
    // Drawn at the middle of its Button's Box (ringOver: overlay 'ring', whole cells, the line's
    // whole height), so the highlight has the same room on all four sides (the person's words:
    // "quase, ainda esta desalinhado"): up to half a cell off its column, and on a card's first or
    // last line up to half the card's edge off the name's middle.
    const ring = contextRing(r.ring.percent, W - ringFromRight(Math.max(0, cards.length - 1)), H / 2)
    parts.push(r.ring.faded ? `<g opacity=".45">${ring}</g>` : ring)
  }
  // Right of the name (and the state word): the repository and branch, each with its icon (gitSvg;
  // the person's words: "ao lado direito do nome da sessão, qual repositório e qual branch"). At
  // the right end: the model and effort, dim, ending just left of the ring (else at the card's
  // right edge), and left of it the output rate, "n toks/s" ("ao lado esquerdo do modelo rodando"),
  // dimmer when it is the last turn's mean. Short of room, the repository goes first, then the
  // model, then the rate; the branch is cut last, and the name never is (the person's order).
  const left = at + (r.meta ? textW(r.meta, 11) + 8 : 0)
  let end = r.ring ? W - ringFromRight(Math.max(0, cards.length - 1)) - RING_D / 2 - RING_GAP : (cards.length > 0 ? cards[cards.length - 1].Rc : W) - 10
  const engW = r.engine ? textW(r.engine, 11) + 10 : 0
  const rateW = r.rate ? textW(rateText(r.rate.toks), 11) + 10 : 0
  const room = end - left
  const need = (repo: boolean, eng: boolean, rate: boolean) => (r.git ? gitW(r.git, 11, repo) + 10 : 0) + (eng ? engW : 0) + (rate ? rateW : 0)
  let repo = r.git !== undefined
  let eng = r.engine !== undefined
  let rate = r.rate !== undefined
  if (need(repo, eng, rate) > room) repo = false
  if (need(repo, eng, rate) > room) eng = false
  if (need(repo, eng, rate) > room) rate = false
  if (eng) {
    parts.push(`<text class="s" x="${end}" y="${cy + 4}" font-size="11" text-anchor="end" opacity=".75">${xml(r.engine as string)}</text>`)
    end -= engW
  }
  if (rate) {
    parts.push(`<text class="s" x="${end}" y="${cy + 4}" font-size="11" text-anchor="end" opacity="${(r.rate as { live: boolean }).live ? '.75' : '.45'}">${rateText((r.rate as { toks: number }).toks)}</text>`)
    end -= rateW
  }
  if (r.git) parts.push(gitSvg(r.git, left, cy, 11, repo, end - left).svg)
  // Waiting on the person: the word in amber (the label has no icon to color).
  if (r.meta) {
    const waiting = r.meta === 'aguardando'
    parts.push(`<text class="${waiting ? 'amf' : 's'}" x="${at}" y="${cy + 4}" font-size="11"${waiting ? '' : ' opacity=".75"'}>${xml(r.meta)}</text>`)
  }
  return slim(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${STYLE}` +
    cards.map(c => c.svg).join('') +
    (paths.length > 0 ? `<path class="g" d="${paths.join('')}" fill="none" stroke-width="1"/>` : '') +
    `<text class="s" x="${tx}" y="${cy + 4}" font-size="12" font-weight="600">${tip(whole, name)}${xml(name)}</text>` +
    parts.join('') +
    '</svg>'
  )
}

// The ring's Button's label is an em space, so the native highlight (the label's width plus the
// button's padding) covers the whole ring, not the corner a one-space label made (the person's
// words: "o mouse over do anel de contexto continua pequeno, nao envolvendo o icone todo"). Where
// the Box goes, in cells, is the geometry module's (overlay 'ring').
export const RING_LABEL = ' '

// The desktop's time column: room for "0:00:00".
export const TIME_W = textW('0:00:00', 12)
export const COUNT_W = textW('00/00', 12)

export const NO_FRAME: Frame = { cards: [], top: 0, bottom: 0 }
export const rowHeight = (r: Row, f: Frame = NO_FRAME) => (r.depth === 0 && r.tone !== 'wait' ? ROW_H_TOP : ROW_H) + f.top + f.bottom

// One card's slice on a line, from y0 to y1: its fill, then its border (the top edge on its
// first line, the bottom one on its last, the sides on all).
export function cardSlice(L: number, R: number, y0: number, y1: number, top: boolean, bottom: boolean): string {
  const r = CARD_RADIUS
  const a = (x: number, y: number) => `A${r} ${r} 0 0 1 ${x} ${y}`
  const yt = top ? y0 + r : y0
  const yb = bottom ? y1 - r : y1
  const fill =
    `M${L} ${yt}` +
    (top ? `${a(L + r, y0)}H${R - r}${a(R, yt)}` : `H${R}`) +
    `V${yb}` +
    (bottom ? `${a(R - r, y1)}H${L + r}${a(L, yb)}` : `H${L}`) +
    'Z'
  const edge =
    `M${L} ${yb}V${yt}` +
    (top ? `${a(L + r, y0)}H${R - r}${a(R, yt)}` : `M${R} ${y0}`) +
    `V${yb}` +
    (bottom ? `${a(R - r, y1)}H${L + r}${a(L, yb)}` : '')
  return `<path class="cd" d="${fill}"/><path class="cs" d="${edge}" fill="none" stroke-width="1"/>`
}

export function rowSvg(r: Row, g: Guide, f: Frame, W: number, hide: number[] = []): string {
  const H = rowHeight(r, f)
  const cy = f.top + rowHeight(r) / 2
  const x = col(r.depth)
  // The cards: each nested one 6 px inside the one around it on the right; the text on the
  // right keeps inside the innermost.
  const ends = f.cards.filter(c => c.last)
  const cards = f.cards.map((c, m) => {
    const L = col(c.depth) - CARD_IN
    const Rc = cardRight(W, m)
    const y0 = c.first ? f.top - CARD_EDGE : 0
    const y1 = c.last ? H - f.bottom + CARD_EDGE + PAD * (ends.length - 1 - ends.indexOf(c)) : H
    return { L, Rc, svg: cardSlice(L, Rc, y0, y1, c.first, c.last) }
  })
  const paths: string[] = g.bars.flatMap((on, k) => (on && !hide.includes(k) ? [`M${col(k)} 0V${H}`] : []))
  // The connector from the parent's guide: down to the line's middle and out to the icon (a └, the
  // last child) or, with siblings below, the guide straight on to the bottom and the branch leaving
  // it (a ├), the corner an arc of BRANCH_RADIUS. A session's label: the branch from its task comes
  // into the card, ending at its left edge at the label's height (the person's words: "conecte ela
  // no painel"); the roots of the card have no branch to the label.
  if (r.depth > 0 && !hide.includes(r.depth - 1)) {
    const px = col(r.depth - 1)
    const xe = r.card ? x - CARD_IN : x - BRANCH_GAP
    const rad = Math.min(BRANCH_RADIUS, xe - px, cy)
    const bend = `M${px} ${cy - rad}A${rad} ${rad} 0 0 0 ${px + rad} ${cy}H${xe}`
    paths.push(g.last ? `M${px} 0V${cy - rad}${bend.slice(bend.indexOf('A'))}` : `M${px} 0V${H}${bend}`)
  }
  if (g.down && !r.session) paths.push(`M${x} ${cy + GUIDE_FROM}V${H}`)
  if (r.session) return labelSvg(r, f, W, H, cy, x, cards, paths)
  const right: string[] = []
  const R = (cards.length > 0 ? cards[cards.length - 1].Rc : W) - EDGE_PAD
  const section = r.tone === 'section'
  const size = section ? 13 : r.depth === 0 && r.tone !== 'wait' ? 14 : 13
  const forked = r.session === true || r.kids === true
  // Task, turn and card lines are drawn in columns from the right, the same on every one of them,
  // open or closed: the time, the count, the bar and, left of the bar, the branch of a line with a
  // session (a card, or a task or turn with one below it), its column kept empty on the others. A
  // word of state ("concluída", "interrompida") goes left of it. The progress icon stays at the
  // left, after the guides, then the title.
  const tabular = r.bar === true || r.card === true
  let edge = R
  let mark = ''
  if (tabular) {
    const clock = `class="s" x="${R}" y="${cy + 4}" font-size="12" text-anchor="end" font-variant-numeric="tabular-nums"`
    const t = typeof r.time === 'number' ? clockText(r.time) : r.time === null ? '—' : ''
    if (t) right.push(`<text ${clock}>${t}</text>`)
    const countX = R - TIME_W - RIGHT_GAP
    if (r.sub) {
      const quiet = r.tone === 'interrupted' || r.tone === 'archived'
      right.push(
        `<text class="s" x="${countX}" y="${cy + 4}" font-size="12" text-anchor="end" font-variant-numeric="tabular-nums"${quiet ? ' opacity=".75"' : ''}>${r.sub[0]}/${r.sub[1]}</text>`,
      )
    }
    const bx = countX - COUNT_W - BAR_GAP - BAR_W
    if (r.sub) {
      const [d, n] = r.sub
      right.push(
        `<rect class="tr" x="${bx}" y="${cy - 2}" width="${BAR_W}" height="4" rx="2"/>`,
        n > 0 && d > 0 ? `<rect class="grf bar" x="${bx}" y="${cy - 2}" width="${Math.max(4, (BAR_W * d) / n)}" height="4" rx="2"/>` : '',
      )
    }
    const ix = bx - BRANCH_IN
    if (forked) mark = sessionIcon('filha', r.kidsState ?? 'parada', ix, cy)
    edge = ix - RIGHT_GAP
    if (r.meta) {
      right.push(`<text class="s" x="${edge}" y="${cy + 4}" font-size="12" text-anchor="end" opacity=".75">${xml(r.meta)}</text>`)
      edge -= textW(r.meta, 12) + 8
    }
  } else {
    const t = typeof r.time === 'number' ? clockText(r.time) : ''
    if (t) right.push(`<text class="s" x="${R}" y="${cy + 4}" font-size="12" text-anchor="end" font-variant-numeric="tabular-nums">${t}</text>`)
    if (t) edge = R - textW(t, 12) - RIGHT_GAP
    const words = rightText(r)
    if (words) {
      right.push(`<text class="s" x="${edge}" y="${cy + 4}" font-size="12" text-anchor="end" opacity=".75">${xml(words)}</text>`)
      edge -= textW(words, 12)
    }
  }
  // In a group of its own (`ic`), what the motion of a change of state animates (../draw/motion).
  const lead = section ? '' : `<g class="ic">${icon(progress(r), x, cy)}</g>`
  const tx = section ? x - SECTION_TEXT_OUT : x + TEXT_IN
  // Folded by the person: " ⋯" after the name (the ▸ is gone; the icon itself folds and opens).
  const whole = r.fold && !r.fold.open ? `${r.title} ⋯` : r.title
  const title = fit(whole, size, Math.max(24, edge - 10 - tx))
  const quiet = r.tone === 'done' || r.tone === 'interrupted' || r.tone === 'archived' || r.tone === 'wait' || r.tone === 'reply' || section
  const look = `class="${quiet ? 's' : 'p'}"${r.strong ? ' font-weight="600"' : ''}${r.tone === 'interrupted' || r.tone === 'archived' ? ' opacity=".7"' : ''}`
  return slim(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${STYLE}` +
    cards.map(c => c.svg).join('') +
    (paths.length > 0 ? `<path class="g" d="${paths.join('')}" fill="none" stroke-width="1"/>` : '') +
    (section ? `<path class="ln" d="M0 0.5H${R}" stroke-width="1"/>` : '') +
    lead +
    `<text ${look} x="${tx}" y="${cy + 4.5}" font-size="${size}">${tip(r.whole ?? whole, title)}${xml(title)}</text>` +
    mark +
    right.join('') +
    '</svg>'
  )
}

// The header's chips: only those above zero, in this order.
export type Chip = { tone: Tone; text: string }
export function chips(active: number, waiting: number, cut: number, live: number, sent = 0, pending = 0): Chip[] {
  const list: Chip[] = []
  if (active > 0) list.push({ tone: 'current', text: `${active} em andamento` })
  if (pending > 0) list.push({ tone: 'open', text: plural(pending, 'pendente', 'pendentes') })
  if (waiting > 0) list.push({ tone: 'wait', text: `${waiting} aguardando` })
  if (sent > 0) list.push({ tone: 'sent', text: `${sent} aguardando sessão` })
  if (cut > 0) list.push({ tone: 'interrupted', text: plural(cut, 'interrompida', 'interrompidas') })
  if (live > 0) list.push({ tone: 'running', text: plural(live, 'sessão ativa', 'sessões ativas') })
  return list
}

// The header: the title alone on the first line (its right end is left to the view icons, drawn
// over it), the count and time below it, the bar, then the chips.
export function headerSvg(title: string, d: number, n: number, list: Chip[], W: number, time?: number, rate?: { toks: number; live: boolean }, git?: { repo: string; branch: string }): { source: string; height: number } {
  const L = HEADER_PAD
  const R = W - HEADER_PAD
  const empty = n === 0 && list.length === 0
  const H = HEADER_H
  // The card first, under everything: a session's card's fill, border and corners (cardSlice), from
  // CARD_RIGHT in on each side and HEADER_GAP short of the bottom; no dividing line below it (the
  // person: "remova a barra horizontal de divisão").
  const parts: string[] = [cardSlice(CARD_RIGHT, W - CARD_RIGHT, CARD_RIGHT, H - HEADER_GAP - CARD_RIGHT, true, true)]
  if (empty) {
    parts.push(`<text class="p" x="${L}" y="22" font-size="14" font-weight="600">Tarefas</text>`)
    parts.push(`<text class="s" x="${L}" y="38" font-size="12">Nenhuma tarefa planejada.</text>`)
  } else {
    const score = `${d} de ${n} · ${percent(d, n)}%` + (time !== undefined ? ` · ${clockText(time)}` : '')
    const name = fit(title, 14, Math.max(40, R - ICONS_W - L))
    parts.push(`<text class="p" x="${L}" y="22" font-size="14" font-weight="600">${tip(title, name)}${xml(name)}</text>`)
    parts.push(`<text class="s" x="${L}" y="40" font-size="12" font-variant-numeric="tabular-nums">${score}</text>`)
    // This session's own output rate after the count, dim when it is the last turn's mean.
    if (rate) parts.push(`<text class="s" x="${L + textW(`${score} `, 12)}" y="40" font-size="12" font-variant-numeric="tabular-nums"${rate.live ? '' : ' opacity=".45"'}>· ${rateText(rate.toks)}</text>`)
    // This session's repository and branch after the count, with their icons (the person: "coloque
    // essas infos também no topo do painel"); short of room, the branch alone, then nothing.
    if (git) {
      const gx = L + textW(`${score} ${rate ? `· ${rateText(rate.toks)} ` : ''}`, 12) + 14
      if (gx + gitW(git, 12, true) <= R) parts.push(gitSvg(git, gx, 36, 12, true, R - gx).svg)
      else if (gx + gitW(git, 12, false) <= R) parts.push(gitSvg(git, gx, 36, 12, false, R - gx).svg)
    }
    parts.push(`<rect class="tr" x="${L}" y="50" width="${R - L}" height="4" rx="2"/>`)
    if (n > 0 && d > 0) parts.push(`<rect class="grf bar" x="${L}" y="50" width="${Math.max(4, ((R - L) * d) / n)}" height="4" rx="2"/>`)
    // Too narrow for the words: the numbers alone, after their icons.
    const wide = list.reduce((w, c) => w + 32 + textW(c.text, 12), -16) <= R - L
    let cx = L
    for (const chip of list) {
      const c = wide ? chip : { ...chip, text: chip.text.split(' ')[0] }
      const w = 16 + textW(c.text, 12)
      if (cx + w > R) break
      // Each chip in a group named by its tone (`ch-<tone>`), and the bars' filled part (`bar`): what
      // the motion of a new chip and of a new count animates (../draw/motion).
      parts.push(
        `<g class="ch-${c.tone}">` +
          (c.tone === 'current' ? `<circle class="amf" cx="${cx + 5}" cy="72" r="4"/>` : icon(c.tone, cx + 5, 72)) +
          `<text class="s" x="${cx + 15}" y="76" font-size="12">${xml(c.text)}</text></g>`,
      )
      cx += w + 16
    }
  }
  return {
    source: slim(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${STYLE}${parts.join('')}</svg>`),
    height: H,
  }
}

export const rowAlt = (r: Row) =>
  (r.label ? `${r.label}: ` : '') +
  r.title +
  (r.hint ? ` (${r.hint})` : '') +
  (r.sub ? `, ${r.sub[0]} de ${r.sub[1]}` : '') +
  (r.meta ? `, ${r.meta}` : '') +
  (typeof r.time === 'number' ? `, ${clockText(r.time)}` : '') +
  (r.kids ? ', com sessão filha' : '') +
  (r.engine ? `, ${r.engine}` : '') +
  (r.rate ? `, ${rateText(r.rate.toks)}${r.rate.live ? '' : ' (último turno)'}` : '') +
  (r.git ? `, repositório ${r.git.repo}, branch ${r.git.branch}${r.git.detached ? ' (detached)' : ''}` : '') +
  (r.ring ? `, contexto da sessão ${r.ring.name}: ${r.ring.percent}%` : '') +
  (r.fold && !r.fold.open ? ', recolhida' : '')
// The right-hand words: "3/5", "1/2 · concluída", "interrompida".
export const rightText = (r: Row) => [r.sub ? `${r.sub[0]}/${r.sub[1]}` : '', r.meta ?? ''].filter(Boolean).join(' · ')
