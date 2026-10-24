// The panel's state and how the hooks change it: the state's keys, the groups and their turns, the
// waits, the view, the current work, the ties to the sessions (links), the publication of the panel
// and the restores after a restart or a reload (../state/durability says where each lives). Every
// hook file uses these; nothing here registers a hook.

import { update } from 'claude-code'
import type { AgentInfo } from 'claude-code'

import type { Child, GitInfo, Group, LegacyNode, TaskNode, Wait } from '../types'
import { current as keepCurrent, linkOf, loadStore, loaded, merge, restoredAt, saveGroups, saveStore } from '../state/durability'
import type { Link } from '../state/durability'
import { MAIN, flat, withMain, interrupt, total, activeLeaves, current, openInSight, startedLast } from '../draw/layout'
import { debug } from '../io/log'
import { readGit } from '../io/git'
import { publishWait } from '../io/publish'

export const PANE = 'task-tree'
// The state's keys, as literals (the kit's validator wants them written in the file that calls $.state,
// and not exported: each hook file declares the ones it uses). Where each
// lives and how it comes back is the durability table's (../state/durability), which has a row
// for every one of them (tests/durabilidade.test.ts).
const legacyTasks = { plugin: 'task-tree', key: 'tasks' } as const
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
const launchesState = { plugin: 'task-tree', key: 'launches' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const

// The main loop works again (a prompt, or a call of its own): what the last turn left open is in
// progress again, no longer drawn as halted (see turnEnded).
export async function wake($: any) {
  if (typeof (await $.state.get(turnEndedState)).value === 'number') await $.state.set(turnEndedState, null)
}
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const childrenErrorState = { plugin: 'task-tree', key: 'childrenError' } as const
const endedState = { plugin: 'task-tree', key: 'ended' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const viewState = { plugin: 'task-tree', key: 'view' } as const
const workState = { plugin: 'task-tree', key: 'work' } as const
const receivedState = { plugin: 'task-tree', key: 'received' } as const
const engineState = { plugin: 'task-tree', key: 'engine' } as const
const rateState = { plugin: 'task-tree', key: 'rate' } as const
const gitState = { plugin: 'task-tree', key: 'git' } as const
const briefState = { plugin: 'task-tree', key: 'brief' } as const
const recapState = { plugin: 'task-tree', key: 'recap' } as const
// The turn's answer in a few words, as the session gave it (done's `summary`), until the turn ends.
// In the state, not a variable of the module: a reload of the mod between the done and the end of
// the turn (saving a file of the mod mid-turn) kept the variable's value nowhere, and the ↩ line
// lost the summary. Empty: none given.
export async function lastBrief($: any): Promise<string | undefined> {
  const { value } = await $.state.get(briefState)
  return typeof value === 'string' && value !== '' ? value : undefined
}
// The recap of the end-of-turn box (wrap_up), the turn's answer for the card (see turn.complete),
// until the turn ends. In the state for the same reason as the brief: a reload between the wrap_up
// and the end of the turn kept a module variable's value nowhere, and the card showed the final
// message instead of the recap. Empty: none given.
export async function lastRecap($: any): Promise<string | undefined> {
  const { value } = await $.state.get(recapState)
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The request's reminders, variables of the module (a reload starts them over): the main loop's
// tool calls since a plan was last open (see the tool.call reminder); whether the current request
// already used the panel (plan, start or done: with everything closed, its last calls need no
// reminder to plan); whether the last question was answered by a chat message instead of an option
// (that message, at the next prompt, is the answer).
export const reminders = { unplanned: 0, planned: false, answeredInChat: false }

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
export async function openTurn($: any, text: string, own = false) {
  // A message from another session comes wrapped in tags: its words are the title.
  const line = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Pedido'
  const title = line.length > 60 ? `${line.slice(0, 59)}…` : line
  const at = await stamp($)
  await change($, all =>
    all.map(g => {
      if (g.agent !== MAIN) return g
      const turns = g.turns ?? []
      // The turns still holding a level-1 task stay (by a set of the tasks' turns: one pass each).
      const withTasks = new Set(g.tasks.map(t => t.turn))
      const used = turns.filter(u => withTasks.has(u.id))
      const id = turns.reduce((top, u) => Math.max(top, u.id), 0) + 1
      // The person's own prompt in this session is marked (`own`): the card of this turn, in the
      // session that opened this one, goes at the end of the request that opened it.
      return { ...g, turns: [...used, { id, title, at, ...(own ? { own: true } : {}) }] }
    }),
  )
}


// The task a message is sent from: the task in progress, unless an open task was planned after
// it was started (planned to send, sent with no start): that newest one. With nothing in progress
// (the person's decision: "envio feito sem tarefa em andamento ancora na última iniciada do pedido
// atual, mesmo concluída; sem nenhuma iniciada, no fim do pedido"): the task started last in the
// current request (the last turn with tasks), else that request's last level-1 task. It was the first
// open task, the next pending step: its card went under "Passo 2" and "Passo 3" closed on delivery.
export function sendAnchor(list: TaskNode[]): string | undefined {
  // Nothing open and started is nothing in progress (current() would light the first open task, of
  // any request). Then, in the current request (the person's decisions): its pending task with no
  // subtasks (○, ✉ until the delivery), the one planned last (a tie, the later in order); none
  // pending, the rule above. It took the task started last even with one pending, planned to send:
  // the card went under the closed task before it.
  const inProgress = flat(list).some(t => t.status === 'open' && t.started !== undefined)
  const { anchor } = inProgress ? current(list) : { anchor: undefined }
  if (anchor === undefined) {
    const turns = list.flatMap(t => (t.turn === undefined ? [] : [t.turn]))
    const last = turns.length > 0 ? Math.max(...turns) : undefined
    const mine = list.filter(t => last === undefined || t.turn === last)
    const pending = flat(mine).filter(t => t.status === 'open' && t.children.length === 0 && t.started === undefined)
    const newest = pending.reduce<TaskNode | undefined>((a, t) => (a === undefined || (t.plannedAt ?? -Infinity) >= (a.plannedAt ?? -Infinity) ? t : a), undefined)
    if (newest) return newest.id
    return startedLast(mine)?.id ?? mine[mine.length - 1]?.id
  }
  const leaves = flat(list).filter(t => t.status === 'open' && t.children.length === 0)
  const since = (t?: TaskNode) => (t === undefined ? undefined : t.started !== undefined ? t.startedAt : t.plannedAt)
  const base = since(flat(list).find(t => t.id === anchor))
  let pick = anchor
  let top = base ?? -Infinity
  for (const t of leaves) {
    const at = t.plannedAt
    if (t.started === undefined && at !== undefined && at > top) {
      pick = t.id
      top = at
    }
  }
  return pick
}

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
    anchor = i >= 0 ? list[i].anchor : undefined
    return i >= 0 ? list.filter((_, j) => j !== i) : list
  })
  return { label: `${info.type}: ${info.description}`, parent, anchor }
}

