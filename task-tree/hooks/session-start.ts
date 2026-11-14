// session.start: registers the command and the tools, brings the panel back from the store, opens
// the pane and starts reading the linked sessions. classic.SessionStart: /clear empties the panel,
// a resume brings the session's panel back; a resume empties what the store does not hold.

import { MAIN } from '../draw/layout'
import { COMMAND, TOOLS } from '../text/rules'
import { loaded } from '../state/durability'
import { PANE, adopt, clearTurn, dropHeld, forgetChildren, parkDeadTurn, replace, ensureLinks, restore, restoreTurn, restoreWork, restoreWorkOf, setWork } from './panel'
import { refreshChildren, watchSessions } from './sessions'
import { level } from './tools'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).

import type { EngineInterface } from 'claude-code'
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const

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
  if (fresh) await restore($, await $.session.id())
  loaded.add('groups')
  await restoreWork($)
  await restoreTurn($)
  // A turn the store holds as going on died with the process before this one: stopped (parkDeadTurn).
  if (fresh) await parkDeadTurn($)
  await ensureLinks($)
  const r = await next(e)
  // Opens the panel with the session, so nobody has to type /task-tree.
  void $.ui.open({ id: PANE, title: 'Tarefas' }).catch(() => {})
  // The linked sessions' states change outside this session: polled while the session runs.
  void refreshChildren($).catch(() => {})
  watchSessions($)
  return r
}

export async function classicSessionStart($: EngineInterface, e: any, next: any) {
  // Everything emptied before the one publication (the replace), so it goes out clean.
  if (e.source === 'clear') {
    await dropHeld($)
    await $.state.set(sendsState, [])
    await setWork($, [])
    await clearTurn($)
    await forgetChildren($)
    await replace($, [{ agent: MAIN, label: '', tasks: [] }])
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
