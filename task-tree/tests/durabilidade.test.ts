import { describe, expect, test } from 'claude-code/testing'
import { STATE_KEYS, STORES, TABLE, restoredAt, rowOf } from '../state/durability'

// A tabela de durabilidade (state/durability.ts) posta à prova, linha a linha. Para cada chave do
// `$.state`, quatro testes em sequência: (A) plantar um valor pela API natural do mod e guardar o
// que o state e o store ficaram; (B) reinício do processo com session.start (módulo novo, state
// vazio, o store de A): volta só o que a tabela diz que vive no store; (C) reinício sem
// session.start (respawn do hooks worker): volta na primeira gravação só o que a tabela marca como
// `first-use`/`first-save`; (D) recarga a quente (módulo novo, state de A semeado, store vazio): o
// state continua lá e a primeira gravação grava o painel inteiro no store. Por fim, toda chave do
// state e todo prefixo do store que o módulo toca precisam de linha na tabela, e toda linha de
// state precisa ser tocada: uma chave nova sem linha falha aqui.

const KID = 'local_11111111-1111-1111-1111-111111111111'
const call = ($: any, tool: string, args: object) => $.tool.call({ tool: `mcp__task-tree__${tool}`, ...args })
const PROPS = { title: 'Tarefas', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { top: 0, bodyRows: 40 }, view: {} } as any
async function draw($: any): Promise<void> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  await ui.drawn()
  await ui.unmount()
}
async function press($: any, key: string): Promise<void> {
  const ui = await $.ui.mount({ plugin: 'task-tree', surface: 'terminal', component: 'Pane', props: PROPS, requestId: 'task-tree' })
  await ui.press({ key })
  await ui.unmount()
}
const has = (value: unknown, marker: string) => JSON.stringify(value ?? null).includes(marker)