// A subagent's group exists from its first plan or wait on the person.
export async function ensureGroup($: any, agent: string) {
  if (agent === MAIN) return
  if ((await $.state.get(groupsState)).value?.some(g => g.agent === agent)) return
  const meta = await identify($, agent)
  await change($, all => (all.some(g => g.agent === agent) ? all : [...all, { agent, tasks: [], ...meta }]))
}

// Keeps the status line and the store (for a resume) in step with the panel. The status is set
// only when its text changes (the poll calls this every few seconds); `lastStatus` is a variable of
// the module, so a reload sets it once more.
let lastStatus: string | undefined | null = null
export async function showStatus($: any, groups: Group[]) {
  const { value: children = [] } = await $.state.get(childrenState)
  const [d, n] = total({ groups, waits: [], children })
  const text = d === n ? undefined : `Tarefas ${d}/${n}`
  if (lastStatus !== null && lastStatus === text) return
  lastStatus = text
  $.ui.status(text)
}

export async function persist($: any, groups: Group[]) {
  await showStatus($, groups)
  try {
    await saveGroups($, groups)
  } catch {}
  await publishPanel($)
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
  await ensureView($)
  await ensureWork($)
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
  const kept = (await loadStore($, 'groups', id)) as Group[] | undefined
  return kept ? kept.map(g => (g.agent === MAIN ? g : { ...g, tasks: g.tasks.map(interrupt(undefined)) })) : undefined
}

