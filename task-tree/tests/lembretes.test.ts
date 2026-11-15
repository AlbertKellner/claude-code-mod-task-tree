import { expect, mock } from 'claude-code/testing'
import { test } from './kit/teste'
import { painel as desenho } from './kit/leitura'
import { AGORA, estado, fixar, host, responderEnvio } from './kit/ambiente'
import { done, esc, fimDoTurno, iniciarSessao, pedido, plan, start, type No } from './kit/cenario'
import { abrirSessao, aviso, envio, falha, mensagemDe } from './kit/cenario'

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

// Pedido um deixa "Dois" pendente; o pedido dois começa.
async function pendenteAntiga($: any, on: any) {
  fixar(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'], 'Um feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
}
const lembraNaFerramenta = async ($: any, id: string) => {
  const r = await $.tool.call({ tool: 'Bash', tool_use_id: id, command: 'ls' })
  return JSON.stringify(r?.context ?? []).includes('sem plano aberto')
}

// Regra: lembretes.primeira-chamada-sem-plano
test('pedido novo sem plano, com um passo pendente do pedido anterior: o lembrete de planejar sai', async ($: any, on: any) => {
  await pendenteAntiga($, on)
  expect(await lembraNaFerramenta($, 'b1')).toBe(true)
})

// Regra: lembretes.primeira-chamada-sem-plano
test('fechar com done um passo do pedido anterior não conta como planejar o pedido novo', async ($: any, on: any) => {
  await pendenteAntiga($, on)
  await done($, ['2'])
  expect(await lembraNaFerramenta($, 'b1')).toBe(true)
})

// Regra: lembretes.primeira-chamada-sem-plano
test('o plan recusado por ids repetidos não cala o lembrete', async ($: any, on: any) => {
  fixar(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  expect((await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '1', title: 'Outro' }] }])).erro).toBe(true)
  expect(await lembraNaFerramenta($, 'b1')).toBe(true)
})

// Regra: lembretes.primeira-chamada-sem-plano
test('seguir numa tarefa antiga com start cala o lembrete', async ($: any, on: any) => {
  await pendenteAntiga($, on)
  await start($, ['2'])
  expect(await lembraNaFerramenta($, 'b1')).toBe(false)
})

// Regra: lembretes.primeira-chamada-sem-plano, arvore.done-sem-summary-e-varias-sem-start
test('o done que fecha a última tarefa do pedido atual cobra o summary mesmo com pendente antiga', async ($: any, on: any) => {
  await pendenteAntiga($, on)
  await plan($, [{ id: 'B', title: 'Plano B' }])
  await start($, ['B'])
  expect((await done($, ['B'])).texto).toContain('falta o summary')
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

// Regra: lembretes.cancelar-o-que-a-mensagem-substitui
test('os lembretes de mensagem nova, as regras e a descrição do done mandam cancelar o que a mensagem substitui', async ($: any, on: any) => {
  // Como fixar, mas com o tool.register que guarda as descrições (fixar já o ocupa).
  mock.clock(on, { now: AGORA })
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }))
  on('session.start', () => ({ cwd: '.' }))
  on('command.register', () => ({ value: {} }))
  on('classic.SessionStart', () => ({}))
  on('prompt.compose', () => ({ sections: [] }))
  const descricoes: Record<string, string> = {}
  on('tool.register', (_$: any, e: any) => {
    descricoes[String(e.name)] = String(e.description ?? '') + ' ' + JSON.stringify(e.inputSchema ?? {})
    return { value: {} }
  })
  await iniciarSessao($)
  await pedido($, 'Primeiro pedido')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  const nova = contexto(await pedido($, 'Outra coisa'))
  expect(nova).toContain('cancel')
  expect(nova).toContain(ABERTAS)
  await esc($)
  const depois = contexto(await pedido($, 'Mudei de ideia'))
  expect(depois).toContain('cancele o que ela substitui')
  const digitada = contexto(await digitadaNoMeio($, 'mais uma coisa'))
  expect(digitada).toContain('cancele')
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan'] })
  const regras = String((com?.sections ?? []).find((s: any) => s.id === 'task-tree:regras')?.text ?? '')
  expect(regras).toContain('`cancel`')
  expect(descricoes['done'] ?? '').toContain('cancel')
})

