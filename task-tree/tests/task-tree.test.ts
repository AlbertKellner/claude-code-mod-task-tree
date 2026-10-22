import { describe, expect, test } from 'claude-code/testing'

// The tests read what you see: the panel as drawn (each line's text and color) and
// the tools' results.

const PLAN = [
  {
    id: 'A',
    title: 'Sessão A',
    children: [
      { id: '1', title: 'Item 1', children: [{ id: '1.1', title: 'Sub 1.1' }] },
      { id: '2', title: 'Item 2' },
    ],
  },
]

// A resumed session's panel, as the store keeps it: an interrupted task cannot be made with
// the tools alone (only a subagent's loop leaves them, and the kit has none).
const leaf = (id: string, title: string, status: string, started?: number) => ({ id: `R/${id}`, short: id, title, status, started, children: [] })
const RESUMED = [
  {
    agent: '',
    label: '',
    tasks: [
      {
        id: 'R',
        short: 'R',
        title: 'Retomada',
        status: 'open',
        children: [leaf('1', 'Feita', 'done'), leaf('2', 'Rodar build', 'interrupted'), leaf('3', 'Seguir', 'open')],
      },
    ],
  },
]

const call = ($: any, tool: string, args: object, agentId?: string) =>
  $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args, ...(agentId ? { agentId } : {}) })
const plan = ($: any, tasks: unknown, agentId?: string) => call($, 'plan', { tasks }, agentId)
const done = ($: any, ids: string[], agentId?: string) => call($, 'done', { ids }, agentId)
const start = ($: any, ids: string[], agentId?: string) => call($, 'start', { ids }, agentId)
const text = (r: any) => String(r?.result ?? r?.text ?? '')

const PANE_PROPS = {
  title: 'Tarefas',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { top: 0, bodyRows: 40 },
  view: {},
} as any

// Terminal: each line of the panel is a Text in the panel's Box (a row Box when it folds); a task
// line holds the guides, the icon (its color is the line's; a Button when the line folds) and the
// title (bold while in progress), " ⋯" when folded, then the count or "interrompida". `fold` reads
// that state as before: "▾" open, "▸" folded.
const GLYPHS = /^[○◉✓✕◷⑂▸✉↩]$/
type Line = { text: string; glyph?: string; color?: string; title?: string; bold?: boolean; fold?: string; label?: boolean }
const shown = (el: any): string =>
  typeof el === 'string'
    ? el
    : el?.type === 'Button' && el.props?.label !== undefined
      ? String(el.props.label)
      : (el?.children ?? []).map(shown).join('')
async function view($: any): Promise<Line[]> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
  const root: any = await ui.drawn()
  await ui.unmount()
  return (root.children as any[])
    .filter(c => typeof c === 'object')
    .map(t => {
      const parts = (t.children as any[]).filter(c => typeof c === 'object')
      // A session's label: the ⑂ first (a Button when it folds the card), then its name and tags.
      const button = parts.find(p => p.type === 'Button' && GLYPHS.test(shown(p)))
      const icon = parts.find(p => GLYPHS.test(shown(p)))
      const label = icon !== undefined && shown(icon) === '⑂'
      const title = icon ? parts[parts.indexOf(icon) + 1] : undefined
      const iconText = icon?.type === 'Button' ? (icon.children ?? []).find((c: any) => typeof c === 'object') : icon
      const folded = parts.some(p => shown(p) === ' ⋯')
      return {
        // The view toggle at the end of the title line (see toggleOf) is left out.
        text: shown(t).replace(/\s+\[?≡\]? \[?▤\]?$/, '').trimEnd(),
        glyph: icon ? shown(icon) : undefined,
        color: iconText?.props?.color,
        title: title ? shown(title).trim() : undefined,
        bold: title?.props?.bold === true,
        label: label || undefined,
        fold: button ? (folded ? '▸' : '▾') : undefined,
      }
    })
}
const rowsOf = (lines: Line[]) => lines.filter(l => l.title !== undefined)
// Presses the ▾/▸ of a line, by the key it is kept under: "<grupo>|t:<id>" for a task
// ("|t:A/1" in the main group), "s:<id local>" for a session, "g:<agentId>" for a subagent.
async function fold($: any, key: string, surface: 'terminal' | 'desktop' = 'terminal') {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface, component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
  await ui.press({ key: `fold:${key}` })
  await ui.unmount()
}
const line = (lines: Line[], title: string) => lines.find(l => l.title === title)

// Desktop: the header and each line are an Svg; what they say is in `alt`.
// The lines' Svgs; with `layers`, the tooltip layers (interactive, alt "") over cut names too.
async function desktop($: any, columns = 60, layers = false): Promise<{ alt: string; source: string; width: number; hover: boolean }[]> {
  const props = { ...PANE_PROPS, bodyColumns: columns }
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props, requestId: 'task-tree' })
  const found = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  const all = found.map((s: any) => ({ alt: String(s.props.alt), source: String(s.props.source), width: Number(s.props.width), hover: s.props.isInteractive === true }))
  // A line that folds is drawn in two Svgs around its Button (the stretch left of the icon has no
  // alt): read here as one line, the two sources together and the widths added.
  const out: typeof all = []
  for (let i = 0; i < all.length; i++) {
    const s = all[i]
    if (!s.hover && s.alt === '' && all[i + 1] && !all[i + 1].hover) {
      const n = all[i + 1]
      out.push({ ...n, source: s.source + n.source, width: s.width + n.width })
      i++
    } else out.push(s)
  }
  return out.filter((s: { hover: boolean }) => layers || !s.hover)
}

describe('plan', () => {
  test('prefixa os ids abaixo do nível 1', async $ => {
    await plan($, PLAN)
    const r = await done($, ['A/1.1'])
    expect(text(r)).not.toContain('Avisos')
    expect(line(await view($), 'Item 1')?.glyph).toBe('✓')
  })

  test('recusa ids repetidos no mesmo plano', async $ => {
    const r = await plan($, [{ id: 'A', title: 'A', children: [{ id: '1', title: 'x' }, { id: '1', title: 'y' }] }])
    expect(text(r)).toContain('ids repetidos')
  })

  test('replanejar um nível 1 aberto zera tudo e fica no mesmo lugar (ordem do plano)', async $ => {
    await plan($, PLAN)
    await plan($, [{ id: 'B', title: 'Sessão B' }])
    await done($, ['1.1'])
    await plan($, [{ id: 'A', title: 'Sessão A nova', children: [{ id: '1', title: 'Novo 1' }] }])
    const titles = (await view($)).map(l => l.title)
    expect(titles.indexOf('Sessão B')).toBeGreaterThanOrEqual(0)
    expect(titles.indexOf('Sessão A nova')).toBeGreaterThanOrEqual(0)
    expect(titles.indexOf('Sessão A nova')).toBeLessThan(titles.indexOf('Sessão B'))
    expect(titles).not.toContain('Sessão A')
    expect(titles).toContain('Novo 1')
  })

  test('um nível 1 concluído fica como histórico', async $ => {
    await plan($, [{ id: 'A', title: 'Velha' }])
    await done($, ['A'])
    await plan($, [{ id: 'A', title: 'Nova' }])
    const lines = await view($)
    expect(line(lines, 'Nova')?.glyph).toBe('◉')
    // Done, it stays in its place in the list.
    expect(rowsOf(lines).map(l => l.text)).toEqual(['✓ Velha  —', '◉ Nova'])
  })
})

describe('done', () => {
  test('aceita id curto e fecha o pai quando os filhos fecham', async $ => {
    await plan($, PLAN)
    await done($, ['1.1'])
    expect(line(await view($), 'Item 1')?.glyph).toBe('✓')
    await done($, ['2'])
    expect(line(await view($), 'Sessão A')?.glyph).toBe('✓')
  })

  test('avisa ids inexistentes e aplica os válidos', async $ => {
    await plan($, PLAN)
    const r = await done($, ['2', 'nada'])
    expect(text(r)).toContain('"nada" não existe')
    expect(line(await view($), 'Item 2')?.glyph).toBe('✓')
  })

  test('id curto ambíguo entre dois abertos pede o completo', async $ => {
    await plan($, PLAN)
    await plan($, [{ id: 'B', title: 'B', children: [{ id: '2', title: 'B2' }] }])
    expect(text(await done($, ['2']))).toContain('ambíguo')
    await done($, ['B/2'])
    const lines = await view($)
    expect(line(lines, 'B2')?.glyph).toBe('✓') // B closed, still open: only the person folds
    expect(line(lines, 'Item 2')?.glyph).toBe('○')
  })

  test('conta concluídas no cabeçalho, com o nível 1 em andamento', async $ => {
    await plan($, PLAN)
    await done($, ['2'])
    const lines = await view($)
    expect(lines[0].text).toBe('Sessão A  1 de 2 · 50%')
    expect(lines[1].text).toBe('██████████░░░░░░░░░░  ● 1')
  })
})

describe('start', () => {
  test('marca várias em andamento: só elas com o anel âmbar e em negrito', async $ => {
    await plan($, [{ id: 'A', title: 'A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }])
    await start($, ['3', '2'])
    const lines = await view($)
    expect(line(lines, 'Um')).toMatchObject({ glyph: '○', color: 'inactive', bold: false })
    expect(line(lines, 'Dois')).toMatchObject({ glyph: '◉', color: 'warning', bold: true })
    expect(line(lines, 'Três')).toMatchObject({ glyph: '◉', color: 'warning', bold: true })
    expect(lines[1].text).toBe('░░░░░░░░░░░░░░░░░░░░  ● 3')
  })

  test('sem start, a primeira aberta fica em andamento', async $ => {
    await plan($, PLAN)
    const lines = await view($)
    expect(line(lines, 'Sub 1.1')?.glyph).toBe('◉')
    expect(line(lines, 'Item 2')?.glyph).toBe('○')
  })

  test('reabre uma tarefa concluída sem filhos e os pais', async $ => {
    await plan($, PLAN)
    await done($, ['A'])
    await start($, ['1.1'])
    const lines = await view($)
    expect(line(lines, 'Sub 1.1')?.glyph).toBe('◉')
    expect(line(lines, 'Sessão A')?.glyph).toBe('◉')
    expect(line(lines, 'Item 2')?.glyph).toBe('✓')
  })

  test('recusa reabrir um pai concluído', async $ => {
    await plan($, PLAN)
    await done($, ['A'])
    expect(text(await start($, ['1']))).toContain('replaneje')
    expect(line(await view($), 'Sessão A')?.glyph).toBe('✓')
  })

  test('com a marcada concluída, volta para a primeira aberta', async $ => {
    await plan($, PLAN)
    await start($, ['2'])
    await done($, ['2'])
    expect(line(await view($), 'Sub 1.1')?.glyph).toBe('◉')
  })
})

describe('terminal', () => {
  test('guias ├─ └─ │ ligam as tarefas, com a contagem nas que têm filhas', async $ => {
    await plan($, [
      { id: 'A', title: 'Raiz', children: [{ id: '1', title: 'Um', children: [{ id: '1.1', title: 'Fundo' }] }, { id: '2', title: 'Dois' }] },
    ])
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ Raiz  0/2', '├─ ◉ Um  0/1', '│  └─ ◉ Fundo', '└─ ○ Dois'])
  })

  test('interrompida: ✕ cinza, texto apagado e a palavra à direita; fora da porcentagem', async ($, on) => {
    on('classic.SessionStart', () => ({}))
    on('store.get', (_$: any, e: any) => ({ value: String(e.key).startsWith('session:') ? RESUMED : undefined }) as any)
    await $.classic.SessionStart({ source: 'resume', session_id: 's1' } as any)
    const lines = await view($)
    expect(lines[0].text).toBe('Retomada  1 de 2 · 50%')
    expect(lines[1].text).toBe('██████████░░░░░░░░░░  ● 1  ✕ 1')
    expect(rowsOf(lines).map(l => l.text)).toEqual(['◉ Retomada  1/2', '├─ ✓ Feita  —', '├─ ✕ Rodar build  interrompida  —', '└─ ◉ Seguir'])
    expect(line(lines, 'Rodar build')?.color).toBe('inactive')
  })
})

describe('desktop', () => {
  test('cabeçalho e linhas em Svg, com o texto de cada um no alt', async $ => {
    await plan($, PLAN)
    await start($, ['2'])
    await done($, ['1.1'])
    const svgs = await desktop($)
    expect(svgs.map(s => s.alt)).toEqual([
      'Sessão A: 1 de 2 (50%), 1 em andamento. Visão: completa, selecionada (≡ resumida, ▤ completa)',
      'Em andamento: Sessão A, 1 de 2',
      'Concluída: Item 1, 1 de 1',
      'Concluída: Sub 1.1',
      'Em andamento: Item 2',
    ])
    // The header and the lines take the whole width (no ▾/▸ column); a line that folds gives the
    // width of its icon (about 14 px) to the Button that is the icon.
    expect(svgs[0].width).toBe(60 * 8 - 8)
    expect(svgs.slice(1).every(s => s.width <= 60 * 8 - 8 && s.width >= 60 * 8 - 8 - 16)).toBe(true)
    expect(svgs.every(s => s.source.includes('prefers-color-scheme: dark'))).toBe(true)
  })

  test('interrompida e aviso de espera entram no alt e nos chips', async ($, on) => {
    on('classic.SessionStart', () => ({}))
    on('store.get', (_$: any, e: any) => ({ value: String(e.key).startsWith('session:') ? RESUMED : undefined }) as any)
    let during: string[] = []
    on('tool.call', { tool: 'AskUserQuestion' }, async () => {
      during = (await desktop($)).map(s => s.alt)
      return { result: 'ok' }
    })
    await $.classic.SessionStart({ source: 'resume', session_id: 's1' } as any)
    await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    expect(during).toEqual([
      'Retomada: 1 de 2 (50%), 1 em andamento, 1 aguardando, 1 interrompida. Visão: completa, selecionada (≡ resumida, ▤ completa)',
      'Em andamento: Retomada, 1 de 2',
      'Concluída: Feita',
      'Interrompida: Rodar build, interrompida',
      'Em andamento: Seguir',
      'Aguardando sua resposta',
    ])
  })

  test('sem tarefas, o cabeçalho diz que nada foi planejado', async $ => {
    const svgs = await desktop($)
    expect(svgs.map(s => s.alt)).toEqual(['Nenhuma tarefa planejada. Visão: completa, selecionada (≡ resumida, ▤ completa)'])
  })

  test('título longo é cortado com …, e o texto vai escapado no SVG', async $ => {
    const long = 'Um título bem comprido que não cabe na largura estreita do painel <b>'
    await plan($, [{ id: 'A', title: long }])
    const [head, row] = await desktop($, 30)
    expect(head.width).toBe(240)
    expect(row.width).toBe(240)
    expect(row.alt).toBe(`Em andamento: ${long}`)
    expect(row.source).toContain('…')
    expect(row.source).not.toContain('<b>')
    expect(head.source).toContain('…')
  })

  test('as guias vão de uma linha à outra: a mãe desce, a filha sobe', async $ => {
    await plan($, [{ id: 'A', title: 'Mãe', children: [{ id: '1', title: 'Filha' }] }])
    const [, mother, child] = await desktop($)
    expect(mother.source).toMatch(/class="g" d="M12\.5 23V30"/)
    expect(child.source).toMatch(/class="g" d="M12\.5 0V14M12\.5 14H23\.5"/)
  })
})

describe('abrir e recolher', () => {
  test('▾ recolhe a tarefa e o que vem embaixo; ▸ abre de novo', async $ => {
    await plan($, PLAN)
    let lines = await view($)
    expect(line(lines, 'Sessão A')?.fold).toBe('▾')
    expect(line(lines, 'Item 1')?.fold).toBe('▾')
    expect(line(lines, 'Item 2')?.fold).toBeUndefined()
    await fold($, '|t:A')
    lines = await view($)
    expect(rowsOf(lines).map(l => l.text)).toEqual(['◉ Sessão A ⋯  0/2'])
    await fold($, '|t:A')
    expect(rowsOf(await view($)).map(l => l.text)).toEqual([
      '◉ Sessão A  0/2',
      '├─ ◉ Item 1  0/1',
      '│  └─ ◉ Sub 1.1',
      '└─ ○ Item 2',
    ])
  })

  test('uma tarefa concluída continua aberta; só o usuário a recolhe', async $ => {
    await plan($, PLAN)
    await done($, ['1.1'])
    let lines = await view($)
    expect(line(lines, 'Item 1')?.fold).toBe('▾')
    expect(line(lines, 'Sub 1.1')?.glyph).toBe('✓')
    await fold($, '|t:A/1')
    lines = await view($)
    expect(line(lines, 'Item 1')?.fold).toBe('▸')
    expect(line(lines, 'Sub 1.1')).toBeUndefined()
  })

  test('recolher não muda o cabeçalho nem os chips', async $ => {
    await plan($, PLAN)
    const before = (await view($)).slice(0, 2).map(l => l.text)
    await fold($, '|t:A')
    expect((await view($)).slice(0, 2).map(l => l.text)).toEqual(before)
    expect(before[1]).toContain('● 2')
  })

  test('nível 1 concluído fica no lugar dele na lista, aberto, e recolhe pelo usuário', async $ => {
    await plan($, [{ id: 'A', title: 'Primeira', children: [{ id: '1', title: 'Passo' }] }])
    await plan($, [{ id: 'B', title: 'Segunda' }])
    await done($, ['A'])
    let lines = await view($)
    expect(rowsOf(lines).map(l => l.text)).toEqual(['✓ Primeira  1/1  —', '└─ ✓ Passo  —', '◉ Segunda'])
    expect(line(lines, 'Primeira')).toMatchObject({ glyph: '✓', fold: '▾' })
    expect(lines.some(l => l.text.includes('Concluídas ·'))).toBe(false)
    await fold($, '|t:A')
    lines = await view($)
    expect(rowsOf(lines).map(l => l.text)).toEqual(['✓ Primeira ⋯  1/1  —', '◉ Segunda'])
  })

  test('no desktop, sem ▾/▸: só o ícone recolhe: um Button sem texto centrado nele', async $ => {
    await plan($, PLAN)
    await done($, ['1.1'])
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.some((b: any) => b.props.label === '▾' || b.props.label === '▸')).toBe(false)
    // One per line with something below (Sessão A, Item 1); none on the leaves.
    // An empty-label Button over the whole of each line that folds (the icon stays drawn, in its
    // color): a Box spanning the line, the Button stretched across it.
    // An empty-label Button over the icon of each line that folds, in a Box the line's height that
    // centers it: 3 cells at an even depth (its middle 12 px from the line's start, the icon at
    // 12.5), 2 at an odd one (32 px, the icon at 32.5).
    const icons = buttons.filter((b: any) => String(b.props.key ?? '').startsWith('fold:'))
    expect(icons.length).toBe(2)
    expect(icons.every((b: any) => b.props.plain === true && b.props.label === ' ')).toBe(true)
    const boxes = (await ui.findAll({ type: 'Box' })).filter((b: any) => (b.children ?? []).some((c: any) => c.type === 'Button' && String(c.props?.key ?? '').startsWith('fold:')))
    expect(boxes.map((b: any) => [b.props.left, b.props.width])).toEqual([[0, 3], [3, 2]])
    expect(boxes.every((b: any) => b.props.position === 'absolute' && b.props.top === 0 && b.props.bottom === 0 && b.props.alignItems === 'center' && b.props.justifyContent === 'center')).toBe(true)
    // Each Box's middle within a pixel of its icon (col(depth) = 12.5 + 20 * depth, cells of 8 px).
    expect(boxes.every((b: any, k: number) => Math.abs((b.props.left + b.props.width / 2) * 8 - (12.5 + 20 * k)) <= 1)).toBe(true)
    await ui.press({ key: 'fold:|t:A/1' })
    const svgs = (await ui.findAll({ type: 'Svg' })).map((s: any) => ({ alt: String(s.props.alt), source: String(s.props.source) }))
    await ui.unmount()
    expect(svgs.slice(1).map(s => s.alt).filter(Boolean)).toEqual(['Em andamento: Sessão A, 1 de 2', 'Concluída: Item 1, 1 de 1, recolhida', 'Em andamento: Item 2'])
    // Folded: " ⋯" after the name.
    expect(svgs.find(s => s.alt.startsWith('Concluída: Item 1'))?.source).toContain('Item 1 ⋯')
  })

  test('no terminal, o ícone é o botão: aperta e recolhe, com " ⋯" depois do nome', async $ => {
    await plan($, PLAN)
    let lines = await view($)
    expect(line(lines, 'Item 1')).toMatchObject({ glyph: '◉', fold: '▾' })
    expect(line(lines, 'Sub 1.1')?.fold).toBeUndefined()
    expect(lines.some(l => /[▾▸] /.test(l.text))).toBe(false)
    await fold($, '|t:A/1')
    lines = await view($)
    expect(line(lines, 'Item 1')?.text).toBe('├─ ◉ Item 1 ⋯  0/1')
    expect(line(lines, 'Sub 1.1')).toBeUndefined()
  })

  test('no desktop, o nível 1 concluído fica no lugar dele, sem seção à parte', async $ => {
    await plan($, [{ id: 'A', title: 'Feita' }])
    await done($, ['A'])
    await plan($, [{ id: 'B', title: 'Aberta' }])
    expect((await desktop($)).map(s => s.alt).slice(1)).toEqual(['Concluída: Feita', 'Em andamento: Aberta'])
  })
})

describe('tempo decorrido', () => {
  // The clock is the test's: `t` ms since the epoch.
  const clock = (on: any, now: () => number) => on('clock.now', () => ({ value: now() }) as any)
  const noTicker = (on: any) => on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)

  test('cada tarefa iniciada mostra o tempo à direita, e o cabeçalho o da sessão', async ($, on) => {
    let t = 1_000_000
    clock(on, () => t)
    noTicker(on)
    await plan($, [{ id: 'A', title: 'Raiz', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
    await start($, ['1'])
    t += 65_000
    let lines = await view($)
    expect(lines[0].text).toBe('Raiz  0 de 2 · 0%  1:05')
    expect(rowsOf(lines).map(l => l.text)).toEqual(['◉ Raiz  0/2  1:05', '├─ ◉ Um  1:05', '└─ ○ Dois'])
    // Done, a task's time stops; the parent's goes on while a child is open.
    await done($, ['1'])
    await start($, ['2'])
    t += 3_600_000
    lines = await view($)
    expect(rowsOf(lines).map(l => l.text)).toEqual(['◉ Raiz  1/2  1:01:05', '├─ ✓ Um  1:05', '└─ ◉ Dois  1:00:00'])
    await done($, ['2'])
    t += 10_000
    expect(rowsOf(await view($)).map(l => l.text)).toEqual([
      '✓ Raiz  2/2  1:01:05',
      '├─ ✓ Um  1:05',
      '└─ ✓ Dois  1:00:00',
    ])
  })

  test('reabrir com start zera o tempo da tarefa', async ($, on) => {
    let t = 0
    clock(on, () => t)
    noTicker(on)
    await plan($, [{ id: 'A', title: 'Só', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
    await start($, ['1'])
    t = 50_000
    await done($, ['1'])
    t = 80_000
    await start($, ['1'])
    t = 85_000
    expect(line(await view($), 'Um')?.text).toBe('├─ ◉ Um  0:05')
  })

  test('no desktop, o tempo vai no alt e à direita da linha e do cabeçalho', async ($, on) => {
    let t = 0
    clock(on, () => t)
    noTicker(on)
    await plan($, [{ id: 'A', title: 'Raiz' }])
    await start($, ['A'])
    t = 12_000
    const svgs = await desktop($)
    expect(svgs.map(s => s.alt)).toEqual(['Raiz: 0 de 1 (0%), 0:12, 1 em andamento. Visão: completa, selecionada (≡ resumida, ▤ completa)', 'Em andamento: Raiz, 0:12'])
    expect(svgs[0].source).toContain('0 de 1 · 0% · 0:12')
    expect(svgs[1].source).toContain('>0:12</text>')
  })

  test('sem relógio, nada de tempo', async $ => {
    await plan($, PLAN)
    await start($, ['2'])
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ Sessão A  0/2', '├─ ○ Item 1  0/1', '│  └─ ○ Sub 1.1', '└─ ◉ Item 2'])
  })

  test('o relógio de 1 s só começa com tarefa em andamento', async ($, on) => {
    clock(on, () => 0)
    const asked: number[] = []
    on('clock.every', (_$: any, e: any) => {
      asked.push(e.ms)
      return { deny: 'um período só' } as any
    })
    await plan($, PLAN)
    expect(asked).toEqual([])
    await start($, ['2'])
    expect(asked).toEqual([1000])
  })
})

describe('cartões', () => {
  const ROWS = [
    { sessionId: 'local_pai', title: 'Pai', isRunning: false },
    { sessionId: 'local_11111111-1111-1111-1111-111111111111', name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: 'local_eu' },
  ]
  const PANEL = {
    waiting: true,
    groups: [
      {
        agent: '',
        label: '',
        tasks: [
          {
            id: 'X',
            short: 'X',
            title: 'Trabalho',
            status: 'open',
            children: [
              { id: 'X/1', short: '1', title: 'Feito', status: 'done', startedAt: 0, endedAt: 4_000, children: [] },
              { id: 'X/2', short: '2', title: 'Atual', status: 'open', started: 1, children: [] },
            ],
          },
        ],
      },
    ],
    waits: [{ agent: '', kind: 'question', tool: 'AskUserQuestion', key: 'k' }],
    children: [],
  }
  const opened = async ($: any, on: any) => {
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify(ROWS) }], isError: false } }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify(PANEL) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
  }

  test('a sessão filha vem num cartão cinza: cabeçalho, tarefas e o aviso dentro dele', async ($, on) => {
    await opened($, on)
    const svgs = (await desktop($)).slice(1)
    expect(svgs.map(s => s.alt)).toEqual([
      'Em andamento: Orquestrar, 1 de 4, com sessão filha',
      'Em andamento: Delegar, 1 de 3, com sessão filha',
      'Sessão: filha (Filha A), 1 de 2, aguardando, 0:04',
      'Em andamento: Trabalho, 1 de 2, 0:04',
      'Concluída: Feito, 0:04',
      'Em andamento: Atual',
      'Aguardando sua resposta',
      'Aberta: Conferir',
    ])
    expect(svgs.map(s => s.source.includes('class="cd"'))).toEqual([false, false, true, true, true, true, true, false])
    // The header: the gray branch (not the old blue diamond); the card opens there (top
    // edge, 6 px more) and closes on the notice (bottom edge, 6 px more).
    expect(svgs[2].source).toContain('<g class="gy" fill="none"')
    expect(svgs[2].source).toMatch(/height="34"/)
    expect(svgs[6].source).toMatch(/height="34"/)
    expect(svgs[4].source).toMatch(/height="28"/)
    // The line into the header stops at the card's left edge (icon at 52.5, edge at 40.5).
    // The label has no branch from its task (only the line of the siblings passes by).
    // The branch from its task comes into the card: down and across to the card's left edge.
    expect(svgs[2].source).toMatch(/M32\.5 0V\d+M32\.5 \d+H40\.5/)
    // The label sits inside the card's frame: the card's left edge (40.5), then the name after it.
    expect(svgs[2].source).toMatch(/<path class="cd" d="M40\.5 /)
    expect(Number(/<text class="s" x="([\d.]+)"[^>]*font-weight="600">filha</.exec(svgs[2].source)?.[1])).toBeGreaterThan(40.5)
    // The ⑂ left of the name (where a task's icon is), the name after it.
    const nameX = Number(/<text class="s" x="([\d.]+)"[^>]*font-weight="600">filha</.exec(svgs[2].source)?.[1])
    const branchX = Number(/<g class="gy" fill="none" stroke-width="1.3"><circle cx="([\d.]+)"/.exec(svgs[2].source)?.[1])
    expect(branchX).toBeLessThan(nameX)
  })

  test('cartão dentro de cartão: a neta fecha os dois na última linha', async ($, on) => {
    const grandchild = {
      id: 'local_neta',
      name: 'neta',
      title: 'Neta',
      running: true,
      archived: false,
      anchor: 'X/2',
      panel: { groups: [{ agent: '', label: '', tasks: [{ id: 'N', short: 'N', title: 'Coisa da neta', status: 'open', children: [] }] }], waits: [], children: [] },
    }
    const nested = { ...PANEL, waits: [], children: [grandchild] }
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify(ROWS) }], isError: false } }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify(nested) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const svgs = (await desktop($)).slice(1)
    const last = svgs[svgs.length - 1]
    expect(last.alt).toBe('Em andamento: Coisa da neta')
    // Two cards end here: two fills, and 6 px more for each edge.
    expect(last.source.split('class="cd"').length - 1).toBe(2)
    expect(last.source).toMatch(/height="40"/)
    const neta = svgs.find(s => s.alt.startsWith('Sessão: neta (Neta)'))
    expect(neta?.source.split('class="cd"').length - 1).toBe(2)
  })

  test('no terminal, o cartão vira o cabeçalho "título · nome" com o contador', async ($, on) => {
    await opened($, on)
    const texts = (await view($)).map(l => l.text)
    const at = texts.indexOf('├─ ◉ Delegar  ⑂  1/3')
    expect(texts.slice(at + 1, at + 6)).toEqual([
      '│     ⑂ filha  aguardando',
      '│     ◉ Trabalho  1/2  0:04',
      '│     ├─ ✓ Feito  0:04',
      '│     └─ ◉ Atual',
      '│        └─ ◷ Aguardando sua resposta',
    ])
  })
})

