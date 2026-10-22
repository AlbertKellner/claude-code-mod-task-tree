import { atom, read, update } from 'claude-code'
import type { AgentInfo, Register } from 'claude-code'

import type { Child, Group, Launch, LegacyNode, Panel, Published, Send, Status, TaskNode, Turn, Wait } from '../types'
import {
  BAR_GAP, BAR_W, BRANCH_GAP, BRANCH_IN, CARD_EDGE, CARD_IN, CARD_RADIUS, EDGE_PAD, GUIDE_FROM, HEADER_H, HEADER_H_CHIPS, HEADER_H_EMPTY, HEADER_PAD,
  ICONS_W, PAD, RIGHT_GAP, RING_D, RING_GAP, ROW_H, ROW_H_TOP, SECTION_TEXT_OUT, TEXT_IN, cardRight, col, lineWidth, overlay, ringFromRight, textRight,
} from '../draw/geometry'

const PANE = 'task-tree'
const legacyTasks = { plugin: 'task-tree', key: 'tasks' } as const
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const waitsState = { plugin: 'task-tree', key: 'waits' } as const
const launchesState = { plugin: 'task-tree', key: 'launches' } as const
const childrenState = { plugin: 'task-tree', key: 'children' } as const
const childrenErrorState = { plugin: 'task-tree', key: 'childrenError' } as const
const endedState = { plugin: 'task-tree', key: 'ended' } as const
const sendsState = { plugin: 'task-tree', key: 'sends' } as const
const viewState = { plugin: 'task-tree', key: 'view' } as const
const workState = { plugin: 'task-tree', key: 'work' } as const
const receivedState = { plugin: 'task-tree', key: 'received' } as const
const engineState = { plugin: 'task-tree', key: 'engine' } as const
const briefState = { plugin: 'task-tree', key: 'brief' } as const
// The turn's answer in a few words, as the session gave it (done's `summary`), until the turn ends.
// In the state, not a variable of the module: a reload of the mod between the done and the end of
// the turn (saving a file of the mod mid-turn) kept the variable's value nowhere, and the ↩ line
// lost the summary. Empty: none given.
async function lastBrief($: any): Promise<string | undefined> {
  const { value } = await $.state.get(briefState)
  return typeof value === 'string' && value !== '' ? value : undefined
}
// The pane's lines the person opened or closed (see setFold).
const folds = atom({ plugin: 'task-tree', key: 'collapsed' } as const, {} as Record<string, boolean>)

// The main loop's group; a subagent's is keyed by its agentId.
const MAIN = ''
// Prompt origins (`prompt.submit`'s `e.origin.kind`) that continue the request in progress rather
// than make a new one: background tasks' notifications (a subagent's hand-back), observers'
// reports, follow-ups of a UI action and the engine's own notices.
const NO_TURN = ['task-notification', 'observer', 'observer-activity', 'auto-continuation', 'unclassified']
// How many sessions' panels the store keeps for a resume.
const KEEP = 30

// The panel's rules, added to the system prompt of every request that offers its tools,
// so the mod behaves the same on any machine with nothing in CLAUDE.md.
const RULES = [
  '# Painel de tarefas (task-tree)',
  '',
  'O usuário acompanha o trabalho num painel lateral de tarefas. Regras:',
  '',
  '- Todo pedido abre pelo menos uma tarefa no painel, mesmo uma pergunta simples ou respondida só com ' +
    'pesquisa ou leitura de arquivos. A primeira chamada de ferramenta é mcp__task-tree__plan com a árvore ' +
    'de tarefas: até 3 níveis (nível 1 genérico, nível 3 mais granular), ids únicos dentro do plano ' +
    '("1", "1.2", "1.2.3"). Uma tarefa basta para um pedido simples.',
  '- Abaixo do nível 1 os ids ganham o id dele como prefixo ("D/1.2"). done e start aceitam o id curto ' +
    'quando não é ambíguo (preferem a tarefa aberta) ou o completo, e avisam no resultado ids ' +
    'inexistentes, ambíguos ou de outro agente.',
  '- No primeiro plan de cada mensagem do usuário, passe em `request` um título curto do que foi pedido: ' +
    'no painel, as tarefas de nível 1 ficam agrupadas pela mensagem em que foram planejadas, com esse título.',
  '- Etapa por etapa, no momento em que acontece: mcp__task-tree__start ao começar cada tarefa (várias ' +
    'podem estar em andamento) e mcp__task-tree__done assim que ela estiver de fato concluída, antes de ' +
    'passar à próxima. Nunca feche várias de uma vez no fim: o painel fica parado na primeira e pula para ' +
    'a última, com 0:00 nas do meio. Um pai fecha sozinho quando todos os filhos fecham.',
  '- No done do último passo do pedido, passe em `summary` um resumo da resposta em até 120 caracteres ' +
    '(ex.: "Cartões na raiz: causa na recarga; correção enviada"): é a linha ↩ do painel, com a resposta ' +
    'inteira no tooltip. Sem ele, o painel usa a primeira frase da resposta.',
  '- Para replanejar, chame plan de novo com o nível 1 inteiro. Um nível 1 aberto com o mesmo id é ' +
    'substituído do zero no mesmo lugar da lista: remarque com done o que já estava concluído. Um nível 1 ' +
    'já concluído fica como histórico. start só reabre tarefas sem subtarefas; para refazer um pai ' +
    'concluído, replaneje o nível 1.',
  '- Não crie plano retroativo para trabalho já feito: se perceber que começou sem plano, planeje o que falta.',
  '- Antes de perguntar (AskUserQuestion, ExitPlanMode, wrap_up com ask), mantenha em andamento a tarefa a ' +
    'que a pergunta pertence e feche-a só depois da resposta; se a resposta vier pelo chat, feche-a no ' +
    'início do turno seguinte. AskUserQuestion sem tarefa aberta é recusado.',
  '- Depois que o usuário responder uma pergunta ou aprovar um plano, atualize o painel (done, start ou ' +
    'plan) antes de seguir. Se ele responder por mensagem no chat em vez de escolher uma opção, a mensagem ' +
    'é a resposta.',
  '- Subagentes que usam o painel ganham um grupo próprio, mostrado embaixo da tarefa em que foram ' +
    'lançados. Cada agente só mexe no próprio grupo; o que ele deixar aberto ao terminar vira interrompido.',
  '- Uma tarefa de enviar mensagem a outra sessão (SendMessage) fica com o ícone de mensagem (✉) do ' +
    'envio até a sessão destino começar a tratar a mensagem, mesmo quando a entrega é imediata ' +
    '("delivered; its turn has started on it"). Não chame done nela: quando o recebimento é confirmado, ' +
    'o painel a conclui sozinho (mesmo com esta sessão parada). Com "queued", o painel também avisa.',
  '- Sessões abertas com start_session aparecem embaixo da tarefa em andamento quando foram abertas, com ' +
    'as tarefas do painel delas: antes de abrir uma sessão, marque com start a tarefa a que ela pertence.',
].join('\n')

type InNode = { id: string; title: string; children?: InNode[] }

const node = {
  type: 'object',
  required: ['id', 'title'],
  properties: { id: { type: 'string' }, title: { type: 'string' } },
}
const level = (inner?: object) => ({
  type: 'array',
  items: inner ? { ...node, properties: { ...node.properties, children: inner } } : node,
})

// A level-1 task keeps its id; the ids below it are prefixed with it ("D/1.1"), so two
// plans may both use "1.1".
function build(list: InNode[], depth: number, root?: string, now?: number): TaskNode[] {
  return list.map(t => ({
    id: root === undefined ? t.id : `${root}/${t.id}`,
    short: t.id,
    title: t.title,
    status: 'open' as Status,
    ...(now === undefined ? {} : { plannedAt: now }),
    children: depth < 3 ? build(t.children ?? [], depth + 1, root ?? t.id, now) : [],
  }))
}

const flat = (list: TaskNode[]): TaskNode[] => list.flatMap(t => [t, ...flat(t.children)])
const tasksOf = (groups: Group[]) => groups.flatMap(g => g.tasks)
const hasOpen = (list: TaskNode[]) => flat(list).some(t => t.status === 'open')
const withMain = (groups: Group[]): Group[] =>
  groups.some(g => g.agent === MAIN) ? groups : [{ agent: MAIN, label: '', tasks: [] }, ...groups]

function duplicates(list: TaskNode[]): string[] {
  const ids = flat(list).map(t => t.id)
  return ids.filter((id, i) => ids.indexOf(id) !== i)
}

// The task an id names in one group: the full id, or the short one when it is
// unambiguous, an open task preferred over a closed one.
function resolve(list: TaskNode[], id: string): { node?: TaskNode; error?: string } {
  const all = flat(list)
  // A closed level-1 task from an old plan ("1") must not win over the open "D/1" of the plan
  // in progress: the open tasks come first, by full or short id alike.
  const same = all.filter(t => t.id === id || t.short === id)
  if (same.length === 1) return { node: same[0] }
  for (const status of ['open', 'done', 'interrupted'] as Status[]) {
    const hits = same.filter(t => t.status === status)
    if (hits.length === 1) return { node: hits[0] }
    const exact = hits.find(t => t.id === id)
    if (exact) return { node: exact }
    if (hits.length > 1) return { error: `"${id}" é ambíguo, use ${hits.map(t => `"${t.id}"`).join(' ou ')}` }
  }
  return {}
}

const edit = (list: TaskNode[], id: string, fn: (t: TaskNode) => TaskNode): TaskNode[] =>
  list.map(t => (t.id === id ? fn(t) : { ...t, children: edit(t.children, id, fn) }))

// A task's clock stops when it closes (`now` is undefined where the time cannot be read).
const stop = (t: TaskNode, now?: number) => (t.startedAt !== undefined ? (t.endedAt ?? now) : t.endedAt)

// Done closes the task with its whole subtree; a parent whose children are all done
// closes too.
const finish =
  (now?: number) =>
  (t: TaskNode): TaskNode => ({
    ...t,
    status: t.status === 'interrupted' ? 'interrupted' : 'done',
    started: undefined,
    endedAt: t.status === 'open' ? stop(t, now) : t.endedAt,
    children: t.children.map(finish(now)),
  })
// A task closed with no start (done without start) gets one, so its time shows: the end of the
// closed sibling before it, else its parent's start, else when it was planned (never after now).
// What it closes below it with no start starts the same way, from it.
function fillStarts(list: TaskNode[], id: string, now?: number, parentStart?: number): TaskNode[] {
  return list.map((t, i) => {
    if (t.id === id) return fill([t], list.slice(0, i), parentStart, now)[0] as TaskNode
    if (!flat(t.children).some(c => c.id === id)) return t
    return { ...t, children: fillStarts(t.children, id, now, t.startedAt ?? parentStart) }
  })
}
function fill(items: TaskNode[], before: TaskNode[], parentStart: number | undefined, now?: number): TaskNode[] {
  let prev = before.filter(s => s.status !== 'open' && s.endedAt !== undefined).pop()?.endedAt
  return items.map(t => {
    if (t.status !== 'open') {
      prev = t.endedAt ?? prev
      return t
    }
    const from = t.startedAt ?? prev ?? parentStart ?? t.plannedAt
    const startedAt = from === undefined || now === undefined ? from : Math.min(from, now)
    return { ...t, startedAt, children: fill(t.children, [], startedAt, now) }
  })
}

function settle(list: TaskNode[], now?: number): TaskNode[] {
  return list.map(t => {
    const children = settle(t.children, now)
    const closed = t.status === 'open' && children.length > 0 && children.every(c => c.status === 'done')
    return closed
      ? { ...t, status: 'done' as Status, started: undefined, endedAt: stop(t, now), children }
      : { ...t, children }
  })
}

// Start marks the task in progress, reopening it and its parents when it was closed. Its clock
// starts (again, when it was closed); a parent's starts with its first child's and goes on.
function begin(list: TaskNode[], id: string, seq: number, now?: number): TaskNode[] {
  return list.map(t => {
    if (t.id === id) {
      const startedAt = t.status === 'open' ? (t.startedAt ?? now) : now
      return { ...t, status: 'open' as Status, started: seq, startedAt, endedAt: undefined }
    }
    if (!flat(t.children).some(c => c.id === id)) return t
    return { ...t, status: 'open' as Status, startedAt: t.startedAt ?? now, endedAt: undefined, children: begin(t.children, id, seq, now) }
  })
}

// What a subagent left open when it ended.
const interrupt =
  (now?: number) =>
  (t: TaskNode): TaskNode =>
    t.status === 'open'
      ? { ...t, status: 'interrupted', started: undefined, endedAt: stop(t, now), children: t.children.map(interrupt(now)) }
      : t

// The time now, or undefined where it cannot be read (the test kit without a clock).
async function stamp($: any): Promise<number | undefined> {
  try {
    const t = await $.clock.now()
    return typeof t === 'number' ? t : undefined
  } catch {
    return undefined
  }
}

// A task whose clock runs: started and not closed.
const timing = (list: TaskNode[]) => flat(list).some(t => t.status === 'open' && t.startedAt !== undefined && t.endedAt === undefined)
// From the first start to the last close, or to now while any task runs; undefined when no
// task was started (or the time is unknown).
function span(list: TaskNode[], now?: number): number | undefined {
  const all = flat(list).filter(t => t.startedAt !== undefined)
  if (all.length === 0) return undefined
  const from = Math.min(...all.map(t => t.startedAt as number))
  const to = timing(list) ? now : Math.max(...all.map(t => t.endedAt ?? 0))
  return to === undefined || to < from ? undefined : to - from
}
const elapsed = (t: TaskNode, now?: number) => {
  if (t.startedAt === undefined || t.status === 'interrupted') return undefined
  const to = t.endedAt ?? (t.status === 'open' ? now : undefined)
  return to === undefined || to < t.startedAt ? undefined : to - t.startedAt
}
// "0:04", "6:12", "1:02:09".
function clockText(ms: number): string {
  const s = Math.floor(ms / 1000)
  const two = (k: number) => String(k).padStart(2, '0')
  return s >= 3600 ? `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` : `${Math.floor(s / 60)}:${two(s % 60)}`
}

const migrate = (t: LegacyNode): TaskNode => ({
  id: t.id,
  short: t.id.replace(/^[^:]*:/, ''),
  title: t.title,
  status: t.done ? 'done' : 'open',
  children: t.children.map(migrate),
})

// Leaves done, leaves counted, leaves interrupted (kept out of the count).
function count(list: TaskNode[]): [number, number, number] {
  let d = 0
  let n = 0
  let x = 0
  for (const t of flat(list)) {
    if (t.children.length > 0) continue
    if (t.status === 'interrupted') x++
    else {
      n++
      if (t.status === 'done') d++
    }
  }
  return [d, n, x]
}

// How deep the sessions opened by opened sessions are followed (in the count and the drawing).
const DEEP = 3
// A session still at work: running, or waiting on the person.
const live = (c: Child) => !c.archived && (c.running || c.waiting === true)
// A session's panel; earlier versions published only its main group's tasks. An archived session
// stays in the tree as history (its last published panel): what it left open will not be done,
// so it reads as interrupted (out of the count's total, drawn gray).
const panelOf = (c: Child): Panel => {
  const p = c.panel ?? { groups: [{ agent: MAIN, label: '', tasks: c.tasks ?? [] }], waits: [], children: [] }
  if (!c.archived) return p
  return { ...p, waits: [], groups: (p.groups ?? []).map(g => ({ ...g, tasks: g.tasks.map(interrupt(undefined)) })) }
}
// A session in one card per message the main loop sent it (`rounds`): the card of a message holds
// the turns the session opened after it (its tasks in plan order, the subagents, notices and
// sessions under them) and goes under the task the message was sent from; the first card, the
// turns from before any message, stays where the session was opened. A message not taken up yet
// opened no turn, so it has no card (its task shows the queued envelope meanwhile). The card with
// the session's work in progress (else the last) waits and shows its context; while the session
// runs, every card with open tasks is drawn at work.
// The messages that opened a round of `c`: those `me` (the session drawing it) sent, with the task
// they were sent from, and those a sister session sent (its published `received`), drawn under
// the task the sister's own card was under when it sent (followed down a chain of sisters).
// `peer`: a sister's message; `known`: its origin was found (else drawn only after a while, see split).
type Break = { at: number; anchor?: string; peer?: boolean; known?: boolean; orphan?: boolean }
// The messages `me` sent this session with no round recorded (the send was not seen: the panel
// was off, or the mod reloaded or crashed then): each one the session took up (its published
// `received`), matched in order against the rounds, opens a round all the same, or its turns would
// join the round before it, under a task of an earlier request, drawn above requests between them
// (the person's words: "layout quebrou novamente"). Its task is the main task of `me` that was open
// when the message came (the one that sent it, waiting on it); with none, no task: the card goes
// to the end of the panel, never between other requests.
function unsent(c: Child, me: string | undefined, owner: TaskNode[]): Break[] {
  const rounds = [...(c.rounds ?? [])].sort((a, b) => a.at - b.at)
  if (me === undefined || rounds.length === 0) return []
  const got = (c.panel?.received ?? [])
    .filter(x => x.from === me && typeof x.at === 'number' && x.at > rounds[0].at)
    .map(x => x.at as number)
    .sort((a, b) => a - b)
  const out: Break[] = []
  let i = 0
  for (const at of got) {
    // The earliest round not matched yet, sent before the message came: that send's message.
    if (i < rounds.length && rounds[i].at <= at) {
      i++
      continue
    }
    const open = flat(owner)
      .filter(t => typeof t.startedAt === 'number' && t.startedAt <= at && (t.endedAt === undefined || t.endedAt >= at))
      .sort((a, b) => (b.startedAt as number) - (a.startedAt as number))[0]
    out.push({ at, anchor: open?.id, orphan: true })
  }
  return out
}

// Each session's breaks once per list of sisters (one drawing): the chain follows a sister's own
// breaks for every message it sent, and sisters message each other in a ring (implementation →
// docs → SVG → governance → implementation). Recomputed per message, with up to 20 kept each, that
// was 20^5 calls per card on every redraw, and it crashed the hooks worker. A session met again
// inside its own chain counts with its own rounds only.
const breaksMemo = new WeakMap<Child[], Map<string, Break[]>>()
function breaks(c: Child, sisters: Child[], me: string | undefined, seen: string[] = [], owner: TaskNode[] = []): Break[] {
  let memo = breaksMemo.get(sisters)
  if (memo === undefined) breaksMemo.set(sisters, (memo = new Map()))
  // The path is in the key: a session met again inside its chain is cut there, and only there.
  const key = `${me ?? ''}|${seen.join(',')}|${c.id}|${c.part ?? ''}`
  const hit = memo.get(key)
  if (hit !== undefined) return hit
  const own: Break[] = [...(c.rounds ?? []).map(r => ({ at: r.at, anchor: r.anchor })), ...unsent(c, me, owner)]
  if (seen.includes(c.id) || seen.length > 4) return own
  const path = [...seen, c.id]
  const sisterBreaks = new Map<string, Break[]>()
  const peer: Break[] = (c.panel?.received ?? []).flatMap(x => {
          const from = sisters.find(k => k.id === x.from && k.id !== c.id)
          if (from === undefined || x.from === me || typeof x.at !== 'number') return []
          // The sister sent it in one of its turns: the message belongs to that turn's round (the one
          // the turn opened after), not to the last round before it arrived, which may be a later
          // message the sister had not taken up yet.
          let fb = sisterBreaks.get(from.id)
          if (fb === undefined) sisterBreaks.set(from.id, (fb = breaks(from, sisters, me, path, owner)))
          const fmain = withMain(from.panel?.groups ?? []).find(g => g.agent === MAIN)
          const fturns = fmain?.turns ?? []
          // First, the sister's own sending task, while its ✉ is up (its published `sends`): the turn
          // that task was planned in. Else the sister's last turn before the message came.
          const out = (from.panel?.sends ?? []).filter(s => (s.to === c.id || (c.name !== '' && s.to === c.name)) && (s.at ?? 0) <= x.at).pop()
          const task = out?.anchor ? fmain?.tasks.find(t => flat([t]).some(k => k.id === out.anchor)) : undefined
          const viaSend = task?.turn !== undefined ? fturns.find(u => u.id === task.turn)?.at : undefined
          const sent = fturns.filter(u => typeof u.at === 'number' && (u.at as number) <= x.at).pop()
          const when = viaSend ?? sent?.at
          const before = when === undefined ? [] : fb.filter(b => b.at <= when)
          const last = before[before.length - 1]
          return [{ at: x.at, anchor: last ? last.anchor : from.anchor, peer: true, known: when !== undefined && (last !== undefined || from.anchor !== undefined) }]
        })
  const out = [...own, ...peer].sort((a, b) => a.at - b.at)
  memo.set(key, out)
  return out
}

