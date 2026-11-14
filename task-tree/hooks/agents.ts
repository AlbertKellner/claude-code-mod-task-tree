// A subagent's card (the person, 2026-11-09: "Quero uma nova funcionalidade, parecida com o card de
// sessão filha, mas par sub agentes"; "Cartão + grupo (Recomendado)"): its group exists from its
// launch (agent.spawn), not only from its first plan, and carries `sub`, what the card says (type,
// model and effort, output rate, the tool in use, its state). Its steps (turn.step), calls (tool.call)
// and end (turn.complete) keep it current; the panel is published with the groups, so a session's
// subagents show in its card in the session that opened it.

import { update } from 'claude-code'
import type { AgentInfo, EngineInterface } from 'claude-code'

import type { Child, Group, Send, Sub, TaskNode, Wait } from '../types'
import { MAIN, SUB_BATCH, flat, interrupt, subLive } from '../draw/layout'
import { edit, fillStarts, finish, settle } from '../state/tasks'
import { engineText } from '../io/host'
import { askingAnchors, change, dropWaits, publishPanel, sendAnchor, stamp, usedAnchors } from './panel'

// The state's keys this file reads or writes, as literals (see ../state/durability).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const launchesState = { plugin: 'task-tree', key: 'launches' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const

// The tool in use changes many times a second: the card is written at most once every THROTTLE ms
// per subagent (the pane redraws on every write).
const THROTTLE = 1000

const wrote = new Map<string, number>()
const calls = new Map<string, number>()

function setSub($: any, agent: string, fn: (s: Sub) => Sub) {
  return change($, all => all.map(g => (g.agent === agent && g.sub ? { ...g, sub: fn(g.sub) } : g)))
}

// The task a subagent's card goes under: as a message's (sendAnchor, the person, 2026-11-09: "Vai à
// pendente (Recomendado)"): the one in progress; with several, the first of the latest batch with no
// message, session or subagent yet; with none, the pending one of the current request. The messages
// and sessions are the main loop's: a subagent's launch counts only its own subagents.
type Uses = { kids: Child[]; sends: Send[]; waits: Wait[] }
const NO_USES: Uses = { kids: [], sends: [], waits: [] }
async function mainUses($: any): Promise<Uses> {
  const { value: kids = [] } = await $.state.get(childrenState)
  const { value: sends = [] } = await $.state.get(sendsState)
  const { value: waits = [] } = await $.state.get(waitsState)
  return { kids: kids as Child[], sends: sends as Send[], waits: waits as Wait[] }
}
function anchorIn(groups: Group[], parent: string, names: string[], uses: Uses): string | undefined {
  const tasks = groups.find(g => g.agent === parent)?.tasks ?? []
  const mine = groups.filter(g => (g.parent ?? MAIN) === parent)
  if (parent !== MAIN) return sendAnchor(tasks, usedAnchors([], [], mine), [], names)
  return sendAnchor(tasks, usedAnchors(uses.kids, uses.sends, mine), askingAnchors(uses.waits), names)
}
export async function launchAnchor($: any, groups: Group[], parent: string, names: string[]): Promise<string | undefined> {
  return anchorIn(groups, parent, names, parent === MAIN ? await mainUses($) : NO_USES)
}

