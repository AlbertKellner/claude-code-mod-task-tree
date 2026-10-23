// ui.render: the pane, drawn from the state through layout() (../draw/layout, pure) and the SVG
// builders (../draw/svg), with the Buttons laid over the lines where ../draw/geometry says; a drawing
// that throws shows the error in one line. ui.press: the pane's presses, answered by key.

import { atom, read, update } from 'claude-code'

import type { Send } from '../types'
import { lineWidth, overlays } from '../draw/geometry'
import type { Placed } from '../draw/geometry'
import { MAIN, flat, hasOpen, withMain, count, total, atWork, sessionTime, current, startedLast, layout, guides, labelCols, frames } from '../draw/layout'
import type { Row } from '../draw/layout'
import { GLYPH, RING_LABEL, chips, clockText, headerSvg, hoverLayer, hovers, percent, prefix, progress, ratioBar, rightText, ringTerm, rowAlt, rowHeight, rowSvg } from '../draw/svg'
import { animate, barOf, chipIn, chipTones, fadeIn, grow, mark, pop } from '../draw/motion'
import { debug } from '../io/log'
import { PANE, DRAW_LIMIT, drawn, act, actions, ensureGroups, ensureView, ensureWork, knownId, setView, stamp } from './panel'
import { keepTime, openSession, watchSessions } from './sessions'