// When a card's work began: its first turn (the message it was opened or sent with), else its
// first planned or started task. Cards under one task are drawn in this order, the order the work
// ran in (implementation, then the sessions it passed it on to), not grouped by session.
function begins(c: Child): number {
  const p = panelOf(c)
  const main = withMain(p.groups ?? []).find(g => g.agent === MAIN)
  const ats = [
    ...(main?.turns ?? []).flatMap(u => (typeof u.at === 'number' ? [u.at] : [])),
    ...flat(tasksOf(p.groups ?? [])).flatMap(t => [t.plannedAt, t.startedAt].filter((x): x is number => typeof x === 'number')),
  ]
  return ats.length > 0 ? Math.min(...ats) : Infinity
}
const inOrder = (list: Child[]) =>
  list
    .map((c, i) => ({ c, i, at: begins(c) }))
    .sort((a, b) => (a.at === b.at ? a.i - b.i : a.at - b.at))
    .map(x => x.c)

// While a sister's message has no known origin yet (the sister's state not read yet), its card is
// not drawn, for up to WAIT_ORIGIN ms: it would show at the root and jump into place on the next read.
const WAIT_ORIGIN = 10000
let drawNow: number | undefined
function split(c: Child, sisters: Child[] = [], me?: string, owner: TaskNode[] = []): Child[] {
  const rounds = breaks(c, sisters, me, [], owner)
  const p = c.panel
  if (c.part !== undefined || rounds.length === 0 || p === undefined) return [c]
  const groups = withMain(p.groups ?? [])
  const main = groups.find(g => g.agent === MAIN) as Group
  const turns = main.turns ?? []
  const roundOf = (u: Turn) => rounds.reduce((k, r, i) => (u.at !== undefined && u.at >= r.at ? i + 1 : k), 0)
  const turnPart = (id?: number) => {
    const u = turns.find(u => u.id === id)
    return u === undefined ? 0 : roundOf(u)
  }
  const parts: number[] = []
  for (const t of main.tasks) {
    const k = turnPart(t.turn)
    if (!parts.includes(k)) parts.push(k)
  }
  parts.sort((a, b) => a - b)
  if (parts.length < 2 && (parts[0] ?? 0) === 0) return [c]
  const tasksIn = (k: number) => main.tasks.filter(t => turnPart(t.turn) === k)
  const busy = parts.find(k => flat(tasksIn(k)).some(t => t.status === 'open' && t.started !== undefined))
  const lead = busy ?? parts[parts.length - 1]
  // What hangs from a task goes to that task's card; with no such task, to the leading card.
  const holder = (anchor?: string) => parts.find(k => anchor !== undefined && flat(tasksIn(k)).some(t => t.id === anchor)) ?? lead
  const ownerOf = (agent: string) => (agent === MAIN ? holder(current(main.tasks).anchor) : holder(groups.find(g => g.agent === agent)?.anchor))
  const waiting = (k: number) => {
    const b = k > 0 ? rounds[k - 1] : undefined
    return b?.peer === true && !b.known && drawNow !== undefined && drawNow - b.at < WAIT_ORIGIN
  }
  return parts.filter(k => !waiting(k)).map(k => {
    const tasks = tasksIn(k)
    const ids = tasks.map(t => t.id)
    const at = k === lead
    return {
      ...c,
      part: k,
      anchor: k === 0 ? c.anchor : rounds[k - 1]?.orphan || rounds[k - 1]?.peer ? rounds[k - 1]?.anchor : (rounds[k - 1]?.anchor ?? c.anchor),
      lastAnchor: at ? c.lastAnchor : undefined,
      // A card with open tasks of a session at work is at work too (the new group waits its turn).
      running: c.running && (at || hasOpen(tasks)),
      waiting: at ? c.waiting : false,
      // Every card shows the session's ring, at work or not: its last reported share (the person's words:
      // "mesmo depois que a sessao termina, o icone se contexto precisa continuar aparecendo").
      context: c.context,
      tasks: undefined,
      panel: {
        ...p,
        groups: groups
          .map(g => (g.agent === MAIN ? { ...g, tasks, turns: turns.filter(u => tasks.some(t => t.turn === u.id)) } : g))
          .filter(g => g.agent === MAIN || ownerOf(g.agent) === k),
        waits: (p.waits ?? []).filter(w => ownerOf(w.agent) === k),
        children: (p.children ?? []).filter(s => holder(s.anchor) === k),
        ...(p.work ? { work: p.work.filter(id => ids.includes(id)) } : {}),
      },
    }
  })
}

// The count of a panel with its sessions' tasks: they are part of the tree, under the task
// they were opened on (an archived one too, as history).
function total(p: Panel, level = 0): [number, number, number] {
  let [d, n, x] = count(tasksOf(p.groups ?? []))
  if (level >= DEEP) return [d, n, x]
  for (const c of p.children ?? []) {
    const [cd, cn, cx] = total(panelOf(c), level + 1)
    d += cd
    n += cn
    x += cx
  }
  return [d, n, x]
}

// The sessions opened on a task or below it (archived ones as history): their tasks add to its count and
// its time, and while one is still at work the task is drawn in progress, its clock running,
// whatever its own status says.
// `Ring`: a session's share of its context used (see contextRing), on its card's label.
// `faded`: an archived session's last share, drawn dim.
type Ring = { percent: number; name: string; faded?: boolean }
const ringOf = (c: Child): Ring | undefined =>
  typeof c.context === 'number' ? { percent: c.context, name: c.name || c.title, ...(c.archived ? { faded: true } : {}) } : undefined
type Work = { busy: boolean; any: boolean; d: number; n: number; tasks: TaskNode[] }
const idle: Work = { busy: false, any: false, d: 0, n: 0, tasks: [] }
// A panel's tasks with its sessions' (archived ones too), as deep as the count follows them.
function allTasks(p: Panel, level: number): TaskNode[] {
  const own = tasksOf(p.groups ?? [])
  if (level >= DEEP) return own
  return own.concat(...(p.children ?? []).map(c => allTasks(panelOf(c), level + 1)))
}
function atWork(t: TaskNode, sessions: Child[], level: number): Work {
  const ids = flat([t]).map(k => k.id)
  const mine = sessions.filter(c => c.anchor !== undefined && ids.includes(c.anchor))
  let d = 0
  let n = 0
  for (const c of mine) {
    const [cd, cn] = total(panelOf(c), level + 1)
    d += cd
    n += cn
  }
  const tasks = mine.flatMap(c => allTasks(panelOf(c), level + 1))
  return { busy: mine.some(live), any: mine.length > 0, d, n, tasks }
}
// An open parent with something done below it and nothing in progress: drawn waiting (◷), its
// time stopped at the last close below it.
const resting = (list: TaskNode[]) => flat(list).some(k => k.status === 'done')
function stillSpan(list: TaskNode[]): number | undefined {
  const all = flat(list)
  const starts = all.flatMap(t => (t.startedAt ?? t.plannedAt) ?? [])
  const ends = all.flatMap(t => t.endedAt ?? [])
  if (starts.length === 0 || ends.length === 0) return undefined
  const span = Math.max(...ends) - Math.min(...starts)
  return span < 0 ? undefined : span
}

// A task's time: from the first start to the last close of it, its subtasks and its sessions'
// tasks, or to now while any of them runs or a session below it is at work.
function timeOf(t: TaskNode, w: Work, now?: number): number | undefined {
  return timeSpan([t, ...w.tasks], w.busy, now)
}
function timeSpan(list: TaskNode[], busy: boolean, now?: number): number | undefined {
  if (!busy) return span(list, now)
  const starts = flat(list).flatMap(k => (k.startedAt === undefined ? [] : [k.startedAt]))
  return starts.length === 0 || now === undefined ? undefined : now - Math.min(...starts)
}

// The header's "em andamento": every open task with no subtasks (◉ or ○ leaves), in every group of
// the panel and in its sessions not archived (as deep as the count goes), so it is M − N of the
// "N de M" (interrupted ones are out of both). The ones waiting on a session (`sent`, main group
// here) have their own chip and are left out of this one.
function activeLeaves(p: Panel, level: number, sent: string[] = []): number {
  let k = 0
  for (const g of withMain(p.groups ?? [])) {
    k += flat(g.tasks).filter(
      t => t.status === 'open' && t.children.length === 0 && !(g.agent === MAIN && sent.includes(t.id)),
    ).length
  }
  if (level >= DEEP) return k
  for (const c of p.children ?? []) if (!c.archived) k += activeLeaves(panelOf(c), level + 1)
  return k
}

// A whole session's time: starts are a task's start, else its plan.
function sessionTime(list: TaskNode[], running: boolean, now?: number): number | undefined {
  const all = flat(list)
  const starts = all.flatMap(t => (t.startedAt ?? t.plannedAt) ?? [])
  if (starts.length === 0) return undefined
  const from = Math.min(...starts)
  const ends = all.flatMap(t => t.endedAt ?? [])
  const to = running ? now : ends.length > 0 ? Math.max(...ends) : undefined
  return to === undefined || to < from ? undefined : to - from
}

// What a prompt is, with the app's status blocks (`<system-reminder>…</system-reminder>`, put in
// front of a session's first message and of queued deliveries) taken out: another session's message,
// a subagent handing back, the app's own notice, or a request.
type Said = { body: string; peer: boolean; handback: boolean; notice: boolean; title: string }
function said(text: string): Said {
  const body = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
  const peer = /<cross-session-message\b/.test(body)
  const handback = !peer && (/^<agent-message from="(?!local_)/.test(body) || /\[Subagent hand-back\]/.test(body))
  const notice = !peer && !handback && (body === '' || body.startsWith('<side-sessions-event>'))
  const inner = /<cross-session-message[^>]*>([\s\S]*?)(<\/cross-session-message>|$)/.exec(body)?.[1]
  return { body, peer, handback, notice, title: peer && inner !== undefined ? inner : body }
}

// A message of the person opens a turn of the main group, titled with its start; turns no plan
// used are dropped then, so only turns with tasks are kept.
async function openTurn($: any, text: string) {
  // A message from another session comes wrapped in tags: its words are the title.
  const line = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Pedido'
  const title = line.length > 60 ? `${line.slice(0, 59)}…` : line
  const at = await stamp($)
  await change($, all =>
    all.map(g => {
      if (g.agent !== MAIN) return g
      const turns = g.turns ?? []
      const used = turns.filter(u => g.tasks.some(t => t.turn === u.id))
      const id = turns.reduce((top, u) => Math.max(top, u.id), 0) + 1
      return { ...g, turns: [...used, { id, title, at }] }
    }),
  )
}

function firstOpen(items: TaskNode[]): string[] {
  for (const t of items) {
    if (t.status !== 'open') continue
    if (t.children.length === 0) return [t.id]
    const rest = firstOpen(t.children)
    if (rest.length > 0) return [t.id, ...rest]
  }
  return []
}
function pathTo(items: TaskNode[], id: string): string[] {
  for (const t of items) {
    if (t.id === id) return [t.id]
    const rest = pathTo(t.children, id)
    if (rest.length > 0) return [t.id, ...rest]
  }
  return []
}

// The tasks drawn in yellow, with their parents, and the one a waiting notice goes
// under: the tasks in progress (the last one started for the notice; a parent's first
// open task); with none, the first open task.
function current(list: TaskNode[]): { lit: string[]; anchor?: string } {
  const started = flat(list)
    .filter(t => t.status === 'open' && t.started !== undefined)
    .sort((a, b) => (a.started ?? 0) - (b.started ?? 0))
  if (started.length === 0) {
    const path = firstOpen(list)
    return { lit: path, anchor: path[path.length - 1] }
  }
  let lit: string[] = []
  let anchor: string | undefined
  for (const s of started) {
    const inner = firstOpen(s.children)
    lit = lit.concat(pathTo(list, s.id), inner)
    anchor = inner.length > 0 ? inner[inner.length - 1] : s.id
  }
  return { lit, anchor }
}

// The task a message is sent from: the task in progress, unless an open task was planned after
// it was started (planned to send, sent with no start): that newest one.
function sendAnchor(list: TaskNode[]): string | undefined {
  const { anchor } = current(list)
  const leaves = flat(list).filter(t => t.status === 'open' && t.children.length === 0)
  const since = (t?: TaskNode) => (t === undefined ? undefined : t.started !== undefined ? t.startedAt : t.plannedAt)
  const base = since(flat(list).find(t => t.id === anchor))
  let pick = anchor
  let top = base ?? -Infinity
  for (const t of leaves) {
    const at = t.plannedAt
    if (t.started === undefined && at !== undefined && at > top) {
      pick = t.id
      top = at
    }
  }
  return pick
}

// The open tasks with nothing open below them, for a reminder: '"1/1.2" Title; …'.
function openList(list: TaskNode[]): string {
  const open = flat(list).filter(t => t.status === 'open' && !t.children.some(c => c.status === 'open'))
  const shown = open.slice(0, 10).map(t => `"${t.id}" ${t.title}`)
  return shown.join('; ') + (open.length > 10 ? `; e mais ${open.length - 10}` : '')
}

const waitText = (w: Wait) =>
  w.kind === 'question'
    ? 'Aguardando sua resposta'
    : w.kind === 'choice'
      ? 'Aguardando sua escolha'
      : w.kind === 'plan'
      ? 'Aguardando aprovação do plano'
      : `Aguardando permissão: ${w.tool}`

// A subagent's header, the loop that launched it, and the task that loop was on at
// launch: the Agent call recorded it (see tool.call), claimed here by its description.
async function identify($: any, agent: string): Promise<Omit<Group, 'agent' | 'tasks'>> {
  const info = ((await $.agent.list()) as AgentInfo[]).find(a => a.id === agent)
  if (!info) return { label: 'Subagente' }
  const parent = info.parentId ?? MAIN
  let anchor: string | undefined
  await update($, launchesState, cur => {
    const list = cur ?? []
    const i = list.findIndex(l => l.parent === parent && l.description === info.description)
    anchor = i >= 0 ? list[i].anchor : undefined
    return i >= 0 ? list.filter((_, j) => j !== i) : list
  })
  return { label: `${info.type}: ${info.description}`, parent, anchor }
}

// A subagent's group exists from its first plan or wait on the person.
async function ensureGroup($: any, agent: string) {
  if (agent === MAIN) return
  if ((await $.state.get(groupsState)).value?.some(g => g.agent === agent)) return
  const meta = await identify($, agent)
  await change($, all => (all.some(g => g.agent === agent) ? all : [...all, { agent, tasks: [], ...meta }]))
}

// Keeps the status line and the store (for a resume) in step with the panel.
async function showStatus($: any, groups: Group[]) {
  const { value: children = [] } = await $.state.get(childrenState)
  const [d, n] = total({ groups, waits: [], children })
  $.ui.status(d === n ? undefined : `Tarefas ${d}/${n}`)
}

async function persist($: any, groups: Group[]) {
  await showStatus($, groups)
  try {
    const id: string = await $.session.id()
    await $.store.set(`session:${id}`, groups)
    const known = ((await $.store.get('sessions')) as string[] | undefined) ?? []
    const order = [id, ...known.filter(k => k !== id)]
    for (const old of order.slice(KEEP)) await $.store.delete(`session:${old}`)
    await $.store.set('sessions', order.slice(0, KEEP))
  } catch {}
  await publishWait($)
}

// Before groups the panel was one list (`tasks`): it moves into the main group, once,
// whichever comes first after a reload (session.start or a tool call).
async function adopt($: any) {
  const { value: old = [] } = await $.state.get(legacyTasks)
  if (old.length === 0) return
  await update($, groupsState, cur =>
    withMain(cur ?? []).map(g => (g.agent === MAIN ? { ...g, tasks: [...old.map(migrate), ...g.tasks] } : g)),
  )
  await $.state.set(legacyTasks, [])
}

async function change($: any, fn: (groups: Group[]) => Group[]): Promise<Group[]> {
  await ensureGroups($)
  await adopt($)
  const groups = await update($, groupsState, cur => fn(withMain(cur ?? [])))
  await persist($, groups)
  return groups
}

async function replace($: any, groups: Group[]) {
  await $.state.set(groupsState, groups)
  await persist($, groups)
}

// The session's panel as the store keeps it; its subagents do not come back, so what they left
// open is interrupted.
async function keptGroups($: any, id: string): Promise<Group[] | undefined> {
  const kept = (await $.store.get(`session:${id}`)) as Group[] | undefined
  return kept ? kept.map(g => (g.agent === MAIN ? g : { ...g, tasks: g.tasks.map(interrupt(undefined)) })) : undefined
}

// A resumed session's panel comes back.
async function restore($: any, id: string) {
  const groups = await keptGroups($, id)
  if (groups) await replace($, groups)
}

// Whether this module has seen the groups since it loaded. session.start brings them back from the
// store when the state holds none (a new process); a process that restarted without it (the hooks
// worker respawned after a crash) would otherwise start from nothing: the first write would then
// overwrite the store with the reduced panel, and the panel and the published file would show it
// empty. So the first write, drawing or publication of the module brings them back first, as
// `linksLoaded` does for the links.
// Answers the groups it brought back, for a caller that cannot write the state (a drawing): the
// module counts them as loaded only once they are in the state, so the next write brings them back
// again if this one could not.
let groupsLoaded = false
async function ensureGroups($: any): Promise<Group[] | undefined> {
  if (groupsLoaded) return undefined
  try {
    if ((await $.state.get(groupsState)).value !== undefined) {
      groupsLoaded = true
      return undefined
    }
    const groups = await keptGroups($, await $.session.id())
    if (groups === undefined) {
      groupsLoaded = true
      return undefined
    }
    try {
      await $.state.set(groupsState, groups)
      groupsLoaded = true
    } catch {}
    return groups
  } catch {
    return undefined
  }
}

// The desktop app's own tools (`mcp__ccd_…`) exist only there. If the list fails, assume
// the app, so a real failure still shows.
async function inDesktopApp($: any) {
  try {
    return (await $.tool.list()).some((t: any) => String(t.name).startsWith('mcp__ccd_'))
  } catch {
    return true
  }
}

// The sessions this one opened, from the desktop app's list of linked sessions. That list
// leaves this session out, so its own id is the `startedBy` no listed session carries.
// When the list was last read (clock ms), by the 10 s poll or otherwise.
let refreshedAt: number | undefined
async function refreshChildren($: any) {
  refreshedAt = (await stamp($)) ?? refreshedAt
  let rows: any[] = []
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { linked: true, include_archived: true, limit: 100 })
    const body = r.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('')
    if (r.isError) throw new Error(body)
    // With no linked session the host answers in plain text ("No other sessions found."), not
    // an empty JSON list.
    rows = /^\s*No .*sessions? found/i.test(body) ? [] : JSON.parse(body)
    await $.state.set(childrenErrorState, '')
  } catch (err) {
    // Shown in the panel: a failure here would otherwise leave the sessions silently out.
    // Outside the desktop app there are no sessions to show, so no line either.
    await $.state.set(childrenErrorState, (await inDesktopApp($)) ? String(err).slice(0, 200) : '')
    return
  }
  if (!Array.isArray(rows)) return
  // Messages queued to any session (its children, its mother, its sisters): before the returns below.
  await watchSends($, rows)
  // No linked session at all: this one opened none.
  if (rows.length === 0) {
    await update($, childrenState, () => [])
    return
  }
  const listed = rows.map(r => r.sessionId)
  const own = rows.map(r => r.startedBy).find(s => typeof s === 'string' && !listed.includes(s))
  if (own === undefined) return
  // The host tells running from idle only; whether a session waits on the person, its
  // own task-tree publishes (see publishWait).
  const mine = rows.filter(r => r.startedBy === own)
  const waiting: string[] = []
  const panels: Record<string, Panel> = {}
  const contexts: Record<string, number> = {}
  const engines: Record<string, string> = {}
  for (const r of mine) {
    try {
      // No file, or one this version cannot read: the session shows by the host's row alone.
      const file = (await readPublished($, r.sessionId)) ?? { waiting: false, waits: [], children: [] }
      if (file.waiting) waiting.push(r.sessionId)
      if (file.context) contexts[r.sessionId] = file.context.percent
      if (file.engine) engines[r.sessionId] = file.engine
      else {
        const known = await engineOf($, r.sessionId)
        if (known) engines[r.sessionId] = known
      }
      if (file.groups) {
        panels[r.sessionId] = {
          groups: file.groups,
          waits: file.waits,
          children: file.children,
          ...(file.work ? { work: file.work } : {}),
          ...(file.received ? { received: file.received } : {}),
          ...(file.sends ? { sends: file.sends } : {}),
        }
      } else if (file.tasks) {
        panels[r.sessionId] = { groups: [{ agent: MAIN, label: '', tasks: file.tasks }], waits: [], children: [] }
      }
    } catch {}
  }
  // Sessions whose turn just ended (running or waiting before, stopped now): the main loop is
  // reminded of the task it opened them on (see endedNote). A session just opened counts only
  // once the host has seen it run: right after start_session the host may still list it idle.
  let ended: string[] = []
  await update($, childrenState, cur => {
    const known = cur ?? []
    ended = mine
      .filter(r => {
        const before = known.find(k => k.id === r.sessionId)
        const stopped = r.isRunning !== true && r.isArchived !== true && !waiting.includes(r.sessionId)
        return before !== undefined && before.starting !== true && (before.running || before.waiting === true) && stopped
      })
      .map(r => r.sessionId)
    return mine
      .map(r => {
        const before = known.find(k => k.id === r.sessionId)
        const seen = r.isRunning === true || r.isArchived === true || waiting.includes(r.sessionId)
        return {
          starting: before?.starting === true && !seen ? true : undefined,
          id: r.sessionId,
          name: String(r.name ?? ''),
          title: String(r.title ?? r.name ?? r.sessionId),
          running: r.isRunning === true,
          archived: r.isArchived === true,
          waiting: r.isArchived !== true && waiting.includes(r.sessionId),
          context: contexts[r.sessionId] ?? before?.context,
          engine: engines[r.sessionId] ?? before?.engine,
          // A session the host lists again after leaving it out: its ties come back from the store's copy.
          lastAnchor: before?.lastAnchor ?? keptLink(r.sessionId)?.lastAnchor,
          rounds: before?.rounds ?? keptLink(r.sessionId)?.rounds,
          anchor: before?.anchor ?? keptLink(r.sessionId)?.anchor,
          panel: panels[r.sessionId] ?? before?.panel,
          tasks: panels[r.sessionId] ? undefined : before?.tasks,
        }
      })
  })
  if (ended.length > 0) await update($, endedState, cur => [...(cur ?? []).filter(id => !ended.includes(id)), ...ended])
  // The sessions' tasks are in this session's count, and in what it publishes to the one
  // that opened it.
  const { value: groups = [] } = await $.state.get(groupsState)
  await showStatus($, groups)
  if (mine.length > 0) await publishWait($)
  await keepTime($)
}

