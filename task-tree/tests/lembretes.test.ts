import { expect, mock, test } from 'claude-code/testing'
import { painel as desenho } from './kit/leitura'
import { AGORA, fixar } from './kit/ambiente'
import { done, esc, fimDoTurno, iniciarSessao, pedido, plan, start, type No } from './kit/cenario'

// Lembretes ao modelo na mensagem seguinte. Origem: decisão do usuário de 2026-10-27 ("precisa
// replanejar quando eu interrompo e envio nova mensagem"); a de outra sessão já fazia isso.

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const REPLANEJAR = 'replaneje o painel'
const ABERTAS = 'deixe abertas só as que continuam'

// O contexto que o mod passa adiante ao modelo, numa linha só.
const contexto = (r: any) => (r?.context ?? []).join(' | ')

async function iniciar($: any, on: any) {
  fixar(on)
  await pedido($, 'Primeiro pedido')
  await plan($, A)
  await start($, ['1'])
}

// Regra: lembretes.replanejar-apos-esc-pessoa
test('depois do Esc, a mensagem da pessoa pede para replanejar o painel', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  const ctx = contexto(await pedido($, 'Agora faça outra coisa'))
  expect(ctx).toContain(REPLANEJAR)
  expect(ctx).toContain('mcp__task-tree__plan')
  expect(ctx).toContain('o usuário interrompeu')
  expect(ctx).toContain('Um')
  expect(ctx).toContain('Dois')
  expect(ctx).not.toContain(ABERTAS)
})

// Regra: lembretes.fim-normal-lista-abertas
test('depois do fim normal do turno, a mensagem da pessoa só lista o que ficou aberto', async ($: any, on: any) => {
  await iniciar($, on)
  await fimDoTurno($)
  const ctx = contexto(await pedido($, 'Próximo'))
  expect(ctx).toContain(ABERTAS)
  expect(ctx).not.toContain(REPLANEJAR)
})

// Regra: lembretes.outra-sessao-apos-esc
test('depois do Esc, a mensagem de outra sessão segue com o lembrete dela', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  const ctx = contexto(await pedido($, '<cross-session-message from="local_x" name="X">oi</cross-session-message>'))
  expect(ctx).toContain('esta mensagem de outra sessão')
  expect(ctx).toContain(REPLANEJAR)
})

// Regra: lembretes.esc-sem-abertas
test('depois do Esc sem nada aberto, não há o que replanejar', async ($: any, on: any) => {
  await iniciar($, on)
  await done($, ['1'])
  await start($, ['2'])
  await done($, ['2'])
  await esc($)
  const ctx = contexto(await pedido($, 'Outro'))
  expect(ctx).not.toContain(REPLANEJAR)
})

// Regra: lembretes.replanejar-vale-uma-vez
test('o lembrete de replanejar vale uma vez só', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  expect(contexto(await pedido($, 'Agora faça outra coisa'))).toContain(REPLANEJAR)
  await fimDoTurno($)
  const ctx = contexto(await pedido($, 'Mais uma'))
  expect(ctx).toContain(ABERTAS)
  expect(ctx).not.toContain(REPLANEJAR)
})

// Regra: lembretes.primeira-chamada-sem-plano
test('sem plano, a primeira ferramenta e cada 10ª depois dela trazem o lembrete de planejar', async ($: any, on: any) => {
  fixar(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  const lembrou: boolean[] = []
  for (let i = 1; i <= 11; i++) {
    const r = await $.tool.call({ tool: 'Bash', tool_use_id: `b${i}`, command: 'ls' })
    lembrou.push(JSON.stringify(r?.context ?? []).includes('sem plano aberto'))
  }
  expect(lembrou).toEqual([true, false, false, false, false, false, false, false, false, false, true])
  // Com um plano aberto, nada.
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  const r = await $.tool.call({ tool: 'Bash', tool_use_id: 'b12', command: 'ls' })
  expect(JSON.stringify(r?.context ?? [])).not.toContain('sem plano aberto')
  await desenho($)
})

// Regra: lembretes.regras-no-prompt-de-sistema
test('as regras do painel entram no prompt de sistema quando as ferramentas dele estão disponíveis', async ($: any, on: any) => {
  fixar(on)
  on('prompt.compose', () => ({ sections: [] }))
  // O que o motor resolve antes de montar o prompt de sistema.
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan', 'Bash'] })
  expect((com?.sections ?? []).map((s: any) => s.id)).toContain('task-tree:regras')
  const sem = await $.prompt.compose({ ...COMPOR, tools: ['Bash'] })
  expect((sem?.sections ?? []).map((s: any) => s.id)).not.toContain('task-tree:regras')
})

// Regra: lembretes.estado-guardado-so-no-mesmo-pedido
test('as regras e o lembrete depois do Esc dizem que o estado só fica no replano da mesma mensagem', async ($: any, on: any) => {
  on('prompt.compose', () => ({ sections: [] }))
  await iniciar($, on)
  await esc($)
  const ctx = contexto(await pedido($, 'Agora faça outra coisa'))
  expect(ctx).not.toContain('guardam o estado')
  expect(ctx).toContain('ids novos')
  expect(ctx).toContain('o deixaria como histórico')
  const outra = contexto(await pedido($, '<cross-session-message from="local_x" name="X">oi</cross-session-message>'))
  expect(outra).not.toContain('guardam o estado')
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan'] })
  const regras = String((com?.sections ?? []).find((s: any) => s.id === 'task-tree:regras')?.text ?? '')
  expect(regras).toContain('Isso vale só na mesma mensagem')
  expect(regras).toContain('use start e done nos ids delas')
})

// Regra: lembretes.estado-guardado-so-no-mesmo-pedido
test('a descrição do plan diz que o estado só fica no replano da mesma mensagem', async ($: any, on: any) => {
  // Como fixar, mas com o tool.register que guarda a descrição (fixar já o ocupa).
  mock.clock(on, { now: AGORA })
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '.' }))
  on('command.register', () => ({ value: {} }))
  const descricoes: Record<string, string> = {}
  on('tool.register', (_$: any, e: any) => {
    descricoes[String(e.name)] = String(e.description ?? '')
    return { value: {} }
  })
  await iniciarSessao($)
  expect(descricoes['plan'] ?? '').toContain('Na mesma mensagem do usuário')
  expect(descricoes['plan'] ?? '').toContain('Numa mensagem seguinte')
})
