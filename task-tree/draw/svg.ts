// The desktop's SVG and the terminal's glyphs: what one line of the panel looks like, from its Row
// (../draw/layout) and its frame, and the header. Pure text builders: the render (hooks/render.tsx)
// puts them in the pane's Svg elements and lays the Buttons over them (../draw/geometry says where).

import {
  BAR_GAP, BAR_W, BRANCH_GAP, BRANCH_IN, BRANCH_RADIUS, CARD_EDGE, CARD_IN, CARD_RADIUS, CARD_RIGHT, EDGE_PAD, GUIDE_FROM, HEADER_GAP, HEADER_H, HEADER_PAD,
  PAD, RIGHT_GAP, RING_D, RING_GAP, ROW_H, ROW_H_TOP, SECTION_TEXT_OUT, TEXT_IN, cardRight, col, ringFromRight, textRight,
} from './geometry'
import type { Tone, Row, Frame, Guide, SessionState, GitLabel, MsgState } from './layout'

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
// The word a session's card and the header say when its ultracode switch is on.
export const ULTRA = 'ultracode'
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
// `svg,text{cursor:default}`: the pointer stays
// the arrow over the text, not the text cursor.
// Each line is its own Svg, so each carries the rules it uses and no others: the whole sheet in
// every one came to 1 KB a line, 1.6 MB a drawing on a panel of some 700 lines (the orchestrator's),
// sent again every second, and the app stopped drawing the pane (the person's words: "o tasktree nao
// esta aparecendo na orquestradora").
export const LIGHT: [string, string][] = [
  ['p', 'fill:#2c2c2a'], ['s', 'fill:#5f5e5a'], ['pc', 'color:#2c2c2a'], ['sc', 'color:#5f5e5a'], ['am', 'stroke:#ba7517'], ['amf', 'fill:#ba7517'], ['gr', 'stroke:#639922'],
  ['grf', 'fill:#639922'], ['gy', 'stroke:#888780'], ['gyf', 'fill:#888780'], ['g', 'stroke:#888780;stroke-opacity:.55'],
  ['tr', 'fill:#888780;fill-opacity:.25'], ['ln', 'stroke:#888780;stroke-opacity:.45'], ['lnf', 'fill:#888780;fill-opacity:.45'], ['cd', 'fill:#f9f9f7'], ['cs', 'stroke:#e1e1df'], ['csf', 'fill:#e1e1df'], ['cds', 'stroke:#f9f9f7'],
  ['bl', 'stroke:#378add'], ['rd', 'stroke:#e24b4a'], ['tk', 'stroke:#888780;stroke-opacity:.3'],
  // The header's state band and pills (V4): blue fill, and each tone's fill at 13 %.
  // "ultracode": the app's effortUltra, light (the person: "Roxo sólido (Recomendado)").
  ['ul', 'fill:#8700FF'],
  ['blf', 'fill:#378add'], ['amp', 'fill:#ba7517;fill-opacity:.13'], ['grp', 'fill:#639922;fill-opacity:.13'], ['gyp', 'fill:#888780;fill-opacity:.13'], ['blp', 'fill:#378add;fill-opacity:.13'],
]
export const DARK: [string, string][] = [
  ['p', 'fill:#e8e6dc'], ['s', 'fill:#b4b2a9'], ['pc', 'color:#e8e6dc'], ['sc', 'color:#b4b2a9'], ['am', 'stroke:#ef9f27'], ['amf', 'fill:#ef9f27'], ['gr', 'stroke:#97c459'], ['grf', 'fill:#97c459'],
  ['gy', 'stroke:#9c9a92'], ['gyf', 'fill:#9c9a92'], ['cd', 'fill:#20201f'], ['cs', 'stroke:#373736'], ['csf', 'fill:#373736'], ['cds', 'stroke:#20201f'], ['bl', 'stroke:#85b7eb'], ['rd', 'stroke:#f09595'],
  ['ul', 'fill:#AF87FF'],
  ['blf', 'fill:#85b7eb'], ['amp', 'fill:#ef9f27;fill-opacity:.13'], ['grp', 'fill:#97c459;fill-opacity:.13'], ['gyp', 'fill:#9c9a92;fill-opacity:.13'], ['blp', 'fill:#85b7eb;fill-opacity:.13'],
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

// The Svgs of the lines and the header take the slot's real width (width 100%, no viewBox: the
// person's choice, "largura pelo slot"). Inside, everything is counted in px from W, the estimate of
// geometry's lineWidth; what is counted from W's right end goes in a group moved by the difference
// between the slot and W (toRight), and what stretches between the two takes its width by CSS from
// the slot (`slot`). Both ways: right when the slot is wider than W, left when it is narrower (no
// floor at W: with one, a slot narrower than the estimate cut the right of the drawing, the dev's
// panel at ~427 px). Nothing final depends on W, only what fits.
export const slot = (_W: number) => '100%'
export const toRight = (W: number, inner: string, cls = '') =>
  inner === '' ? '' : `<g${cls ? ` class="${cls}"` : ''} style="transform-box:view-box;transform:translateX(calc(100% - ${W}px))">${inner}</g>`
const svgOpen = (H: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${H}" font-family="${FONT}">${STYLE}`

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
const r1 = (n: number) => Math.round(n * 10) / 10
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
// The repository icon, 14 px across, centered on (x, y): the Git logo's own shape (its proportions
// measured off the official mark) in the pane's colors, no orange (the person's words: "o ícone
// deve ser igual a esse" and "ele deve seguir a identidade visual do painel"). The diamond, a 9.9 px
// square turned 45° with rounded corners, is filled in the icons' dim gray (`gyf`, the ⑂'s family);
// the commit graph inside, the diagonal in from the upper-left edge to the middle node, the trunk
// down to the base node and the branch to the right node, is drawn in the card's own color (`cds`
// stroke, `cd` fill), which cuts it out of the diamond as the logo does. `cls` is not used: the
// classes are the logo's. It was a cat's head for GitHub, then the diamond in strokes.
export function repoIcon(x: number, y: number, _cls: string): string {
  return (
    `<g transform="translate(${x} ${y})">` +
    '<rect class="gyf" x="-4.95" y="-4.95" width="9.9" height="9.9" rx="0.9" transform="rotate(45)"/>' +
    '<path class="cds" d="M-2.2 -5.3L0 -2.8V3M0 -2.8L2.9 0.1" fill="none" stroke-width="1"/>' +
    '<g class="cd"><circle cx="0" cy="-2.8" r="1.05"/><circle cx="0" cy="3" r="1.05"/><circle cx="2.9" cy="0.1" r="1.05"/></g></g>'
  )
}
// The folder icon, 14 px across, centered on (x, y), in the repository icon's style: a folder (a tab
// up on the left and its body, rounded corners) filled in the icons' dim gray (`gyf`), the front
// flap's edge in the card's color (`cds`), as the Git logo's graph. Drawn where the session's folder
// has no repository (the person's words: "o ícone GIT deve ser trocado para uma pasta").
export function folderIcon(x: number, y: number): string {
  return (
    `<g transform="translate(${x} ${y})">` +
    '<path class="gyf" d="M-6 -4.2Q-6 -5.5 -4.8 -5.5H-1.6L-0.3 -4H4.8Q6 -4 6 -2.8V4.3Q6 5.5 4.8 5.5H-4.8Q-6 5.5 -6 4.3Z"/>' +
    '<path class="cds" d="M-6 -1.8H6" fill="none" stroke-width="1"/></g>'
  )
}
// A path cut to `max` px from its start ("…\notas-do-projeto"): its end says the most.
export function fitStart(s: string, size: number, max: number): string {
  if (textW(s, size) <= max) return s
  const room = max - em('…') * size
  let out = ''
  let w = 0
  for (const ch of Array.from(s).reverse()) {
    const next = w + em(ch) * size
    if (next > room) break
    out = ch + out
    w = next
  }
  return '…' + out.trimStart()
}
// The most a folder's path takes on its line before its start is cut.
const FOLDER_MAX = 160
// A session's repository and branch side by side, `size` px text starting at x: the repository icon
// and name (left out with `repo` false: the first to go when the line is short), then the branch
// icon and name, the name cut to what fits in `max` px. A folder with no repository: the folder icon
// and its path, cut from the start, and no branch (left out whole with `repo` false). Returns the
// markup and its width.
export function gitSvg(git: GitLabel, x: number, cy: number, size: number, repo: boolean, max: number): { svg: string; width: number } {
  const ICON = 17
  if (git.folder) {
    if (!repo) return { svg: '', width: 0 }
    const path = fitStart(git.repo, size, Math.max(24, Math.min(FOLDER_MAX, max - ICON)))
    return {
      svg: folderIcon(x + 7, cy) + `<text class="s" x="${x + ICON}" y="${cy + 4}" font-size="${size}" opacity=".75">${xml(path)}</text>`,
      width: ICON + textW(path, size),
    }
  }
  let svg = ''
  let w = 0
  if (repo) {
    svg += repoIcon(x + 7, cy, 'gy') + `<text class="s" x="${x + ICON}" y="${cy + 4}" font-size="${size}" opacity=".75">${xml(git.repo)}</text>`
    w += ICON + textW(git.repo, size) + 10
  }
  const name = fit(git.branch ?? '', size, Math.max(24, max - w - ICON))
  svg += branch(x + w + 7, cy, 'gy') + `<text class="s" x="${x + w + ICON}" y="${cy + 4}" font-size="${size}" opacity=".75">${xml(name)}</text>`
  w += ICON + textW(name, size)
  return { svg, width: w }
}
// The width gitSvg takes with these names whole (a folder's path at most FOLDER_MAX).
export const gitW = (git: GitLabel, size: number, repo: boolean) =>
  git.folder
    ? repo ? 17 + Math.min(FOLDER_MAX, textW(git.repo, size)) : 0
    : (repo ? 17 + textW(git.repo, size) + 10 : 0) + 17 + textW(git.branch ?? '', size)
// The words for a reader that cannot see the drawing (the alt texts).
export const gitAlt = (git: GitLabel) =>
  git.folder ? `pasta ${git.repo}, sem repositório` : `repositório ${git.repo}, branch ${git.branch ?? ''}${git.detached ? ' (detached)' : ''}`
// The same in the terminal: the repository and the branch, or the folder alone.
export const gitTerm = (git: GitLabel) => (git.folder ? `▭ ${git.repo}` : `${git.repo} ⑂ ${git.branch ?? ''}`)

// Every line keeps its progress icon; a session's card, and a task or turn with a session
// below it, add the session's icon beside it. A card's progress: in progress while it runs or waits.
export const PROGRESS: Partial<Record<Tone, Tone>> = { running: 'current', wait: 'current' }
export const progress = (r: Row): Tone => (r.session ? (PROGRESS[r.tone] ?? r.tone) : r.tone)

// The envelope, 14 px across, centered on (x, y), in the stroke class `cls`: a message task's icon in
// every state, its color saying where the message is (MSG_CLASS); the ✉ of a send still queued.
export function envelope(x: number, y: number, cls: string): string {
  return (
    `<g class="${cls}" fill="none" stroke-width="1.4" stroke-linejoin="round"><rect x="${x - 6}" y="${y - 4.5}" width="12" height="9" rx="1.5"/>` +
    `<path d="M${x - 6} ${y - 3.5}L${x} ${y + 1}L${x + 6} ${y - 3.5}"/></g>`
  )
}
// A message task's ✉ by state: blue while queued, green once taken up, gray interrupted; in the
// terminal, the same glyph in the theme's color for each.
export const MSG_CLASS: Record<MsgState, string> = { queued: 'bl', delivered: 'gr', cut: 'gy', lost: 'gy' }
export const MSG_TERM: Record<MsgState, string> = { queued: 'permission', delivered: 'success', cut: 'inactive', lost: 'inactive' }

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
      return envelope(x, y, 'bl')
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
  const { name, tx } = labelName(r, W, r.depth, Math.max(0, cards.length - 1))
  // The session's icon left of the name, where a task's icon is (it folds the card, see foldOver),
  // in the color of the card's state; the state word after the name; the context ring on its own at
  // the card's right end, in the column the lines below end their time in (the person's words: "deve
  // estar solto e na direita da mesma linha").
  const parts: string[] = [sessionIcon('filha', sessionState(r.tone), x, cy)]
  // What is counted from the right end (the ring, the model, the rate): moved to the slot's edge.
  const rightParts: string[] = []
  const at = tx + textW(name, 12) + 10
  if (r.ring) {
    // Drawn at the middle of its Button's Box (ringOver: overlay 'ring', whole cells, the line's
    // whole height), so the highlight has the same room on all four sides (the person's words:
    // "quase, ainda esta desalinhado"): up to half a cell off its column, and on a card's first or
    // last line up to half the card's edge off the name's middle.
    const ring = contextRing(r.ring.percent, W - ringFromRight(Math.max(0, cards.length - 1)), H / 2)
    rightParts.push(r.ring.faded ? `<g opacity=".45">${ring}</g>` : ring)
  }
  // Right of the name (and the state word): the repository and branch, each with its icon (gitSvg;
  // the person's words: "ao lado direito do nome da sessão, qual repositório e qual branch"). At
  // the right end: the model and effort, dim, ending just left of the ring (else at the card's
  // right edge), and left of it the output rate, "n toks/s" ("ao lado esquerdo do modelo rodando"),
  // dimmer when it is the last turn's mean. Short of room, the repository goes first, then the
  // model, then the rate; the branch is cut last, and the name never is (the person's order).
  const left = at + (r.meta ? textW(r.meta, 11) + 8 : 0)
  let end = r.ring ? W - ringFromRight(Math.max(0, cards.length - 1)) - RING_D / 2 - RING_GAP : (cards.length > 0 ? cards[cards.length - 1]!.Rc : W) - 10
  // "ultracode" right of the model, the two one block: short of room they go together ("Junto com
  // o modelo (Recomendado)").
  const ultraW = r.ultracode ? textW(ULTRA, 11) + 6 : 0
  const engW = r.engine || r.ultracode ? (r.engine ? textW(r.engine, 11) + 10 : 4) + ultraW : 0
  const rateW = r.rate ? textW(rateText(r.rate.toks), 11) + 10 : 0
  const room = end - left
  const need = (repo: boolean, eng: boolean, rate: boolean) => (r.git ? gitW(r.git, 11, repo) + 10 : 0) + (eng ? engW : 0) + (rate ? rateW : 0)
  let repo = r.git !== undefined
  let eng = r.engine !== undefined || r.ultracode === true
  let rate = r.rate !== undefined
  if (need(repo, eng, rate) > room) repo = false
  if (need(repo, eng, rate) > room) eng = false
  if (need(repo, eng, rate) > room) rate = false
  if (eng) {
    if (r.ultracode) rightParts.push(`<text class="ul" x="${end}" y="${cy + 4}" font-size="11" text-anchor="end">${ULTRA}</text>`)
    if (r.engine) rightParts.push(`<text class="s" x="${end - ultraW}" y="${cy + 4}" font-size="11" text-anchor="end" opacity=".75">${xml(r.engine)}</text>`)
    end -= engW
  }
  if (rate) {
    rightParts.push(`<text class="s" x="${end}" y="${cy + 4}" font-size="11" text-anchor="end" opacity="${(r.rate as { live: boolean }).live ? '.75' : '.45'}">${rateText((r.rate as { toks: number }).toks)}</text>`)
    end -= rateW
  }
  if (r.git) parts.push(gitSvg(r.git, left, cy, 11, repo, end - left).svg)
  // Waiting on the person: the word in amber (the label has no icon to color).
  if (r.meta) {
    const waiting = r.meta === 'aguardando'
    parts.push(`<text class="${waiting ? 'amf' : 's'}" x="${at}" y="${cy + 4}" font-size="11"${waiting ? '' : ' opacity=".75"'}>${xml(r.meta)}</text>`)
  }
  return slim(
    svgOpen(H) +
    cards.map(c => c.svg).join('') +
    (paths.length > 0 ? `<path class="g" d="${paths.join('')}" fill="none" stroke-width="1"/>` : '') +
    `<text class="s" x="${tx}" y="${cy + 4}" font-size="12" font-weight="600">${xml(name)}</text>` +
    parts.join('') +
    toRight(W, rightParts.join('')) +
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
// Between a title that runs to the time and the time.
export const TIME_GAP = 8
export const COUNT_W = textW('00/00', 12)

export const NO_FRAME: Frame = { cards: [], top: 0, bottom: 0 }
export const rowHeight = (r: Row, f: Frame = NO_FRAME) => (r.depth === 0 && r.tone !== 'wait' ? ROW_H_TOP : ROW_H) + f.top + f.bottom

// One card's slice on a line, from y0 to y1: its fill, then its border (the top edge on its
// first line, the bottom one on its last, the sides on all). In three pieces, as the Svg takes the
// slot's width (see slot): the left one (its corners and side) where it is, the right one moved to
// the slot's edge (toRight, in a group `cr`), and between them the fill and the top and bottom edges
// as rects whose width is the slot's less what the two ends take; each piece runs 1 px into the
// middle, so the joins do not show (the colors are opaque).
export function cardSlice(L: number, R: number, y0: number, y1: number, top: boolean, bottom: boolean, W: number): string {
  const r = CARD_RADIUS
  const a = (x: number, y: number) => `A${r} ${r} 0 0 1 ${x} ${y}`
  const yt = top ? y0 + r : y0
  const yb = bottom ? y1 - r : y1
  const xl = L + r + 1
  const xr = R - r - 1
  const fillL = `M${L} ${yt}` + (top ? `${a(L + r, y0)}H${xl}` : `V${y0}H${xl}`) + `V${y1}` + (bottom ? `H${L + r}${a(L, yb)}` : `H${L}`) + 'Z'
  const edgeL = (bottom ? `M${xl} ${y1}H${L + r}${a(L, yb)}` : `M${L} ${yb}`) + `V${yt}` + (top ? `${a(L + r, y0)}H${xl}` : '')
  const fillR = `M${xr} ${y0}` + (top ? `H${R - r}${a(R, yt)}` : `H${R}`) + `V${yb}` + (bottom ? `${a(R - r, y1)}H${xr}` : `V${y1}H${xr}`) + 'Z'
  const edgeR = (top ? `M${xr} ${y0}H${R - r}${a(R, yt)}` : `M${R} ${y0}`) + `V${yb}` + (bottom ? `${a(R - r, y1)}H${xr}` : '')
  const piece = (fill: string, edge: string) => `<path class="cd" d="${fill}"/><path class="cs" d="${edge}" fill="none" stroke-width="1"/>`
  // The middle, from L + r to R − r moved: the slot's width less L + r and what is right of R − r.
  const mid = `style="width:calc(${slot(W)} - ${L + r + (W - R) + r}px)"`
  const line = (y: number) => `<rect class="csf" x="${L + r}" y="${y - 0.5}" height="1" ${mid}/>`
  return (
    piece(fillL, edgeL) +
    `<rect class="cd" x="${L + r}" y="${y0}" height="${y1 - y0}" ${mid}/>` +
    (top ? line(y0) : '') +
    (bottom ? line(y1) : '') +
    toRight(W, piece(fillR, edgeR), 'cr')
  )
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
    return { L, Rc, svg: cardSlice(L, Rc, y0, y1, c.first, c.last, W) }
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
  const R = (cards.length > 0 ? cards[cards.length - 1]!.Rc : W) - EDGE_PAD
  const section = r.tone === 'section'
  const size = section ? 13 : r.depth === 0 && r.tone !== 'wait' ? 14 : 13
  // A session line returned above: only a task or turn with a session below forks here.
  const forked = r.kids === true
  // Task, turn and card lines are drawn in columns from the right, the same on every one of them,
  // open or closed: the time, the count, the bar and, left of the bar, the branch of a line with a
  // session (a card, or a task or turn with one below it). A word of state ("concluída",
  // "interrompida") goes left of it. The progress icon stays at the left, after the guides, then the
  // title. A line with no count and no branch keeps no empty columns: its title (and its word) runs
  // to the time it draws, or to the edge with none (the person: "quero que o texto vá até alcança o
  // tempo de execução, somente ai, corte o texto com reticencias").
  const tabular = r.bar === true || r.card === true
  let edge = R
  // The room kept between the cut title and what is right of it: 10 px, and none on a line whose
  // title runs to its time (the time's own gap is already there; with the 10 px the "…" stopped at
  // the column of the neighbours' count, the person's words: "corta na coluna com a quantidade de
  // tarefas (4/4, por exemplo)").
  let pad = 10
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
    const toTime = !r.sub && !forked
    edge = toTime ? (t ? R - textW(t, 12) - TIME_GAP : R) : ix - RIGHT_GAP
    if (toTime) pad = 0
    if (r.meta) {
      right.push(`<text class="s" x="${edge}" y="${cy + 4}" font-size="12" text-anchor="end" opacity=".75">${xml(r.meta)}</text>`)
      edge -= textW(r.meta, 12) + 8
    }
  } else {
    const t = typeof r.time === 'number' ? clockText(r.time) : ''
    if (t) right.push(`<text class="s" x="${R}" y="${cy + 4}" font-size="12" text-anchor="end" font-variant-numeric="tabular-nums">${t}</text>`)
    if (t) edge = R - textW(t, 12) - RIGHT_GAP
    const words = rightText(r)
    // Nothing on the right (a ↩ line, the person's words: "essa linha não tem timer"): the title
    // runs to the line's (or card's) right edge, with no room kept.
    if (!t && !words && !section) pad = 0
    if (words) {
      right.push(`<text class="s" x="${edge}" y="${cy + 4}" font-size="12" text-anchor="end" opacity=".75">${xml(words)}</text>`)
      edge -= textW(words, 12)
    }
  }
  // In a group of its own (`ic`).
  const env = r.msg ?? r.recv
  // A section that opens (the requests left out) shows its ▸/▾ where the icon is, which folds and opens it.
  const folding = section && r.fold !== undefined
  const lead = folding
    ? `<text class="s" x="${x}" y="${cy + 4}" font-size="11" text-anchor="middle">${r.fold?.open ? '▾' : '▸'}</text>`
    : section
      ? ''
      : `<g class="ic">${env ? envelope(x, cy, MSG_CLASS[env]) : icon(progress(r), x, cy)}</g>`
  const tx = section && !folding ? x - SECTION_TEXT_OUT : x + TEXT_IN
  // Folded by the person: " ⋯" after the name (the ▸ is gone; the icon itself folds and opens).
  const whole = r.fold && !r.fold.open ? `${r.title} ⋯` : r.title
  const quiet = r.tone === 'done' || r.tone === 'interrupted' || r.tone === 'archived' || r.tone === 'wait' || r.tone === 'reply' || section
  const dim = r.tone === 'interrupted' || r.tone === 'archived' ? ' opacity=".7"' : ''
  // A section's line runs to the slot's edge, less what is right of R; the time, count, bar, bust and
  // words on the right are moved to the slot's edge (toRight). W is only an estimate of the slot
  // (columns × COL_PX), and the slot is often wider: a title cut with "…" against W stopped short of
  // the real edge by the difference (the person, at 686 px: "ainda corta a linha da resposta"). So the
  // title is cut where it really ends: an HTML box (`foreignObject`) as wide as the slot less what is
  // right of the title, with CSS's own "…" (text-overflow). A cut text has no tooltip (the person,
  // 2026-11-09: "não funcionou. aborte e remova a funcionalidade de tooltip").
  const box = `width:calc(100% - ${r1(W - edge + pad + tx)}px)`
  const font = `font:${r.strong ? '600 ' : ''}${size}px ${FONT.replace(/'/g, '&apos;')};line-height:20px`
  const name =
    `<foreignObject x="${tx}" y="${cy - 10}" height="20" style="${box}"${dim}>` +
    `<div xmlns="http://www.w3.org/1999/xhtml" class="${quiet ? 'sc' : 'pc'}" style="${font};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${xml(whole)}</div></foreignObject>`
  return slim(
    svgOpen(H) +
    cards.map(c => c.svg).join('') +
    (paths.length > 0 ? `<path class="g" d="${paths.join('')}" fill="none" stroke-width="1"/>` : '') +
    lead +
    name +
    toRight(W, mark + right.join('')) +
    '</svg>'
  )
}

// The header's chips: only those above zero, in this order.
export type Chip = { tone: Tone; text: string }
export function chips(active: number, waiting: number, cut: number, live: number, sent = 0, pending = 0, agents = 0): Chip[] {
  const list: Chip[] = []
  if (active > 0) list.push({ tone: 'current', text: `${active} em andamento` })
  if (pending > 0) list.push({ tone: 'open', text: plural(pending, 'pendente', 'pendentes') })
  if (waiting > 0) list.push({ tone: 'wait', text: `${waiting} aguardando` })
  if (sent > 0) list.push({ tone: 'sent', text: `${sent} aguardando sessão` })
  if (cut > 0) list.push({ tone: 'interrupted', text: plural(cut, 'interrompida', 'interrompidas') })
  if (live > 0) list.push({ tone: 'running', text: plural(live, 'sessão ativa', 'sessões ativas') })
  // The subagents at work, out of every count of tasks (the person, 2026-11-09: "Fora da contagem").
  if (agents > 0) list.push({ tone: 'agent', text: plural(agents, 'subagente', 'subagentes') })
  return list
}

// The header's general state, the color of its band (the person, 2026-11-03: "gostei da V4, siga para
// análise e implementação"): in progress (amber) while a task of its own runs; waiting (light amber)
// with something left waiting, a notice, or only pending tasks, nothing started yet (the person:
// "Âmbar claro, 'aguardando'"); a session at work (blue) with nothing of its own running; all done
// (green); interrupted (gray) with nothing open and something cut; none (the track's gray) when empty.
export type HeaderState = { tone: Tone; word: string }
export function headerState(s: { active: number; waiting: number; live: number; pending: number; d: number; n: number; x: number }): HeaderState {
  if (s.active > 0) return { tone: 'current', word: 'em andamento' }
  if (s.waiting > 0) return { tone: 'paused', word: 'aguardando' }
  if (s.live > 0) return { tone: 'running', word: 'sessão ativa' }
  if (s.n > 0 && s.d === s.n && s.pending === 0) return { tone: 'done', word: 'concluído' }
  if (s.x > 0 && s.pending === 0) return { tone: 'interrupted', word: 'interrompido' }
  if (s.n + s.x === 0) return { tone: 'open', word: 'nenhuma tarefa' }
  return { tone: 'paused', word: 'aguardando' }
}
const BAND: Partial<Record<Tone, string>> = { current: 'amf', paused: 'amf', running: 'blf', done: 'grf', interrupted: 'gyf', open: 'tr' }
const PILL: Partial<Record<Tone, string>> = { current: 'amp', wait: 'amp', paused: 'amp', open: 'gyp', interrupted: 'gyp', sent: 'blp', running: 'blp', done: 'grp' }

// The header (V4, "Respiro", 125 px, with room under the pills): a card with the state band inside its left border; the title
// alone on the first line (its right end left to the view icons, drawn over it), the repository and
// branch below it, the bar, then the chips as pills; the numbers block at the right, the % large with
// the count and the time (and the output rate) below it.
export function headerSvg(
  title: string,
  d: number,
  n: number,
  list: Chip[],
  W: number,
  time?: number,
  rate?: { toks: number; live: boolean },
  git?: GitLabel,
  state: HeaderState = headerState({ active: 0, waiting: 0, live: 0, pending: 0, d, n, x: 0 }),
  ultracode = false,
): { source: string; height: number } {
  const L = HEADER_PAD + 8
  const R = W - HEADER_PAD
  const empty = n === 0 && list.length === 0
  const H = HEADER_H
  const narrow = W < 600
  // The ultracode word widens the numbers block, so the bar and the pills stop short of it; too
  // narrow, it is left out, like the rate.
  const ultra = ultracode && !narrow
  const block = (narrow ? 76 : 130) + (ultra ? textW(` · ${ULTRA}`, 12) : 0)
  // The card first, under everything: a session's card's fill, border and corners (cardSlice), from
  // CARD_RIGHT in on each side and HEADER_GAP short of the bottom; no dividing line below it (the
  // person: "remova a barra horizontal de divisão").
  const y0 = CARD_RIGHT
  const y1 = H - HEADER_GAP - CARD_RIGHT
  const parts: string[] = [cardSlice(CARD_RIGHT, W - CARD_RIGHT, y0, y1, true, true, W)]
  // The band: 5 px inside the left border, the card's height, following its rounded corners.
  parts.push(
    `<clipPath id="fxc"><rect x="${CARD_RIGHT + 0.5}" y="${y0 + 0.5}" width="${4 * CARD_RADIUS}" height="${y1 - y0 - 1}" rx="${CARD_RADIUS}"/></clipPath>` +
      `<g class="fx fx-${state.tone}" clip-path="url(#fxc)"><rect class="${BAND[state.tone] ?? 'tr'}" x="${CARD_RIGHT}" y="${y0}" width="${CARD_RIGHT + 5}" height="${y1 - y0}"${state.tone === 'paused' ? ' opacity=".5"' : ''}/></g>`,
  )
  if (empty) {
    parts.push(`<text class="p" x="${L}" y="30" font-size="16" font-weight="600">Tarefas</text>`)
    parts.push(`<text class="s" x="${L}" y="52" font-size="12">Nenhuma tarefa planejada.</text>`)
  } else {
    const name = fit(title, 16, Math.max(24, R - L - block))
    parts.push(`<text class="p" x="${L}" y="30" font-size="16" font-weight="600">${xml(name)}</text>`)
    // This session's repository and branch below the title, with their icons (the person: "coloque
    // essas infos também no topo do painel"); short of room, the branch alone, then nothing.
    const room = R - L - block
    if (git) {
      if (gitW(git, 12, true) <= room) parts.push(gitSvg(git, L, 48, 12, true, room).svg)
      else if (!git.folder && gitW(git, 12, false) <= room) parts.push(gitSvg(git, L, 48, 12, false, room).svg)
    }
    // The bar runs from the left to the numbers block (its CSS width follows the slot); the width
    // attribute is in px of W, and its share of the track is the same.
    const span = R - L - block - 20
    const track = `calc(${slot(W)} - ${L + (W - R) + block + 20}px)`
    parts.push(`<rect class="tr" x="${L}" y="66" width="${span}" height="4" rx="2" style="width:${track}"/>`)
    if (n > 0 && d > 0) parts.push(`<rect class="grf bar" x="${L}" y="66" width="${Math.max(4, (span * d) / n)}" height="4" rx="2" style="width:max(4px, calc(${track} * ${d / n}))"/>`)
    // The pills; too narrow for the words, the numbers alone, after their icons.
    const pillW = (text: string) => 30 + textW(text, 12)
    const wide = list.reduce((w, c) => w + pillW(c.text) + 8, -8) <= span
    let cx = L
    for (const chip of list) {
      const c = wide ? chip : { ...chip, text: chip.text.split(' ')[0]! }
      const w = pillW(c.text)
      if (cx + w > L + span) break
      // Each pill in a group named by its tone (`ch-<tone>`), and the bar's filled part (`bar`).
      parts.push(
        `<g class="ch-${c.tone}"><rect class="${PILL[c.tone] ?? 'gyp'}" x="${cx}" y="82" width="${w}" height="22" rx="11"/>` +
          icon(c.tone, cx + 13, 93) +
          `<text class="p" x="${cx + 23}" y="98" font-size="12">${xml(c.text)}</text></g>`,
      )
      cx += w + 8
    }
    // The numbers block, at the right of the slot (toRight).
    const bx = R
    const num = 'text-anchor="end" font-variant-numeric="tabular-nums"'
    const clock = time !== undefined ? clockText(time) : ''
    const rateTail = !narrow && rate ? `<tspan${rate.live ? '' : ' opacity=".45"'}>${clock ? ' · ' : ''}${rateText(rate.toks)}</tspan>` : ''
    // This session's ultracode switch, after the time and the rate (the header draws no model), in
    // the app's color (the person: "Cabeçalho do painel").
    const tail = rateTail + (ultra ? `${clock || rateTail ? ' · ' : ''}<tspan class="ul">${ULTRA}</tspan>` : '')
    parts.push(
      toRight(
        W,
        `<text class="p" x="${bx}" y="54" font-size="${narrow ? 20 : 26}" font-weight="700" ${num}>${percent(d, n)}%</text>` +
          `<text class="s" x="${bx}" y="74" font-size="12" ${num}>${d} de ${n}</text>` +
          (clock || tail ? `<text class="s" x="${bx}" y="92" font-size="12" ${num}>${clock}${tail}</text>` : ''),
      ),
    )
  }
  return {
    source: slim(`${svgOpen(H)}${parts.join('')}</svg>`),
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
  (r.ultracode ? `, ${ULTRA}` : '') +
  (r.rate ? `, ${rateText(r.rate.toks)}${r.rate.live ? '' : ' (último turno)'}` : '') +
  (r.git ? `, ${gitAlt(r.git)}` : '') +
  (r.ring ? `, contexto da sessão ${r.ring.name}: ${r.ring.percent}%` : '') +
  (r.fold && !r.fold.open ? ', recolhida' : '')
// The right-hand words: "3/5", "1/2 · concluída", "interrompida".
export const rightText = (r: Row) => [r.sub ? `${r.sub[0]}/${r.sub[1]}` : '', r.meta ?? ''].filter(Boolean).join(' · ')
