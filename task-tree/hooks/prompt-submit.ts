// prompt.submit: what a prompt is (said, pure: another session's message, a subagent's hand-back,
// the app's notice, or a request) decides its effects: the messages received are kept, the pane
// comes back, a request opens a turn and drops the open question, and the reminders (a session
// that ended its turn, a message taken up, what the last request left open) go in its context.
// prompt.compose: the rules go in the system prompt while the panel's tools are there.

import { MAIN, hasOpen } from '../draw/layout'
import { PROMPT, RULES } from '../text/rules'
import { reminders, dropWaits, openList, openTurn, showPane, wake } from './panel'
import { endedNote, noteReceived, refreshChildren, refreshStale, takenNote, watchSessions } from './sessions'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const

// The main loop's group; a subagent's is keyed by its agentId.
// Prompt origins (`prompt.submit`'s `e.origin.kind`) that continue the request in progress rather
// than make a new one: background tasks' notifications (a subagent's hand-back), observers'
// reports, follow-ups of a UI action and the engine's own notices.
const NO_TURN = ['task-notification', 'observer', 'observer-activity', 'auto-continuation', 'unclassified']

// What a prompt is, with the app's status blocks (`<system-reminder>…</system-reminder>`, put in
// front of a session's first message and of queued deliveries) taken out: another session's message,
// a subagent handing back, the app's own notice, or a request.
export type Said = { body: string; peer: boolean; handback: boolean; notice: boolean; title: string }
export function said(text: string): Said {
  const body = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
  const peer = /<cross-session-message\b/.test(body)
  const handback = !peer && (/^<agent-message from="(?!local_)/.test(body) || /\[Subagent hand-back\]/.test(body))
  const notice = !peer && !handback && (body === '' || body.startsWith('<side-sessions-event>'))
  const inner = /<cross-session-message[^>]*>([\s\S]*?)(<\/cross-session-message>|$)/.exec(body)?.[1]
  return { body, peer, handback, notice, title: peer && inner !== undefined ? inner : body }
}

// Reminds the model, with every prompt, that every request opens a task in the panel.

import type { EngineInterface } from 'claude-code'
export async function promptSubmit($: EngineInterface, e: any, next: any) {
  // Where it came from (`e.origin.kind`, set by the engine). A background task's notification (a
  // subagent handing back, a command that ended) or an engine notice (`unclassified`: idle notices,
  // delivery receipts, the desktop app's events) continues the request in progress: no turn, no
  // reminder of a new request; only a short one to bring the panel up to date.
  const kind = String((e as any).origin?.kind ?? '')
  const text = typeof e.text === 'string' ? e.text : ''
  const it = said(text)
  // Another session's messages are kept (from, when) and published, whatever this prompt turns out
  // to be: the sender confirms its queued SendMessage by them (watchSends).
  await noteReceived($, text)
  // A prompt starts a turn: what the last one left open is in progress again.
  await wake($)
  watchSessions($)
  // The person's own prompt: the panel comes back if it is not on screen (see showPane).
  if (!it.peer && !it.notice && !it.handback && !NO_TURN.includes(kind)) await showPane($)
  // The desktop app's own notices (a session that ended its turn, <side-sessions-event>) and a
  // subagent's hand-back (`<agent-message from="<agentId>">` "[Subagent hand-back] …") are known by
  // their text: they do not come as `unclassified` or `task-notification`.
  if (!it.peer && (NO_TURN.includes(kind) || it.notice || it.handback)) {
    // The app's notice says a session ended its turn: read the list now, for its reminders.
    if (it.notice) await refreshChildren($).catch(() => {})
    const note = await endedNote($)
    const taken = await takenNote($)
    return next({
      ...e,
      context: [
        ...(e.context ?? []),
        ...(note ? [note] : []),
        ...(taken ? [taken] : []),
        it.handback ? PROMPT.handback : kind === 'task-notification' ? PROMPT.background : PROMPT.notice,
      ],
    })
  }
  // Safety net: a new message means the main loop has no question open.
  await dropWaits($, w => w.agent !== MAIN || w.kind === 'permission')
  // A new request gets its own reminder at its first tool call without a plan.
  reminders.unplanned = 0
  reminders.planned = false
  // Every other message opens a turn, those another session sends too (they arrive as meta): each
  // is a request of its own, and the current work follows turns (startsWork).
  await openTurn($, it.title)
  // A stale list first: a session that ended its turn is reminded of now, not later.
  await refreshStale($).catch(() => {})
  const note = await endedNote($)
  const taken = await takenNote($)
  // What the last request left open (a question answered here, work this message replaces)
  // is listed, so it is closed rather than left running under the new plan.
  const { value: groups = [] } = await $.state.get(groupsState)
  const tasks = groups.find(g => g.agent === MAIN)?.tasks ?? []
  const left = hasOpen(tasks) ? PROMPT.open(openList(tasks), reminders.answeredInChat) : undefined
  reminders.answeredInChat = false
  return next({
    ...e,
    context: [...(e.context ?? []), ...(note ? [note] : []), ...(taken ? [taken] : []), ...(left ? [left] : []), PROMPT.request],
  })
}

export async function promptCompose($: EngineInterface, e: any, next: any) {
  const r = await next(e)
  if (!e.tools.includes('mcp__task-tree__plan')) return r
  return { ...r, sections: [...r.sections, { id: 'task-tree:regras', text: RULES, scope: 'session' as const }] }
}
