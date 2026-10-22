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

import type { PluginState } from 'claude-code'

import type { Child } from '../types'

export type Key = keyof PluginState['task-tree']
// Where it lives: the state alone; the state with a copy in the store; the store alone; a variable
// of the module (the hooks module's, or this one's).
export type Lives = 'state' | 'state+store' | 'store' | 'module'
// How the store's copy meets what the state already holds when it comes back:
// - `current`: what the state holds wins; the store's copy is taken only when the state has none;
// - `fill`: the state's entries keep their fields and get from the store's the ones they lack
//   (a session's anchor, lastAnchor and rounds); an empty state takes the store's whole;
// - `union`: the store's entries the state lacks go first, then the state's (the last `keep`);
// - `replace`: the store's copy replaces the state's (a resume);
// - `none`: nothing to merge (not in the store).
export type Merge = 'current' | 'fill' | 'union' | 'replace' | 'none'
// When the store's copy is brought back: session.start (a new process); a resume
// (classic.SessionStart with source 'resume', which replaces); the first use (a write, a drawing or
// a publication) after a reload that ran no session.start; the first save after such a reload.
export type When = 'start' | 'resume' | 'first-use' | 'first-save'
export type Row = {
  key: string
  lives: Lives
  // The store's key prefix (`<store>:<session uuid>`); `field`: this key is one field of that
  // store record (the links record holds four).
  store?: 'session' | 'view' | 'work' | 'links' | 'sessions'
  field?: boolean
  merge: Merge
  // `union`: how many of the merged entries are kept (the last ones).
  keep?: number
  restoredAt: When[]
  note: string
}

export const TABLE: readonly Row[] = [
  // The panel.
  { key: 'groups', lives: 'state+store', store: 'session', merge: 'current', restoredAt: ['start', 'resume', 'first-use'],
    note: 'the groups (tasks, turns, answers); a resume replaces the state with the store\'s; subagents\' open tasks come back interrupted' },
  { key: 'tasks', lives: 'state', merge: 'none', restoredAt: [],
    note: 'legacy: the one list before groups, moved into the main group once (adopt) at session.start or the first write' },
  { key: 'view', lives: 'state+store', store: 'view', merge: 'current', restoredAt: ['start', 'first-use'],
    note: 'the pane\'s view (summary or full); a new session starts with the summary; after a restart without session.start the first drawing or write brings it back (ensureView), else the pane would fall to the default view' },
  { key: 'work', lives: 'state+store', store: 'work', merge: 'current', restoredAt: ['start', 'first-use'],
    note: 'the current work (the summary view\'s level-1 tasks); after a restart without session.start the first write brings it back (ensureWork), else the next plan would write its own over the store\'s' },
  // The ties to other sessions: one store record (`links`), four state keys.
  { key: 'children', lives: 'state+store', store: 'links', field: true, merge: 'fill', restoredAt: ['start', 'first-save'],
    note: 'the sessions this one opened as the host lists them; the store keeps only their ties (id, name, title, anchor, lastAnchor, rounds), and a session the host leaves out keeps its ties in the store (keptLinks)' },
  { key: 'sends', lives: 'state+store', store: 'links', field: true, merge: 'union', restoredAt: ['start', 'first-save'],
    note: 'messages to other sessions not yet taken up' },
  { key: 'received', lives: 'state+store', store: 'links', field: true, merge: 'union', keep: 20, restoredAt: ['start', 'first-save'],
    note: 'messages of other sessions this one got (the last 20)' },
  { key: 'launches', lives: 'state+store', store: 'links', field: true, merge: 'union', keep: 20, restoredAt: ['start', 'first-save'],
    note: 'Agent calls not yet claimed by a subagent\'s group (the last 20)' },
  // The turn's own: they survive a reload, not the process.
  { key: 'waits', lives: 'state', merge: 'none', restoredAt: [], note: 'what waits on the person (a question, a plan, a permission, a wrap_up with ask)' },
  { key: 'engine', lives: 'state', merge: 'none', restoredAt: [], note: 'the model and effort of the main loop, published for the card' },
  { key: 'ended', lives: 'state', merge: 'none', restoredAt: [], note: 'sessions whose turn ended, until the main loop is reminded' },
  { key: 'childrenError', lives: 'state', merge: 'none', restoredAt: [], note: 'why the host\'s list of sessions failed, drawn in the panel' },
  { key: 'brief', lives: 'state', merge: 'none', restoredAt: [], note: 'done\'s summary until the turn ends (the ↩ line); in the state so a reload mid-turn keeps it' },
  { key: 'recap', lives: 'state', merge: 'none', restoredAt: [], note: 'wrap_up\'s recap until the turn ends (the turn\'s answer for the card); in the state so a reload between the wrap_up and the end of the turn keeps it' },
  { key: 'collapsed', lives: 'state', merge: 'none', restoredAt: [], note: 'the lines the person folded or opened (the folds atom)' },
  // The store alone.
  { key: 'sessions', lives: 'store', store: 'sessions', merge: 'none', restoredAt: [], note: 'the sessions whose panel the store keeps, newest first, KEEP of them' },
  // Variables of the module: a hot reload starts them over.
  { key: 'loaded', lives: 'module', merge: 'none', restoredAt: [], note: 'which store copies this module brought back (groups, links): a reload brings them back again on first use' },
  { key: 'keptLinks', lives: 'module', merge: 'none', restoredAt: ['start', 'first-save'], note: 'the links record as the store holds it, refilled whenever it is read or written; the ties of sessions the host leaves out' },
  { key: 'ownId', lives: 'module', merge: 'none', restoredAt: [], note: 'this session\'s local_ id (asked again after a reload)' },
  { key: 'refreshedAt', lives: 'module', merge: 'none', restoredAt: [], note: 'when the host\'s list was last read' },
  { key: 'drawNow', lives: 'module', merge: 'none', restoredAt: [], note: 'the clock of the drawing in progress' },
  { key: 'drawSize', lives: 'module', merge: 'none', restoredAt: [], note: 'the last drawing\'s size, published' },
  { key: 'drawRows', lives: 'module', merge: 'none', restoredAt: [], note: 'the last drawing\'s lines, published' },
  { key: 'renderError', lives: 'module', merge: 'none', restoredAt: [], note: 'the last drawing\'s error, published' },
  { key: 'actions', lives: 'module', merge: 'none', restoredAt: [], note: 'the pane\'s buttons by key: a press between a reload and the next drawing finds none' },
  { key: 'ticker', lives: 'module', merge: 'none', restoredAt: [], note: 'the 1 s clock, started again by the next start, refresh or tool call' },
  { key: 'poller', lives: 'module', merge: 'none', restoredAt: [], note: 'the 3 s reread of the sessions, started again likewise' },
  { key: 'engineSeen', lives: 'module', merge: 'none', restoredAt: [], note: 'the host\'s model per session, a minute each' },
  { key: 'breaksMemo', lives: 'module', merge: 'none', restoredAt: [], note: 'a drawing\'s cache of the cards\' splits' },
  { key: 'unplanned, planned, answeredInChat', lives: 'module', merge: 'none', restoredAt: [], note: 'the request\'s reminders: calls without a plan, whether it planned, whether a question is answered by the next message' },
]