// The messages of other sessions in a prompt (`<cross-session-message from="local_…">`), kept with
// when they came (the last 20) and published, for the senders to confirm their queued SendMessage.
async function noteReceived($: any, text: string) {
  const froms = [...text.matchAll(/<cross-session-message[^>]*\bfrom="(local_[^"]+)"/g)].map(m => m[1] as string)
  if (froms.length === 0) return
  const at = await stamp($)
  if (at === undefined) return
  await update($, receivedState, cur => [...(cur ?? []), ...froms.map(from => ({ from, at }))].slice(-20))
  await publishWait($)
}

// A queued message is taken up once its session says so: its published file lists a message from
// this one received at or after the send (`received`); else a turn of it opened after the send;
// else, from sessions without that (earlier versions), seen stopped after the send and running again.
async function watchSends($: any, rows: any[]) {
  const { value: sends = [] } = await $.state.get(sendsState)
  if ((sends as Send[]).every(s => s.taken)) return
  const me = await selfId($)
  const files: Record<string, Published> = {}
  const fileOf = async (id: string): Promise<Published> => {
    if (!(id in files)) files[id] = (await readPublished($, id)) ?? { waiting: false, waits: [], children: [] }
    return files[id]
  }
  const marks: Record<number, Partial<Send>> = {}
  for (const [i, s] of (sends as Send[]).entries()) {
    if (s.taken) continue
    const r = rows.find(r => r.sessionId === s.to || (r.name && r.name === s.to))
    const id = r?.sessionId ?? (String(s.to).startsWith('local_') ? s.to : undefined)
    if (id === undefined) continue
    const file = await fileOf(id)
    const since = s.at ?? 0
    const got = (file.received ?? []).some((x: any) => x?.from === me && Number(x?.at) >= since)
    const main = file.groups?.find((g: any) => g?.agent === MAIN)
    const turned = Array.isArray(main?.turns) && main.turns.some((u: any) => typeof u?.at === 'number' && u.at >= since)
    if (got || turned) marks[i] = { taken: true }
    else if (r && r.isRunning !== true && !s.idle) marks[i] = { idle: true }
    else if (r && r.isRunning === true && s.idle) marks[i] = { taken: true }
  }
  if (Object.keys(marks).length === 0) return
  await update($, sendsState, cur => (cur ?? []).map((s, i) => (marks[i] ? { ...s, ...marks[i] } : s)))
  // Taken up: the task it was sent from is done, closed here with no turn of this session (it may
  // have stopped waiting for it), so its card in the mother's pane is not left parked.
  const anchors = (sends as Send[]).flatMap((s, i) => (marks[i]?.taken && s.anchor ? [s.anchor] : []))
  if (anchors.length === 0) return
  const now = await stamp($)
  await change($, all =>
    all.map(g => {
      if (g.agent !== MAIN) return g
      let tasks = g.tasks
      for (const id of anchors) {
        const t = flat(tasks).find(t => t.id === id)
        if (t && t.status === 'open' && !t.children.some(c => c.status === 'open')) tasks = settle(edit(fillStarts(tasks, id, now), id, finish(now)), now)
      }
      return { ...g, tasks }
    }),
  )
}
// Once: the sessions that took up a queued message, with the task it was sent from.
async function takenNote($: any): Promise<string | undefined> {
  const { value: sends = [] } = await $.state.get(sendsState)
  const done = (sends as Send[]).filter(s => s.taken)
  if (done.length === 0) return undefined
  await $.state.set(sendsState, (sends as Send[]).filter(s => !s.taken))
  // A delivery at once needs no reminder: the model saw it delivered.
  const taken = done.filter(s => !s.delivered)
  if (taken.length === 0) return undefined
  const { value: groups = [] } = await $.state.get(groupsState)
  const all = flat((groups as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
  const what = taken.map(s => {
    const t = all.find(t => t.id === s.anchor)
    return `${s.to}${t ? ` (tarefa do envio "${t.id}" ${t.title})` : ''}`
  })
  return (
    `Painel de tarefas (task-tree): recebimento confirmado, a sessão começou a tratar a mensagem: ${what.join('; ')}. ` +
    'O painel já concluiu a tarefa do envio; se ela ainda tinha algo a fazer, reabra com mcp__task-tree__start.'
  )
}

// The list read again when it is older than the poll's period: a session drawn at work after
// it stopped keeps the tasks it was opened on in progress. Only after a first read (session.start).
async function refreshStale($: any) {
  const now = await stamp($)
  if (refreshedAt === undefined || now === undefined || now - refreshedAt < POLL) return
  await refreshChildren($)
}

// A start_session call records the task the main loop is on, under the id its result names.
async function recordStart($: any, resultText: string) {
  const id = /local_[0-9a-f-]{36}/.exec(resultText)?.[0]
  if (!id) return
  const { value = [] } = await $.state.get(groupsState)
  const { anchor } = current((value as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
  await update($, childrenState, cur => {
    const list = cur ?? []
    if (list.some(c => c.id === id)) return list.map(c => (c.id === id ? { ...c, anchor: c.anchor ?? anchor } : c))
    return [...list, { id, name: '', title: 'Sessão iniciando…', running: true, archived: false, starting: true, anchor: anchor ?? keptLink(id)?.anchor }]
  })
  await refreshChildren($)
}

// Once per session whose turn ended: a reminder for the main loop, while the task it opened
// that session on is still open, to read its report and close what the delegated work finished.
async function endedNote($: any): Promise<string | undefined> {
  const { value: ids = [] } = await $.state.get(endedState)
  if (ids.length === 0) return undefined
  await $.state.set(endedState, [])
  const { value: kids = [] } = await $.state.get(childrenState)
  const { value: groups = [] } = await $.state.get(groupsState)
  const tasks = (groups as Group[]).find(g => g.agent === MAIN)?.tasks ?? []
  const open = flat(tasks).filter(t => t.status === 'open')
  const lines = (kids as Child[])
    .filter(c => ids.includes(c.id))
    .map(c => ({ c, t: open.find(t => t.id === c.anchor) }))
    .filter(x => x.t !== undefined)
    .map(x => `"${x.c.name || x.c.title}" (tarefa de origem "${x.t?.id}" ${x.t?.title})`)
  if (lines.length === 0) return undefined
  return (
    `Painel de tarefas (task-tree): terminou o turno a sessão ${lines.join(', a sessão ')}, e a tarefa de ` +
    'origem continua aberta. Confira o relato e marque com mcp__task-tree__done o que o trabalho delegado ' +
    `concluiu. Tarefas abertas no painel: ${openList(tasks)}.`
  )
}

// The shape of the published file this version writes (`Published.version`). Files from before it
// carry none and are read as they are; a file of another version is ignored.
const PUBLISHED_VERSION = 1
// The published file as read: `ok` the file checked and normalized (the lists are lists, the flags
// flags; what is missing is left out or empty), else `error` says why it is ignored. Pure: the
// readers log the error (once per session and reason, see readPublished).
function parsePublished(text: string): { ok: Published } | { error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    return { error: `JSON inválido (${String((err as any)?.message ?? err).slice(0, 80)})` }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { error: `não é um objeto (${Array.isArray(raw) ? 'lista' : typeof raw})` }
  const f = raw as Record<string, unknown>
  if (f.version !== undefined && f.version !== PUBLISHED_VERSION) return { error: `versão ${String(f.version)}, esta é ${PUBLISHED_VERSION}` }
  const list = <T,>(v: unknown): T[] | undefined => (Array.isArray(v) ? (v as T[]) : undefined)
  const context = f.context as Record<string, unknown> | undefined
  const out: Published = {
    ...(typeof f.version === 'number' ? { version: f.version } : {}),
    waiting: f.waiting === true,
    ...(typeof f.at === 'number' ? { at: f.at } : {}),
    ...(list<TaskNode>(f.tasks) ? { tasks: list<TaskNode>(f.tasks) } : {}),
    ...(list<Group>(f.groups) ? { groups: list<Group>(f.groups) } : {}),
    waits: list<Wait>(f.waits) ?? [],
    children: list<Child>(f.children) ?? [],
    ...(context && typeof context === 'object' && typeof context.percent === 'number' && typeof context.at === 'number' ? { context: { percent: context.percent, at: context.at } } : {}),
    ...(typeof f.engine === 'string' && f.engine !== '' ? { engine: f.engine } : {}),
    ...(typeof f.renderError === 'string' ? { renderError: f.renderError } : {}),
    ...(list<unknown>(f.work) ? { work: (f.work as unknown[]).map(String) } : {}),
    ...(list<{ from: string; at: number }>(f.received) ? { received: list<{ from: string; at: number }>(f.received) } : {}),
    ...(list<Send>(f.sends) ? { sends: list<Send>(f.sends) } : {}),
  }
  return { ok: out }
}
// A session's published file, read and checked; `undefined` when there is none to use (no path,
// unreadable, or invalid: then said once in the debug log, per session and reason, as the poll
// reads it every few seconds).
const badPublished = new Set<string>()
async function readPublished($: any, id: string): Promise<Published | undefined> {
  const path = await waitFile($, id)
  if (!path) return undefined
  let text: string
  try {
    text = await $.fs.read(path)
  } catch {
    return undefined
  }
  const parsed = parsePublished(text)
  if ('ok' in parsed) {
    for (const k of badPublished) if (k.startsWith(`${id}|`)) badPublished.delete(k)
    return parsed.ok
  }
  const key = `${id}|${parsed.error}`
  if (!badPublished.has(key)) {
    badPublished.add(key)
    await debug($, `task-tree: arquivo publicado de ${id} ignorado: ${parsed.error}`)
  }
  return undefined
}

// Where a session says whether it waits on the person, read by the session that opened it.
async function waitFile($: any, id: string): Promise<string | undefined> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  return home ? `${home}/.claude/task-tree-waits/${id}.json` : undefined
}

// This session's id as the desktop app names it (local_…); none outside the app.
let ownId: string | undefined
async function selfId($: any): Promise<string | undefined> {
  if (ownId) return ownId
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })
    const body = r.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('')
    if (!r.isError) ownId = JSON.parse(body).sessionId
    else await debug($, `task-tree: get_session falhou: ${body.slice(0, 300)}`)
  } catch (err) {
    await debug($, `task-tree: get_session falhou: ${String(err)}`)
  }
  return ownId
}

// Publishes whether anything in this session waits on the person, and its whole panel
// (groups, waits, the sessions it opened), for the session that opened it to draw under the
// task it was opened on, as this session draws it. `tasks` is for earlier versions.
async function publishWait($: any) {
  await ensureGroups($)
  await saveLinks($)
  try {
    const id = await selfId($)
    const path = id ? await waitFile($, id) : undefined
    if (!path) {
      // Outside the desktop app there is no id, and nothing to publish.
      if (id) await debug($, 'task-tree: sem USERPROFILE/HOME, painel não publicado')
      return
    }
    const { value = [] } = await $.state.get(waitsState)
    const { value: groups = [] } = await $.state.get(groupsState)
    const { value: children = [] } = await $.state.get(childrenState)
    const tasks = (groups as Group[]).find(g => g.agent === MAIN)?.tasks ?? []
    // The share of the context window used, for the ring the session that opened this one draws
    // (the default usage call is free; no breakdown).
    let context: { percent: number; at: number } | undefined
    try {
      const percent = (await $.session.usage())?.context?.percent
      if (typeof percent === 'number') context = { percent, at: await $.clock.now() }
    } catch {}
    const { value: work } = await $.state.get(workState)
    const { value: received = [] } = await $.state.get(receivedState)
    const { value: engine } = await $.state.get(engineState)
    // The panes as the app holds them for this session (placed, shown or a tab behind another), for a
    // panel that does not show up (read in this file from outside, or with /task-tree).
    let panes: unknown
    try {
      panes = (await $.ui.panes()).map((p: any) => ({ id: p.id, isPlaced: p.isPlaced, isShown: p.isShown }))
    } catch {}
    await $.fs.write(
      path,
      JSON.stringify({ version: PUBLISHED_VERSION, waiting: value.length > 0, at: await $.clock.now(), tasks, groups, waits: value, children, context, engine, panes, renderError, drawSize, rows: drawRows, work, received, sends: ((await $.state.get(sendsState)).value ?? []).filter((x: Send) => !x.taken) } satisfies Published),
    )
  } catch (err) {
    await debug($, `task-tree: painel não publicado: ${String(err)}`)
  }
}

// A line in the debug log only; a failing log never breaks the session.
// What each of the pane's Buttons does, by its key, as the last drawing made it. The host keeps a
// Button's onPress only for the life of the drawing it is in, and the pane is drawn again every
// second while a task runs (its clock): a press landing as the drawing is replaced reached a
// handler already gone, and nothing happened (the person's words: "as vezes clico nas acoes e nao
// faz nada, preciso clicar algumas vezes para funcionar"). The ui.press hook below answers by key
// with the latest action instead.
// How many requests (message groups) the top panel draws, the latest ones.
const SHOWN_TURNS = 3
// And in a session's card, the last request of that card (its round).
const SHOWN_CARD_TURNS = 3
// The last drawing's size (serialized), and the most a drawing may be before the pane shows only a
// warning line: a 1.3 MB one was not shown by the app (the person's words: "resumir os 57 pedidos
// anteriores resolveu").
let drawSize = 0
const DRAW_LIMIT = 600 * 1024
// The last drawing's lines (after the limit below), published with the size for the session that
// opened this one to see how big its children's panels are.
let drawRows = 0
// The most lines a drawing holds, decided on the rows before any SVG is made: past it, whole blocks
// (a level-0 line and what hangs under it) go from the start, the oldest, and one line counts them;
// the recent ones, where the work is, stay. The size limit above stays as the last resort. Far
// above a real panel (a long session drew 31 lines); the open steps of a huge plan reached it.
const MAX_ROWS = 400
function limitRows(rows: Row[]): Row[] {
  if (rows.length <= MAX_ROWS) return rows
  const room = MAX_ROWS - 1
  const before = (n: number): Row => ({ depth: 0, tone: 'section', title: `+${n} linhas anteriores`, label: 'Linhas anteriores, não desenhadas' })
  const from = rows.findIndex((r, i) => r.depth === 0 && i > 0 && rows.length - i <= room)
  if (from > 0) return [before(from), ...rows.slice(from)]
  // The last block alone is past the limit: what came before it goes whole, and the block is drawn
  // to the limit, the rest counted at its end.
  let last = 0
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i].depth === 0) {
      last = i
      break
    }
  }
  const head = last > 0 ? [before(last)] : []
  const kept = rows.slice(last, last + room - head.length)
  return [...head, ...kept, { depth: 1, tone: 'section', title: `+${rows.length - last - kept.length} linhas`, label: 'Linhas seguintes, não desenhadas' }]
}
// The last drawing's error, if it threw (see the Pane hook), published with the panel.
let renderError: string | undefined
const actions = new Map<string, () => void>()
const act = (key: string, fn: () => void) => {
  actions.set(key, fn)
  return fn
}

// The panel opened with the session (session.start, plan) is opened unasked, and the app places an
// unasked pane only in a window of 144 columns or more (110 once asked): after a restart of the
// session's process (a /model change does one), in a narrower window, it stayed undrawn while the
// tools went on answering (the person's words: "eu troquei o modelo de opus para sonnet na
// orquestradora, e o task tree nao rendenizou a partir dai"). Opened again from the person's own
// prompt, it is asked, and placed at any width; only when it is not on screen already.
async function showPane($: any) {
  try {
    const panes = (await $.ui.panes()) as readonly { id: string; isPlaced?: boolean }[]
    if (panes.some(p => p.id === PANE && p.isPlaced)) return
    const r = await $.ui.open({ id: PANE, title: 'Tarefas' })
    if (!r?.isPlaced) await debug($, `task-tree: painel não aberto: ${String(r?.reason ?? '')}`)
  } catch {}
}

async function debug($: any, text: string) {
  try {
    await $.ui.log(text, { to: 'debug' })
  } catch {}
}

async function addWait($: any, w: Wait) {
  await ensureGroup($, w.agent)
  await update($, waitsState, cur => [...(cur ?? []), w])
  await publishWait($)
}
async function dropWaits($: any, keep: (w: Wait) => boolean) {
  const before = (await $.state.get(waitsState)).value ?? []
  const after = await update($, waitsState, cur => (cur ?? []).filter(keep))
  if (after.length !== before.length) await publishWait($)
}
// The agent's open question or plan dialog, once the agent has gone on without it.
async function dropAsked($: any, agent: string) {
  const asked = (w: Wait) => w.agent === agent && (w.kind === 'question' || w.kind === 'plan')
  const { value = [] } = await $.state.get(waitsState)
  if ((value as Wait[]).some(asked)) await dropWaits($, w => !asked(w))
}

