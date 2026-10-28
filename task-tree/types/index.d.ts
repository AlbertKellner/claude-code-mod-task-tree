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
  // The order of the start, kept after the done: breaks a tie of startedAt (two starts in one ms).
  startedSeq?: number
  startedAt?: number
  endedAt?: number
  // When the task was planned: where a task closed with no start starts, at the latest.
  plannedAt?: number
  // A level-1 task of the main group: the turn (the person's message) it was planned in.
  turn?: number
  // A message task: a message to another session (SendMessage) went out from it. It keeps the ✉ in
  // every state, only its color changing, and counts in no x/y (the person's words: "quero
  // diferenciar as tarefas de execução, das tarefas de mensagem").
  msg?: boolean
  // A message task left out of a replan while its message is still queued: kept, drawn until delivered.
  kept?: boolean
  children: TaskNode[]
}

// One message of the person in the main loop: its level-1 tasks are drawn under it, titled with
// what was asked (the start of the message, until a plan names it with `request`).
// `reply`: what the session answered when the turn ended (its end-of-turn recap, else its final
// message), shown under the turn's tasks in its card; absent while the turn runs.
// reply: the turn's answer (whole); brief: it in at most 120 characters, the ↩ line.
// `own`: a turn the person opened by typing in that session (not a message of another session): its
// card goes at the end of the request that opened the session, not under the last message's task.
// `msg` and `from`: a turn opened by another session's message (its first, when several came
// together), and who sent it (its id and name as the message's tag says them). Its level-1 tasks
// derive from that message: they show the ✉ of a message received, in their own state's color.
export type Turn = { id: number; title: string; at?: number; reply?: string; brief?: string; own?: boolean; msg?: boolean; from?: { id: string; name?: string } }

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
  // The task in progress of the loop when it was opened (a question, a plan, a choice): no message
  // is anchored there while it waits (sendAnchor). Absent from earlier versions and for a permission.
  anchor?: string
}

// A session's whole panel, as it publishes it for the session that opened it (see waitFile):
// its groups, what waits on the person and the sessions it opened in turn.
// `work`: its current work (the summary view's level-1 tasks), absent from earlier versions.
// `received`: the messages of other sessions it got (see the state's `received`): a sister's
// message opens a card of its own, as one from the session drawing it does.
// `sends`: its messages not yet taken up by the session they went to (its tasks show ✉ meanwhile).
export type Panel = { groups: Group[]; waits: Wait[]; children: Child[]; work?: string[]; received?: { from: string; at: number }[]; sends?: Send[] }

// A session's output rate: `toks` tokens a second (rounded), measured `at`, `live` while the turn
// it measures is in course (else the last turn's mean, drawn dim).
export type Rate = { toks: number; at: number; live: boolean }
// Where a session's git is (io/git.ts): the repository's folder name and the branch (a detached
// head's short hash, `detached`), read `at`.
// `kind: 'folder'`: no repository there, `repo` is the session's folder (its path shortened) and
// there is no branch; absent, a repository (files published before it carry none).
export type GitInfo = { kind?: 'git' | 'folder'; repo: string; branch?: string; detached?: boolean; at?: number }

// The whole file a session publishes (publishWait writes it, the session that opened it reads it;
// see waitFile): the contract between sessions, which may run different versions of the mod.
// `version` names the shape (absent from versions before it); a file of another version, or one
// that is not an object, is ignored by the readers (parsePublished), never drawn wrong.
// `tasks` is what earlier versions published instead of `groups`. `panes`, `renderError`,
// `drawSize` and `rows` are for reading the file by hand (/task-tree); the readers leave them alone.
export type Published = {
  version?: number
  waiting: boolean
  at?: number
  tasks?: TaskNode[]
  groups?: Group[]
  waits: Wait[]
  children: Child[]
  context?: { percent: number; at: number }
  engine?: string
  // Its output rate, "n toks/s": the mean over the model calls of the last ~10 s of the turn in
  // course (`live`), or of the whole last turn once it ended; absent until its first model call,
  // or from earlier versions.
  rate?: Rate
  // Its repository and branch, as it reads them off its own .git; absent outside a repository, or
  // from earlier versions.
  git?: GitInfo
  // Its last turn ended interrupted (stopped, aborted) and no prompt came since: what it left open
  // was discarded, not merely paused (see discarded in draw/layout); absent from earlier versions.
  aborted?: boolean
  panes?: unknown
  renderError?: string
  // The last drawing: its serialized size and its lines (after the line limit), for the session
  // that opened this one to see how big the panel is; absent from earlier versions.
  drawSize?: number
  rows?: number
  work?: string[]
  received?: { from: string; at: number }[]
  sends?: Send[]
}

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
  // Its output rate as it publishes it (see Published.rate); absent likewise.
  rate?: Rate
  // Its repository and branch as it publishes them (see Published.git); absent likewise.
  git?: GitInfo
  // Its last turn was stopped (see Published.aborted): with tasks left open, that round is discarded.
  aborted?: boolean
  // Drawn only: this card is the session's leading round (the one its state and last message
  // belong to); an earlier round's card left with open tasks is a discarded round.
  lead?: boolean
  // The task the main loop was on when it last sent this session a message (SendMessage): where the
  // summary view draws it when that task is in the current work.
  lastAnchor?: string
  // The messages the main loop sent this session (SendMessage): when (ms, before the send) and the
  // task it was sent from. The turns the session opened after each one are drawn in a card of their
  // own under that task (see split in the hooks); absent from earlier versions.
  rounds?: { at: number; anchor?: string }[]
  // Drawn only: which of those cards this is (0 the opening message's).
  part?: number
  // Drawn only: when the message of that card was sent (its round's `at`), what its fold is kept by:
  // the index moves when the oldest round is dropped (the last 20 are kept), the time does not.
  partAt?: number
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
// `brief`: the turn's answer in a few words (done's `summary`), until the turn ends (then ''); in
// the state so a reload of the mod mid-turn does not lose it.
// `recap`: the end-of-turn box's recap (wrap_up), the turn's answer for the card, until the turn
// ends (then ''); in the state for the same reason.
// `collapsed`: the pane's open/closed lines the person chose (true closed, false open); a line
// with no entry keeps its default.
// `turnEnded`: when this session's turn ended (its clock), until the next prompt (then null):
// meanwhile what it left open is drawn with no close and no clock (see layout's Model.ended).
// `turnAborted`: the last turn of the main loop ended interrupted (turn.complete with isAborted), until
// the next request; a message of another session that comes then gets a reminder to replan the panel.
// `rate`: this session's output rate (turn.step measures it), for its own header and published for
// its card; in the state so a reload mid-turn keeps the last value.
// `git`: this session's repository and branch (refreshGit reads them), for its own header and
// published for its card; null outside a repository.
declare module 'claude-code' {
  interface PluginState {
    'task-tree': { tasks: LegacyNode[]; groups: Group[]; waits: Wait[]; launches: Launch[]; children: Child[]; childrenError: string; ended: string[]; collapsed: Record<string, boolean>; sends: Send[]; view: 'full' | 'summary'; work: string[]; received: { from: string; at: number }[]; engine: string; rate: Rate | null; git: GitInfo | null; brief: string; recap: string; turnEnded: number | null; turnAborted: boolean }
  }
}
