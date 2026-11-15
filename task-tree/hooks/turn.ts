// turn.step: the main loop's model and effort, published for the card. turn.complete: the turn's
// summary (done's, the ↩ line) goes on its turn; a subagent's turn ending interrupts what it left open.

import type { AgentInfo, EngineInterface } from 'claude-code'

import { BRIEF } from '../text/rules'
import type { Group, Turn } from '../types'
import { MAIN, flat, hasOpen, interrupt } from '../draw/layout'
import { engineText } from '../io/host'
import { debug, guardStep } from '../io/log'
import { change, dropAsked, dropPermissions, dropWaits, lastBrief, publishPanel, saveTurn, stamp } from './panel'
import { settleBySubs, subEnd, subStep } from './agents'
import { syncIdle } from './sessions'
import { ensureGroups } from './panel'
import { park, rest } from '../state/tasks'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const engineState = { plugin: 'task-tree', key: 'engine' } as const
const rateState = { plugin: 'task-tree', key: 'rate' } as const
const ultracodeState = { plugin: 'task-tree', key: 'ultracode' } as const
const briefState = { plugin: 'task-tree', key: 'brief' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const
const turnAbortedState = { plugin: 'task-tree', key: 'turnAborted' } as const
const turnFailedState = { plugin: 'task-tree', key: 'turnFailed' } as const
const replanDueState = { plugin: 'task-tree', key: 'replanDue' } as const

// The ↩ line says the answer in at most BRIEF characters (the text module's, cited in every text
// that names the limit): the summary the session gave (with none, the request has no ↩ line);
// longer, cut at a word with "…".
export function brief(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim()
  if (one.length <= BRIEF) return one
  const cut = one.slice(0, BRIEF - 1)
  const at = cut.lastIndexOf(' ')
  return `${(at > BRIEF / 2 ? cut.slice(0, at) : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}

// The output rate, "n toks/s" (the person's words: "a contagem de tokens por segundo de cada sessão,
// usando o padrão 'n toks/s'"), measured as the session band measures it (the person, 2026-11-10:
// "Medir como o Savvy"): one model call's output tokens over the time from its first chunk to its
// 'stop' chunk, the time before the first chunk (sending, reading the prompt) left out. The number is
// the last valid call's ("Última resposta (Recomendado)"); a call with fewer than MIN_TOKENS tokens,
// under MIN_MS, or over MAX_TOKS is not valid and leaves the number as it was ("Sim, iguais
// (Recomendado)"). The same for the header, a session's card and a subagent's ("Sim, todos").
export const MIN_TOKENS = 20
export const MIN_MS = 500
export const MAX_TOKS = 1000
export function speedOf(tokens: number, ms: number): number | undefined {
  if (!(tokens >= MIN_TOKENS) || !(ms >= MIN_MS)) return undefined
  const toks = Math.round((tokens * 1000) / ms)
  return toks <= MAX_TOKS ? toks : undefined
}

// Whether this session's ultracode switch is on (the person, 2026-11-10: "se a filha está usando
// ultracode"; "Só o interruptor real (Recomendado)"): the engine tells the main loop's model with an
// `ultra_effort_enter` attachment when the switch goes on (and every few turns while it stays on) and
// `ultra_effort_exit` when it goes off. A message saying "ultracode", or the word typed in a prompt
// (`workflow_keyword_request`, one turn's opt-in), turns nothing on. A subagent's request is left
// alone: its own switch is not known (only the main loop gets these attachments).
export async function ultraAttachment($: EngineInterface, e: any, next: any) {
  if (!e.agentId && (e.type === 'ultra_effort_enter' || e.type === 'ultra_effort_exit')) {
    const on = e.type === 'ultra_effort_enter'
    if ((await $.state.get(ultracodeState)).value !== on) {
      await $.state.set(ultracodeState, on)
      void publishPanel($).catch(() => {})
    }
  }
  return next(e)
}

// A subagent's turn ending is the subagent ending: what it left open is interrupted.
// A teammate ends a turn per message and is left alone.
// The model and effort of the main loop's requests, published for the card in the session that
// opened this one (the person's words: "mostre o nome do modelo e o esforco de cada sessao"); and
// the call's output rate (above), published when it changes.
// The panel's reads and writes around the stream never bring the step down: a failure goes to the
// debug log and the answer passes whole. A consumer that stops in the middle (Esc) closes the stream
// below too (finally); an error of the stream below goes up as it came.
export async function* turnStep($: EngineInterface, e: any, next: any) {
  const main = !e.agentId
  try {
    if (main && typeof e.model === 'string') {
      const text = engineText(e.model, e.effort)
      const prev = (await $.state.get(engineState)).value
      if (prev !== text) {
        await $.state.set(engineState, text)
        // Another model (the effort alone does not count): the old one's rate goes until the new one
        // measures (the person, 2026-11-15: "Some até a medida nova (Recomendado)").
        if (typeof prev === 'string' && prev !== '' && prev.split(' · ')[0] !== engineText(e.model)) await $.state.set(rateState, null)
        void publishPanel($).catch(() => {})
      }
    }
  } catch (err) {
    await debug($, `task-tree: passo do modelo, antes do stream: ${String(err)}`)
  }
  // The chunks pass through as they come; the clock is read at the first one and at the 'stop'.
  const it = next(e)
  let first: number | undefined
  let stop: { tokens: number; at: number } | undefined
  let over = false
  let step: IteratorResult<any, any>
  try {
    step = await it.next()
    while (!step.done) {
      const chunk = step.value
      if (first === undefined) first = await stamp($)
      if (chunk?.kind === 'stop' && typeof chunk.usage?.output_tokens === 'number') stop = { tokens: chunk.usage.output_tokens, at: (await stamp($)) ?? 0 }
      yield chunk
      step = await it.next()
    }
    over = true
  } finally {
    if (!over && typeof it?.return === 'function') await Promise.resolve(it.return(undefined)).catch(() => {})
  }
  const r = step.value
  try {
    const toks = first !== undefined && stop ? speedOf(stop.tokens, stop.at - first) : undefined
    // A subagent's step: its card's model, effort and rate (hooks/agents).
    if (!main) await subStep($, String(e.agentId), e, toks)
    else if (toks !== undefined && (await $.state.get(rateState)).value?.toks !== toks) {
      await $.state.set(rateState, { toks, at: stop!.at, live: true })
      void publishPanel($).catch(() => {})
    }
  } catch (err) {
    await debug($, `task-tree: passo do modelo, depois do stream: ${String(err)}`)
  }
  return r
}

// The request a turn's answer goes to (the person, 2026-11-14: "Pedido próprio (Recomendado)"): the one the
// last message opened (the last turn) when it has a level-1 task; with none, the last request with tasks
// when the turn touched a task of it (a start, a done or a plan since the message: it continues that
// plan), else the request itself when there is a summary (it becomes a request with only its ↩ line),
// else none: the ↩ of the request before, over already, is not overwritten. Read before what the end
// of the turn writes on the tasks (settleBySubs, rest). A turn with no time (an earlier version's) counts
// as touched.
function answeredTurn(g: Group, summary: boolean): Turn | undefined {
  const turns = g.turns ?? []
  const cur = turns[turns.length - 1]
  const last = [...turns].reverse().find(u => g.tasks.some(t => t.turn === u.id))
  if (cur === undefined || cur === last) return last
  const since = cur.at
  const touched = since === undefined || flat(g.tasks).some(t => [t.startedAt, t.endedAt, t.plannedAt].some(x => typeof x === 'number' && x >= since))
  if (touched) return last
  return summary ? cur : undefined
}
// One step of the turn's end, its failure said in the debug log ("fim do turno, passo <nome>").
async function guarded($: any, name: string, run: () => Promise<unknown>) {
  try {
    await run()
  } catch (err) {
    await debug($, `task-tree: fim do turno, passo ${name}: ${String(err)}`)
  }
}
export async function turnComplete($: EngineInterface, e: any, next: any) {
  const r = await next(e)
  const agent = e.agentId
  // A turn of the main loop that died by an error (an API failure, the context limit) or a refusal is
  // stopped as the Esc stops it, its word "falhou" (the person, 2026-11-14: "✕ \"falhou\" (Recomendado)").
  const failed = !agent && e.isAborted !== true && (e.reason === 'error' || e.reason === 'refusal')
  const halted = e.isAborted === true || failed
  // A question or plan dialog never outlives the turn that opened it (one answered by a chat
  // message may end without the call returning here).
  // The main loop's accessory steps each on their own (guardStep, the failure in the debug log once):
  // the turn's end, its marks and its copy in the store are written whatever fails around them. The
  // order does not change.
  await guardStep($, 'fim do turno', 'dropAsked', () => dropAsked($, agent ?? MAIN))
  // A permission wait the main loop left over (its call never ended here) does not outlive the turn.
  if (!agent) await guardStep($, 'fim do turno', 'dropPermissions', () => dropPermissions($, MAIN))
  // What the turn answered, kept on its turn (the last one of the main group) and published: only its
  // summary (done's, the ↩ line), drawn under the turn's tasks and in this session's card in the one
  // that opened it. The whole answer is not kept (the person, 2026-11-14: "Tirar, basta o ↩
  // (Recomendado)"), and the `reply` earlier versions wrote goes in the same write.
  // The summary goes at the end of every turn, stopped too: a stopped turn records no ↩, and what it
  // left must not become the next request's.
  const given = agent ? undefined : await guardStep($, 'fim do turno', 'lastBrief', () => lastBrief($))
  if (given !== undefined) await guardStep($, 'fim do turno', 'limpar o resumo', () => $.state.set(briefState, ''))
  if (!agent && !halted && given !== undefined) await guardStep($, 'fim do turno', 'resumo do turno', async () => {
    const short = brief(given)
    // The turn's ↩ is the done's summary; it is kept even when the turn ended with no text of its own
    // (the model stopped right after a tool).
    const bare = (u: Turn): Turn => {
      const { reply: _, ...rest } = u as Turn & { reply?: unknown }
      return rest
    }
    await change($, all =>
      all.map(g => {
        if (g.agent !== MAIN) return g
        const turns = (g.turns ?? []).map(bare)
        const last = answeredTurn(g, true)
        return last ? { ...g, turns: turns.map(u => (u.id === last.id ? { ...u, brief: short } : u)) } : g
      }),
    )
  })
  // The turn ended: what it left open is not in progress until the next prompt (the person: a session
  // that ended its turn shows no task running), drawn with no close and its clock stopped here.
  const endedAt = agent ? undefined : await stamp($)
  if (!agent) await $.state.set(turnEndedState, endedAt ?? 0)
  // The turn is over: a task whose work was subagents, all ended, reflects their end (hooks/agents).
  if (!agent && !e.isAborted) await guardStep($, 'fim do turno', 'settleBySubs', () => settleBySubs($))
  // What it left in progress waits on the task itself until its start (rest, state/tasks).
  if (!agent && !halted) await guardStep($, 'fim do turno', 'rest', async () => {
    await ensureGroups($)
    const { value: now = [] } = await $.state.get(groupsState)
    if (now.some(g => g.agent === MAIN && hasOpen(g.tasks)))
      await change($, all => all.map(g => (g.agent === MAIN ? { ...g, tasks: g.tasks.map(rest(endedAt)) } : g)))
  })
  // The turn's output rate stays as it is, lit (the person, 2026-11-10: "Fica aceso").
  // Interrupted (stopped) before it was over: the next message of another session is reminded to
  // replan (prompt.submit); the person's own next prompt clears it.
  if (!agent) await $.state.set(turnAbortedState, halted)
  // Why: an error (the next request's reminder says so), until the next request.
  if (!agent) await $.state.set(turnFailedState, failed)
  // The replan the stop asks for waits on the next request (prompt.submit clears it there): a turn
  // that opened no request (the app's notice, a hand-back) and ended normally leaves it as it is
  // (the person, 2026-10-27: "precisa replanejar quando eu interrompo e envio nova mensagem").
  if (!agent && halted) await $.state.set(replanDueState, true)
  // What the stop found in progress is marked on the tasks themselves (park), in the state and the
  // store: it reads as interrupted until its next start, through the turns that open no request and
  // those that start another task (the person, 2026-11-12: "Segue ✕ até novo start (Recomendado)").
  // The groups come back from the store first (a respawn with no session.start).
  if (!agent && halted) await guardStep($, 'fim do turno', 'park', async () => {
    await ensureGroups($)
    const { value: now = [] } = await $.state.get(groupsState)
    if (now.some(g => g.agent === MAIN && hasOpen(g.tasks)))
      await change($, all => all.map(g => (g.agent === MAIN ? { ...g, tasks: g.tasks.map(park(endedAt, failed)) } : g)))
  })
  // The end in the store too: a new process draws it as stopped (see saveTurn).
  if (!agent) await saveTurn($)
  // Nothing alive past the turn: the session stands stopped from its end on (syncIdle).
  if (!agent) await guardStep($, 'fim do turno', 'syncIdle', () => syncIdle($, endedAt))
  // The turn's answer grew the context: publish its share for the session that opened this one.
  if (!agent) await guardStep($, 'fim do turno', 'publishPanel', () => publishPanel($))
  // A subagent's end: each step on its own (a failure goes to the debug log and the next one runs); a
  // list of agents that fails reads as "not a teammate", so the end goes on.
  if (agent) {
    let info: AgentInfo | undefined
    await guarded($, 'lista de agentes', async () => {
      info = ((await $.agent.list()) as AgentInfo[]).find(a => a.id === agent)
    })
    if (info?.type !== 'teammate' && info?.teammateId === undefined) {
      await guarded($, 'subEnd', () => subEnd($, agent, e))
      await guarded($, 'dropWaits', () => dropWaits($, w => w.agent !== agent))
      await guarded($, 'interromper', async () => {
        const { value } = await $.state.get(groupsState)
        if (value?.some(g => g.agent === agent && hasOpen(g.tasks))) {
          const now = await stamp($)
          await change($, all => all.map(g => (g.agent === agent ? { ...g, tasks: g.tasks.map(interrupt(now)) } : g)))
        }
      })
    }
    // The subagent that ends the last thing alive past the turn leaves the session stopped (syncIdle).
    await syncIdle($)
  }
  return r
}