// The pane's lines the person opened or closed (see setFold): the fold of a line, written from a
// press (a render may not write).
const folds = atom({ plugin: 'task-tree', key: 'collapsed' } as const, {} as Record<string, boolean>)
async function setFold($: any, key: string, closed: boolean) {
  await update($, folds, cur => ({ ...cur, [key]: closed }))
}

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const childrenErrorState = { plugin: 'task-tree', key: 'childrenError' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const
const viewState = { plugin: 'task-tree', key: 'view' } as const
const workState = { plugin: 'task-tree', key: 'work' } as const

// The two drawings of the lines layout() made, each from the rows alone (and the header the render
// built): the desktop's Svgs with their Boxes, the terminal's text. `$` is for the presses.
// No ▾/▸ (the person's words: "quero que o botao de colapse nao apareca, e que a funcao de colapsar
// e expandir esteja no icone de progresso da tarefa"): a line with something below it folds and
// opens by its progress icon, a plain Button (the pointer inverts it); a line with nothing below has
// no Button. Terminal: the icon glyph is the Button. Desktop: the Svg draws the icon and a Button
// with an empty label lies over it.
const pressOf = ($: any, r: Row) => () => void setFold($, (r.fold as any).key, (r.fold as any).open)

// Desktop: the header's Svg (its tooltip layer, the view toggle), then one Svg per line and, over it,
// the Boxes `overlays` places (the geometry module's one rule: anchored by the nearest edge, none
// crossing another): the Button that folds the line over its icon (on a session's card, the ⑂ left of
// its name), the Button that opens the session over its context ring (the person's words: "quando
// clicar nele, abra a sessao que ele representa"; the app shows it in this window's main pane,
// open_session_in, focus, and says in a toast what it refuses), and the tooltip layer over a cut
// name. A Box is placed in whole cells, the line's whole height, and centers its Button both ways;
// the last one drawn is on top.
function drawDesktop($: any, ui: any, lines: Row[], W: number, top: { source: string; height: number }, alt: string, chrome: { errorLine: any; views: any[]; now?: number }) {
  const { Box, Svg, Button } = ui
  const keys = lines.map(rowKey)
  const lanes = guides(lines)
  const hides = labelCols(lines)
  const cards = frames(lines)
  // What changed since the drawing before (../draw/motion): new lines fade in, one after another; a
  // line whose state changed pops its icon; a bar whose count changed grows; a new chip fades in.
  const sources = lines.map((r, i) => rowSvg(r, lanes[i], cards[i], W, hides[i]))
  const tones = chipTones(top.source)
  const marks = mark(
    [
      ...keys.map(k => [k, ''] as [string, string]),
      ...lines.map((r, i) => [`${keys[i]}#tone`, progress(r)] as [string, string]),
      ...sources.map((s, i) => [`${keys[i]}#bar`, barOf(s)] as [string, string]),
      ...tones.map(t => [`head#chip:${t}`, ''] as [string, string]),
      ['head#bar', barOf(top.source)],
    ],
    chrome.now,
  )
  let entering = 0
  const motion = (i: number) =>
    marks.enter.has(keys[i])
      ? [fadeIn(Math.min(150, 30 * entering++))]
      : [
          ...(marks.changed.has(`${keys[i]}#tone`) ? [pop(progress(lines[i]) === 'done')] : []),
          ...(marks.changed.has(`${keys[i]}#bar`) && barOf(sources[i]) !== '' ? [grow] : []),
        ]
  const headMotion = [
    ...tones.filter(t => marks.enter.has(`head#chip:${t}`)).map(chipIn),
    ...(marks.changed.has('head#bar') && barOf(top.source) !== '' ? [grow] : []),
  ]
  const over = (r: Row, p: Placed, source: string, H: number) =>
    p.kind === 'icon' ? (
      <Box position="absolute" top={0} bottom={0} left={p.left} width={p.width} flexDirection="row" alignItems="center" justifyContent="center">
        <Button key={`fold:${(r.fold as any).key}`} label={' '} plain onPress={act(`fold:${(r.fold as any).key}`, pressOf($, r))} />
      </Box>
    ) : p.kind === 'ring' ? (
      <Box position="absolute" top={0} bottom={0} right={p.right} width={p.width} flexDirection="row" alignItems="center" justifyContent="center">
        <Button key={`open:${r.sid}`} label={RING_LABEL} plain onPress={act(`open:${r.sid}`, () => void openSession($, r.sid as string, r.title))} />
      </Box>
    ) : (
      <Box position="absolute" top={0} left={p.left}>
        <Svg source={hoverLayer(source, p.width, H)} alt="" width={p.width} height={H} isInteractive />
      </Box>
    )
  return (
    <Box flexDirection="column">
      {chrome.errorLine}
      <Box key="head" position="relative">
        <Svg source={animate(top.source, headMotion)} alt={alt} width={W} height={top.height} />
        {hovers(top.source) ? (
          <Box position="absolute" top={0} left={0}>
            <Svg source={hoverLayer(top.source, W - 64, 24)} alt="" width={W - 64} height={24} isInteractive />
          </Box>
        ) : null}
        <Box position="absolute" top={0} right={0} flexDirection="row" alignItems="center">
          {chrome.views}
        </Box>
      </Box>
      {lines.map((r, i) => (
        <Box key={`r${i}`} flexDirection="row" alignItems="center">
          {(source => {
            const H = rowHeight(r, cards[i])
            const placed = overlays({ depth: r.depth, folds: !!r.fold, ring: !!(r.session && r.sid && r.ring), hover: hovers(source) }, Math.max(0, cards[i].cards.length - 1), W)
            const one = (kind: Placed['kind']) => {
              const p = placed.find(x => x.kind === kind)
              return p ? over(r, p, source, H) : null
            }
            return (
              <Box position="relative">
                <Svg source={animate(source, motion(i))} alt={rowAlt(r)} width={W} height={H} />
                {one('icon')}
                {one('ring')}
                {one('name')}
              </Box>
            )
          })(sources[i])}
        </Box>
      ))}
    </Box>
  )
}

// A line's name across drawings, for its motion: its fold's key, else where it is and what it stands for.
const rowKey = (r: Row) => (r.fold as any)?.key ?? [r.depth, r.sid ?? '', r.title, (r.nodes ?? []).map(t => t.id).join(',')].join('|')

// Terminal: the same lines as text, the guides in box-drawing characters, color only on the icon
// (the Button that folds, on a line with something below).
function drawTerminal($: any, ui: any, lines: Row[], header: any[], errorLine: any) {
  const { Box, Text, Button } = ui
  const iconButton = (r: Row, glyph: string, color: string) => (
    <Button key={`fold:${(r.fold as any).key}`} plain onPress={act(`fold:${(r.fold as any).key}`, pressOf($, r))}>
      <Text color={color}>{glyph}</Text>
    </Button>
  )
  const lanes = guides(lines)
  const hides = labelCols(lines)
  return (
    <Box flexDirection="column">
      {errorLine}
      {header}
      {lines.map((r, i) => {
        const [glyph, color] = GLYPH[progress(r)]
        const forked = r.session === true || r.kids === true
        const quiet = r.tone === 'done' || r.tone === 'interrupted' || r.tone === 'archived' || r.tone === 'section' || r.tone === 'reply'
        const words = rightText(r)
        const time = typeof r.time === 'number' ? clockText(r.time) : r.time === null ? '—' : ''
        const tail = (forked ? '  ⑂' : '') + (words ? `  ${words}` : '') + (time ? `  ${time}` : '')
        const lead = prefix(r, lanes[i], hides[i])
        // A session's label: the ⑂ (the Button that folds the card) left of its name, then its tags,
        // no count or time.
        const parts = r.session ? [
          r.fold ? iconButton(r, '⑂', 'inactive') : <Text key="icon" color="inactive">{'⑂'}</Text>,
          <Text key="title" bold dimColor>{` ${r.title}`}</Text>,
          r.fold && !r.fold.open ? <Text key="more" dimColor>{' ⋯'}</Text> : null,
          // Waiting on the person: the word in amber (the label has no icon to color).
          r.meta ? (
            <Text key="meta" color={r.tone === 'wait' || r.meta === 'aguardando' ? 'warning' : undefined} dimColor={r.meta !== 'aguardando'}>{`  ${r.meta}`}</Text>
          ) : null,
          // The context ring last, on its own.
          r.ring ? <Text key="ring" color={ringTerm(r.ring.percent)}>{`  ${r.ring.percent}%`}</Text> : null,
        ] : [
          glyph ? r.fold ? iconButton(r, glyph, color) : <Text key="icon" color={color}>{glyph}</Text> : null,
          <Text key="title" bold={r.strong} dimColor={quiet}>{glyph ? ` ${r.title}` : r.title}</Text>,
          r.fold && !r.fold.open ? <Text key="more" dimColor>{' ⋯'}</Text> : null,
          tail ? <Text key="tail" dimColor>{tail}</Text> : null,
        ]
        if (!r.fold) {
          return (
            <Text key={`r${i}`}>
              {lead ? <Text color="inactive">{lead}</Text> : null}
              {parts}
            </Text>
          )
        }
        return (
          <Box key={`r${i}`} flexDirection="row">
            {lead ? <Text color="inactive">{lead}</Text> : null}
            {parts}
          </Box>
        )
      })}
    </Box>
  )
}

// The pane's presses, answered by key (see actions), each one logged to the debug log.
export async function press($: EngineInterface, e: any, next: any) {
  if (e.plugin !== 'task-tree' || e.requestId !== PANE) return next(e)
  const fn = actions.get(e.element)
  await debug($, `task-tree: press ${e.element} (${e.surface})${fn ? '' : ': sem ação conhecida'}`)
  if (!fn) return next(e)
  fn()
  return { element: e.element }
}

// A drawing that throws is not dropped in silence: the pane shows the error in one line, and the
// session publishes it (drawn.error) for whoever looks into a panel that does not show up.

import type { EngineInterface } from 'claude-code'
export async function render($: EngineInterface, e: any, next: any) {
 try {
  drawn.error = undefined
  const made = await (async () => {
  const ui = $.ui.resolve(e) as any
  const { Box, Text } = ui
  // After a restart without session.start, the groups, the view and the work come from the store
  // (see ensureGroups, ensureView, ensureWork): a drawing cannot write the state, so what they
  // brought is used here.
  const brought = await ensureGroups($)
  const viewBrought = await ensureView($)
  const workBrought = await ensureWork($)
  // After a hot reload of the mod (each saved edit of the clone reloads it in every session) the clocks
  // were the old module's, gone with it, and they came back only with the next event (a tool call, a
  // refresh, a start): with a task timing and no event, the pane stood still. The app draws the pane
  // when the mod loads: that drawing starts them again (the 1 s clock only while something runs, and
  // the reread of the sessions). Both do nothing while they run; the clock may be asked while drawing
  // (only a state write is refused then).
  await keepTime($).catch(() => {})
  watchSessions($)
  const { value: heldState } = await $.state.get(groupsState)
  const held = heldState ?? brought
  const { value: waits = [] } = await $.state.get(waitsState)
  const { value: sessions = [] } = await $.state.get(childrenState)
  const { value: sessionsError = '' } = await $.state.get(childrenErrorState)
  // The sends still waiting to be taken up (see watchSends): "mensagem na fila".
  const { value: sends = [] } = await $.state.get(sendsState)
  const queued = (sends as Send[]).filter(s => !s.taken)
  // The whole session's count, for the header's tooltip; the header itself counts what the
  // view draws (see shown, below).
  const [ad, an] = total({ groups: withMain(held ?? []), waits, children: sessions })
  // The times are drawn against now; the pane's clock (keepTime) redraws them each second.
  const now = await stamp($)
  // What the person opened or closed.
  const chosen = await read($, folds)
  const { value: heldView } = await $.state.get(viewState)
  const view = heldView ?? viewBrought ?? 'full'
  const summary = view === 'summary'
  const { value: heldWork } = await $.state.get(workState)
  const work = heldWork ?? workBrought ?? []
  // The lines, from the model and the person's choices (../draw/layout, pure): all the drawing
  // below needs besides the width.
  const { value: ended } = await $.state.get(turnEndedState)
  const model = { groups: held ?? [], waits, children: sessions, sends: queued, view, work: work as string[], ...(typeof ended === 'number' ? { ended } : {}) }
  const lines = layout(model, chosen, now, knownId())
  // Which times are running: the same lines a second later show them a second further (the pane is
  // drawn for a change or about once a minute, so the second layout costs little). Those Svgs count
  // their seconds themselves (liveClock).
  if (now !== undefined && e.surface === 'desktop') {
    const later = layout(model, chosen, now + 1000, knownId())
    if (later.length === lines.length)
      lines.forEach((r, i) => {
        const l = later[i]
        if (typeof r.time === 'number' && l.depth === r.depth && l.title === r.title && l.time === r.time + 1000) r.runs = true
      })
  }
  drawn.rows = lines.length

  // The header: the level-1 task in progress (or "Tarefas"), the count, and chips for what
  // is in progress, waiting, interrupted and the sessions at work.
  const mainTasks = withMain(held ?? []).find(g => g.agent === MAIN)?.tasks ?? []
  // With none open, the level-1 task a session is still at work under. The task in progress now is the
  // one started last (current()'s anchor: the task a notice goes under); its level-1 task is the title.
  // It took the first of the lit tasks, the one started longest ago, and a task an earlier request left
  // open and started won over the current one. current() is computed once (it walks the whole tree).
  // With nothing in progress: the task started last (done or not; the person: "o título é o do passo
  // iniciado por último"), then the most recent level-1 task with a session at work under it (by its
  // current round, see atWork: an earlier round's task never), then the most recent request's.
  const now0 = current(mainTasks).anchor ?? startedLast(mainTasks)?.id
  const newest = [...mainTasks].sort((a, b) => (b.plannedAt ?? 0) - (a.plannedAt ?? 0))
  const headTask =
    (now0 !== undefined ? mainTasks.find(t => t.id === now0 || flat(t.children).some(k => k.id === now0)) : undefined) ??
    newest.find(t => atWork(t, sessions, 0).live) ??
    newest[0]
  const head = headTask?.title ?? 'Tarefas'
  // The header counts, times and chips what the view draws: the tasks the drawn lines stand
  // for (Row.nodes), so the summary view's header is the summary's and the full view's, with its
  // group limit, the drawn groups'. The whole session's count stays in the tooltip.
  const shown = lines.flatMap(r => r.nodes ?? [])
  const [d, n, x] = count(shown)
  const tally = (pick: (r: Row) => boolean | undefined) => lines.filter(pick).length
  const busyNow = tally(r => r.live) > 0 || hasOpen(shown)
  const headTime = sessionTime(shown, busyNow, now)
  const headRuns = headTime !== undefined && now !== undefined && sessionTime(shown, busyNow, now + 1000) === headTime + 1000
  // A notice is a wait; a session waiting counts only when it published no notice of its own.
  const sentIds = queued.map(q => q.anchor ?? '')
  // A task waiting on a session is not in progress: this session's (the queued sends' tasks) and
  // the ones the lines show waiting (a card's ✉ task too), by the tasks the lines stand for.
  const sentTasks = new Set(lines.filter(r => r.tone === 'sent').flatMap(r => r.nodes ?? []))
  // Open leaves only, a parent never: started ones (◉) are in progress, the rest (○) pending.
  const open = flat(shown).filter(t => t.status === 'open' && t.children.length === 0 && !sentIds.includes(t.id) && !sentTasks.has(t))
  const active = open.filter(t => t.startedAt !== undefined && t.endedAt === undefined).length
  const pending = open.length - active
  const whole = ad !== d || an !== n ? `sessão inteira: ${ad} de ${an}` : ''
  const list = chips(active, tally(r => (r.tone === 'wait' && r.label === '') || r.pending), x, tally(r => r.live), tally(r => r.tone === 'sent'), pending)
  const errorLine = sessionsError ? <Text key="error" dimColor>Sessões indisponíveis: {sessionsError}</Text> : null

  const { Button } = ui

  // The view toggle: two icon buttons at the right end of the header's title line, ≡ the
  // summary (what is in progress), ▤ the whole tree. The chosen one is the surface's primary
  // (highlighted) button, the other dim; on the terminal the chosen one is in brackets. A desktop
  // draws a Button's `label` as its text, so the label is the glyph alone; which view is chosen
  // is said in the header's alt.
  const VIEWS = [
    ['summary', '≡'],
    ['full', '▤'],
  ] as const
  const views =
    e.surface === 'desktop'
      ? VIEWS.map(([v, glyph]) =>
          view === v ? (
            <Button key={`view:${v}`} label={glyph} variant="primary" onPress={act(`view:${v}`, () => void setView($, v))} />
          ) : (
            <Button key={`view:${v}`} label={glyph} plain dimColor onPress={act(`view:${v}`, () => void setView($, v))} />
          ),
        )
      : VIEWS.flatMap(([v, glyph], i) => [
          ...(i > 0 ? [<Text key="gap"> </Text>] : []),
          <Button key={`view:${v}`} label={view === v ? `[${glyph}]` : glyph} plain dimColor={view !== v} onPress={act(`view:${v}`, () => void setView($, v))} />,
        ])

  if (e.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const W = lineWidth((e.props as any).bodyColumns || 40)
    const top = headerSvg(head, d, n, list, W, headTime, headRuns)
    const alt =
      (n + x === 0
        ? 'Nenhuma tarefa planejada'
        : [
            `${head}: ${d} de ${n} (${percent(d, n)}%)`,
            ...(headTime !== undefined ? [clockText(headTime)] : []),
            ...list.map(c => c.text),
          ].join(', ')) + (whole ? `; ${whole}` : '') + `. Visão: ${summary ? 'resumida' : 'completa'}, selecionada (≡ resumida, ▤ completa)`
    return drawDesktop($, ui, lines, W, top, alt, { errorLine, views, now })
  }

  // Terminal: the same lines as text, the guides in box-drawing characters, color only on
  // the icon; the ▾/▸ in the guides, before the icon.
  const header =
    n + x === 0
      ? [
          <Box key="head" flexDirection="row">
            <Text dimColor>Nenhuma tarefa planejada.</Text>
            <Text>{'  '}</Text>
            {views}
          </Box>,
        ]
      : [
          <Box key="head" flexDirection="row">
            <Text>
              <Text bold>{head}</Text>
              {`  ${d} de ${n} · ${percent(d, n)}%`}
              {headTime !== undefined ? <Text dimColor>{`  ${clockText(headTime)}`}</Text> : null}
              {whole ? <Text dimColor>{`  (${whole})`}</Text> : null}
            </Text>
            <Text>{'  '}</Text>
            {views}
          </Box>,
          <Text key="bar">
            <Text color="success">{ratioBar(d, n, 20)[0]}</Text>
            <Text color="inactive">{ratioBar(d, n, 20)[1]}</Text>
            {list.map(c => (
              <Text key={c.tone} color={GLYPH[c.tone][1]}>{`  ${c.tone === 'current' ? '●' : GLYPH[c.tone][0]} ${c.text.split(' ')[0]}`}</Text>
            ))}
          </Text>,
        ]
  return drawTerminal($, ui, lines, header, errorLine)
  })()
  // The drawing's size, said by /task-tree; past DRAW_LIMIT the app stopped showing the pane (a
  // long session's history, 1.3 MB): an emergency drawing says so in one line instead.
  drawn.size = JSON.stringify(made ?? null).length
  if (drawn.size > DRAW_LIMIT) {
    await debug($, `task-tree: desenho de ${Math.round(drawn.size / 1024)} KB, acima de ${Math.round(DRAW_LIMIT / 1024)} KB`)
    const { Text } = $.ui.resolve(e) as any
    return (
      <Text color="warning">{`Painel grande demais (${Math.round(drawn.size / 1024)} KB): mostrando só o essencial. Use ≡ (/task-tree resumida) para a visão resumida.`}</Text>
    )
  }
  return made
 } catch (err) {
    drawn.error = String((err as any)?.stack ?? err).slice(0, 600)
    await debug($, `task-tree: erro ao desenhar o painel: ${drawn.error}`)
    const { Text } = $.ui.resolve(e) as any
    return <Text color="error">{`Painel de tarefas: erro ao desenhar: ${String(err).slice(0, 300)}`}</Text>
  }
}
