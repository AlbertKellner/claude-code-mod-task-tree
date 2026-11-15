// The published file: `~/.claude/task-tree-waits/<id>.json`, where a session says whether it waits
// on the person and shows its whole panel, for the session that opened it to draw under the task it
// was opened on. It is the contract between sessions, which may run different versions of the mod:
// this module writes it (publishWait), knows where it is (waitFile) and reads it checked
// (parsePublished, readPublished). The shape is `Published` (types/index.d.ts); `version` says
// which shape, and a file from before `version` is read as it is (tests/fixtures/publicados.ts
// keeps one file of every shape ever written). Since 2026-11-14 ("Enxugar e esvaziar (Recomendado)")
// it no longer carries `tasks` (the main group's copy for versions from before groups; still read),
// the children go in cut to their current work (trimPublished, draw/layout.ts), and the file of a
// session the app no longer lists is emptied (emptyPublished, by hooks/sessions sweepPublished).
// It is also this session's long-term copy of its own panel (with the turn's end, `turn`): out of
// the store's 30, a new process brings the panel back from it (hooks/panel fromOwnFile), while the
// session exists in the app. The hooks module gathers what to publish from the state (the kit wants the state keys literal there) and hands it over.

import type { Child, Group, Published, Send, TaskNode, Wait } from '../types'
import { debug } from './log'

export type { Published }

// The shape of the published file this version writes (`Published.version`). Files from before it
// carry none and are read as they are; a file of another version is ignored.
export const PUBLISHED_VERSION = 1

// The published file as read: `ok` the file checked and normalized (the lists are lists, the flags
// flags; what is missing is left out or empty; an element out of shape left out, see the shape
// functions below), with `dropped` saying what was left out, else `error` says why it is ignored.
// Pure: the readers log the error and what was dropped (once per session and reason, see readPublished).
export function parsePublished(text: string): { ok: Published; dropped?: string } | { error: string } {
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
  const rate = f.rate as Record<string, unknown> | undefined
  const git = f.git as Record<string, unknown> | undefined
  const turn = f.turn as Record<string, unknown> | undefined
  const drop = new Map<string, number>()
  const out: Published = {
    ...(typeof f.version === 'number' ? { version: f.version } : {}),
    waiting: f.waiting === true,
    ...(typeof f.at === 'number' ? { at: f.at } : {}),
    ...(list<unknown>(f.tasks) ? { tasks: shapeTasks(f.tasks as unknown[], drop) } : {}),
    ...(list<unknown>(f.groups) ? { groups: shapeGroups(f.groups as unknown[], drop) } : {}),
    waits: shapeObjects<Wait>(list<unknown>(f.waits) ?? [], 'espera', drop),
    children: shapeChildren(list<unknown>(f.children) ?? [], drop),
    ...(context && typeof context === 'object' && typeof context.percent === 'number' && typeof context.at === 'number' ? { context: { percent: context.percent, at: context.at } } : {}),
    ...(typeof f.engine === 'string' && f.engine !== '' ? { engine: f.engine } : {}),
    ...(f.ultracode === true ? { ultracode: true } : {}),
    // Every rate read is lit (the person, 2026-11-10: "Fica aceso"): `live` false, from a version
    // before that, is read as the rest (the field is still written, true, for those versions).
    ...(rate && typeof rate === 'object' && typeof rate.toks === 'number' && typeof rate.at === 'number'
      ? { rate: { toks: rate.toks, at: rate.at, live: true } }
      : {}),
    // A repository with its branch, or a folder (`kind: 'folder'`) with none.
    ...(git && typeof git === 'object' && typeof git.repo === 'string' && git.repo !== '' && git.kind === 'folder'
      ? { git: { kind: 'folder' as const, repo: git.repo, ...(typeof git.at === 'number' ? { at: git.at } : {}) } }
      : git && typeof git === 'object' && typeof git.repo === 'string' && git.repo !== '' && typeof git.branch === 'string' && git.branch !== ''
        ? { git: { repo: git.repo, branch: git.branch, ...(git.detached === true ? { detached: true } : {}), ...(typeof git.at === 'number' ? { at: git.at } : {}) } }
        : {}),
    ...(f.aborted === true ? { aborted: true } : {}),
    ...(typeof f.renderError === 'string' ? { renderError: f.renderError } : {}),
    ...(list<unknown>(f.work) ? { work: (f.work as unknown[]).map(String) } : {}),
    ...(list<unknown>(f.received) ? { received: shapeObjects<{ from: string; at: number }>(f.received as unknown[], 'recebimento', drop) } : {}),
    ...(list<unknown>(f.sends) ? { sends: shapeSends(f.sends as unknown[], drop) } : {}),
    ...(turn && typeof turn === 'object' && (typeof turn.ended === 'number' || turn.ended === null)
      ? { turn: { ended: turn.ended as number | null, aborted: turn.aborted === true, replan: turn.replan === true, ...(turn.failed === true ? { failed: true } : {}) } }
      : {}),
  }
  return drop.size === 0 ? { ok: out } : { ok: out, dropped: [...drop].map(([why, n]) => `${n} ${why}`).join(', ') }
}

