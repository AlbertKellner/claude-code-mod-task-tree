// The panel's lines (Row[]) from its model: the pure half of the drawing. layout() turns the
// state read once (groups, waits, the sessions this one opened, the sends still queued, the view
// and the current work), the lines the person folded and the clock into the rows the desktop and
// the terminal then draw; nothing here reads the state or the host. With it the model's helpers
// (counts, times, sessions' cards split by message, the current work's cut) that the hooks module
// uses too, imported from here.
// Nothing is read behind the arguments' back: the clock is `now`, passed down to split; the cache of
// the sessions' breaks is a BreaksMemo made by layout() for one drawing and passed down; the sends
// still queued reach the task lines as `pending`, from the panel that holds them.

import type { Child, Group, Panel, Send, TaskNode, Turn, Wait } from '../types'
import { PAD } from './geometry'

// The main loop's agent id in the groups.
export const MAIN = ''

export const flat = (list: TaskNode[]): TaskNode[] => list.flatMap(t => [t, ...flat(t.children)])
export const tasksOf = (groups: Group[]) => groups.flatMap(g => g.tasks)
export const hasOpen = (list: TaskNode[]) => flat(list).some(t => t.status === 'open')
export const withMain = (groups: Group[]): Group[] =>
  groups.some(g => g.agent === MAIN) ? groups : [{ agent: MAIN, label: '', tasks: [] }, ...groups]

// A task's clock stops when it closes (`now` is undefined where the time cannot be read).
export const stop = (t: TaskNode, now?: number) => (t.startedAt !== undefined ? (t.endedAt ?? now) : t.endedAt)

// What a subagent left open when it ended.
export const interrupt =
  (now?: number) =>
  (t: TaskNode): TaskNode =>
    t.status === 'open'
      ? { ...t, status: 'interrupted', started: undefined, endedAt: stop(t, now), children: t.children.map(interrupt(now)) }
      : t

// A task whose clock runs: started and not closed.
export const timing = (list: TaskNode[]) => flat(list).some(t => t.status === 'open' && t.startedAt !== undefined && t.endedAt === undefined)
// From the first start to the last close, or to now while any task runs; undefined when no
// task was started (or the time is unknown).
export function span(list: TaskNode[], now?: number): number | undefined {
  const all = flat(list).filter(t => t.startedAt !== undefined)
  if (all.length === 0) return undefined
  const from = Math.min(...all.map(t => t.startedAt as number))
  const to = timing(list) ? now : Math.max(...all.map(t => t.endedAt ?? 0))
  return to === undefined || to < from ? undefined : to - from
}
export const elapsed = (t: TaskNode, now?: number) => {
  if (t.startedAt === undefined || t.status === 'interrupted') return undefined
  const to = t.endedAt ?? (t.status === 'open' ? now : undefined)
  return to === undefined || to < t.startedAt ? undefined : to - t.startedAt
}

// Leaves done, leaves counted, leaves interrupted (kept out of the count).
export function count(list: TaskNode[]): [number, number, number] {
  let d = 0
  let n = 0
  let x = 0
  for (const t of flat(list)) {
    if (t.children.length > 0) continue
    if (t.status === 'interrupted') x++
    else {
      n++
      if (t.status === 'done') d++
    }
  }
  return [d, n, x]
}

// How deep the sessions opened by opened sessions are followed (in the count and the drawing).
export const DEEP = 3
// A session still at work: running, or waiting on the person.
export const live = (c: Child) => !c.archived && (c.running || c.waiting === true)
// A session's panel; earlier versions published only its main group's tasks. An archived session
// stays in the tree as history (its last published panel): what it left open will not be done,
// so it reads as interrupted (out of the count's total, drawn gray).
export const panelOf = (c: Child): Panel => {
  const p = c.panel ?? { groups: [{ agent: MAIN, label: '', tasks: c.tasks ?? [] }], waits: [], children: [] }
  if (!c.archived) return p
  return { ...p, waits: [], groups: (p.groups ?? []).map(g => ({ ...g, tasks: g.tasks.map(interrupt(undefined)) })) }
}
// A session in one card per message the main loop sent it (`rounds`): the card of a message holds
// the turns the session opened after it (its tasks in plan order, the subagents, notices and
// sessions under them) and goes under the task the message was sent from; the first card, the
// turns from before any message, stays where the session was opened. A message not taken up yet
// opened no turn, so it has no card (its task shows the queued envelope meanwhile). The card with
// the session's work in progress (else the last) waits and shows its context; while the session
// runs, every card with open tasks is drawn at work.
// The messages that opened a round of `c`: those `me` (the session drawing it) sent, with the task
// they were sent from, and those a sister session sent (its published `received`), drawn under
// the task the sister's own card was under when it sent (followed down a chain of sisters).
// `peer`: a sister's message; `known`: its origin was found (else drawn only after a while, see split);
// `from` and `task`: the sister and her task that sent it, where its card goes (see nest).
export type Break = { at: number; anchor?: string; peer?: boolean; known?: boolean; orphan?: boolean; from?: string; task?: string }
// The messages `me` sent this session with no round recorded (the send was not seen: the panel
// was off, or the mod reloaded or crashed then): each one the session took up (its published
// `received`), matched in order against the rounds, opens a round all the same, or its turns would
// join the round before it, under a task of an earlier request, drawn above requests between them
// (the person's words: "layout quebrou novamente"). Its task is the main task of `me` that was open
// when the message came (the one that sent it, waiting on it); with none, no task: the card goes
// to the end of the panel, never between other requests.
export function unsent(c: Child, me: string | undefined, owner: TaskNode[]): Break[] {
  const rounds = [...(c.rounds ?? [])].sort((a, b) => a.at - b.at)
  if (me === undefined || rounds.length === 0) return []
  const got = (c.panel?.received ?? [])
    .filter(x => x.from === me && typeof x.at === 'number' && x.at > rounds[0].at)
    .map(x => x.at as number)
    .sort((a, b) => a - b)
  const out: Break[] = []
  let i = 0
  for (const at of got) {
    // The earliest round not matched yet, sent before the message came: that send's message.
    if (i < rounds.length && rounds[i].at <= at) {
      i++
      continue
    }
    const open = flat(owner)
      .filter(t => typeof t.startedAt === 'number' && t.startedAt <= at && (t.endedAt === undefined || t.endedAt >= at))
      .sort((a, b) => (b.startedAt as number) - (a.startedAt as number))[0]
    out.push({ at, anchor: open?.id, orphan: true })
  }
  return out
}

// The task an anchor names, as of a moment: the plans reuse level-1 ids between requests, and a
// closed task whose id a new plan takes is renamed (`tag:id`, see planTool), so a tie recorded before
// the rename (a published file from an earlier version, a store from before this rule) still holds
// the bare id, which now names the new task. Only that case is touched: when the task holding the
// id was planned after the moment and a renamed one (`*:id`) planned before it exists, the anchor
// is the last of those planned before the moment (the one that held the id then). Everything else
// (the id's task planned before the moment, no plan times, no renamed holder) stays as it is.
export function resolveAnchor(owner: TaskNode[], anchor: string | undefined, at: number | undefined): string | undefined {
  if (anchor === undefined || at === undefined) return anchor
  const all = flat(owner)
  const exact = all.find(t => t.id === anchor)
  if (exact === undefined || exact.plannedAt === undefined || exact.plannedAt <= at) return anchor
  const suffix = ':' + anchor
  const held = all
    .filter(t => t.id.endsWith(suffix) && t.id.length > suffix.length && !t.id.slice(0, -suffix.length).includes(':') && t.plannedAt !== undefined && t.plannedAt <= at)
    .sort((a, b) => (a.plannedAt as number) - (b.plannedAt as number))
  const last = held[held.length - 1]
  return last?.id ?? anchor
}

