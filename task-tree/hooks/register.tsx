// The hooks module: registers every hook of the mod, each one a function of its own file (the kit
// takes a hook by the name of a function; the state's keys are literal in the file that calls
// $.state). Nothing else lives here.

import type { Register } from 'claude-code'

import { classicSessionStart, sessionStart } from './session-start'
import { promptCompose, promptSubmit } from './prompt-submit'
import { commandRun } from './command'
import { doneTool, planTool, startTool } from './tools'
import { permissionRequest } from './permission'
import { turnComplete, turnStep } from './turn'
import { toolCall } from './tool-call'
import { press, render } from './render'

export const register: Register = on => {
  on('session.start', sessionStart)
  on('classic.SessionStart', classicSessionStart)
  on('prompt.submit', promptSubmit)
  on('prompt.compose', promptCompose)
  on('command.run', { command: 'task-tree' }, commandRun)
  on('tool.call', { tool: 'mcp__task-tree__plan' }, planTool)
  on('tool.call', { tool: 'mcp__task-tree__done' }, doneTool)
  on('tool.call', { tool: 'mcp__task-tree__start' }, startTool)
  on('classic.PermissionRequest', permissionRequest)
  on('turn.step', turnStep)
  on('turn.complete', turnComplete)
  on('tool.call', toolCall)
  on('ui.press', press)
  on('ui.render', { component: 'Pane', requestId: 'task-tree' }, render)
}
