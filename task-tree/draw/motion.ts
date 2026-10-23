// The pane's motion: what changed since the drawing before, and the CSS that animates it. The
// desktop draws each Svg as an image, which runs CSS animations; a Svg is made again whenever its
// source changes (a clock line every second), so an animation is written only into the drawings
// within DUR ms of the change, and it ends in the final state: past DUR the line is drawn plain, with
// no jump. Nothing animates on a module's first drawing (after a reload all would be new), nor with
// reduced motion. Disappearing is not animated (the line leaves the drawing at once).

// How long a change keeps its animation in the drawings, in ms (the animations last less).
export const DUR = 400

// What a key looked like when last drawn: its state (a tone, a count), when it last came in or
// changed, and which of the two it was.
type Seen = { state: string; at: number; kind: 'enter' | 'changed' | 'none'; before?: string }
const seen = new Map<string, Seen>()
let primed = false

// Each key drawn now, with its state: `enter` the ones not drawn before, `changed` the ones whose
// state differs (`before`: the state it had), both until DUR after it happened. Keys not drawn now
// are forgotten.
export type Marks = { enter: Set<string>; changed: Set<string>; before: Map<string, string> }
export function mark(drawnNow: [string, string][], now: number | undefined): Marks {
  const marks: Marks = { enter: new Set(), changed: new Set(), before: new Map() }
  if (now === undefined) return marks
  const keep = new Set<string>()
  for (const [key, state] of drawnNow) {
    keep.add(key)
    let was = seen.get(key)
    if (was === undefined) {
      was = { state, at: now, kind: primed ? 'enter' : 'none' }
      seen.set(key, was)
    } else if (was.state !== state) {
      was = { state, at: now, kind: 'changed', before: was.state }
      seen.set(key, was)
    }
    if (was.kind !== 'none' && now - was.at < DUR) {
      marks[was.kind].add(key)
      if (was.before !== undefined) marks.before.set(key, was.before)
    }
  }
  for (const key of [...seen.keys()]) if (!keep.has(key)) seen.delete(key)
  primed = true
  return marks
}

// An Svg with these rules (keyframes and the classes they animate) in a sheet of its own, the whole
// drawing in a group `mv` (the root svg is not transformed in an image). No rule, the source as is.
const REDUCE = '@media (prefers-reduced-motion: reduce){*{animation:none!important}}'
export function animate(source: string, rules: string[]): string {
  if (rules.length === 0) return source
  const open = source.indexOf('>') + 1
  const end = source.lastIndexOf('</svg>')
  return `${source.slice(0, open)}<style>${rules.join('')}${REDUCE}</style><g class="mv">${source.slice(open, end)}</g></svg>`
}

// A line coming in: fades in and slides 3 px down, `delay` ms after the drawing. Nothing starts
// unseen (from 60%, 85%, a half-drawn ✓), so a mount that plays it again does not flash.
export const fadeIn = (delay: number) =>
  `@keyframes in{from{opacity:.6;transform:translateY(-3px)}to{opacity:1;transform:none}}.mv{animation:in .2s ease-out ${delay}ms both}`

// An icon whose state changed: it grows from 85% (the drawing's `ic` group), and a ✓ draws the
// rest of its stroke.
export const pop = (done: boolean) =>
  '@keyframes pop{from{transform:scale(.85)}to{transform:none}}' +
  '.ic{animation:pop .25s ease-out both;transform-box:fill-box;transform-origin:center}' +
  (done ? '@keyframes draw{from{stroke-dashoffset:8}to{stroke-dashoffset:0}}.ic .gr{stroke-dasharray:16;animation:draw .3s ease-out both}' : '')

// A chip new in the header fades in; a bar whose count went up grows from its old width to the new.
export const chipIn = (tone: string) => `@keyframes ci{from{opacity:.6}to{opacity:1}}.ch-${tone}{animation:ci .2s ease-out both}`
// The bar goes on from where it was (`from`, its width before, as a share of the new one): only
// forward; shorter (more tasks planned), it is drawn as it is.
export const growFrom = (before: string | undefined, now: string): string[] => {
  const was = Number(before || 0)
  const to = Number(now)
  if (!(to > was)) return []
  return [
    `@keyframes grow{from{transform:scaleX(${(was / to).toFixed(3)})}to{transform:none}}.bar{animation:grow .3s ease-out both;transform-box:fill-box;transform-origin:left}`,
  ]
}
// What the motion reads off a drawing: its chips' tones and its bar's width (none without a bar).
export const chipTones = (source: string) => [...source.matchAll(/class="ch-([a-z]+)"/g)].map(m => m[1])
export const barOf = (source: string) => /class="grf bar"[^>]*?width="([^"]+)"/.exec(source)?.[1] ?? ''