// Each element of the file's lists is checked on its own, as far down as it goes (the tasks'
// subtasks, the children's panels): one out of shape (not an object; a group with no list of tasks; a
// task with no text id or no list of subtasks; a child with no text id; a send with no text `to`) is
// left out alone and counted by reason in `drop`, and the rest of the file is used. A title or name
// that is not text becomes text, a missing `short` the id. Nothing else is checked or changed: fields
// of earlier versions pass as they are (tests/fixtures/publicados.ts).
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const asText = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
function dropOne(drop: Map<string, number>, why: string): false {
  drop.set(why, (drop.get(why) ?? 0) + 1)
  return false
}
function shapeObjects<T>(items: unknown[], what: string, drop: Map<string, number>): T[] {
  return items.filter(v => isObject(v) || dropOne(drop, `${what} que não é objeto`)) as T[]
}
function shapeTasks(items: unknown[], drop: Map<string, number>): TaskNode[] {
  const out: TaskNode[] = []
  for (const v of items) {
    if (!isObject(v)) dropOne(drop, 'tarefa que não é objeto')
    else if (typeof v.id !== 'string') dropOne(drop, 'tarefa sem id')
    else if (!Array.isArray(v.children)) dropOne(drop, 'tarefa sem children')
    else
      out.push({
        ...v,
        ...(typeof v.title === 'string' ? {} : { title: asText(v.title) }),
        ...(v.short === undefined ? { short: v.id } : {}),
        children: shapeTasks(v.children, drop),
      } as TaskNode)
  }
  return out
}
function shapeGroups(items: unknown[], drop: Map<string, number>): Group[] {
  const out: Group[] = []
  for (const v of items) {
    if (!isObject(v)) dropOne(drop, 'grupo que não é objeto')
    else if (!Array.isArray(v.tasks)) dropOne(drop, 'grupo sem tasks')
    else {
      const past = Array.isArray(v.past)
        ? shapeObjects<Record<string, unknown>>(v.past, 'histórico', drop)
            .filter(h => Array.isArray(h.tasks) || dropOne(drop, 'histórico sem tasks'))
            .map(h => ({ ...h, tasks: shapeTasks(h.tasks as unknown[], drop) }))
        : undefined
      out.push({
        ...v,
        tasks: shapeTasks(v.tasks, drop),
        ...(Array.isArray(v.whole) ? { whole: shapeTasks(v.whole, drop) } : {}),
        ...(past ? { past } : {}),
      } as Group)
    }
  }
  return out
}
function shapeSends(items: unknown[], drop: Map<string, number>): Send[] {
  return shapeObjects<Record<string, unknown>>(items, 'envio', drop).filter(v => typeof v.to === 'string' || dropOne(drop, 'envio sem to')) as Send[]
}
function shapePanel(p: Record<string, unknown>, drop: Map<string, number>): Record<string, unknown> {
  return {
    ...p,
    ...(Array.isArray(p.tasks) ? { tasks: shapeTasks(p.tasks, drop) } : {}),
    groups: Array.isArray(p.groups) ? shapeGroups(p.groups, drop) : [],
    waits: Array.isArray(p.waits) ? shapeObjects<Wait>(p.waits, 'espera', drop) : [],
    children: Array.isArray(p.children) ? shapeChildren(p.children, drop) : [],
    ...(Array.isArray(p.received) ? { received: shapeObjects(p.received, 'recebimento', drop) } : {}),
    ...(Array.isArray(p.sends) ? { sends: shapeSends(p.sends, drop) } : {}),
  }
}
function shapeChildren(items: unknown[], drop: Map<string, number>): Child[] {
  const out: Child[] = []
  for (const v of items) {
    if (!isObject(v)) dropOne(drop, 'sessão que não é objeto')
    else if (typeof v.id !== 'string') dropOne(drop, 'sessão sem id')
    else
      out.push({
        ...v,
        ...(typeof v.name === 'string' ? {} : { name: asText(v.name) }),
        ...(typeof v.title === 'string' ? {} : { title: asText(v.title) }),
        ...(isObject(v.panel) ? { panel: shapePanel(v.panel, drop) } : {}),
        ...(Array.isArray(v.tasks) ? { tasks: shapeTasks(v.tasks, drop) } : {}),
      } as Child)
  }
  return out
}

