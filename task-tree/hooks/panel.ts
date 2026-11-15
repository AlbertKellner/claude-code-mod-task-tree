// The panel's state and how the hooks change it: the state's keys, the groups and their turns, the
// waits, the view, the current work, the ties to the sessions (links), the publication of the panel
// and the restores after a restart or a reload (../state/durability says where each lives). Every
// hook file uses these; nothing here registers a hook.

import { update } from 'claude-code'
import type { AgentInfo } from 'claude-code'

import type { Child, GitInfo, Group, LegacyNode, Send, TaskNode, Turn, Wait } from '../types'
import { current as keepCurrent, linkOf, loadStore, loaded, restoredAt, saveGroups, saveStore } from '../state/durability'
import type { Link } from '../state/durability'
import { MAIN, flat, withMain, interrupt, activeLeaves, current, openInSight, startedLast, subLive } from '../draw/layout'
import type { Idle } from '../types'
import { debug, debugOnce } from '../io/log'
import { readGit } from '../io/git'
import { publishWait, readPublished } from '../io/publish'
import { hasBrief, rawPanel, sessionTotal, trimPublished } from '../draw/layout'
import { park } from '../state/tasks'

export const PANE = 'task-tree'
// The state's keys, as literals (the kit's validator wants them written in the file that calls $.state,
// and not exported: each hook file declares the ones it uses). Where each
// lives and how it comes back is the durability table's (../state/durability), which has a row
// for every one of them (the check's `regras` step fails on a key without one).
const legacyTasks = { plugin: 'task-tree', key: 'tasks' } as const
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
const launchesState = { plugin: 'task-tree', key: 'launches' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const
const endedState = { plugin: 'task-tree', key: 'ended' } as const

// The main loop works again (a prompt, or a call of its own): what the last turn left open is in
// progress again, no longer drawn as halted (see turnEnded). After a restart the end comes back from
// the store first, so the store's copy is cleared too.
export async function wake($: any) {
  await ensureTurn($)
  if (typeof (await $.state.get(turnEndedState)).value === 'number') {
    await $.state.set(turnEndedState, null)
    await saveTurn($)
    // The session is going again: its idle span, if one is open, closes here.
    await setIdle($, false, await stamp($))
  }
}

// The session's idle spans (Group.idle, main group): one opens when the session stands stopped (the
// turn ended and nothing alive, hooks/sessions syncIdle) and closes when it goes again (wake, or
// something alive again). Written only at a change; the last IDLE_KEEP kept. The times leave them out
// (the person, 2026-11-14: "Só com turno em curso (Recomendado)").
export const IDLE_KEEP = 500
export async function setIdle($: any, idle: boolean, at: number | undefined) {
  if (at === undefined) return
  await ensureGroups($)
  const { value: groups = [] } = await $.state.get(groupsState)
  const main = (groups as Group[]).find(g => g.agent === MAIN)
  const list: Idle[] = main?.idle ?? []
  const last = list[list.length - 1]
  const open = last !== undefined && last.to === undefined
  if (idle === open) return
  // Nothing to measure yet: no span for an empty panel.
  if (idle && (!main || main.tasks.length === 0)) return
  await change($, all =>
    all.map(g => {
      if (g.agent !== MAIN) return g
      const now = g.idle ?? []
      // Checked again inside the one update: a tick and a turn's end at once open one span, not two.
      if (idle === (now.length > 0 && now[now.length - 1]?.to === undefined)) return g
      const next: Idle[] = idle ? [...now, { from: at }].slice(-IDLE_KEEP) : now.map((x, i) => (i === now.length - 1 && x.to === undefined ? { ...x, to: Math.max(at, x.from) } : x))
      return { ...g, idle: next }
    }),
  )
}

// The turn's end (turnEnded, turnAborted, replanDue) is kept in the store too, one record (`turn`): a new
// process (the worker respawned, /model, a restart of the app) drew as in progress, with its clock
// going, what the last turn had left stopped. Written only when it changes: wake runs at every prompt
// and every call of the main loop.
// A record of an earlier version has no `replan`: its `aborted` says it (no request came since the stop).
// `failed`: the stop was a turn that died by an error (absent in earlier records: false).
type TurnRecord = { ended: number | null; aborted: boolean; replan: boolean; failed: boolean }
let lastTurn: string | undefined
const turnRecord = (v: unknown): TurnRecord | undefined =>
  v !== null && typeof v === 'object' && 'ended' in v
    ? {
        ended: typeof (v as any).ended === 'number' ? (v as any).ended : null,
        aborted: (v as any).aborted === true,
        replan: (v as any).replan === true || ((v as any).replan === undefined && (v as any).aborted === true),
        failed: (v as any).failed === true,
      }
    : undefined
export async function saveTurn($: any) {
  try {
    const ended = (await $.state.get(turnEndedState)).value
    const aborted = (await $.state.get(turnAbortedState)).value
    const replan = (await $.state.get(replanDueState)).value
    const failed = (await $.state.get(turnFailedState)).value
    const text = JSON.stringify({ ended: typeof ended === 'number' ? ended : null, aborted: aborted === true, replan: replan === true, failed: failed === true })
    if (text === lastTurn) return
    if (await saveStore($, 'turnEnded', JSON.parse(text))) lastTurn = text
  } catch {}
}
// The turn's "first use" (the table's restoredAt), as ensureWork: a restart without session.start
// brings the end back before the first drawing or write. Answers what it brought, for a drawing that
// cannot write the state.
export async function ensureTurn($: any): Promise<TurnRecord | undefined> {
  if (loaded.has('turn') || !restoredAt('turnEnded', 'first-use')) return undefined
  try {
    if ((await $.state.get(turnEndedState)).value !== undefined) {
      loaded.add('turn')
      return undefined
    }
    const saved = turnRecord(await loadStore($, 'turnEnded'))
    if (saved === undefined) {
      loaded.add('turn')
      return undefined
    }
    lastTurn = JSON.stringify(saved)
    try {
      await $.state.set(turnEndedState, saved.ended)
      await $.state.set(turnAbortedState, saved.aborted)
      await $.state.set(replanDueState, saved.replan)
      await $.state.set(turnFailedState, saved.failed)
      loaded.add('turn')
    } catch {}
    return saved
  } catch (err) {
    await unread($, 'fim do turno', err)
    return undefined
  }
}
// At session.start, with nothing held (a new process), and at a resume (`id`, which replaces): the
// session's turn end from the store.
export async function restoreTurn($: any, id?: string, replaceHeld = false) {
  loaded.add('turn')
  try {
    if (!replaceHeld && (await $.state.get(turnEndedState)).value !== undefined) return
    const saved = turnRecord(await loadStore($, 'turnEnded', id))
    if (saved === undefined) {
      // A resume with no turn end kept: none, not the previous session's.
      if (replaceHeld) await clearTurn($)
      return
    }
    await $.state.set(turnEndedState, saved.ended)
    await $.state.set(turnAbortedState, saved.aborted)
    await $.state.set(replanDueState, saved.replan)
    await $.state.set(turnFailedState, saved.failed)
    lastTurn = JSON.stringify(saved)
  } catch (err) {
    await unread($, 'fim do turno', err)
  }
}
// A new process (session.start that brought the panel into an empty state, or a resume) finds the turn
// still going on by the store (`ended: null`, or no record at all): no turn runs at that moment, so the
// one the store has died with the process before it (the app closed, the process killed mid-turn). What
// it left started and open is stopped as the Esc stops it (park): interrupted, out of the x/y, until a
// start in it, and the next request is asked to replan (the person, 2026-11-14: "✕ interrompida"). The
// clock stops at the last instant the panel knows (the newest start, end, plan or request of the main
// group), not at the reopening: the time with the app closed is not counted. A respawn with no
// session.start (ensureTurn) does not do this: its turn may still be alive.
export async function parkDeadTurn($: any) {
  try {
    if (typeof (await $.state.get(turnEndedState)).value === 'number') return
    const { value: groups = [] } = await $.state.get(groupsState)
    const main = (groups as Group[]).find(g => g.agent === MAIN)
    if (!main || !flat(main.tasks).some(t => t.status === 'open' && t.started !== undefined)) return
    const times = [
      ...flat(main.tasks).flatMap(t => [t.startedAt, t.endedAt, t.plannedAt]),
      ...(main.turns ?? []).map(u => u.at),
    ].filter((n): n is number => typeof n === 'number')
    const at = times.length > 0 ? Math.max(...times) : undefined
    await $.state.set(turnEndedState, at ?? 0)
    await $.state.set(turnAbortedState, true)
    await $.state.set(replanDueState, true)
    // Died with the process, not by an error of its own: "interrompida".
    await $.state.set(turnFailedState, false)
    await change($, all => all.map(g => (g.agent === MAIN ? { ...g, tasks: g.tasks.map(park(at)) } : g)))
    await saveTurn($)
    // Stopped since the process died: the time from then on is idle (setIdle).
    await setIdle($, true, at)
  } catch {}
}
// /clear: no turn end, in the state and in the store.
export async function clearTurn($: any) {
  await $.state.set(turnEndedState, null)
  await $.state.set(turnAbortedState, false)
  await $.state.set(replanDueState, false)
  await $.state.set(turnFailedState, false)
  await saveTurn($)
}
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const workState = { plugin: 'task-tree', key: 'work' } as const
const receivedState = { plugin: 'task-tree', key: 'received' } as const
const receiptsState = { plugin: 'task-tree', key: 'receipts' } as const
const engineState = { plugin: 'task-tree', key: 'engine' } as const
const ultracodeState = { plugin: 'task-tree', key: 'ultracode' } as const
const rateState = { plugin: 'task-tree', key: 'rate' } as const
const gitState = { plugin: 'task-tree', key: 'git' } as const
const turnAbortedState = { plugin: 'task-tree', key: 'turnAborted' } as const
const replanDueState = { plugin: 'task-tree', key: 'replanDue' } as const
const turnFailedState = { plugin: 'task-tree', key: 'turnFailed' } as const
const briefState = { plugin: 'task-tree', key: 'brief' } as const
const collapsedState = { plugin: 'task-tree', key: 'collapsed' } as const
const namesState = { plugin: 'task-tree', key: 'names' } as const
// The turn's answer in a few words, as the session gave it (done's `summary`), until the turn ends.
// In the state, not a variable of the module: a reload of the mod between the done and the end of
// the turn (saving a file of the mod mid-turn) kept the variable's value nowhere, and the ↩ line
// lost the summary. Empty: none given.
export async function lastBrief($: any): Promise<string | undefined> {
  const { value } = await $.state.get(briefState)
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The request's reminders, variables of the module (a reload starts them over): the main loop's
// tool calls since a plan was last open (see the tool.call reminder); whether the current request
// already used the panel (a plan taken, a start, or a done that closed a task of this request: with
// everything closed, its last calls need no reminder to plan); whether the last question was answered by a chat message instead of an option
// (that message, at the next prompt, is the answer); whether the summary kept was given before a
// plan of the same turn (a step's, so the last done still asks for one; a reload forgets the mark,
// and then only that second reminder is lost).
export const reminders = { unplanned: 0, planned: false, answeredInChat: false, briefBeforePlan: false }

// The time now, or undefined where it cannot be read (the test kit without a clock).
export async function stamp($: any): Promise<number | undefined> {
  try {
    const t = await $.clock.now()
    return typeof t === 'number' ? t : undefined
  } catch {
    return undefined
  }
}

export const migrate = (t: LegacyNode): TaskNode => ({
  id: t.id,
  short: t.id.replace(/^[^:]*:/, ''),
  title: t.title,
  status: t.done ? 'done' : 'open',
  children: t.children.map(migrate),
})

// A message of the person opens a turn of the main group, titled with its start; turns no plan
// used are dropped then, so only turns with tasks are kept.
// A turn opened by another session's message (`from`) is marked `msg`, with who sent it: its level-1
// tasks show the ✉ of a message received (see layout's rows).
// The requests with no task and only a summary kept (openTurn): the most recent ones.
const BRIEF_TURNS = 20
export async function openTurn($: any, text: string, own = false, from?: { id: string; name?: string }) {
  // A message from another session comes wrapped in tags: its words are the title.
  const line = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Pedido'
  const title = line.length > 60 ? `${line.slice(0, 59)}…` : line
  const at = await stamp($)
  await change($, all =>
    all.map(g => {
      if (g.agent !== MAIN) return g
      const turns = g.turns ?? []
      // The turns still holding a level-1 task stay (by a set of the tasks' turns: one pass each), and
      // the last BRIEF_TURNS with no task and a summary (a request answered with no plan: its ↩ line).
      const withTasks = new Set(g.tasks.map(t => t.turn))
      const briefOnly = new Set(turns.filter(u => !withTasks.has(u.id) && hasBrief(u)).slice(-BRIEF_TURNS).map(u => u.id))
      const used = turns.filter(u => withTasks.has(u.id) || briefOnly.has(u.id))
      const id = turns.reduce((top, u) => Math.max(top, u.id), 0) + 1
      // The person's own prompt in this session is marked (`own`): the card of this turn, in the
      // session that opened this one, goes at the end of the request that opened it.
      return { ...g, turns: [...used, { id, title, at, ...(own ? { own: true } : {}), ...(from ? { msg: true, from } : {}) }] }
    }),
  )
}


// The task a message is sent from: the task in progress, even with a step planned after it was
// started and not started yet (the person, 2026-11-14: "Sob a em andamento (Recomendado)"; the letter
// and the card went to that newest step, which then closed on the delivery). With nothing in progress
// (the person's decision: "envio feito sem tarefa em andamento ancora na última iniciada do pedido
// atual, mesmo concluída; sem nenhuma iniciada, no fim do pedido"): the task started last in the
// current request (the last turn with tasks), else that request's last level-1 task. It was the first
// open task, the next pending step: its card went under "Passo 2" and "Passo 3" closed on delivery.
// With several tasks in progress, a message goes to the latest batch of starts (the tasks started
// within BATCH ms of the newest of them that has no message yet: one answer's starts), to the first
// of it in the order they were started, that has no message of this session's yet since it started
// (`used`: where the messages sent and the sessions' rounds went, and when); all of them with one,
// the rule above (the person's decision: "pela ordem", each send to the next task in progress). A
// task left in progress from before only gets it once the batch is done; a task with a question open
// under it (`asking`) never does. With two sends started together both went to the task started
// last; then a task opened before and still in progress took a later send, its card under it.
export type Used = { anchor?: string; at?: number }
const BATCH = 3000
// The receiving session's name against a task's title, both without accents, hyphens or case
// (the person's decision, 2026-11-09: "Pelo nome"; the web research session's card had gone under the
// other task): the title holds the name ("pesquisa-web" in "Pesquisa web: changelog"), or the name
// holds the title's head, before a ":" ("implementacao-hover" holds "Implementação").
const plain = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
// Or a word of the name, of 4 letters or more, is a word of the title ("analise-plano" in "Subagente da
// hora na análise"; the person, 2026-11-09: "Sim, por palavra (Recomendado)"); only a match with one
// candidate counts (byName), so a word every candidate has decides nothing.
const words = (s: string) => plain(s).split(' ').map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 4)
// A free phrase (a new session's title, a subagent's description or type) is no session name: it
// matches only whole, in whole words: the title's words hold the phrase's words in a row, or the
// phrase's words hold the title's head, before a ":" (4 letters or more). A word in common, or a piece
// of a word ("Plan" in "Planejar"), decides nothing (the person, 2026-11-14: "Só no nome (Recomendado)").
const tokens = (s: string) => plain(s).split(' ').map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w !== '')
const inRow = (hay: string[], needle: string[]) =>
  needle.length > 0 && hay.some((_, i) => needle.every((w, j) => hay[i + j] === w))
