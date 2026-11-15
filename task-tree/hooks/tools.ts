// The panel's own tools, plan, done and start: their schemas and what each does to the caller's
// group (the edits are ../state/tasks, pure), with the warnings each answers.

import { update } from 'claude-code'

import type { Child, Group, Send, TaskNode, Turn, Wait } from '../types'
import { DONE, PLAN, START } from '../text/rules'
import { MAIN, flat, firstOpen, tasksOf, hasOpen, count, interrupt, idleOf } from '../draw/layout'
import { plural } from '../draw/svg'
import { begin, build, carry, duplicates, edit, fillStarts, finish, resolve, settle } from '../state/tasks'
import type { InNode } from '../state/tasks'
import { reminders, movedAnchor, moveToLevelOne, renameAnchors, renameFolds, renamedAnchor, change, ensureGroup, joinWork, lastBrief, stamp, startsWork, wake, askingAnchors, openTurnOf, saveLinks, sendAnchor, usedAnchors } from './panel'
import { keepTime, settledBy } from './sessions'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).

import type { EngineInterface } from 'claude-code'
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const briefState = { plugin: 'task-tree', key: 'brief' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const

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
      return { result: `erro: ids repetidos no plano (${dup.join(', ')}); use ids únicos.`, isError: true as const }
    }
    await ensureGroup($, agent)
    // Keeps earlier level-1 tasks: an open one with an id the new plan reuses is replanned
    // (replaced in its place, the tasks that keep their id keeping their state: carry) when it is of
    // the request open now, and so is a done one of the main loop; otherwise a closed one stays as history,
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
    // A level-1 task of the main loop already done is replanned too, in the same request: it opens
    // again with the done steps kept (carry) and only the new ones open (the person, 2026-11-14:
    // "Reabre mantendo os ✓ (Recomendado)"). A subagent's done task stays as history.
    const replanned = (t: TaskNode) =>
      (t.status === 'open' || (t.status === 'done' && agent === MAIN)) && ids.includes(t.id) && sameRequest(t)
    // The sends still queued: a message task a replan leaves out stays until delivered (carry).
    const { value: sendsNow = [] } = await $.state.get(sendsState)
    const queued = (sendsNow as Send[]).filter(s => !s.taken).map(s => String(s.anchor ?? ''))
    const renamed = (beforeMain?.tasks ?? []).filter(t => ids.includes(t.id) && !replanned(t)).map(t => t.id)
    // The subtasks a replan in place leaves out, each with its level-1 task: the ties to them go to it
    // (moveToLevelOne; the person, 2026-11-14: "Sob o nível 1 (Recomendado)").
    const kept = new Set(flat(fresh).map(t => t.id))
    const gone = new Map<string, string>()
    for (const t of (before as Group[]).find(g => g.agent === agent)?.tasks ?? []) {
      if (!replanned(t)) continue
      for (const x of flat(t.children)) if (!kept.has(x.id)) gone.set(x.id, t.id)
    }
    const toLevelOne = movedAnchor(gone)
    // What the plan does to the level-1 tasks that already had an id it reuses, said in its result
    // (the tasks renamed to history, and the replans in place, counted below on the result).
    const ownBefore = (before as Group[]).find(g => g.agent === agent)?.tasks ?? []
    const warned = ownBefore.filter(t => ids.includes(t.id))
    // The person's folds go with the tasks renamed in the planning loop's group (renameFolds).
    const renamedHere = ((before as Group[]).find(g => g.agent === agent)?.tasks ?? []).filter(t => ids.includes(t.id) && !replanned(t)).map(t => t.id)
    const now = await stamp($)
    const groups = await change($, all => {
      // The subagents this loop launched from a task the plan renames go with the old copy (their
      // card, and the task the end of the turn closes by them), or they would hang from the new task
      // with that id: the ids as `away` below takes them, from the groups this change gets.
      const own = all.find(g => g.agent === agent)?.tasks ?? []
      const renameTie = renamedAnchor(own.filter(t => ids.includes(t.id) && !replanned(t)).map(t => t.id), tag)
      // And those launched from a subtask the replan leaves out go to its level-1 task.
      const fix = (a?: string) => toLevelOne(renameTie(a))
      return all.map(g => {
        if (g.agent !== agent) return (g.parent ?? MAIN) === agent && fix(g.anchor) !== g.anchor ? { ...g, anchor: fix(g.anchor) } : g
        // In plan order: a replanned task takes the place of the one it replaces; the new ones
        // go below the ones already there.
        const reused = (t: TaskNode) => replanned(t)
        // Abandoned by a new request: interrupted (what was left open), then renamed.
        const away = (t: TaskNode) => rename(t.status === 'open' ? interrupt(now)(t) : t)
        const inPlace = (list: TaskNode[]) => {
          const out = g.tasks.map(t => (reused(t) ? carry(t, list.find(f => f.id === t.id) as TaskNode, queued, now) : ids.includes(t.id) ? away(t) : t))
          return [...out, ...list.filter(f => !g.tasks.some(t => reused(t) && t.id === f.id))]
        }
        if (agent !== MAIN) return { ...g, tasks: inPlace(fresh) }
        // The main group's level-1 tasks go to the turn open now (the person's last message),
        // which `request` names; a replanned one stays in the turn it was in.
        let turns: Turn[] = g.turns ?? []
        let cur = turns[turns.length - 1]
        // Only the request's first plan with a `request` names it (`named`); a later one, a replan or
        // a plan after a notice, leaves the title (the person, 2026-11-14: "Não, vale o 1º (Recomendado)").
        if (request !== '') {
          if (cur === undefined) {
            cur = { id: 1, title: request, named: true }
            turns = [cur]
          } else if (cur.named !== true) {
            cur = { ...cur, title: request, named: true }
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
    await renameFolds($, agent, renamedHere, tag)
    if (agent === MAIN) {
      // The sessions' ties to a renamed task go with it (see renameAnchors).
      await renameAnchors($, renamed, tag)
      await moveToLevelOne($, gone)
      // The sends from tasks the replan left out go once delivered; a queued one is kept, its letter
      // hanging from the request's level-1 task until the delivery (the panel's letters).
      const there = new Set(flat(groups.find(g => g.agent === MAIN)?.tasks ?? []).map(t => t.id))
      await update($, sendsState, cur => (cur ?? []).filter(s => s.anchor === undefined || there.has(s.anchor) || !s.taken))
      // The work follows the tasks this plan renamed to their old copies (joinWork): a closed level-1
      // task of the current work stays in it, and in new work the old copy is checked with the rest
      // of the work before for what still holds the view.
      // Adopted first: a subagent that ended with no task before the plan is not one to drop (joinWork).
      await adoptOrphans($, groups)
      await joinWork($, ids, fresh0, id => (renamed.includes(id) ? `${tag}:${id}` : id))
    }
    // The plan does not open the panel: one the person closed stays closed until their next message
    // (the person, 2026-11-14: "Só na sua mensagem (Recomendado)").
    // What this plan sent (every level) and what is open in the caller's own group: not the
    // whole panel, which holds the other loops' tasks too.
    const ownAfter = groups.find(g => g.agent === agent)?.tasks ?? []
    const [gd, gn] = count(ownAfter)
    const sent = plural(flat(fresh).length, 'tarefa', 'tarefas')
    const notes = warned.flatMap(t => {
      if (replanned(t)) {
        const old = new Set(flat(t.children).map(x => x.id))
        const kept = flat(ownAfter.find(x => x.id === t.id)?.children ?? []).filter(x => old.has(x.id))
        const doneN = kept.filter(x => x.status === 'done').length
        const going = kept.filter(x => x.status === 'open' && x.children.length === 0 && (x.started !== undefined || x.startedAt !== undefined) && x.stopped !== true).length
        return doneN + going > 0 ? [PLAN.carried(t.id, doneN, going)] : []
      }
      if (t.status === 'open') return [PLAN.earlier(t.id, flat([t]).filter(x => x.status === 'open' && x.children.length === 0).length)]
      return [PLAN.closed(t.id)]
    })
    return { result: `Plano exibido no painel: ${sent} neste plano (${plural(gn - gd, 'aberta', 'abertas')} no seu grupo).` + (notes.length > 0 ? ` Avisos: ${notes.join('; ')}.` : '') }
  } catch (err) {
    return { result: 'erro: ' + String(err), isError: true as const }
  }
}

// The request's first plan adopts what the main loop sent, opened or launched in it before, with no
// task (sendAnchor gives none before the plan): the messages, the sessions opened (and their rounds
// with no task) and its subagents, in the order they were made, each to the task sendAnchor gives now
// (the session's name against the titles, its title and the subagent's description and type only as
// whole phrases, namedFor; else the first pending one), the ones
// adopted before counting as uses of their task. The person, 2026-11-14: "Sim, o plan adota
// (Recomendado)". Only a place: an adopted message's delivery closes no task (Send.adopted), and a
// subagent launched before its task was planned does not close it (ofLeaf, hooks/agents).
async function adoptOrphans($: any, groups: Group[]) {
  const turn = openTurnOf(groups)
  const since = turn?.at
  const main = groups.find(g => g.agent === MAIN)
  if (turn === undefined || typeof since !== 'number' || main === undefined || !main.tasks.some(t => t.turn === turn.id)) return
  const { value: sends0 = [] } = await $.state.get(sendsState)
  const { value: kids0 = [] } = await $.state.get(childrenState)
  const { value: waits0 = [] } = await $.state.get(waitsState)
  const sends = sends0 as Send[]
  const kids = kids0 as Child[]
  const named = (list: string[]) => list.filter(n => n !== '' && !/^local_/.test(n) && !n.endsWith('…'))
  type Orphan = { at: number; kind: 'send' | 'open' | 'group'; key: string; names: string[]; phrases: string[] }
  const sendKey = (x: Send) => `${x.to}|${x.at}`
  const orphans: Orphan[] = [
    ...sends.flatMap(x =>
      x.anchor === undefined && typeof x.at === 'number' && x.at >= since
        ? [{ at: x.at, kind: 'send' as const, key: sendKey(x), names: named([x.to, ...kids.filter(k => k.id === x.to).map(k => k.name)]), phrases: [] }]
        : [],
    ),
    ...kids.flatMap(c => (c.anchor === undefined && typeof c.openedAt === 'number' && c.openedAt >= since ? [{ at: c.openedAt, kind: 'open' as const, key: c.id, names: named([c.name]), phrases: named([c.title]) }] : [])),
    ...groups.flatMap(g =>
      g.agent !== MAIN && (g.parent ?? MAIN) === MAIN && g.sub && g.anchor === undefined && g.sub.at >= since
        ? [{ at: g.sub.at, kind: 'group' as const, key: g.agent, names: [], phrases: named(g.label.split(': ')) }]
        : [],
    ),
  ].sort((a, b) => a.at - b.at)
  if (orphans.length === 0) return
  const used = usedAnchors(kids, sends, groups.filter(g => (g.parent ?? MAIN) === MAIN))
  const asking = askingAnchors(waits0 as Wait[])
  const got = new Map<string, string>()
  for (const o of orphans) {
    const anchor = sendAnchor(main.tasks, used, asking, o.names, turn.id, o.phrases)
    if (anchor === undefined) continue
    used.push({ anchor, at: o.at })
    got.set(`${o.kind}:${o.key}`, anchor)
  }
  if (got.size === 0) return
  const ofSend = (x: Send) => (x.anchor === undefined ? got.get(`send:${sendKey(x)}`) : undefined)
  await update($, sendsState, cur => (cur ?? []).map(x => (ofSend(x) !== undefined ? { ...x, anchor: ofSend(x), adopted: true } : x)))
  // A session's round with no task goes with the message that opened it (same session, same time),
  // else with the task the session was adopted by.
  await update($, childrenState, cur =>
    (cur ?? []).map(c => {
      const opened = c.anchor === undefined ? got.get(`open:${c.id}`) : undefined
      const roundOf = (r: { at: number; anchor?: string }) => {
        if (r.anchor !== undefined || r.at < since) return r.anchor
        const x = sends.find(x => (x.to === c.id || (c.name !== '' && x.to === c.name)) && x.at === r.at)
        return (x && ofSend(x)) ?? opened
      }
      const rounds = c.rounds?.map(r => {
        const anchor = roundOf(r)
        return anchor === r.anchor ? r : { ...r, anchor }
      })
      const moved = opened !== undefined || (rounds ?? []).some((r, i) => r !== c.rounds?.[i])
      if (!moved) return c
      const last = [...(rounds ?? [])].reverse().find(r => r.anchor !== undefined)?.anchor
      return { ...c, ...(opened !== undefined ? { anchor: opened } : {}), ...(rounds ? { rounds } : {}), ...(c.lastAnchor === undefined && (last ?? opened) !== undefined ? { lastAnchor: last ?? opened } : {}) }
    }),
  )
  await change($, all => all.map(g => (g.anchor === undefined && got.has(`group:${g.agent}`) ? { ...g, anchor: got.get(`group:${g.agent}`), ...(g.sub ? { sub: { ...g.sub, adopted: true } } : {}) } : g)))
  await saveLinks($)
}

export async function doneTool($: EngineInterface, e: any, next: any) {
  try {
    const agent = e.agentId ?? MAIN
    if (agent === MAIN) reminders.planned = true
    if (agent === MAIN) await wake($)
    const input = ((e as any).input ?? e) as { ids?: string[]; cancel?: string[]; summary?: unknown }
    // The panel draws its own ↩ before the summary: one the model wrote too is dropped ("↩ ↩").
    const brief = typeof input.summary === 'string' ? input.summary.replace(/^\s*↩\s*/, '') : ''
    if (agent === MAIN && brief.trim() !== '') await $.state.set(briefState, brief)
    let notes: string[] = []
    let closed: string[] = []
    let unstarted: string[] = []
    let canceled = 0
    const now = await stamp($)
    const { value: before0 = [] } = await $.state.get(groupsState)
    const beforeMain = (before0 as Group[]).find(g => g.agent === MAIN)?.tasks ?? []
    const groups = await change($, all => {
      notes = []
      closed = []
      unstarted = []
      canceled = 0
      const others = tasksOf(all.filter(g => g.agent !== agent))
      return all.map(g => {
        if (g.agent !== agent) return g
        let tasks = g.tasks
        for (const id of input.ids ?? []) {
          const { node: hit, error } = resolve(tasks, id)
          if (error) notes.push(error)
          else if (!hit) notes.push(resolve(others, id).node ? `"${id}" é de outro agente` : `"${id}" não existe`)
          else if (hit.status === 'interrupted') notes.push(DONE.interrupted(id))
          else {
            unstarted.push(...flat([hit]).filter(t => t.status === 'open' && t.children.length === 0 && t.started === undefined && t.startedAt === undefined).map(t => t.id))
            tasks = settle(edit(fillStarts(tasks, hit.id, now), hit.id, finish(now)), now)
            closed.push(...flat([hit]).filter(t => t.status === 'open').map(t => t.id))
          }
        }
        // Tasks that will not be done (the person changed course): interrupted, out of x/y. What was
        // done below stays done; a parent with something done below closes by settle.
        for (const id of Array.isArray(input.cancel) ? input.cancel : []) {
          const { node: hit, error } = resolve(tasks, id)
          if (error) notes.push(error)
          else if (!hit) notes.push(resolve(others, id).node ? `"${id}" é de outro agente` : `"${id}" não existe`)
          else if (hit.status !== 'open') notes.push(`"${id}" já está fechada`)
          else {
            const drop = (t: TaskNode): TaskNode =>
              flat(t.children).some(c => c.status === 'done') ? { ...t, children: t.children.map(drop) } : interrupt(now)(t)
            tasks = settle(edit(tasks, hit.id, drop), now)
            canceled++
          }
        }
        return { ...g, tasks }
      })
    })
    // Closing the task a stopped session was opened from: its pending tasks left the count, said here
    // (the other order, the session stopping after, says it in its reminder: endedNote).
    if (agent === MAIN) {
      const left = await settledBy($, beforeMain, groups.find(g => g.agent === MAIN)?.tasks ?? [])
      if (left.length > 0) notes.push(DONE.settled(left))
    }
    // Closing the task a message was sent from while it is still queued: allowed, with a warning.
    if (agent === MAIN) {
      const { value: sends = [] } = await $.state.get(sendsState)
      const main = flat(groups.find(g => g.agent === MAIN)?.tasks ?? [])
      for (const s of (sends as Send[]).filter(s => !s.taken && !s.cut && closed.includes(s.anchor ?? ''))) {
        const t = main.find(t => t.id === s.anchor)
        if (t && t.status === 'done') notes.push(DONE.queued(s.to, t.id))
      }
      // The send stays with the closed task: its ✉ is drawn until the session takes the message up
      // (watchSends), whatever the model did with the task. An id used again by a new plan renames the
      // old task and its send with it (renameAnchors), or drops both (a replanned task).
      // The last step closed with no summary: the request would have no ↩ line.
      if ((await lastBrief($)) === undefined && closed.length > 0 && !hasOpen(groups.find(g => g.agent === MAIN)?.tasks ?? []))
        notes.push(DONE.noSummary)
    }
    const [d, n] = count(groups.find(g => g.agent === agent)?.tasks ?? [])
    // Several steps never started and closed together: the panel showed the first one in progress
    // all along, then jumped to the last, the steps between at 0:00 (the person's words: "ficou
    // parada muito tempo na primeira tarefa, e derepente pulo para a ultima").
    if (unstarted.length >= 2) notes.push(DONE.unstarted(unstarted))
    return { result: `Concluídas: ${d}/${n} no seu grupo.` + (canceled > 0 ? ` Canceladas: ${canceled}.` : '') + (notes.length > 0 ? ` Avisos: ${notes.join('; ')}.` : '') }
  } catch (err) {
    return { result: 'erro: ' + String(err), isError: true as const }
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
      // Past every start so far, done ones too (startedSeq outlives the done), so the order holds.
      let seq = flat(tasksOf(all)).reduce((top, t) => Math.max(top, t.started ?? 0, t.startedSeq ?? 0), 0) + 1
      const others = tasksOf(all.filter(g => g.agent !== agent))
      return all.map(g => {
        if (g.agent !== agent) return g
        let tasks = g.tasks
        for (const id of input.ids ?? []) {
          const { node: hit, error } = resolve(tasks, id)
          if (error) notes.push(error)
          else if (!hit) notes.push(resolve(others, id).node ? `"${id}" é de outro agente` : `"${id}" não existe`)
          else if (hit.status !== 'open' && hit.children.length > 0) {
            notes.push(START.closedParent(id))
          } else {
            // An open parent starts its first open leaf, in plan order; the next ones wait for their own start.
            const path = hit.children.length > 0 ? firstOpen(hit.children) : []
            const leafId = path[path.length - 1]
            const leaf = leafId !== undefined ? flat(hit.children).find(t => t.id === leafId) : undefined
            const target = leaf ?? hit
            if (leaf) notes.push(`"${id}" tem subtarefas: iniciei a primeira aberta, "${leaf.short}" ${leaf.title}`)
            tasks = begin(tasks, target.id, seq++, now, idleOf(all))
            begun.push(target.title)
            roots.push(target.id.split('/')[0] as string)
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
    return { result: 'erro: ' + String(err), isError: true as const }
  }
}