// Where a session says whether it waits on the person, read by the session that opened it. The
// home folder is asked of the host once per module (it does not change while the mod runs; a reload
// asks again): the poll reads one file per session every few seconds.
let home: string | undefined | null = null
export async function waitFile($: any, id: string): Promise<string | undefined> {
  if (home === null) home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? undefined
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
    // A file read whole forgets what was said of this session; one read in part says what was left
    // out, once per session and reason, like the file ignored.
    const part = parsed.dropped === undefined ? undefined : `${id}|parte|${parsed.dropped}`
    for (const k of badPublished) if (k.startsWith(`${id}|`) && k !== part) badPublished.delete(k)
    if (part !== undefined && !badPublished.has(part)) {
      badPublished.add(part)
      await debug($, `task-tree: arquivo publicado de ${id} lido em parte: ${parsed.dropped}`)
    }
    return parsed.ok
  }
  const key = `${id}|${parsed.error}`
  if (!badPublished.has(key)) {
    badPublished.add(key)
    await debug($, `task-tree: arquivo publicado de ${id} ignorado: ${parsed.error}`)
  }
  return undefined
}

// What the hooks module hands over for one publication: the panel as the state holds it (`sends` whole, the taken ones too: the card of this session,
// in the session that opened it, paints the letter delivered by them) and what the last drawing left
// (its error, size and lines).
export type Publication = Pick<Published, 'turn' | 'groups' | 'waits' | 'children' | 'work' | 'received' | 'engine' | 'ultracode' | 'rate' | 'git' | 'aborted' | 'renderError' | 'drawSize' | 'rows'> & { groups: Group[]; waits: Wait[]; children: Child[]; sends: Send[] }

// Publishes whether anything in this session (`id`, as the desktop app names it; none outside the
// app) waits on the person, and its whole panel, with the share of the context window used (for the
// ring the session that opened this one draws) and the panes as the app holds them (for a panel
// that does not show up, read in the file from outside or with /task-tree). A failure is said in
// the debug log and never breaks the hook.
// Written only when something in it changed: the panel, the waits, the share of context, the model,
// the output rate, the repository and branch, the last drawing. The clocks (`at`, `context.at`,
// `rate.at`, `git.at`) and the panes are left out of the comparison,
// else every publication would differ; nobody reads `file.at` (the turns' and messages' `at` are
// inside the panel). The last publication is kept per path in a variable of the module: a reload
// forgets it and publishes once more, without harm.
const lastPublished = new Map<string, string>()
export async function publishWait($: any, id: string | undefined, p: Publication): Promise<void> {
  try {
    const path = id ? await waitFile($, id) : undefined
    if (!path) {
      // Outside the desktop app there is no id, and nothing to publish.
      if (id) await debug($, 'task-tree: sem USERPROFILE/HOME, painel não publicado')
      return
    }
    // The share of the context window used (the default usage call is free; no breakdown).
    let percent: number | undefined
    try {
      const got = (await $.session.usage())?.context?.percent
      if (typeof got === 'number') percent = got
    } catch {}
    const body = {
      version: PUBLISHED_VERSION,
      waiting: p.waits.length > 0,
      groups: p.groups,
      waits: p.waits,
      children: p.children,
      engine: p.engine,
      ultracode: p.ultracode === true ? true : undefined,
      aborted: p.aborted === true ? true : undefined,
      renderError: p.renderError,
      drawSize: p.drawSize,
      rows: p.rows,
      work: p.work,
      received: p.received,
      sends: p.sends,
      turn: p.turn,
    }
    const key = JSON.stringify({ ...body, percent, rate: p.rate ? p.rate.toks : undefined, git: p.git ? [p.git.kind ?? 'git', p.git.repo, p.git.branch, p.git.detached ?? false] : undefined })
    if (lastPublished.get(path) === key) return
    // The panes as the app holds them for this session (placed, shown or a tab behind another).
    let panes: unknown
    try {
      panes = (await $.ui.panes()).map((x: any) => ({ id: x.id, isPlaced: x.isPlaced, isShown: x.isShown }))
    } catch {}
    const at = await $.clock.now()
    const context = percent === undefined ? undefined : { percent, at }
    await $.fs.write(
      path,
      JSON.stringify({
        version: body.version,
        waiting: body.waiting,
        at,
        groups: body.groups,
        waits: body.waits,
        children: body.children,
        context,
        engine: body.engine,
        ultracode: body.ultracode,
        rate: p.rate,
        git: p.git,
        aborted: body.aborted,
        panes,
        renderError: body.renderError,
        drawSize: body.drawSize,
        rows: body.rows,
        work: body.work,
        received: body.received,
        sends: body.sends,
        turn: body.turn,
      } satisfies Published),
    )
    lastPublished.set(path, key)
  } catch (err) {
    await debug($, `task-tree: painel não publicado: ${String(err)}`)
  }
}

// Empties the published file of a session the app no longer has (hooks/sessions, sweepPublished):
// the kit cannot delete a file, so it is written again with nothing in it.
export async function emptyPublished($: any, id: string): Promise<boolean> {
  try {
    const path = await waitFile($, id)
    if (!path) return false
    await $.fs.write(path, JSON.stringify({ version: PUBLISHED_VERSION, waiting: false, waits: [], children: [] } satisfies Published))
    return true
  } catch (err) {
    await debug($, `task-tree: arquivo publicado de ${id} não esvaziado: ${String(err)}`)
    return false
  }
}
