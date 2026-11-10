// turn.step: the main loop's model and effort, published for the card. turn.complete: the turn's
// answer (the recap, else the final message) goes on its turn for the card; a subagent's turn ending
// interrupts what it left open.

import type { AgentInfo, EngineInterface } from 'claude-code'

import { BRIEF } from '../text/rules'
import { MAIN, hasOpen, interrupt } from '../draw/layout'
import { engineText } from '../io/host'
import { change, dropAsked, dropWaits, lastBrief, lastRecap, publishPanel, saveTurn, stamp } from './panel'
import { settleBySubs, subEnd, subStep } from './agents'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const engineState = { plugin: 'task-tree', key: 'engine' } as const
const rateState = { plugin: 'task-tree', key: 'rate' } as const
const ultracodeState = { plugin: 'task-tree', key: 'ultracode' } as const
const briefState = { plugin: 'task-tree', key: 'brief' } as const
const recapState = { plugin: 'task-tree', key: 'recap' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const
const turnAbortedState = { plugin: 'task-tree', key: 'turnAborted' } as const

// The ↩ line says the answer in at most BRIEF characters (the text module's, cited in every text
// that names the limit): the summary the session gave, else the first sentence of the answer;
// longer, cut at a word with "…". The whole answer stays in the tooltip.
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
export async function* turnStep($: EngineInterface, e: any, next: any) {
  const main = !e.agentId
  if (main && typeof e.model === 'string') {
    const text = engineText(e.model, e.effort)
    if ((await $.state.get(engineState)).value !== text) {
      await $.state.set(engineState, text)
      void publishPanel($).catch(() => {})
    }
  }
  // The chunks pass through as they come; the clock is read at the first one and at the 'stop'.
  const it = next(e)
  let first: number | undefined
  let stop: { tokens: number; at: number } | undefined
  let step = await it.next()
  while (!step.done) {
    const chunk = step.value
    if (first === undefined) first = await stamp($)
    if (chunk?.kind === 'stop' && typeof chunk.usage?.output_tokens === 'number') stop = { tokens: chunk.usage.output_tokens, at: (await stamp($)) ?? 0 }
    yield chunk
    step = await it.next()
  }
  const r = step.value
  const toks = first !== undefined && stop ? speedOf(stop.tokens, stop.at - first) : undefined
  // A subagent's step: its card's model, effort and rate (hooks/agents).
  if (!main) {
    await subStep($, String(e.agentId), e, toks)
    return r
  }
  if (toks !== undefined && (await $.state.get(rateState)).value?.toks !== toks) {
    await $.state.set(rateState, { toks, at: stop!.at, live: true })
    void publishPanel($).catch(() => {})
  }
  return r
}

export async function turnComplete($: EngineInterface, e: any, next: any) {
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
    const recap = await lastRecap($)
    const said = (recap ?? e.answer ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)
    const given = await lastBrief($)
    const short = given !== undefined ? brief(given) : undefined
    if (recap !== undefined) await $.state.set(recapState, '')
    if (given !== undefined) await $.state.set(briefState, '')
    // The turn's ↩ is the done's summary; it is kept even when the turn ended with no text of its own
    // (the model stopped right after a tool), the answer in its tooltip only when there is one.
    if (said !== '' || short !== undefined) {
      await change($, all =>
        all.map(g => {
          if (g.agent !== MAIN) return g
          const turns = g.turns ?? []
          const last = [...turns].reverse().find(u => g.tasks.some(t => t.turn === u.id))
          return last
            ? { ...g, turns: turns.map(u => (u.id === last.id ? { ...u, ...(said !== '' ? { reply: said } : {}), ...(short !== undefined ? { brief: short } : {}) } : u)) }
            : g
        }),
      )
    }
  }
  // The turn ended: what it left open is not in progress until the next prompt (the person: a session
  // that ended its turn shows no task running), drawn with no close and its clock stopped here.
  if (!agent) await $.state.set(turnEndedState, (await stamp($)) ?? 0)
  // The turn is over: a task whose work was subagents, all ended, reflects their end (hooks/agents).
  if (!agent && !e.isAborted) await settleBySubs($)
  // The turn's output rate stays as it is, lit (the person, 2026-11-10: "Fica aceso").
  // Interrupted (stopped) before it was over: the next message of another session is reminded to
  // replan (prompt.submit); the person's own next prompt clears it.
  if (!agent) await $.state.set(turnAbortedState, e.isAborted === true)
  // The end in the store too: a new process draws it as stopped (see saveTurn).
  if (!agent) await saveTurn($)
  // The turn's answer grew the context: publish its share for the session that opened this one.
  if (!agent) await publishPanel($)
  if (agent) {
    const info = ((await $.agent.list()) as AgentInfo[]).find(a => a.id === agent)
    if (info?.type !== 'teammate' && info?.teammateId === undefined) {
      await subEnd($, agent, e)
      await dropWaits($, w => w.agent !== agent)
      const { value } = await $.state.get(groupsState)
      if (value?.some(g => g.agent === agent && hasOpen(g.tasks))) {
        const now = await stamp($)
        await change($, all => all.map(g => (g.agent === agent ? { ...g, tasks: g.tasks.map(interrupt(now)) } : g)))
      }
    }
  }
  return r
}