// A press on a line's ▾/▸: the line stays as the person left it (closed or open) until they
// press it again. Written from onPress, since a render may not write.
// The pane's view, chosen with the toggle at its top: kept in the state (a reload) and in the
// store under the session (a resume). Written from onPress, like setFold.
async function setView($: any, view: 'full' | 'summary') {
  await $.state.set(viewState, view)
  try {
    await $.store.set(`view:${await $.session.id()}`, view)
  } catch {}
}
// At the session's start: the view chosen before (a reload, a resume), else the summary, the
// default of a new session.
async function restoreView($: any) {
  if ((await $.state.get(viewState)).value !== undefined) return
  let saved: unknown
  try {
    saved = await $.store.get(`view:${await $.session.id()}`)
  } catch {}
  await $.state.set(viewState, saved === 'full' || saved === 'summary' ? saved : 'summary')
}

// The current work (the summary view's list): the main group's level-1 tasks opened since all was
// last closed. A plan or start that opens tasks with no open leaf left anywhere (here or in a
// session) starts new work; otherwise its level-1 tasks join the current one. Kept in the state
// and in the store under the session, like the view.
async function nothingOpen($: any): Promise<boolean> {
  await ensureGroups($)
  const { value: groups = [] } = await $.state.get(groupsState)
  const { value: children = [] } = await $.state.get(childrenState)
  return activeLeaves({ groups: withMain(groups), waits: [], children }, 0) === 0
}
// New work starts with nothing open and another message of the person: within the turn of the
// current work, a plan after all was closed joins it.
async function startsWork($: any): Promise<boolean> {
  if (!(await nothingOpen($))) return false
  const { value: groups = [] } = await $.state.get(groupsState)
  const main = withMain(groups as Group[]).find(g => g.agent === MAIN)
  const now = main?.turns?.[main.turns.length - 1]?.id
  if (now === undefined) return true
  const { value: work = [] } = await $.state.get(workState)
  return !(main?.tasks ?? []).some(t => (work as string[]).includes(t.id) && t.turn === now)
}
async function setWork($: any, ids: string[]) {
  await $.state.set(workState, ids)
  try {
    await $.store.set(`work:${await $.session.id()}`, ids)
  } catch {}
}
async function joinWork($: any, ids: string[], fresh: boolean) {
  if (ids.length === 0) return
  const { value: cur = [] } = await $.state.get(workState)
  await setWork($, fresh ? [...new Set(ids)] : [...new Set([...(cur as string[]), ...ids])])
}
// What ties the sessions' cards to their tasks (the sessions this one opened, with the tasks and
// rounds of their messages; the sends still waiting; the messages received; the subagents'
// launches) lives in the state, which a reload of the mod empties: kept in the store too, and
// brought back at the start, else the cards fall to the root and the chains lose their origin.
// Whether this module brought them back yet: a reload does not run session.start, so the first
// save brings them back before it writes, and nothing new is lost to the old copy.
let linksLoaded = false
// What the store keeps of a session this one linked to: its ties to the tasks, not its state.
type Link = Pick<Child, 'id' | 'name' | 'title' | 'anchor' | 'lastAnchor' | 'rounds'>
const linkOf = (c: Child): Link => ({ id: c.id, name: c.name, title: c.title, anchor: c.anchor, lastAnchor: c.lastAnchor, rounds: c.rounds })
// The links as the store holds them, by session id, this module's copy. The state's `children` are
// the sessions the host lists (refreshChildren rebuilds them from the list, archived ones included);
// a session the list leaves out for a while is not in the state, so a save from the state alone
// would drop its ties from the store for good. The save keeps those entries, and a session the host
// lists again gets its ties back from here (refreshChildren, recordStart). Nothing is drawn from
// here: a session shows only while the host lists it.
let keptLinks = new Map<string, Link>()
const keptLink = (id: string): Link | undefined => keptLinks.get(id)
async function saveLinks($: any) {
  if (!linksLoaded) await restoreLinks($)
  try {
    const { value: children } = await $.state.get(childrenState)
    const { value: sends } = await $.state.get(sendsState)
    const { value: received } = await $.state.get(receivedState)
    const { value: launches } = await $.state.get(launchesState)
    const listed = ((children as Child[] | undefined) ?? []).map(linkOf)
    const links = [...listed, ...[...keptLinks.values()].filter(k => !listed.some(c => c.id === k.id))]
    await $.store.set(`links:${await $.session.id()}`, { children: links, sends, received, launches })
    keptLinks = new Map(links.map(l => [l.id, l]))
  } catch {}
}
// Merged into what the state may already hold (the host's list read before): a session keeps its
// fields and gets back the anchors and rounds; the lists get back the entries they lack.
async function restoreLinks($: any) {
  linksLoaded = true
  try {
    const saved = (await $.store.get(`links:${await $.session.id()}`)) as Record<string, unknown> | undefined
    if (saved === undefined || saved === null || typeof saved !== 'object') return
    const list = (k: string) => (Array.isArray(saved[k]) ? (saved[k] as any[]) : [])
    const join = (cur: any[] | undefined, old: any[]) => {
      const now = cur ?? []
      const seen = new Set(now.map(x => JSON.stringify(x)))
      return [...old.filter(x => !seen.has(JSON.stringify(x))), ...now]
    }
    const old = list('children') as Child[]
    keptLinks = new Map(old.filter(o => typeof o?.id === 'string').map(o => [o.id, linkOf(o)]))
    if (old.length > 0)
      await update($, childrenState, cur =>
        cur === undefined || cur.length === 0
          ? old
          : cur.map(c => {
              const o = old.find(k => k.id === c.id)
              return o ? { ...c, anchor: c.anchor ?? o.anchor, lastAnchor: c.lastAnchor ?? o.lastAnchor, rounds: c.rounds ?? o.rounds } : c
            }),
      )
    if (list('sends').length > 0) await update($, sendsState, cur => join(cur, list('sends')))
    if (list('received').length > 0) await update($, receivedState, cur => join(cur, list('received')).slice(-20))
    if (list('launches').length > 0) await update($, launchesState, cur => join(cur, list('launches')).slice(-20))
  } catch {}
}
async function restoreWork($: any) {
  if ((await $.state.get(workState)).value !== undefined) return
  try {
    const saved = await $.store.get(`work:${await $.session.id()}`)
    if (Array.isArray(saved)) await $.state.set(workState, saved.map(String))
  } catch {}
}
// A session's panel cut to its current work, for the summary view: its main level-1 tasks of the
// work (all those of the turns they are in), the subagents and sessions under them or still at
// work, and the same cut on those sessions. With no work published (earlier versions), the last
// turn that has tasks; with no turns either, the last open level-1 task, else the last one.
function trimToWork(p: Panel, level: number): Panel {
  const groups = withMain(p.groups ?? [])
  const main = groups.find(g => g.agent === MAIN) as Group
  let work = p.work ?? []
  if (work.length === 0) {
    const last = [...(main.turns ?? [])].reverse().find(u => main.tasks.some(t => t.turn === u.id))
    const lone = [...main.tasks].reverse().find(t => t.status === 'open') ?? main.tasks[main.tasks.length - 1]
    work = last ? main.tasks.filter(t => t.turn === last.id).map(t => t.id) : lone ? [lone.id] : []
  }
  const turnsIn = main.tasks.filter(t => work.includes(t.id)).flatMap(t => (t.turn === undefined ? [] : [t.turn]))
  const keep = main.tasks.filter(t => work.includes(t.id) || (t.turn !== undefined && turnsIn.includes(t.turn)))
  const ids = flat(keep).map(t => t.id)
  const under = (anchor?: string) => anchor !== undefined && ids.includes(anchor)
  return {
    ...p,
    groups: groups
      .map(g => (g.agent === MAIN ? { ...g, tasks: keep, turns: (g.turns ?? []).filter(u => keep.some(t => t.turn === u.id)) } : g))
      .filter(g => g.agent === MAIN || under(g.anchor) || hasOpen(g.tasks)),
    children:
      level >= DEEP
        ? (p.children ?? [])
        : (p.children ?? [])
            .filter(c => under(c.anchor) || live(c))
            .map(c => ({ ...c, panel: trimToWork(panelOf(c), level + 1), tasks: undefined })),
  }
}

async function setFold($: any, key: string, closed: boolean) {
  await update($, folds, cur => ({ ...cur, [key]: closed }))
}

// The pane's 1 s clock: it redraws the times while a task runs, here or in a session this one
// opened, and stops when none does. Started again by the next start, refresh or tool call.
let ticker: { cancel: () => void } | undefined
// The linked sessions read again every few seconds, so a session's card shows what its own pane
// shows. Started at session.start and again from the main loop's calls and prompts: a reload of
// the mod cancels the old module's timers, and the cards would stay as they were.
const POLL = 3000
let poller: { cancel: () => void } | undefined
function watchSessions($: any) {
  if (poller) return
  try {
    // A failure must not end the interval: the sessions would stay drawn as they were.
    poller = $.clock.every(POLL, () => refreshChildren($).catch(() => {}))
  } catch {}
}
function running(p: Panel, level = 0): boolean {
  if (timing(tasksOf(p.groups ?? []))) return true
  // A session at work keeps the task it was opened on running (see atWork).
  return level < DEEP && (p.children ?? []).some(live)
}
async function anyRunning($: any): Promise<boolean> {
  const { value: groups = [] } = await $.state.get(groupsState)
  const { value: children = [] } = await $.state.get(childrenState)
  return running({ groups, waits: [], children })
}
async function tick($: any) {
  if (await anyRunning($)) {
    try {
      $.ui.invalidate('ui.render')
    } catch {}
    return
  }
  ticker?.cancel()
  ticker = undefined
}
async function keepTime($: any) {
  if (ticker || !(await anyRunning($)) || (await stamp($)) === undefined) return
  try {
    ticker = $.clock.every(1000, () => void tick($))
  } catch {}
}

// The panel as drawn: one line per task, notice, session or subagent, with its depth in
// the tree. The desktop draws each line as an Svg, the terminal as a Text.
type Tone = 'open' | 'current' | 'done' | 'interrupted' | 'wait' | 'running' | 'archived' | 'agent' | 'section' | 'sent' | 'paused' | 'reply'
type Row = {
  depth: number
  tone: Tone
  title: string
  // The whole text for the tooltip, when the title is a short form of it (the ↩ line's summary).
  whole?: string
  // Said only in the alt, after the title: a session's title, its card showing just its name.
  hint?: string
  // What the alt text says first ("Em andamento"); empty for a notice.
  label: string
  strong?: boolean
  // Right-aligned: done/total (with a mini bar on a task: `bar`), a word after it, and the time
  // the task (or the session's, the subagent's tasks) took or is taking, in ms.
  sub?: [number, number]
  bar?: boolean
  meta?: string
  // null: a closed task whose time is unknown (panels of earlier versions), drawn as "—".
  time?: number | null
  // A session's or subagent's header: it and the lines below it are drawn in a card.
  card?: boolean
  // For the header's chips: a task in progress with nothing open below it; a session at work;
  // a session waiting with no notice of its own drawn.
  active?: boolean
  live?: boolean
  pending?: boolean
  // A line with something below it opens and closes (▾/▸): `key` names it in `folds`, `open`
  // says whether what is below is drawn.
  fold?: { key: string; open: boolean }
  // A session's card: its icon is the branch in every state (the tone colors it).
  session?: boolean
  // A task (or turn) with a session opened on it or below it: a small branch beside it,
  // drawn even while the task is closed.
  kids?: boolean
  // The context ring of a session: on its card, and on the highest line above it (its turn, else
  // its level-1 task) with the largest share among the sessions there.
  ring?: Ring
  // A session's card: its id, for the ring's button that opens the session (see ringOver).
  sid?: string
  // The tasks the line stands for in the header's count and time: a leaf's own; a folded line's
  // whole subtree (its sessions' tasks too); none for an open parent (its lines below stand for
  // theirs) or a line that is not a task. The header sums the drawn lines' nodes, so each view's
  // header says what that view shows (the person's words: "cada visao deve refletir os dados do
  // seu tipo de vizualizacao").
  nodes?: TaskNode[]
  // A session's card: its model and effort ("Opus 5.5 · high"), drawn left of the ring.
  engine?: string
}

// The tree lines of a row: `bars[k]` continues the line of the ancestor at depth k past it,
// `last` ends its own branch here, `down` starts a line to the rows below it.
type Guide = { bars: boolean[]; last: boolean; down: boolean }
function guides(rows: Row[]): Guide[] {
  // Whether a row at `level` comes later, before the tree climbs above it.
  const later = (i: number, level: number) => {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].depth < level) return false
      if (rows[j].depth === level) return true
    }
    return false
  }
  return rows.map((r, i) => ({
    bars: Array.from({ length: Math.max(0, r.depth - 1) }, (_, k) => later(i, k + 1)),
    last: !later(i, r.depth),
    down: (rows[i + 1]?.depth ?? -1) > r.depth,
  }))
}

// Terminal: glyph and theme color of each tone; the guides as box-drawing text.
const GLYPH: Record<Tone, [string, string]> = {
  open: ['○', 'inactive'],
  current: ['◉', 'warning'],
  done: ['✓', 'success'],
  interrupted: ['✕', 'inactive'],
  wait: ['◷', 'warning'],
  running: ['⑂', 'inactive'],
  archived: ['✕', 'inactive'],
  agent: ['▸', 'text'],
  section: ['', 'inactive'],
  // A task waiting for another session to take up a message sent from it (see watchSends).
  sent: ['✉', 'permission'],
  // What a session answered when a turn ended (its card's last line for that turn): not a task.
  reply: ['↩', 'inactive'],
  // A parent open with part of it done and nothing below in progress: waiting to go on.
  paused: ['◷', 'warning'],
}
// Two columns at the left for the ▾/▸ of the level-1 lines; deeper, the ▾/▸ goes after the
// branch, so the guides below a line that has one move two columns right.
// No ▾/▸ column: a level-1 line starts at its icon; deeper, the guides of the ancestors and the
// branch, three columns each.
// Inside a session's card (`hide`, its label's depth) the label's column is left out: the card's
// roots start under the label, with no branch to it, and the label has none to its task (the
// siblings' line passes by).
const prefix = (r: Row, g: Guide, hide: number[] = []) =>
  r.depth === 0
    ? ''
    : g.bars.map((on, k) => (hide.includes(k) ? '' : on ? '│  ' : '   ')).join('') +
      (hide.includes(r.depth - 1) ? '' : r.session ? (g.last ? '   ' : '│  ') : g.last ? '└─ ' : '├─ ')
const ratioBar = (d: number, n: number, cells: number) => {
  const k = n > 0 ? Math.round((d / n) * cells) : 0
  return ['█'.repeat(k), '░'.repeat(cells - k)]
}

const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
const percent = (d: number, n: number) => (n > 0 ? Math.round((d / n) * 100) : 0)

// Desktop: each SVG is an image that does not follow the app's theme, so it carries its
// own colors for light and dark.
const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif"
// `svg,text{cursor:default}`: in an interactive Svg (a cut name with its tooltip) the pointer stays
// the arrow over the text, not the text cursor.
// Each line is its own Svg, so each carries the rules it uses and no others: the whole sheet in
// every one came to 1 KB a line, 1.6 MB a drawing on a panel of some 700 lines (the orchestrator's),
// sent again every second, and the app stopped drawing the pane (the person's words: "o tasktree nao
// esta aparecendo na orquestradora").
const LIGHT: [string, string][] = [
  ['p', 'fill:#2c2c2a'], ['s', 'fill:#5f5e5a'], ['am', 'stroke:#ba7517'], ['amf', 'fill:#ba7517'], ['gr', 'stroke:#639922'],
  ['grf', 'fill:#639922'], ['gy', 'stroke:#888780'], ['gyf', 'fill:#888780'], ['g', 'stroke:#888780;stroke-opacity:.55'],
  ['tr', 'fill:#888780;fill-opacity:.25'], ['ln', 'stroke:#888780;stroke-opacity:.45'], ['cd', 'fill:#f1efe8'], ['cs', 'stroke:#b4b2a9'],
  ['bl', 'stroke:#378add'], ['rd', 'stroke:#e24b4a'], ['tk', 'stroke:#888780;stroke-opacity:.3'],
]
const DARK: [string, string][] = [
  ['p', 'fill:#e8e6dc'], ['s', 'fill:#b4b2a9'], ['am', 'stroke:#ef9f27'], ['amf', 'fill:#ef9f27'], ['gr', 'stroke:#97c459'], ['grf', 'fill:#97c459'],
  ['gy', 'stroke:#9c9a92'], ['gyf', 'fill:#9c9a92'], ['cd', 'fill:#444441'], ['cs', 'stroke:#888780'], ['bl', 'stroke:#85b7eb'], ['rd', 'stroke:#f09595'],
]
const STYLE = '<style data-slim></style>'
// The sheet of one Svg: its classes' rules, light and dark.
function slim(svg: string): string {
  const used = new Set([...svg.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(' ')))
  const rules = (list: [string, string][]) => list.filter(([c]) => used.has(c)).map(([c, d]) => `.${c}{${d}}`).join('')
  const dark = rules(DARK)
  return svg.replace(STYLE, `<style>svg,text{cursor:default;user-select:none}${rules(LIGHT)}${dark ? `@media (prefers-color-scheme: dark){${dark}}` : ''}</style>`)
}

const xml = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// SVG text neither wraps nor clips: a rough width of system UI text, in px, to cut titles
// with "…" before they run into what is on the right. Wide scripts and emoji take ~1em.
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿가-힣豈-﫿！-｠\u{1f300}-\u{1faff}]/u
const em = (ch: string) =>
  WIDE.test(ch) ? 1 : /[\s.,:;'!|il1()[\]ftrj]/.test(ch) ? 0.32 : /[A-ZMWmw@%]/.test(ch) ? 0.7 : 0.56
const textW = (s: string, size: number) => Array.from(s).reduce((w, ch) => w + em(ch) * size, 0)
// A name cut with … carries the whole one in a `<title>`: the tooltip under the mouse, drawn
// only by an interactive Svg (`hovers`), so the pane need not be widened to read it.
const tip = (whole: string, shown: string) => (shown === whole ? '' : `<title>${xml(whole)}</title>`)
const hovers = (source: string) => source.includes('<title>')
// The tooltip goes in a layer of its own over the line: a transparent interactive Svg holding only
// the whole name, whose source does not change with the clock. The line itself stays an image: an
// interactive Svg is a frame, reloaded (drawn blank for an instant) every time its source changes,
// and a line with a running time changes every second.
function hoverLayer(source: string, w: number, h: number): string {
  const whole = /<title>([^<]*)<\/title>/.exec(source)?.[1] ?? ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    '<style>svg,rect{cursor:default}</style>' +
    `<rect width="${w}" height="${h}" fill="transparent" pointer-events="all"><title>${whole}</title></rect></svg>`
  )
}
function fit(s: string, size: number, max: number): string {
  if (textW(s, size) <= max) return s
  let out = ''
  for (const ch of Array.from(s)) {
    if (textW(out + ch + '…', size) > max) break
    out += ch
  }
  return out.trimEnd() + '…'
}

// A session's context ring, 14 px across, centered on (x, y): a gray track, an arc from the top,
// clockwise, as long as the share used (blue, amber from 70%, red from 85%); nothing inside.
const ringClass = (p: number) => (p >= 85 ? 'rd' : p >= 70 ? 'am' : 'bl')
function contextRing(percent: number, x: number, y: number): string {
  const r = 5.5
  const len = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, percent))
  const arc = (len * p) / 100
  return (
    `<circle class="tk" cx="${x}" cy="${y}" r="${r}" fill="none" stroke-width="2"/>` +
    (arc > 0
      ? `<circle class="${ringClass(p)}" cx="${x}" cy="${y}" r="${r}" fill="none" stroke-width="2" stroke-linecap="round" ` +
        `stroke-dasharray="${arc.toFixed(2)} ${len.toFixed(2)}" transform="rotate(-90 ${x} ${y})"/>`
      : '')
  )
}
const ringTerm = (p: number) => (p >= 85 ? 'error' : p >= 70 ? 'warning' : 'permission')