// A subagent's calls: the `agentId` goes in the tool's input (see `call`), with `on('agent.list')`
// for its header; its turn's end (interrupting what it left open) is still tested live.

describe('regras no prompt de sistema', () => {
  const BASE = { sections: [{ id: 'intro', text: 'x', scope: 'shared' }] }
  const compose = ($: any, tools: string[]) =>
    $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools, outputStyle: null, traits: [] } as any)

  test('entram quando o pedido oferece as ferramentas do painel', async ($, on) => {
    on('prompt.compose', () => BASE as any)
    const r: any = await compose($, ['Read', 'mcp__task-tree__plan'])
    const rules = r.sections.find((s: any) => s.id === 'task-tree:regras')
    expect(rules?.scope).toBe('session')
    expect(rules?.text).toContain('Todo pedido abre pelo menos uma tarefa')
    expect(r.sections[r.sections.length - 1].id).toBe('task-tree:regras')
  })

  test('ficam de fora sem as ferramentas do painel', async ($, on) => {
    on('prompt.compose', () => BASE as any)
    const r: any = await compose($, ['Read'])
    expect(r.sections.map((s: any) => s.id)).toEqual(['intro'])
  })
})

describe('/clear', () => {
  test('apaga o painel', async ($, on) => {
    on('classic.SessionStart', () => ({}))
    await plan($, PLAN)
    await $.classic.SessionStart({ source: 'clear' } as any)
    expect((await view($)).map(l => l.text)).toEqual(['Nenhuma tarefa planejada.'])
  })
})

describe('avisos de espera', () => {
  test('pergunta: embaixo da última com start, e some ao responder', async ($, on) => {
    let during: Line[] = []
    on('tool.call', { tool: 'AskUserQuestion' }, async () => {
      during = await view($)
      return { result: 'ok' }
    })
    await plan($, PLAN)
    await start($, ['1.1', '2'])
    await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    const titles = during.map(l => l.title)
    expect(titles[titles.indexOf('Item 2') + 1]).toBe('Aguardando sua resposta')
    expect(line(during, 'Aguardando sua resposta')).toMatchObject({ glyph: '◷', color: 'warning' })
    expect((await view($)).some(l => l.glyph === '◷')).toBe(false)
  })

  test('aprovação de plano sem tarefa aberta: fim da lista', async ($, on) => {
    let during: Line[] = []
    on('tool.call', { tool: 'ExitPlanMode' }, async () => {
      during = await view($)
      return { result: 'ok' }
    })
    await plan($, PLAN)
    await done($, ['A'])
    await $.tool.call({ tool: 'ExitPlanMode' } as any)
    expect(during.slice(-2).map(l => l.text)).toEqual(['└─ ✓ Item 2  —', '◷ Aguardando aprovação do plano'])
  })

  test('permissão: aparece pelo PermissionRequest e some quando a chamada termina', async ($, on) => {
    on('classic.PermissionRequest', () => ({}))
    let during: Line[] = []
    on('tool.call', { tool: 'Bash' }, async () => {
      during = await view($)
      return { result: 'ok' }
    })
    await plan($, PLAN)
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} } as any)
    await $.tool.call({ tool: 'Bash', command: 'ls' } as any)
    expect(during.some(l => l.title === 'Aguardando permissão: Bash')).toBe(true)
    expect((await view($)).some(l => l.glyph === '◷')).toBe(false)
  })

  test('wrap_up com pergunta: aguardando escolha até o próximo prompt', async ($, on) => {
    on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
    on('prompt.submit', (_$: any, e: any) => e)
    await plan($, PLAN)
    await start($, ['2'])
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: 'Qual?', actions: [] } as any)
    const titles = (await view($)).map(l => l.title)
    expect(titles[titles.indexOf('Item 2') + 1]).toBe('Aguardando sua escolha')
    await $.prompt.submit({ text: 'a' } as any)
    expect((await view($)).some(l => l.glyph === '◷')).toBe(false)
  })

  test('wrap_up sem pergunta não cria aviso e tira o anterior', async ($, on) => {
    on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
    await plan($, PLAN)
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r' } as any)
    expect((await view($)).some(l => l.glyph === '◷')).toBe(false)
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: 'Qual?' } as any)
    expect((await view($)).some(l => l.title === 'Aguardando sua escolha')).toBe(true)
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: ' ' } as any)
    expect((await view($)).some(l => l.glyph === '◷')).toBe(false)
  })

  test('wrap_up com tarefas abertas lista as abertas; sem abertas, nada', async ($, on) => {
    on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
    await plan($, PLAN)
    const open = JSON.stringify(await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r' } as any))
    expect(open).toContain('o turno termina com tarefas abertas')
    expect(open).toContain('A/1.1')
    expect(open).toContain('A/2')
    expect(open).not.toContain('Item 1')
    await done($, ['A'])
    const closed = JSON.stringify(await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r' } as any))
    expect(closed).not.toContain('tarefas abertas')
  })

  test('sem plano aberto, a 1ª chamada traz o lembrete e a 2ª não', async ($, on) => {
    on('tool.call', { tool: 'Read' }, async () => ({ result: 'ok' }))
    const first = await $.tool.call({ tool: 'Read', file_path: 'a.txt' } as any)
    expect(JSON.stringify(first)).toContain('sem plano aberto')
    const second = await $.tool.call({ tool: 'Read', file_path: 'b.txt' } as any)
    expect(JSON.stringify(second)).not.toContain('sem plano aberto')
    await plan($, PLAN)
    const planned = await $.tool.call({ tool: 'Read', file_path: 'c.txt' } as any)
    expect(JSON.stringify(planned)).not.toContain('sem plano aberto')
  })

  test('a resposta traz o lembrete só com tarefas abertas', async ($, on) => {
    on('tool.call', { tool: 'AskUserQuestion' }, async () => ({ result: 'ok' }))
    await plan($, PLAN)
    const open = await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    expect(JSON.stringify(open)).toContain('o usuário respondeu')
    await done($, ['A'])
    const closed = await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    expect(JSON.stringify(closed)).not.toContain('o usuário respondeu')
  })

  test('pergunta sem tarefa aberta é recusada e não fica solta no painel', async ($, on) => {
    let asked = false
    on('tool.call', { tool: 'AskUserQuestion' }, async () => {
      asked = true
      return { result: 'ok' }
    })
    const none = await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    expect((none as any).deny).toContain('uma pergunta sempre fica sob uma tarefa em andamento')
    await plan($, PLAN)
    await done($, ['A'])
    const closed = await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    expect((closed as any).deny).toContain('mcp__task-tree__start')
    expect(asked).toBe(false)
    expect((await view($)).some(l => l.glyph === '◷')).toBe(false)
    await start($, ['2'])
    const reopened = await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    expect((reopened as any).deny).toBeUndefined()
    expect(asked).toBe(true)
  })

  const IN_CHAT = 'User did not answer this question — they sent a message instead. Treat that message as their response; do not re-ask.'

  test('pergunta respondida por mensagem no chat: avisa que a mensagem é a resposta e lembra de fechar', async ($, on) => {
    on('tool.call', { tool: 'AskUserQuestion' }, async () => ({ result: IN_CHAT }))
    on('prompt.submit', (_$: any, e: any) => e)
    await plan($, PLAN)
    await start($, ['2'])
    const r = JSON.stringify(await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any))
    expect(r).toContain('vai responder por mensagem no chat')
    expect(r).not.toContain('o usuário respondeu')
    expect((await view($)).some(l => l.glyph === '◷')).toBe(false)
    const msg = JSON.stringify(await $.prompt.submit({ text: 'faça o B' } as any))
    expect(msg).toContain('Esta mensagem é a resposta do usuário à pergunta anterior')
    expect(msg).toContain('tarefas abertas antes desta mensagem')
    expect(msg).toContain('A/2')
    const next = JSON.stringify(await $.prompt.submit({ text: 'outra' } as any))
    expect(next).not.toContain('Esta mensagem é a resposta')
  })

  test('prompt novo lista as tarefas abertas para fechar; sem abertas, não', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    const empty = JSON.stringify(await $.prompt.submit({ text: 'a' } as any))
    expect(empty).not.toContain('tarefas abertas antes desta mensagem')
    await plan($, PLAN)
    const open = JSON.stringify(await $.prompt.submit({ text: 'b' } as any))
    expect(open).toContain('tarefas abertas antes desta mensagem')
    expect(open).not.toContain('Esta mensagem é a resposta')
    await done($, ['A'])
    const closed = JSON.stringify(await $.prompt.submit({ text: 'c' } as any))
    expect(closed).not.toContain('tarefas abertas antes desta mensagem')
  })

  test('pergunta cuja chamada não volta: o aviso some no fim do turno', async ($, on) => {
    on('turn.complete', () => ({ text: '' }) as any)
    on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
    // The turn ends while the dialog is still open (the call has not returned).
    let release = () => {}
    const gate = new Promise<void>(res => (release = res))
    on('tool.call', { tool: 'AskUserQuestion' }, async () => {
      await gate
      return { result: 'ok' }
    })
    await plan($, PLAN)
    await start($, ['2'])
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: 'Qual?' } as any)
    const pending = $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    await new Promise(res => setTimeout(res, 20))
    expect((await view($)).map(l => l.title)).toContain('Aguardando sua resposta')
    await $.turn.complete({ reason: 'end_turn', answer: '', durationMs: 1, isAborted: false, turnId: 't1' } as any)
    const after = (await view($)).map(l => l.title)
    expect(after).not.toContain('Aguardando sua resposta')
    expect(after).toContain('Aguardando sua escolha')
    release()
    await pending
  })

  test('pedido planejado e todo concluído: wrap_up e mensagem final sem lembrete de plano', async ($, on) => {
    on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
    on('tool.call', { tool: 'Read' }, async () => ({ result: 'ok' }))
    on('prompt.submit', (_$: any, e: any) => e)
    await plan($, PLAN)
    await done($, ['A'])
    const wrap = JSON.stringify(await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r' } as any))
    expect(wrap).not.toContain('sem plano aberto')
    const after = JSON.stringify(await $.tool.call({ tool: 'Read', file_path: 'a' } as any))
    expect(after).not.toContain('sem plano aberto')
    await $.prompt.submit({ text: 'pedido novo' } as any)
    const unplanned = JSON.stringify(await $.tool.call({ tool: 'Read', file_path: 'b' } as any))
    expect(unplanned).toContain('sem plano aberto')
  })
})