export function namedFor(title: string, names: string[], phrases: string[] = []): boolean {
  const t = plain(title)
  const head = plain(title.split(':')[0] ?? '')
  const inTitle = words(title)
  const all = tokens(title)
  const headWords = tokens(title.split(':')[0] ?? '')
  return (
    names.some(n => {
      const name = plain(n)
      return name.length >= 3 && (t.includes(name) || (head.length >= 4 && name.includes(head)) || words(n).some(w => inTitle.includes(w)))
    }) ||
    phrases.some(f => {
      const phrase = tokens(f)
      return plain(f).length >= 3 && (inRow(all, phrase) || (head.length >= 4 && inRow(phrase, headWords)))
    })
  )
}
// The one candidate whose title matches the session's names or the free phrases, if exactly one does.
const byName = (tasks: TaskNode[], names: string[], phrases: string[]) => {
  const hit = names.length === 0 && phrases.length === 0 ? [] : tasks.filter(t => namedFor(t.title, names, phrases))
  return hit.length === 1 ? hit[0] : undefined
}
// The request open now (the person's last message): the main group's last turn. A message, a session
// or a subagent sent before the request's first plan has no task of it to go to (`open` with no level-1
// task of that turn): none, it is drawn loose at the end until the plan adopts it (adoptOrphans, in
// hooks/tools; the person, 2026-11-14: "Sim, o plan adota (Recomendado)"). It went to a pending task of
// the request before, which closed on the delivery.
export const openTurnOf = (groups: Group[]): Turn | undefined => {
  const turns = groups.find(g => g.agent === MAIN)?.turns ?? []
  return turns[turns.length - 1]
}
// The current request's tasks: the main group's level-1 tasks of its last turn (with no turns kept,
// a panel of an earlier version, all of them). What the reminders measure (tool-call, reminder; the
// done's summary reminder).
export const requestTasks = (groups: Group[]): TaskNode[] => {
  const tasks = groups.find(g => g.agent === MAIN)?.tasks ?? []
  const open = openTurnOf(groups)
  return open === undefined ? tasks : tasks.filter(t => t.turn === open.id)
}
export function sendAnchor(list: TaskNode[], used: Used[] = [], asking: string[] = [], names: string[] = [], open?: number, phrases: string[] = []): string | undefined {
  // Nothing open and started is nothing in progress (current() would light the first open task, of
  // any request). Then, in this order (the person's decisions): with the request open now and no
  // level-1 task of it yet, none (above); else the current request is the largest `turn` among the
  // level-1 tasks; among its pending tasks with no subtasks (○, ✉ until the delivery), the one whose
  // title matches the receiving session's name (or holds the free phrase whole), if only one does (byName); else the batch planned
  // last (the pending tasks with the `plannedAt` of the newest), its first in plan order with no use
  // yet (`used`: a letter, a session's round, a session opened, a subagent launched), all of them used,
  // its last; no pending task, the one started last, done included (startedLast); none started, the
  // request's last level-1 task. It took the task started last even with one pending, planned to send:
  // the card went under the closed task before it.
  const started = flat(list).filter(t => t.status === 'open' && t.children.length === 0 && t.started !== undefined)
  const going = started.filter(t => !asking.includes(t.id))
  // Two in progress, one of them asking: the other one.
  if (going.length === 1 && started.length > 1) return going[0]!.id
  if (going.length > 1) {
    const order = going.map((t, i) => ({ t, i })).sort((a, b) => (a.t.startedAt ?? 0) - (b.t.startedAt ?? 0) || a.i - b.i)
    const has = (t: TaskNode) => used.some(u => u.anchor === t.id && (t.startedAt === undefined || u.at === undefined || u.at >= t.startedAt))
    const free = order.filter(x => !has(x.t))
    const named = byName(going, names, phrases)
    if (named) return named.id
    if (free.length > 0) {
      const newest = Math.max(...free.map(x => x.t.startedAt ?? 0))
      const batch = free.filter(x => newest - (x.t.startedAt ?? 0) <= BATCH)
      return (batch[0] ?? free[0])!.t.id
    }
  }
  const inProgress = flat(list).some(t => t.status === 'open' && t.started !== undefined)
  const { anchor } = inProgress ? current(list) : { anchor: undefined }
  if (anchor === undefined) {
    if (open !== undefined && !list.some(t => t.turn === open)) return undefined
    const turns = list.flatMap(t => (t.turn === undefined ? [] : [t.turn]))
    const last = turns.length > 0 ? Math.max(...turns) : undefined
    const mine = list.filter(t => last === undefined || t.turn === last)
    const pending = flat(mine).filter(t => t.status === 'open' && t.children.length === 0 && t.started === undefined)
    const named = byName(pending, names, phrases)
    if (named) return named.id
    const newest = pending.reduce<TaskNode | undefined>((a, t) => (a === undefined || (t.plannedAt ?? -Infinity) >= (a.plannedAt ?? -Infinity) ? t : a), undefined)
    if (newest) {
      // Planned together (a tie): the first in order with no message of this session's yet; all with
      // one, the last (the person's decision, 2026-11-09, with no name matching).
      const batch = pending.filter(t => (t.plannedAt ?? -Infinity) === (newest.plannedAt ?? -Infinity))
      const free = batch.find(t => !used.some(u => u.anchor === t.id))
      return (free ?? newest).id
    }
    return startedLast(mine)?.id ?? mine[mine.length - 1]?.id
  }
  return anchor
}

