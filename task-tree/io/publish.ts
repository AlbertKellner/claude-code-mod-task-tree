// The published file: `~/.claude/task-tree-waits/<id>.json`, where a session says whether it waits
// on the person and shows its whole panel, for the session that opened it to draw under the task it
// was opened on. It is the contract between sessions, which may run different versions of the mod:
// this module writes it (publishWait), knows where it is (waitFile) and reads it checked
// (parsePublished, readPublished). The shape is `Published` (types/index.d.ts); `version` says
// which shape, and a file from before `version` is read as it is (tests/fixtures/publicados.ts
// keeps one file of every shape ever written). The hooks module gathers what to publish from the
// state (the kit wants the state keys literal there) and hands it over.

import type { Child, Group, Published, Send, TaskNode, Wait } from '../types'
import { debug } from './log'

export type { Published }

// The shape of the published file this version writes (`Published.version`). Files from before it
// carry none and are read as they are; a file of another version is ignored.
export const PUBLISHED_VERSION = 1

// The published file as read: `ok` the file checked and normalized (the lists are lists, the flags
// flags; what is missing is left out or empty), else `error` says why it is ignored. Pure: the
// readers log the error (once per session and reason, see readPublished).
export function parsePublished(text: string): { ok: Published } | { error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    return { error: `JSON inválido (${String((err as any)?.message ?? err).slice(0, 80)})` }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { error: `não é um objeto (${Array.isArray(raw) ? 'lista' : typeof raw})` }
  const f = raw as Record<string, unknown>
  if (f.version !== undefined && f.version !== PUBLISHED_VERSION) return { error: `versão ${String(f.version)}, esta é ${PUBLISHED_VERSION}` }
  const list = <T,>(v: unknown): T[] | undefined => (Array.isArray(v) ? (v as T[]) : undefined)
  const context = f.context as Record<string, unknown> | undefined
  const out: Published = {
    ...(typeof f.version === 'number' ? { version: f.version } : {}),
    waiting: f.waiting === true,
    ...(typeof f.at === 'number' ? { at: f.at } : {}),
    ...(list<TaskNode>(f.tasks) ? { tasks: list<TaskNode>(f.tasks) } : {}),
    ...(list<Group>(f.groups) ? { groups: list<Group>(f.groups) } : {}),
    waits: list<Wait>(f.waits) ?? [],
    children: list<Child>(f.children) ?? [],
    ...(context && typeof context === 'object' && typeof context.percent === 'number' && typeof context.at === 'number' ? { context: { percent: context.percent, at: context.at } } : {}),
    ...(typeof f.engine === 'string' && f.engine !== '' ? { engine: f.engine } : {}),
    ...(typeof f.renderError === 'string' ? { renderError: f.renderError } : {}),
    ...(list<unknown>(f.work) ? { work: (f.work as unknown[]).map(String) } : {}),
    ...(list<{ from: string; at: number }>(f.received) ? { received: list<{ from: string; at: number }>(f.received) } : {}),
    ...(list<Send>(f.sends) ? { sends: list<Send>(f.sends) } : {}),
  }
  return { ok: out }
}

// Where a session says whether it waits on the person, read by the session that opened it.
export async function waitFile($: any, id: string): Promise<string | undefined> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  return home ? `${home}/.claude/task-tree-waits/${id}.json` : undefined
}

// A session's published file, read and checked; `undefined` when there is none to use (no path,
// unreadable, or invalid: then said once in the debug log, per session and reason, as the poll
// reads it every few seconds).
const badPublished = new Set<string>()
export async function readPublished($: any, id: string): Promise<Published | undefined> {
  const path = await waitFile($, id)
  if (!path) return undefined
  let text: string
  try {
    text = await $.fs.read(path)
  } catch {
    return undefined
  }
  const parsed = parsePublished(text)
  if ('ok' in parsed) {
    for (const k of badPublished) if (k.startsWith(`${id}|`)) badPublished.delete(k)
    return parsed.ok
  }
  const key = `${id}|${parsed.error}`
  if (!badPublished.has(key)) {
    badPublished.add(key)
    await debug($, `task-tree: arquivo publicado de ${id} ignorado: ${parsed.error}`)
  }
  return undefined
}

// What the hooks module hands over for one publication: the panel as the state holds it (`tasks`,
// the main group's, is for earlier versions; `sends` as queued, the taken ones are dropped here) and
// what the last drawing left (its error, size and lines).
export type Publication = Pick<Published, 'tasks' | 'groups' | 'waits' | 'children' | 'work' | 'received' | 'engine' | 'renderError' | 'drawSize' | 'rows'> & { tasks: TaskNode[]; groups: Group[]; waits: Wait[]; children: Child[]; sends: Send[] }

// Publishes whether anything in this session (`id`, as the desktop app names it; none outside the
// app) waits on the person, and its whole panel, with the share of the context window used (for the
// ring the session that opened this one draws) and the panes as the app holds them (for a panel
// that does not show up, read in the file from outside or with /task-tree). A failure is said in
// the debug log and never breaks the hook.
export async function publishWait($: any, id: string | undefined, p: Publication): Promise<void> {
  try {
    const path = id ? await waitFile($, id) : undefined
    if (!path) {
      // Outside the desktop app there is no id, and nothing to publish.
      if (id) await debug($, 'task-tree: sem USERPROFILE/HOME, painel não publicado')
      return
    }
    // The share of the context window used (the default usage call is free; no breakdown).
    let context: { percent: number; at: number } | undefined
    try {
      const percent = (await $.session.usage())?.context?.percent
      if (typeof percent === 'number') context = { percent, at: await $.clock.now() }
    } catch {}
    // The panes as the app holds them for this session (placed, shown or a tab behind another).
    let panes: unknown
    try {
      panes = (await $.ui.panes()).map((x: any) => ({ id: x.id, isPlaced: x.isPlaced, isShown: x.isShown }))
    } catch {}
    await $.fs.write(
      path,
      JSON.stringify({
        version: PUBLISHED_VERSION,
        waiting: p.waits.length > 0,
        at: await $.clock.now(),
        tasks: p.tasks,
        groups: p.groups,
        waits: p.waits,
        children: p.children,
        context,
        engine: p.engine,
        panes,
        renderError: p.renderError,
        drawSize: p.drawSize,
        rows: p.rows,
        work: p.work,
        received: p.received,
        sends: p.sends.filter(x => !x.taken),
      } satisfies Published),
    )
  } catch (err) {
    await debug($, `task-tree: painel não publicado: ${String(err)}`)
  }
}
