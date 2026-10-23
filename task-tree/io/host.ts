// The desktop app as the mod reads it: the sessions this one opened, from the app's list of linked
// sessions and from what each publishes. Reading them is four steps, each a function here, composed
// by the hooks module (refreshChildren), which keeps the state calls (the kit wants the state keys
// literal there):
// 1. the host's list (listSessions, parseSessions) and which rows are this session's (mineOf);
// 2. each session's published file, and its model when the file lacks it (readFiles, engineOf);
// 3. the children as the state holds them, from the rows, the files and the children known before,
//    and which of them just ended (deriveChildren);
// 4. the publication of this session's own panel, with its children in it (publishWait, io/publish.ts).
// The first three run without the app: a fake `$` with `mcp.call`, `fs.read` and `env.get`, or
// plain inputs (tests/host.test.ts).

import type { Child, Panel, Published } from '../types'
import type { Link } from '../state/durability'
import { MAIN } from '../draw/layout'
import { readPublished } from './publish'

// A row of the app's list (list_sessions): what this module reads of it.
export type HostRow = { sessionId: string; name?: string; title?: string; isRunning?: boolean; isArchived?: boolean; startedBy?: string }

// ---- 1. The list

// The app's answer to list_sessions as rows: its text is a JSON list, or, with no linked session,
// plain text ("No other sessions found."), which is an empty list. An error answer throws its text.
export function parseSessions(r: { content: { type?: string; text?: string }[]; isError?: boolean }): unknown {
  const body = r.content.map(c => (c.type === 'text' ? c.text ?? '' : '')).join('')
  if (r.isError) throw new Error(body)
  return /^\s*No .*sessions? found/i.test(body) ? [] : JSON.parse(body)
}
// The app's list of linked sessions (archived ones included), or why it could not be read.
export async function listSessions($: any): Promise<{ rows: unknown } | { error: string }> {
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { linked: true, include_archived: true, limit: 100 })
    return { rows: parseSessions(r) }
  } catch (err) {
    return { error: String(err).slice(0, 200) }
  }
}
// The rows this session opened: those `startedBy` its own id (`self`). Without it (outside the app,
// get_session failed), deduced: the list leaves this session out, so its id is the `startedBy` no
// listed session carries. With no such id (every starter is listed, or no row says who started it),
// or more than one (a list read mid-change), nothing is decided: undefined keeps the known children.
export function mineOf(rows: HostRow[], self?: string): HostRow[] | undefined {
  if (self !== undefined) return rows.filter(r => r.startedBy === self)
  const own = deducedOwn(rows)
  return own === undefined ? undefined : rows.filter(r => r.startedBy === own)
}
export function deducedOwn(rows: HostRow[]): string | undefined {
  const listed = rows.map(r => r.sessionId)
  const unlisted = [...new Set(rows.map(r => r.startedBy).filter((s): s is string => typeof s === 'string' && !listed.includes(s)))]
  return unlisted.length === 1 ? unlisted[0] : undefined
}

// ---- 2. The files

// What the sessions' published files say, by session id: which wait on the person, their panels,
// the share of context used and their model and effort.
export type Read = { waiting: string[]; panels: Record<string, Panel>; contexts: Record<string, number>; engines: Record<string, string> }
// A published file's panel: its groups (and the rest the file has), or, from before groups, its
// `tasks` as the main group; none when the file has neither.
export function panelOf(file: Published): Panel | undefined {
  if (file.groups) {
    return {
      groups: file.groups,
      waits: file.waits,
      children: file.children,
      ...(file.work ? { work: file.work } : {}),
      ...(file.received ? { received: file.received } : {}),
      ...(file.sends ? { sends: file.sends } : {}),
    }
  }
  if (file.tasks) return { groups: [{ agent: MAIN, label: '', tasks: file.tasks }], waits: [], children: [] }
  return undefined
}
// Reads every session's published file. The host tells running from idle only; whether a session
// waits on the person, its own task-tree publishes. No file, or one this version cannot read: the
// session shows by the host's row alone. A file without the model asks the app for it (engineOf).
export async function readFiles($: any, mine: HostRow[]): Promise<Read> {
  const read: Read = { waiting: [], panels: {}, contexts: {}, engines: {} }
  for (const r of mine) {
    try {
      const file = (await readPublished($, r.sessionId)) ?? { waiting: false, waits: [], children: [] }
      if (file.waiting) read.waiting.push(r.sessionId)
      if (file.context) read.contexts[r.sessionId] = file.context.percent
      if (file.engine) read.engines[r.sessionId] = file.engine
      else {
        const known = await engineOf($, r.sessionId)
        if (known) read.engines[r.sessionId] = known
      }
      const panel = panelOf(file)
      if (panel) read.panels[r.sessionId] = panel
    } catch {}
  }
  return read
}