// A resumed session's panel comes back.
export async function restore($: any, id: string) {
  const groups = await keptGroups($, id)
  if (groups) await replace($, groups)
}

// The groups' "first use" of the table (restoredAt): session.start brings them back from the store
// when the state holds none (a new process); a process that restarted without it (the hooks worker
// respawned after a crash) would otherwise start from nothing: the first write would then overwrite
// the store with the reduced panel, and the panel and the published file would show it empty. So
// the first write, drawing or publication of the module brings them back first (`loaded`), as the
// first save does for the links.
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
    const groups = await keptGroups($, await $.session.id())
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
// The view's and the work's "first use" (the table's restoredAt), as ensureGroups: a restart
// without session.start would otherwise draw the default view and let the next plan write its own
// work over the store's (the summary view would lose the work in progress). Each answers what it
// brought, for a drawing that cannot write the state, and counts the key as loaded only once the
// state holds it. With nothing in the store, nothing is brought: the pane keeps its defaults.
export async function ensureView($: any): Promise<'full' | 'summary' | undefined> {
  if (loaded.has('view') || !restoredAt('view', 'first-use')) return undefined
  try {
    if ((await $.state.get(viewState)).value !== undefined) {
      loaded.add('view')
      return undefined
    }
    const saved = await loadStore($, 'view')
    if (saved !== 'full' && saved !== 'summary') {
      loaded.add('view')
      return undefined
    }
    try {
      await $.state.set(viewState, saved)
      loaded.add('view')
    } catch {}
    return saved
  } catch {
    return undefined
  }
}
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
  } catch {
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
export async function selfId($: any): Promise<string | undefined> {
  if (ownId) return ownId
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })
    const body = r.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('')
    if (!r.isError) ownId = JSON.parse(body).sessionId
    else await debug($, `task-tree: get_session falhou: ${body.slice(0, 300)}`)
  } catch (err) {
    await debug($, `task-tree: get_session falhou: ${String(err)}`)
  }
  return ownId
}

// This session's repository and branch (io/git.ts), read again at every publication and at the
// clock's tick (a checkout or a worktree changes the branch mid-session; it is a 40-byte file):
// kept in the state for the header, published for the card. Returns what it read.
export async function refreshGit($: any): Promise<GitInfo | undefined> {
  const now = await readGit($)
  const { value: cur } = await $.state.get(gitState)
  const same = cur
    ? now !== undefined && cur.repo === now.repo && cur.branch === now.branch && (cur.detached ?? false) === (now.detached ?? false)
    : now === undefined
  if (!same) await $.state.set(gitState, now ? { ...now, at: (await stamp($)) ?? 0 } : null)
  return now
}