// The tasks of the main loop with a question still open under them (sendAnchor's `asking`): the
// waits for a question, a plan or a choice, by the task they were opened on (a permission is none).
export const askingAnchors = (waits: Wait[]): string[] =>
  waits.filter(w => w.agent === MAIN && w.kind !== 'permission').flatMap(w => (w.anchor === undefined ? [] : [w.anchor]))
// Where this session's messages went (sendAnchor's `used`), with when: the sends kept, and the
// rounds of the sessions (a send already taken up is dropped from the sends, its round stays).
// A subagent launched from a task uses it too (`groups`, its card's anchor; the person, 2026-11-09: "Vai à
// pendente (Recomendado)"): the next message or launch goes to the next task.
export const usedAnchors = (children: Child[], sends: { anchor?: string; at?: number }[], groups: Group[] = []): Used[] => [
  ...sends.map(s => ({ anchor: s.anchor, at: s.at })),
  ...groups.flatMap(g => (g.sub && g.anchor !== undefined ? [{ anchor: g.anchor, at: g.sub.at }] : [])),
  ...children.flatMap(c => (c.rounds ?? []).map(r => ({ anchor: r.anchor, at: r.at }))),
  // A session opened from a task uses it as a message does (the person: "Abrir sessão conta como uso
  // da tarefa", 2026-10-28).
  ...children.flatMap(c => (c.anchor !== undefined && c.openedAt !== undefined ? [{ anchor: c.anchor, at: c.openedAt }] : [])),
]