type Host = { store: Record<string, unknown>; running: boolean; listFails: boolean; touchedState: Set<string>; touchedStore: Set<string> }
// `state`: the host's `$.state` as the test holds it, beneath the kit's own. A hot reload keeps it:
// the hooks mirror every write into it and answer a read the kit has nothing for with what it holds
// (until the module writes that key), so a test can hand the next one (a new module) the state the
// last one built (see reinicio.test.ts). Every key read or written is recorded (touchedState).
function host(on: any, store: Record<string, unknown>, state: Record<string, unknown> = {}): Host {
  const h: Host = { store, running: true, listFails: false, touchedState: new Set(), touchedStore: new Set() }
  const written = new Set<string>()
  on('state.get', async (_$: any, e: any, next: any) => {
    h.touchedState.add(e.key)
    const r = await next(e)
    if (r?.value?.value === undefined && !written.has(e.key) && state[e.key] !== undefined) return { value: { ...r.value, value: state[e.key] } }
    return r
  })
  on('state.set', async (_$: any, e: any, next: any) => {
    h.touchedState.add(e.key)
    written.add(e.key)
    const r = await next(e)
    state[e.key] = e.value === undefined ? undefined : JSON.parse(JSON.stringify(e.value))
    return r
  })
  let t = 1_000_000
  on('clock.now', () => ({ value: (t += 1000) }) as any)
  on('clock.every', () => ({ deny: 'sem relógio' }) as any)
  on('env.get', () => ({ value: 'C:/home' }) as any)
  on('session.id', () => ({ value: 'uuid-eu' }) as any)
  on('session.start', () => ({ cwd: '.' }) as any)
  on('classic.SessionStart', () => ({}) as any)
  on('command.register', () => ({ value: {} }) as any)
  on('tool.register', () => ({ value: {} }) as any)
  on('tool.list', () => ({ value: [{ name: 'Read', description: '' }, { name: 'mcp__ccd_turn__update_plan', description: '' }] }) as any)
  on('ui.open', () => ({ value: { isPlaced: true } }) as any)
  on('ui.panes', () => ({ value: [{ id: 'task-tree', isPlaced: true, isShown: true }] }) as any)
  on('ui.log', () => ({ value: undefined }) as any)
  on('ui.status', () => ({ value: undefined }) as any)
  on('ui.toast', () => ({ value: undefined }) as any)
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }) as any)
  on('fs.write', () => ({ value: undefined }) as any)
  on('fs.read', () => ({ value: '{}' }) as any)
  on('store.set', (_$: any, e: any) => {
    h.touchedStore.add(String(e.key).split(':')[0])
    h.store[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined } as any
  })
  on('store.get', (_$: any, e: any) => {
    h.touchedStore.add(String(e.key).split(':')[0])
    return { value: h.store[e.key] } as any
  })
  on('store.delete', (_$: any, e: any) => {
    h.touchedStore.add(String(e.key).split(':')[0])
    delete h.store[e.key]
    return { value: undefined } as any
  })
  on('mcp.call', (_$: any, e: any) => {
    if (e.tool === 'get_session') return { value: { content: [{ type: 'text', text: JSON.stringify({ sessionId: 'local_eu', model: 'claude-opus-5-5', effort: 'high' }) }], isError: false } } as any
    if (e.tool === 'list_sessions') {
      if (h.listFails) return { value: { content: [{ type: 'text', text: 'boom' }], isError: true } } as any
      const rows = [{ sessionId: 'local_pai', title: 'Pai', isRunning: false }, { sessionId: KID, name: 'filha', title: 'Filha A', isRunning: h.running, isArchived: false, startedBy: 'local_eu' }]
      return { value: { content: [{ type: 'text', text: JSON.stringify(rows) }], isError: false } } as any
    }
    return { value: { content: [{ type: 'text', text: '{}' }], isError: false } } as any
  })
  on('tool.call', { tool: 'mcp__ccd_session__start_session' } as any, async () => ({ result: `Started session ${KID} (filha)` }))
  on('tool.call', { tool: 'SendMessage' } as any, async () => ({ result: `Message queued for ${KID}; it is busy.` }))
  on('tool.call', { tool: 'Agent' } as any, async () => ({ result: 'ok' }))
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' } as any, async () => ({ result: 'ok' }))
  on('tool.call', { tool: 'AskUserQuestion' } as any, async () => ({ result: 'ok' }))
  on('tool.call', { tool: 'Read' } as any, async () => ({ result: 'ok' }))
  return h
}
const refresh = ($: any) => $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 'x' } as any)
const startUp = async ($: any) => {
  await $.session.start({ cwd: '.' } as any)
  await new Promise(r => setTimeout(r, 150))
}

