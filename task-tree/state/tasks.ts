// The edits of the task tree, pure: what plan, start and done do to a group's tasks (build the
// level-1 tasks of a plan, find a task by its id, close one with its subtree and the parents it
// completes, start one, give a task closed with no start one). The hooks module calls them with the
// time the engine's clock gives; nothing of the kit here.

import type { Status, TaskNode } from '../types'
import { flat, stop, timing } from '../draw/layout'

export type InNode = { id: string; title: string; children?: InNode[] }

// A level-1 task keeps its id; the ids below it are prefixed with it ("D/1.1"), so two
// plans may both use "1.1".
export function build(list: InNode[], depth: number, root?: string, now?: number): TaskNode[] {
  return list.map(t => ({
    id: root === undefined ? t.id : `${root}/${t.id}`,
    short: t.id,
    title: t.title,
    status: 'open' as Status,
    ...(now === undefined ? {} : { plannedAt: now }),
    children: depth < 3 ? build(t.children ?? [], depth + 1, root ?? t.id, now) : [],
  }))
}


export function duplicates(list: TaskNode[]): string[] {
  const ids = flat(list).map(t => t.id)
  return ids.filter((id, i) => ids.indexOf(id) !== i)
}

// The task an id names in one group: the full id, or the short one when it is
// unambiguous, an open task preferred over a closed one.
export function resolve(list: TaskNode[], id: string): { node?: TaskNode; error?: string } {
  const all = flat(list)
  // A closed level-1 task from an old plan ("1") must not win over the open "D/1" of the plan
  // in progress: the open tasks come first, by full or short id alike.
  const same = all.filter(t => t.id === id || t.short === id)
  if (same.length === 1) return { node: same[0] }
  for (const status of ['open', 'done', 'interrupted'] as Status[]) {
    const hits = same.filter(t => t.status === status)
    if (hits.length === 1) return { node: hits[0] }
    const exact = hits.find(t => t.id === id)
    if (exact) return { node: exact }
    if (hits.length > 1) return { error: `"${id}" é ambíguo, use ${hits.map(t => `"${t.id}"`).join(' ou ')}` }
  }
  return {}
}

export const edit = (list: TaskNode[], id: string, fn: (t: TaskNode) => TaskNode): TaskNode[] =>
  list.map(t => (t.id === id ? fn(t) : { ...t, children: edit(t.children, id, fn) }))


// Done closes the task with its whole subtree; a parent whose children are all done
// closes too.
export const finish =
  (now?: number) =>
  (t: TaskNode): TaskNode => {
    // The mark of the person's stop goes with the close (see park).
    const { stopped: _, ...rest } = t
    return {
      ...rest,
      status: t.status === 'interrupted' ? 'interrupted' : 'done',
      started: undefined,
      endedAt: t.status === 'open' ? stop(t, now) : t.endedAt,
      children: t.children.map(finish(now)),
    }
  }
// The person stopped the turn (Esc): a leaf the main loop had started and open is marked `stopped`,
// and the clocks of the open tasks stop there. The mark stays until a start begins the task again
// (begin), a done closes it (finish) or a plan replaces it: meanwhile the panel reads it as the stop
// left it, interrupted, in every turn (halt and stay in draw/layout). A parent started itself is no
// longer started (it lit its first open task again at the next prompt): only a start of it lights it
// again. The person, 2026-11-12: "Segue ✕ até novo start (Recomendado)".
export const park =
  (at?: number) =>
  (t: TaskNode): TaskNode => {
    if (t.status !== 'open') return t
    if (t.children.length === 0) return t.started !== undefined || t.startedAt !== undefined ? { ...t, stopped: true, endedAt: stop(t, at) } : t
    return { ...t, started: undefined, endedAt: stop(t, at), children: t.children.map(park(at)) }
  }
