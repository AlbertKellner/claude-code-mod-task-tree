// The sessions this one opened, as the hooks keep them: the list and the files read again
// (refreshChildren, with the steps of ../io/host), the messages received and the sends watched, the
// reminders for the main loop (a session that ended its turn, a message taken up), the record of a
// start_session, the pane's clock and the poll. Nothing here registers a hook.

import { update } from 'claude-code'

import type { Child, Group, Published, Send, Wait } from '../types'
import { SESSION } from '../text/rules'
import { MAIN, cardTotal, discarded, flat, inFlight, inSight, resolveAnchor, running, settle as settleCard, split, newBreaksMemo, rawPanel, tasksOf, tiesOf } from '../draw/layout'
import { emptyPublished, readPublished, waitFile } from '../io/publish'
import { debug } from '../io/log'
import { allSessionIds, deducedOwn, deriveChildren, justOpened, listSessions, mineOf, readFiles, sessionGone, staleFiles } from '../io/host'
import { edit, fillStarts, finish, settle } from '../state/tasks'
import { checkSubs, strandedSends } from './agents'
import { change, ensureLinks, ensureTurn, inDesktopApp, isLeftBehind, keptLink, knownId, openList, openTurnOf, publishPanel, askingAnchors, refreshGit, saveLinks, selfId, sendAnchor, showStatus, stamp, usedAnchors } from './panel'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const childrenErrorState = { plugin: 'task-tree', key: 'childrenError' } as const
const endedState = { plugin: 'task-tree', key: 'ended' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const receiptsState = { plugin: 'task-tree', key: 'receipts' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
const receivedState = { plugin: 'task-tree', key: 'received' } as const
const workState = { plugin: 'task-tree', key: 'work' } as const

// The sessions this one opened, read in the four steps of io/host.ts: the host's list, their
// published files, the children derived from both, and this session's own publication. The state
// calls stay here (the kit wants the state keys literal in the hooks module).
// When the list was last read (clock ms), by the 10 s poll or otherwise.
export let refreshedAt: number | undefined
// One read at a time (the 3 s clock, the app's notice, a start_session, a message, refreshStale): a
// read asked while one runs only marks `readAgain` and waits for the one in progress, which then
// runs once more; every caller gets the end of the last one. Two reads at once wrote the children
// out of order (the older last: the session running again, and a second "ended its turn" for the
// same end). Variables of the module: a reload starts them over.
let reading: Promise<void> | undefined
let readAgain = false
export async function refreshChildren($: any): Promise<void> {
  if (reading !== undefined) {
    readAgain = true
    return reading
  }
  reading = readChildrenLoop($)
  return reading
}
async function readChildrenLoop($: any) {
  try {
    do {
      readAgain = false
      await readChildren($)
    } while (readAgain)
  } finally {
    reading = undefined
  }
}
// An archived session whose ties (where it was opened, its last message's task, its rounds') are all
// out of the current work (`out`: its request went to "+N pedidos anteriores"; one with no tie is out
// too) is kept as one line: its panel leaves the state, in place of it the count its cards had (split,
// as drawn and counted), so the x/y of its task of origin does not change. Its file is not read again
// while it stays so (readFiles skips an archived one known archived). The person, 2026-11-14: "Vira
// linha resumida (Recomendado)".
export function summarize(children: Child[], groups: Group[], out: (c: Child) => boolean, me: string | undefined): Child[] {
  const tasks = groups.find(g => g.agent === MAIN)?.tasks ?? []
  return children.map(c => {
    if (!c.archived || c.summary !== undefined || (c.panel === undefined && c.tasks === undefined) || !out(c)) return c
    let d = 0
    let n = 0
    let x = 0
    for (const r of split(c, children, me, tasks, undefined, newBreaksMemo()).map(k => settleCard(k, tasks, []))) {
      if (discarded(r)) continue
      const [cd, cn, cx] = cardTotal(r, 0)
      d += cd
      n += cn
      x += cx
    }
    const { panel: _p, tasks: _t, ...rest } = c
    return { ...rest, summary: { d, n, x } }
  })
}
async function readChildren($: any) {
  // The links come back from the store before this reread writes the children (a new process).
  await ensureLinks($)
  const now = await stamp($)
  refreshedAt = now ?? refreshedAt
  // The subagents' cards still alive, against the engine's list: one whose end never came is ended
  // (hooks/agents, checkSubs). First, and whatever the sessions' list says below.
  await checkSubs($).catch(() => {})
  // The messages queued to a subagent that ended without receiving them (hooks/agents).
  await strandedSends($).catch(() => {})
  // 1. The list. A failure is shown in the panel, else the sessions would silently drop out;
  // outside the desktop app there are no sessions to show, so no line either.
  const listed = await listSessions($)
  const rows = 'error' in listed ? undefined : listed.rows
  // Messages queued to any session (its children, its mother, its sisters): before any return, a list
  // that failed included (with no rows, a session that publishes the messages it got still confirms
  // them by its file; the list's error kept the letter blue after the delivery).
  await watchSends($, Array.isArray(rows) ? rows : [])
  // The error line is written only when it changes (every poll cleared it before).
  const { value: shownError = '' } = await $.state.get(childrenErrorState)
  if ('error' in listed) {
    const error = (await inDesktopApp($)) ? listed.error : ''
    if (error !== shownError) await $.state.set(childrenErrorState, error)
    return
  }
  if (shownError !== '') await $.state.set(childrenErrorState, '')
  if (!Array.isArray(rows)) return
  // No linked session at all: this one opened none (the state is cleared once, not every poll), but
  // one just opened that the list does not hold yet (still in its grace, see deriveChildren). Cleared,
  // the pane is published: the file the mother reads loses the cards too.
  if (rows.length === 0) {
    const { value: cur } = await $.state.get(childrenState)
    const keep = (c: Child[] | undefined) => (c ?? []).filter(k => justOpened(k, now))
    if (keep(cur).length !== (cur ?? []).length) {
      await update($, childrenState, keep)
      await publishPanel($)
    }
    return
  }
  // By this session's own id; in the app, a read waits for it (after a reload it is asked again)
  // rather than deduce, which a list read mid-change can point at another session.
  const self = await selfId($)
  if (self === undefined && (await inDesktopApp($))) return
  const deduced = deducedOwn(rows)
  if (self !== undefined && deduced !== undefined && deduced !== self) await debug($, `task-tree: mineOf deduziu ${deduced}, id próprio ${self}`)
  // The sessions opened before a /clear here are left behind: no card (forgetChildren).
  const mine = mineOf(rows, self)?.filter(r => !isLeftBehind(r.sessionId))
  if (mine === undefined) return
  // 2. Their files. A session kept as one line (summarize) whose request came back to the work is read
  // again, for its whole card.
  const { value: cur } = await $.state.get(childrenState)
  const { value: groups0 = [] } = await $.state.get(groupsState)
  const { value: work = [] } = await $.state.get(workState)
  const mainTasks = (groups0 as Group[]).find(g => g.agent === MAIN)?.tasks ?? []
  const sight = inSight(mainTasks, work as string[])
  const out = (c: Child) => !tiesOf(c, mainTasks).some(a => sight.includes(a))
  const read = await readFiles($, mine, ((cur ?? []) as Child[]).filter(c => c.summary === undefined || out(c)))
  const derive = (known: Child[]) => {
    const d = deriveChildren(mine, known, read, keptLink, now)
    return { ...d, children: summarize(d.children, groups0 as Group[], out, self) }
  }
  // 3. The children, and the sessions whose turn just ended: the main loop is reminded of the task
  // it opened them on (see endedNote). The state is written only when the children changed: a poll
  // with nothing new (the usual one, every 3 s) derives the same list, and a write of it would cost
  // the whole value crossing to the host (220 KB in the real case) and a redraw. Compared first, then
  // written by `update`, derived again over the value it hands (a write made meanwhile, a send's
  // round, is not lost), and the sessions that just ended come from that same derivation.
  const first = derive(cur ?? [])
  let ended = first.ended
  const changed = JSON.stringify(first.children) !== JSON.stringify(cur ?? [])
  if (changed) {
    await update($, childrenState, c => {
      const d = derive(c ?? [])
      ended = d.ended
      return d.children
    })
  }
  if (ended.length > 0) await update($, endedState, cur => [...(cur ?? []).filter(id => !ended.includes(id)), ...ended])
  // 4. The sessions' tasks are in this session's count, and in what it publishes to the one that
  // opened it (also when the children changed to none: the mother's card loses them).
  const { value: groups = [] } = await $.state.get(groupsState)
  await showStatus($, groups)
  if (mine.length > 0 || changed) await publishPanel($)
  await keepTime($)
}

// The messages of other sessions in a prompt (the senders of its top-level `<cross-session-message
// from="local_…">` tags, read by prompt-submit's said), kept with when they came (the last 20) and
// published, for the senders to confirm their queued SendMessage.
export async function noteReceived($: any, senders: string[]) {
  const froms = senders.filter(id => id.startsWith('local_'))
  if (froms.length === 0) return
  const at = await stamp($)
  if (at === undefined) return
  await update($, receivedState, cur => [...(cur ?? []), ...froms.map(from => ({ from, at }))].slice(-20))
  await publishPanel($)
}

// A queued message is taken up once its session says so. A session that publishes the messages it
// got (`received`, this version) answers for each one: the sends to it still waiting, oldest first,
// are matched each to its own message received from this one at or after the send (the oldest one
// not matched yet), so the first delivery of two messages queued to a busy session closes only the
// first task, and the second keeps its ✉ (one delivery closed both, and the second task vanished
// from the panel while its message was still waiting). A message received is matched once: how far
// each session's receipts were used (the instant of the last one and how many at it) is kept in the
// state and the links record (`receipts`), so a reload or a new process does not confirm the second
// message with the first one's receipt. Sessions without `received`
// (earlier versions): a turn of it opened after the send; else seen stopped after the send and
// running again.
export async function watchSends($: any, rows: any[]) {
  const { value: sends = [] } = await $.state.get(sendsState)
  if ((sends as Send[]).every(s => s.taken)) return
  const me = await selfId($)
  const files: Record<string, Published> = {}
  const fileOf = async (id: string): Promise<Published> => {
    if (!(id in files)) files[id] = (await readPublished($, id)) ?? { waiting: false, waits: [], children: [] }
    return files[id]!
  }
  const marks: Record<number, Partial<Send>> = {}
  const { value: used = {} } = await $.state.get(receiptsState)
  const usedNow: Record<string, { at: number; n: number }> = { ...used }
  // The sends still waiting, by the session they went to.
  const waiting = new Map<string, { i: number; s: Send; r: any }[]>()
  for (const [i, s] of (sends as Send[]).entries()) {
    // A subagent's: its delivery is the subagent's (hooks/agents), whatever session has its name.
    if (s.taken || s.agent !== undefined) continue
    const r = rows.find(r => r.sessionId === s.to || (r.name && r.name === s.to))
    const id = r?.sessionId ?? (String(s.to).startsWith('local_') ? s.to : undefined)
    if (id === undefined) continue
    waiting.set(id, [...(waiting.get(id) ?? []), { i, s, r }])
  }
  for (const [id, list] of waiting) {
    const file = await fileOf(id)
    if (Array.isArray(file.received)) {
      // Its receipts from this one, oldest first, less those already used (before the mark, and the
      // first n at the mark's instant).
      const mark = usedNow[id]
      let skip = mark?.n ?? 0
      const got = file.received
        .filter((x: any) => x?.from === me && typeof x?.at === 'number')
        .map((x: any) => x.at as number)
        .sort((a: number, b: number) => a - b)
        .filter((at: number) => {
          if (mark === undefined || at > mark.at) return true
          if (at < mark.at) return false
          return skip-- <= 0
        })
      let j = 0
      for (const { i, s } of [...list].sort((a, b) => (a.s.at ?? 0) - (b.s.at ?? 0))) {
        const since = s.at ?? 0
        while (j < got.length && got[j]! < since) j++
        if (j >= got.length) break
        marks[i] = { taken: true }
        const at = got[j]!
        const last = usedNow[id]
        usedNow[id] = { at, n: last && last.at === at ? last.n + 1 : 1 }
        j++
      }
      continue
    }
    for (const { i, s, r } of list) {
      const since = s.at ?? 0
      const main = file.groups?.find((g: any) => g?.agent === MAIN)
      const turned = Array.isArray(main?.turns) && main.turns.some((u: any) => typeof u?.at === 'number' && u.at >= since)
      if (turned) marks[i] = { taken: true }
      else if (r && r.isRunning !== true && !s.idle) marks[i] = { idle: true }
      else if (r && r.isRunning === true && s.idle) marks[i] = { taken: true }
    }
  }
  // A session archived with the message still queued will not take it up: the letter is not delivered
  // (gray, "não entregue") and its task stops waiting on it (the clock, the Esc, what holds the view;
  // the person, 2026-11-12: "Cinza \"não entregue\" (Recomendado)"). Only by what the list says: a
  // session the list leaves out (a partial list, a list that failed) is not judged; one with the name of
  // an archived one and not archived itself still waits. Listed again unarchived, it waits again, and
  // the main loop will be told again of what comes of it. Taken up after all (its receipt): delivered,
  // as any other, and the main loop is told so.
  for (const [i, s] of (sends as Send[]).entries()) {
    if (s.taken || s.agent !== undefined) continue
    if (marks[i]?.taken) {
      if (s.lost) marks[i] = { ...marks[i], cut: false, lost: false, noted: false }
      continue
    }
    const same = rows.filter(r => r.sessionId === s.to || (r.name && r.name === s.to))
    if (same.length === 0) continue
    const archived = same.every(r => r.isArchived === true)
    if (archived && !s.lost) marks[i] = { ...marks[i], cut: true, lost: true }
    else if (!archived && s.lost) marks[i] = { ...marks[i], cut: false, lost: false, noted: false }
  }
  if (Object.keys(marks).length === 0) return
  await update($, sendsState, cur => (cur ?? []).map((s, i) => (marks[i] ? { ...s, ...marks[i] } : s)))
  if (JSON.stringify(usedNow) !== JSON.stringify(used)) await $.state.set(receiptsState, usedNow)
  // Taken up: the task it was sent from is done, closed here with no turn of this session (it may
  // have stopped waiting for it), so its card in the mother's pane is not left parked.
  // An adopted one (given its task by a later plan, Send.adopted) closes none. Nor one with something
  // else still at work in it (inFlight, read after this pass's marks: a letter delivered now is not
  // "another queued"), without the sessions: the one that took the letter is alive there by definition.
  const anchors = (sends as Send[]).flatMap((s, i) => (marks[i]?.taken && s.anchor && !s.adopted ? [s.anchor] : []))
  if (anchors.length === 0) return
  const now = await stamp($)
  const after = (sends as Send[]).map((s, i) => (marks[i] ? { ...s, ...marks[i] } : s))
  const { value: waits = [] } = await $.state.get(waitsState)
  await change($, all =>
    all.map(g => {
      if (g.agent !== MAIN) return g
      let tasks = g.tasks
      for (const id of anchors) {
        const t = flat(tasks).find(t => t.id === id)
        if (inFlight(all, MAIN, id, { sends: after, waits: waits as Wait[] })) continue
        if (t && t.status === 'open' && !t.children.some(c => c.status === 'open')) tasks = settle(edit(fillStarts(tasks, id, now), id, finish(now)), now)
      }
      return { ...g, tasks }
    }),
  )
}
// Once: the sessions that took up a queued message, with the task it was sent from; and those archived
// with a message still queued (not delivered).
export async function takenNote($: any): Promise<string | undefined> {
  const { value: sends = [] } = await $.state.get(sendsState)
  const done = (sends as Send[]).filter(s => s.taken && !s.noted)
  const lost = (sends as Send[]).filter(s => s.lost && !s.taken && !s.noted)
  if (done.length === 0 && lost.length === 0) return undefined
  // Kept, its letter green (gray when not delivered) under its task (the last 20); the reminder goes once.
  await $.state.set(sendsState, (sends as Send[]).map(s => (s.taken || s.lost ? { ...s, noted: true } : s)).slice(-20))
  // A delivery at once needs no reminder: the model saw it delivered.
  const taken = done.filter(s => !s.delivered)
  if (taken.length === 0 && lost.length === 0) return undefined
  const { value: groups = [] } = await $.state.get(groupsState)
  const all = flat((groups as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
  const what = (list: Send[]) =>
    list.map(s => {
      const t = all.find(t => t.id === s.anchor)
      return `${s.to}${t ? ` (tarefa do envio "${t.id}" ${t.title})` : ''}`
    })
  // A subagent's (with `agent`) and a session's, each with its own words.
  const sub = (list: Send[], mine: boolean) => list.filter(s => (s.agent !== undefined) === mine)
  // A session's, by what the panel did with its task: closed (✓) says so; any other (interrupted by a new
  // plan, out of the plan, a subtask still open, no task) says it was not closed. It said "já concluiu"
  // of every one, and watchSends closes only an open task with nothing open below it.
  const closed = (s: Send) => all.find(t => t.id === s.anchor)?.status === 'done'
  const shut = sub(taken, false).filter(closed)
  const kept = sub(taken, false).filter(s => !closed(s))
  return [
    ...(shut.length > 0 ? [SESSION.taken(what(shut))] : []),
    ...(kept.length > 0 ? [SESSION.takenOpen(what(kept))] : []),
    ...(sub(lost, false).length > 0 ? [SESSION.lost(what(sub(lost, false)))] : []),
    ...(sub(taken, true).length > 0 ? [SESSION.takenSub(what(sub(taken, true)))] : []),
    ...(sub(lost, true).length > 0 ? [SESSION.lostSub(what(sub(lost, true)))] : []),
  ].join(' ')
}

// The list read again when it is older than the poll's period: a session drawn at work after
// it stopped keeps the tasks it was opened on in progress. Only after a first read (session.start).
export async function refreshStale($: any) {
  const now = await stamp($)
  if (refreshedAt === undefined || now === undefined || now - refreshedAt < POLL) return
  await refreshChildren($)
}

// A start_session call records the task the main loop is on, under the id its result names.
// `names` are the session's names (its `name`), `phrases` free text (its title): namedFor.
export async function recordStart($: any, resultText: string, names: string[] = [], phrases: string[] = []) {
  const id = /local_[0-9a-f-]{36}/.exec(resultText)?.[0]
  if (!id) return
  const { value = [] } = await $.state.get(groupsState)
  const { value: kids0 = [] } = await $.state.get(childrenState)
  const { value: sends0 = [] } = await $.state.get(sendsState)
  // The task the session is opened on: the one in progress, else as a message is anchored (sendAnchor;
  // with several in progress, the first with no message yet).
  const { value: waits0 = [] } = await $.state.get(waitsState)
  // Before the request's first plan: none (drawn loose until the plan adopts it).
  const anchor = sendAnchor((value as Group[]).find(g => g.agent === MAIN)?.tasks ?? [], usedAnchors(kids0 as Child[], sends0 as Send[], (value as Group[]).filter(g => (g.parent ?? MAIN) === MAIN)), askingAnchors(waits0 as Wait[]), names, openTurnOf(value as Group[])?.id, phrases)
  // When it was opened: its task counts as used from then on (usedAnchors).
  const openedAt = await stamp($)
  await update($, childrenState, cur => {
    const list = cur ?? []
    if (list.some(c => c.id === id)) return list.map(c => (c.id === id ? { ...c, anchor: c.anchor ?? anchor, openedAt: c.openedAt ?? openedAt } : c))
    return [...list, { id, name: '', title: 'Sessão iniciando…', running: true, archived: false, starting: true, anchor: anchor ?? keptLink(id)?.anchor, openedAt: openedAt ?? keptLink(id)?.openedAt }]
  })
  // The tie goes to the store before the first read: a session the list does not hold yet, dropped
  // after its grace, gets its task back from there once listed (keptLink).
  await saveLinks($)
  await refreshChildren($)
}

// Once per session whose turn ended: a reminder for the main loop, while the task it opened
// that session on is still open, to read its report and close what the delegated work finished.
export async function endedNote($: any): Promise<string | undefined> {
  const { value: ids = [] } = await $.state.get(endedState)
  if (ids.length === 0) return undefined
  await $.state.set(endedState, [])
  const { value: kids = [] } = await $.state.get(childrenState)
  const { value: groups = [] } = await $.state.get(groupsState)
  const tasks = (groups as Group[]).find(g => g.agent === MAIN)?.tasks ?? []
  const open = flat(tasks).filter(t => t.status === 'open')
  const { value: sends = [] } = await $.state.get(sendsState)
  // The task the reminder names: that of the last message the session already took up (its newest
  // round with no send to it still queued from that task), if still open; else the one it was opened
  // from. A message still queued does not move it: the turn that ended was not on it.
  const queued = (c: Child, anchor: string | undefined) =>
    (sends as Send[]).some(s => (s.to === c.id || (c.name !== '' && s.to === c.name)) && s.anchor === anchor && !s.taken && !s.cut)
  const originOf = (c: Child) => {
    const round = [...(c.rounds ?? [])].sort((a, b) => b.at - a.at).find(r => !queued(c, r.anchor))
    const cands = [resolveAnchor(tasks, round?.anchor, round?.at), c.anchor]
    for (const id of cands) {
      const t = id === undefined ? undefined : open.find(t => t.id === id)
      if (t !== undefined) return t
    }
    return undefined
  }
  const lines = (kids as Child[])
    .filter(c => ids.includes(c.id))
    .map(c => ({ c, t: originOf(c) }))
    .filter(x => x.t !== undefined)
    .map(x => `"${x.c.name || x.c.title}" (tarefa de origem "${x.t?.id}" ${x.t?.title})`)
  // One that stopped with its task closed here: its pending tasks left the count (settle), said once.
  const left = (kids as Child[])
    .filter(c => ids.includes(c.id))
    .flatMap(c => split(c, kids as Child[], knownId(), tasks, undefined, newBreaksMemo()).map(r => settleCard(r, tasks, sends as Send[])))
    .filter(r => r.settled)
    .map(r => `"${r.name || r.title}" (${flat(tasksOf(rawPanel(r).groups ?? [])).filter(t => t.status === 'open' && t.children.length === 0).length} pendentes)`)
  const notes = [...(lines.length > 0 ? [SESSION.ended(lines, openList(tasks))] : []), ...(left.length > 0 ? [SESSION.stopped(left)] : [])]
  return notes.length > 0 ? notes.join(' ') : undefined
}

// The pane's 1 s clock: it redraws the times while a task runs, here or in a session this one
// opened, and stops when none does. Started again by the next start, refresh or tool call.
export let ticker: { cancel: () => void } | undefined
// The linked sessions read again every few seconds, so a session's card shows what its own pane
// shows. Started at session.start and again from the main loop's calls and prompts: a reload of
// the mod cancels the old module's timers, and the cards would stay as they were.
export const POLL = 3000
export let poller: { cancel: () => void } | undefined
export function watchSessions($: any) {
  if (poller) return
  try {
    // A failure must not end the interval: the sessions would stay drawn as they were.
    poller = $.clock.every(POLL, () => refreshChildren($).catch(() => {}))
  } catch {}
}
export async function anyRunning($: any): Promise<boolean> {
  const { value: groups = [] } = await $.state.get(groupsState)
  const { value: children = [] } = await $.state.get(childrenState)
  // With this session's turn ended, its own tasks run no clock (see turnEnded), except the task of a
  // send still queued: its ✉ outlives the turn (halt spares it) and its clock counts the wait (not one
  // that will not be delivered, `cut`: its session was archived). After a restart the end comes back
  // from the store first (ensureTurn): no clock for what had stopped.
  const brought = await ensureTurn($)
  const { value: heldEnded } = await $.state.get(turnEndedState)
  const ended = heldEnded !== undefined ? heldEnded : brought?.ended
  const { value: sends = [] } = await $.state.get(sendsState)
  if ((sends as Send[]).some(s => !s.taken && !s.cut)) return true
  return running({ groups: typeof ended === 'number' ? [] : groups, waits: [], children })
}
export async function tick($: any) {
  if (await anyRunning($)) {
    // While the clock runs, the branch is read again too (a 40-byte file): a checkout mid-session
    // shows in the header within a second, and in the card at the next publication.
    void refreshGit($).catch(() => {})
    try {
      $.ui.invalidate('ui.render')
    } catch {}
    return
  }
  ticker?.cancel()
  ticker = undefined
}
// The running times are redrawn every second (the drawing carries the time itself: a clock counting
// inside an image, as the lines once were, went back to its first second each time the app made the
// image again).
// Every drawing asks for the clock: the check and the start must not be split by an await, or drawings
// at the same time each start one, and only the last is kept to cancel (the others redrew the pane
// every second for good, in bursts that replaced the Buttons under the pointer: clicks were lost).
let starting = false
export async function keepTime($: any) {
  if (ticker || starting) return
  starting = true
  try {
    if (!(await anyRunning($)) || (await stamp($)) === undefined || ticker) return
    try {
      ticker = $.clock.every(1000, () => void tick($))
    } catch {}
  } finally {
    starting = false
  }
}

// Opens a session in this window's main pane, as a click on its sidebar row (the app's
// open_session_in, which takes this session or one it started); a refusal goes to a toast.
export async function openSession($: any, id: string, name: string) {
  try {
    const r = await $.mcp.call('ccd_window', 'open_session_in', { session_id: id, target: 'focus' })
    const said = (r?.content ?? []).map((c: any) => c?.text ?? '').join(' ').trim()
    if (r?.isError) await $.ui.toast(`Não abriu ${name}: ${said || 'recusado pelo app'}`)
  } catch (err) {
    await $.ui.toast(`Não abriu ${name}: ${String(err).slice(0, 120)}`)
  }
}

// The published files of sessions the app no longer has are emptied (the kit cannot delete): once, in
// the background, at session.start of a new process, in the desktop app only. A file is a candidate
// when it is another session's, over 1 KB and a day without writes (staleFiles); the app's whole
// list (archived included) must have been read, and the app must answer that the session does not
// exist (sessionGone). Anything else leaves the file as it is. The person, 2026-11-14: "Enxugar e
// esvaziar (Recomendado)".
export async function sweepPublished($: any) {
  try {
    if (!(await inDesktopApp($))) return
    const self = await selfId($)
    if (self === undefined) return
    const own = await waitFile($, self)
    if (!own) return
    const dir = own.slice(0, own.lastIndexOf('/'))
    const now = (await stamp($)) ?? Date.now()
    const stale = staleFiles(await $.fs.list(dir), self, now)
    if (stale.length === 0) return
    const listed = await allSessionIds($)
    if (listed === undefined) return
    for (const id of stale) {
      if (listed.includes(id)) continue
      if (!(await sessionGone($, id))) continue
      if (await emptyPublished($, id)) await debug($, `task-tree: arquivo publicado de ${id} esvaziado (sessão não existe mais no app)`)
    }
  } catch (err) {
    await debug($, `task-tree: limpeza dos arquivos publicados falhou: ${String(err)}`)
  }
}
