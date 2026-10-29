// turn.step: the main loop's model and effort, published for the card. turn.complete: the turn's
// answer (the recap, else the final message) goes on its turn for the card; a subagent's turn ending
// interrupts what it left open.

import type { AgentInfo, EngineInterface } from 'claude-code'

import { BRIEF } from '../text/rules'
import { MAIN, hasOpen, interrupt } from '../draw/layout'
import { engineText } from '../io/host'
import { change, dropAsked, dropWaits, lastBrief, lastRecap, publishPanel, saveTurn, stamp } from './panel'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const engineState = { plugin: 'task-tree', key: 'engine' } as const
const rateState = { plugin: 'task-tree', key: 'rate' } as const
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

// The output rate of the main loop, "n toks/s" (the person's words: "a contagem de tokens por
// segundo de cada sessão, usando o padrão 'n toks/s'"): each model call of the turn is a sample,
// its output tokens (the step's usage) over its duration (this hook sees the call begin and end).
// The rate is the samples of the last RATE_WINDOW ms summed, tokens over time spent in the calls
// (not over the wall clock: between calls the model writes nothing, and the tools' time would drag
// the number down); with none that recent in a turn still going, the last three. The kit gives no
// rate of its own ($.session.usage has context, cost and limits), so each session measures its own
// and publishes it for its card.
export const RATE_WINDOW = 10000
type Sample = { at: number; tokens: number; ms: number }
let samples: Sample[] = []
export function rateOf(list: Sample[], now: number): number | undefined {
  const recent = list.filter(s => now - s.at <= RATE_WINDOW)
  const used = recent.length > 0 ? recent : list.slice(-3)
  const ms = used.reduce((a, s) => a + s.ms, 0)
  return ms > 0 ? Math.round((used.reduce((a, s) => a + s.tokens, 0) * 1000) / ms) : undefined
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
  const t0 = main ? await stamp($) : undefined
  const r = yield* next(e)
  const tokens = r?.usage?.output_tokens
  if (t0 !== undefined && typeof tokens === 'number') {
    const t1 = await stamp($)
    if (t1 !== undefined && t1 > t0) {
      samples = [...samples, { at: t1, tokens, ms: t1 - t0 }].slice(-20)
      const toks = rateOf(samples, t1)
      if (toks !== undefined && (await $.state.get(rateState)).value?.toks !== toks) {
        await $.state.set(rateState, { toks, at: t1, live: true })
        void publishPanel($).catch(() => {})
      }
    }
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
  // The turn's output rate closes into its mean over the whole turn, shown dim until the next turn
  // (the person's choice for a stopped session); the samples start over with the next turn.
  if (!agent) {
    const ms = samples.reduce((a, s) => a + s.ms, 0)
    const mean = ms > 0 ? Math.round((samples.reduce((a, s) => a + s.tokens, 0) * 1000) / ms) : undefined
    samples = []
    const cur = (await $.state.get(rateState)).value
    if (mean !== undefined) await $.state.set(rateState, { toks: mean, at: (await stamp($)) ?? 0, live: false })
    else if (cur && cur.live) await $.state.set(rateState, { ...cur, live: false })
  }
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
