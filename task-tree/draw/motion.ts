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
type Seen = { state: string; at: number; kind: 'enter' | 'changed' | 'none' }
const seen = new Map<string, Seen>()
let primed = false

// Each key drawn now, with its state: `enter` the ones not drawn before, `changed` the ones whose
// state differs, both until DUR after it happened. Keys not drawn now are forgotten.
export type Marks = { enter: Set<string>; changed: Set<string> }
export function mark(drawnNow: [string, string][], now: number | undefined): Marks {
  const marks: Marks = { enter: new Set(), changed: new Set() }
  if (now === undefined) return marks
  const keep = new Set<string>()
  for (const [key, state] of drawnNow) {
    keep.add(key)
    let was = seen.get(key)
    if (was === undefined) {
      was = { state, at: now, kind: primed ? 'enter' : 'none' }
      seen.set(key, was)
    } else if (was.state !== state) {
      was = { state, at: now, kind: 'changed' }
      seen.set(key, was)
    }
    if (was.kind !== 'none' && now - was.at < DUR) marks[was.kind].add(key)
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

// A line coming in: fades in and slides 3 px down, `delay` ms after the drawing.
export const fadeIn = (delay: number) =>
  `@keyframes in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}.mv{animation:in .2s ease-out ${delay}ms both}`
