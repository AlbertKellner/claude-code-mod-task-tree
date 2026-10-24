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
  const rate = f.rate as Record<string, unknown> | undefined
  const git = f.git as Record<string, unknown> | undefined
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
    ...(rate && typeof rate === 'object' && typeof rate.toks === 'number' && typeof rate.at === 'number' && typeof rate.live === 'boolean'
      ? { rate: { toks: rate.toks, at: rate.at, live: rate.live } }
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
    ...(list<{ from: string; at: number }>(f.received) ? { received: list<{ from: string; at: number }>(f.received) } : {}),
    ...(list<Send>(f.sends) ? { sends: list<Send>(f.sends) } : {}),
  }
  return { ok: out }
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
export type Publication = Pick<Published, 'tasks' | 'groups' | 'waits' | 'children' | 'work' | 'received' | 'engine' | 'rate' | 'git' | 'aborted' | 'renderError' | 'drawSize' | 'rows'> & { tasks: TaskNode[]; groups: Group[]; waits: Wait[]; children: Child[]; sends: Send[] }

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
      tasks: p.tasks,
      groups: p.groups,
      waits: p.waits,
      children: p.children,
      engine: p.engine,
      aborted: p.aborted === true ? true : undefined,
      renderError: p.renderError,
      drawSize: p.drawSize,
      rows: p.rows,
      work: p.work,
      received: p.received,
      sends: p.sends.filter(x => !x.taken),
    }
    const key = JSON.stringify({ ...body, percent, rate: p.rate ? [p.rate.toks, p.rate.live] : undefined, git: p.git ? [p.git.kind ?? 'git', p.git.repo, p.git.branch, p.git.detached ?? false] : undefined })
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
        tasks: body.tasks,
        groups: body.groups,
        waits: body.waits,
        children: body.children,
        context,
        engine: body.engine,
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
      } satisfies Published),
    )
    lastPublished.set(path, key)
  } catch (err) {
    await debug($, `task-tree: painel não publicado: ${String(err)}`)
  }
}
