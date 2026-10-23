// The sessions this one opened, as the hooks keep them: the list and the files read again
// (refreshChildren, with the steps of ../io/host), the messages received and the sends watched, the
// reminders for the main loop (a session that ended its turn, a message taken up), the record of a
// start_session, the pane's clock and the poll. Nothing here registers a hook.

import { update } from 'claude-code'

import type { Child, Group, Published, Send } from '../types'
import { SESSION } from '../text/rules'
import { MAIN, flat, running } from '../draw/layout'
import { readPublished } from '../io/publish'
import { deriveChildren, listSessions, mineOf, readFiles } from '../io/host'
import { edit, fillStarts, finish, settle } from '../state/tasks'
import { change, inDesktopApp, keptLink, openList, publishPanel, selfId, sendAnchor, showStatus, stamp } from './panel'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const childrenErrorState = { plugin: 'task-tree', key: 'childrenError' } as const
const endedState = { plugin: 'task-tree', key: 'ended' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const receivedState = { plugin: 'task-tree', key: 'received' } as const

// The sessions this one opened, read in the four steps of io/host.ts: the host's list, their
// published files, the children derived from both, and this session's own publication. The state
// calls stay here (the kit wants the state keys literal in the hooks module).
// When the list was last read (clock ms), by the 10 s poll or otherwise.
export let refreshedAt: number | undefined
export async function refreshChildren($: any) {
  refreshedAt = (await stamp($)) ?? refreshedAt
  // 1. The list. A failure is shown in the panel, else the sessions would silently drop out;
  // outside the desktop app there are no sessions to show, so no line either.
  const listed = await listSessions($)
  // The error line is written only when it changes (every poll cleared it before).
  const { value: shownError = '' } = await $.state.get(childrenErrorState)
  if ('error' in listed) {
    const error = (await inDesktopApp($)) ? listed.error : ''
    if (error !== shownError) await $.state.set(childrenErrorState, error)
    return
  }
  if (shownError !== '') await $.state.set(childrenErrorState, '')
  const rows = listed.rows
  if (!Array.isArray(rows)) return
  // Messages queued to any session (its children, its mother, its sisters): before the returns below.
  await watchSends($, rows)
  // No linked session at all: this one opened none (the state is cleared once, not every poll).
  if (rows.length === 0) {
    const { value: cur } = await $.state.get(childrenState)
    if ((cur ?? []).length > 0) await $.state.set(childrenState, [])
    return
  }
  const mine = mineOf(rows)
  if (mine === undefined) return
  // 2. Their files.
  const read = await readFiles($, mine)
  // 3. The children, and the sessions whose turn just ended: the main loop is reminded of the task
  // it opened them on (see endedNote). The state is written only when the children changed: a poll
  // with nothing new (the usual one, every 3 s) derives the same list, and a write of it would cost
  // the whole value crossing to the host (220 KB in the real case) and a redraw.
  const { value: cur } = await $.state.get(childrenState)
  const derived = deriveChildren(mine, cur ?? [], read, keptLink)
  const ended = derived.ended
  if (JSON.stringify(derived.children) !== JSON.stringify(cur ?? [])) await $.state.set(childrenState, derived.children)
  if (ended.length > 0) await update($, endedState, cur => [...(cur ?? []).filter(id => !ended.includes(id)), ...ended])
  // 4. The sessions' tasks are in this session's count, and in what it publishes to the one that
  // opened it.
  const { value: groups = [] } = await $.state.get(groupsState)
  await showStatus($, groups)
  if (mine.length > 0) await publishPanel($)
  await keepTime($)
}

// The messages of other sessions in a prompt (`<cross-session-message from="local_…">`), kept with
// when they came (the last 20) and published, for the senders to confirm their queued SendMessage.
export async function noteReceived($: any, text: string) {
  const froms = [...text.matchAll(/<cross-session-message[^>]*\bfrom="(local_[^"]+)"/g)].map(m => m[1] as string)
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
// from the panel while its message was still waiting). A message received is matched once
// (`usedReceipts`, a variable of the module; a reload starts it over). Sessions without `received`
// (earlier versions): a turn of it opened after the send; else seen stopped after the send and
// running again.
const usedReceipts = new Set<string>()
export async function watchSends($: any, rows: any[]) {
  const { value: sends = [] } = await $.state.get(sendsState)
  if ((sends as Send[]).every(s => s.taken)) return
  const me = await selfId($)
  const files: Record<string, Published> = {}
  const fileOf = async (id: string): Promise<Published> => {
    if (!(id in files)) files[id] = (await readPublished($, id)) ?? { waiting: false, waits: [], children: [] }
    return files[id]
  }
  const marks: Record<number, Partial<Send>> = {}
  // The sends still waiting, by the session they went to.
  const waiting = new Map<string, { i: number; s: Send; r: any }[]>()
  for (const [i, s] of (sends as Send[]).entries()) {
    if (s.taken) continue
    const r = rows.find(r => r.sessionId === s.to || (r.name && r.name === s.to))
    const id = r?.sessionId ?? (String(s.to).startsWith('local_') ? s.to : undefined)
    if (id === undefined) continue
    waiting.set(id, [...(waiting.get(id) ?? []), { i, s, r }])
  }
  for (const [id, list] of waiting) {
    const file = await fileOf(id)
    if (Array.isArray(file.received)) {
      const got = file.received
        .filter((x: any) => x?.from === me && typeof x?.at === 'number' && !usedReceipts.has(`${id}|${x.at}`))
        .map((x: any) => x.at as number)
        .sort((a: number, b: number) => a - b)
      let j = 0
      for (const { i, s } of [...list].sort((a, b) => (a.s.at ?? 0) - (b.s.at ?? 0))) {
        const since = s.at ?? 0
        while (j < got.length && got[j] < since) j++
        if (j >= got.length) break
        marks[i] = { taken: true }
        usedReceipts.add(`${id}|${got[j]}`)
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
  if (Object.keys(marks).length === 0) return
  await update($, sendsState, cur => (cur ?? []).map((s, i) => (marks[i] ? { ...s, ...marks[i] } : s)))
  // Taken up: the task it was sent from is done, closed here with no turn of this session (it may
  // have stopped waiting for it), so its card in the mother's pane is not left parked.
  const anchors = (sends as Send[]).flatMap((s, i) => (marks[i]?.taken && s.anchor ? [s.anchor] : []))
  if (anchors.length === 0) return
  const now = await stamp($)
  await change($, all =>
    all.map(g => {
      if (g.agent !== MAIN) return g
      let tasks = g.tasks
      for (const id of anchors) {
        const t = flat(tasks).find(t => t.id === id)
        if (t && t.status === 'open' && !t.children.some(c => c.status === 'open')) tasks = settle(edit(fillStarts(tasks, id, now), id, finish(now)), now)
      }
      return { ...g, tasks }
    }),
  )
}
// Once: the sessions that took up a queued message, with the task it was sent from.
export async function takenNote($: any): Promise<string | undefined> {
  const { value: sends = [] } = await $.state.get(sendsState)
  const done = (sends as Send[]).filter(s => s.taken)
  if (done.length === 0) return undefined
  await $.state.set(sendsState, (sends as Send[]).filter(s => !s.taken))
  // A delivery at once needs no reminder: the model saw it delivered.
  const taken = done.filter(s => !s.delivered)
  if (taken.length === 0) return undefined
  const { value: groups = [] } = await $.state.get(groupsState)
  const all = flat((groups as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
  const what = taken.map(s => {
    const t = all.find(t => t.id === s.anchor)
    return `${s.to}${t ? ` (tarefa do envio "${t.id}" ${t.title})` : ''}`
  })
  return SESSION.taken(what)
}

// The list read again when it is older than the poll's period: a session drawn at work after
// it stopped keeps the tasks it was opened on in progress. Only after a first read (session.start).
export async function refreshStale($: any) {
  const now = await stamp($)
  if (refreshedAt === undefined || now === undefined || now - refreshedAt < POLL) return
  await refreshChildren($)
}

// A start_session call records the task the main loop is on, under the id its result names.
export async function recordStart($: any, resultText: string) {
  const id = /local_[0-9a-f-]{36}/.exec(resultText)?.[0]
  if (!id) return
  const { value = [] } = await $.state.get(groupsState)
  // The task the session is opened on: the one in progress, else as a message is anchored (sendAnchor).
  const anchor = sendAnchor((value as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
  await update($, childrenState, cur => {
    const list = cur ?? []
    if (list.some(c => c.id === id)) return list.map(c => (c.id === id ? { ...c, anchor: c.anchor ?? anchor } : c))
    return [...list, { id, name: '', title: 'Sessão iniciando…', running: true, archived: false, starting: true, anchor: anchor ?? keptLink(id)?.anchor }]
  })
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
  const lines = (kids as Child[])
    .filter(c => ids.includes(c.id))
    .map(c => ({ c, t: open.find(t => t.id === c.anchor) }))
    .filter(x => x.t !== undefined)
    .map(x => `"${x.c.name || x.c.title}" (tarefa de origem "${x.t?.id}" ${x.t?.title})`)
  if (lines.length === 0) return undefined
  return SESSION.ended(lines, openList(tasks))
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
  // With this session's turn ended, its own tasks run no clock (see turnEnded).
  const { value: ended } = await $.state.get(turnEndedState)
  return running({ groups: typeof ended === 'number' ? [] : groups, waits: [], children })
}
export async function tick($: any) {
  if (await anyRunning($)) {
    try {
      $.ui.invalidate('ui.render')
    } catch {}
    return
  }
  ticker?.cancel()
  ticker = undefined
}
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