// The open tasks with nothing open below them, for a reminder: '"1/1.2" Title; …'.
export function openList(list: TaskNode[]): string {
  const open = flat(list).filter(t => t.status === 'open' && !t.children.some(c => c.status === 'open'))
  const shown = open.slice(0, 10).map(t => `"${t.id}" ${t.title}`)
  return shown.join('; ') + (open.length > 10 ? `; e mais ${open.length - 10}` : '')
}


// A subagent's header, the loop that launched it, and the task that loop was on at
// launch: the Agent call recorded it (see tool.call), claimed here by its description.
export async function identify($: any, agent: string): Promise<Omit<Group, 'agent' | 'tasks'>> {
  const info = ((await $.agent.list()) as AgentInfo[]).find(a => a.id === agent)
  if (!info) return { label: 'Subagente' }
  const parent = info.parentId ?? MAIN
  let anchor: string | undefined
  await update($, launchesState, cur => {
    const list = cur ?? []
    const i = list.findIndex(l => l.parent === parent && l.description === info.description)
    anchor = i >= 0 ? list[i]!.anchor : undefined
    return i >= 0 ? list.filter((_, j) => j !== i) : list
  })
  return { label: `${info.type}: ${info.description}`, parent, anchor }
}

// A subagent's group exists from its first plan or wait on the person.
export async function ensureGroup($: any, agent: string) {
  if (agent === MAIN) return
  if ((await $.state.get(groupsState)).value?.some((g: Group) => g.agent === agent)) return
  const meta = await identify($, agent)
  await change($, all => (all.some(g => g.agent === agent) ? all : [...all, { agent, tasks: [], ...meta }]))
}

// Keeps the status line and the store (for a resume) in step with the panel. The status is set
// only when its text changes (the poll calls this every few seconds); `lastStatus` is a variable of
// the module, so a reload sets it once more.
let lastStatus: string | undefined | null = null
// It never throws: a failure is said once in the debug log, and the next write tries again (lastStatus
// is set only once the app took the text).
export async function showStatus($: any, groups: Group[]) {
  try {
    const { value: children = [] } = await $.state.get(childrenState)
    const { value: sends = [] } = await $.state.get(sendsState)
    // The whole session's count, the header's "sessão inteira" (sessionTotal): the rounds cut into
    // cards, a discarded round and a stopped session's pending tasks out, what was stopped interrupted.
    const [d, n] = sessionTotal(groups, children as Child[], sends as Send[], knownId())
    const text = d === n ? undefined : `Tarefas ${d}/${n}`
    if (lastStatus !== null && lastStatus === text) return
    await $.ui.status(text)
    lastStatus = text
  } catch (err) {
    await debugOnce($, `task-tree: status não atualizado: ${String(err)}`)
  }
}

// A session out of the store's list (new, or pruned by another session) writes its work, turn end
// and links again with the panel: the module's copies of what was already written are forgotten.
// Saved first, then published, the status line last (it never holds the panel back).
export async function persist($: any, groups: Group[]) {
  try {
    const { back } = await saveGroups($, groups)
    if (back) {
      lastTurn = undefined
      lastLinks = undefined
      await ensureTurn($)
      await saveTurn($)
      const { value: work } = await $.state.get(workState)
      if (Array.isArray(work)) await saveStore($, 'work', work)
    }
  } catch {}
  try {
    await publishPanel($)
  } finally {
    await showStatus($, groups)
  }
}
// A read of the store that failed, said once per record and reason; what the caller does is unchanged.
async function unread($: any, what: string, err: unknown) {
  await debugOnce($, `task-tree: store não lido (${what}): ${String(err)}`)
}

// Before groups the panel was one list (`tasks`): it moves into the main group, once,
// whichever comes first after a reload (session.start or a tool call).
export async function adopt($: any) {
  const { value: old = [] } = await $.state.get(legacyTasks)
  if (old.length === 0) return
  await update($, groupsState, cur =>
    withMain(cur ?? []).map(g => (g.agent === MAIN ? { ...g, tasks: [...old.map(migrate), ...g.tasks] } : g)),
  )
  await $.state.set(legacyTasks, [])
}

export async function change($: any, fn: (groups: Group[]) => Group[]): Promise<Group[]> {
  await ensureGroups($)
  await ensureWork($)
  await ensureLinks($)
  await adopt($)
  const groups = await update($, groupsState, cur => fn(withMain(cur ?? [])))
  await persist($, groups)
  return groups
}

export async function replace($: any, groups: Group[]) {
  await $.state.set(groupsState, groups)
  await persist($, groups)
}

// The session's panel as the store keeps it; its subagents do not come back, so what they left
// open is interrupted.
export async function keptGroups($: any, id: string): Promise<Group[] | undefined> {
  let kept: Group[] | undefined
  try {
    kept = (await loadStore($, 'groups', id)) as Group[] | undefined
  } catch (err) {
    await unread($, 'painel', err)
    throw err
  }
  return kept ? kept.map(g => (g.agent === MAIN ? g : { ...g, tasks: g.tasks.map(interrupt(undefined)) })) : undefined
}

