// session.start: registers the command and the tools, brings the panel back from the store, opens
// the pane and starts reading the linked sessions. classic.SessionStart: /clear empties the panel (its
// main group keeps what it had done in `past`, for the card of the session above),
// a resume brings the session's panel back; a resume empties what the store does not hold.

import { MAIN, PAST_KEEP, interrupt } from '../draw/layout'
import { COMMAND, TOOLS } from '../text/rules'
import { loaded } from '../state/durability'
import { PANE, adopt, clearTurn, dropHeld, forgetChildren, parkDeadTurn, replace, ensureLinks, restore, restoreFromOwnFile, restoreTurn, restoreWork, restoreWorkOf, setWork } from './panel'
import { refreshChildren, sweepPublished, watchSessions } from './sessions'
import { level } from './tools'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).

import type { EngineInterface } from 'claude-code'
import type { Group, Past } from '../types'
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const receiptsState = { plugin: 'task-tree', key: 'receipts' } as const
const paneOpenedState = { plugin: 'task-tree', key: 'paneOpened' } as const
const collapsedState = { plugin: 'task-tree', key: 'collapsed' } as const

export async function sessionStart($: EngineInterface, e: any, next: any) {
  await $.command.register({ name: 'task-tree', description: COMMAND })
  await $.tool.register({
    name: 'plan',
    isDeferred: false,
    description: TOOLS.plan,
    inputSchema: {
      type: 'object',
      required: ['tasks'],
      properties: { tasks: level(level(level())), request: { type: 'string' } },
    },
  })
  await $.tool.register({
    name: 'done',
    isDeferred: false,
    description: TOOLS.done,
    inputSchema: {
      type: 'object',
      required: [],
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        cancel: { type: 'array', items: { type: 'string' }, description: TOOLS.cancel },
        summary: { type: 'string', description: TOOLS.summary },
      },
    },
  })
  await $.tool.register({
    name: 'start',
    isDeferred: false,
    description: TOOLS.start,
    inputSchema: {
      type: 'object',
      required: ['ids'],
      properties: { ids: { type: 'array', items: { type: 'string' } } },
    },
  })
  // With nothing held (a new process), a resumed session's panel comes back from the store.
  await adopt($)
  const fresh = (await $.state.get(groupsState)).value === undefined
  // Out of the store (only the last 30 sessions are there), from the file it published (fromOwnFile).
  if (fresh && !(await restore($, await $.session.id()))) await restoreFromOwnFile($)
  loaded.add('groups')
  await restoreWork($)
  await restoreTurn($)
  // A turn the store holds as going on died with the process before this one: stopped (parkDeadTurn).
  if (fresh) await parkDeadTurn($)
  await ensureLinks($)
  const r = await next(e)
  // Opens the panel with the session, so nobody has to type /task-tree: once per process. The mark
  // lives in the state, which dies with the process and survives a reload of the mod, so a reload
  // (were it to run session.start) does not open again a panel the person closed (the person,
  // 2026-11-14: "Só na sua mensagem (Recomendado)").
  if ((await $.state.get(paneOpenedState)).value !== true) {
    await $.state.set(paneOpenedState, true)
    void $.ui.open({ id: PANE, title: 'Tarefas' }).catch(() => {})
  }
  // The linked sessions' states change outside this session: polled while the session runs.
  void refreshChildren($).catch(() => {})
  watchSessions($)
  // A new process empties the published files of sessions the app no longer has, in the background.
  if (fresh) void sweepPublished($).catch(() => {})
  return r
}

export async function classicSessionStart($: EngineInterface, e: any, next: any) {
  // Everything emptied before the one publication (the replace), so it goes out clean.
  if (e.source === 'clear') {
    // What the session had done stays in its main group, as history its own panel does not draw: the
    // session above keeps its card (the person, 2026-11-14: "Mantém o histórico (Recomendado)").
    const at = await $.clock.now()
    const main = (((await $.state.get(groupsState)).value ?? []) as Group[]).find(g => g.agent === MAIN)
    const before: Past[] = main && main.tasks.length > 0 ? [{ at, tasks: main.tasks.map(interrupt(at)), ...(main.turns ? { turns: main.turns } : {}) }] : []
    const past = [...(main?.past ?? []), ...before].slice(-PAST_KEEP)
    await dropHeld($)
    await $.state.set(sendsState, [])
    await $.state.set(receiptsState, {})
    await setWork($, [])
    await clearTurn($)
    await forgetChildren($)
    // The person's folds go with the panel: no plan after the /clear is born folded (the lines folded,
    // the histories opened and the mark of the shortened texts).
    await $.state.set(collapsedState, {})
    // The idle spans stay (closed at the /clear): the history's cards leave them out of their times too.
    const idle = (main?.idle ?? []).map(x => (x.to === undefined ? { ...x, to: Math.max(at, x.from) } : x))
    await replace($, [{ agent: MAIN, label: '', tasks: [], ...(past.length > 0 ? { past } : {}), ...(idle.length > 0 ? { idle } : {}) }])
  }
  if (e.source === 'resume') {
    await dropHeld($)
    if (!(await restore($, e.session_id))) await replace($, [{ agent: MAIN, label: '', tasks: [] }])
    await restoreWorkOf($, e.session_id)
    await restoreTurn($, e.session_id, true)
    await parkDeadTurn($)
  }
  return next(e)
}
