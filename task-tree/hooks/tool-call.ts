// tool.call, the generic hook: one handler per responsibility, run in order (R17). Before the call:
// a launch (Agent) records the task the loop is on; a question or a plan to approve takes the whole
// call (the wait while it is open, the answer's reminder); a wrap_up keeps its recap and its
// question as a wait. After the call, for the main loop only: the clocks and the sessions' list come
// back, a start_session records its session, then each note handler adds, in order, what it has to say
// to the result (a message only queued, a session that ended its turn, a message taken up, what a
// wrap_up leaves open) and, last, the reminder to plan: the first call with no open plan, and every
// 10th after it (what prompt.submit misses: answers to questions, work Claude continues on its own).

import { update } from 'claude-code'

import type { Child, Group, Send, TaskNode, Wait } from '../types'
import { ASK, SEND, UNPLANNED, WRAP_UP } from '../text/rules'
import { MAIN, flat, hasOpen, current } from '../draw/layout'
import { reminders, addWait, askingAnchors, change, dropWaits, lastBrief, openList, publishPanel, sendAnchor, stamp, usedAnchors, wake } from './panel'
import { endedNote, keepTime, recordStart, refreshStale, takenNote, watchSessions } from './sessions'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const launchesState = { plugin: 'task-tree', key: 'launches' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
const recapState = { plugin: 'task-tree', key: 'recap' } as const

// What the handlers share about one call: the loop that made it (`agent`), the event, when a
// message was sent (`sentAt`, before the call: a message delivered at once opens the session's turn
// before the call returns) and what came back (`r`).
type Call = { agent: string; e: any; sentAt?: number; r?: any }
type Notes = ($: any, c: Call, notes: string[]) => Promise<void>

// ---- before the call

// A launch records the task the launching loop is on, where the subagent's group goes.
async function launch($: any, c: Call) {
  if (c.e.tool !== 'Agent' && c.e.tool !== 'Task') return
  const { value = [] } = await $.state.get(groupsState)
  const { anchor } = current(value.find((g: Group) => g.agent === c.agent)?.tasks ?? [])
  const description = String(c.e.description ?? '')
  await update($, launchesState, cur => [...(cur ?? []), { parent: c.agent, anchor, description }].slice(-20))
}

// A question or a plan to approve: the panel says so while it is open (the dialog opens inside
// next(e)), and the answer comes back with a reminder to bring the panel up to date while the
// asking loop has open tasks. Takes the whole call: answers it, or `undefined` when the call is
// not one of these.
async function asked($: any, c: Call, next: any): Promise<any | undefined> {
  const { agent, e } = c
  const kind = e.tool === 'AskUserQuestion' ? 'question' : e.tool === 'ExitPlanMode' ? 'plan' : undefined
  if (!kind) return undefined
  // A question belongs to the task in progress it asks about: the main loop asking with none open
  // is refused (ExitPlanMode is let through: plan mode may hold the panel's tools).
  if (kind === 'question' && agent === MAIN) {
    const { value = [] } = await $.state.get(groupsState)
    if (!hasOpen(value.find((g: Group) => g.agent === MAIN)?.tasks ?? [])) {
      return { deny: ASK.refused }
    }
  }
  const key = e.tool_use_id
  await addWait($, { agent, kind, tool: e.tool, key, ...(await askAnchor($, agent)) })
  try {
    const r = await next(e)
    // Answered by a chat message instead of an option: that message is still to come.
    const inChat = /did not answer|sent a message instead/i.test(JSON.stringify(r.result ?? r))
    if (inChat && agent === MAIN) reminders.answeredInChat = true
    const { value = [] } = await $.state.get(groupsState)
    if (!hasOpen(value.find((g: Group) => g.agent === agent)?.tasks ?? [])) return r
    return { ...r, context: [...(r.context ?? []), inChat ? ASK.inChat : ASK.answered] }
  } finally {
    await dropWaits($, w => w.key !== key)
  }
}

// The desktop app's end-of-turn box with a question and buttons (wrap_up with `ask`): the call
// returns at once and the turn ends, but the person is still asked. The notice stays until the next
// prompt (prompt.submit drops it) or a wrap_up with no question. The recap is kept for the card.
async function wrapUpAsk($: any, c: Call) {
  if (String(c.e.tool) !== 'mcp__ccd_turn__wrap_up') return
  const input = (c.e.input ?? c.e) as { ask?: unknown; recap?: unknown }
  if (c.agent === MAIN && typeof input.recap === 'string' && input.recap.trim() !== '') await $.state.set(recapState, input.recap)
  const key = `${c.agent}:wrap_up:ask`
  await dropWaits($, w => w.key !== key)
  if (typeof input.ask === 'string' && input.ask.trim() !== '') {
    await addWait($, { agent: c.agent, kind: 'choice', tool: 'wrap_up', key, ...(await askAnchor($, c.agent)) })
  }
}

// The task a question is asked from: the asking loop's task in progress, kept on its wait so no
// message is anchored there while it waits (sendAnchor's `asking`).
async function askAnchor($: any, agent: string): Promise<{ anchor?: string }> {
  const { value = [] } = await $.state.get(groupsState)
  const { anchor } = current((value as Group[]).find(g => g.agent === agent)?.tasks ?? [])
  return anchor === undefined ? {} : { anchor }
}

// ---- after the call (the main loop's), each adding its notes to the result

// A message to another session that was only queued: its task stays in progress until the session
// takes it up (watchSends), and the panel says so.
const sentMessage: Notes = async ($, c, notes) => {
  const { e, r, sentAt } = c
  if (String(e.tool) !== 'SendMessage') return
  const out = JSON.stringify(r.result ?? r)
  const to = String(e.to ?? e.input?.to ?? '')
  // The task the message is sent from, once, before this send is recorded anywhere (a round, a send):
  // with several tasks in progress it is the first one with no message yet (sendAnchor), and the
  // records below must not move it to the next.
  const { value: groups0 = [] } = await $.state.get(groupsState)
  const { value: kids0 = [] } = await $.state.get(childrenState)
  const { value: sends0 = [] } = await $.state.get(sendsState)
  const { value: waits0 = [] } = await $.state.get(waitsState)
  const anchor = sendAnchor((groups0 as Group[]).find(g => g.agent === MAIN)?.tasks ?? [], usedAnchors(kids0 as Child[], sends0 as Send[]), askingAnchors(waits0 as Wait[]))
  // The session is used for the task in progress: the summary view draws it there.
  {
    // Each message opens a round of the session, drawn in a card of its own under the task it was
    // sent from once the session takes it up (see split). A session the host's list does not hold
    // yet (just opened, or listed late) gets its entry here, with the round, as recordStart does:
    // the round was lost, and the card of the turn the message opened had no task to go under.
    const round = sentAt === undefined ? [] : [{ at: sentAt, anchor }]
    if (to !== '') {
      await update($, childrenState, cur => {
        const list = cur ?? []
        const mine = (ch: { id: string; name: string }) => ch.id === to || (ch.name !== '' && ch.name === to)
        if (list.some(mine)) {
          return list.map(ch => (mine(ch) ? { ...ch, ...(anchor !== undefined ? { lastAnchor: anchor } : {}), rounds: [...(ch.rounds ?? []), ...round].slice(-20) } : ch))
        }
        if (!to.startsWith('local_')) return list
        return [...list, { id: to, name: '', title: 'Sessão…', running: true, archived: false, starting: true, anchor, ...(anchor !== undefined ? { lastAnchor: anchor } : {}), rounds: round }]
      })
    }
  }
  // Waiting for delivery: queued (or held) and not taken up yet. Only "its turn has started"
  // confirms; a queued result may still say when it "will be delivered".
  const waitsDelivery = /queued|held|pending/i.test(out) && !/turn has started/i.test(out)
  // Every send is kept until the other session is seen taking it up (its published `received` or a
  // turn of it after the send, see watchSends): its task shows ✉ meanwhile, also when the delivery
  // was at once (the person's words: "nao esta aparecendo as tarefas com o icone de mensagem, para
  // sinalizar que essa etapa esta em andamento"). A failed send keeps none.
  const failed = r.isError === true || /success[\\"]*:\s*false/.test(out)
  if (to !== '' && !failed) {
    const at = sentAt ?? (await stamp($))
    await update($, sendsState, cur => [
      ...(cur ?? []).filter(s => !(s.to === to && s.anchor === anchor)),
      { to, anchor, at, ...(waitsDelivery ? {} : { delivered: true }) },
    ])
    // The task it went from is a message task from now on (TaskNode.msg): kept on the task itself,
    // since the send is dropped once taken up, and published with the panel for the card upstream.
    if (anchor !== undefined) {
      const mark = (list: TaskNode[]): TaskNode[] =>
        list.map(t => (t.id === anchor ? (t.msg ? t : { ...t, msg: true }) : t.children.length > 0 ? { ...t, children: mark(t.children) } : t))
      await change($, all => all.map(g => (g.agent === MAIN ? { ...g, tasks: mark(g.tasks) } : g)))
    }
    await publishPanel($)
  }
  if (waitsDelivery && to !== '') {
    const all = flat((groups0 as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
    const t = all.find(t => t.id === anchor)
    notes.push(SEND.queued(to, t ? `"${t.id}" ${t.title}` : undefined))
  }
}

// The sessions' reminders: one whose turn ended, one that took up a queued message.
const sessionNotes: Notes = async ($, _c, notes) => {
  const ended = await endedNote($)
  if (ended) notes.push(ended)
  const taken = await takenNote($)
  if (taken) notes.push(taken)
}

// The end of a turn in the desktop app: what is still open is listed, so nothing finished is left
// open (a task done through a session, one overtaken by the next); a turn with no summary is said.
const wrapUpOpen: Notes = async ($, c, notes) => {
  if (String(c.e.tool) !== 'mcp__ccd_turn__wrap_up') return
  const { value = [] } = await $.state.get(groupsState)
  const tasks = value.find((g: Group) => g.agent === MAIN)?.tasks ?? []
  if ((await lastBrief($)) === undefined) notes.push(WRAP_UP.noBrief)
  if (hasOpen(tasks)) notes.push(WRAP_UP.open(openList(tasks)))
}

// In this order, after the call (the kit wants each one called by name, so no list is walked).

// The reminder to plan, in the result of the first call of the main loop with no open plan and of
// every 10th after it; a call of the panel's own tools, or a request that planned, starts the count over.
async function reminder($: any, c: Call, r: any) {
  if (String(c.e.tool).startsWith('mcp__task-tree__')) {
    reminders.unplanned = 0
    return r
  }
  const { value = [] } = await $.state.get(groupsState)
  if (reminders.planned || hasOpen(value.find((g: Group) => g.agent === MAIN)?.tasks ?? [])) {
    reminders.unplanned = 0
    return r
  }
  reminders.unplanned++
  if (reminders.unplanned % 10 !== 1) return r
  return { ...r, context: [...(r.context ?? []), UNPLANNED] }
}

// ---- the hook

import type { EngineInterface } from 'claude-code'

export async function toolCall($: EngineInterface, e: any, next: any) {
  const c: Call = { agent: e.agentId ?? MAIN, e }
  // A call of the main loop: its turn is running, what the last one left open is in progress again.
  if (c.agent === MAIN) await wake($)
  await launch($, c)
  const answered = await asked($, c, next)
  if (answered !== undefined) return answered
  await wrapUpAsk($, c)
  c.sentAt = String(e.tool) === 'SendMessage' ? await stamp($) : undefined
  try {
    c.r = await next(e)
  } finally {
    await dropWaits($, w => w.key !== `${c.agent}:${e.tool}`)
  }
  if (c.agent !== MAIN) return c.r
  // After a reload the clock is gone with the old module: the next call starts it again.
  await keepTime($)
  watchSessions($)
  await refreshStale($).catch(() => {})
  if (String(e.tool) === 'mcp__ccd_session__start_session') {
    const out = JSON.stringify(c.r.result ?? c.r)
    await recordStart($, out)
  }
  if (c.r.deny !== undefined) return c.r
  const notes: string[] = []
  await sentMessage($, c, notes)
  await sessionNotes($, c, notes)
  await wrapUpOpen($, c, notes)
  let r = c.r
  if (notes.length > 0) r = { ...r, context: [...(r.context ?? []), ...notes] }
  return reminder($, c, r)
}
