import { expect, mock, test } from 'claude-code/testing'
import { painel as desenho } from './kit/leitura'
import { AGORA, fixar, host } from './kit/ambiente'
import { done, esc, fimDoTurno, iniciarSessao, pedido, plan, start, type No } from './kit/cenario'
import { abrirSessao, aviso, mensagemDe } from './kit/cenario'

// Lembretes ao modelo na mensagem seguinte. Origem: decisão do usuário de 2026-10-27 ("precisa
// replanejar quando eu interrompo e envio nova mensagem"); a de outra sessão já fazia isso.

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const REPLANEJAR = 'replaneje o painel'
const ABERTAS = 'deixe abertas só as que continuam'
const NO_MEIO = 'continua o pedido em curso'
const PEDIDO_NOVO = 'A PRIMEIRA chamada'
// A mensagem entregue com o turno em curso (o `turnId` do turno que rodava): a que a pessoa digita
// por cima do turno e a de outra sessão. K1 é uma sessão que esta abriu; MAE, uma que não.
const K1 = 'local_11111111-1111-1111-1111-111111111111'
const MAE = 'local_22222222-2222-2222-2222-222222222222'
const digitadaNoMeio = ($: any, texto: string) => $.prompt.submit({ text: texto, turnId: 't', origin: { kind: 'composer' }, wait: false })
const relatoNoMeio = ($: any, de: string, texto: string) =>
  $.prompt.submit({ text: `<cross-session-message from="${de}" name="outra">${texto}</cross-session-message>`, turnId: 't', origin: { kind: 'peer', from: de } })

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

// Regra: lembretes.replanejar-apos-esc-com-aviso-no-meio
test('depois do Esc, avisos que não abrem pedido no meio não tiram o pedido de replanejar da mensagem da pessoa', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  // O aviso do app, o hand-back de um subagente e a notificação de uma tarefa em segundo plano, cada
  // um com o seu turno terminado normalmente.
  expect(contexto(await aviso($))).not.toContain(REPLANEJAR)
  await fimDoTurno($)
  await $.prompt.submit({ text: '<agent-message from="sub-1">[Subagent hand-back] pronto</agent-message>' })
  await fimDoTurno($)
  await $.prompt.submit({ text: 'tarefa em segundo plano terminou', origin: { kind: 'task-notification' } })
  await fimDoTurno($)
  const ctx = contexto(await pedido($, 'Agora faça outra coisa'))
  expect(ctx).toContain(REPLANEJAR)
  expect(ctx).toContain('o usuário interrompeu')
  expect(ctx).toContain('Um')
  expect(ctx).not.toContain(ABERTAS)
  // E vale uma vez só.
  await fimDoTurno($)
  const depois = contexto(await pedido($, 'Mais uma'))
  expect(depois).toContain(ABERTAS)
  expect(depois).not.toContain(REPLANEJAR)
})

// Regra: lembretes.replanejar-apos-esc-com-aviso-no-meio
test('depois do Esc e de um aviso do app, a mensagem de outra sessão ainda pede para replanejar', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  await aviso($)
  await fimDoTurno($)
  const ctx = contexto(await mensagemDe($, 'local_x', 'oi'))
  expect(ctx).toContain('esta mensagem de outra sessão')
  expect(ctx).toContain(REPLANEJAR)
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

// Regra: lembretes.mensagem-no-meio-do-turno
test('a mensagem entregue no meio do turno traz o lembrete de que continua o pedido em curso, não o de pedido novo', async ($: any, on: any) => {
  on('prompt.compose', () => ({ sections: [] }))
  host(on, [{ id: K1, nome: 'filha-um' }])
  await iniciar($, on)
  await abrirSessao($)
  await aviso($)
  const relato = contexto(await relatoNoMeio($, K1, 'relato'))
  expect(relato).toContain(NO_MEIO)
  expect(relato).toContain('Um')
  expect(relato).toContain('Dois')
  expect(relato).toContain('guardam o estado')
  expect(relato).not.toContain(PEDIDO_NOVO)
  expect(relato).not.toContain(ABERTAS)
  expect(relato).not.toContain(REPLANEJAR)
  const digitada = contexto(await digitadaNoMeio($, 'mais uma coisa'))
  expect(digitada).toContain(NO_MEIO)
  expect(digitada).not.toContain(PEDIDO_NOVO)
  expect(digitada).not.toContain('resposta do usuário')
  // A mensagem de uma sessão que esta não abriu segue com o lembrete de pedido novo.
  const outra = contexto(await relatoNoMeio($, MAE, 'recado'))
  expect(outra).toContain(PEDIDO_NOVO)
  expect(outra).not.toContain(NO_MEIO)
  // Com o turno terminado, a mensagem seguinte volta ao lembrete de pedido novo.
  await fimDoTurno($)
  const seguinte = contexto(await pedido($, 'Próximo'))
  expect(seguinte).toContain(PEDIDO_NOVO)
  expect(seguinte).toContain(ABERTAS)
  expect(seguinte).not.toContain(NO_MEIO)
  // As regras do prompt de sistema dizem a exceção.
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan'] })
  const regras = String((com?.sections ?? []).find((s: any) => s.id === 'task-tree:regras')?.text ?? '')
  expect(regras).toContain('no meio do turno')
  expect(regras).toContain(NO_MEIO)
})

// Regra: lembretes.mensagem-no-meio-do-turno
test('depois do Esc, a mensagem que chega com o turno de um aviso em curso ainda pede para replanejar', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  await aviso($)
  const digitada = contexto(await digitadaNoMeio($, 'Agora faça outra coisa'))
  expect(digitada).toContain(REPLANEJAR)
  expect(digitada).toContain('o usuário interrompeu')
  expect(digitada).toContain(PEDIDO_NOVO)
  expect(digitada).not.toContain(NO_MEIO)
  // Vale uma vez: a mensagem seguinte no meio do mesmo turno já continua o pedido que a anterior abriu.
  const outra = contexto(await digitadaNoMeio($, 'e mais isto'))
  expect(outra).toContain(NO_MEIO)
  expect(outra).not.toContain(REPLANEJAR)
})