// The panel out of the store (only the 30 sessions that wrote last keep theirs there) comes back
// from the file this session published (io/publish.ts), which lasts while the session exists in the
// app (the person, 2026-11-14: "Enquanto a sessão existir (Recomendado)"): its groups (what the
// subagents left open comes back interrupted, as from the store), the work, the letters, the
// messages received, the children with their ties and the turn's end, each into the state only where
// the state holds none. Once per module, and only in the desktop app (the file is by the app's id);
// answers the groups it brought (none when the file has no task). A drawing cannot write the state:
// it gets the groups, and the next write brings them back again.
let ownFileTried = false
export async function fromOwnFile($: any): Promise<Group[] | undefined> {
  if (ownFileTried) return undefined
  try {
    const id = await selfId($)
    if (id === undefined) return undefined
    ownFileTried = true
    const file = await readPublished($, id)
    const groups = file?.groups
    if (!file || !groups || !groups.some(g => g.tasks.length > 0)) return undefined
    const back = groups.map(g => (g.agent === MAIN ? g : { ...g, tasks: g.tasks.map(interrupt(undefined)) }))
    try {
      // The groups first: a caller that cannot write the state (a drawing) leaves the whole try to
      // the next one.
      if ((await $.state.get(groupsState)).value === undefined) await $.state.set(groupsState, back)
      if (file.work && (await $.state.get(workState)).value === undefined) await $.state.set(workState, file.work)
      // The children's ties (anchor, lastAnchor, rounds, openedAt): into the module's copy of the links
      // (a reread of the host's list gives them back), and into the children the state already has
      // without them (a reread that came first).
      for (const c of file.children) if (typeof c?.id === 'string' && !keptLinks.has(c.id)) keptLinks.set(c.id, linkOf(c))
      const { value: held } = await $.state.get(childrenState)
      if (held === undefined) {
        if (file.children.length > 0) await $.state.set(childrenState, file.children)
      } else if ((held as Child[]).some(c => c.anchor === undefined && file.children.some(f => f.id === c.id))) {
        await $.state.set(
          childrenState,
          (held as Child[]).map(c => {
            const f = c.anchor === undefined ? file.children.find(x => x.id === c.id) : undefined
            return f ? { ...c, anchor: f.anchor, lastAnchor: c.lastAnchor ?? f.lastAnchor, rounds: c.rounds ?? f.rounds, openedAt: c.openedAt ?? f.openedAt } : c
          }),
        )
      }
      if (file.sends && (await $.state.get(sendsState)).value === undefined) await $.state.set(sendsState, file.sends)
      if (file.received && (await $.state.get(receivedState)).value === undefined) await $.state.set(receivedState, file.received)
      // The turn's end, unless this module already settled it (a prompt woke the loop first).
      if (file.turn && !loaded.has('turn') && (await $.state.get(turnEndedState)).value === undefined) {
        await $.state.set(turnEndedState, file.turn.ended)
        await $.state.set(turnAbortedState, file.turn.aborted)
        await $.state.set(replanDueState, file.turn.replan)
        await $.state.set(turnFailedState, file.turn.failed === true)
        loaded.add('turn')
      }
    } catch {
      ownFileTried = false
    }
    await debug($, `task-tree: painel trazido do arquivo publicado (${id}), fora do store`)
    return back
  } catch {
    return undefined
  }
}
// At session.start of a new process with no panel in the store: the one from the file comes back
// and is written to the store (replace), so the session is back among the 30.
export async function restoreFromOwnFile($: any): Promise<boolean> {
  const groups = await fromOwnFile($)
  if (groups) await replace($, groups)
  return groups !== undefined
}

// A resumed session's panel comes back; answers whether the store had it.
export async function restore($: any, id: string): Promise<boolean> {
  const groups = await keptGroups($, id)
  if (groups) await replace($, groups)
  return groups !== undefined
}
// The waits and the done's summary belong to the session that set them: a /clear
// or a resume drops them, without publishing (the replace that follows publishes).
export async function dropHeld($: any) {
  await $.state.set(waitsState, [])
  await $.state.set(briefState, '')
}

// The groups' "first use" of the table (restoredAt): session.start brings them back from the store
// when the state holds none (a new process); a process that restarted without it (the hooks worker
// respawned after a crash) would otherwise start from nothing: the first write would then overwrite
// the store with the reduced panel, and the panel and the published file would show it empty. So
// the first write, drawing or publication of the module brings them back first (`loaded`), as the
// first use does for the links (ensureLinks).
// Answers the groups it brought back, for a caller that cannot write the state (a drawing): the
// module counts them as loaded only once they are in the state, so the next write brings them back
// again if this one could not.
export async function ensureGroups($: any): Promise<Group[] | undefined> {
  if (loaded.has('groups') || !restoredAt('groups', 'first-use')) return undefined
  try {
    if ((await $.state.get(groupsState)).value !== undefined) {
      loaded.add('groups')
      return undefined
    }
    const groups = (await keptGroups($, await $.session.id())) ?? (await fromOwnFile($))
    if (groups === undefined) {
      loaded.add('groups')
      return undefined
    }
    try {
      await $.state.set(groupsState, groups)
      loaded.add('groups')
    } catch {}
    return groups
  } catch {
    return undefined
  }
}
// The work's "first use" (the table's restoredAt), as ensureGroups: a restart without
// session.start would otherwise let the next plan write its own work over the store's (the panel
// would lose the work in progress). It answers what it brought, for a drawing that cannot write the
// state, and counts the key as loaded only once the state holds it. With nothing in the store,
// nothing is brought: the pane keeps its default.
export async function ensureWork($: any): Promise<string[] | undefined> {
  if (loaded.has('work') || !restoredAt('work', 'first-use')) return undefined
  try {
    if ((await $.state.get(workState)).value !== undefined) {
      loaded.add('work')
      return undefined
    }
    const saved = await loadStore($, 'work')
    if (!Array.isArray(saved)) {
      loaded.add('work')
      return undefined
    }
    const work = saved.map(String)
    try {
      await $.state.set(workState, work)
      loaded.add('work')
    } catch {}
    return work
  } catch (err) {
    await unread($, 'trabalho', err)
    return undefined
  }
}

// The desktop app's own tools (`mcp__ccd_…`) exist only there. If the list fails, assume
// the app, so a real failure still shows.
export async function inDesktopApp($: any) {
  try {
    return (await $.tool.list()).some((t: any) => String(t.name).startsWith('mcp__ccd_'))
  } catch {
    return true
  }
}

// This session's id as the desktop app names it (local_…); none outside the app.
export let ownId: string | undefined
// The id as known so far, for a reader that must not ask the app (the render).
export const knownId = () => ownId
// The names of sessions known by id (`names`): written only when one is new or changed, the last
// NAMES_KEEP. A just-opened session's placeholder title ("Sessão…") names nothing.
const NAMES_KEEP = 200
export async function learnNames($: any, pairs: [string, string][]) {
  const got = pairs.filter(([id, name]) => typeof id === 'string' && id !== '' && typeof name === 'string' && name.trim() !== '' && !name.endsWith('…'))
  if (got.length === 0) return
  const { value: cur = {} } = await $.state.get(namesState)
  const held = cur as Record<string, string>
  if (got.every(([id, name]) => held[id] === name)) return
  const next = new Map(Object.entries(held))
  for (const [id, name] of got) {
    next.delete(id)
    next.set(id, name)
  }
  await $.state.set(namesState, Object.fromEntries([...next].slice(-NAMES_KEEP)))
}

export async function selfId($: any): Promise<string | undefined> {
  if (ownId) return ownId
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })
    const body = r.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('')
    if (!r.isError) {
      const got = JSON.parse(body)
      ownId = got.sessionId
      // Its own name, if the app gives it: a child's letter to this session is drawn with it.
      const name = typeof got?.name === 'string' && got.name !== '' ? got.name : typeof got?.title === 'string' ? got.title : ''
      if (typeof ownId === 'string' && name !== '') await learnNames($, [[ownId, name]])
    }
    else await debug($, `task-tree: get_session falhou: ${body.slice(0, 300)}`)
  } catch (err) {
    await debug($, `task-tree: get_session falhou: ${String(err)}`)
  }
  return ownId
}

// This session's repository and branch, or its folder with no repository (io/git.ts), read again at
// every publication and at the clock's tick (a checkout or a worktree changes the branch
// mid-session; it is a 40-byte file): kept in the state for the header, published for the card.
// Returns what it read.
export async function refreshGit($: any): Promise<GitInfo | undefined> {
  const now = await readGit($)
  const { value: cur } = await $.state.get(gitState)
  const same = cur
    ? now !== undefined &&
      (cur.kind ?? 'git') === (now.kind ?? 'git') &&
      cur.repo === now.repo &&
      cur.branch === now.branch &&
      (cur.detached ?? false) === (now.detached ?? false)
    : now === undefined
  if (!same) await $.state.set(gitState, now ? { ...now, at: (await stamp($)) ?? 0 } : null)
  return now
}