describe('sessões abertas', () => {
  const ROWS = (running: boolean) => [
    { sessionId: 'local_pai', title: 'Pai', isRunning: false },
    { sessionId: 'local_11111111-1111-1111-1111-111111111111', name: 'filha', title: 'Filha A', isRunning: running, isArchived: false, startedBy: 'local_eu' },
    { sessionId: 'local_irma', title: 'Irmã', isRunning: true, startedBy: 'local_pai' },
  ]

  const CHILD_TASKS = [
    {
      id: 'X',
      short: 'X',
      title: 'Trabalho da filha',
      status: 'open',
      children: [
        { id: 'X/1', short: '1', title: 'Passo feito', status: 'done', children: [] },
        { id: 'X/2', short: '2', title: 'Passo atual', status: 'open', started: 1, children: [] },
      ],
    },
  ]
  const answer = (rows: () => unknown) =>
    () => ({ value: { content: [{ type: 'text', text: JSON.stringify(rows()) }], isError: false } }) as any

  test('fica embaixo da tarefa em andamento ao abrir, com as tarefas dela, e fecha numa linha', async ($, on) => {
    let running = true
    on('mcp.call', answer(() => ROWS(running)))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) =>
      ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: CHILD_TASKS }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    let lines = await view($)
    const texts = lines.map(l => l.text)
    const at = texts.indexOf('├─ ◉ Delegar  ⑂  1/3')
    expect(texts.slice(at, at + 6)).toEqual([
      '├─ ◉ Delegar  ⑂  1/3',
      '│     ⑂ filha',
      '│     ◉ Trabalho da filha  1/2',
      '│     ├─ ✓ Passo feito  —',
      '│     └─ ◉ Passo atual',
      '└─ ○ Conferir',
    ])
    expect(line(lines, 'Passo atual')?.color).toBe('warning')
    // Running: the card's progress icon is the amber ring, with the branch beside it.
    expect(line(lines, 'filha')).toMatchObject({ label: true, glyph: '⑂' })
    expect(lines[1].text).toBe('█████░░░░░░░░░░░░░░░  ● 3  ⑂ 1')
    expect(texts.some(t => t.includes('Irmã'))).toBe(false)
    running = false
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    lines = await view($)
    const row = lines.find(l => l.title === 'filha')
    // Stopped with a task still open: "parada", open, with its tasks as it planned them.
    expect(row?.text).toBe('│     ⑂ filha  parada')
    expect(line(lines, 'Passo atual')).toBeDefined()
  })

  test('a pergunta do wrap_up entra no que a sessão publica', async ($, on) => {
    const written: Record<string, string> = {}
    on('mcp.call', (_$: any, e: any) =>
      e.tool === 'get_session'
        ? ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any)
        : ({ value: { content: [{ type: 'text', text: '[]' }], isError: false } } as any))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('clock.now', () => ({ value: 1 }) as any)
    on('fs.write', (_$: any, e: any) => {
      written[e.path.split('\\').join('/')] = e.text
      return { value: undefined } as any
    })
    on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
    await plan($, PLAN)
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: 'Qual?' } as any)
    const file = JSON.parse(written['C:/home/.claude/task-tree-waits/local_eu.json'] ?? '{}')
    expect(file.waiting).toBe(true)
    expect(file.waits?.[0]?.kind).toBe('choice')
  })

  test('sem id da sessão, a falha vai para o log de depuração', async ($, on) => {
    const logs: string[] = []
    on('mcp.call', (_$: any, e: any) =>
      e.tool === 'get_session'
        ? ({ value: { content: [{ type: 'text', text: 'not found' }], isError: true } } as any)
        : ({ value: { content: [{ type: 'text', text: '[]' }], isError: false } } as any))
    on('ui.log', (_$: any, e: any) => {
      logs.push(`${e.to}:${e.text}`)
      return { value: undefined } as any
    })
    await plan($, PLAN)
    expect(logs.some(l => l.startsWith('debug:task-tree: get_session falhou'))).toBe(true)
  })

  test('a sessão publica as próprias tarefas para quem a abriu', async ($, on) => {
    const written: Record<string, string> = {}
    on('mcp.call', (_$: any, e: any) =>
      e.tool === 'get_session'
        ? ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any)
        : ({ value: { content: [{ type: 'text', text: '[]' }], isError: false } } as any))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('clock.now', () => ({ value: 1 }) as any)
    on('fs.write', (_$: any, e: any) => {
      written[e.path] = e.text
      return { value: undefined } as any
    })
    await plan($, PLAN)
    await done($, ['2'])
    const key = Object.keys(written).find(k => k.split('\\').join('/').endsWith('/.claude/task-tree-waits/local_eu.json'))
    const file = JSON.parse(written[key ?? ''] ?? '{}')
    expect(file.waiting).toBe(false)
    expect(file.tasks?.[0]?.title).toBe('Sessão A')
    expect(file.tasks?.[0]?.children?.[1]?.status).toBe('done')
    expect(file.groups?.[0]?.tasks?.[0]?.title).toBe('Sessão A')
    expect(Array.isArray(file.waits)).toBe(true)
    expect(Array.isArray(file.children)).toBe(true)
  })

  test('concluída a tarefa de origem, a filha fica embaixo dela, rodando ou parada', async ($, on) => {
    let running = true
    on('mcp.call', answer(() => ROWS(running)))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Orquestrar' }, { id: 'B', title: 'Depois' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['A'])
    expect((await view($)).map(l => l.text)).toEqual([
      'Depois  1 de 2 · 50%',
      '██████████░░░░░░░░░░  ● 1  ⑂ 1',
      '◉ Orquestrar  ⑂  1/1',
      '   ⑂ filha',
      '◉ Depois',
    ])
    running = false
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect((await view($)).map(l => l.text)).toEqual([
      'Depois  1 de 2 · 50%',
      '██████████░░░░░░░░░░  ● 1',
      '✓ Orquestrar  ⑂  1/1  —',
      '   ⑂ filha  concluída',
      '◉ Depois',
    ])
  })

  test('os pais somam as tarefas da filha e ficam em andamento enquanto ela trabalha', async ($, on) => {
    let state: 'running' | 'stopped' | 'archived' = 'running'
    on('mcp.call', answer(() =>
      ROWS(state === 'running').map(r => (r.sessionId.includes('11111111') ? { ...r, isArchived: state === 'archived' } : r))))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) =>
      ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: CHILD_TASKS }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Investigar', children: [{ id: '1', title: 'Ler' }, { id: '2', title: 'Encaminhar' }] }])
    await done($, ['1'])
    await start($, ['2'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['2'])
    // Done by the model, but the session still works: in progress, its 1/2 added (2+1 of 2+2).
    let texts = (await view($)).map(l => l.text)
    expect(texts[0]).toBe('Investigar  3 de 4 · 75%')
    expect(texts).toContain('◉ Investigar  ⑂  3/4')
    expect(texts).toContain('└─ ◉ Encaminhar  ⑂  2/3')
    // Stopped: back to done, the sum stays.
    state = 'stopped'
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    texts = (await view($)).map(l => l.text)
    expect(texts[0]).toBe('Tarefas  3 de 4 · 75%')
    expect(texts).toContain('✓ Investigar  ⑂  3/4  —')
    // Archived: still counted, as history; what it left open reads as interrupted (out of M).
    state = 'archived'
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    texts = (await view($)).map(l => l.text)
    expect(texts[0]).toBe('Tarefas  3 de 3 · 100%')
    expect(texts[1]).toContain('✕ 1')
  })

  test('o tempo dos pais vai até o fim das tarefas da filha, correndo enquanto ela trabalha', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    let state: 'running' | 'stopped' = 'running'
    on('mcp.call', answer(() => ROWS(state === 'running')))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    const kid = (ended: boolean) => [
      { id: 'X', short: 'X', title: 'Passo 1', status: 'done', startedAt: 2_000, endedAt: 60_000, children: [] },
      { id: 'Y', short: 'Y', title: 'Passo 2', status: ended ? 'done' : 'open', startedAt: 3_000, endedAt: ended ? 70_000 : undefined, children: [] },
    ]
    on('fs.read', (_$: any, e: any) =>
      ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: kid(state === 'stopped') }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Investigar', children: [{ id: '1', title: 'Ler' }, { id: '2', title: 'Encaminhar' }] }])
    await start($, ['1'])
    t = 1_000
    await done($, ['1'])
    await start($, ['2'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    t = 5_000
    await done($, ['2'])
    // Done here at 0:05, but the session still works: both run to now.
    t = 90_000
    let texts = (await view($)).map(l => l.text)
    expect(texts[0]).toBe('Investigar  3 de 4 · 75%  1:30')
    expect(texts).toContain('◉ Investigar  ⑂  3/4  1:30')
    expect(texts).toContain('└─ ◉ Encaminhar  ⑂  2/3  1:29')
    // Stopped: up to the end of its last task (1:10).
    state = 'stopped'
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    t = 200_000
    texts = (await view($)).map(l => l.text)
    expect(texts).toContain('✓ Investigar  ⑂  4/4  1:10')
    expect(texts).toContain('└─ ✓ Encaminhar  ⑂  3/3  1:09')
  })

  test('as tarefas da filha entram no contador e no desenho, com o aviso embaixo da tarefa dela', async ($, on) => {
    on('mcp.call', answer(() => ROWS(true)))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    const panel = {
      waiting: true,
      groups: [{ agent: '', label: '', tasks: CHILD_TASKS }],
      waits: [{ agent: '', kind: 'question', tool: 'AskUserQuestion', key: 'k' }],
      children: [],
    }
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify(panel) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [
      { id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Abrir filha' }, { id: '2', title: 'Conferir' }] },
    ])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['1'])
    const lines = await view($)
    const texts = lines.map(l => l.text)
    expect(texts).toEqual([
      'Orquestrar  2 de 4 · 50%',
      '██████████░░░░░░░░░░  ● 2  ◷ 1  ⑂ 1',
      '◉ Orquestrar  ⑂  2/4',
      '├─ ◉ Abrir filha  ⑂  2/3',
      '│     ⑂ filha  aguardando',
      '│     ◉ Trabalho da filha  1/2',
      '│     ├─ ✓ Passo feito  —',
      '│     └─ ◉ Passo atual',
      '│        └─ ◷ Aguardando sua resposta',
      '└─ ◉ Conferir',
    ])
    expect(line(lines, 'Passo atual')?.color).toBe('warning')
    expect(line(lines, 'Passo feito')?.color).toBe('success')
    expect(line(lines, 'Trabalho da filha')?.color).toBe('warning')
  })

  test('origem dentro de um nível 1 concluído: tudo fica à vista, a filha sob a origem', async ($, on) => {
    on('mcp.call', answer(() => ROWS(true)))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Abrir filha' }, { id: '2', title: 'Outra' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['A'])
    expect(rowsOf(await view($)).map(l => l.text)).toEqual([
      '◉ Orquestrar  ⑂  2/2',
      '├─ ◉ Abrir filha  ⑂  1/1',
      '│     ⑂ filha',
      '└─ ✓ Outra  —',
    ])
  })

  test('sem tarefa de origem, a filha vai para o fim da lista', async ($, on) => {
    on('mcp.call', answer(() => ROWS(true)))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await plan($, [{ id: 'A', title: 'Orquestrar' }])
    await start($, ['A'])
    const texts = (await view($)).map(l => l.text)
    expect(texts[texts.length - 1]).toBe('⑂ filha')
  })

  test('quando a filha termina o turno, a principal é lembrada da tarefa de origem uma vez', async ($, on) => {
    let running = true
    on('mcp.call', answer(() => ROWS(running)))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    on('tool.call', { tool: 'Read' }, async () => ({ result: 'ok' }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }])
    await start($, ['1'])
    const first = await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect(JSON.stringify(first)).not.toContain('terminou o turno')
    running = false
    const ended = await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect(JSON.stringify(ended)).toContain('terminou o turno a sessão \\"filha\\"')
    expect(JSON.stringify(ended)).toContain('A/1')
    const after = await $.tool.call({ tool: 'Read', file_path: 'a' } as any)
    expect(JSON.stringify(after)).not.toContain('terminou o turno')
  })

  test('recém-aberta e ainda parada no host, a filha não conta como turno terminado', async ($, on) => {
    let running = false
    on('mcp.call', answer(() => ROWS(running)))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }])
    await start($, ['1'])
    const first = await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect(JSON.stringify(first)).not.toContain('terminou o turno')
    const still = await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect(JSON.stringify(still)).not.toContain('terminou o turno')
    running = true
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    running = false
    const ended = await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect(JSON.stringify(ended)).toContain('terminou o turno a sessão \\"filha\\"')
  })

  test('filha esperando o usuário fica amarela, aguardando sua resposta', async ($, on) => {
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify(ROWS(true)) }], isError: false } }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) =>
      ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: true }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const row = (await view($)).find(l => l.title === 'filha')
    expect(row?.text).toBe('⑂ filha  aguardando')
    // The label has no icon: the word is amber.
    const root: any = await (async () => {
      const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
      const r = await ui.drawn()
      await ui.unmount()
      return r
    })()
    const find = (el: any): any =>
      el && typeof el === 'object'
        ? (el.children ?? []).includes('  aguardando') ? el : (el.children ?? []).map(find).find(Boolean)
        : undefined
    expect(find(root)?.props?.color).toBe('warning')
  })

  test('a sessão abre e recolhe; parada, vem recolhida e abre com as tarefas dela', async ($, on) => {
    let running = true
    on('mcp.call', answer(() => ROWS(running)))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) =>
      ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: CHILD_TASKS }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const key = 's:local_11111111-1111-1111-1111-111111111111'
    await fold($, key)
    let lines = await view($)
    expect(lines.find(l => l.title === 'filha')?.fold).toBe('▸')
    expect(line(lines, 'Trabalho da filha')).toBeUndefined()
    // The chips still count the session at work.
    expect(lines[1].text).toContain('⑂ 1')
    await fold($, key)
    expect(line(await view($), 'Trabalho da filha')?.glyph).toBe('◉')
  })

  test('parada com tarefa aberta, a sessão vem aberta com as tarefas dela e recolhe', async ($, on) => {
    on('mcp.call', answer(() => ROWS(false)))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) =>
      ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: CHILD_TASKS }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect((await view($)).find(l => l.title === 'filha')?.text).toBe('│     ⑂ filha  parada')
    expect(line(await view($), 'Passo atual')?.glyph).toBe('◉')
    await fold($, 's:local_11111111-1111-1111-1111-111111111111')
    expect(line(await view($), 'Passo atual')).toBeUndefined()
  })

  const failing = () => ({ value: { content: [{ type: 'text', text: 'sem servidor' }], isError: true } }) as any
  const tools = (names: string[]) => () => ({ value: names.map(name => ({ name, description: '' })) }) as any

  test('fora do app desktop, sem as ferramentas dele, não mostra que as sessões estão indisponíveis', async ($, on) => {
    on('mcp.call', failing)
    on('tool.list', tools(['Read', 'Bash']))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Tarefa' }])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect((await view($)).some(l => l.text.includes('Sessões indisponíveis'))).toBe(false)
  })

  test('no app desktop, a falha ao listar as sessões aparece no painel', async ($, on) => {
    on('mcp.call', failing)
    on('tool.list', tools(['Read', 'mcp__ccd_turn__update_plan']))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Tarefa' }])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect((await view($)).some(l => l.text.includes('Sessões indisponíveis: Error: sem servidor'))).toBe(true)
  })

  const answering = (text: string) => () => ({ value: { content: [{ type: 'text', text }] } }) as any

  test('no app desktop, sem sessões ligadas ("No other sessions found."), não mostra erro', async ($, on) => {
    on('mcp.call', answering('No other sessions found.'))
    on('tool.list', tools(['Read', 'mcp__ccd_turn__update_plan']))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Tarefa' }])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const lines = await view($)
    expect(lines.some(l => l.text.includes('Sessões indisponíveis'))).toBe(false)
    expect(line(lines, 'Tarefa')).toBeDefined()
  })

  test('no app desktop, uma resposta que não é lista nem "nenhuma sessão" ainda aparece como erro', async ($, on) => {
    on('mcp.call', answering('Unexpected failure'))
    on('tool.list', tools(['Read', 'mcp__ccd_turn__update_plan']))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await plan($, [{ id: 'A', title: 'Tarefa' }])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect((await view($)).some(l => l.text.includes('Sessões indisponíveis'))).toBe(true)
  })
})

describe('turnos', () => {
  const ask = ($: any, text: string) => $.prompt.submit({ text } as any)
  const planAs = ($: any, tasks: unknown, request?: string) => call($, 'plan', request === undefined ? { tasks } : { tasks, request })

  test('cada mensagem do usuário agrupa os níveis 1 planejados nela, na ordem', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await ask($, 'corrija o erro\n do topo do painel')
    await plan($, [{ id: 'A', title: 'Corrigir', children: [{ id: '1', title: 'Achar' }, { id: '2', title: 'Testar' }] }])
    await done($, ['A'])
    await ask($, 'agora some os tempos')
    await plan($, [{ id: 'B', title: 'Somar' }])
    await plan($, [{ id: 'C', title: 'Conferir' }])
    const rows = rowsOf(await view($)).map(l => l.text)
    // Done, a turn stays open: only the person folds it.
    expect(rows).toEqual([
      '✓ corrija o erro do topo do painel  2/2  —',
      '└─ ✓ Corrigir  2/2  —',
      '   ├─ ✓ Achar  —',
      '   └─ ✓ Testar  —',
      '◉ agora some os tempos  0/2',
      '├─ ◉ Somar',
      '└─ ○ Conferir',
    ])
    await fold($, '|T:1')
    expect(rowsOf(await view($)).slice(0, 2).map(l => l.text)).toEqual([
      '✓ corrija o erro do topo do painel ⋯  2/2  —',
      '◉ agora some os tempos  0/2',
    ])
    expect((await desktop($)).map(s => s.alt).slice(1, 3)).toEqual([
      'Pedido concluído: corrija o erro do topo do painel, 2 de 2, recolhida',
      'Pedido em andamento: agora some os tempos, 0 de 2',
    ])
  })

  test('request dá o nome do pedido; mensagem sem plano não vira turno', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await ask($, 'oi, tudo bem? me explique o código')
    await ask($, 'quero que o painel agrupe as tarefas por turno, com o pedido como nome')
    await planAs($, [{ id: 'A', title: 'Agrupar' }], 'Agrupar por turno')
    await planAs($, [{ id: 'B', title: 'Testar' }])
    const rows = rowsOf(await view($)).map(l => l.text)
    expect(rows).toEqual(['◉ Agrupar por turno  0/2', '├─ ◉ Agrupar', '└─ ○ Testar'])
    // Replanned in a later message, a level-1 task stays in its turn, in its place.
    await ask($, 'outra coisa')
    await planAs($, [{ id: 'A', title: 'Agrupar de novo' }], 'Outra coisa')
    await planAs($, [{ id: 'Z', title: 'Nova' }])
    expect(rowsOf(await view($)).map(l => l.text)).toEqual([
      '◉ Agrupar por turno  0/2',
      '├─ ◉ Agrupar de novo',
      '└─ ○ Testar',
      '○ Outra coisa  0/1',
      '└─ ○ Nova',
    ])
  })

  test('níveis 1 de antes dos turnos ficam soltos, antes dos turnos', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await plan($, [{ id: 'V', title: 'Velha' }])
    await done($, ['V'])
    await ask($, 'pedido novo')
    await plan($, [{ id: 'N', title: 'Nova' }])
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['✓ Velha  —', '◉ pedido novo  0/1', '└─ ◉ Nova'])
  })

  test('o turno soma as tarefas e o tempo das sessões abertas nas tarefas dele', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: 'local_11111111-1111-1111-1111-111111111111', name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    const kid = [
      { id: 'X', short: 'X', title: 'Passo 1', status: 'done', startedAt: 2_000, endedAt: 60_000, children: [] },
      { id: 'Y', short: 'Y', title: 'Passo 2', status: 'open', startedAt: 3_000, children: [] },
    ]
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: kid }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
    await ask($, 'investigue o erro')
    await planAs($, [{ id: 'A', title: 'Investigar' }], 'Investigar o erro')
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    t = 5_000
    await done($, ['A'])
    t = 90_000
    const rows = rowsOf(await view($)).map(l => l.text)
    // 1 own task (done) + the session's 1 of 2; running while the session works.
    expect(rows[0]).toBe('◉ Investigar o erro  ⑂  2/3  1:30')
  })
})

