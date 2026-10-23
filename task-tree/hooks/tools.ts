// The panel's own tools, plan, done and start: their schemas and what each does to the caller's
// group (the edits are ../state/tasks, pure), with the warnings each answers.

import { update } from 'claude-code'

import type { Group, Send, TaskNode, Turn } from '../types'
import { DONE } from '../text/rules'
import { MAIN, flat, tasksOf, hasOpen, count, interrupt } from '../draw/layout'
import { plural } from '../draw/svg'
import { begin, build, duplicates, edit, fillStarts, finish, resolve, settle } from '../state/tasks'
import type { InNode } from '../state/tasks'
import { PANE, reminders, renameAnchors, change, ensureGroup, joinWork, lastBrief, stamp, startsWork, wake } from './panel'
import { keepTime } from './sessions'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).

import type { EngineInterface } from 'claude-code'
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const workState = { plugin: 'task-tree', key: 'work' } as const
const briefState = { plugin: 'task-tree', key: 'brief' } as const

export const node = {
  type: 'object',
  required: ['id', 'title'],
  properties: { id: { type: 'string' }, title: { type: 'string' } },
}
export const level = (inner?: object) => ({
  type: 'array',
  items: inner ? { ...node, properties: { ...node.properties, children: inner } } : node,
})

export async function planTool($: EngineInterface, e: any, next: any) {
  try {
    const agent = e.agentId ?? MAIN
    if (agent === MAIN) reminders.planned = true
    if (agent === MAIN) await wake($)
    const input = ((e as any).input ?? e) as { tasks?: InNode[]; request?: string }
    const fresh = build(input.tasks ?? [], 1, undefined, await stamp($))
    const request = typeof input.request === 'string' ? input.request.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
    const dup = duplicates(fresh)
    if (dup.length > 0) {
      return { result: `erro: ids repetidos no plano (${dup.join(', ')}); use ids únicos.`, isError: true }
    }
    await ensureGroup($, agent)
    // Keeps earlier level-1 tasks: an open one with an id the new plan reuses is replanned
    // (replaced in its place) when it is of the request open now; a closed one stays as history,
    // renamed if its id collides. An open one of an earlier request (the person sent another
    // message since) is not replanned: the new plan's task goes to the new request, and the old one,
    // abandoned, stays in its request interrupted and renamed (the person's panel: a new "1" took
    // the place of an open "1" under the request before, and the summary kept that request in sight).
    const ids = fresh.map(t => t.id)
    const tag = Math.random().toString(36).slice(2, 6)
    const rename = (t: TaskNode): TaskNode => ({ ...t, id: `${tag}:${t.id}`, children: t.children.map(rename) })
    const fresh0 = agent === MAIN && (await startsWork($))
    const { value: before = [] } = await $.state.get(groupsState)
    const beforeMain = (before as Group[]).find(g => g.agent === MAIN)
    // The request open now (the person's last message): the main group's last turn.
    const nowTurn = beforeMain?.turns?.[beforeMain.turns.length - 1]?.id
    const sameRequest = (t: TaskNode) => agent !== MAIN || nowTurn === undefined || t.turn === undefined || t.turn === nowTurn
    const replanned = (t: TaskNode) => t.status === 'open' && ids.includes(t.id) && sameRequest(t)
    const replannedIds = agent === MAIN ? (beforeMain?.tasks ?? []).filter(replanned).map(t => t.id) : ids
    // A replanned task starts over: the sends from it (or below it) go with it. A renamed one keeps
    // them, renamed with it (renameAnchors).
    if (agent === MAIN) await update($, sendsState, cur => (cur ?? []).filter(s => !replannedIds.includes(String(s.anchor ?? '').split('/')[0] as string)))
    const renamed = (beforeMain?.tasks ?? []).filter(t => ids.includes(t.id) && !replanned(t)).map(t => t.id)
    const now = await stamp($)
    const groups = await change($, all => {
      return all.map(g => {
        if (g.agent !== agent) return g
        // In plan order: a replanned task takes the place of the one it replaces; the new ones
        // go below the ones already there.
        const reused = (t: TaskNode) => replanned(t)
        // Abandoned by a new request: interrupted (what was left open), then renamed.
        const away = (t: TaskNode) => rename(t.status === 'open' ? interrupt(now)(t) : t)
        const inPlace = (list: TaskNode[]) => {
          const out = g.tasks.map(t => (reused(t) ? (list.find(f => f.id === t.id) as TaskNode) : ids.includes(t.id) ? away(t) : t))
          return [...out, ...list.filter(f => !g.tasks.some(t => reused(t) && t.id === f.id))]
        }
        if (agent !== MAIN) return { ...g, tasks: inPlace(fresh) }
        // The main group's level-1 tasks go to the turn open now (the person's last message),
        // which `request` names; a replanned one stays in the turn it was in.
        let turns: Turn[] = g.turns ?? []
        let cur = turns[turns.length - 1]
        if (request !== '') {
          if (cur === undefined) {
            cur = { id: 1, title: request }
            turns = [cur]
          } else {
            cur = { ...cur, title: request }
            turns = [...turns.slice(0, -1), cur]
          }
        }
        const was = (id: string) => g.tasks.find(t => replanned(t) && t.id === id)?.turn
        const placed = fresh.map(t => {
          const turn = was(t.id) ?? cur?.id
          return turn === undefined ? t : { ...t, turn }
        })
        return { ...g, turns, tasks: inPlace(placed) }
      })
    })
    if (agent === MAIN) {
      // The sessions' ties to a renamed task go with it (see renameAnchors).
      await renameAnchors($, renamed, tag)
      // A closed level-1 task of the current work renamed by this plan stays in it.
      const { value: cur = [] } = await $.state.get(workState)
      const kept = fresh0 ? [] : renamed.filter(id => (cur as string[]).includes(id)).map(id => `${tag}:${id}`)
      await joinWork($, [...ids, ...kept], fresh0)
    }
    void $.ui.open({ id: PANE, title: 'Tarefas' }).catch(() => {})
    // What this plan sent (every level) and what is open in the caller's own group: not the
    // whole panel, which holds the other loops' tasks too.
    const [gd, gn] = count(groups.find(g => g.agent === agent)?.tasks ?? [])
    const sent = plural(flat(fresh).length, 'tarefa', 'tarefas')
    return { result: `Plano exibido no painel: ${sent} neste plano (${plural(gn - gd, 'aberta', 'abertas')} no seu grupo).` }
  } catch (err) {
    return { result: 'erro: ' + String(err), isError: true }
  }
}

