import { describe, expect, test } from 'claude-code/testing'
import { GOLDEN } from './golden/svg'
import type { GoldenSvg } from './golden/svg'
import { REAL } from './fixtures/orquestradora-real'

// Golden do SVG: o desktop desenha cada linha (e o cabeçalho) como um Svg; aqui a fonte de cada um,
// em cenários fixos que cobrem os tons, o cartão de filha, ↩, anel, ✉ e nome cortado, é comparada
// com golden/svg.ts. Qualquer mudança de geometria ou de estilo vira uma falha explícita, com o
// primeiro trecho diferente, e um golden novo só nasce de propósito:
//   node task-tree/tests/golden/atualizar.mjs [claude.exe]
// (o kit não deixa um teste ler nem escrever arquivos, nem ver variáveis de ambiente: a atualização
// é um script de fora, que recolhe as linhas GOLDEN-NEW que este teste emite ao falhar).
// O relógio é fixo e as larguras também: o que muda entre execuções é só o código do desenho.

const call = ($: any, tool: string, args: object, agentId?: string) =>
  $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args, ...(agentId ? { agentId } : {}) })
const plan = ($: any, tasks: unknown, request?: string, agentId?: string) => call($, 'plan', request === undefined ? { tasks } : { tasks, request }, agentId)
const done = ($: any, ids: string[], summary?: string) => call($, 'done', summary === undefined ? { ids } : { ids, summary })
const start = ($: any, ids: string[]) => call($, 'start', { ids })

const PROPS = (columns: number) => ({ title: 'Tarefas', isFocused: false, bodyColumns: columns, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} }) as any
const KID = 'local_11111111-1111-1111-1111-111111111111'
const NOW = 1_000_000

// A fixed clock (the times drawn never change), and the host calls a drawing makes answered quietly.
const clock = (on: any, at = NOW) => {
  on('clock.now', () => ({ value: at }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
}

// Every Svg of the desktop drawing, in order, as the kit returns it.
async function svgs($: any, columns = 60): Promise<GoldenSvg[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props: PROPS(columns), requestId: 'task-tree' })
  const root: any = await ui.drawn()
  await ui.unmount()
  const out: GoldenSvg[] = []
  const walk = (el: any) => {
    if (!el || typeof el !== 'object') return
    if (el.type === 'Svg') out.push({ alt: String(el.props?.alt ?? ''), w: Number(el.props?.width), h: Number(el.props?.height), hover: el.props?.isInteractive === true, source: String(el.props?.source ?? '') })
    for (const c of el.children ?? []) walk(c)
  }
  walk(root)
  return out
}

async function setView($: any, view: 'summary' | 'full') {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS(60), requestId: 'task-tree' })
  await ui.press({ key: `view:${view}` })
  await ui.unmount()
}

// The first stretch where two sources differ, as SVG pieces (split at ">"), with the piece before it.
function firstDiff(a: string, b: string): string {
  const xs = a.split('>')
  const ys = b.split('>')
  for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
    if (xs[i] !== ys[i]) {
      const ctx = i > 0 ? `…${xs[i - 1].slice(-40)}>` : ''
      return `trecho ${i + 1}:\n      golden: ${ctx}${xs[i] ?? '(fim)'}>\n      agora:  ${ctx}${ys[i] ?? '(fim)'}>`
    }
  }
  return 'fontes iguais'
}

// Compares with the golden; on a difference, says which Svgs and where and emits the new set for
// atualizar.mjs. The failure waits for `verdict()`, at the end of the test, so every scenario of
// the test is checked (and emitted) in one run.
const failures: string[] = []
function check(name: string, now: GoldenSvg[]) {
  const want = GOLDEN[name]
  const problems: string[] = []
  if (!want) problems.push(`sem golden para "${name}": rode node task-tree/tests/golden/atualizar.mjs`)
  else {
    if (want.length !== now.length) problems.push(`${want.length} Svg no golden, ${now.length} agora: ${JSON.stringify(now.map(s => s.alt || (s.hover ? '(tooltip)' : '(sem alt)')))}`)
    const n = Math.min(want.length, now.length)
    for (let i = 0; i < n && problems.length < 6; i++) {
      const a = want[i]
      const b = now[i]
      if (a.alt !== b.alt || a.w !== b.w || a.h !== b.h || a.hover !== b.hover) {
        problems.push(`Svg ${i} (${a.alt || (a.hover ? 'tooltip' : 'sem alt')}): golden ${a.w}×${a.h}${a.hover ? ' interativo' : ''} "${a.alt}"; agora ${b.w}×${b.h}${b.hover ? ' interativo' : ''} "${b.alt}"`)
      } else if (a.source !== b.source) problems.push(`Svg ${i} (${a.alt || (a.hover ? 'tooltip' : 'sem alt')}), ${firstDiff(a.source, b.source)}`)
    }
  }
  if (problems.length > 0) {
    console.log(`GOLDEN-NEW ${name} ${JSON.stringify(now)}`)
    failures.push(`SVG do cenário "${name}" mudou:\n  - ${problems.join('\n  - ')}`)
  }
}
function verdict() {
  const all = failures.splice(0)
  if (all.length > 0) throw new Error(`${all.join('\n')}\n  Se a mudança é intencional: node task-tree/tests/golden/atualizar.mjs, e confira o diff de golden/svg.ts.`)
  expect(all.length).toBe(0)
}