// The launches of one message run together: each hook reads the panel before the others write
// (the audit, 2026-11-10: 4 launches in 45 ms, 4 batches and no group card; with two tasks in
// progress, all of them under the first). So the task and the batch are decided inside the groups'
// write (change, over the groups as they are, again on a conflict), against the launches already
// written: what launching them one after the other gives (subagentes.lancados-juntos-se-veem). The
// sessions, messages and questions that also decide the task are read before: launches do not write them.
export async function agentSpawn($: EngineInterface, e: any, next: any) {
  const r = await next(e)
  // A resume carries the message a subagent that ended first was left with: it is delivered.
  if (typeof e?.resume?.agentId === 'string' && e.resume.agentId !== '') await takeSubSend($, e.resume.agentId, String(e.prompt ?? ''), true).catch(() => {})
  const agent = r?.agentId
  if (typeof agent !== 'string' || agent === '' || e?.resume || e?.isTeammate) return r
  const now = (await stamp($)) ?? 0
  const parent = typeof e.parentAgentId === 'string' && e.parentAgentId !== '' ? e.parentAgentId : MAIN
  const description = String(e.description ?? '')
  const names = [description, String(e.subagentType ?? '')]
  const uses = parent === MAIN ? await mainUses($) : NO_USES
  // The Agent call's own record (tool.call) is claimed here: the group needs no other.
  await update($, launchesState, (cur: any) => {
    const list = cur ?? []
    const i = list.findIndex((l: any) => l.parent === parent && l.description === description)
    return i >= 0 ? list.filter((_: unknown, j: number) => j !== i) : list
  })
  const run = typeof e.workflow?.runId === 'string' && e.workflow.runId !== '' ? e.workflow.runId : undefined
  const label = `${String(e.subagentType ?? 'Subagente')}: ${description}`
  await change($, all => {
    const anchor = anchorIn(all, parent, names, uses)
    const mate = all.find(g => g.agent !== agent && g.sub && g.parent === parent && g.anchor === anchor && !g.sub.run && now - g.sub.at <= SUB_BATCH)
    const sub: Sub = {
      at: now,
      state: e.background ? 'background' : 'running',
      calls: 0,
      batch: mate?.sub?.batch ?? now,
      ...(typeof r.model === 'string' && r.model !== '' ? { engine: engineText(r.model) } : {}),
      ...(run ? { run } : {}),
    }
    return all.some(g => g.agent === agent)
      ? all.map(g => (g.agent === agent ? { ...g, sub } : g))
      : [...all, { agent, label, parent, ...(anchor !== undefined ? { anchor } : {}), tasks: [], sub }]
  })
  return r
}

// A subagent's model call: its model and effort, and the call's rate (`toks`, measured in turn.ts by
// speedOf, the same as the main loop's; undefined when the call was not valid).
export async function subStep($: any, agent: string, e: any, toks: number | undefined) {
  const t1 = await stamp($)
  const engine = typeof e?.model === 'string' && e.model !== '' ? engineText(e.model, e.effort) : undefined
  const { value = [] } = await $.state.get(groupsState)
  const s = (value as Group[]).find(g => g.agent === agent)?.sub
  const changed = s !== undefined && ((engine !== undefined && s.engine !== engine) || (toks !== undefined && s.toks !== toks))
  // A new engine is written at once; a new rate at most once every THROTTLE ms.
  const due = s !== undefined && ((engine !== undefined && s.engine !== engine) || (t1 ?? 0) - (wrote.get(agent) ?? -Infinity) >= THROTTLE)
  if (changed && due) {
    wrote.set(agent, t1 ?? 0)
    await setSub($, agent, x => ({ ...x, ...(engine !== undefined ? { engine } : {}), ...(toks !== undefined ? { toks } : {}), ...(t1 !== undefined ? { seen: t1 } : {}) }))
  }
}