// Each session's breaks once per list of sisters (one drawing): the chain follows a sister's own
// breaks for every message it sent, and sisters message each other in a ring (implementation →
// docs → SVG → governance → implementation). Recomputed per message, with up to 20 kept each, that
// was 20^5 calls per card on every redraw, and it crashed the hooks worker. A session met again
// inside its own chain counts with its own rounds only.
// The cache lives for one drawing (layout() makes it and passes it down): `hits` by an explicit key,
// the list of sisters (numbered as met, `lists`), the drawing session, the path and the card.
export type BreaksMemo = { lists: WeakMap<Child[], number>; next: number; hits: Map<string, Break[]> }
export const newBreaksMemo = (): BreaksMemo => ({ lists: new WeakMap(), next: 0, hits: new Map() })
export function breaks(c: Child, sisters: Child[], me: string | undefined, seen: string[], owner: TaskNode[], memo: BreaksMemo): Break[] {
  let list = memo.lists.get(sisters)
  if (list === undefined) memo.lists.set(sisters, (list = memo.next++))
  // The path is in the key: a session met again inside its chain is cut there, and only there.
  const key = `${list}|${me ?? ''}|${seen.join(',')}|${c.id}|${c.part ?? ''}`
  const hit = memo.hits.get(key)
  if (hit !== undefined) return hit
  const own: Break[] = [...(c.rounds ?? []).map(r => ({ at: r.at, anchor: resolveAnchor(owner, r.anchor, r.at) })), ...unsent(c, me, owner)]
  if (seen.includes(c.id) || seen.length > 4) return own
  const path = [...seen, c.id]
  const sisterBreaks = new Map<string, Break[]>()
  const peer: Break[] = (c.panel?.received ?? []).flatMap(x => {
          const from = sisters.find(k => k.id === x.from && k.id !== c.id)
          if (from === undefined || x.from === me || typeof x.at !== 'number') return []
          // The sister sent it in one of its turns: the message belongs to that turn's round (the one
          // the turn opened after), not to the last round before it arrived, which may be a later
          // message the sister had not taken up yet.
          let fb = sisterBreaks.get(from.id)
          if (fb === undefined) sisterBreaks.set(from.id, (fb = breaks(from, sisters, me, path, owner, memo)))
          const fmain = withMain(from.panel?.groups ?? []).find(g => g.agent === MAIN)
          const fturns = fmain?.turns ?? []
          // First, the sister's own sending task, while its ✉ is up (its published `sends`): the turn
          // that task was planned in. Else the sister's last turn before the message came.
          const out = (from.panel?.sends ?? []).filter(s => (s.to === c.id || (c.name !== '' && s.to === c.name)) && (s.at ?? 0) <= x.at).pop()
          const task = out?.anchor ? fmain?.tasks.find(t => flat([t]).some(k => k.id === out.anchor)) : undefined
          const viaSend = task?.turn !== undefined ? fturns.find(u => u.id === task.turn)?.at : undefined
          const sent = fturns.filter(u => typeof u.at === 'number' && (u.at as number) <= x.at).pop()
          const when = viaSend ?? sent?.at
          const before = when === undefined ? [] : fb.filter(b => b.at <= when)
          const last = before[before.length - 1]
          // The sister's task that sent it: her sending task, else the one in progress when it came,
          // else the last one she started before it.
          const started = flat(fmain?.tasks ?? [])
            .filter(k => typeof k.startedAt === 'number' && (k.startedAt as number) <= (x.at as number))
            .sort((a, b) => (b.startedAt as number) - (a.startedAt as number))
          const sender = out?.anchor ?? (started.find(k => k.endedAt === undefined || k.endedAt >= (x.at as number)) ?? started[0])?.id
          return [{ at: x.at, anchor: last ? last.anchor : resolveAnchor(owner, from.anchor, begins(from)), peer: true, known: when !== undefined && (last !== undefined || from.anchor !== undefined), from: from.id, ...(sender !== undefined ? { task: sender } : {}) }]
        })
  const out = [...own, ...peer].sort((a, b) => a.at - b.at)
  memo.hits.set(key, out)
  return out
}

// When a card's work began: its first turn (the message it was opened or sent with), else its
// first planned or started task. Cards under one task are drawn in this order, the order the work
// ran in (implementation, then the sessions it passed it on to), not grouped by session.
export function begins(c: Child): number {
  const p = panelOf(c)
  const main = withMain(p.groups ?? []).find(g => g.agent === MAIN)
  const ats = [
    ...(main?.turns ?? []).flatMap(u => (typeof u.at === 'number' ? [u.at] : [])),
    ...flat(tasksOf(p.groups ?? [])).flatMap(t => [t.plannedAt, t.startedAt].filter((x): x is number => typeof x === 'number')),
  ]
  return ats.length > 0 ? Math.min(...ats) : Infinity
}
export const inOrder = (list: Child[]) =>
  list
    .map((c, i) => ({ c, i, at: begins(c) }))
    .sort((a, b) => (a.at === b.at ? a.i - b.i : a.at - b.at))
    .map(x => x.c)