describe('ícone de sessão filha', () => {
  const ROWS = (state: 'running' | 'stopped' | 'archived') => [
    { sessionId: 'local_pai', title: 'Pai', isRunning: false },
    {
      sessionId: 'local_11111111-1111-1111-1111-111111111111',
      name: 'filha',
      title: 'Filha A',
      isRunning: state === 'running',
      isArchived: state === 'archived',
      startedBy: 'local_eu',
    },
  ]
  const KID = [{ id: 'X', short: 'X', title: 'Passo', status: 'done', children: [] }]
  const setup = (on: any, state: () => 'running' | 'stopped' | 'archived') => {
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify(ROWS(state())) }], isError: false } }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: KID }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({
      result: 'Started session local_11111111-1111-1111-1111-111111111111 (filha)',
    }))
  }
  const opened = async ($: any) => {
    await plan($, [{ id: 'A', title: 'Investigar', children: [{ id: '1', title: 'Ler' }, { id: '2', title: 'Encaminhar' }] }])
    await done($, ['1'])
    await start($, ['2'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['2'])
  }

  test('o cartão mantém o ícone de progresso e ganha o de ramificação, em qualquer estado', async ($, on) => {
    let state: 'running' | 'stopped' | 'archived' = 'stopped'
    setup(on, () => state)
    await opened($)
    const card = (await view($)).find(l => l.title === 'filha')
    expect(card).toMatchObject({ label: true, glyph: '⑂' })
    expect(card?.text).toContain('⑂ filha')
    expect(card?.text).toContain('concluída')
    // Desktop: a label, no progress icon (no check), the name, then the branch and the word.
    const svg = (await desktop($)).find(s => s.alt.startsWith('Sessão: filha (Filha A)'))?.source ?? ''
    expect(svg.indexOf('class="gr" d="M')).toBe(-1)
    // The name is the Button that folds the card; the drawing has the branch and the word.
    expect(svg).toContain('<g class="gy" fill="none" stroke-width="1.3">')
    expect(svg).toContain('>concluída<')
    state = 'running'
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const running = (await view($)).find(l => l.title === 'filha')
    expect(running).toMatchObject({ label: true, glyph: '⑂' })
    expect(running?.text).toContain('⑂ filha')
  })

  test('a tarefa de origem e os pais mostram que há sessão filha, mesmo recolhidos', async ($, on) => {
    let state: 'running' | 'stopped' | 'archived' = 'stopped'
    setup(on, () => state)
    await opened($)
    // All done, session stopped: still open (only the person folds).
    let rows = rowsOf(await view($)).map(l => l.text)
    expect(rows.slice(0, 3)).toEqual(['✓ Investigar  ⑂  3/3  —', '├─ ✓ Ler  —', '└─ ✓ Encaminhar  ⑂  2/2  —'])
    // Folded by the person, the level-1 line still says a session is below.
    await fold($, '|t:A')
    rows = rowsOf(await view($)).map(l => l.text)
    expect(rows).toEqual(['✓ Investigar ⋯  ⑂  3/3  —'])
    expect((await desktop($)).map(s => s.alt).slice(1)).toEqual(['Concluída: Investigar, 3 de 3, com sessão filha, recolhida'])
    await fold($, '|t:A')
    // Desktop: the check at the left, the title, then the branch left of the bar.
    const parent = (await desktop($)).find(s => s.alt.startsWith('Concluída: Investigar'))?.source ?? ''
    expect(parent.indexOf('class="gr" d="M')).toBeLessThan(parent.indexOf('Investigar'))
    expect(parent.indexOf('Investigar')).toBeLessThan(parent.indexOf('<g class="gy" fill="none" stroke-width="1.3">'))
    // The branch sits in one column, left of the bar, on the parent and on the task it was opened
    // on; a line with no session below keeps that column empty.
    const svgs = await desktop($)
    const branchX = (src?: string) => /<g class="gy" fill="none" stroke-width="1.3"><circle cx="([\d.]+)"/.exec(src ?? '')?.[1]
    const anchor = svgs.find(s => s.alt.startsWith('Concluída: Encaminhar'))?.source
    expect(branchX(anchor)).toBeDefined()
    expect(branchX(anchor)).toBe(branchX(parent))
    expect(branchX(svgs.find(s => s.alt.startsWith('Concluída: Ler'))?.source)).toBeUndefined()
    // Archived: the session stays below, as history; the branch stays on the parent.
    state = 'archived'
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect(rowsOf(await view($)).map(l => l.text)[0]).toBe('✓ Investigar  ⑂  3/3  —')
  })

  test('com a sessão parada e tudo concluído, os pais ficam ✓ (lista velha lida de novo)', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    on('tool.call', { tool: 'Read' }, async () => ({ result: 'ok' }))
    let state: 'running' | 'stopped' | 'archived' = 'running'
    setup(on, () => state)
    await opened($)
    expect(rowsOf(await view($)).map(l => l.text)[0]).toBe('◉ Investigar  ⑂  3/3  0:00')
    // The session stops; with no poll, the next call of the main loop reads the list again
    // once it is older than 3 s (the card follows the session's own pane closely).
    state = 'stopped'
    t = 2_000
    await $.tool.call({ tool: 'Read', file_path: 'a' } as any)
    expect(rowsOf(await view($)).map(l => l.text)[0]).toMatch(/^◉ Investigar  ⑂  3\/3/)
    t = 5_000
    await $.tool.call({ tool: 'Read', file_path: 'a' } as any)
    expect(rowsOf(await view($)).map(l => l.text)[0]).toMatch(/^✓ Investigar  ⑂  3\/3/)
  })
})

describe('concluídas com o mesmo layout', () => {
  test('done sem start mostra tempo: da irmã anterior, do pai ou do plano', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    await plan($, [{ id: 'A', title: 'Raiz', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
    t = 30_000
    await done($, ['1'])
    t = 50_000
    await done($, ['2'])
    // Um from the plan (0:00) to 0:30; Dois from Um's end to 0:50; the parent their span.
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['✓ Raiz  2/2  0:50', '├─ ✓ Um  0:30', '└─ ✓ Dois  0:20'])
  })

  test('linha concluída tem barra, d/n e tempo como a em andamento, nas mesmas colunas', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    await plan($, [
      { id: 'A', title: 'Feita', children: [{ id: '1', title: 'x' }] },
      { id: 'B', title: 'Andando', children: [{ id: '1', title: 'y' }, { id: '2', title: 'z' }] },
    ])
    await start($, ['A/1'])
    t = 5_000
    await done($, ['A'])
    await start($, ['B/1'])
    t = 9_000
    const svgs = await desktop($)
    const doneRow = svgs.find(s => s.alt.startsWith('Concluída: Feita'))?.source ?? ''
    const openRow = svgs.find(s => s.alt.startsWith('Em andamento: Andando'))?.source ?? ''
    // Both carry the bar, the count and the time.
    for (const src of [doneRow, openRow]) {
      expect(src).toContain('<rect class="tr"')
      expect(src).toMatch(/>\d+\/\d+<\/text>/)
      expect(src).toMatch(/>\d+:\d\d<\/text>/)
    }
    // The count and the bar sit at the same x on both lines.
    const xOf = (src: string, re: RegExp) => re.exec(src)?.[1]
    expect(xOf(doneRow, /<text class="s" x="([\d.]+)"[^>]*>\d+\/\d+</)).toBe(xOf(openRow, /<text class="s" x="([\d.]+)"[^>]*>\d+\/\d+</))
    expect(xOf(doneRow, /<rect class="tr" x="([\d.]+)"/)).toBe(xOf(openRow, /<rect class="tr" x="([\d.]+)"/))
    // The progress icon stays at the left, before the title; a leaf has no bar.
    const ring = /<circle class="am" cx="([\d.]+)"/
    const titleX = (src: string, name: string) => new RegExp(`x="([\\d.]+)" y="[\\d.]+" font-size="\\d+">${name}<`).exec(src)?.[1]
    const leaf = svgs.find(s => s.alt.startsWith('Em andamento: y'))?.source ?? ''
    expect(leaf).not.toContain('<rect class="tr"')
    expect(Number(xOf(openRow, ring))).toBeLessThan(Number(titleX(openRow, 'Andando')))
    expect(Number(xOf(leaf, ring))).toBeLessThan(Number(titleX(leaf, 'y')))
  })

  test('sem tempo conhecido (painel antigo), a concluída mostra "—" no lugar do tempo', async $ => {
    await plan($, [{ id: 'A', title: 'Antiga', children: [{ id: '1', title: 'x' }] }])
    await done($, ['A'])
    const row = (await desktop($)).find(s => s.alt.startsWith('Concluída: Antiga'))?.source ?? ''
    expect(row).toContain('>—</text>')
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['✓ Antiga  1/1  —', '└─ ✓ x  —'])
  })
})