// The tool a subagent calls: what the card's line says, with how many calls it made.
export function toolText(e: any): string {
  const tool = String(e?.tool ?? '')
  const arg =
    typeof e?.file_path === 'string'
      ? e.file_path.split(/[\\/]/).pop()
      : typeof e?.pattern === 'string'
        ? `"${e.pattern}"`
        : typeof e?.description === 'string'
          ? e.description
          : typeof e?.command === 'string'
            ? e.command
            : ''
  const text = arg ? `${tool} ${arg}` : tool
  return text.length > 60 ? `${text.slice(0, 59)}…` : text
}
export async function subTool($: any, agent: string, e: any) {
  // The panel's own tools and the hand-back (the subagent's report, after its work) are not its work.
  if (String(e?.tool ?? '').startsWith('mcp__task-tree__') || e?.tool === 'SubagentHandback') return
  const n = (calls.get(agent) ?? 0) + 1
  calls.set(agent, n)
  const now = (await stamp($)) ?? 0
  const { value = [] } = await $.state.get(groupsState)
  const s = (value as Group[]).find(g => g.agent === agent)?.sub
  if (!s || (s.state !== 'running' && s.state !== 'background')) return
  const tool = toolText(e)
  // The first call, a new tool, or a second gone by: written; else only counted, written later.
  if (s.tool === tool && now - (wrote.get(agent) ?? -Infinity) < THROTTLE) return
  wrote.set(agent, now)
  await setSub($, agent, x => ({ ...x, tool, calls: n, seen: now }))
}

// A subagent's turn ending is its end: done, failed, or interrupted (stopped).
export async function subEnd($: any, agent: string, e: any) {
  const now = (await stamp($)) ?? 0
  const state: Sub['state'] = e?.isAborted ? 'interrupted' : e?.reason === 'error' || e?.reason === 'refusal' ? 'failed' : 'done'
  wrote.delete(agent)
  const n = calls.get(agent)
  calls.delete(agent)
  await setSub($, agent, x => {
    const { tool: _, ...rest } = x
    return { ...rest, state, end: now, ...(n !== undefined ? { calls: n } : {}) }
  })
  // One in the background ending after the turn: the task it came from may close now.
  if (typeof (await $.state.get(turnEndedState)).value === 'number') await settleBySubs($)
}