// While a sister's message has no known origin yet (the sister's state not read yet), its card is
// not drawn, for up to WAIT_ORIGIN ms: it would show at the root and jump into place on the next read.
export const WAIT_ORIGIN = 10000
// `now`: the drawing's clock (undefined where it cannot be read); `memo`: the drawing's cache of breaks.
export function split(c0: Child, sisters: Child[], me: string | undefined, owner: TaskNode[], now: number | undefined, memo: BreaksMemo): Child[] {
  // A card already cut to one round (the summary view's cut() splits the sessions before the pass
  // that draws them) is kept as it is, with no breaks computed for it.
  if (c0.part !== undefined) return [c0]
  // The session's ties, as of when they were made: where it was opened (by when its work began)
  // and where its last message came from (by that message), see resolveAnchor.
  const lastRound = [...(c0.rounds ?? [])].sort((a, b) => a.at - b.at).pop()
  const opened = begins(c0)
  const c: Child = {
    ...c0,
    anchor: resolveAnchor(owner, c0.anchor, Number.isFinite(opened) ? opened : undefined),
    lastAnchor: resolveAnchor(owner, c0.lastAnchor, lastRound?.at ?? (Number.isFinite(opened) ? opened : undefined)),
  }
  const rounds = breaks(c, sisters, me, [], owner, memo)
  const p = c.panel
  if (rounds.length === 0 || p === undefined) return [c]
  const groups = withMain(p.groups ?? [])
  const main = groups.find(g => g.agent === MAIN) as Group
  const turns = main.turns ?? []
  const roundOf = (u: Turn) => rounds.reduce((k, r, i) => (u.at !== undefined && u.at >= r.at ? i + 1 : k), 0)
  // The part (round) of each turn, once per turn; a task with no turn, or with a turn not listed, is
  // in part 0 (the card before the first round), as before.
  const partOfTurn = new Map<number, number>()
  // Messages of `me` queued while the session worked are delivered together and open one turn: that
  // turn goes to the round of the first of them, the order the work ran in (it went to the last one,
  // and the first message's task had no card). A turn that got messages of `me` (its published
  // `received` has some since the turn before) takes the first round of `me` sent since the turn
  // before; any other turn (opened by a sister, or older than what `received` keeps) goes to the last
  // round before it, as before.
  const got = (p.received ?? []).filter(x => x.from === me && typeof x.at === 'number').map(x => x.at as number)
  let before = -Infinity
  for (const u of [...turns].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))) {
    if (partOfTurn.has(u.id)) continue
    let k = roundOf(u)
    if (u.at !== undefined && got.some(x => x > before && x <= (u.at as number))) {
      const first = rounds.findIndex(r => !r.peer && r.at > before && r.at <= (u.at as number))
      if (first >= 0) k = first + 1
    }
    partOfTurn.set(u.id, k)
    if (u.at !== undefined) before = u.at
  }
  const turnPart = (id?: number) => (id === undefined ? 0 : (partOfTurn.get(id) ?? 0))
  // The level-1 tasks of each part, in the list's order, and all the tasks under them (flat), once.
  const tasksByPart = new Map<number, TaskNode[]>()
  for (const t of main.tasks) {
    const k = turnPart(t.turn)
    const list = tasksByPart.get(k)
    if (list) list.push(t)
    else tasksByPart.set(k, [t])
  }
  const parts = [...tasksByPart.keys()].sort((a, b) => a - b)
  if (parts.length < 2 && (parts[0] ?? 0) === 0) return [c]
  const tasksIn = (k: number) => tasksByPart.get(k) ?? []
  const flatIn = new Map(parts.map(k => [k, flat(tasksIn(k))] as const))
  const busy = parts.find(k => (flatIn.get(k) ?? []).some(t => t.status === 'open' && t.started !== undefined))
  const lead = busy ?? parts[parts.length - 1]
  // What hangs from a task goes to that task's card (the first part holding the task, in part order,
  // as the search was); with no such task, to the leading card.
  const partOfTask = new Map<string, number>()
  for (const k of parts) for (const t of flatIn.get(k) ?? []) if (!partOfTask.has(t.id)) partOfTask.set(t.id, k)
  const holder = (anchor?: string) => (anchor === undefined ? lead : (partOfTask.get(anchor) ?? lead))
  // The part a group's or a wait's agent belongs to, once per agent (the main group's anchor is the
  // task in progress, found once).
  const owners = new Map<string, number>()
  const ownerOf = (agent: string) => {
    let k = owners.get(agent)
    if (k === undefined) {
      k = agent === MAIN ? holder(current(main.tasks).anchor) : holder(groups.find(g => g.agent === agent)?.anchor)
      owners.set(agent, k)
    }
    return k
  }
  const waiting = (k: number) => {
    const b = k > 0 ? rounds[k - 1] : undefined
    return b?.peer === true && !b.known && now !== undefined && now - b.at < WAIT_ORIGIN
  }
  return parts.filter(k => !waiting(k)).map(k => {
    const tasks = tasksIn(k)
    const ids = new Set(tasks.map(t => t.id))
    const turnsOf = new Set(tasks.map(t => t.turn))
    const at = k === lead
    return {
      ...c,
      part: k,
      ...(k > 0 && rounds[k - 1] !== undefined ? { partAt: rounds[k - 1].at } : {}),
      // A sister's message: the card goes inside hers, under the task that sent it (see nest).
      ...(k > 0 && rounds[k - 1]?.peer && rounds[k - 1]?.from !== undefined && rounds[k - 1]?.task !== undefined
        ? { via: { from: rounds[k - 1].from as string, task: rounds[k - 1].task as string } }
        : {}),
      anchor: k === 0 ? c.anchor : rounds[k - 1]?.orphan || rounds[k - 1]?.peer ? rounds[k - 1]?.anchor : (rounds[k - 1]?.anchor ?? c.anchor),
      lastAnchor: at ? c.lastAnchor : undefined,
      // A card with open tasks of a session at work is at work too (the new group waits its turn).
      running: c.running && (at || hasOpen(tasks)),
      waiting: at ? c.waiting : false,
      // Every card shows the session's ring, at work or not: its last reported share (the person's words:
      // "mesmo depois que a sessao termina, o icone se contexto precisa continuar aparecendo").
      context: c.context,
      tasks: undefined,
      panel: {
        ...p,
        groups: groups
          .map(g => (g.agent === MAIN ? { ...g, tasks, turns: turns.filter(u => turnsOf.has(u.id)) } : g))
          .filter(g => g.agent === MAIN || ownerOf(g.agent) === k),
        waits: (p.waits ?? []).filter(w => ownerOf(w.agent) === k),
        children: (p.children ?? []).filter(s => holder(s.anchor) === k),
        ...(p.work ? { work: p.work.filter(id => ids.has(id)) } : {}),
      },
    }
  })
}

// The cards of one list (a panel's sessions, cut in cards by split): the card of a message a sister
// sent goes inside the sister's card that holds the task that sent it, as a session opened on that
// task (the person: under the mother's task only the cards of the messages she sent; a message a
// sister S sends C is in S's card, under the task of S that sent it). With no such card in the list
// (the task not found, or the move would make a loop), it stays where split put it.
export function nest(list: Child[]): Child[] {
  const hosts = new Map<Child, Child>()
  for (const c of list) {
    const via = c.via
    if (via === undefined) continue
    const host = list.find(k => k !== c && k.id === via.from && flat(tasksOf((k.panel ?? panelOf(k)).groups ?? [])).some(t => t.id === via.task))
    if (host !== undefined) hosts.set(c, host)
  }
  for (const c of [...hosts.keys()]) {
    const seen = new Set<Child>([c])
    let h = hosts.get(c)
    while (h !== undefined && !seen.has(h)) {
      seen.add(h)
      h = hosts.get(h)
    }
    if (h !== undefined) hosts.delete(c)
  }
  if (hosts.size === 0) return list
  const build = (c: Child): Child => {
    const inner = [...hosts].filter(([, h]) => h === c).map(([k]) => ({ ...build(k), anchor: k.via?.task }))
    if (inner.length === 0) return c
    const p = c.panel ?? panelOf(c)
    return { ...c, panel: { ...p, children: [...(p.children ?? []), ...inner] } }
  }
  return list.filter(c => !hosts.has(c)).map(build)
}

// A session at work, or one at work inside its card (a sister's card nested in it, see nest), as deep
// as the drawing follows them.
export const alive = (c: Child, level = 0): boolean =>
  live(c) || (level < DEEP && (c.panel?.children ?? []).some(k => alive(k, level + 1)))

// The count of a panel with its sessions' tasks: they are part of the tree, under the task
// they were opened on (an archived one too, as history).
export function total(p: Panel, level = 0): [number, number, number] {
  let [d, n, x] = count(tasksOf(p.groups ?? []))
  if (level >= DEEP) return [d, n, x]
  for (const c of p.children ?? []) {
    const [cd, cn, cx] = total(panelOf(c), level + 1)
    d += cd
    n += cn
    x += cx
  }
  return [d, n, x]
}

// The sessions opened on a task or below it (archived ones as history): their tasks add to its count and
// its time, and while one is still at work the task is drawn in progress, its clock running,
// whatever its own status says. A task closed with done is done: the sessions opened on it or on a
// task inside it add nothing and keep nothing in progress (their progress stays in their cards; it was
// drawn ◉ "45/46" after the done); `any` still marks the ⑂, `live` that one is still at work there, and
// `cards` holds all their tasks, for a folded line (it stands for what is drawn below it, the cards too).
// `Ring`: a session's share of its context used (see contextRing), on its card's label.
// `faded`: an archived session's last share, drawn dim.
export type Ring = { percent: number; name: string; faded?: boolean }
export const ringOf = (c: Child): Ring | undefined =>
  typeof c.context === 'number' ? { percent: c.context, name: c.name || c.title, ...(c.archived ? { faded: true } : {}) } : undefined
