// classic.PermissionRequest: a permission the person is asked for shows in the panel until the
// call ends (questions and plans are shown from tool.call).

import { MAIN } from '../draw/layout'
import { addWait } from './panel'

// A permission the person is asked for: the panel shows it until the call ends (no
// event marks the answer). Questions and plans are shown from tool.call below.

import type { EngineInterface } from 'claude-code'
export async function permissionRequest($: EngineInterface, e: any, next: any) {
  if (e.tool_name !== 'AskUserQuestion' && e.tool_name !== 'ExitPlanMode') {
    const agent = e.agent_id ?? MAIN
    await addWait($, {
      agent,
      kind: 'permission',
      tool: e.tool_name,
      key: `${agent}:${e.tool_name}`,
    })
  }
  return next(e)
}