// A card still alive whose subagent is gone (the person, 2026-11-12: "Sim, entra nesta rodada
// (Recomendado)", for "O cartão vivo é conferido contra a lista de agentes do app. Os agentes de
// workflow, que não aparecem nessa lista, usam outro critério. O órfão vira "interrompido" com o tempo
// parado, e a tarefa de origem pode fechar."). The end of a subagent is its turn.complete, and it
// may never come: the process restarted (the app, /model, a resume: the panel comes back from the
// store with the card as it was), the task was stopped, or the end's own hook failed. The card then
// said "trabalhando" or "em segundo plano" for good, its time growing, the pill counting it and the
// task it came from never closing by itself.
// So the cards alive are checked against the engine's list ($.agent.list), by the poll (sessions'
// refreshChildren, every POLL): the agent not listed, the card ends "interrompido"; listed as ended,
// with the end the list says (`completed` done, `failed` failed, `killed` interrupted). Its time
// stops where the card last heard from it (`seen`, else its launch), what it left open is
// interrupted as at any end, and with the turn over the task it came from reflects it (settleBySubs).
// A card truly alive is never ended: only one whose agent was seen gone twice, SUB_CONFIRM ms apart
// or more (one just launched and not listed yet, a list read at the wrong moment), and never when
// the list fails, has no `status` (an earlier engine: unknown, so alive) or says anything else
// (pending, running, waiting, idle). After a respawn of the hooks worker the subagents go on in the
// engine, listed as running: their cards stay. A late turn.complete still writes the true end over
// this one (subEnd).
// A workflow's agents are not in the list, nor may be what one of them launched (the list may file
// it under the run too): theirs is the time with no word (the person, 2026-11-12: "30 minutos sem sinal
// (Recomendado)"). With no call nor step for SUB_IDLE ms, of its own or of anything alive it launched,
// the card ends "interrompido", its time stopped at its last word. A call that takes longer than
// that is read as gone; its real end, when it comes, is written over (subEnd).
const ENDED: Record<string, Sub['state']> = { completed: 'done', failed: 'failed', killed: 'interrupted' }
export const SUB_CONFIRM = 3000
export const SUB_IDLE = 30 * 60_000
// When each card's agent was first seen gone, by this module (a reload starts over: one check more).
const gone = new Map<string, number>()
export async function checkSubs($: any) {
  const { value = [] } = await $.state.get(groupsState)
  const byAgent = new Map((value as Group[]).map(g => [g.agent, g] as const))
  const ofRun = (g: Group | undefined, seen: string[] = []): boolean =>
    g !== undefined && !seen.includes(g.agent) && (g.sub?.run !== undefined || ofRun(byAgent.get(g.parent ?? MAIN), [...seen, g.agent]))
  const alive = (value as Group[]).filter(g => g.agent !== MAIN && subLive(g.sub))
  const live = alive.filter(g => !ofRun(g))
  for (const id of [...gone.keys()]) if (!live.some(g => g.agent === id)) gone.delete(id)
  if (alive.length === 0) return
  const now = await stamp($)
  if (now === undefined) return
  const ends = new Map<string, Sub['state']>()
  // A workflow's: when it, or anything alive it launched, was last heard.
  const heard = (g: Group, seen: string[] = []): number =>
    Math.max(g.sub?.seen ?? g.sub?.at ?? -Infinity, ...alive.filter(k => (k.parent ?? MAIN) === g.agent && !seen.includes(k.agent)).map(k => heard(k, [...seen, g.agent])))
  for (const g of alive) if (ofRun(g) && now - heard(g) >= SUB_IDLE) ends.set(g.agent, 'interrupted')
  let list: AgentInfo[] = []
  let listed = false
  if (live.length > 0) {
    try {
      const got = await $.agent.list()
      if (Array.isArray(got)) {
        list = got
        listed = true
      }
    } catch {}
  }
  for (const g of listed ? live : []) {
    const info = list.find(a => a?.id === g.agent)
    const state = info === undefined ? 'interrupted' : ENDED[String(info.status)]
    if (state === undefined) {
      gone.delete(g.agent)
      continue
    }
    const since = gone.get(g.agent)
    if (since === undefined) gone.set(g.agent, now)
    else if (now - since >= SUB_CONFIRM) ends.set(g.agent, state)
  }
  if (ends.size === 0) return
  await change($, all =>
    all.map(g => {
      const state = ends.get(g.agent)
      // Its own end may have come meanwhile (subEnd): that one stays.
      if (state === undefined || !g.sub || !subLive(g.sub)) return g
      const end = Math.max(g.sub.at, g.sub.seen ?? g.sub.at)
      const { tool: _, ...rest } = g.sub
      const n = calls.get(g.agent)
      return { ...g, sub: { ...rest, state, end, ...(n !== undefined ? { calls: n } : {}) }, tasks: g.tasks.map(interrupt(end)) }
    }),
  )
  for (const id of ends.keys()) {
    gone.delete(id)
    wrote.delete(id)
    calls.delete(id)
  }
  await dropWaits($, w => !ends.has(w.agent))
  if (typeof (await $.state.get(turnEndedState)).value === 'number') await settleBySubs($)
}

// The task a subagent was launched from reflects how it ended (the person, 2026-11-09: "falta só
// corrigir as tarefas pai, quando um agente é concluido com sucesso, o pai sempre deve refletir seu
// status, não ficar pendente se não tiver nada em execucao"; "Fecha de fato (Recomendado)"; "Fecha
// também"; "interrompido se é interrompido, falha se ele falhou"). Once the main loop's turn is over:
// a leaf still open (started or not) whose work was subagents, all ended, with nothing else going on
// under it (no session alive, no message queued, no question open), closes: done when they all
// were, else interrupted, "falhou" when one failed (the worse end decides, failed over interrupted
// over done). Its parents close by the usual rule; the subagents' cards stay out of the count.
// A subagent is the leaf's only while it is of this leaf (`ofLeaf`): not launched before the leaf
// was planned (an earlier task's with the same id, in a state written before the anchor was renamed
// with it), and, once a start reopened the leaf after a close, still running or ended since: one
// that ended before was reflected in that close.
const ofLeaf = (s: Sub, leaf: TaskNode) =>
  !(leaf.plannedAt !== undefined && s.at < leaf.plannedAt) &&
  (leaf.reopenedAt === undefined || s.end === undefined || s.end >= leaf.reopenedAt)