// The branch of a session, 14 px across, centered on (x, y), in the stroke class `cls`.
function branch(x: number, y: number, cls: string): string {
  return (
    `<g class="${cls}" fill="none" stroke-width="1.3"><circle cx="${x - 3}" cy="${y - 5}" r="1.8"/>` +
    `<circle cx="${x - 3}" cy="${y + 5}" r="1.8"/><circle cx="${x + 4}" cy="${y - 3}" r="1.8"/>` +
    `<path d="M${x - 3} ${y - 3.2}V${y + 3.2}M${x + 4} ${y - 1.2}C${x + 4} ${y + 2} ${x - 3} ${y + 1} ${x - 3} ${y + 3.2}"/></g>`
  )
}
// Every line keeps its progress icon; a session's card, and a task or turn with a session
// below it, add the branch beside it. A card's progress: in progress while it runs or waits.
const PROGRESS: Partial<Record<Tone, Tone>> = { running: 'current', wait: 'current' }
const progress = (r: Row): Tone => (r.session ? (PROGRESS[r.tone] ?? r.tone) : r.tone)

// One icon, 14 px across, centered on (x, y).
function icon(tone: Tone, x: number, y: number): string {
  switch (tone) {
    case 'current':
      return `<circle class="am" cx="${x}" cy="${y}" r="5.5" fill="none" stroke-width="2"/><circle class="amf" cx="${x}" cy="${y}" r="2.2"/>`
    case 'done':
      return `<path class="gr" d="M${x - 4.5} ${y}l3 3.5l6 -7" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'interrupted':
    case 'archived':
      return `<path class="gy" d="M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7" stroke-width="1.6" stroke-linecap="round"/>`
    case 'wait':
    case 'paused':
      return `<circle class="am" cx="${x}" cy="${y}" r="5.5" fill="none" stroke-width="1.5"/><path class="am" d="M${x} ${y - 3}V${y}H${x + 2.5}" fill="none" stroke-width="1.2" stroke-linecap="round"/>`
    case 'running':
      return branch(x, y, 'gy')
    case 'agent':
      return `<path class="gyf" d="M${x - 2.5} ${y - 4}L${x + 3} ${y}L${x - 2.5} ${y + 4}Z"/>`
    case 'sent':
      return (
        `<g class="bl" fill="none" stroke-width="1.4" stroke-linejoin="round"><rect x="${x - 6}" y="${y - 4.5}" width="12" height="9" rx="1.5"/>` +
        `<path d="M${x - 6} ${y - 3.5}L${x} ${y + 1}L${x + 6} ${y - 3.5}"/></g>`
      )
    case 'reply':
      return `<path class="gy" d="M${x + 4.5} ${y - 4}V${y - 1}Q${x + 4.5} ${y + 2.5} ${x + 1} ${y + 2.5}H${x - 4.5}M${x - 1.5} ${y - 0.5}L${x - 4.5} ${y + 2.5}L${x - 1.5} ${y + 5.5}" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'section':
      return ''
    default:
      return `<circle class="gy" cx="${x}" cy="${y}" r="5" fill="none" stroke-width="1.5"/>`
  }
}

// A session's label: its name alone, small and dim, naming the card (no progress icon, bar, count
// or time); beside it the branch, the context ring and its state in a word, as a label's tags.
// Folded by the person: " ⋯" after the name.
// The label's name as drawn: fitted between its start and its tags.
function labelName(r: Row, W: number, depth: number, inner: number): { name: string; whole: string; tx: number } {
  const R = textRight(W, inner)
  const tx = col(depth) + TEXT_IN
  const whole = r.fold && !r.fold.open ? `${r.title} ⋯` : r.title
  const tags = (r.ring ? 26 : 0) + (r.meta ? textW(r.meta, 11) + 8 : 0)
  return { name: fit(whole, 12, Math.max(24, R - tx - tags)), whole, tx }
}
function labelSvg(r: Row, f: Frame, W: number, H: number, cy: number, x: number, cards: { L: number; Rc: number; svg: string }[], paths: string[]): string {
  const { name, whole, tx } = labelName(r, W, r.depth, Math.max(0, cards.length - 1))
  // The ⑂ left of the name, where a task's icon is (it folds the card, see foldOver); the state
  // word after the name; the context ring on its own at the card's right end, in the column the
  // lines below end their time in (the person's words: "deve estar solto e na direita da mesma linha").
  const parts: string[] = [branch(x, cy, 'gy')]
  const at = tx + textW(name, 12) + 10
  if (r.ring) {
    const R = (cards.length > 0 ? cards[cards.length - 1].Rc : W) - EDGE_PAD
    // Drawn at the middle of its Button's Box (ringOver: overlay 'ring', whole cells, the line's
    // whole height), so the highlight has the same room on all four sides (the person's words:
    // "quase, ainda esta desalinhado"): up to half a cell off its column, and on a card's first or
    // last line up to half the card's edge off the name's middle.
    const ring = contextRing(r.ring.percent, W - ringFromRight(Math.max(0, cards.length - 1)), H / 2)
    parts.push(r.ring.faded ? `<g opacity=".45">${ring}</g>` : ring)
  }
  // The model and effort, dim, ending just left of the ring (else at the card's right edge); left
  // out when it would run into the name.
  if (r.engine) {
    const end = r.ring ? W - ringFromRight(Math.max(0, cards.length - 1)) - RING_D / 2 - RING_GAP : (cards.length > 0 ? cards[cards.length - 1].Rc : W) - 10
    if (end - textW(r.engine, 11) > at + (r.meta ? textW(r.meta, 11) + 8 : 0))
      parts.push(`<text class="s" x="${end}" y="${cy + 4}" font-size="11" text-anchor="end" opacity=".75">${xml(r.engine)}</text>`)
  }
  // Waiting on the person: the word in amber (the label has no icon to color).
  if (r.meta) {
    const waiting = r.meta === 'aguardando'
    parts.push(`<text class="${waiting ? 'amf' : 's'}" x="${at}" y="${cy + 4}" font-size="11"${waiting ? '' : ' opacity=".75"'}>${xml(r.meta)}</text>`)
  }
  return slim(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${STYLE}` +
    cards.map(c => c.svg).join('') +
    (paths.length > 0 ? `<path class="g" d="${paths.join('')}" fill="none" stroke-width="1"/>` : '') +
    `<text class="s" x="${tx}" y="${cy + 4}" font-size="12" font-weight="600">${tip(whole, name)}${xml(name)}</text>` +
    parts.join('') +
    '</svg>'
  )
}

// The ring's Button's label is an em space, so the native highlight (the label's width plus the
// button's padding) covers the whole ring, not the corner a one-space label made (the person's
// words: "o mouse over do anel de contexto continua pequeno, nao envolvendo o icone todo"). Where
// the Box goes, in cells, is the geometry module's (overlay 'ring').
const RING_LABEL = ' '

// Opens a session in this window's main pane, as a click on its sidebar row (the app's
// open_session_in, which takes this session or one it started); a refusal goes to a toast.
async function openSession($: any, id: string, name: string) {
  try {
    const r = await $.mcp.call('ccd_window', 'open_session_in', { session_id: id, target: 'focus' })
    const said = (r?.content ?? []).map((c: any) => c?.text ?? '').join(' ').trim()
    if (r?.isError) await $.ui.toast(`Não abriu ${name}: ${said || 'recusado pelo app'}`)
  } catch (err) {
    await $.ui.toast(`Não abriu ${name}: ${String(err).slice(0, 120)}`)
  }
}

// A session's model and effort in a few words, as its card shows them left of the ring: the model's
// readable name ("claude-opus-5-5" → "Opus 5.5", "claude-sonnet-5-5[1m]" → "Sonnet 5.5") and the
// effort level ("Opus 5.5 · high"); a name it cannot read stays as given, cut short.
function engineText(model: string, effort?: string | number): string {
  const id = model.replace(/\[[^\]]*\]$/, '').replace(/-\d{8}$/, '')
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id)
  const name = m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] !== undefined ? `.${m[3]}` : ''}` : id.slice(0, 24)
  return effort === undefined || effort === '' ? name : `${name} · ${effort}`
}

// A session that has not published its model yet (no model request since it got this version):
// the app's own record of it (get_session's model and effort), kept a minute per session, so the
// 3 s reread does not ask the app each time.
const engineSeen = new Map<string, { at: number; text?: string }>()
async function engineOf($: any, id: string): Promise<string | undefined> {
  const now = Date.now()
  const hit = engineSeen.get(id)
  if (hit && now - hit.at < 60000) return hit.text
  let text: string | undefined
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: id })
    const body = JSON.parse((r?.content ?? []).map((c: any) => c?.text ?? '').join(''))
    if (!r?.isError && typeof body?.model === 'string' && body.model !== '') text = engineText(body.model, typeof body.effort === 'string' ? body.effort : undefined)
  } catch {}
  engineSeen.set(id, { at: now, text })
  return text
}

// The desktop's time column: room for "0:00:00".
const TIME_W = textW('0:00:00', 12)
const COUNT_W = textW('00/00', 12)

// The cards a line is drawn in, outermost first: the card of the header at `depth`, whether it
// starts (`first`) or ends (`last`) on this line. A card takes its header and every line below
// it deeper than it; its edges add `PAD` px above its first line and below its last (the px, and
// where the columns, cards and overlays sit, are the geometry module's: ../draw/geometry).
type Card = { depth: number; first: boolean; last: boolean }
type Frame = { cards: Card[]; top: number; bottom: number }
// A session's card is headed by a label (its name), not a task line: the tasks inside are its
// roots, with no tree line to the label. Per row, the depths of the session labels it is inside:
// their column (col(depth)) is drawn empty.
function labelCols(rows: Row[]): number[][] {
  const open: number[] = []
  return rows.map(r => {
    while (open.length > 0 && open[open.length - 1] >= r.depth) open.pop()
    const mine = open.slice()
    if (r.session) open.push(r.depth)
    return mine
  })
}
function frames(rows: Row[]): Frame[] {
  const open: number[] = []
  return rows.map((r, i) => {
    while (open.length > 0 && open[open.length - 1] >= r.depth) open.pop()
    if (r.card) open.push(r.depth)
    const next = rows[i + 1]
    const cards = open.map(depth => ({
      depth,
      first: r.card === true && depth === r.depth,
      last: next === undefined || next.depth <= depth,
    }))
    return { cards, top: r.card ? PAD : 0, bottom: cards.filter(c => c.last).length * PAD }
  })
}
const NO_FRAME: Frame = { cards: [], top: 0, bottom: 0 }
const rowHeight = (r: Row, f: Frame = NO_FRAME) => (r.depth === 0 && r.tone !== 'wait' ? ROW_H_TOP : ROW_H) + f.top + f.bottom

// One card's slice on a line, from y0 to y1: its fill, then its border (the top edge on its
// first line, the bottom one on its last, the sides on all).
function cardSlice(L: number, R: number, y0: number, y1: number, top: boolean, bottom: boolean): string {
  const r = CARD_RADIUS
  const a = (x: number, y: number) => `A${r} ${r} 0 0 1 ${x} ${y}`
  const yt = top ? y0 + r : y0
  const yb = bottom ? y1 - r : y1
  const fill =
    `M${L} ${yt}` +
    (top ? `${a(L + r, y0)}H${R - r}${a(R, yt)}` : `H${R}`) +
    `V${yb}` +
    (bottom ? `${a(R - r, y1)}H${L + r}${a(L, yb)}` : `H${L}`) +
    'Z'
  const edge =
    `M${L} ${yb}V${yt}` +
    (top ? `${a(L + r, y0)}H${R - r}${a(R, yt)}` : `M${R} ${y0}`) +
    `V${yb}` +
    (bottom ? `${a(R - r, y1)}H${L + r}${a(L, yb)}` : '')
  return `<path class="cd" d="${fill}"/><path class="cs" d="${edge}" fill="none" stroke-width="1"/>`
}

function rowSvg(r: Row, g: Guide, f: Frame, W: number, hide: number[] = []): string {
  const H = rowHeight(r, f)
  const cy = f.top + rowHeight(r) / 2
  const x = col(r.depth)
  // The cards: each nested one 6 px inside the one around it on the right; the text on the
  // right keeps inside the innermost.
  const ends = f.cards.filter(c => c.last)
  const cards = f.cards.map((c, m) => {
    const L = col(c.depth) - CARD_IN
    const Rc = cardRight(W, m)
    const y0 = c.first ? f.top - CARD_EDGE : 0
    const y1 = c.last ? H - f.bottom + CARD_EDGE + PAD * (ends.length - 1 - ends.indexOf(c)) : H
    return { L, Rc, svg: cardSlice(L, Rc, y0, y1, c.first, c.last) }
  })
  const paths: string[] = g.bars.flatMap((on, k) => (on && !hide.includes(k) ? [`M${col(k)} 0V${H}`] : []))
  // A session's label: the branch from its task comes into the card, ending at its left edge at the
  // label's height (the person's words: "conecte ela no painel"); the roots of the card have no
  // branch to the label.
  if (r.depth > 0 && !hide.includes(r.depth - 1)) {
    paths.push(`M${col(r.depth - 1)} 0V${g.last ? cy : H}M${col(r.depth - 1)} ${cy}H${r.card ? x - CARD_IN : x - BRANCH_GAP}`)
  }
  if (g.down && !r.session) paths.push(`M${x} ${cy + GUIDE_FROM}V${H}`)
  if (r.session) return labelSvg(r, f, W, H, cy, x, cards, paths)
  const right: string[] = []
  const R = (cards.length > 0 ? cards[cards.length - 1].Rc : W) - EDGE_PAD
  const section = r.tone === 'section'
  const size = section ? 13 : r.depth === 0 && r.tone !== 'wait' ? 14 : 13
  const forked = r.session === true || r.kids === true
  // Task, turn and card lines are drawn in columns from the right, the same on every one of them,
  // open or closed: the time, the count, the bar and, left of the bar, the branch of a line with a
  // session (a card, or a task or turn with one below it), its column kept empty on the others. A
  // word of state ("concluída", "interrompida") goes left of it. The progress icon stays at the
  // left, after the guides, then the title.
  const tabular = r.bar === true || r.card === true
  let edge = R
  let mark = ''
  if (tabular) {
    const t = typeof r.time === 'number' ? clockText(r.time) : r.time === null ? '—' : ''
    if (t) right.push(`<text class="s" x="${R}" y="${cy + 4}" font-size="12" text-anchor="end" font-variant-numeric="tabular-nums">${t}</text>`)
    const countX = R - TIME_W - RIGHT_GAP
    if (r.sub) {
      const quiet = r.tone === 'interrupted' || r.tone === 'archived'
      right.push(
        `<text class="s" x="${countX}" y="${cy + 4}" font-size="12" text-anchor="end" font-variant-numeric="tabular-nums"${quiet ? ' opacity=".75"' : ''}>${r.sub[0]}/${r.sub[1]}</text>`,
      )
    }
    const bx = countX - COUNT_W - BAR_GAP - BAR_W
    if (r.sub) {
      const [d, n] = r.sub
      right.push(
        `<rect class="tr" x="${bx}" y="${cy - 2}" width="${BAR_W}" height="4" rx="2"/>`,
        n > 0 && d > 0 ? `<rect class="grf" x="${bx}" y="${cy - 2}" width="${Math.max(4, (BAR_W * d) / n)}" height="4" rx="2"/>` : '',
      )
    }
    const ix = bx - BRANCH_IN
    if (forked) mark = branch(ix, cy, 'gy')
    edge = ix - RIGHT_GAP
    if (r.meta) {
      right.push(`<text class="s" x="${edge}" y="${cy + 4}" font-size="12" text-anchor="end" opacity=".75">${xml(r.meta)}</text>`)
      edge -= textW(r.meta, 12) + 8
    }
  } else {
    const t = typeof r.time === 'number' ? clockText(r.time) : ''
    if (t) right.push(`<text class="s" x="${R}" y="${cy + 4}" font-size="12" text-anchor="end" font-variant-numeric="tabular-nums">${t}</text>`)
    if (t) edge = R - textW(t, 12) - RIGHT_GAP
    const words = rightText(r)
    if (words) {
      right.push(`<text class="s" x="${edge}" y="${cy + 4}" font-size="12" text-anchor="end" opacity=".75">${xml(words)}</text>`)
      edge -= textW(words, 12)
    }
  }
  const lead = section ? '' : icon(progress(r), x, cy)
  const tx = section ? x - SECTION_TEXT_OUT : x + TEXT_IN
  // Folded by the person: " ⋯" after the name (the ▸ is gone; the icon itself folds and opens).
  const whole = r.fold && !r.fold.open ? `${r.title} ⋯` : r.title
  const title = fit(whole, size, Math.max(24, edge - 10 - tx))
  const quiet = r.tone === 'done' || r.tone === 'interrupted' || r.tone === 'archived' || r.tone === 'wait' || r.tone === 'reply' || section
  const look = `class="${quiet ? 's' : 'p'}"${r.strong ? ' font-weight="600"' : ''}${r.tone === 'interrupted' || r.tone === 'archived' ? ' opacity=".7"' : ''}`
  return slim(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${STYLE}` +
    cards.map(c => c.svg).join('') +
    (paths.length > 0 ? `<path class="g" d="${paths.join('')}" fill="none" stroke-width="1"/>` : '') +
    (section ? `<path class="ln" d="M0 0.5H${R}" stroke-width="1"/>` : '') +
    lead +
    `<text ${look} x="${tx}" y="${cy + 4.5}" font-size="${size}">${tip(r.whole ?? whole, title)}${xml(title)}</text>` +
    mark +
    right.join('') +
    '</svg>'
  )
}

// The header's chips: only those above zero, in this order.
type Chip = { tone: Tone; text: string }
function chips(active: number, waiting: number, cut: number, live: number, sent = 0): Chip[] {
  const list: Chip[] = []
  if (active > 0) list.push({ tone: 'current', text: `${active} em andamento` })
  if (waiting > 0) list.push({ tone: 'wait', text: `${waiting} aguardando` })
  if (sent > 0) list.push({ tone: 'sent', text: `${sent} aguardando sessão` })
  if (cut > 0) list.push({ tone: 'interrupted', text: plural(cut, 'interrompida', 'interrompidas') })
  if (live > 0) list.push({ tone: 'running', text: plural(live, 'sessão ativa', 'sessões ativas') })
  return list
}

// The header: the title alone on the first line (its right end is left to the view icons, drawn
// over it), the count and time below it, the bar, then the chips.
function headerSvg(title: string, d: number, n: number, list: Chip[], W: number, time?: number): { source: string; height: number } {
  const L = HEADER_PAD
  const R = W - HEADER_PAD
  const empty = n === 0 && list.length === 0
  const H = empty ? HEADER_H_EMPTY : list.length > 0 ? HEADER_H_CHIPS : HEADER_H
  const parts: string[] = []
  if (empty) {
    parts.push(`<text class="p" x="${L}" y="18" font-size="14" font-weight="600">Tarefas</text>`)
    parts.push(`<text class="s" x="${L}" y="34" font-size="12">Nenhuma tarefa planejada.</text>`)
  } else {
    const score = `${d} de ${n} · ${percent(d, n)}%` + (time !== undefined ? ` · ${clockText(time)}` : '')
    const name = fit(title, 14, Math.max(40, R - ICONS_W - L))
    parts.push(`<text class="p" x="${L}" y="18" font-size="14" font-weight="600">${tip(title, name)}${xml(name)}</text>`)
    parts.push(`<text class="s" x="${L}" y="36" font-size="12" font-variant-numeric="tabular-nums">${score}</text>`)
    parts.push(`<rect class="tr" x="${L}" y="46" width="${R - L}" height="4" rx="2"/>`)
    if (n > 0 && d > 0) parts.push(`<rect class="grf" x="${L}" y="46" width="${Math.max(4, ((R - L) * d) / n)}" height="4" rx="2"/>`)
    // Too narrow for the words: the numbers alone, after their icons.
    const wide = list.reduce((w, c) => w + 32 + textW(c.text, 12), -16) <= R - L
    let cx = L
    for (const chip of list) {
      const c = wide ? chip : { ...chip, text: chip.text.split(' ')[0] }
      const w = 16 + textW(c.text, 12)
      if (cx + w > R) break
      parts.push(
        c.tone === 'current'
          ? `<circle class="amf" cx="${cx + 5}" cy="68" r="4"/>`
          : icon(c.tone, cx + 5, 68),
      )
      parts.push(`<text class="s" x="${cx + 15}" y="72" font-size="12">${xml(c.text)}</text>`)
      cx += w + 16
    }
  }
  parts.push(`<path class="ln" d="M${L} ${H - 0.5}H${R}" stroke-width="1"/>`)
  return {
    source: slim(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${STYLE}${parts.join('')}</svg>`),
    height: H,
  }
}