// Regra: lembretes.mensagem-no-meio-do-turno
test('a resposta dada pelo chat a uma pergunta, entregue no meio do turno, é dita como resposta e continua o pedido', async ($: any, on: any) => {
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: 'User did not answer this question — they sent a message instead.' }))
  await iniciar($, on)
  await $.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'q1', questions: [] })
  const resposta = contexto(await digitadaNoMeio($, 'prefiro a segunda'))
  expect(resposta).toContain('Esta mensagem é a resposta do usuário à pergunta anterior')
  expect(resposta).toContain(NO_MEIO)
  expect(resposta).not.toContain(PEDIDO_NOVO)
  // Uma vez só.
  expect(contexto(await digitadaNoMeio($, 'e mais isto'))).not.toContain('resposta do usuário')
})

// A frase dos prompts que não abrem pedido sobre a tarefa parada com Esc.
const SO_COM_START = 'só volta a andamento com mcp__task-tree__start nela'
const CURTO = 'mantenha o painel em dia'

// Regra: lembretes.parada-so-volta-com-start
test('depois do Esc, o turno de um aviso, de um hand-back ou de uma notificação diz que a tarefa parada só volta com start nela', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  const prompts: Array<() => Promise<any>> = [
    () => aviso($),
    () => $.prompt.submit({ text: '<agent-message from="sub-1">[Subagent hand-back] pronto</agent-message>' }),
    () => $.prompt.submit({ text: 'tarefa em segundo plano terminou', origin: { kind: 'task-notification' } }),
  ]
  for (const prompt of prompts) {
    const ctx = contexto(await prompt())
    expect(ctx).toContain(SO_COM_START)
    expect(ctx).toContain('o usuário parou (Esc)')
    expect(ctx).toContain('Um')
    expect(ctx).not.toContain('Dois')
    await fimDoTurno($)
  }
})

// Regra: lembretes.parada-so-volta-com-start
test('a frase da tarefa parada com Esc segue nos avisos depois de outro pedido e some com o start nela', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  await pedido($, 'segue')
  await start($, ['2'])
  await fimDoTurno($)
  const primeira = contexto(await aviso($))
  await fimDoTurno($)
  await pedido($, 'volta')
  await start($, ['1'])
  await fimDoTurno($)
  const segunda = contexto(await aviso($))
  expect(primeira).toContain(SO_COM_START)
  expect(primeira).toContain('Um')
  expect(primeira).not.toContain('Dois')
  expect(segunda).not.toContain(SO_COM_START)
  expect(segunda).toContain(CURTO)
})

// Regra: lembretes.parada-so-volta-com-start
test('sem tarefa parada com Esc, ou depois do done nela, o aviso leva só o lembrete curto', async ($: any, on: any) => {
  await iniciar($, on)
  await fimDoTurno($)
  const primeira = contexto(await aviso($))
  await fimDoTurno($)
  await pedido($, 'volta')
  await start($, ['1'])
  await esc($)
  const segunda = contexto(await aviso($))
  await fimDoTurno($)
  await pedido($, 'fecha')
  await done($, ['1'])
  await fimDoTurno($)
  const terceira = contexto(await aviso($))
  expect(primeira).not.toContain(SO_COM_START)
  expect(primeira).toContain(CURTO)
  expect(segunda).toContain(SO_COM_START)
  expect(segunda).toContain('Um')
  expect(terceira).not.toContain(SO_COM_START)
  expect(terceira).toContain(CURTO)
})

// Regra: lembretes.parada-so-volta-com-start
test('as regras do prompt de sistema dizem que a tarefa parada com Esc só volta com start nela', async ($: any, on: any) => {
  fixar(on)
  on('prompt.compose', () => ({ sections: [] }))
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan'] })
  const regras = String((com?.sections ?? []).find((s: any) => s.id === 'task-tree:regras')?.text ?? '')
  expect(regras).toContain('para o turno (Esc)')
  expect(regras).toContain('até um novo mcp__task-tree__start nela')
  expect(regras).toContain('aviso automático')
  expect(regras).toContain('retorno de subagente')
})