export async function settleBySubs($: any) {
  const { value: groups = [] } = await $.state.get(groupsState)
  const { value: kids = [] } = await $.state.get(childrenState)
  const { value: sends = [] } = await $.state.get(sendsState)
  const { value: waits = [] } = await $.state.get(waitsState)
  const subs = (groups as Group[]).filter(g => g.sub && g.anchor !== undefined)
  if (subs.length === 0) return
  const busy = (owner: string, id: string) =>
    (waits as Wait[]).some(w => w.anchor === id) ||
    (owner === MAIN &&
      ((kids as Child[]).some(c => c.anchor === id && !c.archived && (c.running || c.starting === true)) ||
        (sends as Send[]).some(s => s.anchor === id && !s.taken && !(s as any).cut)))
  const ends = new Map<string, { state: 'done' | 'failed' | 'interrupted'; end: number; at: number }>()
  for (const owner of groups as Group[]) {
    for (const leaf of flat(owner.tasks)) {
      if (leaf.status !== 'open' || leaf.children.length > 0) continue
      const mine = subs.filter(g => (g.parent ?? MAIN) === owner.agent && g.anchor === leaf.id).map(g => g.sub!).filter(s => ofLeaf(s, leaf))
      if (mine.length === 0 || mine.some(s => s.state === 'running' || s.state === 'background') || busy(owner.agent, leaf.id)) continue
      const state = mine.some(s => s.state === 'failed') ? 'failed' : mine.some(s => s.state === 'interrupted') ? 'interrupted' : 'done'
      ends.set(`${owner.agent}|${leaf.id}`, { state, end: Math.max(...mine.map(s => s.end ?? s.at)), at: Math.min(...mine.map(s => s.at)) })
    }
  }
  if (ends.size === 0) return
  await change($, all =>
    all.map(g => {
      let tasks = g.tasks
      for (const [key, x] of ends) {
        const [owner, id] = key.split('|') as [string, string]
        if (owner !== g.agent) continue
        if (x.state === 'done') {
          tasks = settle(edit(fillStarts(tasks, id, x.end), id, finish(x.end)), x.end)
        } else {
          tasks = settle(
            edit(tasks, id, t => ({ ...t, status: 'interrupted', started: undefined, startedAt: t.startedAt ?? x.at, endedAt: x.end, ...(x.state === 'failed' ? { failed: true } : {}) })),
            x.end,
          )
        }
      }
      return tasks === g.tasks ? g : { ...g, tasks }
    }),
  )
}