describe('mensagens a outras sessões', () => {
  const KID = 'local_11111111-1111-1111-1111-111111111111'
  const setup = (on: any, running: () => boolean) => {
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: running(), isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', () => ({ value: '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${KID}; it is busy and will see it when its turn ends.` }))
  }
  // A start_session for the same id reads the list of sessions again (a refresh).
  const refresh = ($: any) => $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
  const send = ($: any) => $.tool.call({ tool: 'SendMessage', to: KID, message: 'aprovado' } as any)

  test('mensagem na fila: o resultado pede para manter a tarefa, que ganha o ícone de espera da sessão', async ($, on) => {
    setup(on, () => true)
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Abrir filha' }, { id: '2', title: 'Avisar a filha' }] }])
    await start($, ['1'])
    await refresh($)
    await done($, ['1'])
    await start($, ['2'])
    const r = JSON.stringify(await send($))
    expect(r).toContain('ficou na fila, sem confirmação de recebimento')
    expect(r).toContain('A/2')
    // Terminal: the envelope in place of the ring; the header counts it apart.
    const lines = await view($)
    expect(line(lines, 'Avisar a filha')).toMatchObject({ glyph: '✉', color: 'permission' })
    expect(lines[1].text).toContain('✉ 1')
    expect(lines[1].text).not.toContain('● ')
    // Desktop: its own icon in the progress column, and the alt says whom it waits on.
    const svgs = await desktop($)
    const row = svgs.find(s => s.alt.startsWith('Aguardando confirmação de'))
    expect(row?.alt).toBe(`Aguardando confirmação de ${KID}: Avisar a filha`)
    expect(row?.source).toContain('<g class="bl"')
    expect(svgs[0].alt).toContain('1 aguardando sessão')
  })

  test('a sessão para e volta a rodar: recebimento confirmado, lembrete uma vez e o sinal some', async ($, on) => {
    let running = true
    setup(on, () => running)
    on('tool.call', { tool: 'Read' }, async () => ({ result: 'ok' }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Abrir filha' }, { id: '2', title: 'Avisar a filha' }] }])
    await start($, ['1'])
    await refresh($)
    await done($, ['1'])
    await start($, ['2'])
    await send($)
    // Still busy with its turn: not taken up yet.
    expect(JSON.stringify(await refresh($))).not.toContain('recebimento confirmado')
    expect(line(await view($), 'Avisar a filha')?.glyph).toBe('✉')
    running = false
    expect(JSON.stringify(await refresh($))).not.toContain('recebimento confirmado')
    // Running again: it started on the message.
    running = true
    const confirmed = JSON.stringify(await refresh($))
    expect(confirmed).toContain('recebimento confirmado')
    expect(confirmed).toContain('A/2')
    // Taken up: the sending task closed by itself.
    expect(line(await view($), 'Avisar a filha')).toMatchObject({ glyph: '✓', color: 'success' })
    expect(JSON.stringify(await $.tool.call({ tool: 'Read', file_path: 'a' } as any))).not.toContain('recebimento confirmado')
  })

  test('done na tarefa com a mensagem na fila: conclui, mas avisa', async ($, on) => {
    setup(on, () => true)
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Abrir filha' }, { id: '2', title: 'Avisar a filha' }] }])
    await start($, ['1'])
    await refresh($)
    await done($, ['1'])
    await start($, ['2'])
    await send($)
    const r = text(await done($, ['2']))
    expect(r).toContain('a mensagem para local_11111111-1111-1111-1111-111111111111 ("A/2") ainda está na fila')
    expect(r).toContain('Concluídas:')
    // Another done later (of what was already closed) does not repeat it.
    expect(text(await done($, ['A']))).not.toContain('ainda está na fila')
  })
})

describe('visão resumida', () => {
  const pick = async ($: any, view: 'full' | 'summary', surface: 'terminal' | 'desktop' = 'terminal') => {
    const ui = await $.ui.mount({ plugin: 'task-tree', surface, component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: `view:${view}` })
    await ui.unmount()
  }
  const toggleOf = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    const labels = (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props.label)).filter((l: string) => /^\[?[≡▤]\]?$/.test(l))
    await ui.unmount()
    return labels
  }
  const PLAN2 = [
    { id: 'A', title: 'Feito', children: [{ id: '1', title: 'a1' }] },
    { id: 'B', title: 'Fazendo', children: [{ id: '1', title: 'b1' }, { id: '2', title: 'b2' }, { id: '3', title: 'b3' }] },
    { id: 'C', title: 'Depois' },
  ]

  const starting = (on: any, saved: unknown) => {
    on('session.start', () => ({ cwd: '.' }) as any)
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: 'No other sessions found.' }], isError: false } }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    on('session.id', () => ({ value: 'sessao-1' }) as any)
    on('store.get', (_$: any, e: any) => ({ value: e.key === 'view:sessao-1' ? saved : undefined }) as any)
    on('store.set', () => ({ value: undefined }) as any)
    on('command.register', () => ({ value: {} }) as any)
    on('tool.register', () => ({ value: {} }) as any)
    on('ui.open', () => ({ value: {} }) as any)
  }

  test('sessão nova começa na resumida', async ($, on) => {
    starting(on, undefined)
    await $.session.start({ cwd: '.' } as any)
    expect(await toggleOf($)).toEqual(['[≡]', '▤'])
  })

  test('no resume, vale a visão guardada para a sessão', async ($, on) => {
    starting(on, 'full')
    await $.session.start({ cwd: '.' } as any)
    expect(await toggleOf($)).toEqual(['≡', '[▤]'])
  })

  test('no desktop, o toggle são dois ícones no canto direito da linha do título', async $ => {
    await plan($, [{ id: 'A', title: 'Uma' }])
    await pick($, 'summary', 'desktop')
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    const corner = (await ui.findAll({ type: 'Box' })).find((b: any) => b.props.position === 'absolute')
    const buttons = (await ui.findAll({ type: 'Button' })).filter((b: any) => String(b.props.key ?? '').startsWith('view:') || /^[≡▤]$/.test(String(b.props.label)))
    await ui.unmount()
    expect(corner?.props).toMatchObject({ top: 0, right: 0 })
    // Only the glyphs: no text beside them, no children (a desktop draws the label as the text).
    expect(buttons.map((b: any) => b.props.label)).toEqual(['≡', '▤'])
    expect(buttons.every((b: any) => b.props.children === undefined || (Array.isArray(b.props.children) && b.props.children.length === 0))).toBe(true)
    expect(buttons[0].props.variant).toBe('primary')
    expect(buttons[1].props).toMatchObject({ plain: true, dimColor: true })
    // Which one is chosen is said in the header's alt.
    expect((await desktop($))[0]?.alt).toContain('Visão: resumida, selecionada')
    // The title line keeps room for them: the count and time go on the line below it.
    const head = (await desktop($))[0]?.source ?? ''
    expect(head).toMatch(/<text class="s" x="8" y="36"[^>]*>0 de 1 · 0%</)
  })

  test('painel estreito: o título encurta antes dos ícones e o N de M fica na linha de baixo', async $ => {
    await plan($, [{ id: 'A', title: 'Um título bem comprido para não caber ao lado dos dois ícones do canto' }])
    const head = (await desktop($, 20))[0]?.source ?? ''
    const title = /<text class="p" x="8" y="18"[^>]*>(?:<title>[^<]*<\/title>)?([^<]*)</.exec(head)?.[1] ?? ''
    expect(title.endsWith('…')).toBe(true)
    expect(head).toContain('>0 de 1 · 0%</text>')
  })

  test('nome cortado com …: tooltip com o nome inteiro numa camada interativa; a linha segue imagem', async $ => {
    const long = 'Uma tarefa com um nome comprido demais para caber na largura estreita do painel lateral'
    await plan($, [{ id: 'A', title: 'Curta', children: [{ id: '1', title: long }] }])
    const svgs = await desktop($, 30, true)
    // The line: an image (never a frame), cut with …
    const row = svgs.find(s => s.alt.includes(long))
    expect(row?.hover).toBe(false)
    expect(row?.source).toContain('…')
    // Over it, a transparent interactive layer with the whole name; the pointer is the arrow.
    const layer = svgs.find(s => s.hover && s.source.includes(`<title>${long}</title>`))
    expect(layer?.alt).toBe('')
    expect(layer?.source).toContain('fill="transparent"')
    expect(layer?.source).toContain('cursor:default')
    const short = svgs.find(s => s.alt.includes('Curta') && !s.alt.includes(long))
    expect(short?.source).not.toContain('<title>')
    expect(svgs.filter(s => s.hover).every(s => s.alt === '')).toBe(true)
  })

  test('linha cortada com relógio: a camada do tooltip não muda a cada segundo (não pisca)', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    const long = 'Uma tarefa em andamento com um nome comprido demais para caber na largura do painel'
    await plan($, [{ id: 'A', title: 'Raiz', children: [{ id: '1', title: long }] }])
    await start($, ['1'])
    t = 5_000
    const a = await desktop($, 30, true)
    t = 6_000
    const b = await desktop($, 30, true)
    const rowA = a.find(s => s.alt.includes(long))?.source
    const rowB = b.find(s => s.alt.includes(long))?.source
    // The line's image changes with the time; the interactive layer (a frame) stays the same.
    expect(rowA).not.toBe(rowB)
    expect(a.filter(s => s.hover).map(s => s.source)).toEqual(b.filter(s => s.hover).map(s => s.source))
    expect(a.filter(s => s.hover).length).toBeGreaterThan(0)
  })

  test('o toggle no topo alterna as visões e a escolha fica', async $ => {
    await plan($, PLAN2)
    expect(await toggleOf($)).toEqual(['≡', '[▤]'])
    await pick($, 'summary')
    expect(await toggleOf($)).toEqual(['[≡]', '▤'])
    // Another mount (a redraw, another surface) keeps it.
    expect((await desktop($))[0].alt).toContain('Visão: resumida, selecionada')
    await pick($, 'full', 'desktop')
    expect(await toggleOf($)).toEqual(['≡', '[▤]'])
  })

  test('resumida: o trabalho atual inteiro, concluídas visíveis; cabeçalho inteiro', async $ => {
    await plan($, PLAN2)
    await done($, ['A', 'B/1'])
    await start($, ['B/2'])
    const full = rowsOf(await view($)).map(l => l.text)
    await pick($, 'summary')
    const lines = await view($)
    expect(lines[0].text).toBe('Fazendo  2 de 5 · 40%')
    expect(lines[1].text).toContain('█')
    // The whole current work (one plan), drawn as the full view draws it: the done level-1 task
    // open too (only the person folds), the one in progress open with its subtasks, the pending one.
    expect(rowsOf(lines).map(l => l.text)).toEqual([
      '✓ Feito  1/1  —',
      '└─ ✓ a1  —',
      '◉ Fazendo  1/3',
      '├─ ✓ b1  —',
      '├─ ◉ b2',
      '└─ ○ b3',
      '○ Depois',
    ])
    // The same ▾/▸ as the full view: close the one in progress.
    await fold($, '|t:B')
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['✓ Feito  1/1  —', '└─ ✓ a1  —', '◉ Fazendo ⋯  1/3', '○ Depois'])
    // One state for both views: the full view shows the same choices.
    await pick($, 'full')
    const fullRows = rowsOf(await view($)).map(l => l.text)
    expect(fullRows).toContain('◉ Fazendo ⋯  1/3')
    expect(fullRows).toContain('└─ ✓ a1  —')
    expect(full.length).toBeGreaterThan(2)
  })

  test('resumida: os 4 filhos da tarefa em andamento, d/n coerente e tempo desde o plano', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'toggle e resumida' } as any)
    await call($, 'plan', {
      tasks: [{ id: '23', title: 'Toggle segmentado', children: [{ id: '1', title: 'Ver API' }, { id: '2', title: 'Pílula' }, { id: '3', title: 'Padrão' }, { id: '4', title: 'Testes' }] }],
      request: 'Toggle segmentado',
    })
    await pick($, 'summary')
    t = 65_000
    // Nothing started: the first open subtask is in progress; times run from the plan.
    expect(rowsOf(await view($)).map(l => l.text)).toEqual([
      '◉ Toggle segmentado  0/4  1:05',
      '└─ ◉ Toggle segmentado  0/4  1:05',
      '   ├─ ◉ Ver API  1:05',
      '   ├─ ○ Pílula',
      '   ├─ ○ Padrão',
      '   └─ ○ Testes',
    ])
  })

  test('o cabeçalho tem o tempo e o N de M da sessão inteira, nas duas visões', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'primeiro pedido' } as any)
    await plan($, [{ id: 'A', title: 'Antigo', children: [{ id: '1', title: 'a1' }, { id: '2', title: 'a2' }] }])
    t = 30_000
    await done($, ['A'])
    t = 100_000
    await $.prompt.submit({ text: 'segundo pedido' } as any)
    await plan($, [{ id: 'B', title: 'Atual', children: [{ id: '1', title: 'b1' }, { id: '2', title: 'b2' }] }])
    await start($, ['B/1'])
    t = 200_000
    // From the first plan (0:00) to now: 3:20, though the current turn took 1:40.
    const full = (await view($)).slice(0, 2).map(l => l.text)
    expect(full[0]).toBe('Atual  2 de 4 · 50%  3:20')
    await pick($, 'summary')
    const lines = await view($)
    expect(lines.slice(0, 2).map(l => l.text)).toEqual(full)
    // The turn's own line keeps its own time.
    expect(rowsOf(lines)[0]?.text).toBe('◉ segundo pedido  0/2  1:40')
  })

  test('resumida: tudo concluído mantém a lista com ✓; um plano novo limpa e mostra só o novo', async ($, on) => {
    let saved: Record<string, unknown> = {}
    on('session.id', () => ({ value: 'sessao-1' }) as any)
    on('store.set', (_$: any, e: any) => {
      saved[e.key] = e.value
      return { value: undefined } as any
    })
    await plan($, [{ id: 'A', title: 'Uma' }, { id: 'B', title: 'Outra' }])
    await pick($, 'summary')
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ Uma', '○ Outra'])
    // During the work a closed task stays.
    await done($, ['A'])
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['✓ Uma  —', '◉ Outra'])
    // All closed: the list stays, all ✓, and the bar is full.
    await done($, ['B'])
    let lines = await view($)
    expect(rowsOf(lines).map(l => l.text)).toEqual(['✓ Uma  —', '✓ Outra  —'])
    expect(lines[1].text).toBe('████████████████████')
    // It stays across mounts (the state) and is kept for a resume (the store).
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['✓ Uma  —', '✓ Outra  —'])
    expect(saved['work:sessao-1']).toEqual(['A', 'B'])
    // New work: only it is drawn; the header stays the session's.
    await plan($, [{ id: 'C', title: 'Nova' }])
    lines = await view($)
    expect(rowsOf(lines).map(l => l.text)).toEqual(['◉ Nova'])
    expect(lines[0].text).toBe('Nova  2 de 3 · 67%')
    expect(saved['work:sessao-1']).toEqual(['C'])
    // A plan while it is open joins it.
    await plan($, [{ id: 'D', title: 'Junto' }])
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ Nova', '○ Junto'])
  })

  test('no resume, o trabalho atual guardado volta', async ($, on) => {
    on('session.start', () => ({ cwd: '.' }) as any)
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: 'No other sessions found.' }], isError: false } }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    on('session.id', () => ({ value: 'sessao-1' }) as any)
    on('command.register', () => ({ value: {} }) as any)
    on('tool.register', () => ({ value: {} }) as any)
    on('ui.open', () => ({ value: {} }) as any)
    on('store.set', () => ({ value: undefined }) as any)
    const saved: Record<string, unknown> = {
      'session:sessao-1': [{ agent: '', label: '', tasks: [
        { id: 'A', short: 'A', title: 'Antiga', status: 'done', children: [] },
        { id: 'B', short: 'B', title: 'Desta vez', status: 'done', children: [] },
      ] }],
      'view:sessao-1': 'summary',
      'work:sessao-1': ['B'],
    }
    on('store.get', (_$: any, e: any) => ({ value: saved[e.key] }) as any)
    await $.session.start({ cwd: '.' } as any)
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['✓ Desta vez  —'])
  })

  test('resumida: a sessão viva aparece sob a tarefa de origem, também resumida', async ($, on) => {
    const KID = 'local_11111111-1111-1111-1111-111111111111'
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    const tasks = [
      { id: 'X', short: 'X', title: 'Trabalho', status: 'open', children: [
        { id: 'X/1', short: '1', title: 'Feito', status: 'done', children: [] },
        { id: 'X/2', short: '2', title: 'Atual', status: 'open', started: 1, children: [] },
        { id: 'X/3', short: '3', title: 'Falta', status: 'open', children: [] },
      ] },
    ]
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Delegar' }, { id: '2', title: 'Conferir' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await pick($, 'summary')
    expect(rowsOf(await view($)).map(l => l.text)).toEqual([
      '◉ Orquestrar  ⑂  1/5',
      '├─ ◉ Delegar  ⑂  1/4',
      '│     ⑂ filha',
      '│     ◉ Trabalho  1/3',
      '│     ├─ ✓ Feito  —',
      '│     ├─ ◉ Atual',
      '│     └─ ○ Falta',
      '└─ ○ Conferir',
    ])
  })
})

describe('chip em andamento', () => {
  test('conta as folhas abertas (◉ e ○) do painel inteiro, nas duas visões', async ($, on) => {
    const KID = 'local_11111111-1111-1111-1111-111111111111'
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    // The session: B1 in progress, B2 to do.
    const tasks = [
      { id: 'B', short: 'B', title: 'B', status: 'open', children: [
        { id: 'B/1', short: '1', title: 'B1', status: 'open', started: 1, children: [] },
        { id: 'B/2', short: '2', title: 'B2', status: 'open', children: [] },
      ] },
    ]
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    // Here: A1, A2 in progress, A3 to do, Conferir in progress.
    await plan($, [
      { id: 'A', title: 'A', children: [{ id: '1', title: 'A1' }, { id: '2', title: 'A2' }, { id: '3', title: 'A3' }] },
      { id: 'C', title: 'Conferir' },
    ])
    await start($, ['A/1', 'A/2', 'C'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const lines = await view($)
    // A1, A2, A3, Conferir, B1, B2: 6; it is M − N of the header.
    expect(lines[1]?.text).toContain('● 6')
    expect(lines[0]?.text).toContain('0 de 6')
    expect((await desktop($))[0]?.alt).toContain('6 em andamento')
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
    expect((await view($))[1]?.text).toContain('● 6')
    await done($, ['A/1'])
    expect((await view($))[1]?.text).toContain('● 5')
  })
})

describe('anel de contexto da sessão filha', () => {
  const K1 = 'local_11111111-1111-1111-1111-111111111111'
  const K2 = 'local_22222222-2222-2222-2222-222222222222'
  // `ctx`: each session's published share (undefined: none published yet).
  const setup = (on: any, ctx: Record<string, number | undefined>) => {
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: K1, name: 'um', title: 'Filha 1', isRunning: true, isArchived: false, startedBy: 'local_eu' },
          { sessionId: K2, name: 'dois', title: 'Filha 2', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => {
      const id = [K1, K2].find(k => String(e.path).includes(k.slice(6, 14)))
      const percent = id ? ctx[id] : undefined
      return { value: id ? JSON.stringify({ waiting: false, tasks: [], ...(percent === undefined ? {} : { context: { percent, at: 1 } }) }) : '{}' } as any
    })
    let next = 0
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${[K1, K2][next++ % 2]} (filha)` }))
  }
  const open = async ($: any, both = false) => {
    await plan($, [{ id: 'A', title: 'Investigar', children: [{ id: '1', title: 'Encaminhar' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    if (both) await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'y' } as any)
  }
  const svgOf = async ($: any, start: string) => (await desktop($)).find(s => s.alt.startsWith(start))

  test('42%: anel azul com arco de 42% só no cartão da filha, solto na ponta direita; o pai não tem anel', async ($, on) => {
    setup(on, { [K1]: 42 })
    await open($)
    // The parent lines keep the ⑂, not the ring.
    for (const name of ['Em andamento: Investigar', 'Em andamento: Encaminhar']) {
      const row = await svgOf($, name)
      expect(row?.source).not.toContain('class="tk"')
      expect(row?.alt).not.toContain('contexto')
      expect(row?.source).toContain('<g class="gy" fill="none" stroke-width="1.3">')
    }
    // The card: the ring with a 42% arc, at the right end of its label line, apart from the name.
    const card = await svgOf($, 'Sessão: um (Filha 1)')
    expect(card?.alt).toContain('contexto da sessão um: 42%')
    const len = 2 * Math.PI * 5.5
    expect(card?.source).toContain(`stroke-dasharray="${((len * 42) / 100).toFixed(2)} ${len.toFixed(2)}"`)
    const ringX = Number(/<circle class="tk" cx="([\d.]+)"/.exec(card?.source ?? '')?.[1])
    const nameX = Number(/font-weight="600">um</.test(card?.source ?? '') ? /<text class="s" x="([\d.]+)"[^>]*font-weight="600">um</.exec(card?.source ?? '')?.[1] : NaN)
    expect(ringX).toBeGreaterThan(nameX + 100)
    expect(ringX).toBeGreaterThan((card?.width ?? 0) - 40)
    // Terminal: on the card's line only, last.
    const lines = await view($)
    expect(lines.find(l => l.title === 'Investigar')?.text).not.toContain('%')
    expect(lines.find(l => l.title === 'um')?.text).toMatch(/42%$/)
  })

  test('75% âmbar, 90% vermelho, no cartão', async ($, on) => {
    const ctx: Record<string, number | undefined> = { [K1]: 75 }
    setup(on, ctx)
    await open($)
    expect((await svgOf($, 'Sessão: um (Filha 1)'))?.source).toMatch(/class="am" cx="[\d.]+" cy="[\d.]+" r="5.5" fill="none" stroke-width="2" stroke-linecap="round" stroke-dasharray/)
    ctx[K1] = 90
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    expect((await svgOf($, 'Sessão: um (Filha 1)'))?.source).toMatch(/class="rd" cx="[\d.]+" cy="[\d.]+" r="5.5" fill="none" stroke-width="2" stroke-linecap="round" stroke-dasharray/)
    expect((await svgOf($, 'Sessão: um (Filha 1)'))?.alt).toContain('contexto da sessão um: 90%')
  })

  test('sem percentual publicado, sem anel', async ($, on) => {
    setup(on, {})
    await open($)
    expect((await svgOf($, 'Sessão: um (Filha 1)'))?.source).not.toContain('class="tk"')
    expect((await view($)).find(l => l.title === 'um')?.text).not.toContain('%')
  })

  test('duas filhas sob o mesmo pai: cada cartão com o seu anel, o pai sem nenhum', async ($, on) => {
    setup(on, { [K1]: 30, [K2]: 80 })
    await open($, true)
    expect((await svgOf($, 'Em andamento: Investigar'))?.source).not.toContain('class="tk"')
    expect((await svgOf($, 'Sessão: um (Filha 1)'))?.alt).toContain('contexto da sessão um: 30%')
    expect((await svgOf($, 'Sessão: dois (Filha 2)'))?.alt).toContain('contexto da sessão dois: 80%')
  })
})

describe('contexto publicado', () => {
  test('a sessão publica a parte do contexto usada (sem detalhamento)', async ($, on) => {
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('clock.now', () => ({ value: 1000 }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    let asked: unknown = 'none'
    on('session.usage', (_$: any, e: any) => {
      asked = e
      return { value: { startedAt: 0, context: { window: 200000, tokens: 84000, percent: 42 }, rateLimits: [] } } as any
    })
    let written = ''
    on('fs.write', (_$: any, e: any) => {
      written = String(e.text ?? '')
      return { value: undefined } as any
    })
    await plan($, [{ id: 'A', title: 'Uma' }])
    expect(JSON.parse(written).context).toEqual({ percent: 42, at: 1000 })
    expect((asked as any)?.breakdown).toBeUndefined()
  })
})

describe('trabalho atual por turno', () => {
  test('no mesmo turno, um plano depois de tudo concluído soma; no turno seguinte, começa outro', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    const saved: Record<string, unknown> = {}
    on('session.id', () => ({ value: 'sessao-1' }) as any)
    on('store.set', (_$: any, e: any) => {
      saved[e.key] = e.value
      return { value: undefined } as any
    })
    await $.prompt.submit({ text: 'primeiro pedido' } as any)
    await plan($, [{ id: 'A', title: 'Ver se dá' }])
    await done($, ['A'])
    await plan($, [{ id: 'B', title: 'Fazer' }])
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
    // The turn shows both its level-1 tasks: its 1/2 matches the lines.
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ primeiro pedido  1/2', '├─ ✓ Ver se dá  —', '└─ ◉ Fazer'])
    // The same message: B joined A's work rather than starting another.
    expect(saved['work:sessao-1']).toEqual(['A', 'B'])
    await done($, ['B'])
    await $.prompt.submit({ text: 'segundo pedido' } as any)
    await plan($, [{ id: 'C', title: 'Outra coisa' }])
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ segundo pedido  0/1', '└─ ◉ Outra coisa'])
    expect(saved['work:sessao-1']).toEqual(['C'])
  })
})

describe('sessão filha na resumida', () => {
  const KID = 'local_11111111-1111-1111-1111-111111111111'
  const setup = (on: any, running: () => boolean) => {
    on('prompt.submit', (_$: any, e: any) => e)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: running(), isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', () => ({ value: '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'delivered; its turn has started on it' }))
  }
  const summary = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
  }
  const full = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:full' })
    await ui.unmount()
  }
  // Turn 1 opens the session on A; turn 2 starts new work, C.
  const story = async ($: any) => {
    await $.prompt.submit({ text: 'primeiro' } as any)
    await plan($, [{ id: 'A', title: 'Abrir a filha' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['A'])
    await $.prompt.submit({ text: 'terceiro' } as any)
    await plan($, [{ id: 'C', title: 'Pedir à filha' }])
    await start($, ['C'])
  }

  test('mensagem à filha numa tarefa do trabalho atual: a resumida a mostra ali; a completa não muda', async ($, on) => {
    setup(on, () => false)
    await story($)
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'faça' } as any)
    await summary($)
    expect(rowsOf(await view($)).map(l => l.text)).toEqual([
      '◉ terceiro  ⑂  0/1',
      '└─ ✉ Pedir à filha  ⑂  0/1',
      '      ⑂ filha  concluída',
    ])
    await full($)
    // Full view (the old turn stays open): still under the task it was opened on.
    const texts = rowsOf(await view($)).map(l => l.text)
    const at = texts.findIndex(t => t.includes('Abrir a filha'))
    expect(texts[at + 1]).toContain('filha')
    expect(texts.find(t => t.includes('Pedir à filha'))).not.toContain('⑂')
  })

  test('sessão viva sem tarefa no trabalho atual: aparece no fim da resumida', async ($, on) => {
    setup(on, () => true)
    await story($)
    await summary($)
    const texts = rowsOf(await view($)).map(l => l.text)
    expect(texts[0]).toBe('◉ terceiro  0/1')
    expect(texts[texts.length - 1]).toContain('⑂ filha')
  })
})

describe('cartão da filha com a rodada atual', () => {
  const KID = 'local_11111111-1111-1111-1111-111111111111'
  const PANEL = (work?: string[]) => ({
    waiting: false,
    groups: [{
      agent: '',
      label: '',
      turns: [{ id: 1, title: 'pedido antigo' }, { id: 2, title: 'pedido atual' }],
      tasks: [
        { id: 'O', short: 'O', title: 'Antiga', status: 'done', turn: 1, children: [] },
        { id: 'N', short: 'N', title: 'Nova', status: 'open', started: 1, turn: 2, children: [
          { id: 'N/1', short: '1', title: 'n1', status: 'done', children: [] },
          { id: 'N/2', short: '2', title: 'n2', status: 'open', started: 1, children: [] },
        ] },
      ],
    }],
    waits: [],
    children: [],
    ...(work ? { work } : {}),
  })
  const setup = (on: any, work?: string[]) => {
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify(PANEL(work)) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
  }
  const pickView = async ($: any, v: 'summary' | 'full') => {
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: `view:${v}` })
    await ui.unmount()
  }
  const open = async ($: any) => {
    await plan($, [{ id: 'A', title: 'Delegar' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
  }

  test('resumida: o cartão mostra só a rodada atual da filha, com o d/n dela; completa: tudo', async ($, on) => {
    setup(on, ['N'])
    await open($)
    await pickView($, 'summary')
    expect(rowsOf(await view($)).map(l => l.text)).toEqual([
      '◉ Delegar  ⑂  1/3',
      '   ⑂ filha',
      '   ◉ Nova  1/2',
      '   ├─ ✓ n1  —',
      '   └─ ◉ n2',
    ])
    await pickView($, 'full')
    const texts = rowsOf(await view($)).map(l => l.text)
    expect(texts.some(t => t.includes('Antiga'))).toBe(true)
    expect(texts.some(t => t.includes('Nova'))).toBe(true)
    expect(texts.find(t => /^[│ ]*⑂ filha/.test(t))).not.toMatch(/\d+\/\d+/)
  })

  test('sem marco publicado (versão antiga): o turno mais recente com tarefas', async ($, on) => {
    setup(on)
    await open($)
    await pickView($, 'summary')
    const texts = rowsOf(await view($)).map(l => l.text)
    expect(texts.some(t => t.includes('Antiga'))).toBe(false)
    expect(texts.some(t => t.includes('Nova'))).toBe(true)
  })
})

describe('rodadas de mensagens de outra sessão', () => {
  test('mensagem de outra sessão (meta) abre turno, com o texto sem as tags; e muda o trabalho', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    const ask = (text: string) => $.prompt.submit({ text: `<cross-session-message from="local_x" name="Principal">\n${text}\n</cross-session-message>`, isMeta: true } as any)
    await ask('primeiro pedido')
    await plan($, [{ id: 'A', title: 'Um' }])
    await done($, ['A'])
    await ask('segundo pedido')
    await plan($, [{ id: 'B', title: 'Dois' }])
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ segundo pedido  0/1', '└─ ◉ Dois'])
  })

  const KID = 'local_11111111-1111-1111-1111-111111111111'
  const cardOf = async ($: any, on: any, panel: object) => {
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify(panel) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    await plan($, [{ id: 'P', title: 'Delegar' }])
    await start($, ['P'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
    return rowsOf(await view($)).map(l => l.text)
  }
  const old = (k: number, turn?: number) => ({ id: `O${k}`, short: `O${k}`, title: `Antiga ${k}`, status: 'done', ...(turn ? { turn } : {}), children: [] })
  const now = (turn?: number) => ({ id: 'N', short: 'N', title: 'Atual', status: 'open', started: 1, ...(turn ? { turn } : {}), children: [
    { id: 'N/1', short: '1', title: 'n1', status: 'open', started: 1, children: [] },
    { id: 'N/2', short: '2', title: 'n2', status: 'open', children: [] },
  ] })

  test('cartão: filha com muitos níveis 1 concluídos em turnos antigos mostra só o atual', async ($, on) => {
    const tasks = [...[1, 2, 3, 4, 5].map(k => old(k, k)), now(6)]
    const turns = [1, 2, 3, 4, 5, 6].map(id => ({ id, title: `pedido ${id}` }))
    const rows = await cardOf($, on, { groups: [{ agent: '', label: '', turns, tasks }], waits: [], children: [], work: ['N'] })
    expect(rows.some(t => t.includes('Antiga'))).toBe(false)
    expect(rows.find(t => /^[│ ]*⑂ filha/.test(t))).not.toMatch(/\d+\/\d+/)
    expect(rows.some(t => t.includes('Atual'))).toBe(true)
  })

  test('cartão sem marco e sem turnos (versão antiga): só o último nível 1 aberto, nunca o painel inteiro', async ($, on) => {
    const tasks = [...[1, 2, 3].map(k => old(k)), now()]
    const rows = await cardOf($, on, { groups: [{ agent: '', label: '', tasks }], waits: [], children: [] })
    expect(rows.some(t => t.includes('Antiga'))).toBe(false)
    expect(rows.some(t => t.includes('Atual'))).toBe(true)
  })
})

describe('respostas por grupo e origem das mensagens', () => {
  test('plan responde o tamanho do plano enviado e as abertas do grupo de quem chama', async $ => {
    const r = await plan($, [
      { id: 'A', title: 'A', children: [
        { id: '1', title: 'a1', children: [{ id: '1.1', title: 'x' }, { id: '1.2', title: 'y' }] },
        { id: '2', title: 'a2', children: [{ id: '2.1', title: 'z' }, { id: '2.2', title: 'w' }] },
      ] },
    ])
    expect(text(r)).toBe('Plano exibido no painel: 7 tarefas neste plano (4 abertas no seu grupo).')
    const r2 = await plan($, [{ id: 'B', title: 'B' }])
    expect(text(r2)).toBe('Plano exibido no painel: 1 tarefa neste plano (5 abertas no seu grupo).')
  })

  test('done conta só o grupo de quem chama: o subagente não vê a principal', async ($, on) => {
    on('agent.list', () => ({ value: [{ id: 'sub1', type: 'Explore', description: 'ler', parentId: undefined }] }) as any)
    await plan($, [{ id: 'A', title: 'Principal', children: [{ id: '1', title: 'p1' }, { id: '2', title: 'p2' }, { id: '3', title: 'p3' }] }])
    const sp = await plan($, [{ id: 'S', title: 'Do subagente', children: [{ id: '1', title: 's1' }, { id: '2', title: 's2' }] }], 'sub1')
    expect(text(sp)).toBe('Plano exibido no painel: 3 tarefas neste plano (2 abertas no seu grupo).')
    expect(text(await done($, ['S/1'], 'sub1'))).toBe('Concluídas: 1/2 no seu grupo.')
    expect(text(await done($, ['A/1']))).toBe('Concluídas: 1/3 no seu grupo.')
  })

  test('a volta de um subagente (task-notification) não abre turno nem parte o trabalho', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'pedido do usuário', origin: { kind: 'composer' } } as any)
    await plan($, [{ id: 'A', title: 'Com subagente' }])
    await done($, ['A'])
    const back = JSON.stringify(await $.prompt.submit({ text: '<task-notification>subagente terminou</task-notification>', isMeta: true, origin: { kind: 'task-notification' } } as any))
    expect(back).toContain('atualize o painel')
    expect(back).not.toContain('No primeiro plan desta mensagem')
    expect(back).not.toContain('tarefas abertas antes desta mensagem')
    // A plan after it stays in the same turn and work.
    await plan($, [{ id: 'B', title: 'Depois do subagente' }])
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ pedido do usuário  1/2', '├─ ✓ Com subagente  —', '└─ ◉ Depois do subagente'])
  })

  test('a mensagem de outra sessão (peer) abre turno', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'pedido do usuário', origin: { kind: 'composer' } } as any)
    await plan($, [{ id: 'A', title: 'Um' }])
    await done($, ['A'])
    const peer = JSON.stringify(await $.prompt.submit({ text: '<cross-session-message from="x">outro pedido</cross-session-message>', isMeta: true, origin: { kind: 'peer' } } as any))
    expect(peer).toContain('No primeiro plan desta mensagem')
    await plan($, [{ id: 'B', title: 'Dois' }])
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
    expect(rowsOf(await view($)).map(l => l.text)).toEqual(['◉ outro pedido  0/1', '└─ ◉ Dois'])
  })
})