const rowAlt = (r: Row) =>
  (r.label ? `${r.label}: ` : '') +
  r.title +
  (r.hint ? ` (${r.hint})` : '') +
  (r.sub ? `, ${r.sub[0]} de ${r.sub[1]}` : '') +
  (r.meta ? `, ${r.meta}` : '') +
  (typeof r.time === 'number' ? `, ${clockText(r.time)}` : '') +
  (r.kids ? ', com sessão filha' : '') +
  (r.engine ? `, ${r.engine}` : '') +
  (r.ring ? `, contexto da sessão ${r.ring.name}: ${r.ring.percent}%` : '') +
  (r.fold && !r.fold.open ? ', recolhida' : '')
// The right-hand words: "3/5", "1/2 · concluída", "interrompida".
const rightText = (r: Row) => [r.sub ? `${r.sub[0]}/${r.sub[1]}` : '', r.meta ?? ''].filter(Boolean).join(' · ')

export const register: Register = on => {
  // Tool calls of the main loop since a plan was last open (see the tool.call reminder).
  let unplanned = 0
  // The current request already used the panel (plan, start or done): with everything closed,
  // its last calls (wrap_up, the final message's) need no reminder to plan.
  let planned = false
  // The last question was answered by a chat message instead of an option: that message,
  // at the next prompt, is the answer.
  let answeredInChat = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'task-tree', description: 'Abre o painel da árvore de tarefas e diz o estado dele; com resumida ou completa, troca a visão' })
    await $.tool.register({
      name: 'plan',
      isDeferred: false,
      description:
        'Adiciona um plano à árvore de tarefas do painel lateral do usuário. As tarefas de nível 1 anteriores são mantidas; ' +
        'uma aberta com o mesmo id é substituída (replanejamento, que recomeça tudo dentro dela). ' +
        'Até 3 níveis: nível 1 genérico, nível 3 mais granular. Ids únicos dentro do plano (ex.: "1", "1.2", "1.2.3"); ' +
        'abaixo do nível 1 eles ganham o id dele como prefixo ("D/1.2"), então planos diferentes podem repetir ids. ' +
        'Use no início de todo pedido (uma tarefa basta para um pedido simples) e ao replanejar. ' +
        'No primeiro plan de cada mensagem do usuário, passe em request um título curto do que foi pedido: ' +
        'o painel agrupa as tarefas de nível 1 por mensagem, com esse título.',
      inputSchema: {
        type: 'object',
        required: ['tasks'],
        properties: { tasks: level(level(level())), request: { type: 'string' } },
      },
    })
    await $.tool.register({
      name: 'done',
      isDeferred: false,
      description:
        'Marca tarefas do painel como concluídas, pelos ids, assim que cada uma termina. ' +
        'Aceita o id curto ("1.2") quando não é ambíguo, ou o completo ("D/1.2"). ' +
        'Um pai fica concluído quando todos os filhos estão; marcar um pai conclui a subárvore. ' +
        'No done da última etapa do turno, passe summary: a resposta do turno em manchete de até 120 ' +
        'caracteres (ex.: "Commit 946f653 no PR #5; 151 testes ok"). Sem etapa a fechar, chame done só com summary.',
      inputSchema: {
        type: 'object',
        required: [],
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          summary: {
            type: 'string',
            description:
              'Resumo curto da resposta deste turno, em até 120 caracteres (o que mudou e o resultado), tipo manchete ' +
              '(ex.: "Commit 946f653 no PR #5; 151 testes ok"). Vira a linha ↩ do painel; a resposta inteira fica no tooltip.',
          },
        },
      },
    })
    await $.tool.register({
      name: 'start',
      isDeferred: false,
      description:
        'Marca tarefas do painel como em andamento (destacadas em amarelo) ao começar cada uma. ' +
        'Várias podem estar em andamento; sem nenhuma marcada, o painel destaca a primeira aberta. ' +
        'Em uma tarefa concluída sem subtarefas, reabre a tarefa e os pais dela; ' +
        'para refazer um pai concluído, replaneje o nível 1 com plan. Ids como no done.',
      inputSchema: {
        type: 'object',
        required: ['ids'],
        properties: { ids: { type: 'array', items: { type: 'string' } } },
      },
    })
    // With nothing held (a new process), a resumed session's panel comes back from the store.
    await adopt($)
    if ((await $.state.get(groupsState)).value === undefined) await restore($, await $.session.id())
    groupsLoaded = true
    await restoreView($)
    await restoreWork($)
    await restoreLinks($)
    const r = await next(e)
    // Opens the panel with the session, so nobody has to type /task-tree.
    void $.ui.open({ id: PANE, title: 'Tarefas' }).catch(() => {})
    // The linked sessions' states change outside this session: polled while the session runs.
    void refreshChildren($).catch(() => {})
    watchSessions($)
    return r
  })

  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear') {
      await replace($, [{ agent: MAIN, label: '', tasks: [] }])
      await $.state.set(waitsState, [])
      await $.state.set(sendsState, [])
      await setWork($, [])
    }
    if (e.source === 'resume') await restore($, e.session_id)
    return next(e)
  })

  // Reminds the model, with every prompt, that every request opens a task in the panel.
  on('prompt.submit', async ($, e, next) => {
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
          it.handback
            ? 'Painel de tarefas (task-tree): o subagente terminou; atualize o painel (mcp__task-tree__done no que ele concluiu).'
            : kind === 'task-notification'
            ? 'Painel de tarefas (task-tree): uma tarefa em segundo plano (um subagente, um comando) terminou; ' +
              'atualize o painel: mcp__task-tree__done no que ela concluiu.'
            : 'Painel de tarefas (task-tree): mantenha o painel em dia (done no que terminou, start no que começa).',
        ],
      })
    }
    // Safety net: a new message means the main loop has no question open.
    await dropWaits($, w => w.agent !== MAIN || w.kind === 'permission')
    // A new request gets its own reminder at its first tool call without a plan.
    unplanned = 0
    planned = false
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
    const left = hasOpen(tasks)
      ? (answeredInChat ? 'Esta mensagem é a resposta do usuário à pergunta anterior. ' : '') +
        `Painel de tarefas (task-tree): tarefas abertas antes desta mensagem: ${openList(tasks)}. Feche com ` +
        'mcp__task-tree__done as que esta mensagem conclui ou substitui (por exemplo, a de perguntar ou de ' +
        'esperar a resposta) antes de seguir ou de planejar o pedido novo; deixe abertas só as que continuam.'
      : undefined
    answeredInChat = false
    return next({
      ...e,
      context: [
        ...(e.context ?? []),
        ...(note ? [note] : []),
        ...(taken ? [taken] : []),
        ...(left ? [left] : []),
        'Painel de tarefas (task-tree): todo pedido abre pelo menos uma tarefa no painel, mesmo uma ' +
          'pergunta simples ou respondida só com pesquisa ou leitura de arquivos. A PRIMEIRA chamada de ' +
          'ferramenta é mcp__task-tree__plan com a árvore de tarefas (até 3 níveis; uma tarefa basta ' +
          'para um pedido simples). Etapa por etapa: mcp__task-tree__start ao começar cada tarefa e ' +
          'mcp__task-tree__done assim que ela estiver de fato concluída, antes da próxima (nunca várias de ' +
          'uma vez no fim). Ao replanejar, chame plan de novo. ' +
          'Antes de perguntar (AskUserQuestion, ExitPlanMode, wrap_up com ask), mantenha em andamento a ' +
          'tarefa da pergunta e feche-a só depois da resposta. No primeiro plan desta mensagem, passe em ' +
          'request um título curto do que foi pedido. No done da última etapa do turno, passe summary: ' +
          'resumo da resposta em até 120 caracteres, tipo manchete.',
      ],
    })
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (!e.tools.includes('mcp__task-tree__plan')) return r
    return { ...r, sections: [...r.sections, { id: 'task-tree:regras', text: RULES, scope: 'session' as const }] }
  })

  // Opens the panel, asked by the person (placed at any width), and says what the app answered and
  // which panes it holds, so a panel that does not show up can be told apart: undrawn (the width),
  // open behind another plugin's pane (a tab), or not there at all.
  // `/task-tree resumida` or `/task-tree completa` also picks the view, for a panel that cannot be
  // clicked (it does not show).
  on('command.run', { command: 'task-tree' }, async ($, e) => {
    const arg = String((e as any).args ?? '').trim().toLowerCase()
    if (arg === 'resumida' || arg === 'summary') await setView($, 'summary')
    if (arg === 'completa' || arg === 'full') await setView($, 'full')
    let opened: any
    try {
      opened = await $.ui.open({ id: PANE, title: 'Tarefas', focus: true })
    } catch (err) {
      opened = { isPlaced: false, reason: String(err) }
    }
    let panes = ''
    try {
      panes = (await $.ui.panes())
        .map((p: any) => `${p.id}${p.isShown ? ' (na frente)' : p.isPlaced ? ' (aba atrás de outra)' : ' (não desenhado)'}`)
        .join(', ')
    } catch {}
    void publishWait($).catch(() => {})
    return {
      text: opened?.isPlaced
        ? `Painel de tarefas aberto. Painéis: ${panes || 'nenhum'}. Desenho: ${Math.round(drawSize / 1024)} KB de ${Math.round(DRAW_LIMIT / 1024)} KB.`
        : `O app não pôs o painel na tela: ${String(opened?.reason ?? 'sem motivo')}. Painéis: ${panes || 'nenhum'}.`,
    }
  })

  on('tool.call', { tool: 'mcp__task-tree__plan' }, async ($, e, next) => {
    try {
      const agent = e.agentId ?? MAIN
      if (agent === MAIN) planned = true
      const input = ((e as any).input ?? e) as { tasks?: InNode[]; request?: string }
      const fresh = build(input.tasks ?? [], 1, undefined, await stamp($))
      const request = typeof input.request === 'string' ? input.request.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
      const dup = duplicates(fresh)
      if (dup.length > 0) {
        return { result: `erro: ids repetidos no plano (${dup.join(', ')}); use ids únicos.`, isError: true }
      }
      await ensureGroup($, agent)
      // Keeps earlier level-1 tasks: an open one with an id the new plan reuses is
      // replanned (replaced); a closed one stays as history, renamed if its id collides.
      const ids = fresh.map(t => t.id)
      const tag = Math.random().toString(36).slice(2, 6)
      const rename = (t: TaskNode): TaskNode => ({ ...t, id: `${tag}:${t.id}`, children: t.children.map(rename) })
      const fresh0 = agent === MAIN && (await startsWork($))
      // A replanned task starts over: the sends from it (or below it) go with it.
      if (agent === MAIN) await update($, sendsState, cur => (cur ?? []).filter(s => !ids.includes(String(s.anchor ?? '').split('/')[0] as string)))
      const { value: before = [] } = await $.state.get(groupsState)
      const renamed = ((before as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
        .filter(t => t.status !== 'open' && ids.includes(t.id))
        .map(t => t.id)
      const groups = await change($, all => {
        return all.map(g => {
          if (g.agent !== agent) return g
          // In plan order: a replanned task takes the place of the one it replaces; the new ones
          // go below the ones already there.
          const reused = (t: TaskNode) => t.status === 'open' && ids.includes(t.id)
          const inPlace = (list: TaskNode[]) => {
            const out = g.tasks.map(t => (reused(t) ? (list.find(f => f.id === t.id) as TaskNode) : ids.includes(t.id) ? rename(t) : t))
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
          const was = (id: string) => g.tasks.find(t => t.status === 'open' && t.id === id)?.turn
          const placed = fresh.map(t => {
            const turn = was(t.id) ?? cur?.id
            return turn === undefined ? t : { ...t, turn }
          })
          return { ...g, turns, tasks: inPlace(placed) }
        })
      })
      if (agent === MAIN) {
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
  })

  on('tool.call', { tool: 'mcp__task-tree__done' }, async ($, e, next) => {
    try {
      const agent = e.agentId ?? MAIN
      if (agent === MAIN) planned = true
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
          if (t && t.status === 'done') notes.push(`a mensagem para ${s.to} ("${t.id}") ainda está na fila, sem confirmação de recebimento`)
        }
        // Closed, its send waits no more: no ✉ left behind on an id used again.
        if (closed.length > 0) await update($, sendsState, cur => (cur ?? []).filter(s => !closed.includes(s.anchor ?? '')))
        // The last step closed with no summary: the ↩ line would say only "resposta".
        if ((await lastBrief($)) === undefined && closed.length > 0 && !hasOpen(groups.find(g => g.agent === MAIN)?.tasks ?? []))
          notes.push('falta o summary: chame done de novo só com summary, a resposta do turno em até 120 caracteres (vira a linha ↩)')
      }
      const [d, n] = count(groups.find(g => g.agent === agent)?.tasks ?? [])
      // Several steps never started and closed together: the panel showed the first one in progress
      // all along, then jumped to the last, the steps between at 0:00 (the person's words: "ficou
      // parada muito tempo na primeira tarefa, e derepente pulo para a ultima").
      if (unstarted.length >= 2) {
        notes.push(
          `${unstarted.length} etapas fecharam juntas sem start (${unstarted.map(id => `"${id}"`).join(', ')}): o painel ficou ` +
            'parado na primeira e elas aparecem com 0:00. Daqui em diante, marque cada etapa com mcp__task-tree__start ' +
            'ao começá-la e com mcp__task-tree__done ao terminá-la, uma de cada vez',
        )
      }
      return { result: `Concluídas: ${d}/${n} no seu grupo.` + (notes.length > 0 ? ` Avisos: ${notes.join('; ')}.` : '') }
    } catch (err) {
      return { result: 'erro: ' + String(err), isError: true }
    }
  })

  on('tool.call', { tool: 'mcp__task-tree__start' }, async ($, e, next) => {
    try {
      const agent = e.agentId ?? MAIN
      if (agent === MAIN) planned = true
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
  })

  // A permission the person is asked for: the panel shows it until the call ends (no
  // event marks the answer). Questions and plans are shown from tool.call below.
  on('classic.PermissionRequest', async ($, e, next) => {
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
  })

  // The recap of the end-of-turn box (wrap_up), the turn's answer for the card (see turn.complete).
let lastRecap: string | undefined
// The ↩ line says the answer in at most BRIEF characters: the summary the session gave, else the
// first sentence of the answer; longer, cut at a word with "…". The whole answer stays in the tooltip.
const BRIEF = 120
function brief(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim()
  if (one.length <= BRIEF) return one
  const cut = one.slice(0, BRIEF - 1)
  const at = cut.lastIndexOf(' ')
  return `${(at > BRIEF / 2 ? cut.slice(0, at) : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}
// With no summary from the session, the ↩ line says only this, the whole answer in its tooltip: the
// answer cut to the line's width summed nothing up (the person's words: "voce esta imprimindo o
// texto integral cortado").
const REPLY = 'resposta'

// A subagent's turn ending is the subagent ending: what it left open is interrupted.
  // A teammate ends a turn per message and is left alone.
  // The model and effort of the main loop's requests, published for the card in the session that
  // opened this one (the person's words: "mostre o nome do modelo e o esforco de cada sessao").
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId && typeof e.model === 'string') {
      const text = engineText(e.model, e.effort)
      if ((await $.state.get(engineState)).value !== text) {
        await $.state.set(engineState, text)
        void publishWait($).catch(() => {})
      }
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const agent = e.agentId
    // A question or plan dialog never outlives the turn that opened it (one answered by a chat
    // message may end without the call returning here).
    await dropAsked($, agent ?? MAIN)
    // What the turn answered, kept on its turn (the last one of the main group) and published: the
    // card of this session in the one that opened it shows it under the turn's tasks (the person's
    // words: "adicione nos paineis de sessao, o que foi gerado como resposta"). The end-of-turn
    // recap (wrap_up), which is what the opener's notice carries; else the final message.
    if (!agent && !e.isAborted) {
      const said = (lastRecap ?? e.answer ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)
      const given = await lastBrief($)
      const short = given !== undefined ? brief(given) : undefined
      lastRecap = undefined
      if (given !== undefined) await $.state.set(briefState, '')
      if (said !== '') {
        await change($, all =>
          all.map(g => {
            if (g.agent !== MAIN) return g
            const turns = g.turns ?? []
            const last = [...turns].reverse().find(u => g.tasks.some(t => t.turn === u.id))
            return last ? { ...g, turns: turns.map(u => (u.id === last.id ? { ...u, reply: said, ...(short !== undefined ? { brief: short } : {}) } : u)) } : g
          }),
        )
      }
    }
    // The turn's answer grew the context: publish its share for the session that opened this one.
    if (!agent) await publishWait($)
    if (agent) {
      const info = ((await $.agent.list()) as AgentInfo[]).find(a => a.id === agent)
      if (info?.type !== 'teammate' && info?.teammateId === undefined) {
        await dropWaits($, w => w.agent !== agent)
        const { value } = await $.state.get(groupsState)
        if (value?.some(g => g.agent === agent && hasOpen(g.tasks))) {
          const now = await stamp($)
          await change($, all => all.map(g => (g.agent === agent ? { ...g, tasks: g.tasks.map(interrupt(now)) } : g)))
        }
      }
    }
    return r
  })

  // Covers what prompt.submit misses (answers to questions, work Claude continues on its own):
  // the first tool call of the main loop with no open plan, and every 10th after it,
  // carries a reminder in its result.
  on('tool.call', async ($, e, next) => {
    const agent = e.agentId ?? MAIN
    // A launch records the task the launching loop is on, where the subagent's group goes.
    if (e.tool === 'Agent' || e.tool === 'Task') {
      const { value = [] } = await $.state.get(groupsState)
      const { anchor } = current(value.find(g => g.agent === agent)?.tasks ?? [])
      const description = String((e as any).description ?? '')
      await update($, launchesState, cur => [...(cur ?? []), { parent: agent, anchor, description }].slice(-20))
    }
    // A question or a plan to approve: the panel says so while it is open (the dialog
    // opens inside next(e)), and the answer comes back with a reminder to bring the
    // panel up to date while the asking loop has open tasks.
    const kind = e.tool === 'AskUserQuestion' ? 'question' : e.tool === 'ExitPlanMode' ? 'plan' : undefined
    if (kind) {
      // A question belongs to the task in progress it asks about: the main loop asking with
      // none open is refused (ExitPlanMode is let through: plan mode may hold the panel's tools).
      if (kind === 'question' && agent === MAIN) {
        const { value = [] } = await $.state.get(groupsState)
        if (!hasOpen(value.find(g => g.agent === MAIN)?.tasks ?? [])) {
          return {
            deny:
              'Painel de tarefas (task-tree): não há tarefa aberta no painel, e uma pergunta sempre fica sob ' +
              'uma tarefa em andamento. Abra (mcp__task-tree__plan) ou reabra (mcp__task-tree__start) a tarefa ' +
              'a que esta pergunta pertence e pergunte de novo; feche-a só depois da resposta.',
          }
        }
      }
      const key = e.tool_use_id
      await addWait($, { agent, kind, tool: e.tool, key })
      try {
        const r = await next(e)
        // Answered by a chat message instead of an option: that message is still to come.
        const inChat = /did not answer|sent a message instead/i.test(JSON.stringify((r as any).result ?? r))
        if (inChat && agent === MAIN) answeredInChat = true
        const { value = [] } = await $.state.get(groupsState)
        if (!hasOpen(value.find(g => g.agent === agent)?.tasks ?? [])) return r
        return {
          ...r,
          context: [
            ...(r.context ?? []),
            inChat
              ? 'Painel de tarefas (task-tree): o usuário vai responder por mensagem no chat, e a mensagem ' +
                'dele é a resposta. Ao recebê-la, antes de seguir, feche com mcp__task-tree__done a tarefa ' +
                'desta pergunta e atualize o painel (start no que começa, plan se o plano mudou).'
              : 'Painel de tarefas (task-tree): o usuário respondeu. Antes de seguir, atualize o painel: ' +
                'mcp__task-tree__done no que a resposta concluiu, mcp__task-tree__start no que começa agora, ' +
                'ou mcp__task-tree__plan se ela mudou o plano.',
          ],
        }
      } finally {
        await dropWaits($, w => w.key !== key)
      }
    }
    // The desktop app's end-of-turn box with a question and buttons (wrap_up with `ask`):
    // the call returns at once and the turn ends, but the person is still asked. The notice
    // stays until the next prompt (prompt.submit drops it) or a wrap_up with no question.
    if (String(e.tool) === 'mcp__ccd_turn__wrap_up') {
      const input = ((e as any).input ?? e) as { ask?: unknown; recap?: unknown }
      if (agent === MAIN && typeof input.recap === 'string' && input.recap.trim() !== '') lastRecap = input.recap
      const key = `${agent}:wrap_up:ask`
      await dropWaits($, w => w.key !== key)
      if (typeof input.ask === 'string' && input.ask.trim() !== '') {
        await addWait($, { agent, kind: 'choice', tool: 'wrap_up', key })
      }
    }
    // Before the call: a message delivered at once opens the session's turn before the call returns.
    const sentAt = String(e.tool) === 'SendMessage' ? await stamp($) : undefined
    let r
    try {
      r = await next(e)
    } finally {
      await dropWaits($, w => w.key !== `${agent}:${e.tool}`)
    }
    if (agent !== MAIN) return r
    // After a reload the clock is gone with the old module: the next call starts it again.
    await keepTime($)
    watchSessions($)
    await refreshStale($).catch(() => {})
    if (String(e.tool) === 'mcp__ccd_session__start_session') {
      const out = JSON.stringify((r as any).result ?? r)
      await recordStart($, out)
    }
    if (r.deny !== undefined) return r
    const notes: string[] = []
    // A message to another session that was only queued: its task stays in progress until the
    // session takes it up (watchSends), and the panel says so.
    if (String(e.tool) === 'SendMessage') {
      const out = JSON.stringify((r as any).result ?? r)
      const to = String((e as any).to ?? (e as any).input?.to ?? '')
      // The session is used for the task in progress: the summary view draws it there.
      {
        const { value = [] } = await $.state.get(groupsState)
        const anchor = sendAnchor((value as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
        // Each message opens a round of the session, drawn in a card of its own under the task it
        // was sent from once the session takes it up (see split).
        const round = sentAt === undefined ? [] : [{ at: sentAt, anchor }]
        if (to !== '') {
          await update($, childrenState, cur =>
            (cur ?? []).map(c =>
              c.id === to || (c.name !== '' && c.name === to)
                ? { ...c, ...(anchor !== undefined ? { lastAnchor: anchor } : {}), rounds: [...(c.rounds ?? []), ...round].slice(-20) }
                : c,
            ),
          )
        }
      }
      // Waiting for delivery: queued (or held) and not taken up yet. Only "its turn has started"
      // confirms; a queued result may still say when it "will be delivered".
      const waitsDelivery = /queued|held|pending/i.test(out) && !/turn has started/i.test(out)
      // Every send is kept until the other session is seen taking it up (its published `received`
      // or a turn of it after the send, see watchSends): its task shows ✉ meanwhile, also when the
      // delivery was at once (the person's words: "nao esta aparecendo as tarefas com o icone de
      // mensagem, para sinalizar que essa etapa esta em andamento"). A failed send keeps none.
      const failed = (r as any).isError === true || /success[\\"]*:\s*false/.test(out)
      if (to !== '' && !failed) {
        const { value = [] } = await $.state.get(groupsState)
        const anchor = sendAnchor((value as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
        const at = sentAt ?? (await stamp($))
        await update($, sendsState, cur => [
          ...(cur ?? []).filter(s => !(s.to === to && s.anchor === anchor)),
          { to, anchor, at, ...(waitsDelivery ? {} : { delivered: true }) },
        ])
        await publishWait($)
      }
      if (waitsDelivery && to !== '') {
        const { value = [] } = await $.state.get(groupsState)
        const anchor = sendAnchor((value as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
        const all = flat((value as Group[]).find(g => g.agent === MAIN)?.tasks ?? [])
        const t = all.find(t => t.id === anchor)
        notes.push(
          `Painel de tarefas (task-tree): a mensagem para ${to} ficou na fila, sem confirmação de recebimento. ` +
            `Mantenha em andamento a tarefa do envio${t ? ` ("${t.id}" ${t.title})` : ''}: o painel avisa quando a ` +
            'sessão começar a tratá-la, e então a conclui sozinho (pode encerrar o turno).',
        )
      }
    }
    const ended = await endedNote($)
    if (ended) notes.push(ended)
    const taken = await takenNote($)
    if (taken) notes.push(taken)
    // The end of a turn in the desktop app: what is still open is listed, so nothing finished is
    // left open (a task done through a session, one overtaken by the next).
    if (String(e.tool) === 'mcp__ccd_turn__wrap_up') {
      const { value = [] } = await $.state.get(groupsState)
      const tasks = value.find(g => g.agent === MAIN)?.tasks ?? []
      if ((await lastBrief($)) === undefined)
        notes.push(
          'Painel de tarefas (task-tree): falta o resumo do turno. Antes da mensagem final, chame ' +
            'mcp__task-tree__done com summary: a resposta em até 120 caracteres, tipo manchete (ids pode ficar vazio).',
        )
      if (hasOpen(tasks)) {
        notes.push(
          'Painel de tarefas (task-tree): o turno termina com tarefas abertas no painel: ' +
            `${openList(tasks)}. Antes da mensagem final, marque com mcp__task-tree__done as que já foram ` +
            'concluídas (inclusive as feitas por outra sessão ou por outro caminho). Deixe abertas só as que ' +
            'de fato continuam pendentes; com ask, a tarefa da pergunta fica em andamento até a resposta.',
        )
      }
    }
    if (notes.length > 0) r = { ...r, context: [...(r.context ?? []), ...notes] }
    if (String(e.tool).startsWith('mcp__task-tree__')) {
      unplanned = 0
      return r
    }
    const { value = [] } = await $.state.get(groupsState)
    if (planned || hasOpen(value.find(g => g.agent === MAIN)?.tasks ?? [])) {
      unplanned = 0
      return r
    }
    unplanned++
    if (unplanned % 10 !== 1) return r
    return {
      ...r,
      context: [
        ...(r.context ?? []),
        'Painel de tarefas (task-tree): há chamada de ferramenta sem plano aberto no painel. Todo pedido ' +
          'abre pelo menos uma tarefa: chame mcp__task-tree__plan agora, mcp__task-tree__start ao começar ' +
          'e mcp__task-tree__done só quando a tarefa estiver de fato concluída.',
      ],
    }
  })

  // The pane's presses, answered by key (see actions), each one logged to the debug log.
  on('ui.press', async ($, e, next) => {
    if (e.plugin !== 'task-tree' || e.requestId !== PANE) return next(e)
    const fn = actions.get(e.element)
    await debug($, `task-tree: press ${e.element} (${e.surface})${fn ? '' : ': sem ação conhecida'}`)
    if (!fn) return next(e)
    fn()
    return { element: e.element }
  })

  // A drawing that throws is not dropped in silence: the pane shows the error in one line, and the
  // session publishes it (renderError) for whoever looks into a panel that does not show up.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
   try {
    renderError = undefined
    const drawn = await (async () => {
    const ui = $.ui.resolve(e) as any
    const { Box, Text } = ui
    // After a restart without session.start, the groups come from the store (see ensureGroups).
    const brought = await ensureGroups($)
    const { value: heldState } = await $.state.get(groupsState)
    const held = heldState ?? brought
    const { value: waits = [] } = await $.state.get(waitsState)
    const { value: sessions = [] } = await $.state.get(childrenState)
    const { value: sessionsError = '' } = await $.state.get(childrenErrorState)
    // The main tasks a queued message was sent from (see watchSends): "mensagem na fila".
    const { value: sends = [] } = await $.state.get(sendsState)
    const queued = (sends as Send[]).filter(s => !s.taken)
    const sentTo = (id: string) => queued.filter(s => s.anchor === id).map(s => s.to)
    // The sends still waiting to be taken up, by the scope of the main group they were sent from:
    // this session's, and those each session publishes (its card shows ✉ on its task too).
    const sendsAt: Record<string, Send[]> = { [`${MAIN}|`]: queued }
    // The whole session's count, for the header's tooltip; the header itself counts what the
    // view draws (see shown, below).
    const [ad, an] = total({ groups: withMain(held ?? []), waits, children: sessions })
    // The times are drawn against now; the pane's clock (keepTime) redraws them each second.
    const now = await stamp($)
    drawNow = now
    const notice = (w: Wait, depth: number): Row => ({ depth, tone: 'wait', title: waitText(w), label: '' })

    // What the person opened or closed; `fl` is read by the builders below, which run twice:
    // with no choices (the chips count what is drawn by default, however the lines are folded)
    // and with the person's.
    const chosen = await read($, folds)
    let fl: Record<string, boolean> = {}
    // Drawn below a line: the person's choice, else the default.
    const opened = (key: string, byDefault: boolean) => (fl[key] === undefined ? byDefault : !fl[key])

    // A task line and, while it is open, what hangs below it (`below`) and its subtasks.
    // Nothing folds by itself when it is done (the person's words: "se eu quiser, eu mesmo
    // colapso"): every line comes open and only the ▾/▸ closes it. A task with anything below it
    // opens and closes (`fold`, keyed under `scope`).
    const rows = (
      items: TaskNode[],
      depth: number,
      top: number,
      lit: string[],
      below: (t: TaskNode, depth: number) => Row[],
      scope: string,
      work: (t: TaskNode) => Work = () => idle,
    ): Row[] =>
      items.flatMap(t => {
        // Sessions opened on it or below add to its count and keep it in progress (atWork).
        const w = work(t)
        // A message sent from it is still queued: it waits on that session (its own icon).
        const waitsOn = t.status === 'open' ? (sendsAt[scope] ?? []).filter(s => s.anchor === t.id).map(s => s.to) : []
        const tone: Tone =
          t.status === 'interrupted'
            ? 'interrupted'
            : waitsOn.length > 0
              ? 'sent'
              : w.busy
                ? 'current'
                : t.status === 'done'
                  ? 'done'
                  : lit.includes(t.id)
                    ? 'current'
                    : t.children.length > 0 && resting(t.children)
                      ? 'paused'
                      : 'open'
        const [ld, ln] = t.children.length > 0 ? count(t.children) : w.any ? count([t]) : [0, 0]
        const [sd, sn] = [ld + w.d, ln + w.n]
        const row: Row = {
          depth,
          tone,
          title: t.title,
          label:
            tone === 'sent'
              ? `Aguardando confirmação de ${waitsOn.join(', ')}`
              : ({ open: 'Aberta', current: 'Em andamento', done: 'Concluída', interrupted: 'Interrompida', paused: 'Aguardando' }[tone as string] ?? ''),
          strong: tone === 'current' || tone === 'sent' || (depth === top && t.status === 'open'),
          sub: (t.children.length > 0 || w.any) && tone !== 'interrupted' && sn > 0 ? [sd, sn] : undefined,
          bar: true,
          meta: tone === 'interrupted' ? 'interrompida' : undefined,
          time:
            (tone === 'paused' ? stillSpan([t, ...w.tasks]) : timeOf(t, w, now)) ??
            (tone === 'done' || tone === 'interrupted'
              ? null
              : tone === 'current' && t.plannedAt !== undefined && now !== undefined
                ? now - t.plannedAt
                : undefined),
          kids: w.any || undefined,
          // The context ring is each session's own, on its card only (the person's words: "nao precisa
          // colocar esse icone na tarefa pai que originou essas sessoes"); the ⑂ still marks a task
          // with sessions below.
          // In progress of its own (the chip); a session at work below it counts as a session.
          active: tone !== 'sent' && t.status === 'open' && lit.includes(t.id) && !t.children.some(c => c.status === 'open'),
        }
        const under = below(t, depth)
        if (t.children.length === 0 && under.length === 0) return [{ ...row, nodes: [t] }]
        const key = `${scope}t:${t.id}`
        // Nothing closes by itself when it is done: only the person folds a line (▾/▸).
        const kids = t.children
        const rest = opened(key, true) ? [...under, ...rows(kids, depth + 1, top, lit, below, scope, work)] : []
        row.fold = { key, open: rest.length > 0 }
        row.nodes = rest.length > 0 ? (t.children.length === 0 ? [t] : []) : [t, ...w.tasks]
        return [row, ...rest]
      })

    // A turn of the main group: what the person asked, with the level-1 tasks planned for it
    // below. Its count, bar and time add up its tasks and the sessions opened under them; it is
    // in progress while one of them is (or a session below is at work), and closes into one line
    // once all of them are closed.
    const turnRows = (
      u: Turn,
      list: TaskNode[],
      top: number,
      lit: string[],
      below: (t: TaskNode, depth: number) => Row[],
      scope: string,
      work: (t: TaskNode) => Work,
      // The turn's own ↩ (the top panel's): a card draws its session's answers below its tasks.
      reply = true,
    ): Row[] => {
      const ws = list.map(work)
      const busy = ws.some(w => w.busy)
      const [ld, ln] = count(list)
      const [d, n] = [ws.reduce((a, w) => a + w.d, ld), ws.reduce((a, w) => a + w.n, ln)]
      const tone: Tone =
        busy || list.some(t => t.status === 'open' && lit.includes(t.id))
          ? 'current'
          : list.some(t => t.status === 'open')
            ? resting(list)
              ? 'paused'
              : 'open'
            : list.every(t => t.status === 'interrupted')
              ? 'interrupted'
              : 'done'
      const key = `${scope}T:${u.id}`
      const open = opened(key, true)
      const row: Row = {
        depth: top,
        tone,
        title: u.title,
        label:
          { open: 'Pedido aberto', current: 'Pedido em andamento', done: 'Pedido concluído', interrupted: 'Pedido interrompido', paused: 'Aguardando' }[
            tone as string
          ] ?? 'Pedido',
        strong: tone === 'current' || tone === 'open' || tone === 'paused',
        sub: n > 0 ? [d, n] : undefined,
        bar: true,
        time:
          (tone === 'paused' ? stillSpan([...list, ...ws.flatMap(w => w.tasks)]) : timeSpan([...list, ...ws.flatMap(w => w.tasks)], busy, now)) ??
          (tone === 'done' || tone === 'interrupted'
            ? null
            : tone === 'current' && now !== undefined && list.some(t => t.plannedAt !== undefined)
              ? now - Math.min(...list.flatMap(t => (t.plannedAt === undefined ? [] : [t.plannedAt])))
              : undefined),
        fold: { key, open },
        kids: ws.some(w => w.any) || undefined,
      }
      // The ring goes on the turn, the highest line above the sessions, not on its level-1 tasks.
      const inner = open ? rows(list, top + 1, top + 1, lit, below, scope, work) : []
      row.nodes = open ? [] : [...list, ...ws.flatMap(w => w.tasks)]
      // The turn's answer closes the message's group, after all its level-1 tasks, as on a card;
      // not when a session's card hangs in the group: the answers that count are in the cards, and
      // one after a card still at work would read as the group being over.
      const said: Row[] =
        reply && open && typeof u.reply === 'string' && u.reply !== '' && !ws.some(w => w.any)
          ? [{ depth: top + 1, tone: 'reply', title: u.brief ?? REPLY, whole: u.reply, label: 'Resposta' }]
          : []
      return [row, ...inner, ...said]
    }

    // A session this one opened, in a card: "title · name", the count and time of its tasks, and
    // its state in a word once it is not just running. While it runs or waits its own panel is
    // drawn below it as it draws it (its waits under its task in progress, its subagents and
    // sessions); once it stops it closes into one line, which the person may open. The icon is
    // the gray branch while it is at work; the clock when it waits with no notice of its own to
    // show (earlier versions); the check once it stopped.
    const session = (c: Child, depth: number, level: number, scope: string): Row[] => {
      const p = panelOf(c)
      const pending = c.waiting === true && (p.waits ?? []).length === 0
      // Stopped with tasks still open (it waits for a signal, or the next message): not done; its
      // tasks stay in sight, as it planned them.
      const parked = !live(c) && !c.archived && hasOpen(tasksOf(p.groups ?? []))
      const tone: Tone = pending ? 'wait' : live(c) ? 'running' : c.archived ? 'archived' : parked ? 'paused' : 'done'
      // A card of one round (split) speaks for its group only: done, it shows the check, with no
      // word that would say the whole session ended.
      const state = c.waiting ? 'aguardando' : live(c) ? undefined : c.archived ? 'arquivada' : parked ? 'parada' : c.part !== undefined ? undefined : 'concluída'
      const [cd, cn] = total(p, level + 1)
      const header: Row = {
        depth,
        tone,
        // The card's first line is the session alone (its name); its tasks start on the line below.
        // The session's title (often worded like a task) goes only to the alt, not the line.
        title: c.name || c.title,
        label: 'Sessão',
        hint: c.name && c.name !== c.title ? c.title : undefined,
        strong: live(c),
        sub: cn > 0 ? [cd, cn] : undefined,
        meta: state,
        time: span(tasksOf(p.groups ?? []), now) ?? (live(c) ? undefined : null),
        card: true,
        session: true,
        sid: c.id,
        engine: c.engine,
        ring: ringOf(c),
        live: live(c),
        pending,
      }
      if (level >= DEEP) return [header]
      // A card past the first (split) has keys of its own.
      const part = c.part ? `#${c.part}` : ''
      const key = `${scope}s:${c.id}${part}`
      const inside = `${scope}${c.id}${part}>`
      // Under the card's tasks, what the session answered at the end of each of its turns there, in
      // turn order: a ↩ line, dim, with no count or time (not a task).
      const replies: Row[] = (withMain(p.groups ?? []).find(g => g.agent === MAIN)?.turns ?? [])
        .filter(u => typeof u.reply === 'string' && u.reply !== '')
        .map(u => ({ depth: depth + 1, tone: 'reply' as Tone, title: u.brief ?? REPLY, whole: u.reply, label: 'Resposta' }))
      const inner = opened(key, true) ? [...panel(p, depth + 1, level + 1, inside, c.id), ...replies] : []
      // Whether a closed one has anything to open: its panel, drawn as it would be.
      if (inner.length > 0 || panel(p, depth + 1, level + 1, inside, c.id).length > 0) header.fold = { key, open: inner.length > 0 }
      header.nodes = inner.length > 0 ? [] : allTasks(p, level + 1)
      return [header, ...inner]
    }

    // One session's panel from `base`: its main group, its subagents' groups and the sessions
    // it opened. A session goes under the main task it was opened on, open or closed (a closed
    // one shows only it); at the end of the list when it has no such task. Archived ones are
    // left out. Done tasks stay in their place in the plan, closed.
    const panel = (p: Panel, base: number, level: number, scope: string, me?: string): Row[] => {
      if (level > 0) sendsAt[`${scope}${MAIN}|`] = (p.sends ?? []).filter(x => !x.taken)
      const groups = withMain(p.groups ?? [])
      const waits = p.waits ?? []
      // Archived sessions stay, as history, drawn gray with "arquivada".
      // One card per message the session was sent (split).
      const sessions = (p.children ?? []).flatMap(c => split(c, p.children ?? [], me, withMain(p.groups ?? []).find(g => g.agent === MAIN)?.tasks ?? []))

      // A subagent's group hangs from the loop that launched it; one whose launcher has no
      // group (it never planned) hangs from the main one.
      const agents = groups.map(g => g.agent)
      const launcher = (g: Group) => (agents.includes(g.parent ?? MAIN) ? (g.parent ?? MAIN) : MAIN)
      const kidsOf = (agent: string) => groups.filter(g => g.agent !== MAIN && launcher(g) === agent)

      const main = groups.find(g => g.agent === MAIN) as Group
      const allIds = flat(main.tasks).map(t => t.id)
      const loose = sessions.filter(c => c.anchor === undefined || !allIds.includes(c.anchor))
      // A group's tasks from `top` (`list`), with what hangs below them. Its subagents' groups
      // go under the task they were launched on, hidden with it once it closes; one launched
      // on no task (or a task replanned away) ends the group. `extras` adds those groups and
      // the notices with no task to go under.
      const body = (g: Group, top: number, list: TaskNode[], extras: boolean): Row[] => {
        const mine = waits.filter(w => w.agent === g.agent)
        const kids = kidsOf(g.agent)
        const lines: Row[] = []
        const { lit, anchor } = current(g.tasks)
        const ids = flat(g.tasks).map(t => t.id)
        const lost = kids.filter(k => k.anchor === undefined || !ids.includes(k.anchor))
        const below = (t: TaskNode, depth: number) => [
          ...(t.id === anchor ? mine.map(w => notice(w, depth + 1)) : []),
          ...(g.agent === MAIN
            ? inOrder(sessions.filter(c => c.anchor === t.id)).flatMap(c => session(c, depth + 1, level, scope))
            : []),
          ...(t.status === 'open' ? kids.filter(k => k.anchor === t.id).flatMap(k => draw(k, depth + 1)) : []),
        ]
        // With no task to go under, a notice goes under the header, or ends the main list.
        if (extras && anchor === undefined && g.agent !== MAIN) lines.push(...mine.map(w => notice(w, top)))
        const work = g.agent === MAIN ? (t: TaskNode) => atWork(t, sessions, level) : undefined
        const inScope = `${scope}${g.agent}|`
        // Only the last SHOWN_TURNS requests (turns) of a main list are drawn, on the top panel and in
        // a session's card alike, and any request with something still open; the rest are counted
        // in one line: a long session's whole history, its cards' too, came to 700 lines and 1.6 MB
        // a drawing, sent again every second, and the app stopped showing the pane. The header and
        // the counts still take them all.
        const asked = g.agent === MAIN ? [...new Set(list.flatMap(t => (t.turn === undefined ? [] : [t.turn])))].sort((a, b) => a - b) : []
        const keep = level === 0 ? SHOWN_TURNS : SHOWN_CARD_TURNS
        const recent = asked.slice(-keep)
        const cut = asked.length > keep || (asked.length >= keep && list.some(t => t.turn === undefined))
        const drawn = cut ? list.filter(t => (t.turn !== undefined && recent.includes(t.turn)) || hasOpen([t])) : list
        const left = cut ? new Set(list.filter(t => !drawn.includes(t)).map(t => t.turn ?? -1)).size : 0
        if (cut && left > 0) lines.push({ depth: top, tone: 'section', title: `+${left} pedidos anteriores`, label: 'Pedidos anteriores, não desenhados' })
        // The top panel's main tasks go under the turn (the person's message) they were planned
        // in, oldest first; tasks from before turns existed stay loose, ahead of them.
        // In a session's card, only a turn that planned more than one level-1 task gets its header:
        // with no line from the card's label, those tasks read as loose ones (the person's words:
        // "Tarefas sem ligação"); a turn of one task stays as it was, that task its own header.
        const turns =
          g.agent !== MAIN
            ? []
            : (g.turns ?? []).filter(u => drawn.some(t => t.turn === u.id) && (level === 0 || drawn.filter(t => t.turn === u.id).length > 1))
        const loose = turns.length === 0 ? drawn : drawn.filter(t => !turns.some(u => u.id === t.turn))
        lines.push(...rows(loose, top, top, lit, below, inScope, work))
        for (const u of turns) lines.push(...turnRows(u, drawn.filter(t => t.turn === u.id), top, lit, below, inScope, work ?? (() => idle), level === 0))
        if (extras && anchor === undefined && g.agent === MAIN) lines.push(...mine.map(w => notice(w, top)))
        return extras ? lines.concat(lost.flatMap(k => draw(k, top))) : lines
      }

      // One group's lines from `b`: a subagent's header there and its tasks below, opened and
      // closed with the header.
      const draw = (g: Group, b: number): Row[] => {
        if (g.agent === MAIN) return body(g, b, g.tasks, true)
        const mine = waits.filter(w => w.agent === g.agent)
        if (g.tasks.length === 0 && mine.length === 0 && kidsOf(g.agent).length === 0) return []
        // A subagent's group closes into one line once nothing in it is open; its notices
        // stay in sight.
        const closed = g.tasks.length > 0 && !hasOpen(g.tasks)
        const cut = flat(g.tasks).some(t => t.status === 'interrupted')
        const [gd, gn] = count(g.tasks)
        const header: Row = {
          ...(closed
            ? { tone: cut ? 'interrupted' : 'done', meta: cut ? 'interrompido' : undefined }
            : { tone: 'agent', strong: true }),
          depth: b,
          title: g.label,
          label: 'Subagente',
          sub: gn > 0 ? [gd, gn] : undefined,
          time: span(g.tasks, now),
          card: true,
        } as Row
        const inner = body(g, b + 1, g.tasks, true)
        if (inner.length === 0) return [{ ...header, nodes: g.tasks }]
        const key = `${scope}g:${g.agent}`
        const open = opened(key, true)
        header.fold = { key, open }
        header.nodes = open ? [] : g.tasks
        return [header, ...(open ? inner : closed ? mine.map(w => notice(w, b + 1)) : [])]
      }

      // A card with no task to go under (opened before this session kept origins, or its origin
      // long gone) ends the list only while it has work: one all done is old history, counted in one
      // line, not drawn (they were most of the 1.6 MB drawing).
      // One begun since the oldest request still drawn above (a message with no recorded origin)
      // stays: it is recent.
      const ats = (main.turns ?? []).filter(u => main.tasks.some(t => t.turn === u.id)).flatMap(u => (typeof u.at === 'number' ? [u.at] : []))
      const since = ats.length > SHOWN_TURNS ? [...ats].sort((a, b) => a - b)[ats.length - SHOWN_TURNS] : -Infinity
      const busy = (c: Child) => begins(c) >= since || live(c) || hasOpen(tasksOf(panelOf(c).groups ?? []))
      const old = level === 0 ? loose.filter(c => !busy(c)) : []
      const ends = level === 0 ? loose.filter(busy) : loose
      return draw(main, base)
        .concat(old.length > 0 ? [{ depth: base, tone: 'section' as Tone, title: `+${old.length} cartões antigos de sessões`, label: 'Cartões antigos, não desenhados' }] : [])
        .concat(inOrder(ends).flatMap(c => session(c, base, level, scope)))
    }
    const all = { groups: held ?? [], waits, children: sessions }
    panel(all, 0, 0, '', ownId)
    fl = chosen
    // The summary view is the full view of a cut of the panel: the current work (trimToWork), with
    // its sessions under the task they were last sent a message from (else where they were opened;
    // one still at work with neither in the work goes at the end), each cut to its own round. Same
    // lines, the same ▾/▸ and the same choices as the full view.
    const { value: view = 'full' } = await $.state.get(viewState)
    const summary = view === 'summary'
    const { value: work = [] } = await $.state.get(workState)
    const cut = (): Panel => {
      const base = { groups: withMain(held ?? []), waits, work: work as string[] }
      const kept = withMain(trimToWork({ ...base, children: [] }, 0).groups).find(g => g.agent === MAIN)?.tasks ?? []
      const ids = flat(kept).map(t => t.id)
      const has = (id?: string) => id !== undefined && ids.includes(id)
      // A session split in cards keeps each card under the task its message was sent from.
      const moved = sessions.flatMap(c => split(c, sessions, ownId, withMain(base.groups ?? []).find(g => g.agent === MAIN)?.tasks ?? [])).map(c =>
        c.part !== undefined ? c : has(c.lastAnchor) ? { ...c, anchor: c.lastAnchor } : has(c.anchor) ? c : live(c) ? { ...c, anchor: undefined } : c,
      )
      return trimToWork({ ...base, children: moved }, 0)
    }
    const lines = limitRows(panel(summary ? cut() : all, 0, 0, '', ownId))
    drawRows = lines.length
    const lanes = guides(lines)
    const hides = labelCols(lines)

    // The header: the level-1 task in progress (or "Tarefas"), the count, and chips for what
    // is in progress, waiting, interrupted and the sessions at work.
    const mainTasks = withMain(held ?? []).find(g => g.agent === MAIN)?.tasks ?? []
    // With none open, the level-1 task a session is still at work under.
    const headTask =
      mainTasks.find(t => t.id === current(mainTasks).lit[0]) ?? mainTasks.find(t => atWork(t, sessions, 0).busy)
    const head = headTask?.title ?? 'Tarefas'
    // The header counts, times and chips what the view draws: the tasks the drawn lines stand
    // for (Row.nodes), so the summary view's header is the summary's and the full view's, with its
    // group limit, the drawn groups'. The whole session's count stays in the tooltip.
    const shown = lines.flatMap(r => r.nodes ?? [])
    const [d, n, x] = count(shown)
    const tally = (pick: (r: Row) => boolean | undefined) => lines.filter(pick).length
    const headTime = sessionTime(shown, tally(r => r.live) > 0 || hasOpen(shown), now)
    // A notice is a wait; a session waiting counts only when it published no notice of its own.
    const sentIds = queued.map(q => q.anchor ?? '')
    const active = flat(shown).filter(t => t.status === 'open' && t.children.length === 0 && !sentIds.includes(t.id)).length
    const whole = ad !== d || an !== n ? `sessão inteira: ${ad} de ${an}` : ''
    const list = chips(active, tally(r => (r.tone === 'wait' && r.label === '') || r.pending), x, tally(r => r.live), tally(r => r.tone === 'sent'))
    const errorLine = sessionsError ? <Text key="error" dimColor>Sessões indisponíveis: {sessionsError}</Text> : null

    // The ▾/▸ of a line with something below it: a press closes what is open, opens what is
    // closed. A Button, since a press does not go through an Svg.
    const { Button } = ui
    // No ▾/▸ (the person's words: "quero que o botao de colapse nao apareca, e que a funcao de
    // colapsar e expandir esteja no icone de progresso da tarefa"): a line with something below it
    // folds and opens by its progress icon, a plain Button (the pointer inverts it); a line with
    // nothing below has no Button. Terminal: the icon glyph is the Button. Desktop: the Svg draws
    // the icon and a Button with an empty label lies over it.
    const press = (r: Row) => () => void setFold($, (r.fold as any).key, (r.fold as any).open)
    const iconButton = (r: Row, glyph: string, color: string) => (
      <Button key={`fold:${(r.fold as any).key}`} plain onPress={act(`fold:${(r.fold as any).key}`, press(r))}>
        <Text color={color}>{glyph}</Text>
      </Button>
    )
    // Desktop: the line stays one drawing (the icon in its color, the label inside its card). Only
    // the progress icon folds it (on a session's card, the ⑂ left of its name): an empty-label
    // Button over the icon, its native highlight the icon's size with some room around it. A Box is
    // placed in whole cells, the line's whole height, and centers the Button both ways; where each
    // Box goes (the icon's, the ring's, the name layer's), in cells anchored by the nearest edge, is
    // the geometry module's `overlay`. A line with nothing below has no Button.
    // The context ring at a session card's right end opens that session (the person's words:
    // "quando clicar nele, abra a sessao que ele representa"): an empty-label Button over the ring,
    // as over the icon. The app shows it in this window's main pane (open_session_in, focus); what
    // it refuses is said in a toast.
    const ringOver = (r: Row, f: Frame) => {
      const { right, width } = overlay('ring', Math.max(0, f.cards.length - 1))
      return (
        <Box position="absolute" top={0} bottom={0} right={right} width={width} flexDirection="row" alignItems="center" justifyContent="center">
          <Button key={`open:${r.sid}`} label={RING_LABEL} plain onPress={act(`open:${r.sid}`, () => void openSession($, r.sid as string, r.title))} />
        </Box>
      )
    }
    const foldOver = (r: Row) => {
      const { left, width } = overlay('icon', r.depth)
      return (
        <Box position="absolute" top={0} bottom={0} left={left} width={width} flexDirection="row" alignItems="center" justifyContent="center">
          <Button key={`fold:${(r.fold as any).key}`} label={' '} plain onPress={act(`fold:${(r.fold as any).key}`, press(r))} />
        </Box>
      )
    }
    // A cut name keeps its tooltip, over the whole name (from where it is drawn), clear of the
    // icon's Button.
    const nameLayer = (r: Row, source: string, H: number, RWidth: number) => {
      const { Svg } = ui
      const { left, width: w } = overlay('name', r.depth, RWidth)
      return (
        <Box position="absolute" top={0} left={left}>
          <Svg source={hoverLayer(source, w, H)} alt="" width={w} height={H} isInteractive />
        </Box>
      )
    }

    // The view toggle: two icon buttons at the right end of the header's title line, ≡ the
    // summary (what is in progress), ▤ the whole tree. The chosen one is the surface's primary
    // (highlighted) button, the other dim; on the terminal the chosen one is in brackets. A desktop
    // draws a Button's `label` as its text, so the label is the glyph alone; which view is chosen
    // is said in the header's alt.
    const VIEWS = [
      ['summary', '≡'],
      ['full', '▤'],
    ] as const
    const views =
      e.surface === 'desktop'
        ? VIEWS.map(([v, glyph]) =>
            view === v ? (
              <Button key={`view:${v}`} label={glyph} variant="primary" onPress={act(`view:${v}`, () => void setView($, v))} />
            ) : (
              <Button key={`view:${v}`} label={glyph} plain dimColor onPress={act(`view:${v}`, () => void setView($, v))} />
            ),
          )
        : VIEWS.flatMap(([v, glyph], i) => [
            ...(i > 0 ? [<Text key="gap"> </Text>] : []),
            <Button key={`view:${v}`} label={view === v ? `[${glyph}]` : glyph} plain dimColor={view !== v} onPress={act(`view:${v}`, () => void setView($, v))} />,
          ])

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = lineWidth((e.props as any).bodyColumns || 40)
      const top = headerSvg(head, d, n, list, W, headTime)
      const alt =
        (n + x === 0
          ? 'Nenhuma tarefa planejada'
          : [
              `${head}: ${d} de ${n} (${percent(d, n)}%)`,
              ...(headTime !== undefined ? [clockText(headTime)] : []),
              ...list.map(c => c.text),
            ].join(', ')) + (whole ? `; ${whole}` : '') + `. Visão: ${summary ? 'resumida' : 'completa'}, selecionada (≡ resumida, ▤ completa)`
      // Each line: its Svg, the tooltip layer over a cut name and, over the icon, the Button that
      // folds and opens it (drawn last, on top).
      const RW = W
      const cards = frames(lines)
      return (
        <Box flexDirection="column">
          {errorLine}
          <Box key="head" position="relative">
            <Svg source={top.source} alt={alt} width={W} height={top.height} />
            {hovers(top.source) ? (
              <Box position="absolute" top={0} left={0}>
                <Svg source={hoverLayer(top.source, W - 64, 24)} alt="" width={W - 64} height={24} isInteractive />
              </Box>
            ) : null}
            <Box position="absolute" top={0} right={0} flexDirection="row" alignItems="center">
              {views}
            </Box>
          </Box>
          {lines.map((r, i) => (
            <Box key={`r${i}`} flexDirection="row" alignItems="center">
              {(source => (
                <Box position="relative">
                  <Svg source={source} alt={rowAlt(r)} width={RW} height={rowHeight(r, cards[i])} />
                  {r.fold ? foldOver(r) : null}
                  {r.session && r.sid && r.ring ? ringOver(r, cards[i]) : null}
                  {hovers(source) ? nameLayer(r, source, rowHeight(r, cards[i]), RW) : null}
                </Box>
              ))(rowSvg(r, lanes[i], cards[i], RW, hides[i]))}
            </Box>
          ))}
        </Box>
      )
    }

    // Terminal: the same lines as text, the guides in box-drawing characters, color only on
    // the icon; the ▾/▸ in the guides, before the icon.
    const header =
      n + x === 0
        ? [
            <Box key="head" flexDirection="row">
              <Text dimColor>Nenhuma tarefa planejada.</Text>
              <Text>{'  '}</Text>
              {views}
            </Box>,
          ]
        : [
            <Box key="head" flexDirection="row">
              <Text>
                <Text bold>{head}</Text>
                {`  ${d} de ${n} · ${percent(d, n)}%`}
                {headTime !== undefined ? <Text dimColor>{`  ${clockText(headTime)}`}</Text> : null}
                {whole ? <Text dimColor>{`  (${whole})`}</Text> : null}
              </Text>
              <Text>{'  '}</Text>
              {views}
            </Box>,
            <Text key="bar">
              <Text color="success">{ratioBar(d, n, 20)[0]}</Text>
              <Text color="inactive">{ratioBar(d, n, 20)[1]}</Text>
              {list.map(c => (
                <Text key={c.tone} color={GLYPH[c.tone][1]}>{`  ${c.tone === 'current' ? '●' : GLYPH[c.tone][0]} ${c.text.split(' ')[0]}`}</Text>
              ))}
            </Text>,
          ]
    return (
      <Box flexDirection="column">
        {errorLine}
        {header}
        {lines.map((r, i) => {
          const [glyph, color] = GLYPH[progress(r)]
          const forked = r.session === true || r.kids === true
          const quiet = r.tone === 'done' || r.tone === 'interrupted' || r.tone === 'archived' || r.tone === 'section' || r.tone === 'reply'
          const words = rightText(r)
          const time = typeof r.time === 'number' ? clockText(r.time) : r.time === null ? '—' : ''
          const tail = (forked ? '  ⑂' : '') + (words ? `  ${words}` : '') + (time ? `  ${time}` : '')
          const lead = prefix(r, lanes[i], hides[i])
          // A session's label: its name (the Button that folds its card), its tags, no count or time.
          // A session's label: the ⑂ (the Button that folds the card) left of its name, then its tags.
          const parts = r.session ? [
            r.fold ? iconButton(r, '⑂', 'inactive') : <Text key="icon" color="inactive">{'⑂'}</Text>,
            <Text key="title" bold dimColor>{` ${r.title}`}</Text>,
            r.fold && !r.fold.open ? <Text key="more" dimColor>{' ⋯'}</Text> : null,
            // Waiting on the person: the word in amber (the label has no icon to color).
            r.meta ? (
              <Text key="meta" color={r.tone === 'wait' || r.meta === 'aguardando' ? 'warning' : undefined} dimColor={r.meta !== 'aguardando'}>{`  ${r.meta}`}</Text>
            ) : null,
            // The context ring last, on its own.
            r.ring ? <Text key="ring" color={ringTerm(r.ring.percent)}>{`  ${r.ring.percent}%`}</Text> : null,
          ] : [
            glyph ? r.fold ? iconButton(r, glyph, color) : <Text key="icon" color={color}>{glyph}</Text> : null,
            <Text key="title" bold={r.strong} dimColor={quiet}>{glyph ? ` ${r.title}` : r.title}</Text>,
            r.fold && !r.fold.open ? <Text key="more" dimColor>{' ⋯'}</Text> : null,
            tail ? <Text key="tail" dimColor>{tail}</Text> : null,
          ]
          if (!r.fold) {
            return (
              <Text key={`r${i}`}>
                {lead ? <Text color="inactive">{lead}</Text> : null}
                {parts}
              </Text>
            )
          }
          return (
            <Box key={`r${i}`} flexDirection="row">
              {lead ? <Text color="inactive">{lead}</Text> : null}
              {parts}
            </Box>
          )
        })}
      </Box>
    )
    })()
    // The drawing's size, said by /task-tree; past DRAW_LIMIT the app stopped showing the pane (a
    // long session's history, 1.3 MB): an emergency drawing says so in one line instead.
    drawSize = JSON.stringify(drawn ?? null).length
    if (drawSize > DRAW_LIMIT) {
      await debug($, `task-tree: desenho de ${Math.round(drawSize / 1024)} KB, acima de ${Math.round(DRAW_LIMIT / 1024)} KB`)
      const { Text } = $.ui.resolve(e) as any
      return (
        <Text color="warning">{`Painel grande demais (${Math.round(drawSize / 1024)} KB): mostrando só o essencial. Use ≡ (/task-tree resumida) para a visão resumida.`}</Text>
      )
    }
    return drawn
   } catch (err) {
      renderError = String((err as any)?.stack ?? err).slice(0, 600)
      await debug($, `task-tree: erro ao desenhar o painel: ${renderError}`)
      const { Text } = $.ui.resolve(e) as any
      return <Text color="error">{`Painel de tarefas: erro ao desenhar: ${String(err).slice(0, 300)}`}</Text>
    }
  })
}
