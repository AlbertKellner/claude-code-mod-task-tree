// What both drawings say of a line, and the desktop's icons: the texts (times, rates, the header's
// chips and state, the alt words of a line), the terminal's glyphs and guides, and the markup of the
// few images the desktop keeps (the state icons, the envelope, the bust, the context ring), with
// their sheet of colors (slim). Pure text builders, from a Row of ../draw/layout: hooks/render.tsx
// draws the terminal with them, ../draw/desktop, ../draw/head and ../draw/icons the desktop.

import type { Tone, Row, Guide, SessionState, GitLabel, MsgState } from './layout'

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

// Desktop: each Svg is an image that does not follow the app's theme, so it carries its own colors
// for light and dark: the strokes and fills of the icons, the ring and the header's bar.
// Each icon carries the rules it uses and no others: the whole sheet in every Svg came to 1 KB a
// line, 1.6 MB a drawing on a panel of some 700 lines (the orchestrator's), sent again every second,
// and the app stopped drawing the pane (the person's words: "o tasktree nao esta aparecendo na
// orquestradora").
const LIGHT: [string, string][] = [
  ['am', 'stroke:#ba7517'], ['amf', 'fill:#ba7517'], ['gr', 'stroke:#639922'],
  ['grf', 'fill:#639922'], ['gy', 'stroke:#888780'], ['gyf', 'fill:#888780'],
  ['tr', 'fill:#888780;fill-opacity:.25'],
  ['bl', 'stroke:#378add'], ['rd', 'stroke:#e24b4a'], ['tk', 'stroke:#888780;stroke-opacity:.3'],
]
const DARK: [string, string][] = [
  ['am', 'stroke:#ef9f27'], ['amf', 'fill:#ef9f27'], ['gr', 'stroke:#97c459'], ['grf', 'fill:#97c459'],
  ['gy', 'stroke:#9c9a92'], ['gyf', 'fill:#9c9a92'], ['bl', 'stroke:#85b7eb'], ['rd', 'stroke:#f09595'],
]
export const STYLE = '<style data-slim></style>'
// The sheet of one Svg: its classes' rules, light and dark. The sheet depends on the set of classes
// alone, so it is built once per set (a drawing's icons share a handful of sets) and kept in a Map of
// the module; the string is the same the rules would give again.
const sheets = new Map<string, string>()
const CLASS = /class="([^"]+)"/g
export function slim(svg: string): string {
  // The key is the class attributes in the order they come (icons of one kind share it), read in
  // one pass; the set itself is only built when the sheet is not known yet.
  let classes = ''
  CLASS.lastIndex = 0
  for (let m = CLASS.exec(svg); m !== null; m = CLASS.exec(svg)) classes += m[1] + '|'
  let sheet = sheets.get(classes)
  if (sheet === undefined) {
    const used = new Set(classes.split(/[ |]/))
    const rules = (list: [string, string][]) => list.filter(([c]) => used.has(c)).map(([c, d]) => `.${c}{${d}}`).join('')
    const dark = rules(DARK)
    sheet = `<style>${rules(LIGHT)}${dark ? `@media (prefers-color-scheme: dark){${dark}}` : ''}</style>`
    if (sheets.size > 1000) sheets.clear()
    sheets.set(classes, sheet)
  }
  return svg.replace(STYLE, sheet)
}

// A session's context ring, 14 px across, centered on (x, y): a gray track, an arc from the top,
// clockwise, as long as the share used (blue, amber from 70%, red from 85%); nothing inside.
const ringClass = (p: number) => (p >= 85 ? 'rd' : p >= 70 ? 'am' : 'bl')
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
type SessionKind = 'filha' | 'herdada' | 'cadeia'
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

// The words for a reader that cannot see the drawing (the alt texts).
export const gitAlt = (git: GitLabel) =>
  git.folder ? `pasta ${git.repo}, sem repositório` : `repositório ${git.repo}, branch ${git.branch ?? ''}${git.detached ? ' (detached)' : ''}`
// The same in the terminal: the repository and the branch, or the folder alone.
export const gitTerm = (git: GitLabel) => (git.folder ? `▭ ${git.repo}` : `${git.repo} ⑂ ${git.branch ?? ''}`)

// Every line keeps its progress icon; a session's card, and a task or turn with a session
// below it, add the session's icon beside it. A card's progress: in progress while it runs or waits.
const PROGRESS: Partial<Record<Tone, Tone>> = { running: 'current', wait: 'current' }
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

// The ring's Button's label is an em space, so the native highlight (the label's width plus the
// button's padding) covers the whole ring, not the corner a one-space label made (the person's
// words: "o mouse over do anel de contexto continua pequeno, nao envolvendo o icone todo").
export const RING_LABEL = ' '

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