// Regra: lembretes.aguardando-so-volta-com-start
test('as regras e o lembrete da mensagem seguinte dizem que a tarefa que aguardava só volta com start nela', async ($: any, on: any) => {
  fixar(on)
  on('prompt.compose', () => ({ sections: [] }))
  await pedido($, 'Primeiro pedido')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  const ctx = contexto(await pedido($, 'Próximo'))
  expect(ctx).toContain('seguem aguardando (◷)')
  expect(ctx).toContain(ABERTAS)
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan'] })
  const regras = String((com?.sections ?? []).find((s: any) => s.id === 'task-tree:regras')?.text ?? '')
  expect(regras).toContain('termina normalmente fica aguardando')
})

// Regra: lembretes.replanejar-apos-turno-que-falhou
test('depois de um turno que morreu por erro, a mensagem da pessoa pede para replanejar dizendo o erro, uma vez', async ($: any, on: any) => {
  await iniciar($, on)
  await falha($)
  const ctx = contexto(await pedido($, 'Agora segue'))
  expect(ctx).toContain(REPLANEJAR)
  expect(ctx).toContain('terminou com erro')
  expect(ctx).not.toContain('o usuário interrompeu')
  expect(ctx).not.toContain(ABERTAS)
  await fimDoTurno($)
  const depois = contexto(await pedido($, 'Mais uma'))
  expect(depois).not.toContain(REPLANEJAR)
  expect(depois).not.toContain('terminou com erro')
})

// Regra: lembretes.replanejar-apos-turno-que-falhou
test('depois de um turno que morreu por erro, o aviso do app diz que a tarefa segue ✕ "falhou"', async ($: any, on: any) => {
  await iniciar($, on)
  await falha($)
  const ctx = contexto(await aviso($))
  expect(ctx).toContain('seguem ✕ "falhou"')
  expect(ctx).not.toContain('o usuário parou (Esc)')
})

// A filha aberta da tarefa 1 que recebe uma mensagem enviada da 2. `entregue`: a filha trata a
// mensagem (a entrega e o received dela); senão a mensagem fica na fila. `fecha`: as tarefas
// concluídas antes do turno da filha terminar.
async function filhaComMensagem($: any, on: any, entregue: boolean, fecha: { antes?: string[]; depois?: string[] }) {
  const { relogio } = fixar(on)
  const env = responderEnvio(on)
  if (entregue) env.modo = 'entregue'
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [], turns: [] } }])
  await pedido($, 'Primeiro pedido')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  if (fecha.antes) await done($, fecha.antes)
  await start($, ['2'])
  await relogio.advance(1000)
  await envio($, K1)
  await relogio.advance(1000)
  if (entregue) {
    h.recebeu(K1, AGORA + 1500)
    await aviso($)
  }
  if (fecha.depois) await done($, fecha.depois)
  h.filha(K1).rodando = false
  return contexto(await aviso($))
}

// Regra: lembretes.filha-terminou-o-turno
test('quando a filha termina o turno de uma mensagem, o lembrete cita a tarefa de onde a mensagem saiu', async ($: any, on: any) => {
  const ctx = await filhaComMensagem($, on, true, { antes: ['1'] })
  expect(ctx).toContain('terminou o turno a sessão')
  expect(ctx).toContain('tarefa de origem "A/2" Dois')
})

// Regra: lembretes.filha-terminou-o-turno
test('com a mensagem nova ainda na fila, o lembrete do turno que terminou cita a tarefa de abertura', async ($: any, on: any) => {
  const ctx = await filhaComMensagem($, on, false, {})
  expect(ctx).toContain('tarefa de origem "A/1" Um')
  expect(ctx).not.toContain('tarefa de origem "A/2"')
})

// Regra: lembretes.filha-terminou-o-turno
test('com a tarefa da rodada já fechada e a de abertura aberta, o lembrete cita a de abertura', async ($: any, on: any) => {
  const ctx = await filhaComMensagem($, on, true, { depois: ['2'] })
  expect(ctx).toContain('tarefa de origem "A/1" Um')
})

