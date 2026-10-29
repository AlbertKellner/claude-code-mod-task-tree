// session.start: registers the command and the tools, brings the panel back from the store, opens
// the pane and starts reading the linked sessions. classic.SessionStart: /clear empties the panel,
// a resume brings the session's panel back.

import { MAIN } from '../draw/layout'
import { COMMAND, TOOLS } from '../text/rules'
import { loaded } from '../state/durability'
import { PANE, adopt, clearTurn, replace, restore, restoreLinks, restoreTurn, restoreView, restoreWork, setWork } from './panel'
import { refreshChildren, watchSessions } from './sessions'
import { level } from './tools'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).

import type { EngineInterface } from 'claude-code'
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
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
  if ((await $.state.get(groupsState)).value === undefined) await restore($, await $.session.id())
  loaded.add('groups')
  await restoreView($)
  await restoreWork($)
  await restoreTurn($)
  await restoreLinks($)
  const r = await next(e)
  // Opens the panel with the session, so nobody has to type /task-tree.
  void $.ui.open({ id: PANE, title: 'Tarefas' }).catch(() => {})
  // The linked sessions' states change outside this session: polled while the session runs.
  void refreshChildren($).catch(() => {})
  watchSessions($)
  return r
}

export async function classicSessionStart($: EngineInterface, e: any, next: any) {
  if (e.source === 'clear') {
    await replace($, [{ agent: MAIN, label: '', tasks: [] }])
    await $.state.set(waitsState, [])
    await $.state.set(sendsState, [])
    await setWork($, [])
    await clearTurn($)
  }
  if (e.source === 'resume') {
    await restore($, e.session_id)
    await restoreTurn($, e.session_id, true)
  }
  return next(e)
}
