// Where each piece of the panel lives and how it comes back: the durability table. Three layers
// hold the mod's data, and each dies at a different time:
// - `$.state`: survives a hot reload of the mod (a saved edit), dies with the process (a crash of
//   the hooks worker, /model, a restart of the app);
// - `$.store`: survives everything, keyed by the session (`<name>:<session uuid>`), so a resume
//   finds it;
// - a variable of the module: dies with the hot reload too.
// A hot reload does not run session.start, and a process that restarted without session.start (the
// worker respawned) starts from an empty state: so what is kept in the store is also brought back
// on first use after a reload (the `loaded` flags), else the first write would overwrite the store
// with the reduced panel (H6.1) and the ties would be lost (H3.2). One table says it for every key;
// the hooks module reads and writes through it.
// The store has a ceiling (4 MiB of JSON): past it every write fails. So every write goes through
// `guarded`: a failing write is said in the debug log (once per reason), prunes what no session needs
// any more (pruneStore) and is tried once more; a failure that stays is kept (`storeFailure`) for the
// /task-tree answer. The panel on screen is not touched: only its saving stops.

import type { PluginState } from 'claude-code'

import type { Child } from '../types'
import { debugOnce } from '../io/log'

export type Key = keyof PluginState['task-tree']
// Where it lives: the state alone; the state with a copy in the store; the store alone; a variable
// of the module (the hooks module's, or this one's).
export type Lives = 'state' | 'state+store' | 'store' | 'module'
// How the store's copy meets what the state already holds when it comes back:
// - `current`: what the state holds wins; the store's copy is taken only when the state has none
//   (a new process: a state kept through a hot reload is the truth, the store's copy is not merged
//   over it);
// - `replace`: the store's copy replaces the state's (a resume);
// - `none`: nothing to merge (not in the store).
export type Merge = 'current' | 'replace' | 'none'
// When the store's copy is brought back: session.start (a new process); a resume
// (classic.SessionStart with source 'resume', which replaces); the first use (a write, a drawing or
// a publication) after a reload or a restart that ran no session.start.
export type When = 'start' | 'resume' | 'first-use'
export type Row = {
  key: string
  lives: Lives
  // The store's key prefix (`<store>:<session uuid>`); `field`: this key is one field of that
  // store record (the links record holds four, and the sessions left behind by a /clear).
  store?: 'session' | 'work' | 'links' | 'sessions' | 'turn'
  field?: boolean
  merge: Merge
  // How many entries each write keeps (the last ones).
  keep?: number
  restoredAt: When[]
  note: string
}