export type Work = { busy: boolean; any: boolean; live: boolean; d: number; n: number; tasks: TaskNode[]; cards: TaskNode[] }
export const idle: Work = { busy: false, any: false, live: false, d: 0, n: 0, tasks: [], cards: [] }
// A panel's tasks with its sessions' (archived ones too), as deep as the count follows them.
export function allTasks(p: Panel, level: number): TaskNode[] {
  const own = tasksOf(p.groups ?? [])
  if (level >= DEEP) return own
  return own.concat(...(p.children ?? []).map(c => allTasks(panelOf(c), level + 1)))
}
export function atWork(t: TaskNode, sessions: Child[], level: number): Work {
  const ids = flat([t]).map(k => k.id)
  const below = sessions.filter(c => c.anchor !== undefined && ids.includes(c.anchor))
  const open = (k: TaskNode): string[] => (k.status === 'done' ? [] : [k.id, ...k.children.flatMap(open)])
  const counted = open(t)
  const mine = below.filter(c => counted.includes(c.anchor as string))
  let d = 0
  let n = 0
  for (const c of mine) {
    const [cd, cn] = total(panelOf(c), level + 1)
    d += cd
    n += cn
  }
  const tasks = mine.flatMap(c => allTasks(panelOf(c), level + 1))
  const cards = below.flatMap(c => allTasks(panelOf(c), level + 1))
  return { busy: mine.some(c => alive(c, level + 1)), any: below.length > 0, live: below.some(c => alive(c, level + 1)), d, n, tasks, cards }
}
// An open parent with something done below it and nothing in progress: drawn waiting (◷), its
// time stopped at the last close below it.
export const resting = (list: TaskNode[]) => flat(list).some(k => k.status === 'done')
export function stillSpan(list: TaskNode[]): number | undefined {
  const all = flat(list)
  const starts = all.flatMap(t => (t.startedAt ?? t.plannedAt) ?? [])
  const ends = all.flatMap(t => t.endedAt ?? [])
  if (starts.length === 0 || ends.length === 0) return undefined
  const span = Math.max(...ends) - Math.min(...starts)
  return span < 0 ? undefined : span
}

// A task's time: from the first start to the last close of it, its subtasks and its sessions'
// tasks, or to now while any of them runs or a session below it is at work.
export function timeOf(t: TaskNode, w: Work, now?: number): number | undefined {
  return timeSpan([t, ...w.tasks], w.busy, now)
}
export function timeSpan(list: TaskNode[], busy: boolean, now?: number): number | undefined {
  if (!busy) return span(list, now)
  const starts = flat(list).flatMap(k => (k.startedAt === undefined ? [] : [k.startedAt]))
  return starts.length === 0 || now === undefined ? undefined : now - Math.min(...starts)
}

// Every open task with no subtasks (◉ or ○ leaves), in every group of the panel and in its
// sessions not archived (as deep as the count goes), so it is M − N of the "N de M" (interrupted
// ones are out of both); none means nothing is open (nothingOpen). The ones waiting on a session (`sent`, main group
// here) have their own chip and are left out of this one.
export function activeLeaves(p: Panel, level: number, sent: string[] = []): number {
  let k = 0
  for (const g of withMain(p.groups ?? [])) {
    k += flat(g.tasks).filter(
      t => t.status === 'open' && t.children.length === 0 && !(g.agent === MAIN && sent.includes(t.id)),
    ).length
  }
  if (level >= DEEP) return k
  for (const c of p.children ?? []) if (!c.archived) k += activeLeaves(panelOf(c), level + 1)
  return k
}

// A whole session's time: starts are a task's start, else its plan.
export function sessionTime(list: TaskNode[], running: boolean, now?: number): number | undefined {
  const all = flat(list)
  const starts = all.flatMap(t => (t.startedAt ?? t.plannedAt) ?? [])
  if (starts.length === 0) return undefined
  const from = Math.min(...starts)
  const ends = all.flatMap(t => t.endedAt ?? [])
  const to = running ? now : ends.length > 0 ? Math.max(...ends) : undefined
  return to === undefined || to < from ? undefined : to - from
}

export function firstOpen(items: TaskNode[]): string[] {
  for (const t of items) {
    if (t.status !== 'open') continue
    if (t.children.length === 0) return [t.id]
    const rest = firstOpen(t.children)
    if (rest.length > 0) return [t.id, ...rest]
  }
  return []
}
export function pathTo(items: TaskNode[], id: string): string[] {
  for (const t of items) {
    if (t.id === id) return [t.id]
    const rest = pathTo(t.children, id)
    if (rest.length > 0) return [t.id, ...rest]
  }
  return []
}

// The tasks drawn in yellow, with their parents, and the one a waiting notice goes
// under: the tasks in progress (the last one started for the notice; a parent's first
// open task); with none, the first open task.
export function current(list: TaskNode[]): { lit: string[]; anchor?: string } {
  const started = flat(list)
    .filter(t => t.status === 'open' && t.started !== undefined)
    .sort((a, b) => (a.started ?? 0) - (b.started ?? 0))
  if (started.length === 0) {
    const path = firstOpen(list)
    return { lit: path, anchor: path[path.length - 1] }
  }
  let lit: string[] = []
  let anchor: string | undefined
  for (const s of started) {
    const inner = firstOpen(s.children)
    lit = lit.concat(pathTo(list, s.id), inner)
    anchor = inner.length > 0 ? inner[inner.length - 1] : s.id
  }
  return { lit, anchor }
}

export const waitText = (w: Wait) =>
  w.kind === 'question'
    ? 'Aguardando sua resposta'
    : w.kind === 'choice'
      ? 'Aguardando sua escolha'
      : w.kind === 'plan'
      ? 'Aguardando aprovação do plano'
      : `Aguardando permissão: ${w.tool}`

// How many requests (message groups) the top panel draws, the latest ones.
export const SHOWN_TURNS = 3
// And in a session's card, the last request of that card (its round).
export const SHOWN_CARD_TURNS = 3

// The most lines a drawing holds, decided on the rows before any SVG is made: past it, whole blocks
// (a level-0 line and what hangs under it) go from the start, the oldest, and one line counts them;
// the recent ones, where the work is, stay. The size limit above stays as the last resort. Far
// above a real panel (a long session drew 31 lines); the open steps of a huge plan reached it.
export const MAX_ROWS = 400
export function limitRows(rows: Row[]): Row[] {
  if (rows.length <= MAX_ROWS) return rows
  const room = MAX_ROWS - 1
  const before = (n: number): Row => ({ depth: 0, tone: 'section', title: `+${n} linhas anteriores`, label: 'Linhas anteriores, não desenhadas' })
  const from = rows.findIndex((r, i) => r.depth === 0 && i > 0 && rows.length - i <= room)
  if (from > 0) return [before(from), ...rows.slice(from)]
  // The last block alone is past the limit: what came before it goes whole, and the block is drawn
  // to the limit, the rest counted at its end.
  let last = 0
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i].depth === 0) {
      last = i
      break
    }
  }
  const head = last > 0 ? [before(last)] : []
  const kept = rows.slice(last, last + room - head.length)
  return [...head, ...kept, { depth: 1, tone: 'section', title: `+${rows.length - last - kept.length} linhas`, label: 'Linhas seguintes, não desenhadas' }]
}