// Publishes this session's panel (io/publish.ts): gathers it from the state here, where the kit
// wants the state keys literal, and what the last drawing left; `tasks` is for earlier versions.
export async function publishPanel($: any) {
  await ensureGroups($)
  await ensureWork($)
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
    const { value: rate } = await $.state.get(rateState)
    const { value: sends = [] } = await $.state.get(sendsState)
    const tasks = (groups as Group[]).find(g => g.agent === MAIN)?.tasks ?? []
    await publishWait($, id, { tasks, groups, waits, children, work, received, engine, rate: rate ?? undefined, git, sends, renderError: drawn.error, drawSize: drawn.size, rows: drawn.rows })
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
// The last drawing's size (serialized), and the most a drawing may be before the pane shows only a
// warning line: a 1.3 MB one was not shown by the app (the person's words: "resumir os 57 pedidos
// anteriores resolveu").
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

// The panel opened with the session (session.start, plan) is opened unasked, and the app places an
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
// The agent's open question or plan dialog, once the agent has gone on without it.
export async function dropAsked($: any, agent: string) {
  const asked = (w: Wait) => w.agent === agent && (w.kind === 'question' || w.kind === 'plan')
  const { value = [] } = await $.state.get(waitsState)
  if ((value as Wait[]).some(asked)) await dropWaits($, w => !asked(w))
}

// A press on a line's ▾/▸: the line stays as the person left it (closed or open) until they
// press it again. Written from onPress, since a render may not write.
// The pane's view, chosen with the toggle at its top: kept in the state (a reload) and in the
// store under the session (a resume). Written from onPress, like setFold.
export async function setView($: any, view: 'full' | 'summary') {
  await $.state.set(viewState, view)
  try {
    await saveStore($, 'view', view)
  } catch {}
}
// At the session's start: the view chosen before (a reload, a resume), else the summary, the
// default of a new session (the table's `current`: the state's wins).
export async function restoreView($: any) {
  loaded.add('view')
  const { value: cur } = await $.state.get(viewState)
  if (cur !== undefined) return
  let saved: unknown
  try {
    saved = await loadStore($, 'view')
  } catch {}
  await $.state.set(viewState, keepCurrent(cur, saved === 'full' || saved === 'summary' ? saved : 'summary'))
}

// The current work (the summary view's list): the main group's level-1 tasks of the person's
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
  try {
    await saveStore($, 'work', ids)
  } catch {}
}
export async function joinWork($: any, ids: string[], fresh: boolean) {
  if (ids.length === 0) return
  const { value: cur = [] } = await $.state.get(workState)
  if (!fresh) return setWork($, [...new Set([...(cur as string[]), ...ids])])
  // New work: with anything still open in sight (a task, a ✉, a card with an open task), the work
  // before stays whole, the new request below it; with nothing open, the new request alone (openInSight).
  const { value: groups = [] } = await $.state.get(groupsState)
  const { value: children = [] } = await $.state.get(childrenState)
  const { value: sends = [] } = await $.state.get(sendsState)
  const kept = openInSight({ groups: withMain(groups as Group[]), waits: [], children }, cur as string[], sends as Send[]) ? (cur as string[]) : []
  await setWork($, [...new Set([...kept, ...ids])])
}
// What ties the sessions' cards to their tasks (the sessions this one opened, with the tasks and
// rounds of their messages; the sends still waiting; the messages received; the subagents'
// launches) lives in the state, which a reload of the mod empties: kept in the store too, and
// brought back at the start, else the cards fall to the root and the chains lose their origin.
// Whether this module brought them back yet (`loaded`, the table's "first save"): a reload does not
// run session.start, so the first save brings them back before it writes, and nothing new is lost
// to the old copy.
// The links as the store holds them, by session id, this module's copy. The state's `children` are
// the sessions the host lists (refreshChildren rebuilds them from the list, archived ones included);
// a session the list leaves out for a while is not in the state, so a save from the state alone
// would drop its ties from the store for good. The save keeps those entries, and a session the host
// lists again gets its ties back from here (refreshChildren, recordStart). Nothing is drawn from
// here: a session shows only while the host lists it.
export let keptLinks = new Map<string, Link>()
export const keptLink = (id: string): Link | undefined => keptLinks.get(id)
// A plan that reuses the id of a closed task renames the closed one (`tag:id`, its subtasks with
// it, see planTool): the sessions' ties to it (the task they were opened on, the task of their last
// message, each message's task), the launches' and the sends' are renamed with it, or they would
// point at the new task with that id, and every card of every earlier request would fall under it
// (the person's panel: a request that sent nothing showed the cards of the whole day). The module's
// copy of the links (keptLinks) is renamed too, so a later save keeps the renamed ties.
export async function renameAnchors($: any, ids: string[], tag: string) {
  if (ids.length === 0) return
  const fix = (a?: string) => (a !== undefined && ids.some(id => a === id || a.startsWith(id + '/')) ? tag + ':' + a : a)
  const link = <T extends { anchor?: string; lastAnchor?: string; rounds?: { at: number; anchor?: string }[] }>(c: T): T => {
    const out = { ...c }
    if (c.anchor !== undefined) out.anchor = fix(c.anchor)
    if (c.lastAnchor !== undefined) out.lastAnchor = fix(c.lastAnchor)
    if (c.rounds !== undefined) out.rounds = c.rounds.map(r => (r.anchor === undefined ? r : { ...r, anchor: fix(r.anchor) }))
    return out
  }
  await update($, childrenState, cur => (cur ?? []).map(link))
  await update($, launchesState, cur => (cur ?? []).map(l => (l.anchor === undefined ? l : { ...l, anchor: fix(l.anchor) })))
  await update($, sendsState, cur => (cur ?? []).map(s => (s.anchor === undefined ? s : { ...s, anchor: fix(s.anchor) })))
  for (const [id, k] of keptLinks) keptLinks.set(id, link(k))
}
// The record as it was last written to the store (a variable of the module: a reload writes once
// more): the poll publishes every few seconds, and the store is written only when the record changed.
let lastLinks: string | undefined
export async function saveLinks($: any) {
  if (!loaded.has('links') && restoredAt('children', 'first-save')) await restoreLinks($)
  try {
    const { value: children } = await $.state.get(childrenState)
    const { value: sends } = await $.state.get(sendsState)
    const { value: received } = await $.state.get(receivedState)
    const { value: launches } = await $.state.get(launchesState)
    const listed = ((children as Child[] | undefined) ?? []).map(linkOf)
    const links = [...listed, ...[...keptLinks.values()].filter(k => !listed.some(c => c.id === k.id))]
    const record = { children: links, sends, received, launches }
    const key = JSON.stringify(record)
    if (key !== lastLinks) {
      await saveStore($, 'children', record)
      lastLinks = key
    }
    keptLinks = new Map(links.map(l => [l.id, l]))
  } catch {}
}
// Each key of the record merged as the table says (`fill` for the sessions: a session keeps its
// fields and gets back the anchors and rounds; `union` for the lists: they get back the entries
// they lack).
export async function restoreLinks($: any) {
  loaded.add('links')
  try {
    const saved = (await loadStore($, 'children')) as Record<string, unknown> | undefined
    if (saved === undefined || saved === null || typeof saved !== 'object') return
    const list = (k: string) => (Array.isArray(saved[k]) ? (saved[k] as any[]) : [])
    keptLinks = new Map((list('children') as Child[]).filter(o => typeof o?.id === 'string').map(o => [o.id, linkOf(o)]))
    if (list('children').length > 0) await update($, childrenState, cur => merge('children', cur, list('children')))
    if (list('sends').length > 0) await update($, sendsState, cur => merge('sends', cur, list('sends')))
    if (list('received').length > 0) await update($, receivedState, cur => merge('received', cur, list('received')))
    if (list('launches').length > 0) await update($, launchesState, cur => merge('launches', cur, list('launches')))
  } catch {}
}
export async function restoreWork($: any) {
  loaded.add('work')
  const { value: cur } = await $.state.get(workState)
  if (cur !== undefined) return
  try {
    const saved = await loadStore($, 'work')
    if (Array.isArray(saved)) await $.state.set(workState, keepCurrent(cur, saved.map(String)))
  } catch {}
}