const CHILD_PANEL = {
  waiting: true,
  context: { percent: 42, at: 1 },
  engine: 'Opus 5.5 · high',
  groups: [
    {
      agent: '',
      label: '',
      tasks: [
        {
          id: 'X',
          short: 'X',
          title: 'Trabalho da filha',
          status: 'open',
          children: [
            { id: 'X/1', short: '1', title: 'Passo feito', status: 'done', startedAt: NOW - 9_000, endedAt: NOW - 4_000, children: [] },
            { id: 'X/2', short: '2', title: 'Passo atual, com um nome comprido o bastante para ser cortado no painel estreito', status: 'open', started: 1, startedAt: NOW - 4_000, children: [] },
          ],
        },
      ],
    },
  ],
  waits: [{ agent: '', kind: 'question', tool: 'AskUserQuestion', key: 'k' }],
  children: [],
}

function withChild(on: any, running: boolean, panel: unknown = CHILD_PANEL) {
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify([
    { sessionId: 'local_pai', title: 'Pai', isRunning: false },
    { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: running, isArchived: false, startedBy: 'local_eu' },
  ]) }], isError: false } }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify(panel) : '{}' }) as any)
  on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
}

describe('golden do SVG (desktop)', () => {
  test('básico: pedido, três níveis, em andamento, concluída, resposta ↩, nome cortado e cabeçalho com chips', async ($, on) => {
    clock(on)
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'corrija o painel' } as any)
    await plan($, [
      { id: 'A', title: 'Corrigir o painel', children: [{ id: '1', title: 'Achar a causa', children: [{ id: 'x', title: 'Ler o código' }, { id: 'y', title: 'Reproduzir' }] }, { id: '2', title: 'Testar' }] },
      { id: 'B', title: 'Documentar a correção com um nome comprido o bastante para ser cortado no painel estreito' },
    ], 'Corrigir o painel')
    await done($, ['A/1/x'])
    await start($, ['A/1/y'])
    check('basico', await svgs($))
    await done($, ['A', 'B'], 'Painel corrigido e documentado')
    check('basico-concluido', await svgs($))
    verdict()
  })

  test('retomada: tarefa interrompida', async ($, on) => {
    clock(on)
    on('classic.SessionStart', () => ({}))
    const leaf =(id: string, title: string, status: string, started?: number) => ({ id: `R/${id}`, short: id, title, status, started, children: [] })
    on('store.get', (_$: any, e: any) => ({ value: String(e.key).startsWith('session:') ? [{ agent: '', label: '', tasks: [{ id: 'R', short: 'R', title: 'Retomada', status: 'open', children: [leaf('1', 'Feita', 'done'), leaf('2', 'Rodar build', 'interrupted'), leaf('3', 'Seguir', 'open')] }] }] : undefined }) as any)
    await $.classic.SessionStart({ source: 'resume', session_id: 's1' } as any)
    check('retomada', await svgs($))
    verdict()
  })

  test('filha: cartão com anel, aviso de espera, nome cortado; depois parada, arquivada e recolhida', async ($, on) => {
    clock(on)
    let running = true
    let archived = false
    let panel: unknown = CHILD_PANEL
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify([
      { sessionId: 'local_pai', title: 'Pai', isRunning: false },
      { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: running, isArchived: archived, startedBy: 'local_eu' },
    ]) }], isError: false } }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify(panel) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    check('filha-rodando', await svgs($))
    // Stopped with a task still open, no longer waiting (a refresh reads the list and the file
    // again): parked. Then archived. Then folded.
    const refresh = () => $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    running = false
    panel = { ...CHILD_PANEL, waiting: false, waits: [] }
    await refresh()
    check('filha-parada', await svgs($))
    archived = true
    await refresh()
    check('filha-arquivada', await svgs($))
    archived = false
    await refresh()
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props: PROPS(60), requestId: 'task-tree' })
    await ui.press({ key: `fold:s:${KID}` })
    await ui.unmount()
    check('filha-recolhida', await svgs($))
    verdict()
  })

  test('envio: tarefa à espera da sessão (✉) e o chip no cabeçalho', async ($, on) => {
    clock(on)
    withChild(on, true, { waiting: false, tasks: [] })
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${KID}; it is busy and will see it when its turn ends.` }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Abrir filha' }, { id: '2', title: 'Avisar a filha' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['1'])
    await start($, ['2'])
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'aprovado' } as any)
    check('envio', await svgs($))
    verdict()
  })

  test('espera própria: pergunta ao usuário embaixo da tarefa em andamento', async ($, on) => {
    clock(on)
    let during: GoldenSvg[] = []
    on('tool.call', { tool: 'AskUserQuestion' }, async () => {
      during = await svgs($)
      return { result: 'ok' }
    })
    await plan($, [{ id: 'A', title: 'Decidir', children: [{ id: '1', title: 'Perguntar' }] }])
    await start($, ['A/1'])
    await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    check('espera-propria', during)
    verdict()
  })

  test('subagente: o grupo dele num cartão', async ($, on) => {
    clock(on)
    await plan($, [{ id: 'A', title: 'Com subagente', children: [{ id: '1', title: 'Delegar' }] }])
    await start($, ['A/1'])
    await plan($, [{ id: 'S', title: 'Do subagente', children: [{ id: '1', title: 's1' }, { id: '2', title: 's2' }] }], undefined, 'sub1')
    await call($, 'done', { ids: ['S/1'] }, 'sub1')
    check('subagente', await svgs($))
    verdict()
  })

  test('estado real: as duas visões, largura 100', async ($, on) => {
    const own: any = REAL.own
    const store: Record<string, unknown> = {
      'session:uuid-eu': own.groups,
      'work:uuid-eu': own.work,
      'view:uuid-eu': 'full',
      'links:uuid-eu': {
        children: own.children.map((c: any) => ({ id: c.id, name: c.name, title: c.title, anchor: c.anchor, lastAnchor: c.lastAnchor, rounds: c.rounds })),
        sends: own.sends ?? [],
        received: own.received ?? [],
        launches: [],
      },
    }
    const rows = [{ sessionId: 'local_pai', title: 'Pai', isRunning: false }, ...own.children.map((c: any) => ({ sessionId: c.id, name: c.name, title: c.title, isRunning: c.running, isArchived: c.archived, startedBy: REAL.me }))]
    clock(on, own.at)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('session.id', () => ({ value: 'uuid-eu' }) as any)
    on('session.start', () => ({ cwd: '.' }) as any)
    on('command.register', () => ({ value: {} }) as any)
    on('tool.register', () => ({ value: {} }) as any)
    on('ui.open', () => ({ value: { isPlaced: true } }) as any)
    on('ui.panes', () => ({ value: [{ id: 'task-tree', isPlaced: true, isShown: true }] }) as any)
    on('store.set', (_$: any, e: any) => {
      store[e.key] = JSON.parse(JSON.stringify(e.value))
      return { value: undefined } as any
    })
    on('store.get', (_$: any, e: any) => ({ value: store[e.key] }) as any)
    on('fs.write', () => ({ value: undefined }) as any)
    on('fs.read', (_$: any, e: any) => {
      const id = Object.keys(REAL.files).find(k => String(e.path).includes(k))
      return ({ value: id ? REAL.files[id] : '{}' }) as any
    })
    on('mcp.call', (_$: any, e: any) => {
      if (e.tool === 'get_session') {
        const id = e.args?.session_id === 'self' ? REAL.me : String(e.args?.session_id ?? '')
        return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: id, model: 'claude-opus-5-5', effort: 'high' }) }], isError: false } } as any
      }
      if (e.tool === 'list_sessions') return { value: { content: [{ type: 'text', text: JSON.stringify(rows) }], isError: false } } as any
      return { value: { content: [{ type: 'text', text: '{}' }], isError: false } } as any
    })
    await $.session.start({ cwd: '.' } as any)
    await new Promise(r => setTimeout(r, 100))
    await setView($, 'full')
    check('real-completa', await svgs($, 100))
    await setView($, 'summary')
    check('real-resumida', await svgs($, 100))
    verdict()
  })
})
