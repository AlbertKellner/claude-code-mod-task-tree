// tool.call, the generic hook: one handler per responsibility, run in order (R17). Before the call:
// a launch (Agent) records the task the loop is on; a question or a plan to approve takes the whole
// call (the wait while it is open, the answer's reminder); a wrap_up keeps its recap and its
// question as a wait. After the call, for the main loop only: the clocks and the sessions' list come
// back, a start_session records its session, then each note handler adds, in order, what it has to say
// to the result (a message only queued, a session that ended its turn, a message taken up, what a
// wrap_up leaves open) and, last, the reminder to plan: the first call with no open plan, and every
// 10th after it (what prompt.submit misses: answers to questions, work Claude continues on its own).

import { update } from 'claude-code'

import type { Ask, AskItem, Child, Group, Send, TaskNode } from '../types'
import { ASK, SEND, UNPLANNED, WRAP_UP } from '../text/rules'
import { MAIN, flat, hasOpen, current, startedLast } from '../draw/layout'
import { reminders, addWait, change, askingAnchors, changeAsks, dropWaits, gist, lastBrief, openList, publishPanel, sendAnchor, stamp, usedAnchors, wake } from './panel'
import { endedNote, keepTime, recordStart, refreshStale, takenNote, watchSessions } from './sessions'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const launchesState = { plugin: 'task-tree', key: 'launches' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const asksState = { plugin: 'task-tree', key: 'asks' } as const
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
  await addWait($, { agent, kind, tool: e.tool, key })
  // The question is kept, drawn under the task in progress with its options as subtasks, and kept
  // after the answer: the option picked ✓, the others ✕ (the person's words: "envie o resumo da
  // pergunta como texto de tarefa, e abra as sub tarefas com as alternativas disponíveis").
  const input = (e.input ?? e) as { questions?: { question?: unknown; header?: unknown; options?: { label?: unknown }[]; multiSelect?: unknown }[] }
  const items: AskItem[] =
    kind === 'plan'
      ? [{ title: 'Aprovar o plano', options: ['Aprovar', 'Continuar planejando'] }]
      : (input.questions ?? []).map(q => ({
          title: gist(String(q.question ?? '')),
          whole: [q.header, q.question].filter(x => typeof x === 'string' && x !== '').join(': '),
          options: (q.options ?? []).map(o => String(o.label ?? '')).filter(x => x !== ''),
          ...(q.multiSelect === true ? { multi: true } : {}),
        }))
  const at = await stamp($)
  const anchor = await askAnchor($, agent)
  await changeAsks($, cur => [...cur, { key, wait: key, agent, tool: String(e.tool), at, anchor, items, state: 'open' }])
  let settled = false
  try {
    const r = await next(e)
    const text = resultText(r)
    // Answered by a chat message instead of an option: that message is still to come.
    const inChat = /did not answer|sent a message instead/i.test(text)
    if (inChat && agent === MAIN) reminders.answeredInChat = true
    await changeAsks($, cur => cur.map(a => (a.key !== key ? a : inChat ? { ...a, state: 'chat' } : { ...a, items: answer(a, text), state: 'answered' })))
    settled = true
    const { value = [] } = await $.state.get(groupsState)
    if (!hasOpen(value.find((g: Group) => g.agent === agent)?.tasks ?? [])) return r
    return { ...r, context: [...(r.context ?? []), inChat ? ASK.inChat : ASK.answered] }
  } finally {
    await dropWaits($, w => w.key !== key)
    if (!settled) await changeAsks($, cur => cur.map(a => (a.key === key && a.state === 'open' ? { ...a, state: 'dropped' } : a)))
  }
}

// Where a question is drawn: the task in progress of the loop that asks, else (a wrap_up at the end
// of a turn, nothing open) the task started last.
async function askAnchor($: any, agent: string): Promise<string | undefined> {
  const { value = [] } = await $.state.get(groupsState)
  const tasks = (value as Group[]).find(g => g.agent === agent)?.tasks ?? []
  return current(tasks).anchor ?? startedLast(tasks)?.id
}
// The text of a tool's result, whatever shape it came in.
function resultText(r: any): string {
  const v = r?.result ?? r
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : (x?.text ?? ''))).join('\n')
  if (v && typeof v.text === 'string') return v.text
  return JSON.stringify(v ?? '')
}
// The answers a result gives ("question"="answer", in order), each matched to its item's options: an
// option's label picks it (several, comma-separated, for a multiple choice); what matches none is the
// answer typed, in a few words. ExitPlanMode: approved or not.
export function answer(a: Ask, text: string): AskItem[] {
  if (a.tool === 'ExitPlanMode') {
    const ok = /approved/i.test(text) && !/not approved|rejected|doesn't want|does not want/i.test(text)
    return a.items.map(it => ({ ...it, chosen: [ok ? 'Aprovar' : 'Continuar planejando'] }))
  }
  const pairs = [...text.matchAll(/"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"/g)].map(m => ({ q: m[1], v: m[2] }))
  return a.items.map((it, i) => {
    const hit = pairs.find(p => it.whole !== undefined && it.whole.endsWith(p.q)) ?? pairs.find(p => gist(p.q) === it.title) ?? pairs[i]
    return hit ? pick(it, hit.v) : it
  })
}
// An item answered with `value`: the options it names (by their labels), else the text, shortened.
export function pick(it: AskItem, value: string): AskItem {
  const norm = (s: string) => s.trim().toLowerCase()
  const exact = it.options.filter(o => norm(o) === norm(value))
  if (exact.length > 0) return { ...it, chosen: exact }
  const byMsg = (it.messages ?? []).findIndex(m => norm(m) === norm(value))
  if (byMsg >= 0 && it.options[byMsg] !== undefined) return { ...it, chosen: [it.options[byMsg]] }
  if (it.multi) {
    const parts = value.split(/\s*,\s*/).filter(Boolean)
    const chosen = it.options.filter(o => parts.some(p => norm(p) === norm(o)))
    if (chosen.length > 0 && chosen.length === parts.length) return { ...it, chosen }
  }
  return { ...it, chosen: [], text: gist(value) }
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
  // An earlier question of the box left with no answer is over: this wrap_up replaces it.
  const asked = typeof input.ask === 'string' && input.ask.trim() !== ''
  await changeAsks($, cur => cur.map(a => (a.wait === key && a.state === 'open' ? { ...a, state: 'dropped' } : a)))
  if (asked) {
    await addWait($, { agent: c.agent, kind: 'choice', tool: 'wrap_up', key })
    // Kept as a question with the buttons as its options; the answer comes with the next prompt.
    const actions = Array.isArray((input as any).actions) ? ((input as any).actions as { label?: unknown; message?: unknown }[]) : []
    const options = actions.map(x => String(x.label ?? x.message ?? '')).filter(x => x !== '')
    const messages = actions.map(x => String(x.message ?? x.label ?? ''))
    const item: AskItem = { title: gist(String(input.ask)), whole: String(input.ask), options, messages }
    const anchor = await askAnchor($, c.agent)
    const at = await stamp($)
    await changeAsks($, cur => [...cur, { key: String(c.e.tool_use_id ?? `${key}:${at ?? 0}`), wait: key, agent: c.agent, tool: 'wrap_up', at, anchor, items: [item], state: 'open' }])
  }
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
  const { value: asks0 = [] } = await $.state.get(asksState)
  const anchor = sendAnchor((groups0 as Group[]).find(g => g.agent === MAIN)?.tasks ?? [], usedAnchors(kids0 as Child[], sends0 as Send[]), askingAnchors(asks0 as Ask[]))
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
