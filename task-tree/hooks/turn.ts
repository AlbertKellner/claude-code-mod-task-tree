// turn.step: the main loop's model and effort, published for the card. turn.complete: the turn's
// answer (the recap, else the final message) goes on its turn for the card; a subagent's turn ending
// interrupts what it left open.

import type { AgentInfo, EngineInterface } from 'claude-code'

import { BRIEF } from '../text/rules'
import { MAIN, hasOpen, interrupt } from '../draw/layout'
import { engineText } from '../io/host'
import { change, dropAsked, dropWaits, lastBrief, lastRecap, publishPanel, stamp } from './panel'

// The state's keys this file reads or writes, as literals: the kit's validator wants them written in the
// file that calls $.state (../state/durability has a row for every one).
const groupsState = { plugin: 'task-tree', key: 'groups' } as const
const engineState = { plugin: 'task-tree', key: 'engine' } as const
const briefState = { plugin: 'task-tree', key: 'brief' } as const
const recapState = { plugin: 'task-tree', key: 'recap' } as const
const turnEndedState = { plugin: 'task-tree', key: 'turnEnded' } as const

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

// A subagent's turn ending is the subagent ending: what it left open is interrupted.
// A teammate ends a turn per message and is left alone.
// The model and effort of the main loop's requests, published for the card in the session that
// opened this one (the person's words: "mostre o nome do modelo e o esforco de cada sessao").
export async function* turnStep($: EngineInterface, e: any, next: any) {
  if (!e.agentId && typeof e.model === 'string') {
    const text = engineText(e.model, e.effort)
    if ((await $.state.get(engineState)).value !== text) {
      await $.state.set(engineState, text)
      void publishPanel($).catch(() => {})
    }
  }
  return yield* next(e)
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
  // The turn ended: what it left open is not in progress until the next prompt (the person: a session
  // that ended its turn shows no task running), drawn with no close and its clock stopped here.
  if (!agent) await $.state.set(turnEndedState, (await stamp($)) ?? 0)
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