// A session's panel cut to its current work, for the summary view: its main level-1 tasks of the
// work (all those of the turns they are in), the subagents and sessions under them or still at
// work, and the same cut on those sessions. With no work published (earlier versions), the last
// turn that has tasks; with no turns either, the last open level-1 task, else the last one.
// Of the current work (`ids`, level-1 tasks of the main group), the ones still going on: something
// open below them. A new request keeps these and drops the requests all done. A session still at
// work under a done task does not keep the task: the summary draws a live session with no task in
// the work at the end of the list (trimToWork), as the person asked before.
export function goingOn(p: Panel, ids: string[]): string[] {
  const main = withMain(p.groups ?? []).find(g => g.agent === MAIN)
  return (main?.tasks ?? []).filter(t => ids.includes(t.id) && hasOpen([t])).map(t => t.id)
}

export function trimToWork(p: Panel, level: number): Panel {
  const groups = withMain(p.groups ?? [])
  const main = groups.find(g => g.agent === MAIN) as Group
  let work = p.work ?? []
  if (work.length === 0) {
    const last = [...(main.turns ?? [])].reverse().find(u => main.tasks.some(t => t.turn === u.id))
    const lone = [...main.tasks].reverse().find(t => t.status === 'open') ?? main.tasks[main.tasks.length - 1]
    work = last ? main.tasks.filter(t => t.turn === last.id).map(t => t.id) : lone ? [lone.id] : []
  }
  // A level-1 task with a session at work under it is still going on: it stays, with its request,
  // and the card stays under it (the person's words: "se existirem tarefas em andamento, essas
  // tarefas devem continuar sendo mostradas").
  const busy = level >= DEEP ? [] : main.tasks.filter(t => atWork(t, p.children ?? [], level).live).map(t => t.id)
  const wanted = [...work, ...busy]
  const turnsIn = main.tasks.filter(t => wanted.includes(t.id)).flatMap(t => (t.turn === undefined ? [] : [t.turn]))
  const keep = main.tasks.filter(t => wanted.includes(t.id) || (t.turn !== undefined && turnsIn.includes(t.turn)))
  const ids = flat(keep).map(t => t.id)
  const under = (anchor?: string) => anchor !== undefined && ids.includes(anchor)
  return {
    ...p,
    groups: groups
      .map(g => (g.agent === MAIN ? { ...g, tasks: keep, turns: (g.turns ?? []).filter(u => keep.some(t => t.turn === u.id)) } : g))
      .filter(g => g.agent === MAIN || under(g.anchor) || hasOpen(g.tasks)),
    children:
      level >= DEEP
        ? (p.children ?? [])
        : (p.children ?? [])
            .filter(c => under(c.anchor) || live(c))
            .map(c => ({ ...c, panel: trimToWork(panelOf(c), level + 1), tasks: undefined })),
  }
}

export function running(p: Panel, level = 0): boolean {
  if (timing(tasksOf(p.groups ?? []))) return true
  // A session at work keeps the task it was opened on running (see atWork).
  return level < DEEP && (p.children ?? []).some(live)
}

// The panel as drawn: one line per task, notice, session or subagent, with its depth in
// the tree. The desktop draws each line as an Svg, the terminal as a Text.
export type Tone = 'open' | 'current' | 'done' | 'interrupted' | 'wait' | 'running' | 'archived' | 'agent' | 'section' | 'sent' | 'paused' | 'reply'
export type Row = {
  depth: number
  tone: Tone
  title: string
  // The whole text for the tooltip, when the title is a short form of it (the ↩ line's summary).
  whole?: string
  // Said only in the alt, after the title: a session's title, its card showing just its name.
  hint?: string
  // What the alt text says first ("Em andamento"); empty for a notice.
  label: string
  strong?: boolean
  // Right-aligned: done/total (with a mini bar on a task: `bar`), a word after it, and the time
  // the task (or the session's, the subagent's tasks) took or is taking, in ms.
  sub?: [number, number]
  bar?: boolean
  meta?: string
  // null: a closed task whose time is unknown (panels of earlier versions), drawn as "—".
  time?: number | null
  // A session's or subagent's header: it and the lines below it are drawn in a card.
  card?: boolean
  // For the header's chips: a task in progress with nothing open below it; a session at work;
  // a session waiting with no notice of its own drawn.
  active?: boolean
  live?: boolean
  pending?: boolean
  // A line with something below it opens and closes (▾/▸): `key` names it in `folds`, `open`
  // says whether what is below is drawn.
  fold?: { key: string; open: boolean }
  // A session's card: its icon is the branch in every state (the tone colors it).
  session?: boolean
  // A task (or turn) with a session opened on it or below it: a small branch beside it,
  // drawn even while the task is closed.
  kids?: boolean
  // The context ring of a session: on its card, and on the highest line above it (its turn, else
  // its level-1 task) with the largest share among the sessions there.
  ring?: Ring
  // A session's card: its id, for the ring's button that opens the session (see ringOver).
  sid?: string
  // The tasks the line stands for in the header's count and time: a leaf's own; a folded line's
  // whole subtree (its sessions' tasks too); none for an open parent (its lines below stand for
  // theirs) or a line that is not a task. The header sums the drawn lines' nodes, so each view's
  // header says what that view shows (the person's words: "cada visao deve refletir os dados do
  // seu tipo de vizualizacao").
  nodes?: TaskNode[]
  // A session's card: its model and effort ("Opus 5.5 · high"), drawn left of the ring.
  engine?: string
}

// With no summary from the session, the ↩ line says only this, the whole answer in its tooltip: the
// answer cut to the line's width summed nothing up (the person's words: "voce esta imprimindo o
// texto integral cortado").
export const REPLY = 'resposta'
// The ↩ line of a turn shows its summary (the done's `summary`); a turn with none has no ↩ line. The
// answer's text is never shown cut (the person: "quero que seja um resumo da resposta, super curto"),
// and the placeholder "resposta" is gone too (the person: the ↩ line only with real text).
export const hasBrief = (u: Turn) => typeof u.brief === 'string' && u.brief.trim() !== ''
// Some task under `t` (or `t` itself) is open and waits on a session: a message from it not yet taken up.
export const waitingBelow = (t: TaskNode, pending: { anchor?: string }[]) =>
  pending.length > 0 && flat([t]).some(k => k.status === 'open' && pending.some(s => s.anchor === k.id))

// From the rows to how they are drawn: the tree lines (guides), the cards each line is inside
// (frames) and the session labels whose column stays empty (labelCols).
// The tree lines of a row: `bars[k]` continues the line of the ancestor at depth k past it,
// `last` ends its own branch here, `down` starts a line to the rows below it.
export type Guide = { bars: boolean[]; last: boolean; down: boolean }
export function guides(rows: Row[]): Guide[] {
  // Whether a row at `level` comes later, before the tree climbs above it.
  const later = (i: number, level: number) => {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].depth < level) return false
      if (rows[j].depth === level) return true
    }
    return false
  }
  return rows.map((r, i) => ({
    bars: Array.from({ length: Math.max(0, r.depth - 1) }, (_, k) => later(i, k + 1)),
    last: !later(i, r.depth),
    down: (rows[i + 1]?.depth ?? -1) > r.depth,
  }))
}