describe('sessão arquivada', () => {
  test('continua visível, em cinza e "arquivada"; conta no N de M; não no "em andamento"; ⑂ e anel ficam', async ($, on) => {
    const KID = 'local_55555555-5555-5555-5555-555555555555'
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'arq', title: 'Teste arquivada', isRunning: false, isArchived: true, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    // Its last panel: one task done, one left open; 61% of its context used.
    const panel = {
      waiting: false,
      groups: [{ agent: '', label: '', tasks: [
        { id: 'X', short: 'X', title: 'Feita', status: 'done', children: [] },
        { id: 'Y', short: 'Y', title: 'Deixada', status: 'open', children: [] },
      ] }],
      waits: [],
      children: [],
      context: { percent: 61, at: 1 },
    }
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('55555555') ? JSON.stringify(panel) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (arq)` }))
    await plan($, [{ id: 'A', title: 'Delegar' }, { id: 'B', title: 'Seguir' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['A'])
    const lines = await view($)
    // A ✓, B open, its Feita ✓, its Deixada interrupted: 2 de 3 (and 1 interrupted).
    expect(lines[0].text).toBe('Seguir  2 de 3 · 67%')
    // "em andamento" counts B only, not the archived one's leaf; no "sessão ativa".
    expect(lines[1].text).toContain('● 1')
    expect(lines[1].text).not.toContain('⑂ 1')
    const card = lines.find(l => l.title === 'arq')
    expect(card).toMatchObject({ label: true, glyph: '⑂' })
    expect(card?.text).toContain('arquivada')
    // The branch stays on the task it was opened on; the ring with the last share, dim.
    expect(lines.find(l => l.title === 'Delegar')?.text).toContain('⑂')
    const svgs = await desktop($)
    const parent = svgs.find(s => s.alt.startsWith('Concluída: Delegar'))
    expect(parent?.alt).toContain('com sessão filha')
    // The ring only on the card (dim, archived), not on the task it was opened on.
    expect(parent?.alt).not.toContain('contexto')
    const arq = svgs.find(s => s.alt.startsWith('Sessão: arq (Teste arquivada)'))
    expect(arq?.alt).toContain('arquivada')
    expect(arq?.alt).toContain('contexto da sessão arq: 61%')
    expect(arq?.source).toContain('<g opacity=".45"><circle class="tk"')
  })
})

describe('pais aguardando e avisos do app', () => {
  test('pai aberto com um filho ✓ e nada em andamento aparece aguardando (◷), com o tempo parado', async ($, on) => {
    let t = 0
    on('clock.now', () => ({ value: t }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'Desarquivar e arquivar de novo para testar', origin: { kind: 'composer' } } as any)
    await plan($, [
      { id: 'A', title: 'Testar a sessão arquivada', children: [{ id: '1', title: 'um' }, { id: '2', title: 'dois' }, { id: '3', title: 'três' }, { id: '4', title: 'quatro' }] },
      { id: 'B', title: 'Outra coisa' },
    ])
    t = 30_000
    await done($, ['A/1'])
    await start($, ['B'])
    t = 200_000
    const rows = rowsOf(await view($))
    const turn = rows[0]
    const parent = rows.find(l => l.title === 'Testar a sessão arquivada')
    // The turn has B in progress: ◉. The level-1 task: ◷ amber, 1/4, its time stopped at 0:30.
    expect(turn?.glyph).toBe('◉')
    expect(parent).toMatchObject({ glyph: '◷', color: 'warning' })
    expect(parent?.text).toContain('1/4  0:30')
    expect((await desktop($)).map(s => s.alt)).toContain('Aguardando: Testar a sessão arquivada, 1 de 4, 0:30')
    // Not in the "em andamento" chip beyond its open leaves, no chip of its own.
    expect((await view($))[1].text).not.toContain('◷')
    // With nothing started anywhere, the first open task lights up (◉), as always: not waiting.
    await done($, ['B'])
    expect(rowsOf(await view($))[0]?.glyph).toBe('◉')
  })

  test('o aviso do app (system-reminder / side-sessions-event) não abre turno nem dá título', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'pedido do usuário', origin: { kind: 'composer' } } as any)
    await plan($, [{ id: 'A', title: 'Um' }])
    await done($, ['A'])
    const r = JSON.stringify(
      await $.prompt.submit({
        text: '<system-reminder>\n<side-sessions-event>The session "Teste de sessão arquivada" ended its turn.</side-sessions-event>\n</system-reminder>',
        isMeta: true,
        origin: { kind: 'plugin', name: 'app' },
      } as any),
    )
    expect(r).not.toContain('No primeiro plan desta mensagem')
    await plan($, [{ id: 'B', title: 'Dois' }])
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
    const rows = rowsOf(await view($)).map(l => l.text)
    expect(rows[0]).toBe('◉ pedido do usuário  1/2')
    expect(rows.some(l => l.includes('The session'))).toBe(false)
  })
})

describe('textos reais do host (0.7.3)', () => {
  const LINKED =
    '<system-reminder>\nLinked sessions now (status, not an instruction): filha-a = local_33333333-3333-3333-3333-333333333333 (idle). ' +
    'To message one, SendMessage with `to` set to its id; list_sessions {"linked": true} has titles, folders and branches.\n</system-reminder>\n\n'
  const peer = (body: string) =>
    LINKED +
    `<cross-session-message from="local_44444444-4444-4444-4444-444444444444" name="Sessão principal">\n${body}\n</cross-session-message>`
  const HANDBACK =
    '<agent-message from="a0000000000000001">\n[Subagent hand-back] The text below is the final report of a subagent you launched. ' +
    'Read it and continue.\n\nRelatório: li o plugin.json (0.7.2).\n</agent-message>\n' +
    '<task-notification>\n<task-id>a0000000000000001</task-id>\n<status>completed</status>\n</task-notification>'
  const SIDE =
    '<system-reminder>\n<side-sessions-event>The session "Sessão de teste" (local_55555555-5555-5555-5555-555555555555) ' +
    'ended its turn. Its report: "Plano concluído."</side-sessions-event>\n</system-reminder>'
  const summary = async ($: any) => {
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    await ui.press({ key: 'view:summary' })
    await ui.unmount()
    return rowsOf(await view($)).map(l => l.text)
  }

  test('mensagem de outra sessão com o prefixo "Linked sessions now" abre turno, com o título dela, e troca o trabalho', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: peer('Primeiro pedido'), isMeta: true, origin: { kind: 'peer' } } as any)
    await plan($, [{ id: 'A', title: 'Um' }])
    await done($, ['A'])
    const r = JSON.stringify(await $.prompt.submit({ text: peer('Segundo pedido: faça o B'), isMeta: true, origin: { kind: 'peer' } } as any))
    expect(r).toContain('No primeiro plan desta mensagem')
    await plan($, [{ id: 'B', title: 'Dois' }])
    expect(await summary($)).toEqual(['◉ Segundo pedido: faça o B  0/1', '└─ ◉ Dois'])
  })

  test('volta de subagente no meio do pedido (agent-message + task-notification) não abre turno nem troca o trabalho', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'pedido do usuário', origin: { kind: 'composer' } } as any)
    await plan($, [{ id: 'A', title: 'Com subagente' }])
    await done($, ['A'])
    const r = JSON.stringify(await $.prompt.submit({ text: HANDBACK, isMeta: true, origin: { kind: 'peer' } } as any))
    expect(r).toContain('o subagente terminou')
    expect(r).not.toContain('No primeiro plan desta mensagem')
    await plan($, [{ id: 'B', title: 'Depois' }])
    const rows = await summary($)
    expect(rows[0]).toBe('◉ pedido do usuário  1/2')
    expect(rows.some(l => l.includes('Subagent hand-back'))).toBe(false)
  })

  test('o aviso <side-sessions-event> do app não abre turno', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    await $.prompt.submit({ text: 'pedido do usuário', origin: { kind: 'composer' } } as any)
    await plan($, [{ id: 'A', title: 'Um' }])
    const r = JSON.stringify(await $.prompt.submit({ text: SIDE, isMeta: true, origin: { kind: 'plugin', name: 'app' } } as any))
    expect(r).not.toContain('No primeiro plan desta mensagem')
    await plan($, [{ id: 'B', title: 'Dois' }])
    expect((await summary($))[0]).toBe('◉ pedido do usuário  0/2')
  })

  test('quem recebe publica o received com o remetente e a hora', async ($, on) => {
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_filha' }) }], isError: false } }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('clock.now', () => ({ value: 5000 }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    let written = ''
    on('fs.write', (_$: any, e: any) => {
      written = String(e.text ?? '')
      return { value: undefined } as any
    })
    await $.prompt.submit({ text: peer('faça'), isMeta: true, origin: { kind: 'peer' } } as any)
    expect(JSON.parse(written).received).toEqual([{ from: 'local_44444444-4444-4444-4444-444444444444', at: 5000 }])
  })

  const KID = 'local_11111111-1111-1111-1111-111111111111'
  const ME = 'local_eu'
  test('destino sempre rodando nas leituras: confirma pelo received publicado', async ($, on) => {
    let t = 1000
    on('clock.now', () => ({ value: t }) as any)
    on('mcp.call', (_$: any, e: any) =>
      JSON.stringify(e).includes('get_session')
        ? ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: ME }) }], isError: false } } as any)
        : ({
            value: {
              content: [{ type: 'text', text: JSON.stringify([
                { sessionId: 'local_pai', title: 'Pai', isRunning: false },
                { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: ME },
              ]) }],
              isError: false,
            },
          } as any),
    )
    on('env.get', () => ({ value: 'C:/home' }) as any)
    let received: { from: string; at: number }[] = []
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: [], received }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${KID}; that session is holding it (a turn is in progress there).` }))
    await plan($, [{ id: 'A', title: 'Orquestrar', children: [{ id: '1', title: 'Abrir' }, { id: '2', title: 'Avisar' }] }])
    await start($, ['1'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['1'])
    await start($, ['2'])
    t = 2000
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'faça' } as any)
    expect(JSON.stringify(await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any))).not.toContain('recebimento confirmado')
    // It took the message up at 3000 without ever being seen stopped.
    received = [{ from: ME, at: 3000 }]
    const r = JSON.stringify(await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any))
    expect(r).toContain('recebimento confirmado')
    expect(r).toContain('A/2')
    // The sending task closed by itself on the confirmation, with no done of this session.
    expect(line(await view($), 'Avisar')?.glyph).toBe('✓')
  })

  test('remetente parado: a releitura periódica confirma e fecha a tarefa do envio, sem turno dele', async ($, on) => {
    on('clock.now', () => ({ value: 1000 }) as any)
    // Each period waits for the gate; once open, one period passes (the poll runs) and the next ends it.
    let open: () => void = () => {}
    const gate = new Promise<void>(r => (open = r))
    let passed = false
    on('clock.every', async () => {
      if (passed) return { deny: 'fim' } as any
      await gate
      passed = true
      return { value: undefined } as any
    })
    on('mcp.call', (_$: any, e: any) =>
      JSON.stringify(e).includes('get_session')
        ? ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: ME }) }], isError: false } } as any)
        : ({
            value: {
              content: [{ type: 'text', text: JSON.stringify([
                { sessionId: 'local_pai', title: 'Pai', isRunning: false },
                { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: ME },
              ]) }],
              isError: false,
            },
          } as any),
    )
    on('env.get', () => ({ value: 'C:/home' }) as any)
    let received: { from: string; at: number }[] = []
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: [], received }) : '{}' }) as any)
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${KID}; that session is holding it.` }))
    await plan($, [{ id: 'S', title: 'Mandar à governança' }])
    await start($, ['S'])
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'commit' } as any)
    expect(line(await view($), 'Mandar à governança')?.glyph).toBe('✉')
    // The session ends its turn; the other one takes the message up later.
    received = [{ from: ME, at: 2000 }]
    open()
    for (let i = 0; i < 20 && line(await view($), 'Mandar à governança')?.glyph !== '✓'; i++) await new Promise(r => setTimeout(r, 10))
    expect(line(await view($), 'Mandar à governança')?.glyph).toBe('✓')
  })

  test('filha sem filhas mandando à mãe: confirma pelo received da mãe', async ($, on) => {
    const MAE = 'local_mae00000-0000-0000-0000-000000000000'
    on('clock.now', () => ({ value: 1000 }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    on('mcp.call', (_$: any, e: any) =>
      JSON.stringify(e).includes('get_session')
        ? ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: ME }) }], isError: false } } as any)
        : ({ value: { content: [{ type: 'text', text: JSON.stringify([{ sessionId: MAE, title: 'Mãe', isRunning: true }]) }], isError: false } } as any),
    )
    on('env.get', () => ({ value: 'C:/home' }) as any)
    let received: { from: string; at: number }[] = []
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('mae00000') ? JSON.stringify({ waiting: false, tasks: [], received }) : '{}' }) as any)
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${MAE}; that session is holding it.` }))
    await plan($, [{ id: 'R', title: 'Relatar à mãe' }])
    await $.tool.call({ tool: 'SendMessage', to: MAE, message: 'pronto' } as any)
    received = [{ from: ME, at: 1500 }]
    // The app's notice that a session ended its turn reads the list again.
    const r = JSON.stringify(await $.prompt.submit({ text: '<side-sessions-event>The session "Mãe" ended its turn.</side-sessions-event>', isMeta: true } as any))
    expect(r).toContain('recebimento confirmado')
  })

  test('com turnos, o anel fica só no cartão da sessão filha (nem no turno nem no nível 1)', async ($, on) => {
    on('prompt.submit', (_$: any, e: any) => e)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: true, isArchived: false, startedBy: ME },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('11111111') ? JSON.stringify({ waiting: false, tasks: [], context: { percent: 42, at: 1 } }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    await $.prompt.submit({ text: 'pedido', origin: { kind: 'composer' } } as any)
    await plan($, [{ id: 'A', title: 'Delegar' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const lines = rowsOf(await view($)).map(l => l.text)
    // Only on the card: not on the turn nor on the task it was opened on.
    expect(lines[0]).not.toContain('42%')
    expect(lines.find(l => l.includes('Delegar'))).not.toContain('42%')
    expect(lines.find(l => /^[│ ]*⑂ filha/.test(l))).toContain('42%')
  })
})

describe('anel de contexto abre a sessão', () => {
  test('no desktop, o anel do cartão é um botão que abre a sessão (open_session_in, focus)', async ($, on) => {
    const KID = 'local_99999999-9999-9999-9999-999999999999'
    const opened: any[] = []
    on('mcp.call', (_$: any, e: any) => {
      if (e.tool === 'open_session_in') {
        opened.push({ server: e.server, ...e.args })
        return { value: { content: [{ type: 'text', text: 'ok' }], isError: false } } as any
      }
      return {
        value: {
          content: [{ type: 'text', text: JSON.stringify([
            { sessionId: 'local_pai', title: 'Pai', isRunning: false },
            { sessionId: KID, name: 'filha', title: 'Filha', isRunning: true, isArchived: false, startedBy: 'local_eu' },
          ]) }],
          isError: false,
        },
      } as any
    })
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('99999999') ? JSON.stringify({ waiting: false, tasks: [], context: { percent: 42, at: 1 } }) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    await plan($, [{ id: 'A', title: 'Delegar' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'task-tree' })
    const src = JSON.stringify(await ui.drawn())
    expect(src).toContain(`open:${KID}`)
    await ui.press({ key: `open:${KID}` })
    await ui.unmount()
    expect(opened).toEqual([expect.objectContaining({ session_id: KID, target: 'focus' })])
    // On the card's line: the ring's Button only (the ⑂ folds a card with something below it).
    expect(src).not.toContain(`fold:|s:${KID}`)
  })
})

describe('cartão por mensagem na filha', () => {
  const KID = 'local_22222222-2222-2222-2222-222222222222'
  const task = (id: string, title: string, status: string, turn: number, started?: number) => ({ id, short: id, title, status, turn, ...(started ? { started } : {}), children: [] })
  // The session's panel: the opening message's turn (O, still in progress) and, once it took up
  // the message sent at 100, a turn of that message with N1 then N2 in plan order.
  const PANEL = (taken: boolean) => ({
    waiting: false,
    ...(taken ? { received: [{ from: 'local_eu', at: 150 }] } : {}),
    groups: [{
      agent: '',
      label: '',
      turns: [{ id: 1, title: 'abertura', at: 50 }, ...(taken ? [{ id: 2, title: 'mensagem', at: 150 }] : [])],
      tasks: [
        task('O', 'Velha em andamento', 'open', 1, 1),
        ...(taken ? [task('N1', 'Nova primeira', 'open', 2), task('N2', 'Nova segunda', 'open', 2)] : []),
      ],
    }],
    waits: [],
    children: [],
  })
  const setup = (on: any, taken: () => boolean) => {
    on('clock.now', () => ({ value: 100 }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'filha', title: 'Filha B', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('22222222') ? JSON.stringify(PANEL(taken())) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'queued' }))
  }
  const story = async ($: any) => {
    await plan($, [{ id: 'A', title: 'Abrir a filha' }, { id: 'B', title: 'Mandar mais' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['A'])
    await start($, ['B'])
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'mais isto' } as any)
  }

  test('não lida: carta azul na tarefa do envio e nenhum cartão novo', async ($, on) => {
    setup(on, () => false)
    await story($)
    const lines = await view($)
    expect(line(lines, 'Mandar mais')?.glyph).toBe('✉')
    const texts = rowsOf(lines).map(l => l.text)
    expect(texts.filter(t => /^[│ ]*⑂ filha/.test(t)).length).toBe(1)
    expect(texts.some(t => t.includes('Nova primeira'))).toBe(false)
  })

  test('lida: o grupo novo ganha cartão próprio sob a tarefa do envio, na ordem do plano; o antigo fica', async ($, on) => {
    let taken = false
    setup(on, () => taken)
    await story($)
    taken = true
    // The app's notice reads the sessions again.
    await $.prompt.submit({ text: '<side-sessions-event>filha</side-sessions-event>' } as any)
    const texts = rowsOf(await view($)).map(l => l.text)
    const cards = texts.map((t, i) => [t, i] as const).filter(([t]) => /^[│ ]*⑂ filha/.test(t))
    expect(cards.length).toBe(2)
    const at = (s: string) => texts.findIndex(t => t.includes(s))
    // The old card under A with its task in progress; the new one under B, N1 before N2.
    expect(at('Abrir a filha')).toBeLessThan(cards[0][1])
    expect(texts[cards[0][1] + 1]).toContain('Velha em andamento')
    expect(at('Mandar mais')).toBeLessThan(cards[1][1])
    expect(cards[1][1]).toBeLessThan(at('Nova primeira'))
    expect(at('Nova primeira')).toBeLessThan(at('Nova segunda'))
    expect(at('Velha em andamento')).toBeLessThan(at('Mandar mais'))
  })
})

describe('carta azul enquanto espera a entrega', () => {
  const KID = 'local_33333333-3333-3333-3333-333333333333'
  const setup = (on: any, result: string) => {
    on('clock.now', () => ({ value: 100 }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', () => ({ value: '{}' }) as any)
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result }))
  }
  const send = async ($: any) => {
    await plan($, [{ id: 'A', title: 'Avisar a filha' }, { id: 'B', title: 'Depois' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'faça' } as any)
  }

  test('na fila, mesmo dizendo quando "will be delivered": o ícone da tarefa do envio é a carta azul', async ($, on) => {
    setup(on, 'Message queued; it will be delivered when the session finishes its turn')
    await send($)
    expect(line(await view($), 'Avisar a filha')).toMatchObject({ glyph: '✉', color: 'permission' })
  })

  test('entregue na hora: ✉ também, até a sessão destino ser vista tratando; sem lembrete na volta', async ($, on) => {
    setup(on, 'Message delivered to session; its turn has started on it. (delivery: delivered)')
    await send($)
    expect(line(await view($), 'Avisar a filha')?.glyph).toBe('✉')
  })

  test('envio que falhou não fica com ✉', async ($, on) => {
    setup(on, '{"success":false,"message":"no such session"}')
    await send($)
    expect(line(await view($), 'Avisar a filha')?.glyph).toBe('◉')
  })
})

describe('tarefa de origem do envio', () => {
  const KID = 'local_44444444-4444-4444-4444-444444444444'
  test('planejada depois da em andamento e sem start: a mensagem sai dela (carta e cartão)', async ($, on) => {
    let t = 100
    on('clock.now', () => ({ value: t }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', () => ({ value: '{}' }) as any)
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'Message queued; it will be delivered later' }))
    await plan($, [{ id: 'A', title: 'Repassar à implementação' }])
    await start($, ['A'])
    t = 200
    await plan($, [{ id: 'B', title: 'Repassar o tooltip' }])
    t = 300
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'tooltip' } as any)
    const lines = await view($)
    expect(line(lines, 'Repassar o tooltip')?.glyph).toBe('✉')
    expect(line(lines, 'Repassar à implementação')?.glyph).toBe('◉')
  })

  test('planejadas juntas, a em andamento continua sendo a de origem', async ($, on) => {
    let t = 100
    on('clock.now', () => ({ value: t }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', () => ({ value: '{}' }) as any)
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'queued' }))
    await plan($, [{ id: 'A', title: 'Primeira' }, { id: 'B', title: 'Segunda' }])
    t = 200
    await start($, ['A'])
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'x' } as any)
    const lines = await view($)
    expect(line(lines, 'Primeira')?.glyph).toBe('✉')
    expect(line(lines, 'Segunda')?.glyph).toBe('○')
  })
})