// Regra: lembretes.planejar-antes-de-delegar
test('as regras pedem o plan antes de mandar mensagem, abrir sessão ou lançar subagente', async ($: any, on: any) => {
  fixar(on)
  on('prompt.compose', () => ({ sections: [] }))
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan'] })
  const regras = String((com?.sections ?? []).find((s: any) => s.id === 'task-tree:regras')?.text ?? '')
  expect(regras).toContain('Planeje antes de delegar')
  expect(regras).toContain('o primeiro plan do pedido o adota')
})

// As regras do prompt de sistema e o que o tool.register recebeu (descrição e inputSchema de cada ferramenta).
async function textosAoModelo($: any, on: any) {
  mock.clock(on, { now: AGORA })
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '.' }))
  on('command.register', () => ({ value: {} }))
  on('prompt.compose', () => ({ sections: [] }))
  const ferramentas: Record<string, any> = {}
  on('tool.register', (_$: any, e: any) => {
    ferramentas[String(e.name)] = e
    return { value: {} }
  })
  await iniciarSessao($)
  const COMPOR = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], outputStyle: null, traits: [] }
  const com = await $.prompt.compose({ ...COMPOR, tools: ['mcp__task-tree__plan'] })
  const regras = String((com?.sections ?? []).find((s: any) => s.id === 'task-tree:regras')?.text ?? '')
  return { regras, ferramentas }
}

// Regra: lembretes.resumo-e-a-linha-de-resposta
test('as regras e a descrição do summary dizem que sem summary o pedido fica sem linha ↩', async ($: any, on: any) => {
  const { regras, ferramentas } = await textosAoModelo($, on)
  const summary = String(ferramentas['done']?.inputSchema?.properties?.summary?.description ?? '')
  for (const texto of [regras, summary]) {
    expect(texto).toContain('sem linha ↩')
    expect(texto).not.toContain('tooltip')
    expect(texto).not.toContain('primeira frase')
  }
})

// Regra: lembretes.regra-dos-subagentes
test('as regras dizem que o subagente tem cartão desde o lançamento e que a tarefa fecha sozinha', async ($: any, on: any) => {
  const { regras } = await textosAoModelo($, on)
  expect(regras).toContain('aparece como um cartão')
  expect(regras).toContain('fecha a tarefa sozinho')
  expect(regras).toContain('chame start nela')
  expect(regras).not.toContain('Subagentes que usam o painel')
})

// Regra: lembretes.regras-dizem-o-que-nao-vale-no-subagente
test('as regras dizem o que não vale dentro de um subagente', async ($: any, on: any) => {
  const { regras } = await textosAoModelo($, on)
  expect(regras).toContain('Dentro de um subagente')
  expect(regras).toContain('ficam no cartão do subagente')
  expect(regras).toContain('são ignorados')
})

// Regra: lembretes.done-antes-do-plan
test('com tarefas abertas, o lembrete de pedido novo manda fechar com done antes do plan', async ($: any, on: any) => {
  await iniciar($, on)
  await fimDoTurno($)
  const ctx = contexto(await pedido($, 'Agora faça outra coisa'))
  expect(ctx).toContain('Primeiro feche com mcp__task-tree__done')
  expect(ctx).toContain('depois disso')
  expect(ctx.indexOf('Primeiro feche com mcp__task-tree__done')).toBeLessThan(ctx.indexOf(PEDIDO_NOVO))
})

// Regra: lembretes.done-antes-do-plan
test('sem tarefas abertas, o lembrete de pedido novo manda o plan primeiro', async ($: any, on: any) => {
  fixar(on)
  const vazio = contexto(await pedido($, 'Primeiro pedido'))
  expect(vazio).toContain(PEDIDO_NOVO)
  expect(vazio).not.toContain('Primeiro feche')
  await plan($, [{ id: 'A', title: 'Plano A' }])
  await start($, ['A'])
  await done($, ['A'], 'Feito')
  await fimDoTurno($)
  const depois = contexto(await pedido($, 'Segundo pedido'))
  expect(depois).toContain(PEDIDO_NOVO)
  expect(depois).not.toContain('Primeiro feche')
})

