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
// plain inputs; the tests of the sessions and of durability cover them, through the kit's `host`.

import type { Child, GitInfo, Panel, Published, Rate } from '../types'
import type { Link } from '../state/durability'
import { MAIN, published } from '../draw/layout'
import { readPublished } from './publish'
import { debugOnce } from './log'

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
// The app's list of linked sessions (archived ones included), or why it could not be read. A list that
// comes at the limit asked may leave sessions out: said once in the debug log.
export const LIST_LIMIT = 100
export async function listSessions($: any): Promise<{ rows: unknown } | { error: string }> {
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { linked: true, include_archived: true, limit: LIST_LIMIT })
    const rows = parseSessions(r)
    if (Array.isArray(rows) && rows.length >= LIST_LIMIT)
      await debugOnce($, `task-tree: a lista de sessões veio com ${LIST_LIMIT} linhas (o limite pedido); pode haver sessões fora dela`)
    return { rows }
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
// the share of context used, their model and effort, their output rate, and their repository and branch.
// `skipped`: the archived sessions whose file was not read (see readFiles): they keep what they had.
// `files`: the sessions whose file was read this time (a rate missing from it is no rate).
export type Read = { waiting: string[]; aborted: string[]; panels: Record<string, Panel>; contexts: Record<string, number>; engines: Record<string, string>; ultras: string[]; rates: Record<string, Rate>; gits: Record<string, GitInfo>; skipped?: string[]; files?: string[] }
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
// An archived session already read while archived (its entry in `known` says so) is not read again:
// it keeps what it had (deriveChildren); unarchived, it is read again. After a restart the children
// come back from the store without `archived`, so the first read reads them all.
// A known session's file that could not be read (none, unreadable, invalid) keeps what the last read
// said of `waiting`, `aborted` and `ultracode` for up to MISSES_KEPT reads in a row (counted here,
// cleared by the next good read); after that it is read as empty, as the app says of the session.
const MISSES_KEPT = 3
const misses = new Map<string, number>()
export async function readFiles($: any, mine: HostRow[], known: Child[] = []): Promise<Read> {
  const read: Read = { waiting: [], aborted: [], panels: {}, contexts: {}, engines: {}, ultras: [], rates: {}, gits: {}, skipped: [], files: [] }
  for (const r of mine) {
    if (r.isArchived === true && known.some(k => k.id === r.sessionId && k.archived === true)) {
      read.skipped!.push(r.sessionId)
      continue
    }
    try {
      const got = await readPublished($, r.sessionId)
      const missed = got === undefined ? (misses.get(r.sessionId) ?? 0) + 1 : 0
      if (missed === 0) misses.delete(r.sessionId)
      else misses.set(r.sessionId, missed)
      const before = missed > 0 && missed <= MISSES_KEPT ? known.find(k => k.id === r.sessionId) : undefined
      if (got !== undefined) read.files!.push(r.sessionId)
      const file = got ?? { waiting: before?.waiting === true, aborted: before?.aborted === true, ultracode: before?.ultracode === true, waits: [], children: [] }
      if (file.waiting) read.waiting.push(r.sessionId)
      if (file.aborted) read.aborted.push(r.sessionId)
      if (file.context) read.contexts[r.sessionId] = file.context.percent
      if (file.rate) read.rates[r.sessionId] = file.rate
      if (file.git) read.gits[r.sessionId] = file.git
      if (file.ultracode) read.ultras.push(r.sessionId)
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
  const name = m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}${m[3] !== undefined ? `.${m[3]}` : ''}` : id.slice(0, 24)
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
// idle; the mark lasts STARTING_GRACE at most, and goes at the first read that finds tasks published
// (then a stopped one ended its turn: it ran unseen between two reads). A session the host lists again after leaving it out gets its ties (anchor, lastAnchor,
// rounds, places) back from the store's copy (`kept`); a session whose file went missing keeps its last panel.
// A session just opened (start_session) that the host's list does not hold yet stays in the children
// while recent (STARTING_GRACE from its `openedAt`), with the task it was opened on: dropped at the
// first read, its tie was lost and its card, once listed, went to the end. One with no `openedAt` (an
// earlier version) has no grace.
export const STARTING_GRACE = 120_000
export const justOpened = (c: Child, now: number | undefined) =>
  c.starting === true && typeof c.openedAt === 'number' && now !== undefined && now - c.openedAt < STARTING_GRACE
export function deriveChildren(mine: HostRow[], known: Child[], read: Read, kept: (id: string) => Link | undefined, now?: number): { children: Child[]; ended: string[] } {
  const ended = mine
    .filter(r => {
      const before = known.find(k => k.id === r.sessionId)
      const stopped = r.isRunning !== true && r.isArchived !== true && !read.waiting.includes(r.sessionId)
      if (before === undefined || !stopped) return false
      // One still opening ended its turn too once it has published tasks: it ran and stopped between
      // two reads, never seen running (the person, 2026-11-15: "Tratar como quem já rodou").
      if (before.starting === true) return published({ ...before, panel: read.panels[r.sessionId] ?? before.panel, tasks: read.panels[r.sessionId] ? undefined : before.tasks })
      return before.running || before.waiting === true
    })
    .map(r => r.sessionId)
  const children = mine.map(r => {
    const before = known.find(k => k.id === r.sessionId)
    const seen = r.isRunning === true || r.isArchived === true || read.waiting.includes(r.sessionId)
    // Not read this time (archived, see readFiles): what its file said last time stays.
    const skipped = read.skipped?.includes(r.sessionId) === true
    const child = {
      id: r.sessionId,
      name: String(r.name ?? ''),
      title: String(r.title ?? r.name ?? r.sessionId),
      running: r.isRunning === true,
      archived: r.isArchived === true,
      waiting: r.isArchived !== true && read.waiting.includes(r.sessionId),
      aborted: (skipped ? before?.aborted === true : read.aborted.includes(r.sessionId)) || undefined,
      context: read.contexts[r.sessionId] ?? before?.context,
      engine: read.engines[r.sessionId] ?? before?.engine,
      // As its file says it at each read: off once it no longer does.
      ultracode: (skipped ? before?.ultracode === true : read.ultras.includes(r.sessionId)) || undefined,
      // As its file says it when the file was read (none there: no rate, as after a change of model);
      // only a file not read keeps the last one.
      rate: read.rates[r.sessionId] ?? (read.files?.includes(r.sessionId) === true ? undefined : before?.rate),
      git: read.gits[r.sessionId] ?? before?.git,
      lastAnchor: before?.lastAnchor ?? kept(r.sessionId)?.lastAnchor,
      rounds: before?.rounds ?? kept(r.sessionId)?.rounds,
      places: before?.places ?? kept(r.sessionId)?.places,
      anchor: before?.anchor ?? kept(r.sessionId)?.anchor,
      openedAt: before?.openedAt ?? kept(r.sessionId)?.openedAt,
      panel: read.panels[r.sessionId] ?? before?.panel,
      tasks: read.panels[r.sessionId] ? undefined : before?.tasks,
      // Kept as one line (hooks/sessions, summarize) while archived and not read again.
      summary: r.isArchived === true && !read.panels[r.sessionId] ? before?.summary : undefined,
    } as Child
    // Still opening while the host has not seen it run, has no task published yet and is recent
    // (STARTING_GRACE): past it, or once it published, it reads as the host lists it.
    const opening = before?.starting === true && !seen && !published(child) && justOpened(before, now)
    return { starting: opening ? true : undefined, ...child } as Child
  })
  const waiting = known.filter(k => !mine.some(r => r.sessionId === k.id) && justOpened(k, now))
  return { children: [...children, ...waiting], ended }
}

// ---- The published files of sessions the app no longer has (hooks/sessions, sweepPublished)

// The ids of every session the app lists, archived included, or undefined when the list failed or
// came at its limit (then some may be missing, and nothing is decided).
export async function allSessionIds($: any, limit = 500): Promise<string[] | undefined> {
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { include_archived: true, limit })
    const rows = parseSessions(r)
    if (!Array.isArray(rows) || rows.length >= limit) return undefined
    return rows.map((x: any) => String(x?.sessionId ?? ''))
  } catch {
    return undefined
  }
}
// Whether the app says the session does not exist: get_session answers an error "Session <id> not
// found." (measured 2026-11-14). Any other answer, or a failure of another kind, is not a no.
export async function sessionGone($: any, id: string): Promise<boolean> {
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: id })
    const body = (r?.content ?? []).map((c: any) => (c?.type === 'text' ? c.text ?? '' : '')).join('')
    return r?.isError === true && /not found/i.test(body)
  } catch {
    return false
  }
}
// The published files that may belong to a session gone from the app: `local_….json`, not this
// session's, over 1 KB and not written for a day; at most `max` of them.
export function staleFiles(entries: { name: string; kind?: string; size: number; mtimeMs: number }[], self: string, now: number, max = 20): string[] {
  return entries
    .filter(e => (e.kind === undefined || e.kind === 'file') && /^local_[\w-]+\.json$/.test(e.name) && e.size > 1024 && now - e.mtimeMs > 24 * 3600 * 1000)
    .map(e => e.name.slice(0, -'.json'.length))
    .filter(id => id !== self)
    .slice(0, max)
}