// The cards a line is drawn in, outermost first: the card of the header at `depth`, whether it
// starts (`first`) or ends (`last`) on this line. A card takes its header and every line below
// it deeper than it; its edges add `PAD` px above its first line and below its last (the px, and
// where the columns, cards and overlays sit, are the geometry module's: ../draw/geometry).
export type Card = { depth: number; first: boolean; last: boolean }
export type Frame = { cards: Card[]; top: number; bottom: number }
// A session's card is headed by a label (its name), not a task line: the tasks inside are its
// roots, with no tree line to the label. Per row, the depths of the session labels it is inside:
// their column (col(depth)) is drawn empty.
export function labelCols(rows: Row[]): number[][] {
  const open: number[] = []
  return rows.map(r => {
    while (open.length > 0 && open[open.length - 1] >= r.depth) open.pop()
    const mine = open.slice()
    if (r.session) open.push(r.depth)
    return mine
  })
}
export function frames(rows: Row[]): Frame[] {
  const open: number[] = []
  return rows.map((r, i) => {
    while (open.length > 0 && open[open.length - 1] >= r.depth) open.pop()
    if (r.card) open.push(r.depth)
    const next = rows[i + 1]
    const cards = open.map(depth => ({
      depth,
      first: r.card === true && depth === r.depth,
      last: next === undefined || next.depth <= depth,
    }))
    return { cards, top: r.card ? PAD : 0, bottom: cards.filter(c => c.last).length * PAD }
  })
}

// What layout() reads: the state as the render read it, once.
export type Model = {
  groups: Group[]
  waits: Wait[]
  // The sessions this one opened, as the host lists them.
  children: Child[]
  // The sends still waiting to be taken up.
  sends: Send[]
  view: 'full' | 'summary'
  work: string[]
}
// The lines the person opened or closed (the folds atom): true closed, false open.
export type Choices = Record<string, boolean>