// A session's model and effort in a few words, as its card shows them left of the ring: the model's
// readable name ("claude-opus-5-5" → "Opus 5.5", "claude-sonnet-5-5[1m]" → "Sonnet 5.5") and the
// effort level ("Opus 5.5 · high"); a name it cannot read stays as given, cut short.
export function engineText(model: string, effort?: string | number): string {
  const id = model.replace(/\[[^\]]*\]$/, '').replace(/-\d{8}$/, '')
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id)
  const name = m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] !== undefined ? `.${m[3]}` : ''}` : id.slice(0, 24)
  return effort === undefined || effort === '' ? name : `${name} · ${effort}`
}
// A session that has not published its model yet (no model request since it got this version):
// the app's own record of it (get_session's model and effort), kept a minute per session, so the
// 3 s reread does not ask the app each time.
const engineSeen = new Map<string, { at: number; text?: string }>()
export async function engineOf($: any, id: string): Promise<string | undefined> {
  const now = Date.now()
  const hit = engineSeen.get(id)
  if (hit && now - hit.at < 60000) return hit.text
  let text: string | undefined
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: id })
    const body = JSON.parse((r?.content ?? []).map((c: any) => c?.text ?? '').join(''))
    if (!r?.isError && typeof body?.model === 'string' && body.model !== '') text = engineText(body.model, typeof body.effort === 'string' ? body.effort : undefined)
  } catch {}
  engineSeen.set(id, { at: now, text })
  return text
}

// ---- 3. The children

// The children as the state will hold them, from the rows this session opened, what their files
// said and the children known before (`known`), and which of them just ended: running or waiting
// before, stopped now (not running, not archived, not waiting). A session just opened (`starting`)
// counts only once the host has seen it run: right after start_session the host may still list it
// idle. A session the host lists again after leaving it out gets its ties (anchor, lastAnchor,
// rounds) back from the store's copy (`kept`); a session whose file went missing keeps its last panel.
export function deriveChildren(mine: HostRow[], known: Child[], read: Read, kept: (id: string) => Link | undefined): { children: Child[]; ended: string[] } {
  const ended = mine
    .filter(r => {
      const before = known.find(k => k.id === r.sessionId)
      const stopped = r.isRunning !== true && r.isArchived !== true && !read.waiting.includes(r.sessionId)
      return before !== undefined && before.starting !== true && (before.running || before.waiting === true) && stopped
    })
    .map(r => r.sessionId)
  const children = mine.map(r => {
    const before = known.find(k => k.id === r.sessionId)
    const seen = r.isRunning === true || r.isArchived === true || read.waiting.includes(r.sessionId)
    return {
      starting: before?.starting === true && !seen ? true : undefined,
      id: r.sessionId,
      name: String(r.name ?? ''),
      title: String(r.title ?? r.name ?? r.sessionId),
      running: r.isRunning === true,
      archived: r.isArchived === true,
      waiting: r.isArchived !== true && read.waiting.includes(r.sessionId),
      context: read.contexts[r.sessionId] ?? before?.context,
      engine: read.engines[r.sessionId] ?? before?.engine,
      lastAnchor: before?.lastAnchor ?? kept(r.sessionId)?.lastAnchor,
      rounds: before?.rounds ?? kept(r.sessionId)?.rounds,
      anchor: before?.anchor ?? kept(r.sessionId)?.anchor,
      panel: read.panels[r.sessionId] ?? before?.panel,
      tasks: read.panels[r.sessionId] ? undefined : before?.tasks,
    } as Child
  })
  return { children, ended }
}
