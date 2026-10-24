// The pane's motion: what changed since the drawing before, and how it is drawn on its way. The
// desktop draws each Svg as an image and makes it again when it likes (about once a second, and at
// every drawing of the mod), and each time an animation inside starts over from its first frame:
// nothing in a drawing can rely on the Svg's own clock. So the mod draws the frames itself: while a
// change is within DUR ms, the pane is drawn again every FRAME ms (nextFrame in the hooks), each
// drawing with the state of that moment, eased and static, plus a FRAME-long CSS piece on to the
// next frame's state, so the step between frames is smooth; an Svg made again on the way loses at
// most that piece. Nothing animates on a module's first drawing, on a drawing where most keys are new
// (a change of view, a reload), on a key the drawing before did not show, nor with reduced motion.
// Disappearing is not animated (the line leaves the drawing at once).

// How long a change moves, in ms, and how long each frame is (the kit draws at most 10 a second).
export const DUR = 300
export const FRAME = 100
// How long a key not drawn (the other view's lines) is kept: coming back to it is no entrance.
const KEEP = 10000

// What a key looked like when last drawn: its state (a tone, a count), when it last came in or
// changed and which of the two it was, and when it was last drawn.
type Seen = { state: string; at: number; kind: 'enter' | 'changed' | 'none'; before?: string; drawn: number }
const seen = new Map<string, Seen>()
let primed = false
let lastDrawn = -Infinity

// Each key drawn now, with its state: `enter` the ones not drawn before, `changed` the ones whose
// state differs (`before`: the state it had), both until DUR after it happened; `ago`: how long ago.
export type Marks = { enter: Set<string>; changed: Set<string>; before: Map<string, string>; ago: Map<string, number> }
export function mark(drawnNow: [string, string][], now: number | undefined): Marks {
  const marks: Marks = { enter: new Set(), changed: new Set(), before: new Map(), ago: new Map() }
  if (now === undefined) return marks
  // More than half the keys new: a change of view or a reload, not lines coming in.
  const fresh = drawnNow.filter(([k]) => !seen.has(k)).length
  const entering = primed && fresh * 2 <= drawnNow.length
  for (const [key, state] of drawnNow) {
    let was = seen.get(key)
    if (was === undefined) {
      was = { state, at: now, kind: entering ? 'enter' : 'none', drawn: now }
      seen.set(key, was)
    } else if (was.state !== state) {
      // A change while the key was out of sight (the other view) is no motion either.
      const shown = was.drawn >= lastDrawn
      was = { state, at: now, kind: shown ? 'changed' : 'none', before: shown ? was.state : undefined, drawn: now }
      seen.set(key, was)
    } else was.drawn = now
    if (was.kind !== 'none' && now - was.at < DUR) {
      marks[was.kind].add(key)
      marks.ago.set(key, now - was.at)
      if (was.before !== undefined) marks.before.set(key, was.before)
    }
  }
  for (const [key, w] of seen) if (now - w.drawn > KEEP) seen.delete(key)
  primed = true
  lastDrawn = now
  return marks
}

// An Svg with these rules (the moving classes' values for this frame and their keyframes) in a sheet
// of its own, the whole drawing in a group `mv` (the root svg is not transformed in an image). No
// rule, the source as is.
const REDUCE = '@media (prefers-reduced-motion: reduce){*{animation:none!important}}'
export function animate(source: string, rules: string[]): string {
  if (rules.length === 0) return source
  const open = source.indexOf('>') + 1
  const end = source.lastIndexOf('</svg>')
  return `${source.slice(0, open)}<style>${rules.join('')}${REDUCE}</style><g class="mv">${source.slice(open, end)}</g></svg>`
}

// Where a change is `ago` ms in: its progress now and at the next frame, eased out (0..1).
const ease = (x: number) => 1 - (1 - x) * (1 - x)
const phase = (ago: number): [number, number] => [ease(Math.min(1, ago / DUR)), ease(Math.min(1, (ago + FRAME) / DUR))]
const lerp = (a: number, b: number, p: number) => (a + (b - a) * p).toFixed(3)
// A rule: `sel` is drawn as `from` (this frame's values, static) and moves to `to` over the frame;
// `fixed` are its other declarations.
const piece = (name: string, sel: string, from: string, to: string, fixed = '') =>
  `@keyframes ${name}{from{${from}}to{${to}}}${sel}{${from};${fixed}animation:${name} ${FRAME}ms linear both}`

// A line coming in: fades in and slides 3 px down. Nothing starts unseen (from 60%, 85%, a half-drawn
// ✓): an Svg made again on the way shows a state near the one before, not a blank.
export const fadeIn = (ago: number) => {
  const [p, q] = phase(ago)
  const at = (k: number) => `opacity:${lerp(0.6, 1, k)};transform:translateY(${lerp(-3, 0, k)}px)`
  return piece('in', '.mv', at(p), at(q))
}

// An icon whose state changed: it grows from 85% (the drawing's `ic` group), and a ✓ draws the rest
// of its stroke.
export const pop = (done: boolean, ago: number) => {
  const [p, q] = phase(ago)
  const size = (k: number) => `transform:scale(${lerp(0.85, 1, k)})`
  const dash = (k: number) => `stroke-dashoffset:${lerp(8, 0, k)}`
  return (
    piece('pop', '.ic', size(p), size(q), 'transform-box:fill-box;transform-origin:center;') +
    (done ? piece('draw', '.ic .gr', dash(p), dash(q), 'stroke-dasharray:16;') : '')
  )
}

// A chip new in the header fades in; a bar whose count went up grows from its old width to the new.
export const chipIn = (tone: string, ago: number) => {
  const [p, q] = phase(ago)
  return piece('ci', `.ch-${tone}`, `opacity:${lerp(0.6, 1, p)}`, `opacity:${lerp(0.6, 1, q)}`)
}
// The bar goes on from where it was (`before`, its width before, as a share of the new one): only
// forward; shorter (more tasks planned), it is drawn as it is.
export const growFrom = (before: string | undefined, now: string, ago: number): string[] => {
  const was = Number(before || 0)
  const to = Number(now)
  if (!(to > was)) return []
  const [p, q] = phase(ago)
  const at = (k: number) => `transform:scaleX(${lerp(was / to, 1, k)})`
  return [piece('grow', '.bar', at(p), at(q), 'transform-box:fill-box;transform-origin:left;')]
}
// What the motion reads off a drawing: its chips' tones and its bar's width (none without a bar).
export const chipTones = (source: string) => [...source.matchAll(/class="ch-([a-z]+)"/g)].map(m => m[1])
export const barOf = (source: string) => /class="grf bar"[^>]*?width="([^"]+)"/.exec(source)?.[1] ?? ''