// Publishes this session's panel (io/publish.ts): gathers it from the state here, where the kit
// wants the state keys literal, and what the last drawing left. The children go cut to their current
// work (trimPublished): the state keeps them whole, so this panel does not change.
export async function publishPanel($: any) {
  await ensureGroups($)
  await ensureWork($)
  await ensureLinks($)
  await saveLinks($)
  try {
    const id = await selfId($)
    const git = await refreshGit($)
    const { value: waits = [] } = await $.state.get(waitsState)
    const { value: groups = [] } = await $.state.get(groupsState)
    const { value: children = [] } = await $.state.get(childrenState)
    const { value: work } = await $.state.get(workState)
    const { value: received = [] } = await $.state.get(receivedState)
    const { value: engine } = await $.state.get(engineState)
    const { value: ultracode } = await $.state.get(ultracodeState)
    const { value: rate } = await $.state.get(rateState)
    const { value: sends = [] } = await $.state.get(sendsState)
    // Whether the last turn was stopped (turn.complete's isAborted, cleared by the next prompt): the
    // session that opened this one reads the round it left open as discarded.
    const { value: aborted } = await $.state.get(turnAbortedState)
    // The turn's end as the store's `turn` record holds it, for the panel to come back from the file.
    const { value: ended } = await $.state.get(turnEndedState)
    const { value: replan } = await $.state.get(replanDueState)
    const { value: failed } = await $.state.get(turnFailedState)
    const turn = { ended: typeof ended === 'number' ? ended : null, aborted: aborted === true, replan: replan === true, ...(failed === true ? { failed: true } : {}) }
    const cut = (children as Child[]).map(c => (c.panel || c.tasks ? { ...c, panel: trimPublished(rawPanel(c)), tasks: undefined } : c))
    await publishWait($, id, { groups, waits, children: cut, turn, work, received, engine, ultracode: ultracode === true, rate: rate ?? undefined, git, aborted: aborted === true, sends, renderError: drawn.error, drawSize: drawn.size, rows: drawn.rows })
  } catch (err) {
    await debug($, `task-tree: painel não publicado: ${String(err)}`)
  }
}

// What each of the pane's Buttons does, by its key, as the last drawing made it. The host keeps a
// Button's onPress only for the life of the drawing it is in, and the pane is drawn again every
// second while a task runs (its clock): a press landing as the drawing is replaced reached a
// handler already gone, and nothing happened (the person's words: "as vezes clico nas acoes e nao
// faz nada, preciso clicar algumas vezes para funcionar"). The ui.press hook below answers by key
// with the latest action instead.
// The last drawing's size (serialized), and the most a drawing may be: past it the render draws fewer
// lines and, as the last resort, only a warning line (hooks/render.tsx). A 1.3 MB one was not shown by
// the app (the person's words: "resumir os 57 pedidos anteriores resolveu"). 20 MB was tried on
// 2026-11-04 and froze the pane: the app did not apply a
// drawing of ~950 KB and kept the last one it took (the person: "eu quero ver as tarefas em andamento,
// e quando aparecer essa mensagem, quero que tenha um botao ali, pra voltar a visualizar as mensagens
// em andamento"). Back to 600 KB: the small warning, with its button, reaches the app.
export const DRAW_LIMIT = 600 * 1024
// The last drawing: its size (serialized), its lines (after the limit, published with the size for
// the session that opened this one to see how big its children's panels are) and its error, if it
// threw (see the render hook), published with the panel. Written by the render (hooks/render.tsx).
export const drawn: { size: number; rows: number; error: string | undefined } = { size: 0, rows: 0, error: undefined }
export const actions = new Map<string, () => void>()
export const act = (key: string, fn: () => void) => {
  actions.set(key, fn)
  return fn
}

// The panel opened with the session (session.start, once per process) is opened unasked, and the app places an
// unasked pane only in a window of 144 columns or more (110 once asked): after a restart of the
// session's process (a /model change does one), in a narrower window, it stayed undrawn while the
// tools went on answering (the person's words: "eu troquei o modelo de opus para sonnet na
// orquestradora, e o task tree nao rendenizou a partir dai"). Opened again from the person's own
// prompt, it is asked, and placed at any width; only when it is not on screen already.
export async function showPane($: any) {
  try {
    const panes = (await $.ui.panes()) as readonly { id: string; isPlaced?: boolean }[]
    if (panes.some(p => p.id === PANE && p.isPlaced)) return
    const r = await $.ui.open({ id: PANE, title: 'Tarefas' })
    if (!r?.isPlaced) await debug($, `task-tree: painel não aberto: ${String(r?.reason ?? '')}`)
  } catch {}
}

export async function addWait($: any, w: Wait) {
  await ensureGroup($, w.agent)
  await update($, waitsState, cur => [...(cur ?? []), w])
  await publishPanel($)
}
export async function dropWaits($: any, keep: (w: Wait) => boolean) {
  const before = (await $.state.get(waitsState)).value ?? []
  const after = await update($, waitsState, cur => (cur ?? []).filter(keep))
  if (after.length !== before.length) await publishPanel($)
}
// The calls in progress by `<agent>:<tool>`: a permission wait goes when the last of them ends
// (a reload mid-call starts it over: the end of that call drops the wait, as before).
export const inCall = new Map<string, number>()
// The end of the main loop's turn: a permission wait left over (its call never ended here) goes.
export async function dropPermissions($: any, agent: string) {
  for (const k of [...inCall.keys()]) if (k.startsWith(`${agent}:`)) inCall.delete(k)
  const left = (w: Wait) => w.agent === agent && w.kind === 'permission'
  const { value = [] } = await $.state.get(waitsState)
  if ((value as Wait[]).some(left)) await dropWaits($, w => !left(w))
}
// The agent's open question or plan dialog, once the agent has gone on without it.
export async function dropAsked($: any, agent: string) {
  const asked = (w: Wait) => w.agent === agent && (w.kind === 'question' || w.kind === 'plan')
  const { value = [] } = await $.state.get(waitsState)
  if ((value as Wait[]).some(asked)) await dropWaits($, w => !asked(w))
}