// How each key gets a value, by the mod's own API, and the mark that value leaves in its JSON.
// `seeded`: no API of the mod sets it from a test (turn.step is a generator hook; ended is consumed
// by the same call that sets it): the value is seeded as the state would hold it.
type Plant = { marker: string; seeded?: unknown; plant: ($: any, h: Host) => Promise<void> }
const PLANTS: Record<string, Plant> = {
  groups: { marker: '"Planta"', plant: async $ => void (await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta', children: [{ id: '1', title: 'Passo' }] }] })) },
  tasks: { marker: '"Legado"', seeded: [{ id: 'L', title: 'Legado', done: false, children: [] }], plant: async () => {} },
  view: { marker: '"full"', plant: async $ => press($, 'view:full') },
  work: { marker: '"A"', plant: async $ => void (await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta' }] })) },
  children: {
    marker: `"anchor":"A"`,
    plant: async $ => {
      await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta' }] })
      await call($, 'start', { ids: ['A'] })
      await refresh($)
    },
  },
  sends: {
    marker: `"to":"${KID}"`,
    plant: async $ => {
      await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta' }] })
      await call($, 'start', { ids: ['A'] })
      await $.tool.call({ tool: 'SendMessage', to: KID, message: 'm' } as any)
    },
  },
  received: { marker: '"from":"local_x"', plant: async $ => void (await $.prompt.submit({ text: '<cross-session-message from="local_x" name="Principal">oi</cross-session-message>', isMeta: true } as any)) },
  // An Agent call writes the launch to the state alone: it reaches the store with the next save of the
  // links (any publication; here a plan).
  launches: {
    marker: '"description":"ler"',
    plant: async $ => {
      await $.tool.call({ tool: 'Agent', description: 'ler', prompt: 'x' } as any)
      await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta' }] })
    },
  },
  waits: {
    marker: '"kind":"choice"',
    plant: async $ => {
      await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta' }] })
      await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: 'Qual?' } as any)
    },
  },
  engine: { marker: 'Opus', seeded: 'Opus 5.5 · high', plant: async () => {} },
  ended: { marker: KID, seeded: [KID], plant: async () => {} },
  childrenError: {
    marker: 'boom',
    plant: async ($, h) => {
      h.listFails = true
      await refresh($)
      h.listFails = false
    },
  },
  brief: { marker: 'Resumo X', plant: async $ => void (await call($, 'done', { summary: 'Resumo X' })) },
  collapsed: {
    marker: '"|t:A"',
    plant: async $ => {
      await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta', children: [{ id: '1', title: 'Passo' }] }] })
      await press($, 'fold:|t:A')
    },
  },
}

// What A left, per key: the state (as the host would keep it through a reload) and the store.
const LEFT: Record<string, { state: Record<string, unknown>; store: Record<string, unknown> }> = {}

describe('tabela de durabilidade', () => {
  test('cada linha é consistente: chave única, store só onde vive no store, fusão só onde há store', () => {
    const keys = TABLE.map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const r of TABLE) {
      if (r.lives === 'state+store' || r.lives === 'store') expect(r.store, r.key).toBeDefined()
      else expect(r.store, r.key).toBeUndefined()
      if (r.lives === 'state') {
        expect(r.merge, r.key).toBe('none')
        expect(r.restoredAt, r.key).toEqual([])
      }
      if (r.lives === 'state+store') expect(r.merge, r.key).not.toBe('none')
    }
    expect(Object.keys(PLANTS).sort()).toEqual([...STATE_KEYS].sort())
  })

  for (const key of STATE_KEYS) {
    const row = rowOf(key)
    const p = PLANTS[key]
    const inStore = row.lives === 'state+store'

    test(`${key} · A: plantado pela API, fica no state${inStore ? ' e no store' : ', não no store'}`, async ($, on) => {
      const state: Record<string, unknown> = p.seeded !== undefined ? { [key]: p.seeded } : {}
      const h = host(on, {}, state)
      await p.plant($, h)
      if (p.seeded === undefined) expect(has(state[key], p.marker), `${key} no state`).toBe(true)
      expect(Object.values(h.store).some(v => has(v, p.marker)), `${key} no store`).toBe(inStore)
      LEFT[key] = { state: JSON.parse(JSON.stringify(state)), store: JSON.parse(JSON.stringify(h.store)) }
    })

    test(`${key} · B: reinício com session.start: ${inStore ? 'volta do store' : 'morre com o processo'}`, async ($, on) => {
      const state: Record<string, unknown> = {}
      host(on, JSON.parse(JSON.stringify(LEFT[key].store)), state)
      await startUp($)
      expect(has(state[key], p.marker), `${key} depois do session.start`).toBe(inStore)
    })

    test(`${key} · C: reinício sem session.start: ${inStore && (restoredAt(key, 'first-use') || restoredAt(key, 'first-save')) ? 'volta na primeira gravação' : 'não volta'}`, async ($, on) => {
      const state: Record<string, unknown> = {}
      host(on, JSON.parse(JSON.stringify(LEFT[key].store)), state)
      await draw($)
      await call($, 'plan', { tasks: [{ id: 'B', title: 'Depois' }] })
      const back = inStore && (restoredAt(key, 'first-use') || restoredAt(key, 'first-save'))
      expect(has(state[key], p.marker), `${key} depois da primeira gravação`).toBe(back)
    })

    test(`${key} · D: recarga a quente (state mantido, módulo novo): continua lá${inStore ? ' e vai inteiro ao store' : ''}`, async ($, on) => {
      const state: Record<string, unknown> = JSON.parse(JSON.stringify(LEFT[key].state))
      const h = host(on, {}, state)
      await draw($)
      const r = await call($, 'plan', { tasks: [{ id: 'B', title: 'Depois' }] })
      if (key === 'ended') {
        // Kept through the reload; consumed by the first ordinary tool call of the new module
        // (endedNote; the panel's own tools answer without it), once.
        expect(JSON.stringify(r)).toContain('Plano exibido')
        expect(state.ended).toEqual([KID])
        await $.tool.call({ tool: 'Read', file_path: 'a' } as any)
        expect(state.ended).toEqual([])
      } else if (key === 'tasks') {
        // The legacy list moves into the main group at the first write.
        expect(has(state.groups, p.marker)).toBe(true)
        expect(state.tasks).toEqual([])
      } else {
        expect(has(state[key], p.marker), `${key} depois da recarga`).toBe(true)
      }
      // The view reaches the store only when the person presses the toggle (setView), not with every
      // write; the panel, the work and the links go with the plan.
      if (inStore && key !== 'view') expect(Object.values(h.store).some(v => has(v, p.marker)), `${key} gravado no store`).toBe(true)
      if (key === 'groups') expect(has(h.store['session:uuid-eu'], '"Depois"')).toBe(true)
    })
  }

  test('sessions (store): a lista das sessões com painel guardado, a atual primeiro', async ($, on) => {
    const h = host(on, { sessions: ['uuid-antiga'] })
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta' }] })
    expect(h.store['sessions']).toEqual(['uuid-eu', 'uuid-antiga'])
  })

  test('toda chave do state e todo prefixo do store que o módulo toca têm linha na tabela, e toda linha é tocada', async ($, on) => {
    const h = host(on, JSON.parse(JSON.stringify(LEFT.groups?.store ?? {})))
    await startUp($)
    await $.prompt.submit({ text: 'pedido' } as any)
    await $.prompt.submit({ text: '<cross-session-message from="local_x" name="P">oi</cross-session-message>', isMeta: true } as any)
    await call($, 'plan', { tasks: [{ id: 'A', title: 'Planta', children: [{ id: '1', title: 'Passo' }] }] })
    await call($, 'start', { ids: ['1'] })
    await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
    await $.tool.call({ tool: 'Agent', description: 'ler', prompt: 'x' } as any)
    await refresh($)
    await $.tool.call({ tool: 'SendMessage', to: KID, message: 'm' } as any)
    h.running = false
    await refresh($)
    h.listFails = true
    await refresh($)
    h.listFails = false
    await press($, 'view:full')
    await press($, 'fold:|t:A')
    await call($, 'done', { ids: ['1'], summary: 'Resumo' })
    await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r' } as any)
    await $.turn.complete({ reason: 'answer', answer: 'Feito.', durationMs: 1, isAborted: false, turnId: 't1' } as any)
    await $.classic.SessionStart({ source: 'resume', session_id: 'uuid-eu' } as any)
    await draw($)
    const unknownState = [...h.touchedState].filter(k => !(STATE_KEYS as string[]).includes(k))
    expect(unknownState, 'chaves do state sem linha na tabela').toEqual([])
    const unknownStore = [...h.touchedStore].filter(k => !(STORES as string[]).includes(k))
    expect(unknownStore, 'prefixos do store sem linha na tabela').toEqual([])
    const untouched = (STATE_KEYS as string[]).filter(k => !h.touchedState.has(k))
    expect(untouched, 'linhas da tabela que nada toca').toEqual([])
    expect((STORES as string[]).filter(k => !h.touchedStore.has(k)), 'stores da tabela que nada toca').toEqual([])
  })
})