// The panel's lines from the model and the person's choices, against `now` (the times) and for
// `ownId` (this session's id, for the sisters' messages). Pure: it reads nothing but its arguments.
export function layout(model: Model, choices: Choices, now: number | undefined, ownId: string | undefined): Row[] {
  const held = model.groups
  const waits = model.waits
  const sessions = model.children
  const queued = model.sends
  const chosen = choices
  const summary = model.view === 'summary'
  const work = model.work
  // The breaks of the sessions' cards, computed once per drawing (see breaks).
  const memo = newBreaksMemo()
  const notice = (w: Wait, depth: number): Row => ({ depth, tone: 'wait', title: waitText(w), label: '' })

  // What the person opened or closed, read by the builders below. They run once per drawing: the
  // header's chips count the drawn lines' nodes (Row.nodes, see ui.render), so no pass without the
  // choices is needed (there was one, discarded, until phase 6).
  const fl: Record<string, boolean> = chosen
  // Drawn below a line: the person's choice, else the default.
  const opened = (key: string, byDefault: boolean) => (fl[key] === undefined ? byDefault : !fl[key])

  // A task line and, while it is open, what hangs below it (`below`) and its subtasks.
  // Nothing folds by itself when it is done (the person's words: "se eu quiser, eu mesmo
  // colapso"): every line comes open and only the ▾/▸ closes it. A task with anything below it
  // opens and closes (`fold`, keyed under `scope`). `pending`: the sends from this group's tasks
  // still waiting to be taken up (the panel's that holds the group).
  const rows = (
    items: TaskNode[],
    depth: number,
    top: number,
    lit: string[],
    below: (t: TaskNode, depth: number) => Row[],
    scope: string,
    work: (t: TaskNode) => Work,
    pending: Send[],
  ): Row[] =>
    items.flatMap(t => {
      // Sessions opened on it or below add to its count and keep it in progress (atWork).
      const w = work(t)
      // A message sent from it is still queued: it waits on that session (its own icon).
      const waitsOn = t.status === 'open' ? pending.filter(s => s.anchor === t.id).map(s => s.to) : []
      // A task below it waits on a session (✉): the work is going on (it was drawn not started).
      const waitsBelow = t.status === 'open' && t.children.length > 0 && waitingBelow(t, pending)
      const tone: Tone =
        t.status === 'interrupted'
          ? 'interrupted'
          : waitsOn.length > 0
            ? 'sent'
            : w.busy || waitsBelow
              ? 'current'
              : t.status === 'done'
                ? 'done'
                : lit.includes(t.id)
                  ? 'current'
                  : t.children.length > 0 && resting(t.children)
                    ? 'paused'
                    : 'open'
      const [ld, ln] = t.children.length > 0 ? count(t.children) : w.any ? count([t]) : [0, 0]
      const [sd, sn] = [ld + w.d, ln + w.n]
      const row: Row = {
        depth,
        tone,
        title: t.title,
        label:
          tone === 'sent'
            ? `Aguardando confirmação de ${waitsOn.join(', ')}`
            : ({ open: 'Aberta', current: 'Em andamento', done: 'Concluída', interrupted: 'Interrompida', paused: 'Aguardando' }[tone as string] ?? ''),
        strong: tone === 'current' || tone === 'sent' || (depth === top && t.status === 'open'),
        sub: (t.children.length > 0 || w.any) && tone !== 'interrupted' && sn > 0 ? [sd, sn] : undefined,
        bar: true,
        meta: tone === 'interrupted' ? 'interrompida' : undefined,
        time:
          (tone === 'paused' ? stillSpan([t, ...w.tasks]) : timeOf(t, w, now)) ??
          (tone === 'done' || tone === 'interrupted'
            ? null
            : tone === 'current' && t.plannedAt !== undefined && now !== undefined
              ? now - t.plannedAt
              : undefined),
        kids: w.any || undefined,
        // The context ring is each session's own, on its card only (the person's words: "nao precisa
        // colocar esse icone na tarefa pai que originou essas sessoes"); the ⑂ still marks a task
        // with sessions below.
        // In progress of its own (the chip); a session at work below it counts as a session.
        active: tone !== 'sent' && t.status === 'open' && lit.includes(t.id) && !t.children.some(c => c.status === 'open'),
      }
      const under = below(t, depth)
      if (t.children.length === 0 && under.length === 0) return [{ ...row, nodes: [t] }]
      const key = `${scope}t:${t.id}`
      // Nothing closes by itself when it is done: only the person folds a line (▾/▸).
      const kids = t.children
      const rest = opened(key, true) ? [...under, ...rows(kids, depth + 1, top, lit, below, scope, work, pending)] : []
      row.fold = { key, open: rest.length > 0 }
      row.nodes = rest.length > 0 ? (t.children.length === 0 ? [t] : []) : [t, ...w.cards]
      return [row, ...rest]
    })

  // A turn of the main group: what the person asked, with the level-1 tasks planned for it
  // below. Its count, bar and time add up its tasks and the sessions opened under them; it is
  // in progress while one of them is (or a session below is at work), and closes into one line
  // once all of them are closed.
  const turnRows = (
    u: Turn,
    list: TaskNode[],
    top: number,
    lit: string[],
    below: (t: TaskNode, depth: number) => Row[],
    scope: string,
    work: (t: TaskNode) => Work,
    pending: Send[],
    // The turn's own ↩ (the top panel's): a card draws its session's answers below its tasks.
    reply = true,
  ): Row[] => {
    const ws = list.map(work)
    const busy = ws.some(w => w.busy)
    const [ld, ln] = count(list)
    const [d, n] = [ws.reduce((a, w) => a + w.d, ld), ws.reduce((a, w) => a + w.n, ln)]
    const tone: Tone =
      busy || list.some(t => t.status === 'open' && (lit.includes(t.id) || waitingBelow(t, pending)))
        ? 'current'
        : list.some(t => t.status === 'open')
          ? resting(list)
            ? 'paused'
            : 'open'
          : list.every(t => t.status === 'interrupted')
            ? 'interrupted'
            : 'done'
    const key = `${scope}T:${u.id}`
    const open = opened(key, true)
    const row: Row = {
      depth: top,
      tone,
      title: u.title,
      label:
        { open: 'Pedido aberto', current: 'Pedido em andamento', done: 'Pedido concluído', interrupted: 'Pedido interrompido', paused: 'Aguardando' }[
          tone as string
        ] ?? 'Pedido',
      strong: tone === 'current' || tone === 'open' || tone === 'paused',
      sub: n > 0 ? [d, n] : undefined,
      bar: true,
      time:
        (tone === 'paused' ? stillSpan([...list, ...ws.flatMap(w => w.tasks)]) : timeSpan([...list, ...ws.flatMap(w => w.tasks)], busy, now)) ??
        (tone === 'done' || tone === 'interrupted'
          ? null
          : tone === 'current' && now !== undefined && list.some(t => t.plannedAt !== undefined)
            ? now - Math.min(...list.flatMap(t => (t.plannedAt === undefined ? [] : [t.plannedAt])))
            : undefined),
      fold: { key, open },
      kids: ws.some(w => w.any) || undefined,
    }
    // The ring goes on the turn, the highest line above the sessions, not on its level-1 tasks.
    const inner = open ? rows(list, top + 1, top + 1, lit, below, scope, work, pending) : []
    row.nodes = open ? [] : [...list, ...ws.flatMap(w => w.cards)]
    // The turn's answer closes the message's group, after all its level-1 tasks, as on a card;
    // not when a session's card hangs in the group: the answers that count are in the cards, and
    // one after a card still at work would read as the group being over.
    const said: Row[] =
      reply && open && hasBrief(u) && !ws.some(w => w.any)
        ? [{ depth: top + 1, tone: 'reply', title: u.brief as string, whole: u.reply ?? u.brief, label: 'Resposta' }]
        : []
    return [row, ...inner, ...said]
  }

  // A session this one opened, in a card: "title · name", the count and time of its tasks, and
  // its state in a word once it is not just running. While it runs or waits its own panel is
  // drawn below it as it draws it (its waits under its task in progress, its subagents and
  // sessions); once it stops it closes into one line, which the person may open. The icon is
  // the gray branch while it is at work; the clock when it waits with no notice of its own to
  // show (earlier versions); the check once it stopped.
  const session = (c: Child, depth: number, level: number, scope: string): Row[] => {
    const p = panelOf(c)
    const pending = c.waiting === true && (p.waits ?? []).length === 0
    // Stopped with tasks still open (it waits for a signal, or the next message): not done; its
    // tasks stay in sight, as it planned them.
    const parked = !live(c) && !c.archived && hasOpen(tasksOf(p.groups ?? []))
    const tone: Tone = pending ? 'wait' : live(c) ? 'running' : c.archived ? 'archived' : parked ? 'paused' : 'done'
    // A card of one round (split) speaks for its group only: done, it shows the check, with no
    // word that would say the whole session ended.
    const state = c.waiting ? 'aguardando' : live(c) ? undefined : c.archived ? 'arquivada' : parked ? 'parada' : c.part !== undefined ? undefined : 'concluída'
    const [cd, cn] = total(p, level + 1)
    const header: Row = {
      depth,
      tone,
      // The card's first line is the session alone (its name); its tasks start on the line below.
      // The session's title (often worded like a task) goes only to the alt, not the line.
      title: c.name || c.title,
      label: 'Sessão',
      hint: c.name && c.name !== c.title ? c.title : undefined,
      strong: live(c),
      sub: cn > 0 ? [cd, cn] : undefined,
      meta: state,
      time: span(tasksOf(p.groups ?? []), now) ?? (live(c) ? undefined : null),
      card: true,
      session: true,
      sid: c.id,
      engine: c.engine,
      ring: ringOf(c),
      live: live(c),
      pending,
    }
    if (level >= DEEP) return [header]
    // A card past the first (split) has keys of its own.
    // The fold of a card is kept by when its message was sent (partAt), not by its index among the
    // rounds: at the cap of 20 rounds a new message shifts every index, and the person's fold moved to
    // another card (an open card came back folded).
    const part = c.part ? `#${c.partAt ?? c.part}` : ''
    const key = `${scope}s:${c.id}${part}`
    const inside = `${scope}${c.id}${part}>`
    // Under the card's tasks, what the session answered at the end of each of its turns there, in
    // turn order: a ↩ line, dim, with no count or time (not a task).
    const replies: Row[] = (withMain(p.groups ?? []).find(g => g.agent === MAIN)?.turns ?? [])
      .filter(hasBrief)
      .map(u => ({ depth: depth + 1, tone: 'reply' as Tone, title: u.brief as string, whole: u.reply ?? u.brief, label: 'Resposta' }))
    const inner = opened(key, true) ? [...panel(p, depth + 1, level + 1, inside, c.id), ...replies] : []
    // Whether a closed one has anything to open: its panel, drawn as it would be.
    if (inner.length > 0 || panel(p, depth + 1, level + 1, inside, c.id).length > 0) header.fold = { key, open: inner.length > 0 }
    header.nodes = inner.length > 0 ? [] : allTasks(p, level + 1)
    return [header, ...inner]
  }

  // One session's panel from `base`: its main group, its subagents' groups and the sessions
  // it opened. A session goes under the main task it was opened on, open or closed (a closed
  // one shows only it); at the end of the list when it has no such task. Archived ones are
  // left out. Done tasks stay in their place in the plan, closed.
  const panel = (p: Panel, base: number, level: number, scope: string, me?: string): Row[] => {
    // The sends of this panel's main group still waiting to be taken up: this session's at the top,
    // what each session publishes in its card (its task shows ✉ too).
    const pending = level > 0 ? (p.sends ?? []).filter(x => !x.taken) : queued
    const groups = withMain(p.groups ?? [])
    const waits = p.waits ?? []
    // Archived sessions stay, as history, drawn gray with "arquivada".
    // One card per message the session was sent (split).
    const sessions = nest((p.children ?? []).flatMap(c => split(c, p.children ?? [], me, withMain(p.groups ?? []).find(g => g.agent === MAIN)?.tasks ?? [], now, memo)))

    // A subagent's group hangs from the loop that launched it; one whose launcher has no
    // group (it never planned) hangs from the main one.
    const agents = groups.map(g => g.agent)
    const launcher = (g: Group) => (agents.includes(g.parent ?? MAIN) ? (g.parent ?? MAIN) : MAIN)
    const kidsOf = (agent: string) => groups.filter(g => g.agent !== MAIN && launcher(g) === agent)

    const main = groups.find(g => g.agent === MAIN) as Group
    const allIds = flat(main.tasks).map(t => t.id)
    const loose = sessions.filter(c => c.anchor === undefined || !allIds.includes(c.anchor))
    // A group's tasks from `top` (`list`), with what hangs below them. Its subagents' groups
    // go under the task they were launched on, hidden with it once it closes; one launched
    // on no task (or a task replanned away) ends the group. `extras` adds those groups and
    // the notices with no task to go under.
    const body = (g: Group, top: number, list: TaskNode[], extras: boolean): Row[] => {
      const mine = waits.filter(w => w.agent === g.agent)
      const kids = kidsOf(g.agent)
      const lines: Row[] = []
      const { lit, anchor } = current(g.tasks)
      const ids = flat(g.tasks).map(t => t.id)
      const lost = kids.filter(k => k.anchor === undefined || !ids.includes(k.anchor))
      const below = (t: TaskNode, depth: number) => [
        ...(t.id === anchor ? mine.map(w => notice(w, depth + 1)) : []),
        ...(g.agent === MAIN
          ? inOrder(sessions.filter(c => c.anchor === t.id)).flatMap(c => session(c, depth + 1, level, scope))
          : []),
        ...(t.status === 'open' ? kids.filter(k => k.anchor === t.id).flatMap(k => draw(k, depth + 1)) : []),
      ]
      // With no task to go under, a notice goes under the header, or ends the main list.
      if (extras && anchor === undefined && g.agent !== MAIN) lines.push(...mine.map(w => notice(w, top)))
      // The sessions' work under each task, once per task and pass: a turn's line sums it for its
      // level-1 tasks (turnRows) and each task's line asks for it again (rows); the answer is the
      // same within one pass (same task, same sessions), so it is kept by task object.
      const works = new WeakMap<TaskNode, Work>()
      const work =
        g.agent === MAIN
          ? (t: TaskNode) => {
              let w = works.get(t)
              if (w === undefined) {
                w = atWork(t, sessions, level)
                works.set(t, w)
              }
              return w
            }
          : undefined
      const inScope = `${scope}${g.agent}|`
      // Only the last SHOWN_TURNS requests (turns) of a main list are drawn, on the top panel and in
      // a session's card alike, and any request with something still open; the rest are counted
      // in one line: a long session's whole history, its cards' too, came to 700 lines and 1.6 MB
      // a drawing, sent again every second, and the app stopped showing the pane. The header and
      // the counts still take them all.
      const asked = g.agent === MAIN ? [...new Set(list.flatMap(t => (t.turn === undefined ? [] : [t.turn])))].sort((a, b) => a - b) : []
      const keep = level === 0 ? SHOWN_TURNS : SHOWN_CARD_TURNS
      const recent = asked.slice(-keep)
      const cut = asked.length > keep || (asked.length >= keep && list.some(t => t.turn === undefined))
      // A request with a session still at work under its task stays drawn too (it is going on).
      const drawn = cut ? list.filter(t => (t.turn !== undefined && recent.includes(t.turn)) || hasOpen([t]) || (work?.(t).live ?? false)) : list
      const left = cut ? new Set(list.filter(t => !drawn.includes(t)).map(t => t.turn ?? -1)).size : 0
      if (cut && left > 0) lines.push({ depth: top, tone: 'section', title: `+${left} pedidos anteriores`, label: 'Pedidos anteriores, não desenhados' })
      // The top panel's main tasks go under the turn (the person's message) they were planned
      // in, oldest first; tasks from before turns existed stay loose, ahead of them.
      // In a session's card, only a turn that planned more than one level-1 task gets its header:
      // with no line from the card's label, those tasks read as loose ones (the person's words:
      // "Tarefas sem ligação"); a turn of one task stays as it was, that task its own header.
      const turns =
        g.agent !== MAIN
          ? []
          : (g.turns ?? []).filter(u => drawn.some(t => t.turn === u.id) && (level === 0 || drawn.filter(t => t.turn === u.id).length > 1))
      const loose = turns.length === 0 ? drawn : drawn.filter(t => !turns.some(u => u.id === t.turn))
      // Only the main group's tasks send messages: a subagent's lines have none pending.
      const sent = g.agent === MAIN ? pending : []
      lines.push(...rows(loose, top, top, lit, below, inScope, work ?? (() => idle), sent))
      for (const u of turns) lines.push(...turnRows(u, drawn.filter(t => t.turn === u.id), top, lit, below, inScope, work ?? (() => idle), sent, level === 0))
      if (extras && anchor === undefined && g.agent === MAIN) lines.push(...mine.map(w => notice(w, top)))
      return extras ? lines.concat(lost.flatMap(k => draw(k, top))) : lines
    }

    // One group's lines from `b`: a subagent's header there and its tasks below, opened and
    // closed with the header.
    const draw = (g: Group, b: number): Row[] => {
      if (g.agent === MAIN) return body(g, b, g.tasks, true)
      const mine = waits.filter(w => w.agent === g.agent)
      if (g.tasks.length === 0 && mine.length === 0 && kidsOf(g.agent).length === 0) return []
      // A subagent's group closes into one line once nothing in it is open; its notices
      // stay in sight.
      const closed = g.tasks.length > 0 && !hasOpen(g.tasks)
      const cut = flat(g.tasks).some(t => t.status === 'interrupted')
      const [gd, gn] = count(g.tasks)
      const header: Row = {
        ...(closed
          ? { tone: cut ? 'interrupted' : 'done', meta: cut ? 'interrompido' : undefined }
          : { tone: 'agent', strong: true }),
        depth: b,
        title: g.label,
        label: 'Subagente',
        sub: gn > 0 ? [gd, gn] : undefined,
        time: span(g.tasks, now),
        card: true,
      } as Row
      const inner = body(g, b + 1, g.tasks, true)
      if (inner.length === 0) return [{ ...header, nodes: g.tasks }]
      const key = `${scope}g:${g.agent}`
      const open = opened(key, true)
      header.fold = { key, open }
      header.nodes = open ? [] : g.tasks
      return [header, ...(open ? inner : closed ? mine.map(w => notice(w, b + 1)) : [])]
    }

    // A card with no task to go under (opened before this session kept origins, or its origin
    // long gone) ends the list only while it has work: one all done is old history, counted in one
    // line, not drawn (they were most of the 1.6 MB drawing).
    // One begun since the oldest request still drawn above (a message with no recorded origin)
    // stays: it is recent.
    // The requests (turns) with a level-1 task, by a set of the tasks' turns: one pass over each
    // list, not one over the tasks per turn (a long session has thousands of both).
    const withTasks = new Set(main.tasks.map(t => t.turn))
    const ats = (main.turns ?? []).filter(u => withTasks.has(u.id)).flatMap(u => (typeof u.at === 'number' ? [u.at] : []))
    const since = ats.length > SHOWN_TURNS ? [...ats].sort((a, b) => a - b)[ats.length - SHOWN_TURNS] : -Infinity
    const busy = (c: Child) => begins(c) >= since || live(c) || hasOpen(tasksOf(panelOf(c).groups ?? []))
    const old = level === 0 ? loose.filter(c => !busy(c)) : []
    const ends = level === 0 ? loose.filter(busy) : loose
    return draw(main, base)
      .concat(old.length > 0 ? [{ depth: base, tone: 'section' as Tone, title: `+${old.length} cartões antigos de sessões`, label: 'Cartões antigos, não desenhados' }] : [])
      .concat(inOrder(ends).flatMap(c => session(c, base, level, scope)))
  }
  const all = { groups: held ?? [], waits, children: sessions }
  // The summary view is the full view of a cut of the panel: the current work (trimToWork) with what
  // is still going on, the finished requests of earlier turns left out. It never moves a card: each
  // card stays under the task its message was sent from, as in the full view (the person's words, with
  // two pictures of one moment: "a visão completa parece mais correta que a resumida"; a card used to
  // move under the task of the session's last message). Same lines, the same ▾/▸ and the same choices
  // as the full view.
  const cut = (): Panel => {
    const base = { groups: withMain(held ?? []), waits, work: work as string[] }
    const cards = nest(sessions.flatMap(c => split(c, sessions, ownId, withMain(base.groups ?? []).find(g => g.agent === MAIN)?.tasks ?? [], now, memo)))
    return trimToWork({ ...base, children: cards }, 0)
  }
  return limitRows(panel(summary ? cut() : all, 0, 0, '', ownId))
}