// The keys of `$.state`: every key the hooks module reads or writes has a row (durabilidade.test.ts
// fails on one that has not).
export const STATE_KEYS = TABLE.filter(r => r.lives === 'state' || r.lives === 'state+store').map(r => r.key as Key)
export const STORES = [...new Set(TABLE.flatMap(r => (r.store ? [r.store] : [])))]
// The four state keys the links record holds.
export const LINK_KEYS = TABLE.filter(r => r.store === 'links').map(r => r.key as 'children' | 'sends' | 'received' | 'launches')

export const rowOf = (key: string): Row => {
  const row = TABLE.find(r => r.key === key)
  if (!row) throw new Error(`task-tree: chave sem linha na tabela de durabilidade: ${key}`)
  return row
}
export const stateOf = <K extends Key>(key: K) => ({ plugin: 'task-tree', key }) as const
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
export type Link = Pick<Child, 'id' | 'name' | 'title' | 'anchor' | 'lastAnchor' | 'rounds'>
export const linkOf = (c: Child): Link => ({ id: c.id, name: c.name, title: c.title, anchor: c.anchor, lastAnchor: c.lastAnchor, rounds: c.rounds })

// The store's copy meeting the state's, by the row's `merge` (see Merge).
export function merge<T>(key: string, cur: T[] | undefined, old: T[]): T[] {
  const row = rowOf(key)
  switch (row.merge) {
    case 'union': {
      const now = cur ?? []
      const seen = new Set(now.map(x => JSON.stringify(x)))
      const all = [...old.filter(x => !seen.has(JSON.stringify(x))), ...now]
      return row.keep !== undefined ? all.slice(-row.keep) : all
    }
    case 'fill': {
      if (cur === undefined || cur.length === 0) return old
      return (cur as unknown as Child[]).map(c => {
        const o = (old as unknown as Link[]).find(k => k.id === c.id)
        return (o ? { ...c, anchor: c.anchor ?? o.anchor, lastAnchor: c.lastAnchor ?? o.lastAnchor, rounds: c.rounds ?? o.rounds } : c) as unknown as T
      })
    }
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
export async function saveStore($: any, key: string, value: unknown): Promise<void> {
  await $.store.set(storeKey(key, await $.session.id()), value)
}
// The panel's copy, and the list of the sessions that have one (the newest KEEP; the others' copies
// are deleted).
export async function saveGroups($: any, groups: unknown): Promise<void> {
  const id: string = await $.session.id()
  await $.store.set(storeKey('groups', id), groups)
  const known = ((await $.store.get(rowOf('sessions').store as string)) as string[] | undefined) ?? []
  const order = [id, ...known.filter(k => k !== id)]
  for (const old of order.slice(KEEP)) await $.store.delete(storeKey('groups', old))
  await $.store.set(rowOf('sessions').store as string, order.slice(0, KEEP))
}