export const TABLE: readonly Row[] = [
  // The panel.
  { key: 'groups', lives: 'state+store', store: 'session', merge: 'current', restoredAt: ['start', 'resume', 'first-use'],
    note: 'the groups (tasks, turns, answers); a resume replaces the state with the store\'s; subagents\' open tasks come back interrupted; out of the store (only KEEP sessions), a new process in the desktop app brings it back from the file this session published, its long-term copy while the session exists in the app (fromOwnFile), with the work, the links\' four keys and the turn\'s end' },
  { key: 'tasks', lives: 'state', merge: 'none', restoredAt: [],
    note: 'legacy: the one list before groups, moved into the main group once (adopt) at session.start or the first write' },
  { key: 'work', lives: 'state+store', store: 'work', merge: 'current', restoredAt: ['start', 'resume', 'first-use'],
    note: 'the current work (the level-1 tasks the panel draws); a resume brings the resumed session\'s; after a restart without session.start the first write brings it back (ensureWork), else the next plan would write its own over the store\'s; with no store copy, it comes back from the published file with the groups (fromOwnFile)' },
  // The ties to other sessions: one store record (`links`), four state keys.
  { key: 'children', lives: 'state+store', store: 'links', field: true, merge: 'current', restoredAt: ['start', 'first-use'],
    note: 'the sessions this one opened as the host lists them; the store keeps only their ties (id, name, title, anchor, lastAnchor, rounds, openedAt, places: where each card of turns typed there goes, decided once), and a session the host leaves out keeps its ties in the store (keptLinks); a /clear empties them, and the sessions opened before it are left behind (leftBehind); 20 rounds per session (keepRounds), those of a task in sight never go' },
  { key: 'sends', lives: 'state+store', store: 'links', field: true, merge: 'current', restoredAt: ['start', 'first-use'],
    note: 'messages to other sessions and to subagents, one per message (its own number, seq): queued until taken up (a delivery at once spends its own receipt too, spent), then kept with the letter green (or gray, not delivered); over 20 (keepSends) only the oldest delivered or not delivered and already told go' },
  { key: 'received', lives: 'state+store', store: 'links', field: true, merge: 'current', keep: 20, restoredAt: ['start', 'first-use'],
    note: 'messages of other sessions this one got (the last 20)' },
  { key: 'receipts', lives: 'state+store', store: 'links', field: true, merge: 'current', restoredAt: ['start', 'first-use'],
    note: 'per session a message went to, the last of its receipts already matched to a send of this one, a delivery at once included (instant and count at it, watchSends): an old receipt does not confirm a later message after a reload or a new process; a /clear empties it' },
  { key: 'launches', lives: 'state+store', store: 'links', field: true, merge: 'current', keep: 20, restoredAt: ['start', 'first-use'],
    note: 'Agent calls not yet claimed by a subagent\'s group (the last 20)' },
  // The turn's own: they survive a reload, not the process.
  { key: 'names', lives: 'state', merge: 'none', restoredAt: [], note: 'the names of the sessions known by id (the linked list of the host, the tag of a received message, this session\'s own from get_session), the last 200, for the "Para <nome>" of the letters; not stored nor published: the 3 s reread makes it again' },
  { key: 'waits', lives: 'state', merge: 'none', restoredAt: [], note: 'what waits on the person (a question, a plan, a permission, a wrap_up with ask)' },
  { key: 'engine', lives: 'state', merge: 'none', restoredAt: [], note: 'the model and effort of the main loop, published for the card' },
  { key: 'ultracode', lives: 'state', merge: 'none', restoredAt: [], note: 'whether the main loop\'s ultracode switch is on (ultra_effort_enter/exit), published for the card and drawn in the header' },
  { key: 'rate', lives: 'state', merge: 'none', restoredAt: [], note: 'the output rate ("n toks/s") of the main loop\'s last valid model call, published for the card' },
  { key: 'git', lives: 'state', merge: 'none', restoredAt: [], note: 'this session\'s repository (folder name; in a worktree, the main repository\'s) and branch, read off .git/HEAD at each publication and clock tick, published for the card' },
  { key: 'ended', lives: 'state', merge: 'none', restoredAt: [], note: 'sessions whose turn ended, until the main loop is reminded' },
  { key: 'goneSessions', lives: 'state', merge: 'none', restoredAt: [], note: 'sessions archived or deleted in the app with their task of origin open, until the main loop is told once' },
  { key: 'closedBySessions', lives: 'state', merge: 'none', restoredAt: [], note: 'the tasks of origin of the main loop a session that ended its turn with all of its work done closed (closeByEnded), until the model is told once (endedNote)' },
  { key: 'closedBySubs', lives: 'state', merge: 'none', restoredAt: [], note: 'the tasks of the main loop the end of their subagents closed or marked ✕ (settleBySubs), until the model is told once (subsNote)' },
  { key: 'childrenError', lives: 'state', merge: 'none', restoredAt: [], note: 'why the host\'s list of sessions failed, drawn in the panel' },
  { key: 'brief', lives: 'state', merge: 'none', restoredAt: [], note: 'done\'s summary until the turn ends (the ↩ line); in the state so a reload mid-turn keeps it' },
  { key: 'selfId', lives: 'state', merge: 'none', restoredAt: [], note: 'this session\'s local_ id as the app answered it; in the state so a reload of the mod has it at once (the render and the reading of the sessions)' },
  { key: 'marks', lives: 'state', merge: 'none', restoredAt: [], note: 'the request\'s marks (whether it used the panel, whether a question waits for the person\'s message as its answer, whether the summary kept came before a plan); in the state so a reload keeps them; a /clear or a resume drops them' },
  { key: 'paneOpened', lives: 'state', merge: 'none', restoredAt: [], note: 'session.start opened the panel in this process: a reload keeps it, so it does not open again a panel the person closed; a new process opens it once' },
  { key: 'collapsed', lives: 'state', merge: 'none', restoredAt: [], note: 'the lines the person folded or opened (the folds atom)' },
  // The turn's end: in the store too (one record, `turn`), so a new process (a respawn, /model, a
  // restart) does not draw as in progress what had already stopped.
  { key: 'turnEnded', lives: 'state+store', store: 'turn', field: true, merge: 'current', restoredAt: ['start', 'resume', 'first-use'],
    note: 'when this session\'s turn ended, until the next prompt: what it left open is drawn with no close and no clock; in the store so a new process does not draw as in progress what had already stopped (saveTurn, ensureTurn, restoreTurn); a record "going on" (ended null, or none) found by a new process (session.start, a resume) is a turn that died with the process before: it becomes a stop (parkDeadTurn)' },
  { key: 'turnAborted', lives: 'state+store', store: 'turn', field: true, merge: 'current', restoredAt: ['start', 'resume', 'first-use'],
    note: 'the main loop\'s last turn ended interrupted (isAborted), until the next request: a message of another session then gets the reminder to replan; what it left in progress is drawn interrupted, after a restart too; set by parkDeadTurn when a new process finds the turn still going on' },
  { key: 'turnFailed', lives: 'state+store', store: 'turn', field: true, merge: 'current', restoredAt: ['start', 'resume', 'first-use'],
    note: 'the main loop\'s last stop was a turn that died by an error (an API failure, the context limit, a refusal), until the next request: its reminder says so (PROMPT.failedByError); false in a record of an earlier version and after parkDeadTurn' },
  { key: 'replanDue', lives: 'state+store', store: 'turn', field: true, merge: 'current', restoredAt: ['start', 'resume', 'first-use'],
    note: 'a turn of the main loop was stopped (Esc) and no request came since: the next request gets the reminder to replan; a turn that opens no request (the app\'s notice, a hand-back) leaves it, though its end sets turnAborted back to false; set by parkDeadTurn too (a turn that died with the process)' },
  // The store alone.
  { key: 'sessions', lives: 'store', store: 'sessions', merge: 'none', restoredAt: [], note: 'the sessions whose panel the store keeps, newest first, KEEP of them; the work, turn and links records of a session out of the list are pruned with its panel (pruneStore), and a session that comes back to it writes them again (saveGroups answers it)' },
  // Variables of the module: a hot reload starts them over.
  { key: 'loaded', lives: 'module', merge: 'none', restoredAt: [], note: 'which store copies this module brought back (groups, links): a reload brings them back again on first use' },
  { key: 'keptLinks', lives: 'module', merge: 'none', restoredAt: ['start', 'first-use'], note: 'the links record as the store holds it, refilled whenever it is read or written; the ties of sessions the host leaves out' },
  { key: 'leftBehind', lives: 'module', merge: 'none', restoredAt: ['start', 'first-use'], note: 'the sessions this one opened before a /clear (the last 200), with no card from then on; kept in the links record (`left`), refilled whenever it is read or written, as keptLinks' },
  { key: 'ownId', lives: 'module', merge: 'none', restoredAt: [], note: 'this session\'s local_ id (put back from the state\'s selfId after a reload, else asked again)' },
  { key: 'refreshedAt', lives: 'module', merge: 'none', restoredAt: [], note: 'when the host\'s list was last read' },
  { key: 'reading', lives: 'module', merge: 'none', restoredAt: [], note: 'the read of the sessions in progress (refreshChildren): one at a time; a reload starts it over' },
  { key: 'readAgain', lives: 'module', merge: 'none', restoredAt: [], note: 'a read asked while one ran: the one in progress runs once more; a reload starts it over' },
  { key: 'publishing', lives: 'module', merge: 'none', restoredAt: [], note: 'the publication of the panel in progress (publishPanel): one at a time; a reload starts it over' },
  { key: 'publishAgain', lives: 'module', merge: 'none', restoredAt: [], note: 'the publication waiting for the one in progress, which the ones asked meanwhile join: it reads the state after that one wrote; a reload starts it over' },
  { key: 'drawSize', lives: 'module', merge: 'none', restoredAt: [], note: 'the last drawing\'s size, published' },
  { key: 'drawRows', lives: 'module', merge: 'none', restoredAt: [], note: 'the last drawing\'s lines, published' },
  { key: 'renderError', lives: 'module', merge: 'none', restoredAt: [], note: 'the last drawing\'s error, published' },
  { key: 'actions', lives: 'module', merge: 'none', restoredAt: [], note: 'the pane\'s buttons by key: a press between a reload and the next drawing finds none' },
  { key: 'ticker', lives: 'module', merge: 'none', restoredAt: [], note: 'the 1 s clock, started again by the pane\'s drawing (the app draws it when the mod loads) and by the next start, refresh or tool call' },
  { key: 'poller', lives: 'module', merge: 'none', restoredAt: [], note: 'the 3 s reread of the sessions, started again likewise (the pane\'s drawing too)' },
  { key: 'engineSeen', lives: 'module', merge: 'none', restoredAt: [], note: 'the host\'s model per session, a minute each' },
  { key: 'unplanned', lives: 'module', merge: 'none', restoredAt: [], note: 'the main loop\'s calls without a plan, for the reminder to plan; a reload starts the count over (the reminder comes once more, only in a request that did not plan)' },
  { key: 'lastPublished, lastLinks, lastStatus', lives: 'module', merge: 'none', restoredAt: [], note: 'the last published file (without its clocks and panes), links record and status text: written or set again only when they change; a reload writes each once more' },
  { key: 'home', lives: 'module', merge: 'none', restoredAt: [], note: 'the home folder of the published files, asked of the host once per module' },
  { key: 'calls, counted, wrote, pendingToks, gone', lives: 'module', merge: 'none', restoredAt: ['first-use'], note: 'per subagent (hooks/agents): the calls counted, taken up from its card on its first call after a reload (counted) so the card\'s count goes on; when its rate was last written; the rate measured within the second after that write, which the card\'s next write takes (a reload loses it: the card keeps the one written); when its card was first seen with no agent, which a reload starts over with one more check' },
  { key: 'pendingTools, toolsWrote, toolsTimer', lives: 'module', merge: 'none', restoredAt: [], note: 'the subagents\' tool lines not written yet, when they were last written and the timer that writes them (at most once a second for all, hooks/agents subTool); a reload drops the pending lines: the next call writes at once' },
  { key: 'inCall', lives: 'module', merge: 'none', restoredAt: [], note: 'the calls in progress by agent and tool: a permission wait goes when the last one ends; a reload starts it over, and the end of a call then drops the wait, as before' },
]