// Regra: lembretes.done-antes-do-plan
test('a primeira regra do painel diz done antes do plan quando a mensagem conclui tarefas abertas', async ($: any, on: any) => {
  const { regras } = await textosAoModelo($, on)
  expect(regras).toContain('feche-as primeiro com mcp__task-tree__done')
  expect(regras.indexOf('feche-as primeiro')).toBeLessThan(regras.indexOf('a primeira chamada de ferramenta é mcp__task-tree__plan'))
})

// ---- Um cenário por texto ao modelo (decisão do usuário de 2026-11-14: "Cenário por texto
// (Recomendado)"): cada teste confere quando o texto sai, e quando não sai, e um ou dois trechos.
const HAND_BACK = '<agent-message from="sub-1">[Subagent hand-back] pronto</agent-message>'
const WRAP_UP = 'mcp__ccd_turn__wrap_up'
const contextoDe = (r: any) => JSON.stringify(r?.context ?? [])

// Regra: lembretes.retorno-de-subagente
test('o retorno de um subagente traz o lembrete curto de marcar com done o que ele concluiu', async ($: any, on: any) => {
  await iniciar($, on)
  await fimDoTurno($)
  const ctx = contexto(await $.prompt.submit({ text: HAND_BACK }))
  expect(ctx).toContain('o subagente terminou')
  expect(ctx).toContain('mcp__task-tree__done')
  expect(ctx).not.toContain(PEDIDO_NOVO)
  await fimDoTurno($)
  expect(contexto(await pedido($, 'Outro pedido'))).not.toContain('o subagente terminou')
})

// Regra: lembretes.tarefa-em-segundo-plano
test('a notificação de uma tarefa em segundo plano traz o lembrete curto de atualizar o painel', async ($: any, on: any) => {
  await iniciar($, on)
  await fimDoTurno($)
  const ctx = contexto(await $.prompt.submit({ text: 'tarefa em segundo plano terminou', origin: { kind: 'task-notification' } }))
  expect(ctx).toContain('uma tarefa em segundo plano')
  expect(ctx).toContain('terminou')
  expect(ctx).not.toContain(PEDIDO_NOVO)
  expect(ctx).not.toContain('o subagente terminou')
})

// Regra: lembretes.aviso-do-app
test('o aviso do app traz só o lembrete curto de manter o painel em dia', async ($: any, on: any) => {
  await iniciar($, on)
  await fimDoTurno($)
  const ctx = contexto(await aviso($))
  expect(ctx).toContain(CURTO)
  expect(ctx).not.toContain(PEDIDO_NOVO)
  await fimDoTurno($)
  expect(contexto(await pedido($, 'Outro pedido'))).not.toContain(CURTO)
})

// Regra: lembretes.resposta-por-opcao
test('a pergunta respondida por opção devolve o pedido de done no que a resposta concluiu e de plan com as próximas', async ($: any, on: any) => {
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: 'Opção A' }))
  await iniciar($, on)
  const ctx = contextoDe(await $.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'q1', questions: [] }))
  expect(ctx).toContain('o usuário respondeu')
  expect(ctx).toContain('mcp__task-tree__plan')
  expect(ctx).not.toContain('vai responder por mensagem')
})

// Regra: lembretes.resposta-pelo-chat
test('a pergunta dispensada para o chat avisa que a mensagem seguinte é a resposta, e essa mensagem é dita como resposta uma vez', async ($: any, on: any) => {
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: 'User did not answer this question — they sent a message instead.' }))
  await iniciar($, on)
  const ctx = contextoDe(await $.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'q1', questions: [] }))
  expect(ctx).toContain('vai responder por mensagem no chat')
  expect(ctx).not.toContain('o usuário respondeu')
  await fimDoTurno($)
  expect(contexto(await pedido($, 'prefiro a segunda'))).toContain('Esta mensagem é a resposta do usuário à pergunta anterior')
  await fimDoTurno($)
  expect(contexto(await pedido($, 'outra coisa'))).not.toContain('resposta do usuário')
})

