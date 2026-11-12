// prompt.submit: what a prompt is (said, pure: another session's message, a subagent's hand-back,
// the app's notice, or a request) decides its effects: the messages received are kept, the pane
// comes back, a request opens a turn and drops the open question, and the reminders (a session
// that ended its turn, a message taken up, what the last request left open) go in its context. A
// message delivered into a running turn continues the request in progress: no turn of its own.
// prompt.compose: the rules go in the system prompt while the panel's tools are there.

import type { Child } from '../types'
import { MAIN, hasOpen } from '../draw/layout'
import { PROMPT, RULES } from '../text/rules'
import { reminders, dropWaits, ensureGroups, openList, openTurn, saveTurn, showPane, wake } from './panel'
import { endedNote, noteReceived, refreshChildren, refreshStale, takenNote, watchSessions } from './sessions'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const turnAbortedState = { plugin: 'task-tree', key: 'turnAborted' } as const
const replanDueState = { plugin: 'task-tree', key: 'replanDue' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const

// The main loop's group; a subagent's is keyed by its agentId.
// Prompt origins (`prompt.submit`'s `e.origin.kind`) that continue the request in progress rather
// than make a new one: background tasks' notifications (a subagent's hand-back), observers'
// reports, follow-ups of a UI action and the engine's own notices.
const NO_TURN = ['task-notification', 'observer', 'observer-activity', 'auto-continuation', 'unclassified']

// What a prompt is, with the app's status blocks (`<system-reminder>…</system-reminder>`, put in
// front of a session's first message and of queued deliveries) taken out: another session's message,
// a subagent handing back, the app's own notice, or a request.
export type Said = { body: string; peer: boolean; handback: boolean; notice: boolean; title: string; from?: { id: string; name?: string } }
export function said(text: string): Said {
  const body = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
  const peer = /<cross-session-message\b/.test(body)
  const handback = !peer && (/^<agent-message from="(?!local_)/.test(body) || /\[Subagent hand-back\]/.test(body))
  const notice = !peer && !handback && (body === '' || body.startsWith('<side-sessions-event>'))
  const inner = /<cross-session-message[^>]*>([\s\S]*?)(<\/cross-session-message>|$)/.exec(body)?.[1]
  // Who sent it (the first message's tag): its id and the name the tag gives.
  const tag = /<cross-session-message\b[^>]*>/.exec(body)?.[0] ?? ''
  const id = /\bfrom="([^"]+)"/.exec(tag)?.[1]
  const name = /\bname="([^"]*)"/.exec(tag)?.[1]
  const from = peer && id ? { id, ...(name ? { name } : {}) } : undefined
  return { body, peer, handback, notice, title: peer && inner !== undefined ? inner : body, ...(from ? { from } : {}) }
}

// Whether every message of other sessions in a prompt comes from a session this one opened (its
// report), as the host lists them; an entry a send made, not yet seen by the host, is not one.
async function fromChildren($: any, text: string): Promise<boolean> {
  const froms = [...text.matchAll(/<cross-session-message[^>]*\bfrom="([^"]+)"/g)].map(m => m[1] as string)
  if (froms.length === 0) return false
  const { value: children = [] } = await $.state.get(childrenState)
  return froms.every(id => (children as Child[]).some(c => c.id === id && c.starting !== true))
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
  // A turn of this session was interrupted (stopped) and no request came since: the next request, the
  // person's or another session's, gets the reminder to replan the panel (the person's rule), and
  // clears the mark. A turn that opened no request in between (the app's notice, a hand-back) does
  // not take it away (replanDue; turnAborted, the last turn's end, for a state from before it).
  const aborted = (await $.state.get(turnAbortedState)).value === true || (await $.state.get(replanDueState)).value === true
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
  // Safety net: a new message means the main loop has no question open. Not one delivered into a
  // running turn (`e.turnId`: another session's message, or one typed over the turn): the question or
  // plan dialog may still be on screen, and its call drops its wait when it returns (and the turn's end).
  const midTurn = typeof e.turnId === 'string' && e.turnId !== ''
  await dropWaits($, w => w.agent !== MAIN || w.kind === 'permission' || (midTurn && (w.kind === 'question' || w.kind === 'plan')))
  // A message delivered into a running turn, the report of a session this one opened or one the
  // person typed over the turn, continues the request in progress (the person, 2026-11-12: "Entra
  // no pedido em curso (Recomendado)"): it opens no turn, so it gets no line of its own and no ✉,
  // the request's reminders stay as they are, and what the model plans next stays in the request
  // open now, where a replan with the same id keeps the state (planTool's sameRequest). It opened a
  // request at once: the replan that followed, in the same turn of the model, fell under "a new
  // request" and left the task in progress as history, all of it pending again and its session's
  // card loose. Not after a stop (the replan the person asked for comes with the next request,
  // below), nor with no request yet to continue. The sender still confirms its letter by this
  // message (noteReceived, above), and the person's own brings the pane back (showPane).
  // A message of a session this one did not open (the one that opened it, a sister) still opens its
  // request: that session draws this one's card by the turns its messages open (the person,
  // 2026-10-21: "o novo vai sob a tarefa da principal que mandou a mensagem").
  if (midTurn && !aborted && (!it.peer || (await fromChildren($, it.body)))) {
    await ensureGroups($)
    const { value: held = [] } = await $.state.get(groupsState)
    if ((held.find(g => g.agent === MAIN)?.turns ?? []).length > 0) {
      await refreshStale($).catch(() => {})
      const note = await endedNote($)
      const taken = await takenNote($)
      const { value: groups = [] } = await $.state.get(groupsState)
      const tasks = groups.find(g => g.agent === MAIN)?.tasks ?? []
      // The person's message may be the answer to a question dismissed for the chat (see asked).
      const answered = !it.peer && reminders.answeredInChat
      if (!it.peer) reminders.answeredInChat = false
      return next({
        ...e,
        context: [...(e.context ?? []), ...(note ? [note] : []), ...(taken ? [taken] : []), PROMPT.midTurn(hasOpen(tasks) ? openList(tasks) : '', answered)],
      })
    }
  }
  // A new request gets its own reminder at its first tool call without a plan.
  reminders.unplanned = 0
  reminders.planned = false
  // Every other message opens a turn, those another session sends too (they arrive as meta): each
  // is a request of its own, and the current work follows turns (startsWork).
  await openTurn($, it.title, !it.peer, it.from)
  // A stale list first: a session that ended its turn is reminded of now, not later.
  await refreshStale($).catch(() => {})
  const note = await endedNote($)
  const taken = await takenNote($)
  // What the last request left open (a question answered here, work this message replaces)
  // is listed, so it is closed rather than left running under the new plan.
  const { value: groups = [] } = await $.state.get(groupsState)
  const tasks = groups.find(g => g.agent === MAIN)?.tasks ?? []
  if (aborted) {
    await $.state.set(turnAbortedState, false)
    await $.state.set(replanDueState, false)
    await saveTurn($)
  }
  // After an interrupted turn, the message that comes next, the person's or another session's, asks
  // for a replan of the panel instead of the list of what was left open (the replan covers it).
  const left = aborted && hasOpen(tasks)
    ? it.peer ? PROMPT.interrupted(openList(tasks)) : PROMPT.interruptedByYou(openList(tasks), reminders.answeredInChat)
    : aborted && it.peer ? PROMPT.interruptedEmpty
    : hasOpen(tasks) ? PROMPT.open(openList(tasks), reminders.answeredInChat) : undefined
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