// A task closed with no start (done without start) gets one, so its time shows: the end of the
// closed sibling before it, else its parent's start, else when it was planned (never before it was
// planned, never after now).
// What it closes below it with no start starts the same way, from it.
export function fillStarts(list: TaskNode[], id: string, now?: number, parentStart?: number): TaskNode[] {
  return list.map((t, i) => {
    if (t.id === id) return fill([t], list.slice(0, i), parentStart, now)[0] as TaskNode
    if (!flat(t.children).some(c => c.id === id)) return t
    return { ...t, children: fillStarts(t.children, id, now, t.startedAt ?? parentStart) }
  })
}
export function fill(items: TaskNode[], before: TaskNode[], parentStart: number | undefined, now?: number): TaskNode[] {
  let prev = before.filter(s => s.status !== 'open' && s.endedAt !== undefined).pop()?.endedAt
  return items.map(t => {
    if (t.status !== 'open') {
      prev = t.endedAt ?? prev
      return t
    }
    // Never before it was planned: the sibling before it may be of an earlier request.
    const after = prev ?? parentStart
    const from = t.startedAt ?? (after !== undefined && t.plannedAt !== undefined ? Math.max(after, t.plannedAt) : after ?? t.plannedAt)
    const startedAt = from === undefined || now === undefined ? from : Math.min(from, now)
    return { ...t, startedAt, children: fill(t.children, [], startedAt, now) }
  })
}

export function settle(list: TaskNode[], now?: number): TaskNode[] {
  return list.map(t => {
    const children = settle(t.children, now)
    const closed = t.status === 'open' && children.length > 0 && children.every(c => c.status !== 'open')
    return closed
      ? { ...t, status: 'done' as Status, started: undefined, endedAt: stop(t, now), children }
      : { ...t, children }
  })
}

// Start marks the task in progress, reopening it and its parents when it was closed. Its clock
// starts (again, when it was closed); a parent's starts with its first child's and goes on.
// Reopened, the task keeps when (`reopenedAt`) and drops the "falhou" of its earlier close: the
// subagents that ended before were reflected in that close (hooks/agents, settleBySubs).
export function begin(list: TaskNode[], id: string, seq: number, now?: number): TaskNode[] {
  return list.map(t => {
    if (t.id === id) {
      // A task the person stopped (`stopped`) is in progress again: the mark goes, its clock goes on.
      if (t.status === 'open') {
        const { stopped: _, ...open } = t
        return { ...open, status: 'open' as Status, started: seq, startedSeq: seq, startedAt: t.startedAt ?? now, endedAt: undefined }
      }
      const { failed: _, stopped: __, ...rest } = t
      return { ...rest, status: 'open' as Status, started: seq, startedSeq: seq, startedAt: now, endedAt: undefined, ...(now !== undefined ? { reopenedAt: now } : {}) }
    }
    if (!flat(t.children).some(c => c.id === id)) return t
    return { ...t, status: 'open' as Status, startedAt: t.startedAt ?? now, endedAt: undefined, children: begin(t.children, id, seq, now) }
  })
}

// A replan of an open level-1 task (same id, same request): the new plan's order and titles, with the
// state of every task that keeps its id; a message task left out while its message is queued
// (`queued`: anchors of sends not taken up) stays, marked kept; parents follow their children (the
// person, 2026-10-27: "◉ segue ◉, ✓ segue ✓, ✉ segue até a entrega; só tarefas novas nascem ○").
export function carry(old: TaskNode, fresh: TaskNode, queued: string[], now?: number): TaskNode {
  const byId = new Map(flat([old]).map(t => [t.id, t] as const))
  const merge = (n: TaskNode): TaskNode => {
    const o = byId.get(n.id)
    const kept = o
      ? { status: o.status, started: o.started, startedSeq: o.startedSeq, startedAt: o.startedAt, endedAt: o.endedAt, plannedAt: o.plannedAt, msg: o.msg, ...(o.reopenedAt !== undefined ? { reopenedAt: o.reopenedAt } : {}), ...(o.status === 'open' && o.stopped === true ? { stopped: true } : {}) }
      : {}
    return { ...n, ...kept, children: n.children.map(merge) }
  }
  let out = merge(fresh)
  const ids = new Set(flat([out]).map(t => t.id))
  const parentOf = (list: TaskNode[], id: string, p?: TaskNode): TaskNode | undefined => {
    for (const t of list) {
      if (t.id === id) return p
      const found = parentOf(t.children, id, t)
      if (found !== undefined) return found
    }
    return undefined
  }
  // A task with a letter still queued that the replan leaves out is not kept: its letter hangs from
  // the request's level-1 task until the delivery (the panel's letters).
  void queued
  void parentOf
  void ids
  // A parent with something open below it is open again; settle closes the ones left all done.
  const reopen = (t: TaskNode): TaskNode => {
    const children = t.children.map(reopen)
    return children.length > 0 && flat(children).some(k => k.status === 'open')
      ? { ...t, status: 'open' as Status, started: undefined, endedAt: t.status === 'open' && !timing(children) ? t.endedAt : undefined, children }
      : { ...t, children }
  }
  return settle([reopen(out)], now)[0] as TaskNode
}