// The keys of `$.state`: every key of PluginState['task-tree'] (types/index.d.ts) has a row living in
// the state (`state` or `state+store`), and every such row has its key; the check's `regras` step
// (scripts/regras.mjs) fails on a difference.

export const rowOf = (key: string): Row => {
  const row = TABLE.find(r => r.key === key)
  if (!row) throw new Error(`task-tree: chave sem linha na tabela de durabilidade: ${key}`)
  return row
}
// Whether the table brings a key back at that moment.
export const restoredAt = (key: string, when: When) => rowOf(key).restoredAt.includes(when)
// The store's key of a session's copy.
export const storeKey = (key: string, id: string) => `${rowOf(key).store}:${id}`
// How many sessions' panels the store keeps for a resume.
export const KEEP = 30

// Which store copies this module brought back since it loaded ('groups', 'links'): a hot reload
// starts the set empty, so the first use after it brings them back again.
export const loaded = new Set<string>()

// What the store keeps of a session this one linked to: its ties to the tasks, not its state.
export type Link = Pick<Child, 'id' | 'name' | 'title' | 'anchor' | 'lastAnchor' | 'rounds' | 'openedAt' | 'places'>
export const linkOf = (c: Child): Link => ({ id: c.id, name: c.name, title: c.title, anchor: c.anchor, lastAnchor: c.lastAnchor, rounds: c.rounds, openedAt: c.openedAt, places: c.places })