export async function doneTool($: EngineInterface, e: any, next: any) {
  try {
    const agent = e.agentId ?? MAIN
    if (agent === MAIN) reminders.planned = true
    if (agent === MAIN) await wake($)
    const input = ((e as any).input ?? e) as { ids?: string[]; summary?: unknown }
    if (agent === MAIN && typeof input.summary === 'string' && input.summary.trim() !== '') await $.state.set(briefState, input.summary)
    let notes: string[] = []
    let closed: string[] = []
    let unstarted: string[] = []
    const now = await stamp($)
    const groups = await change($, all => {
      notes = []
      closed = []
      unstarted = []
      const others = tasksOf(all.filter(g => g.agent !== agent))
      return all.map(g => {
        if (g.agent !== agent) return g
        let tasks = g.tasks
        for (const id of input.ids ?? []) {
          const { node: hit, error } = resolve(tasks, id)
          if (error) notes.push(error)
          else if (!hit) notes.push(resolve(others, id).node ? `"${id}" é de outro agente` : `"${id}" não existe`)
          else if (hit.status === 'interrupted') notes.push(`"${id}" foi interrompida`)
          else {
            unstarted.push(...flat([hit]).filter(t => t.status === 'open' && t.children.length === 0 && t.started === undefined).map(t => t.id))
            tasks = settle(edit(fillStarts(tasks, hit.id, now), hit.id, finish(now)), now)
            closed.push(...flat([hit]).filter(t => t.status === 'open').map(t => t.id))
          }
        }
        return { ...g, tasks }
      })
    })
    // Closing the task a message was sent from while it is still queued: allowed, with a warning.
    if (agent === MAIN) {
      const { value: sends = [] } = await $.state.get(sendsState)
      const main = flat(groups.find(g => g.agent === MAIN)?.tasks ?? [])
      for (const s of (sends as Send[]).filter(s => !s.taken && closed.includes(s.anchor ?? ''))) {
        const t = main.find(t => t.id === s.anchor)
        if (t && t.status === 'done') notes.push(DONE.queued(s.to, t.id))
      }
      // Closed, its send waits no more: no ✉ left behind on an id used again.
      if (closed.length > 0) await update($, sendsState, cur => (cur ?? []).filter(s => !closed.includes(s.anchor ?? '')))
      // The last step closed with no summary: the ↩ line would say only "resposta".
      if ((await lastBrief($)) === undefined && closed.length > 0 && !hasOpen(groups.find(g => g.agent === MAIN)?.tasks ?? []))
        notes.push(DONE.noSummary)
    }
    const [d, n] = count(groups.find(g => g.agent === agent)?.tasks ?? [])
    // Several steps never started and closed together: the panel showed the first one in progress
    // all along, then jumped to the last, the steps between at 0:00 (the person's words: "ficou
    // parada muito tempo na primeira tarefa, e derepente pulo para a ultima").
    if (unstarted.length >= 2) notes.push(DONE.unstarted(unstarted))
    return { result: `Concluídas: ${d}/${n} no seu grupo.` + (notes.length > 0 ? ` Avisos: ${notes.join('; ')}.` : '') }
  } catch (err) {
    return { result: 'erro: ' + String(err), isError: true }
  }
}