// A press on a line's ▾/▸: the line stays as the person left it (closed or open) until they
// press it again. Written from onPress, since a render may not write.
// The current work (what the panel draws): the main group's level-1 tasks of the person's
// current request, with those of earlier requests still going on. A plan or start of the main loop
// in a new request (another message of the person) starts new work: the new level-1 tasks, plus the
// ones of the work before that still have something open (goingOn);
// the requests all done leave it (the person's words: "segundo a regra antiga, na visão resumida,
// ficam somente as tarefas novas do turno"). Within the request of the current work its level-1
// tasks join it. With no requests recorded (panels from before turns), new work starts only with
// no open leaf anywhere, as before. Kept in the state and in the store under the session, like the
// view.
export async function nothingOpen($: any): Promise<boolean> {
  await ensureGroups($)
  await ensureWork($)
  const { value: groups = [] } = await $.state.get(groupsState)
  const { value: children = [] } = await $.state.get(childrenState)
  return activeLeaves({ groups: withMain(groups), waits: [], children }, 0) === 0
}
// New work starts with another message of the person: within the turn of the current work, a plan
// (even after all was closed) joins it. A session left with an open task no longer holds every later
// request in the current work (it did: the summary piled up the finished requests of the whole day).
export async function startsWork($: any): Promise<boolean> {
  // After a reload with no session.start, the groups and the work come back from the store first.
  await ensureGroups($)
  await ensureWork($)
  const { value: groups = [] } = await $.state.get(groupsState)
  const main = withMain(groups as Group[]).find(g => g.agent === MAIN)
  const now = main?.turns?.[main.turns.length - 1]?.id
  if (now === undefined) return nothingOpen($)
  const { value: work = [] } = await $.state.get(workState)
  return !(main?.tasks ?? []).some(t => (work as string[]).includes(t.id) && t.turn === now)
}
export async function setWork($: any, ids: string[]) {
  await $.state.set(workState, ids)
  await saveStore($, 'work', ids)
}
// A plan renames the level-1 tasks whose id it reuses without replanning them (planTool); `old` gives
// the id of such a task's old copy. The work follows the task to that copy, as the sessions' ties and
// the sends do (renameAnchors): the bare id now names the new task, which comes in with `ids`. So
// the old copy is checked like any other task of the work before: a session at work under it, or a
// letter still queued from it, holds its request in sight, the card under the task it came from and
// not loose at the end (the person, 2026-11-12: "Sim, fica à vista (Recomendado)"); with nothing open
// in sight, it leaves with its request.
// New work also deletes the subagents' groups that ended with no tasks, once their request is out of
// it (dropSettledSubs).
export async function joinWork($: any, ids: string[], fresh: boolean, old: (id: string) => string = id => id) {
  if (ids.length === 0) return
  const { value = [] } = await $.state.get(workState)
  const cur = (value as string[]).map(old)
  if (!fresh) return setWork($, [...new Set([...cur, ...ids])])
  // New work: with anything still open in sight (a task, a ✉, a card with an open task), the work
  // before stays whole, the new request below it; with nothing open, the new request alone (openInSight).
  const { value: groups = [] } = await $.state.get(groupsState)
  const { value: children = [] } = await $.state.get(childrenState)
  const { value: sends = [] } = await $.state.get(sendsState)
  const kept = openInSight({ groups: withMain(groups as Group[]), waits: [], children }, cur, sends as Send[], knownId()) ? cur : []
  const work = [...new Set([...kept, ...ids])]
  await setWork($, work)
  await dropSettledSubs($, work)
}
// A subagent's group lives from its launch until its request leaves the work (the person,
// 2026-11-14: "Apagar os sem tarefas (Recomendado)"): when new work starts, the groups of the
// subagents that ended without planning a task are deleted, once their request is out of the work
// and nothing alive depends on them. A group with tasks of its own stays, with its request, in "+N
// pedidos anteriores". Before, every launch added a group for good: the panel, the store and the
// published file grew with every workflow.
export function settledSubs(groups: Group[], work: string[], waits: Wait[], sends: Send[]): string[] {
  const byAgent = new Map(groups.map(g => [g.agent, g]))
  // The level-1 task of the main group the group came from, up through who launched it.
  const origin = (g: Group): string | undefined => {
    const seen = new Set<string>()
    let at: Group | undefined = g
    while (at && at.parent !== undefined && at.parent !== MAIN) {
      if (seen.has(at.agent)) return undefined
      seen.add(at.agent)
      at = byAgent.get(at.parent)
    }
    return at?.anchor?.split('/')[0]
  }
  return groups
    .filter(g => g.agent !== MAIN && g.tasks.length === 0 && !subLive(g.sub))
    .filter(g => {
      const from = origin(g)
      return from === undefined || !work.includes(from)
    })
    .filter(g => !groups.some(c => c.parent === g.agent && subLive(c.sub)))
    .filter(g => !waits.some(w => w.agent === g.agent))
    .filter(g => !sends.some(s => s.agent === g.agent && !s.taken && !s.lost))
    .map(g => g.agent)
}
async function dropSettledSubs($: any, work: string[]) {
  const { value: groups = [] } = await $.state.get(groupsState)
  const { value: waits = [] } = await $.state.get(waitsState)
  const { value: sends = [] } = await $.state.get(sendsState)
  if (settledSubs(groups as Group[], work, waits as Wait[], sends as Send[]).length === 0) return
  await change($, all => {
    const gone = settledSubs(all, work, waits as Wait[], sends as Send[])
    return all.filter(g => !gone.includes(g.agent))
  })
}
// What ties the sessions' cards to their tasks (the sessions this one opened, with the tasks and
// rounds of their messages; the sends still waiting; the messages received; the subagents'
// launches) lives in the state, which a hot reload of the mod keeps and a new process (a respawn,
// /model, a restart) starts empty: kept in the store too, and brought back when the state has none,
// else the cards fall to the root and the chains lose their origin. A reload starts this module's
// variables over (`loaded`, keptLinks): the first use of the links (ensureLinks) reads the store's
// record again, refills keptLinks, and takes a key from it only when the state has none. With the
// state kept, the state is the truth: the store's entries were merged over it before, and a letter
// marked in the state only (its delivery noted, its anchor renamed by a plan) came back as a second
// copy.
// The links as the store holds them, by session id, this module's copy. The state's `children` are
// the sessions the host lists (refreshChildren rebuilds them from the list, archived ones included);
// a session the list leaves out for a while is not in the state, so a save from the state alone
// would drop its ties from the store for good. The save keeps those entries, and a session the host
// lists again gets its ties back from here (refreshChildren, recordStart). Nothing is drawn from
// here: a session shows only while the host lists it.
export let keptLinks = new Map<string, Link>()
export const keptLink = (id: string): Link | undefined => keptLinks.get(id)
// The sessions this one opened before a /clear (their ids, the last 200): left behind, with no card
// here from then on (the person, 2026-11-14: "Some na hora"). The host's list still names them (by
// the local_ id, which the /clear keeps): the reread leaves them out (refreshChildren), and a message
// to one of them shows only its letter (sentMessage). Kept in the links record (`left`) and refilled
// whenever it is read or written, as keptLinks: a reload brings it back on first use (ensureLinks).
let leftBehind = new Set<string>()
export const isLeftBehind = (id: string) => leftBehind.has(id)
const LEFT_KEEP = 200
// A plan that reuses the id of a closed task renames the closed one (`tag:id`, its subtasks with
// it, see planTool): the sessions' ties to it (the task they were opened on, the task of their last
// message, each message's task), the launches' and the sends' are renamed with it, or they would
// point at the new task with that id, and every card of every earlier request would fall under it
// (the person's panel: a request that sent nothing showed the cards of the whole day). The module's
// copy of the links (keptLinks) is renamed too, so a later save keeps the renamed ties. The
// subagents' groups go with it in planTool's own change (renamedAnchor), for every loop.
// An anchor under a renamed id (the id or a task below it) renamed with it: `tag:` before it, as
// planTool renames the tasks.
export const renamedAnchor = (ids: string[], tag: string) => (a?: string) =>
  a !== undefined && ids.some(id => a === id || a.startsWith(id + '/')) ? tag + ':' + a : a