// The store's copy meeting the state's, by the row's `merge` (see Merge).
export function merge<T>(key: string, cur: T[] | undefined, old: T[]): T[] {
  const row = rowOf(key)
  switch (row.merge) {
    case 'replace':
      return old
    case 'current':
      return cur !== undefined ? cur : old
    case 'none':
      return cur ?? []
  }
}
// `current` for a single value: what the state holds, else the store's.
export const current = <T>(cur: T | undefined, old: T): T => (cur !== undefined ? cur : old)

// The store's copy of a key for a session (`id`, this one's by default); whatever the store answers,
// to be checked by the caller. Throws as the store does: the callers decide what a failure means.
export async function loadStore($: any, key: string, id?: string): Promise<unknown> {
  return $.store.get(storeKey(key, id ?? (await $.session.id())))
}
// The last write of the store that failed (what, the error, when), until that write works again.
export const storeFailure: { what?: string; error?: string; at?: number } = {}
// What each store record is, in the log's words.
const WHAT: Record<string, string> = { groups: 'painel', work: 'trabalho', turnEnded: 'fim do turno', children: 'ligações' }
// A write of the store (`key` names the record): tried; on a failure, said in the log, the store pruned
// and tried once more; a failure that stays is said and kept, never thrown (the hook goes on).
export async function guarded($: any, key: string, write: () => Promise<void>): Promise<boolean> {
  const what = WHAT[key] ?? key
  for (let round = 0; round < 2; round++) {
    try {
      await write()
      if (storeFailure.what === what) {
        delete storeFailure.what
        delete storeFailure.error
        delete storeFailure.at
      }
      return true
    } catch (err) {
      await debugOnce($, `task-tree: store não gravado (${what}): ${String(err)}`)
      storeFailure.what = what
      storeFailure.error = String(err)
      storeFailure.at = Date.now()
      if (round === 0) await pruneStore($)
    }
  }
  return false
}
// The prefixes of earlier versions, which nothing writes any more.
const GONE = ['asks', 'view']
// The records kept per session (the panel's and the three beside it).
const PER_SESSION = ['session', 'work', 'turn', 'links']
// Deletes what no session needs: the keys of earlier versions, and the records of the sessions out
// of the list (`sessions`), but never this one's. Run once per module by itself (the first save of the
// panel) and whenever a write fails. A failure of its own is said in the log and breaks nothing.
let prunedOnce = false
export async function pruneStore($: any): Promise<void> {
  prunedOnce = true
  try {
    const own: string = await $.session.id()
    const listed = ((await $.store.get(rowOf('sessions').store as string)) as string[] | undefined) ?? []
    const keys = ((await $.store.keys()) as string[]) ?? []
    for (const k of keys) {
      const at = k.indexOf(':')
      if (at < 0) continue
      const prefix = k.slice(0, at)
      const id = k.slice(at + 1)
      const drop = GONE.includes(prefix) || (PER_SESSION.includes(prefix) && id !== own && !listed.includes(id))
      if (drop) await $.store.delete(k)
    }
  } catch (err) {
    await debugOnce($, `task-tree: store não podado: ${String(err)}`)
  }
}
export async function saveStore($: any, key: string, value: unknown): Promise<boolean> {
  return guarded($, key, async () => $.store.set(storeKey(key, await $.session.id()), value))
}
// The panel's copy, and the list of the sessions that have one (the newest KEEP; the others' copies
// are deleted). Answers whether this session was out of the list (a new session, or one whose
// records another session pruned): the caller then writes its work, turn end and links again.
export async function saveGroups($: any, groups: unknown): Promise<{ saved: boolean; back: boolean }> {
  let back = false
  const saved = await guarded($, 'groups', async () => {
    const id: string = await $.session.id()
    await $.store.set(storeKey('groups', id), groups)
    const known = ((await $.store.get(rowOf('sessions').store as string)) as string[] | undefined) ?? []
    back = !known.includes(id)
    const order = [id, ...known.filter(k => k !== id)]
    for (const old of order.slice(KEEP)) await $.store.delete(storeKey('groups', old))
    await $.store.set(rowOf('sessions').store as string, order.slice(0, KEEP))
  })
  if (saved && !prunedOnce) await pruneStore($)
  return { saved, back }
}
