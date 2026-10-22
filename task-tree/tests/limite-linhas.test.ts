import { describe, expect, test } from 'claude-code/testing'

// The line limit (MAX_ROWS, 400): decided on the rows before any SVG is made. Past it, whole
// level-0 blocks go from the start (the oldest), one line counts them, and the recent lines (the
// current work) stay; one block alone past the limit is drawn to the limit with a closing count.
// The drawing's size and lines are published with the panel (drawSize, rows).

const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })
const PROPS = (surface: string) => ({ title: 'Tarefas', isFocused: false, bodyColumns: surface === 'desktop' ? 100 : 80, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} }) as any
const shown = (el: any): string => (typeof el === 'string' ? el : el?.type === 'Button' && el.props?.label !== undefined ? String(el.props.label) : (el?.children ?? []).map(shown).join(''))
async function terminal($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS('terminal'), requestId: 'task-tree' })
  const root: any = await ui.drawn()
  await ui.unmount()
  return (root.children as any[]).filter(c => typeof c === 'object').map(t => shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd())
}
async function desktop($: any): Promise<{ alts: string[]; size: number }> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props: PROPS('desktop'), requestId: 'task-tree' })
  const root: any = await ui.drawn()
  const found = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return { alts: found.filter((s: any) => !s.props.isInteractive && String(s.props.alt) !== '').map((s: any) => String(s.props.alt)), size: JSON.stringify(root).length }
}
// A header line, then the panel's lines: the terminal draws the header as two lines (title, bar).
const body = (lines: string[]) => lines.slice(2)

function host(on: any, written: string[]) {
  on('clock.now', () => ({ value: 1_000 }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } }) as any)
  on('fs.write', (_$: any, e: any) => {
    written.push(String(e.text))
    return { value: undefined } as any
  })
}

describe('limite de linhas do desenho', () => {
  test('muitos blocos abertos: os antigos saem inteiros, contados numa linha; os recentes ficam; sem o aviso de tamanho', async ($, on) => {
    host(on, [])
    // 150 level-1 tasks of 4 open steps: 750 lines, all open (nothing is cut by request).
    await call($, 'plan', { tasks: Array.from({ length: 150 }, (_, i) => ({ id: `G${i}`, title: `Grupo ${i}`, children: Array.from({ length: 4 }, (_, k) => ({ id: `e${k}`, title: `Etapa ${k} do grupo ${i}` })) })) })
    await call($, 'start', { ids: ['G149/e3'] })
    const lines = body(await terminal($))
    expect(lines.length).toBeLessThanOrEqual(400)
    expect(lines.length).toBeGreaterThan(390)
    // The count first, then whole blocks: the first kept line is a level-1 task.
    expect(lines[0]).toMatch(/^\+\d+ linhas anteriores$/)
    expect(lines[1]).toMatch(/^[○◉] Grupo \d+/)
    const counted = Number(/\d+/.exec(lines[0])?.[0])
    expect(counted + lines.length - 1).toBe(750)
    // The recent work is drawn, the oldest is not.
    expect(lines.some(l => l.includes('Etapa 3 do grupo 149'))).toBe(true)
    expect(lines.some(l => l.includes('Grupo 0'))).toBe(false)
    const d = await desktop($)
    expect(d.alts.length).toBeLessThanOrEqual(401)
    expect(d.alts[1]).toBe(`Linhas anteriores, não desenhadas: ${lines[0]}`)
    expect(d.alts.some(a => a.includes('Painel grande demais'))).toBe(false)
    expect(d.size).toBeLessThan(600 * 1024)
  })

  test('um bloco só maior que o limite: desenhado até o limite, com a contagem do resto no fim', async ($, on) => {
    host(on, [])
    await call($, 'plan', { tasks: [{ id: 'B', title: 'Enorme', children: Array.from({ length: 700 }, (_, i) => ({ id: `s${i}`, title: `Etapa ${i}` })) }] })
    const lines = body(await terminal($))
    expect(lines.length).toBe(400)
    expect(lines[0]).toMatch(/^◉ Enorme/)
    expect(lines[1]).toContain('Etapa 0')
    expect(lines[398]).toContain('Etapa 397')
    expect(lines[399]).toMatch(/\+302 linhas$/)
  })

  test('abaixo do limite nada muda', async ($, on) => {
    host(on, [])
    await call($, 'plan', { tasks: Array.from({ length: 50 }, (_, i) => ({ id: `G${i}`, title: `Grupo ${i}`, children: [{ id: 'e', title: `Etapa do grupo ${i}` }] })) })
    const lines = body(await terminal($))
    expect(lines.length).toBe(100)
    expect(lines.some(l => l.includes('linhas'))).toBe(false)
  })

  test('o arquivo publicado leva o tamanho e as linhas do último desenho', async ($, on) => {
    const written: string[] = []
    host(on, written)
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Uma', children: [{ id: '1', title: 'Passo' }] }] })
    const lines = body(await terminal($))
    // Published by the next write (a done): the drawing before it.
    await call($, 'done', { ids: ['A/1'] })
    const last = JSON.parse(written[written.length - 1])
    expect(last.rows).toBe(lines.length)
    expect(last.drawSize).toBeGreaterThan(100)
    expect(typeof last.drawSize).toBe('number')
  })
})