// Regra: lembretes.wrap-up-sem-resumo
test('o wrap_up sem summary no turno avisa que falta o resumo; com o summary dado, não', async ($: any, on: any) => {
  on('tool.call', { tool: WRAP_UP }, () => ({ result: 'ok' }))
  await iniciar($, on)
  expect(contextoDe(await $.tool.call({ tool: WRAP_UP, tool_use_id: 'w1', recap: 'r' }))).toContain('falta o resumo do turno')
  await done($, ['1', '2'], 'Feito')
  expect(contextoDe(await $.tool.call({ tool: WRAP_UP, tool_use_id: 'w2', recap: 'r' }))).not.toContain('falta o resumo do turno')
})

// Regra: lembretes.wrap-up-com-abertas
test('o wrap_up com tarefas abertas as lista; com tudo fechado, não', async ($: any, on: any) => {
  on('tool.call', { tool: WRAP_UP }, () => ({ result: 'ok' }))
  await iniciar($, on)
  const ctx = contextoDe(await $.tool.call({ tool: WRAP_UP, tool_use_id: 'w1', recap: 'r' }))
  expect(ctx).toContain('o turno termina com tarefas abertas')
  expect(ctx).toContain('Dois')
  await done($, ['1', '2'], 'Feito')
  expect(contextoDe(await $.tool.call({ tool: WRAP_UP, tool_use_id: 'w2', recap: 'r' }))).not.toContain('o turno termina com tarefas abertas')
})

// Regra: lembretes.descricoes-das-ferramentas
test('as descrições das ferramentas e do comando dizem o essencial de cada uma', async ($: any, on: any) => {
  mock.clock(on, { now: AGORA })
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '.' }))
  on('prompt.compose', () => ({ sections: [] }))
  const comandos: any[] = []
  on('command.register', (_$: any, e: any) => {
    comandos.push(e)
    return { value: {} }
  })
  const ferramentas: Record<string, any> = {}
  on('tool.register', (_$: any, e: any) => {
    ferramentas[String(e.name)] = e
    return { value: {} }
  })
  await iniciarSessao($)
  const desc = (nome: string) => String(ferramentas[nome]?.description ?? '')
  expect(desc('plan')).toContain('Até 3 níveis')
  expect(desc('plan')).toContain('request')
  expect(desc('done')).toContain('concluídas')
  expect(desc('done')).toContain('summary')
  expect(desc('start')).toContain('em andamento')
  expect(String(ferramentas['done']?.inputSchema?.properties?.cancel?.description ?? '')).toContain('não serão feitas')
  expect(JSON.stringify(comandos)).toContain('Abre o painel')
})

// As marcas do pedido (se já usou o painel, se a pergunta foi dispensada para o chat) gravadas antes
// de uma recarga do mod, e lidas pelo módulo novo.
const PLANEJOU: Record<string, unknown> = {}
const DISPENSOU: Record<string, unknown> = {}
const DISPENSA = 'User did not answer this question — they sent a message instead.'

