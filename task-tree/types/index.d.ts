// open: to do; done: finished; interrupted: a subagent ended (or the session was resumed)
// with it still open. Interrupted tasks are kept out of the done/total count.
export type Status = 'open' | 'done' | 'interrupted'

// `id` is the full id ("D/1.1": a level-1 id prefixes the ids below it); `short` is the
// id the plan gave ("1.1"). `started` orders the tasks marked in progress with start.
// `startedAt`/`endedAt` (ms since the epoch) time a task from its start to its close; both
// optional, so panels published by earlier versions read the same.
export type TaskNode = {
  id: string
  short: string
  title: string
  status: Status
  started?: number
  startedAt?: number
  endedAt?: number
  // When the task was planned: where a task closed with no start starts, at the latest.
  plannedAt?: number
  // A level-1 task of the main group: the turn (the person's message) it was planned in.
  turn?: number
  children: TaskNode[]
}

// One message of the person in the main loop: its level-1 tasks are drawn under it, titled with
// what was asked (the start of the message, until a plan names it with `request`).
// `reply`: what the session answered when the turn ended (its end-of-turn recap, else its final
// message), shown under the turn's tasks in its card; absent while the turn runs.
// reply: the turn's answer (whole); brief: it in at most 120 characters, the ↩ line.
export type Turn = { id: number; title: string; at?: number; reply?: string; brief?: string }

// The tasks of one loop: the main one (agent '') or a subagent's (its agentId), whose
// header shows `label` ("Explore: <description>"). A subagent's group is drawn under
// `anchor`, the task the loop that launched it (`parent`) was on at launch. `turns`, the main
// group's only, in order; absent in panels of earlier versions, whose tasks are drawn loose.
export type Group = { agent: string; label: string; parent?: string; anchor?: string; turns?: Turn[]; tasks: TaskNode[] }

// An Agent call, recorded at launch until the subagent's group claims it.
export type Launch = { parent: string; anchor?: string; description: string }

// Something waiting on the person: a question, a choice in the desktop app's end-of-turn
// box (wrap_up with `ask` and buttons), a plan to approve, a permission.
export type Wait = {
  agent: string
  kind: 'question' | 'choice' | 'plan' | 'permission'
  tool: string
  key: string
}

// A session's whole panel, as it publishes it for the session that opened it (see waitFile):
// its groups, what waits on the person and the sessions it opened in turn.
// `work`: its current work (the summary view's level-1 tasks), absent from earlier versions.
// `received`: the messages of other sessions it got (see the state's `received`): a sister's
// message opens a card of its own, as one from the session drawing it does.
// `sends`: its messages not yet taken up by the session they went to (its tasks show ✉ meanwhile).
export type Panel = { groups: Group[]; waits: Wait[]; children: Child[]; work?: string[]; received?: { from: string; at: number }[]; sends?: Send[] }

// A session this one opened with start_session (the desktop app's linked sessions):
// `running` while it works; `waiting` while it waits on the person (a question, a plan,
// a permission), as that session publishes it (see waitFile); `anchor` is the task the main loop was on when it opened it;
// `panel` is that session's own panel, drawn under it and counted with this one's tasks.
// `tasks` (its main group only) is what earlier versions published.
export type Child = {
  id: string
  name: string
  title: string
  running: boolean
  archived: boolean
  waiting?: boolean
  // Just opened (start_session) and not yet seen running or waiting by the host.
  starting?: boolean
  // The share of its context window the session has used (0-100), as it publishes it; absent until
  // its first answer, or from earlier versions.
  context?: number
  // Its model and effort in a few words ("Opus 5.5 · high"), as it publishes them; absent until its
  // first model request, or from earlier versions.
  engine?: string
  // The task the main loop was on when it last sent this session a message (SendMessage): where the
  // summary view draws it when that task is in the current work.
  lastAnchor?: string
  // The messages the main loop sent this session (SendMessage): when (ms, before the send) and the
  // task it was sent from. The turns the session opened after each one are drawn in a card of their
  // own under that task (see split in the hooks); absent from earlier versions.
  rounds?: { at: number; anchor?: string }[]
  // Drawn only: which of those cards this is (0 the opening message's).
  part?: number
  anchor?: string
  panel?: Panel
  tasks?: TaskNode[]
}

// A message the main loop sent another session (SendMessage) that was queued, not yet taken up:
// `anchor` is the task it was sent from; `idle` once the session was seen stopped after the send,
// `taken` once it was seen running again (it started on the message).
// `delivered`: the session took it at once ("its turn has started"); kept until seen taken up, so
// its task shows ✉ meanwhile, with no reminder when taken.
export type Send = { to: string; anchor?: string; at?: number; idle?: boolean; taken?: boolean; delivered?: boolean }

// The shape of `tasks` before groups: migrated into the main group once.
export type LegacyNode = { id: string; title: string; done: boolean; children: LegacyNode[] }

// `ended`: the sessions whose turn ended, until the main loop is reminded of their task.
// `sends`: messages to other sessions still queued, until taken up and the main loop reminded.
// `view`: the pane's view, the whole tree ('full', the default) or what is in progress ('summary').
// `received`: the messages of other sessions this one got (from, when), published for their senders
// to confirm a queued SendMessage.
// `work`: the main group's level-1 tasks of the current work, drawn by the summary view until new
// work starts (a plan or start with no open task left).
// `collapsed`: the pane's open/closed lines the person chose (true closed, false open); a line
// with no entry keeps its default.
declare module 'claude-code' {
  interface PluginState {
    'task-tree': { tasks: LegacyNode[]; groups: Group[]; waits: Wait[]; launches: Launch[]; children: Child[]; childrenError: string; ended: string[]; collapsed: Record<string, boolean>; sends: Send[]; view: 'full' | 'summary'; work: string[]; received: { from: string; at: number }[]; engine: string }
  }
}
