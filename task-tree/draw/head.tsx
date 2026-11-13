// The desktop's header in the app's own elements (the person, 2026-11-13: "migrar todo o Mod para o
// hibrido de nativo e mantendo somente o que for obrigatório em SVG"): a card with the state band
// at its left (a Box's fill), the title, the repository and branch, the progress bar (the one Svg
// here besides the pills' state icons), the chips as pills, and the numbers block at the right. Pure:
// hooks/render.tsx reads the state and builds the Head; nothing here gets `$`.
// Its fill and border are the card's (./desktop, CARD_FILL and CARD_BORDER; the person, 2026-11-13:
// "Sim, junto do cartão (Recomendado)").

import type { GitLabel, Tone } from './layout'
import type { Chip, HeaderState } from './svg'
import { ULTRA, clockText, gitTerm, percent, rateText } from './svg'
import { headBar, stateIcon } from './icons'
import { CARD_BORDER, CARD_FILL } from './desktop'

// What render.tsx computes for the header. `alt`: the whole header's words (render.tsx builds them,
// "estado geral" and "sessão inteira" included), on the bar. `whole`: "sessão inteira: a de b", or ''
// (it is in `alt` already: the drawing shows the view's count, as before). `cols`: the pane's body
// columns (bodyColumns).
export type Head = {
  title: string
  d: number
  n: number
  chips: Chip[]
  time?: number
  rate?: { toks: number; live: boolean }
  git?: GitLabel
  state: HeaderState
  ultracode: boolean
  alt: string
  whole: string
  cols: number
}

// The band's fill by the header's tone (headerState): theme keys, but for the two tints with
// transparency there is no key for (amber at 50%, the track's gray), raw and see-through so they
// sit on both themes.
const BAND: Partial<Record<Tone, string>> = {
  current: 'warning',
  running: 'permission',
  done: 'success',
  interrupted: 'inactive',
  open: 'rgba(136,135,128,0.25)',
  paused: 'rgba(239,159,39,0.5)',
}
// A pill's border by its tone, the color of its fill before (PILL in ./svg).
const PILL: Partial<Record<Tone, string>> = {
  current: 'warning',
  wait: 'warning',
  paused: 'warning',
  open: 'inactive',
  interrupted: 'inactive',
  agent: 'inactive',
  sent: 'permission',
  running: 'permission',
  done: 'success',
}

// Narrower than 600 px before (W = 7.2 px a column): no rate and no ultracode, the % smaller.
const NARROW = 84
// The most columns a folder's path takes (160 px in the old drawing): the app cuts it past them.
const FOLDER_COLS = 22

// Room, in columns, the numbers block leaves the left column (the % large, "d de n", the clock and
// its tail); `edge`: the border, the band and the paddings around the left column.
const blockCols = (narrow: boolean, ultra: boolean) => (narrow ? 11 : 18) + (ultra ? ULTRA.length + 3 : 0)
const edge = 6

// The repository and branch under the title (the person: "coloque essas infos também no topo do
// painel"); short of room, the branch alone, then nothing.
function gitLine(git: GitLabel, room: number): string {
  const whole = gitTerm(git)
  const len = git.folder ? 2 + Math.min(FOLDER_COLS, Array.from(git.repo).length) : Array.from(whole).length
  if (len <= room) return whole
  const branch = `⑂ ${git.branch ?? ''}`
  if (!git.folder && Array.from(branch).length <= room) return branch
  return ''
}

// The pills that fit: with their words if all of them fit, else the numbers alone; then cut at the
// first one that does not fit (the order is chips()'s).
function pills(list: Chip[], room: number): { chip: Chip; text: string }[] {
  const w = (text: string) => Array.from(text).length + 5
  const wide = list.reduce((a, c) => a + w(c.text) + 1, -1) <= room
  const out: { chip: Chip; text: string }[] = []
  let used = -1
  for (const chip of list) {
    const text = wide ? chip.text : chip.text.split(' ')[0]!
    if (used + 1 + w(text) > room) break
    used += 1 + w(text)
    out.push({ chip, text })
  }
  return out
}

// Not `h`: the JSX of this file is built by a function of that name, and a parameter `h` hides it.
export function desktopHead(ui: any, head: Head): any {
  const { Box, Text, Svg } = ui
  const empty = head.n === 0 && head.chips.length === 0
  const narrow = head.cols < NARROW
  const ultra = head.ultracode && !narrow
  const room = Math.max(0, head.cols - blockCols(narrow, ultra) - edge)
  const git = !empty && head.git ? gitLine(head.git, room) : ''
  const shown = empty ? [] : pills(head.chips, room)
  const clock = head.time !== undefined ? clockText(head.time) : ''
  const rate = !narrow && head.rate ? head.rate : undefined
  return (
    <Box key="head" flexDirection="row" borderStyle="round" paddingX={0} paddingY={0} overflow="hidden" backgroundColor={CARD_FILL} borderColor={CARD_BORDER} marginBottom={1}>
      <Box key="band" width={1} flexShrink={0} backgroundColor={BAND[head.state.tone] ?? BAND.open} />
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} paddingX={1} paddingY={1}>
        <Box height={1} minWidth={0}>
          <Text size="heading" weight="semibold" wrap="truncate-end">{empty ? 'Tarefas' : head.title}</Text>
        </Box>
        <Box height={1} minWidth={0}>
          {empty ? (
            <Text size="footnote" color="inactive" wrap="truncate-end">Nenhuma tarefa planejada.</Text>
          ) : git ? (
            <Text size="footnote" color="inactive" wrap="truncate-end">{git}</Text>
          ) : null}
        </Box>
        {/* A column, so the bar takes the slot's width (an Svg with no width in a row keeps 300 px). */}
        <Box flexDirection="column" paddingY={1}>
          {empty ? null : <Svg source={headBar(head.d, head.n)} alt={head.alt} height={4} />}
        </Box>
        {/* The pills' line is there with none, so the lines below do not jump when one comes or goes. */}
        <Box height={1} columnGap={1} overflow="hidden">
          {shown.map(({ chip, text }) => (
            <Box key={`chip:${chip.tone}`} flexDirection="row" alignItems="center" borderStyle="round" borderColor={PILL[chip.tone] ?? 'inactive'} borderDimColor paddingX={1} paddingY={0} flexShrink={0} columnGap={1}>
              <Svg source={stateIcon(chip.tone)} alt={chip.text} width={16} height={16} />
              <Text size="footnote">{text}</Text>
            </Box>
          ))}
        </Box>
      </Box>
      {empty ? null : (
        <Box flexDirection="column" flexShrink={0} alignItems="flex-end" justifyContent="center" paddingX={1}>
          <Text size="title" weight="bold" tabular>{`${percent(head.d, head.n)}%`}</Text>
          <Text size="footnote" color="inactive" tabular>{`${head.d} de ${head.n}`}</Text>
          {clock || rate || ultra ? (
            <Text size="footnote" color="inactive" tabular>
              {clock || null}
              {rate ? (
                rate.live ? (
                  <Text>{`${clock ? ' · ' : ''}${rateText(rate.toks)}`}</Text>
                ) : (
                  <Text dimColor>{`${clock ? ' · ' : ''}${rateText(rate.toks)}`}</Text>
                )
              ) : null}
              {ultra ? (
                <Text>
                  {clock || rate ? ' · ' : ''}
                  <Text color="effortUltra">{ULTRA}</Text>
                </Text>
              ) : null}
            </Text>
          ) : null}
        </Box>
      )}
    </Box>
  )
}