export async function startTool($: EngineInterface, e: any, next: any) {
  try {
    const agent = e.agentId ?? MAIN
    if (agent === MAIN) reminders.planned = true
    if (agent === MAIN) await wake($)
    const input = ((e as any).input ?? e) as { ids?: string[] }
    let notes: string[] = []
    let begun: string[] = []
    let roots: string[] = []
    const now = await stamp($)
    const fresh0 = agent === MAIN && (await startsWork($))
    await change($, all => {
      notes = []
      begun = []
      roots = []
      let seq = flat(tasksOf(all)).reduce((top, t) => Math.max(top, t.started ?? 0), 0) + 1
      const others = tasksOf(all.filter(g => g.agent !== agent))
      return all.map(g => {
        if (g.agent !== agent) return g
        let tasks = g.tasks
        for (const id of input.ids ?? []) {
          const { node: hit, error } = resolve(tasks, id)
          if (error) notes.push(error)
          else if (!hit) notes.push(resolve(others, id).node ? `"${id}" é de outro agente` : `"${id}" não existe`)
          else if (hit.status !== 'open' && hit.children.length > 0) {
            notes.push(`"${id}" já foi concluída e tem subtarefas: replaneje o nível 1 com plan`)
          } else {
            tasks = begin(tasks, hit.id, seq++, now)
            begun.push(hit.title)
            roots.push(hit.id.split('/')[0] as string)
          }
        }
        return { ...g, tasks }
      })
    })
    if (agent === MAIN) await joinWork($, roots, fresh0)
    await keepTime($)
    return {
      result:
        (begun.length > 0 ? `Em andamento: ${begun.join('; ')}.` : 'Nada marcado.') +
        (notes.length > 0 ? ` Avisos: ${notes.join('; ')}.` : ''),
    }
  } catch (err) {
    return { result: 'erro: ' + String(err), isError: true }
  }
}