describe('cartão da filha igual ao painel dela', () => {
  const A = 'local_55555555-5555-5555-5555-555555555555'
  const B = 'local_66666666-6666-6666-6666-666666666666'
  const task = (id: string, title: string, status: string, turn: number, started?: number) => ({ id, short: id, title, status, turn, ...(started ? { started } : {}), children: [] })
  // A (implementation) got a message from the main loop at 100 (sent from Y); B (docs) then got
  // one from A at 200, its new group planned in that turn.
  const PANELS: Record<string, any> = {
    [A]: {
      waiting: false,
      received: [{ from: 'local_eu', at: 120 }],
      groups: [{ agent: '', label: '', turns: [{ id: 1, title: 'abertura', at: 50 }, { id: 2, title: 'mensagem', at: 120 }],
        tasks: [task('A0', 'Impl antiga', 'done', 1), task('A1', 'Impl nova', 'done', 2)] }],
      waits: [], children: [],
    },
    [B]: {
      waiting: false,
      received: [{ from: A, at: 200 }],
      groups: [{ agent: '', label: '', turns: [{ id: 1, title: 'abertura', at: 50 }, { id: 2, title: 'da irmã', at: 200 }],
        tasks: [task('B0', 'Docs antiga', 'done', 1), task('B1', 'Docs nova', 'open', 2, 1), task('B2', 'Docs depois', 'open', 2)] }],
      waits: [], children: [],
    },
  }
  const setup = (on: any) => {
    let n = 0
    on('clock.now', () => ({ value: 100 }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: A, name: 'impl', title: 'Impl', isRunning: false, isArchived: false, startedBy: 'local_eu' },
          { sessionId: B, name: 'docs', title: 'Docs', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('fs.read', (_$: any, e: any) => {
      const id = Object.keys(PANELS).find(k => String(e.path).includes(k))
      return ({ value: id ? JSON.stringify(PANELS[id]) : '{}' }) as any
    })
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${n++ === 0 ? A : B}` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'Message delivered; its turn has started on it' }))
  }
  const story = async ($: any) => {
    await plan($, [{ id: 'X', title: 'Abrir as filhas' }, { id: 'Y', title: 'Pedir o ajuste' }])
    await start($, ['X'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'a' } as any)
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'b' } as any)
    await done($, ['X'])
    await start($, ['Y'])
    await $.tool.call({ tool: 'SendMessage', to: A, message: 'ajuste' } as any)
  }

  test('a mensagem de uma irmã abre cartão próprio, sob a tarefa do cartão da irmã que enviou', async ($, on) => {
    setup(on)
    await story($)
    const texts = rowsOf(await view($)).map(l => l.text)
    const at = (s: string) => texts.findIndex(t => t.includes(s))
    const docs = texts.map((t, i) => [t, i] as const).filter(([t]) => /^[│ ]*⑂ docs/.test(t))
    expect(docs.length).toBe(2)
    // The new group (B1, B2) under Y, after A's new card, in plan order; the old one under X.
    expect(at('Abrir as filhas')).toBeLessThan(at('Docs antiga'))
    expect(at('Docs antiga')).toBeLessThan(at('Pedir o ajuste'))
    expect(at('Pedir o ajuste')).toBeLessThan(docs[1][1])
    expect(docs[1][1]).toBeLessThan(at('Docs nova'))
    expect(at('Docs nova')).toBeLessThan(at('Docs depois'))
  })

  test('o cartão em andamento tem as mesmas tarefas, estados e contagem do painel da filha', async ($, on) => {
    setup(on)
    await story($)
    const lines = await view($)
    const texts = rowsOf(lines).map(l => l.text)
    const card = texts.filter(t => /^[│ ]*⑂ docs/.test(t))[1] ?? ''
    // The session's own pane has B1 in progress and B2 open in that group: 0/2.
    expect(card).not.toMatch(/\d+\/\d+/)
    expect(line(lines, 'Docs nova')?.glyph).toBe('◉')
    expect(line(lines, 'Docs depois')?.glyph).toBe('○')
  })

  test('as sessões voltam a ser lidas a cada 3 s, mesmo sem session.start (recarga do mod)', async ($, on) => {
    const periods: unknown[] = []
    on('clock.now', () => ({ value: 1 }) as any)
    on('clock.every', (_$: any, e: any) => {
      periods.push(e?.ms ?? e?.interval ?? e?.period ?? JSON.stringify(e))
      return { deny: 'sem relógio no teste' } as any
    })
    on('tool.call', { tool: 'Read' } as any, async () => ({ result: 'ok' }))
    await plan($, [{ id: 'A', title: 'Uma' }])
    await $.tool.call({ tool: 'Read', file_path: 'x' } as any)
    expect(periods.some(p => String(p).includes('3000'))).toBe(true)
  })
})

describe('cadeia de filhas sob a origem', () => {
  const A = 'local_77777777-7777-7777-7777-777777777777'
  const B = 'local_88888888-8888-8888-8888-888888888888'
  const C = 'local_99999999-9999-9999-9999-999999999999'
  const task = (id: string, title: string, status: string, turn: number) => ({ id, short: id, title, status, turn, children: [] })
  const main = (turns: [number, number][], tasks: any[]) => [{ agent: '', label: '', turns: turns.map(([id, at]) => ({ id, title: 't', at })), tasks }]
  // The main loop sends A a message from Y (100) and another from Z (300). A, still in the turn of
  // Y's message, passes it on to B (350, after Z's send); B passes it to C (500).
  const PANELS: Record<string, any> = {
    [A]: { waiting: false, received: [{ from: 'local_eu', at: 120 }, { from: 'local_eu', at: 400 }], waits: [], children: [],
      groups: main([[1, 50], [2, 120], [3, 400]], [task('A0', 'Impl abertura', 'done', 1), task('A1', 'Impl de Y', 'done', 2), task('A2', 'Impl de Z', 'open', 3)]) },
    [B]: { waiting: false, received: [{ from: A, at: 350 }], waits: [], children: [],
      groups: main([[1, 50], [2, 350]], [task('B0', 'Docs abertura', 'done', 1), task('B1', 'Docs da cadeia de Y', 'done', 2)]) },
    [C]: { waiting: false, received: [{ from: B, at: 500 }], waits: [], children: [],
      groups: main([[1, 50], [2, 500]], [task('C0', 'Gov abertura', 'done', 1), task('C1', 'Gov da cadeia de Y', 'done', 2)]) },
  }
  test('a mensagem repassada de irmã em irmã fica sob a tarefa de onde a cadeia partiu, não sob o envio mais recente', async ($, on) => {
    let t = 10
    let n = 0
    on('clock.now', () => ({ value: t }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: A, name: 'impl', title: 'Impl', isRunning: true, isArchived: false, startedBy: 'local_eu' },
          { sessionId: B, name: 'docs', title: 'Docs', isRunning: false, isArchived: false, startedBy: 'local_eu' },
          { sessionId: C, name: 'gov', title: 'Gov', isRunning: false, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('fs.read', (_$: any, e: any) => {
      const id = Object.keys(PANELS).find(k => String(e.path).includes(k))
      return ({ value: id ? JSON.stringify(PANELS[id]) : '{}' }) as any
    })
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${[A, B, C][n++]}` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'Message delivered; its turn has started on it' }))
    await plan($, [{ id: 'X', title: 'Abrir as filhas' }, { id: 'Y', title: 'Pedir Y' }, { id: 'Z', title: 'Pedir Z' }])
    await start($, ['X'])
    for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['X'])
    await start($, ['Y'])
    t = 100
    await $.tool.call({ tool: 'SendMessage', to: A, message: 'y' } as any)
    await done($, ['Y'])
    await start($, ['Z'])
    t = 300
    await $.tool.call({ tool: 'SendMessage', to: A, message: 'z' } as any)
    const texts = rowsOf(await view($)).map(l => l.text)
    const at = (s: string) => texts.findIndex(x => x.includes(s))
    // Docs and Gov of Y's chain: under Y, before Z.
    for (const s of ['Docs da cadeia de Y', 'Gov da cadeia de Y']) {
      expect(at(s)).toBeGreaterThan(at('Pedir Y'))
      expect(at(s)).toBeLessThan(at('Pedir Z'))
    }
    expect(at('Impl de Z')).toBeGreaterThan(at('Pedir Z'))
  })
})

describe('cadeias separadas e na ordem de execução (caso do print)', () => {
  const I = 'local_a1111111-1111-1111-1111-111111111111'
  const D = 'local_a2222222-2222-2222-2222-222222222222'
  const S = 'local_a3333333-3333-3333-3333-333333333333'
  const G = 'local_a4444444-4444-4444-4444-444444444444'
  const task = (id: string, title: string, turn: number) => ({ id, short: id, title, status: 'done', turn, children: [] })
  const panel = (received: any[], turns: [number, number][], tasks: any[]) => ({
    waiting: false, received, waits: [], children: [],
    groups: [{ agent: '', label: '', turns: turns.map(([id, at]) => ({ id, title: 't', at })), tasks }],
  })
  // Chain of 15 (sent at 100) and of 16 (sent at 300): implementation → docs → SVG → governance.
  // Docs got 15's message at 350, after 16's send to the implementation.
  const PANELS: Record<string, any> = {
    [I]: panel([], [[1, 50], [2, 120], [3, 400]], [task('I0', 'Impl abertura', 1), task('I1', 'Impl 15', 2), task('I2', 'Impl 16', 3)]),
    [D]: panel([{ from: I, at: 350 }, { from: I, at: 450 }], [[1, 50], [2, 350], [3, 450]], [task('D0', 'Docs abertura', 1), task('D1', 'Docs 15', 2), task('D2', 'Docs 16', 3)]),
    [S]: panel([{ from: D, at: 360 }, { from: D, at: 460 }], [[1, 50], [2, 360], [3, 460]], [task('S0', 'SVG abertura', 1), task('S1', 'SVG 15', 2), task('S2', 'SVG 16', 3)]),
    [G]: panel([{ from: S, at: 370 }, { from: S, at: 470 }], [[1, 50], [2, 370], [3, 470]], [task('G0', 'Gov abertura', 1), task('G1', 'Gov 15', 2), task('G2', 'Gov 16', 3)]),
  }
  test('a cadeia da 15 fica sob a 15, a da 16 sob a 16, cada uma na ordem impl → docs → SVG → governança', async ($, on) => {
    let t = 10
    let n = 0
    on('clock.now', () => ({ value: t }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    // The host lists them in another order (governance before SVG and docs).
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          ...[[I, 'impl'], [G, 'gov'], [S, 'svg'], [D, 'docs']].map(([id, name]) => ({ sessionId: id, name, title: name, isRunning: false, isArchived: false, startedBy: 'local_eu' })),
        ]) }],
        isError: false,
      },
    }) as any)
    on('fs.read', (_$: any, e: any) => {
      const id = Object.keys(PANELS).find(k => String(e.path).includes(k))
      return ({ value: id ? JSON.stringify(PANELS[id]) : '{}' }) as any
    })
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${[I, D, S, G][n++]}` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'Message delivered; its turn has started on it' }))
    await plan($, [{ id: 'X', title: 'Abrir' }, { id: 'Y', title: 'Repassar 15' }, { id: 'Z', title: 'Repassar 16' }])
    await start($, ['X'])
    for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['X'])
    await start($, ['Y'])
    t = 100
    await $.tool.call({ tool: 'SendMessage', to: I, message: '15' } as any)
    await done($, ['Y'])
    await start($, ['Z'])
    t = 300
    await $.tool.call({ tool: 'SendMessage', to: I, message: '16' } as any)
    const texts = rowsOf(await view($)).map(l => l.text)
    const at = (s: string) => texts.findIndex(x => x.includes(s))
    const chain = (k: string) => ['Impl', 'Docs', 'SVG', 'Gov'].map(w => at(`${w} ${k}`))
    const c15 = chain('15')
    const c16 = chain('16')
    expect(c15.every(i => i > at('Repassar 15') && i < at('Repassar 16'))).toBe(true)
    expect(c16.every(i => i > at('Repassar 16'))).toBe(true)
    expect([...c15].sort((a, b) => a - b)).toEqual(c15)
    expect([...c16].sort((a, b) => a - b)).toEqual(c16)
  })

  // The store as the first test leaves it, read by the second one: a reload of the mod empties the
  // state, so the second test (a fresh module) starts from nothing but this store.
  const store: Record<string, unknown> = {}
  const host = (on: any) => {
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('clock.every', () => ({ deny: 'sem relógio no teste' }) as any)
    on('session.id', () => ({ value: 'local_eu' }) as any)
    on('command.register', () => ({ value: {} }) as any)
    on('tool.register', () => ({ value: {} }) as any)
    on('ui.open', () => ({ value: {} }) as any)
    on('store.set', (_$: any, e: any) => {
      store[e.key] = JSON.parse(JSON.stringify(e.value))
      return { value: undefined } as any
    })
    on('store.get', (_$: any, e: any) => ({ value: store[e.key] }) as any)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          ...[[I, 'impl'], [G, 'gov'], [S, 'svg'], [D, 'docs']].map(([id, name]) => ({ sessionId: id, name, title: name, isRunning: false, isArchived: false, startedBy: 'local_eu' })),
        ]) }],
        isError: false,
      },
    }) as any)
    on('fs.read', (_$: any, e: any) => {
      const id = Object.keys(PANELS).find(k => String(e.path).includes(k))
      return ({ value: id ? JSON.stringify(PANELS[id]) : '{}' }) as any
    })
  }
  test('recarga do mod, antes: as rodadas e âncoras das sessões vão para o store', async ($, on) => {
    let t = 10
    let n = 0
    host(on)
    on('clock.now', () => ({ value: t }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${[I, D, S, G][n++]}` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'Message delivered; its turn has started on it' }))
    await plan($, [{ id: 'X', title: 'Abrir' }, { id: 'Y', title: 'Repassar 15' }, { id: 'Z', title: 'Repassar 16' }])
    await start($, ['X'])
    for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['X'])
    await start($, ['Y'])
    t = 100
    await $.tool.call({ tool: 'SendMessage', to: I, message: '15' } as any)
    await done($, ['Y'])
    await start($, ['Z'])
    t = 300
    await $.tool.call({ tool: 'SendMessage', to: I, message: '16' } as any)
    const links = store['links:local_eu'] as any
    expect(links.children.find((c: any) => c.id === I).rounds.map((r: any) => r.anchor)).toEqual(['Y', 'Z'])
  })

  test('recarga do mod, depois: módulo novo, só com o store; cada cadeia continua sob a tarefa de origem', async ($, on) => {
    on('clock.now', () => ({ value: 500 }) as any)
    on('session.start', () => ({ cwd: '.' }) as any)
    host(on)
    await $.session.start({ cwd: '.' } as any)
    // The host's list of sessions is read in the background at the start.
    await new Promise(r => setTimeout(r, 50))
    const texts = rowsOf(await view($)).map(l => l.text)
    const at = (s: string) => texts.findIndex(x => x.includes(s))
    for (const w of ['Impl', 'Docs', 'SVG', 'Gov']) {
      expect(at(`${w} 15`)).toBeGreaterThan(at('Repassar 15'))
      expect(at(`${w} 15`)).toBeLessThan(at('Repassar 16'))
      expect(at(`${w} 16`)).toBeGreaterThan(at('Repassar 16'))
    }
  })
})