// Regra: lembretes.marcas-do-pedido-sobrevivem-a-recarga
test('recarga depois de planejar e fechar tudo, 1/2: o pedido planeja e fecha', async ($: any, on: any) => {
  fixar(on)
  estado(on, PLANEJOU, 'captura')
  await pedido($, 'Primeiro pedido')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1', '2'], 'Feito')
  expect(Object.keys(PLANEJOU).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: lembretes.marcas-do-pedido-sobrevivem-a-recarga
test('recarga depois de planejar e fechar tudo, 2/2: a chamada seguinte não traz o lembrete de planejar', async ($: any, on: any) => {
  fixar(on)
  estado(on, PLANEJOU, 'semear')
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  expect(Object.keys(PLANEJOU).length, 'o 1/2 não gravou o state').toBeGreaterThan(0)
  const r = await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'git status' })
  expect(JSON.stringify(r?.context ?? [])).not.toContain('sem plano aberto')
})

// Regra: lembretes.marcas-do-pedido-sobrevivem-a-recarga
test('recarga entre a pergunta dispensada e a resposta, 1/2: a pergunta vai para o chat', async ($: any, on: any) => {
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: DISPENSA }))
  fixar(on)
  estado(on, DISPENSOU, 'captura')
  await pedido($, 'Primeiro pedido')
  await plan($, A)
  await start($, ['1'])
  expect(contextoDe(await $.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'q1', questions: [] }))).toContain('vai responder por mensagem no chat')
  await fimDoTurno($)
  expect(Object.keys(DISPENSOU).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: lembretes.marcas-do-pedido-sobrevivem-a-recarga
test('recarga entre a pergunta dispensada e a resposta, 2/2: a mensagem da pessoa é dita como a resposta', async ($: any, on: any) => {
  fixar(on)
  estado(on, DISPENSOU, 'semear')
  expect(Object.keys(DISPENSOU).length, 'o 1/2 não gravou o state').toBeGreaterThan(0)
  expect(contexto(await pedido($, 'prefiro a segunda'))).toContain('Esta mensagem é a resposta do usuário à pergunta anterior')
})

// Regra: lembretes.resposta-pelo-chat-so-na-mensagem-da-pessoa
test('a mensagem de outra sessão entre a pergunta dispensada e a resposta não é dita como resposta; a da pessoa é', async ($: any, on: any) => {
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: DISPENSA }))
  await iniciar($, on)
  await $.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'q1', questions: [] })
  await fimDoTurno($)
  expect(contexto(await mensagemDe($, 'local_x', 'oi'))).not.toContain('resposta do usuário')
  await fimDoTurno($)
  expect(contexto(await pedido($, 'prefiro a segunda'))).toContain('Esta mensagem é a resposta do usuário à pergunta anterior')
  await fimDoTurno($)
  expect(contexto(await pedido($, 'outra coisa'))).not.toContain('resposta do usuário')
})

// A filha aberta de "Um", com uma tarefa iniciada, e o painel relido.
async function filhaAberta($: any, on: any) {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [{ id: 'f1', short: 'f1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA, children: [] }] } }])
  await pedido($, 'Primeiro pedido')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  return h
}

// Regra: lembretes.filha-arquivada-ou-apagada
test('a filha apagada com a tarefa de origem aberta: o modelo é avisado uma vez, e o cartão some', async ($: any, on: any) => {
  const h = await filhaAberta($, on)
  h.filha(K1).apagada = true
  const ctx = contexto(await aviso($))
  for (const t of ['não existe mais no app a sessão', 'filha-um', 'tarefa de origem "A/1" Um', 'continua aberta']) expect(ctx).toContain(t)
  const p = await desenho($)
  expect(p.some(l => l.texto.includes('filha-um'))).toBe(false)
  expect(contexto(await aviso($))).not.toContain('não existe mais')
})

// Regra: lembretes.filha-arquivada-ou-apagada
test('a filha fora da lista mas existente não gera aviso', async ($: any, on: any) => {
  const h = await filhaAberta($, on)
  h.filha(K1).listada = false
  expect(contexto(await aviso($))).not.toContain('não existe mais')
  expect(contexto(await aviso($))).not.toContain('não existe mais')
})

// Regra: lembretes.filha-arquivada-ou-apagada
test('com a tarefa de origem fechada, a filha apagada não gera aviso', async ($: any, on: any) => {
  const h = await filhaAberta($, on)
  await done($, ['1'])
  h.filha(K1).apagada = true
  expect(contexto(await aviso($))).not.toContain('não existe mais')
})

// Regra: lembretes.filha-arquivada-ou-apagada
test('a filha arquivada com a tarefa de origem aberta: o modelo é avisado uma vez', async ($: any, on: any) => {
  const h = await filhaAberta($, on)
  h.filha(K1).rodando = false
  h.filha(K1).arquivada = true
  const ctx = contexto(await aviso($))
  for (const t of ['foi arquivada no app a sessão', 'filha-um', 'tarefa de origem "A/1" Um']) expect(ctx).toContain(t)
  const p = await desenho($)
  expect(p.find(l => l.texto.includes('filha-um'))?.texto ?? '').toContain('arquivada')
  expect(contexto(await aviso($))).not.toContain('foi arquivada')
})