export async function renameAnchors($: any, ids: string[], tag: string) {
  if (ids.length === 0) return
  await moveAnchors($, renamedAnchor(ids, tag), true)
}
// The folds the person left on the tasks a plan renames (`ids`, level-1 tasks of the group of `agent`)
// go with them: in this session's panel the key of a task is its group's scope (`<agent>|`, the main
// group's `|`) and `t:<id>`, so a new task that reuses the id is born open, and the old one, now
// history (`<tag>:<id>`), stays as the person left it. The folds inside a session's card are that
// session's to rename.
export async function renameFolds($: any, agent: string, ids: string[], tag: string) {
  if (ids.length === 0) return
  const head = `${agent}|t:`
  const fix = (k: string) => {
    if (!k.startsWith(head)) return k
    const id = k.slice(head.length)
    const hit = ids.find(x => id === x || id.startsWith(x + '/'))
    return hit === undefined ? k : `${head}${tag}:${id}`
  }
  await update($, collapsedState, cur => {
    const all = cur ?? {}
    if (!Object.keys(all).some(k => fix(k) !== k)) return all
    return Object.fromEntries(Object.entries(all).map(([k, v]) => [fix(k), v]))
  })
}
// A replan in place that leaves a subtask out (the level-1 task kept, carry): the ties to it (and to
// any task below it) go to that level-1 task, so the card of a session opened from it stays under the
// level-1 task, at work or done, its tasks in the count (the person, 2026-11-14: "Sob o nível 1
// (Recomendado)"); it went loose at the end and left once done. The sends keep their own rule (the
// letter hangs from the request's level-1 task until delivered); the subagents' groups go in planTool's
// change. `gone`: each id left out, with the level-1 task it was in.
export const movedAnchor = (gone: Map<string, string>) => (a?: string) => (a !== undefined && gone.has(a) ? gone.get(a) : a)
export async function moveToLevelOne($: any, gone: Map<string, string>) {
  if (gone.size === 0) return
  await moveAnchors($, movedAnchor(gone), false)
}
// The sessions' ties, the launches' (and the sends', with `sends`) and the module's copy of the links,
// by `fix`.
async function moveAnchors($: any, fix: (a?: string) => string | undefined, sends: boolean) {
  const link = <T extends { anchor?: string; lastAnchor?: string; rounds?: { at: number; anchor?: string }[] }>(c: T): T => {
    const out = { ...c }
    if (c.anchor !== undefined) out.anchor = fix(c.anchor)
    if (c.lastAnchor !== undefined) out.lastAnchor = fix(c.lastAnchor)
    if (c.rounds !== undefined) out.rounds = c.rounds.map(r => (r.anchor === undefined ? r : { ...r, anchor: fix(r.anchor) }))
    return out
  }
  await update($, childrenState, cur => (cur ?? []).map(link))
  await update($, launchesState, cur => (cur ?? []).map(l => (l.anchor === undefined ? l : { ...l, anchor: fix(l.anchor) })))
  if (sends) await update($, sendsState, cur => (cur ?? []).map(s => (s.anchor === undefined ? s : { ...s, anchor: fix(s.anchor) })))
  for (const [id, k] of keptLinks) keptLinks.set(id, link(k))
}
// The record as it was last written to the store (a variable of the module: a reload writes once
// more): the poll publishes every few seconds, and the store is written only when the record changed.
let lastLinks: string | undefined
export async function saveLinks($: any) {
  await ensureLinks($)
  try {
    const { value: children } = await $.state.get(childrenState)
    const { value: sends } = await $.state.get(sendsState)
    const { value: received } = await $.state.get(receivedState)
    const { value: launches } = await $.state.get(launchesState)
    const { value: receipts } = await $.state.get(receiptsState)
    const listed = ((children as Child[] | undefined) ?? []).map(linkOf)
    const links = [...listed, ...[...keptLinks.values()].filter(k => !listed.some(c => c.id === k.id))]
    const record = { children: links, sends, received, receipts, launches, left: [...leftBehind].slice(-LEFT_KEEP) }
    const key = JSON.stringify(record)
    if (key !== lastLinks && (await saveStore($, 'children', record))) lastLinks = key
    keptLinks = new Map(links.map(l => [l.id, l]))
  } catch {}
}
// The links' "first use" (the table's restoredAt), as ensureGroups: once per module, before any write
// of the links (and at session.start), the store's record is read: keptLinks is refilled from it, and
// each of the five keys is taken from it only when the state has none (a new process); a state kept
// through a reload stays as it is. Counted as brought only once the store answered.
export async function ensureLinks($: any) {
  if (loaded.has('links') || !restoredAt('children', 'first-use')) return
  try {
    const saved = (await loadStore($, 'children')) as Record<string, unknown> | undefined
    if (saved !== undefined && saved !== null && typeof saved === 'object') {
      const list = (k: string) => (Array.isArray(saved[k]) ? (saved[k] as any[]) : [])
      keptLinks = new Map((list('children') as Child[]).filter(o => typeof o?.id === 'string').map(o => [o.id, linkOf(o)]))
      leftBehind = new Set(list('left').filter(x => typeof x === 'string').map(String))
      if ((await $.state.get(childrenState)).value === undefined && list('children').length > 0) await $.state.set(childrenState, list('children'))
      if ((await $.state.get(sendsState)).value === undefined && list('sends').length > 0) await $.state.set(sendsState, list('sends'))
      if ((await $.state.get(receivedState)).value === undefined && list('received').length > 0) await $.state.set(receivedState, list('received'))
      if ((await $.state.get(launchesState)).value === undefined && list('launches').length > 0) await $.state.set(launchesState, list('launches'))
      const marks = saved.receipts
      if ((await $.state.get(receiptsState)).value === undefined && marks !== null && typeof marks === 'object' && !Array.isArray(marks)) await $.state.set(receiptsState, marks as Record<string, { at: number; n: number }>)
    }
    loaded.add('links')
  } catch (err) {
    await unread($, 'ligações', err)
  }
}
// /clear in a session that opened others: their cards go at once, with the rest of the panel, and do
// not come back (the person, 2026-11-14: "Some na hora"). Their ids join the ones left behind; the
// children, the launches, the sessions whose turn ended and the module's copy of the links are
// emptied, and the record goes to the store. Before the publication of the empty panel.
export async function forgetChildren($: any) {
  await ensureLinks($)
  try {
    const kids = ((await $.state.get(childrenState)).value ?? []) as Child[]
    const ids = [...kids.map(c => c.id), ...keptLinks.keys()]
    leftBehind = new Set([...[...leftBehind].filter(id => !ids.includes(id)), ...ids].slice(-LEFT_KEEP))
    await $.state.set(childrenState, [])
    await $.state.set(launchesState, [])
    await $.state.set(endedState, [])
    keptLinks = new Map()
    await saveLinks($)
  } catch {}
}
// A resume replaces the groups with the resumed session's (restore): its work comes with them, kept
// under the new session too. With the old work's ids gone from the groups the panel drew nothing.
export async function restoreWorkOf($: any, id: string) {
  loaded.add('work')
  try {
    const saved = await loadStore($, 'work', id)
    await setWork($, Array.isArray(saved) ? saved.map(String) : [])
  } catch (err) {
    await unread($, 'trabalho', err)
  }
}
export async function restoreWork($: any) {
  loaded.add('work')
  const { value: cur } = await $.state.get(workState)
  if (cur !== undefined) return
  try {
    const saved = await loadStore($, 'work')
    if (Array.isArray(saved)) await $.state.set(workState, keepCurrent(cur, saved.map(String)))
  } catch (err) {
    await unread($, 'trabalho', err)
  }
}