// A message the main loop queued to one of its subagents (SendMessage, Send.agent) is delivered when
// that subagent receives it in its next round of tools (session.receive, agentReceive) or is resumed
// with it after ending first (agent.spawn with `resume`, agentSpawn): its letter turns green (the
// rule envios.fica-ate-entrega; the delivery to a subagent was never checked, and its letter stayed
// blue even when received). Of the sends to it not taken yet (queued, or given up as not delivered),
// the first whose text is in what it received; with none and `inOrder` (the main loop's own message,
// a resume), the oldest. The task it was sent from closes, as at any delivery (watchSends), when it is
// open, with nothing open under it and no subagent launched from it still running: then that
// subagent's end closes it (subagentes.um-rodando-mantem-o-pai).
const norm = (t: string) => t.replace(/\s+/g, ' ').trim()
export async function takeSubSend($: any, agent: string, text: string, inOrder: boolean) {
  const { value: sends = [] } = await $.state.get(sendsState)
  const got = norm(text)
  const open = (sends as Send[]).map((s, i) => ({ s, i })).filter(x => x.s.agent === agent && !x.s.taken)
  if (open.length === 0) return
  const byText = open.find(x => (x.s.text ?? '') !== '' && got.includes(norm(x.s.text ?? '')))
  const hit = byText ?? (inOrder ? [...open].sort((a, b) => (a.s.at ?? 0) - (b.s.at ?? 0))[0] : undefined)
  if (hit === undefined) return
  await update($, sendsState, (cur: any) =>
    (cur ?? []).map((s: Send, i: number) => (i === hit.i && s.agent === agent ? { ...s, taken: true, cut: false, lost: false, noted: false } : s)),
  )
  const id = hit.s.anchor
  if (id !== undefined) {
    const now = await stamp($)
    await change($, all => {
      const live = all.some(g => g.sub && subLive(g.sub) && (g.parent ?? MAIN) === MAIN && g.anchor === id)
      return all.map(g => {
        if (g.agent !== MAIN || live) return g
        const t = flat(g.tasks).find(t => t.id === id)
        if (!t || t.status !== 'open' || t.children.some(c => c.status === 'open')) return g
        return { ...g, tasks: settle(edit(fillStarts(g.tasks, id, now), id, finish(now)), now) }
      })
    })
  }
  await publishPanel($)
}

// A delivery to one of this session's subagents (session.receive with its agentId): the main loop's
// message it receives in its next round of tools. Only after it is queued; one consumed by another
// hook was not delivered. It runs inside the subagent's turn: nothing here waits on a prompt.
export async function agentReceive($: EngineInterface, e: any, next: any) {
  const r = await next(e)
  if (r?.consumed !== undefined || typeof e?.agentId !== 'string' || e.agentId === '') return r
  await takeSubSend($, e.agentId, String(e.text ?? ''), e.origin?.kind === 'coordinator').catch(() => {})
  return r
}

// A message queued to a subagent that ended without receiving it is not delivered (the person,
// 2026-11-13: "Cinza \"não entregue\" (Recomendado)", as for a session archived with it): its letter
// gray, "não entregue", its clock stopped, and its task stops waiting on it. Read by the poll, after
// checkSubs: only SUB_CONFIRM ms after the card ended, and with the engine's list not showing the agent
// at work, because at a normal end the engine resumes it with the message (agentSpawn delivers it
// then), and a mark at once would paint the letter gray and then green. Received after all: green.
// A subagent with no card is not judged; a list that fails judges nothing.
const AT_WORK = ['running', 'pending', 'waiting', 'idle']
export async function strandedSends($: any) {
  const { value: sends = [] } = await $.state.get(sendsState)
  const open = (sends as Send[]).filter(s => s.agent !== undefined && !s.taken && !s.lost)
  if (open.length === 0) return
  const now = await stamp($)
  if (now === undefined) return
  const { value: groups = [] } = await $.state.get(groupsState)
  const ended = (agent: string) => {
    const sub = (groups as Group[]).find(g => g.agent === agent)?.sub
    return sub !== undefined && !subLive(sub) && now - (sub.end ?? sub.seen ?? sub.at) >= SUB_CONFIRM
  }
  const due = open.filter(s => ended(s.agent!))
  if (due.length === 0) return
  let list: AgentInfo[]
  try {
    const got = await $.agent.list()
    if (!Array.isArray(got)) return
    list = got
  } catch {
    return
  }
  const lost = new Set(due.map(s => s.agent!).filter(a => !list.some(x => x?.id === a && AT_WORK.includes(String(x.status)))))
  if (lost.size === 0) return
  await update($, sendsState, (cur: any) =>
    (cur ?? []).map((s: Send) => (s.agent !== undefined && lost.has(s.agent) && !s.taken && !s.lost ? { ...s, cut: true, lost: true } : s)),
  )
  if (typeof (await $.state.get(turnEndedState)).value === 'number') await settleBySubs($)
  await publishPanel($)
}
