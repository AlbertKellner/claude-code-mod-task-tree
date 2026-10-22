import { describe, expect, test } from 'claude-code/testing'
import { REAL } from './fixtures/orquestradora-real'

// Orçamento do desenho: o painel montado com um estado real (fixtures/orquestradora-real.ts) nas
// duas superfícies e nas duas visões não pode crescer sem que alguém aprove. Os números da BASELINE
// são os medidos no HEAD em que o fixture entrou; a mudança que os ultrapassa com a folga (FOLGA)
// falha aqui e pede baseline nova, de propósito. O teste não muda o painel: só mede o que o kit
// devolve de `ui.drawn()` (o mesmo JSON que `drawSize` mede no módulo, menos a conversão do JSX).

// Medido em 2026-10-22, HEAD 6d79470, kit 2.1.308, bodyColumns 100. `size` é o comprimento do JSON
// da árvore desenhada; `lines` as linhas do painel (Text/Box no terminal, Svg com alt no desktop);
// `svgs` todos os Svg, inclusive as camadas de tooltip. Folga de 50%: um desenho 1,5× maior falha.
const BASELINE = {
  'terminal/summary': { size: 11_671, lines: 29, svgs: 0 },
  'terminal/full': { size: 11_789, lines: 30, svgs: 0 },
  'desktop/summary': { size: 47_416, lines: 28, svgs: 30 },
  'desktop/full': { size: 48_174, lines: 29, svgs: 31 },
}
const FOLGA = 1.5
// Tempo de parede de um desenho (mount + drawn) no kit, por desenho, pior caso aceito. Medido
// 15–25 ms; o limite é largo porque a máquina varia, e só pega um salto de ordem de grandeza.
const MAX_MS = 500

const ME = REAL.me as string
const PROPS = (columns: number) => ({ title: 'Tarefas', isFocused: false, bodyColumns: columns, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} }) as any
const now = () => ((globalThis as any).performance?.now?.() ?? Date.now()) as number
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

// The host as the orchestrator saw it: its own panel in the store (as `change` keeps it), the
// children listed by the app and their published files on disk.
function host(on: any) {
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
  const rows = [{ sessionId: 'local_pai', title: 'Pai', isRunning: false }, ...own.children.map((c: any) => ({ sessionId: c.id, name: c.name, title: c.title, isRunning: c.running, isArchived: c.archived, startedBy: ME }))]
  let t = 1_000_000
  on('clock.now', () => ({ value: (t += 1000) }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('session.id', () => ({ value: 'uuid-eu' }) as any)
  on('session.start', () => ({ cwd: '.' }) as any)
  on('command.register', () => ({ value: {} }) as any)
  on('tool.register', () => ({ value: {} }) as any)
  on('ui.open', () => ({ value: { isPlaced: true } }) as any)
  on('ui.panes', () => ({ value: [{ id: 'task-tree', isPlaced: true, isShown: true }] }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
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
      const id = e.args?.session_id === 'self' ? ME : String(e.args?.session_id ?? '')
      return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: id, model: 'claude-opus-5-5', effort: 'high' }) }], isError: false } } as any
    }
    if (e.tool === 'list_sessions') return { value: { content: [{ type: 'text', text: JSON.stringify(rows) }], isError: false } } as any
    return { value: { content: [{ type: 'text', text: '{}' }], isError: false } } as any
  })
}

async function setView($: any, view: 'summary' | 'full') {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS(60), requestId: 'task-tree' })
  await ui.press({ key: `view:${view}` })
  await ui.unmount()
}

const walk = (el: any, f: (el: any) => void) => {
  if (!el || typeof el !== 'object') return
  f(el)
  for (const c of el.children ?? []) walk(c, f)
}
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))

type Measure = { size: number; lines: number; svgs: number; ms: number; text: string }
async function measure($: any, surface: 'terminal' | 'desktop', view: 'summary' | 'full', reps = 5): Promise<Measure> {
  await setView($, view)
  const walls: number[] = []
  let root: any
  for (let i = 0; i < reps; i++) {
    const t0 = now()
    const ui = await $.ui.mount({ plugin: 'task-tree', surface, component: 'Pane', props: PROPS(100), requestId: 'task-tree' })
    root = await ui.drawn()
    walls.push(now() - t0)
    await ui.unmount()
  }
  let svgs = 0
  let lines = 0
  walk(root, el => {
    if (el.type === 'Svg') {
      svgs++
      if (!el.props?.isInteractive && String(el.props?.alt ?? '') !== '') lines++
    }
  })
  if (surface === 'terminal') lines = (root?.children ?? []).filter((c: any) => c && typeof c === 'object').length
  return { size: JSON.stringify(root).length, lines, svgs, ms: median(walls), text: shown(root) }
}

describe('orçamento do desenho (estado real)', () => {
  test('as quatro combinações ficam dentro da baseline, com folga', async ($, on) => {
    host(on)
    await $.session.start({ cwd: '.' } as any)
    // The children's list and files are read in the background at the start.
    await new Promise(r => setTimeout(r, 100))
    const report: string[] = []
    for (const surface of ['terminal', 'desktop'] as const) {
      for (const view of ['summary', 'full'] as const) {
        const key = `${surface}/${view}` as keyof typeof BASELINE
        const m = await measure($, surface, view)
        report.push(`${key}: size ${m.size} lines ${m.lines} svgs ${m.svgs} ms ${m.ms.toFixed(1)}`)
        // The real drawing, not the emergency one and not an error.
        expect(m.text).not.toContain('Painel grande demais')
        expect(m.text).not.toContain('erro ao desenhar')
        expect(m.lines).toBeGreaterThan(10)
        const b = BASELINE[key]
        expect(m.size).toBeLessThanOrEqual(Math.ceil(b.size * FOLGA))
        expect(m.lines).toBeLessThanOrEqual(Math.ceil(b.lines * FOLGA))
        expect(m.svgs).toBeLessThanOrEqual(Math.ceil(b.svgs * FOLGA))
        expect(m.ms).toBeLessThan(MAX_MS)
      }
    }
    console.log('ORCAMENTO ' + report.join(' | '))
  })
})