describe('tooltip e ícone que recolhe, juntos', () => {
  test('toda linha cortada tem, por cima do nome, a camada com o nome inteiro, acima do botão da linha', async $ => {
    const long = (w: string) => `${w} com um nome comprido demais para caber na largura estreita do painel lateral`
    await plan($, [{ id: 'A', title: long('Pai'), children: [{ id: '1', title: long('Filho'), children: [{ id: 'x', title: long('Neto') }] }, { id: '2', title: long('Folha') }] }])
    await start($, ['A/1/x'])
    const props = { ...PANE_PROPS, bodyColumns: 30 }
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props, requestId: 'task-tree' })
    const root: any = await ui.drawn()
    await ui.unmount()
    // Each Box that holds a line's drawing (the Svg with the alt): when the name is cut, an absolute
    // Box in it holds an interactive Svg whose title is the whole name; no Button in that Box.
    const holders: any[] = []
    const walk = (el: any) => {
      if (!el || typeof el !== 'object') return
      const kids = (el.children ?? []).filter((c: any) => c && typeof c === 'object')
      if (el.type === 'Box' && kids.some((c: any) => c.type === 'Svg' && String(c.props.alt) !== '' && !c.props.isInteractive)) holders.push(el)
      kids.forEach(walk)
    }
    walk(root)
    const cut = holders.filter(h => (h.children ?? []).some((c: any) => c?.type === 'Svg' && String(c.props.source).includes('…') && String(c.props.alt).includes('nome comprido') && !String(c.props.alt).includes('Visão:')))
    // The four lines (the header, with its view buttons, aside).
    expect(cut.length).toBe(4)
    for (const h of cut) {
      const svg = h.children.find((c: any) => c?.type === 'Svg' && !c.props.isInteractive)
      const whole = /: (.*? painel lateral)/.exec(String(svg.props.alt))?.[1]
      const layer = h.children.find((c: any) => c?.type === 'Box' && c.props.position === 'absolute' && (c.children ?? []).some((k: any) => k?.type === 'Svg'))
      const top = layer?.children?.find((c: any) => c?.type === 'Svg')
      expect(top?.props.isInteractive).toBe(true)
      expect(String(top?.props.source)).toContain(`<title>${whole}</title>`)
      // The layer is invisible (a transparent rect) and starts after the Button: no overlap.
      expect(String(top?.props.source)).toContain('fill="transparent"')
      expect(String(top?.props.source)).not.toMatch(/fill="(?!transparent|none)[^"]*"/)
      // Over the line's Button (drawn after it), from where the name starts: the name shows the
      // tooltip, the rest of the line folds it.
      const over = h.children.findIndex((c: any) => c?.type === 'Box' && (c.children ?? []).some((b: any) => b?.type === 'Button'))
      if (over >= 0) expect(h.children.indexOf(layer)).toBeGreaterThan(over)
      expect(layer.props.left).toBeGreaterThan(0)
      // The icon is still drawn, in its color.
      expect(String(svg.props.source)).toMatch(/class="(am|gr|gy)"/)
    }
  })
})

describe('✉ no cartão espelhado da filha', () => {
  const KID = 'local_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  test('a tarefa de envio da filha, com mensagem ainda não tratada pela irmã, mostra ✉ no cartão', async ($, on) => {
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'impl', title: 'Impl', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    const panel = {
      waiting: false,
      groups: [{ agent: '', label: '', tasks: [
        { id: 'A', short: 'A', title: 'Implementar', status: 'done', children: [] },
        { id: 'B', short: 'B', title: 'Avisar a documentação', status: 'open', started: 1, children: [] },
      ] }],
      waits: [], children: [],
      sends: [{ to: 'local_docs', anchor: 'B', at: 1, delivered: true }],
    }
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('bbbbbbbb') ? JSON.stringify(panel) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID}` }))
    await plan($, [{ id: 'X', title: 'Delegar' }])
    await start($, ['X'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const lines = await view($)
    expect(line(lines, 'Avisar a documentação')?.glyph).toBe('✉')
    expect(line(lines, 'Implementar')?.glyph).toBe('✓')
  })
})

describe('cartão de mensagem de irmã já no lugar certo', () => {
  const I = 'local_c1111111-1111-1111-1111-111111111111'
  const S = 'local_c2222222-2222-2222-2222-222222222222'
  const G = 'local_c3333333-3333-3333-3333-333333333333'
  const task = (id: string, title: string, status: string, turn: number) => ({ id, short: id, title, status, turn, children: [] })
  const panel = (received: any[], turns: [number, number][], tasks: any[], sends: any[] = []) => ({
    waiting: false, received, sends, waits: [], children: [],
    groups: [{ agent: '', label: '', turns: turns.map(([id, at]) => ({ id, title: 't', at })), tasks }],
  })
  const setup = (on: any, panels: () => Record<string, any>, t: () => number) => {
    let n = 0
    on('clock.now', () => ({ value: t() }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          ...[[I, 'impl'], [S, 'svg'], [G, 'gov']].map(([id, name]) => ({ sessionId: id, name, title: name, isRunning: true, isArchived: false, startedBy: 'local_eu' })),
        ]) }],
        isError: false,
      },
    }) as any)
    on('fs.read', (_$: any, e: any) => {
      const id = Object.keys(panels()).find(k => String(e.path).includes(k))
      return ({ value: id ? JSON.stringify(panels()[id]) : '{}' }) as any
    })
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${[I, S, G][n++]}` }))
    on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: 'Message delivered; its turn has started on it' }))
  }
  const story = async ($: any, setT: (v: number) => void) => {
    await plan($, [{ id: 'X', title: 'Abrir' }, { id: 'Y', title: 'Repassar o ajuste' }, { id: 'Z', title: 'Outra coisa' }])
    await start($, ['X'])
    for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['X'])
    await start($, ['Y'])
    setT(100)
    await $.tool.call({ tool: 'SendMessage', to: I, message: 'ajuste' } as any)
  }

  test('primeiro desenho: a irmã ainda com ✉ para a governança; o cartão novo já nasce sob a origem', async ($, on) => {
    let t = 10
    // Impl got Y's message (120) and passed it to SVG; SVG, in its turn of it (200), sent to
    // governance, its ✉ still up (S1); governance took it (300) and planned. SVG's turn list ends
    // there: nothing else to go by but the ✉.
    const panels = {
      [I]: panel([], [[1, 50], [2, 120]], [task('I0', 'Impl abertura', 'done', 1), task('I1', 'Impl do ajuste', 'done', 2)]),
      [S]: panel([{ from: I, at: 200 }], [[1, 50], [2, 200]], [task('S0', 'SVG abertura', 'done', 1), task('S1', 'Avisar a governança', 'open', 2)], [{ to: G, anchor: 'S1', at: 250, delivered: true }]),
      [G]: panel([{ from: S, at: 300 }], [[1, 50], [2, 300]], [task('G0', 'Gov abertura', 'done', 1), task('G1', 'Commit do ajuste', 'open', 2)]),
    }
    setup(on, () => panels, () => t)
    await story($, v => (t = v))
    t = 320
    const texts = rowsOf(await view($)).map(l => l.text)
    const at = (s: string) => texts.findIndex(x => x.includes(s))
    expect(at('Commit do ajuste')).toBeGreaterThan(at('Repassar o ajuste'))
    expect(at('Commit do ajuste')).toBeLessThan(at('Outra coisa'))
  })

  test('origem ainda desconhecida: o cartão espera (não vai à raiz) e aparece depois do prazo', async ($, on) => {
    let t = 10
    // Governance got a message from SVG, but SVG's state has no turn or ✉ before it yet.
    const panels = {
      [I]: panel([], [[1, 50]], [task('I0', 'Impl abertura', 'done', 1)]),
      [S]: panel([], [], []),
      [G]: panel([{ from: S, at: 300 }], [[1, 50], [2, 300]], [task('G0', 'Gov abertura', 'done', 1), task('G1', 'Commit sem origem', 'open', 2)]),
    }
    setup(on, () => panels, () => t)
    await story($, v => (t = v))
    t = 320
    expect(rowsOf(await view($)).some(l => l.text.includes('Commit sem origem'))).toBe(false)
    t = 300 + 10_001
    expect(rowsOf(await view($)).some(l => l.text.includes('Commit sem origem'))).toBe(true)
  })
})

describe('id curto contra nível 1 antigo', () => {
  test('"1" vai à etapa aberta "31/1", não ao nível 1 "1" já concluído de um plano anterior', async $ => {
    await plan($, [{ id: '1', title: 'Antigo' }])
    await done($, ['1'])
    await plan($, [{ id: '31', title: 'Novo', children: [{ id: '1', title: 'Ler' }, { id: '2', title: 'Fazer' }] }])
    expect(text(await start($, ['1']))).toContain('Em andamento: Ler')
    expect(text(await done($, ['1']))).toContain('Concluídas')
    expect(text(await start($, ['2']))).toContain('Em andamento: Fazer')
  })
})

describe('etapas fechadas em lote', () => {
  test('done de várias etapas nunca iniciadas avisa para marcar uma de cada vez', async $ => {
    await plan($, [{ id: 'A', title: 'Grupo', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }])
    const r = text(await done($, ['1', '2', '3']))
    expect(r).toContain('3 etapas fecharam juntas sem start')
    expect(r).toContain('uma de cada vez')
  })

  test('etapas marcadas com start, ou uma só, não geram o aviso', async $ => {
    await plan($, [{ id: 'A', title: 'Grupo', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
    await start($, ['1'])
    expect(text(await done($, ['1']))).not.toContain('fecharam juntas')
    await start($, ['2'])
    expect(text(await done($, ['2']))).not.toContain('fecharam juntas')
  })
})

describe('resposta da sessão no cartão', () => {
  const publish = (on: any, written: Record<string, string>) => {
    on('mcp.call', (_$: any, e: any) =>
      e.tool === 'get_session'
        ? ({ value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu' }) }], isError: false } } as any)
        : ({ value: { content: [{ type: 'text', text: '[]' }], isError: false } } as any))
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('clock.now', () => ({ value: 1 }) as any)
    on('fs.write', (_$: any, e: any) => {
      written[e.path.split(String.fromCharCode(92)).join('/')] = e.text
      return { value: undefined } as any
    })
    on('prompt.submit', (_$: any, e: any) => e)
    on('turn.complete', () => ({ text: '' }) as any)
    on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
  }
  const turnsOf = (written: Record<string, string>) =>
    JSON.parse(written['C:/home/.claude/task-tree-waits/local_eu.json'] ?? '{}').groups?.find((g: any) => g.agent === '')?.turns ?? []

  test('ao fim do turno, a sessão guarda no turno o recap do wrap_up (senão a mensagem final) e publica', async ($, on) => {
    const written: Record<string, string> = {}
    publish(on, written)
    await $.prompt.submit({ text: 'primeiro pedido' } as any)
    await plan($, [{ id: 'A', title: 'Fazer A' }])
    await done($, ['A'])
    // Still in the turn: no reply yet.
    expect(turnsOf(written)[0]?.reply).toBeUndefined()
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'Commit abc123 enviado; PR #5 atualizado.' } as any)
    await $.turn.complete({ reason: 'answer', answer: 'mensagem final longa', durationMs: 1, isAborted: false, turnId: 't1' } as any)
    expect(turnsOf(written)[0]?.reply).toBe('Commit abc123 enviado; PR #5 atualizado.')
    // A turn with no wrap_up: its final message.
    await $.prompt.submit({ text: 'segundo pedido' } as any)
    await plan($, [{ id: 'B', title: 'Fazer B' }])
    await done($, ['B'])
    await $.turn.complete({ reason: 'answer', answer: 'SVG sem\nmudança.', durationMs: 1, isAborted: false, turnId: 't2' } as any)
    const turns = turnsOf(written)
    expect(turns[0]?.reply).toBe('Commit abc123 enviado; PR #5 atualizado.')
    expect(turns[1]?.reply).toBe('SVG sem\nmudança.'.replace(/\s+/g, ' '))
  })

  test('o cartão mostra a resposta de cada turno sob as tarefas dele, com ↩, sem contar no X/Y', async ($, on) => {
    const KID = 'local_dddddddd-dddd-dddd-dddd-dddddddddddd'
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'svg', title: 'SVG', isRunning: false, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    const panel = {
      waiting: false, waits: [], children: [],
      groups: [{ agent: '', label: '', turns: [{ id: 1, title: 't', at: 1, reply: 'O SVG não precisou mudar; avisei a governança.', brief: 'O SVG não precisou mudar; avisei a governança.' }],
        tasks: [{ id: 'S', short: 'S', title: 'Conferir o SVG', status: 'done', turn: 1, children: [] }] }],
    }
    on('fs.read', (_$: any, e: any) => ({ value: String(e.path).includes('dddddddd') ? JSON.stringify(panel) : '{}' }) as any)
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID}` }))
    await plan($, [{ id: 'X', title: 'Delegar' }])
    await start($, ['X'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    const lines = await view($)
    const texts = rowsOf(lines).map(l => l.text)
    const at = (s: string) => texts.findIndex(t => t.includes(s))
    expect(line(lines, 'O SVG não precisou mudar; avisei a governança.')).toMatchObject({ glyph: '↩', color: 'inactive' })
    expect(at('O SVG não precisou')).toBeGreaterThan(at('Conferir o SVG'))
    // Not a task: the count stays 1/2 (X and S).
    expect(lines[0].text).toContain('1 de 2')
    // Desktop: its own line, with the full text in the alt and no count or time.
    const reply = (await desktop($)).find(s => s.alt.startsWith('Resposta: O SVG'))
    expect(reply?.source).not.toMatch(/>\d+\/\d+</)
  })

  test('no próprio painel, a resposta fecha o grupo da mensagem, depois de todos os níveis 1 dela', async ($, on) => {
    publish(on, {})
    await $.prompt.submit({ text: 'falta commitar?' } as any)
    await plan($, [{ id: 'A', title: 'Conferir commits', children: [{ id: 'a', title: 'Ver git status' }] }, { id: 'B', title: 'Sem filhas' }])
    await call($, 'done', { ids: ['A', 'B'], summary: 'Nada a commitar.' })
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'Nada a commitar.' } as any)
    await $.turn.complete({ reason: 'answer', answer: 'x', durationMs: 1, isAborted: false, turnId: 't1' } as any)
    await $.prompt.submit({ text: 'outro' } as any)
    await plan($, [{ id: 'C', title: 'Outra coisa' }])
    const lines = await view($)
    const texts = rowsOf(lines).map(l => l.text)
    const at = (s: string) => texts.findIndex(t => t.includes(s))
    expect(line(lines, 'Nada a commitar.')).toMatchObject({ glyph: '↩', color: 'inactive' })
    expect(texts.filter(t => t.includes('Nada a commitar.'))).toHaveLength(1)
    expect(at('Nada a commitar.')).toBeGreaterThan(at('Sem filhas'))
    expect(at('Nada a commitar.')).toBeLessThan(at('Outra coisa'))
    // Not a task: no count, no time on its line.
    expect(texts[at('Nada a commitar.')]).not.toMatch(/\d+\/\d+|\d:\d\d/)
  })

  test('↩ mostra o summary do done (até 120, cortado em palavra); sem summary, só "resposta", nunca a resposta cortada', async ($, on) => {
    const written: Record<string, string> = {}
    publish(on, written)
    const full = 'Você está certo, voltou. Os cartões da governança e do SVG são da cadeia da tarefa 44 e caíram na raiz.'
    await $.prompt.submit({ text: 'um' } as any)
    await plan($, [{ id: 'A', title: 'Fazer A' }])
    await call($, 'done', { ids: ['A'], summary: 'Cartões na raiz: causa na recarga; correção enviada' })
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: full } as any)
    await $.turn.complete({ reason: 'answer', answer: 'x', durationMs: 1, isAborted: false, turnId: 't1' } as any)
    // No summary: the done and the wrap_up ask for it; the line says only "resposta".
    await $.prompt.submit({ text: 'dois' } as any)
    await plan($, [{ id: 'B', title: 'Fazer B' }])
    expect(text(await done($, ['B']))).toContain('falta o summary')
    const w = await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'Primeira frase longa da segunda resposta. Segunda frase.' } as any)
    expect(JSON.stringify(w)).toContain('falta o resumo do turno')
    await $.turn.complete({ reason: 'answer', answer: 'x', durationMs: 1, isAborted: false, turnId: 't2' } as any)
    // A summary alone (no ids), too long: cut at a word with "…".
    await $.prompt.submit({ text: 'tres' } as any)
    await plan($, [{ id: 'C', title: 'Fazer C' }])
    await done($, ['C'])
    await call($, 'done', { summary: 'Um resumo comprido demais que passa muito dos cento e vinte caracteres permitidos para a linha de resposta do painel lateral de tarefas' })
    await $.turn.complete({ reason: 'answer', answer: 'resposta três', durationMs: 1, isAborted: false, turnId: 't3' } as any)
    const turns = turnsOf(written)
    expect(turns[0]).toMatchObject({ reply: full, brief: 'Cartões na raiz: causa na recarga; correção enviada' })
    expect(turns[1]?.brief).toBeUndefined()
    expect(turns[2]?.brief).toBe('Um resumo comprido demais que passa muito dos cento e vinte caracteres permitidos para a linha de resposta do painel…')
    const texts = rowsOf(await view($)).map(l => l.text)
    expect(texts.some(t => t.includes('Cartões na raiz: causa na recarga; correção enviada'))).toBe(true)
    expect(texts.some(t => t.includes('Você está certo'))).toBe(false)
    expect(texts.some(t => t.includes('Primeira frase'))).toBe(false)
    expect(line(await view($), 'resposta')).toMatchObject({ glyph: '↩' })
    // Desktop: the tooltip carries the whole answer.
    const props = { ...PANE_PROPS, bodyColumns: 120 }
    const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'desktop', component: 'Pane', props, requestId: 'task-tree' })
    const src = JSON.stringify(await ui.drawn())
    await ui.unmount()
    expect(src).toContain('<title>Você está certo, voltou.')
    expect(src).toContain('<title>Primeira frase longa da segunda resposta.')
  })

  test('grupo com cartão de sessão filha não mostra o ↩ da própria sessão', async ($, on) => {
    const KID = 'local_eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    on('mcp.call', () => ({
      value: {
        content: [{ type: 'text', text: JSON.stringify([
          { sessionId: 'local_pai', title: 'Pai', isRunning: false },
          { sessionId: KID, name: 'impl', title: 'Impl', isRunning: true, isArchived: false, startedBy: 'local_eu' },
        ]) }],
        isError: false,
      },
    }) as any)
    on('env.get', () => ({ value: 'C:/home' }) as any)
    on('fs.read', () => ({ value: '{}' }) as any)
    on('prompt.submit', (_$: any, e: any) => e)
    on('turn.complete', () => ({ text: '' }) as any)
    on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
    on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID}` }))
    await $.prompt.submit({ text: 'delegar' } as any)
    await plan($, [{ id: 'A', title: 'Abrir a filha' }])
    await start($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
    await done($, ['A'])
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'Filha aberta.' } as any)
    await $.turn.complete({ reason: 'answer', answer: 'x', durationMs: 1, isAborted: false, turnId: 't1' } as any)
    const texts = rowsOf(await view($)).map(l => l.text)
    expect(texts.some(t => t.includes('Abrir a filha'))).toBe(true)
    expect(texts.some(t => t.includes('⑂ impl'))).toBe(true)
    expect(texts.some(t => t.includes('Filha aberta.'))).toBe(false)
  })
})
