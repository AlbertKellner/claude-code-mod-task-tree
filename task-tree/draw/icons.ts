// The desktop's small Svgs: what stays an image in the native drawing (the person, 2026-11-13: "migrar
// todo o Mod para o hibrido de nativo e mantendo somente o que for obrigatório em SVG"): the state
// icon of a line, the envelope of a message task, the bust of a session, the context ring and the
// header's bar. Pure text from the primitives of ./svg (icon, envelope, sessionIcon, contextRing),
// 16 × 16 px with the icon centered on (8, 8), no text, no font, no <title>. Each source is built once
// per key and kept in a Map of the module: a drawing has a handful of them, drawn every second.
// The colors stay in the light and dark classes of ./svg (prefers-color-scheme): an image does not
// see the app's theme variables.

import { contextRing, envelope, icon, MSG_CLASS, sessionIcon, slim, STYLE } from './svg'
import type { MsgState, SessionState, Tone } from './layout'

// The icons' side, in px: the Svg's width and height in the drawing (draw/desktop.tsx).
export const ICON = 16
const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${ICON}" viewBox="0 0 ${ICON} ${ICON}">${STYLE}`
const C = ICON / 2

// One Map per kind; a ring's key is its share, so a cap keeps the Map small (202 rings at most:
// 0 to 100, faded or not, and fractions a context never has in practice).
const kept = <K>(build: (k: K) => string) => {
  const m = new Map<K, string>()
  return (k: K) => {
    let s = m.get(k)
    if (s === undefined) {
      s = build(k)
      if (m.size > 500) m.clear()
      m.set(k, s)
    }
    return s
  }
}

// The progress icon of a line (progress(r) in ./svg): ○ ◉ ✓ ✕ ◷ ▸ ↩ and the bust of 'running'.
export const stateIcon: (tone: Tone) => string = kept((tone: Tone) => slim(open + icon(tone, C, C) + '</svg>'))
// A message task's ✉, in the color of where the message is (MSG_CLASS).
export const msgIcon: (state: MsgState) => string = kept((state: MsgState) => slim(open + envelope(C, C, MSG_CLASS[state]) + '</svg>'))
// A session's bust in its state's color ('arquivada' faded, sessionIcon's own opacity).
export const bustIcon: (state: SessionState) => string = kept((state: SessionState) => slim(open + sessionIcon('filha', state, C, C) + '</svg>'))
// The context ring, faded on an archived session's card.
const ring = kept((k: string) => {
  const [p, f] = k.split(':')
  const body = contextRing(Number(p), C, C)
  return slim(open + (f === '1' ? `<g opacity=".45">${body}</g>` : body) + '</svg>')
})
export const ringIcon = (percent: number, faded: boolean) => ring(`${percent}:${faded ? 1 : 0}`)
// The header's progress bar: the gray track and the green share, 4 px high, as wide as its slot
// (width 100%; its parent is a column, see draw/head.tsx), no estimate of the width. The share has a
// floor of 2 % so one task done of many still shows.
const bar = kept((k: string) => {
  const [d, n] = k.split('/').map(Number) as [number, number]
  const share = n > 0 && d > 0 ? Math.round(Math.max(2, (100 * d) / n) * 10) / 10 : 0
  return slim(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="4">${STYLE}<rect class="tr" width="100%" height="4" rx="2"/>` +
      (share > 0 ? `<rect class="grf bar" width="${share}%" height="4" rx="2"/>` : '') +
      '</svg>',
  )
})
export const headBar = (d: number, n: number) => bar(`${d}/${n}`)
