// A subagent's card (the person, 2026-11-09: "Quero uma nova funcionalidade, parecida com o card de
// sessão filha, mas par sub agentes"; "Cartão + grupo (Recomendado)"): its group exists from its
// launch (agent.spawn), not only from its first plan, and carries `sub`, what the card says (type,
// model and effort, output rate, the tool in use, its state). Its steps (turn.step), calls (tool.call)
// and end (turn.complete) keep it current; the panel is published with the groups, so a session's
// subagents show in its card in the session that opened it.

import { update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Child, Group, Send, Sub, Wait } from '../types'
import { MAIN, flat } from '../draw/layout'
import { edit, fillStarts, finish, settle } from '../state/tasks'
import { engineText } from '../io/host'
import { askingAnchors, change, sendAnchor, stamp, usedAnchors } from './panel'

// The state's keys this file reads or writes, as literals (see ../state/durability).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const launchesState = { plugin: 'task-tree', key: 'launches' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const

// Launched from the same task within BATCH ms, subagents are one batch: more than three of them (or
// a workflow's) share one card (see draw/layout).
const BATCH = 3000
// The tool in use changes many times a second: the card is written at most once every THROTTLE ms
// per subagent (the pane redraws on every write).
const THROTTLE = 1000

const wrote = new Map<string, number>()
const calls = new Map<string, number>()
type Sample = { at: number; tokens: number; ms: number }
const samples = new Map<string, Sample[]>()

function setSub($: any, agent: string, fn: (s: Sub) => Sub) {
  return change($, all => all.map(g => (g.agent === agent && g.sub ? { ...g, sub: fn(g.sub) } : g)))
}

// The task a subagent's card goes under: as a message's (sendAnchor, the person, 2026-11-09: "Vai à
// pendente (Recomendado)"): the one in progress; with several, the first of the latest batch with no
// message, session or subagent yet; with none, the pending one of the current request. The messages
// and sessions are the main loop's: a subagent's launch counts only its own subagents.
export async function launchAnchor($: any, groups: Group[], parent: string, names: string[]): Promise<string | undefined> {
  const tasks = groups.find(g => g.agent === parent)?.tasks ?? []
  const mine = groups.filter(g => (g.parent ?? MAIN) === parent)
  if (parent !== MAIN) return sendAnchor(tasks, usedAnchors([], [], mine), [], names)
  const { value: kids = [] } = await $.state.get(childrenState)
  const { value: sends = [] } = await $.state.get(sendsState)
  const { value: waits = [] } = await $.state.get(waitsState)
  return sendAnchor(tasks, usedAnchors(kids as Child[], sends as Send[], mine), askingAnchors(waits as Wait[]), names)
}

export async function agentSpawn($: EngineInterface, e: any, next: any) {
  const r = await next(e)
  const agent = r?.agentId
  if (typeof agent !== 'string' || agent === '' || e?.resume || e?.isTeammate) return r
  const now = (await stamp($)) ?? 0
  const parent = typeof e.parentAgentId === 'string' && e.parentAgentId !== '' ? e.parentAgentId : MAIN
  const description = String(e.description ?? '')
  const { value = [] } = await $.state.get(groupsState)
  const anchor = await launchAnchor($, value as Group[], parent, [description, String(e.subagentType ?? '')])
  // The Agent call's own record (tool.call) is claimed here: the group needs no other.
  await update($, launchesState, (cur: any) => {
    const list = cur ?? []
    const i = list.findIndex((l: any) => l.parent === parent && l.description === description)
    return i >= 0 ? list.filter((_: unknown, j: number) => j !== i) : list
  })
  const run = typeof e.workflow?.runId === 'string' && e.workflow.runId !== '' ? e.workflow.runId : undefined
  const mate = (value as Group[]).find(g => g.sub && g.parent === parent && g.anchor === anchor && !g.sub.run && now - g.sub.at <= BATCH)
  const sub: Sub = {
    at: now,
    state: e.background ? 'background' : 'running',
    calls: 0,
    batch: mate?.sub?.batch ?? now,
    ...(typeof r.model === 'string' && r.model !== '' ? { engine: engineText(r.model) } : {}),
    ...(run ? { run } : {}),
  }
  const label = `${String(e.subagentType ?? 'Subagente')}: ${description}`
  await change($, all =>
    all.some(g => g.agent === agent)
      ? all.map(g => (g.agent === agent ? { ...g, sub } : g))
      : [...all, { agent, label, parent, ...(anchor !== undefined ? { anchor } : {}), tasks: [], sub }],
  )
  return r
}

// A subagent's model call (`t0`, when it began, `r` what it gave): its model and effort, and its
// output rate (as the main loop's, see turn).
export async function subStep($: any, agent: string, e: any, r: any, t0: number | undefined) {
  const t1 = await stamp($)
  const tokens = r?.usage?.output_tokens
  let toks: number | undefined
  if (t0 !== undefined && t1 !== undefined && t1 > t0 && typeof tokens === 'number') {
    const list = [...(samples.get(agent) ?? []), { at: t1, tokens, ms: t1 - t0 }].slice(-10)
    samples.set(agent, list)
    const ms = list.reduce((a, s) => a + s.ms, 0)
    toks = ms > 0 ? Math.round((list.reduce((a, s) => a + s.tokens, 0) * 1000) / ms) : undefined
  }
  const engine = typeof e?.model === 'string' && e.model !== '' ? engineText(e.model, e.effort) : undefined
  const { value = [] } = await $.state.get(groupsState)
  const s = (value as Group[]).find(g => g.agent === agent)?.sub
  const changed = s !== undefined && ((engine !== undefined && s.engine !== engine) || (toks !== undefined && s.toks !== toks))
  // A new engine is written at once; a new rate at most once every THROTTLE ms.
  const due = s !== undefined && ((engine !== undefined && s.engine !== engine) || (t1 ?? 0) - (wrote.get(agent) ?? -Infinity) >= THROTTLE)
  if (changed && due) {
    wrote.set(agent, t1 ?? 0)
    await setSub($, agent, x => ({ ...x, ...(engine !== undefined ? { engine } : {}), ...(toks !== undefined ? { toks } : {}) }))
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
  await setSub($, agent, x => ({ ...x, tool, calls: n }))
}

// A subagent's turn ending is its end: done, failed, or interrupted (stopped).
export async function subEnd($: any, agent: string, e: any) {
  const now = (await stamp($)) ?? 0
  const state: Sub['state'] = e?.isAborted ? 'interrupted' : e?.reason === 'error' || e?.reason === 'refusal' ? 'failed' : 'done'
  wrote.delete(agent)
  samples.delete(agent)
  const n = calls.get(agent)
  calls.delete(agent)
  await setSub($, agent, x => {
    const { tool: _, ...rest } = x
    return { ...rest, state, end: now, ...(n !== undefined ? { calls: n } : {}) }
  })
  // One in the background ending after the turn: the task it came from may close now.
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
      const mine = subs.filter(g => (g.parent ?? MAIN) === owner.agent && g.anchor === leaf.id).map(g => g.sub!)
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
