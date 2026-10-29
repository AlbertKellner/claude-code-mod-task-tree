import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host, type Filha } from './kit/ambiente'
import { abrirSessao, aviso, done, pedido, plan, start, type No } from './kit/cenario'
import { emTexto, esperarEstado, esperarPalavra, linha, painel, temBusto } from './kit/leitura'
import { responderEnvio } from './kit/ambiente'
import { envio } from './kit/cenario'
import { cabecalho, cartoes, esperarCarta } from './kit/leitura'

const K1 = 'local_11111111-1111-1111-1111-111111111111'
const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }] }] }]
// Uma tarefa como a filha a publica: aberta, iniciada (aberta com start), concluída.
const tarefa = (id: string, title: string, estado: 'aberta' | 'iniciada' | 'feita' = 'aberta', children: any[] = []) => ({
  id,
  short: id,
  title,
  status: estado === 'feita' ? 'done' : 'open',
  ...(estado === 'iniciada' ? { started: 1, startedAt: AGORA - 1000 } : {}),
  children,
})

// O roteiro comum: pedido, plano A, a tarefa `de` iniciada, a filha aberta dali e o painel relido.
async function abrir($: any, on: any, filha: Omit<Filha, 'id'>, de = '1') {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', ...filha }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, [de])
  await abrirSessao($)
  await aviso($)
  return h
}

// Regra: sessoes.cartao-sob-a-tarefa-de-origem
test('o cartão da filha fica sob a tarefa de onde foi aberta', async ($: any, on: any) => {
  await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  const p = await painel($)
  const i = p.indexOf(linha(p, 'Um'))
  const cartao = linha(p, 'filha-um')
  expect(cartao.sessao, emTexto(p)).toBe(true)
  expect(p.indexOf(cartao), emTexto(p)).toBe(i + 1)
  expect(cartao.nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Um').nivel)
  expect(p.indexOf(linha(p, 'Tarefa da filha')), emTexto(p)).toBe(p.indexOf(cartao) + 1)
  expect(linha(p, 'Tarefa da filha').nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Um').nivel)
})

// Regra: sessoes.filha-trabalhando-mantem-pais-em-andamento, sessoes.palavra-de-estado-do-cartao
test('a filha trabalhando mantém a tarefa e os pais em andamento', async ($: any, on: any) => {
  const h = await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  await done($, ['1'])
  let p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Plano A', 'andamento')
  for (const palavra of ['aguardando', 'parada', 'concluída', 'arquivada']) expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain(palavra)
  h.filha(K1).rodando = false
  h.filha(K1).painel = { tasks: [tarefa('1', 'Tarefa da filha', 'feita')] }
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  esperarPalavra(p, 'filha-um', 'concluída')
})

// Regra: sessoes.filha-parada-pendentes-seguem-pendentes, sessoes.palavra-de-estado-do-cartao
test('filha parada: a iniciada aguarda e as pendentes seguem pendentes', async ($: any, on: any) => {
  const tarefas = [tarefa('1', 'Feita', 'feita'), tarefa('2', 'Começada', 'iniciada'), tarefa('3', 'Nunca')]
  // A filha roda e depois para (a que nunca rodou ainda está abrindo).
  const h = await abrir($, on, { painel: { tasks: tarefas } })
  h.filha(K1).rodando = false
  await aviso($)
  let p = await painel($)
  esperarPalavra(p, 'filha-um', 'parada')
  esperarEstado(p, 'Começada', 'aguardando')
  esperarEstado(p, 'Nunca', 'pendente')
  expect(p.filter(l => l.estado === 'interrompida').map(l => l.titulo), emTexto(p)).toEqual([])
  h.filha(K1).aborted = true
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Começada', 'interrompida')
  esperarEstado(p, 'Nunca', 'pendente')
})

// Regra: sessoes.filha-arquivada-interrompe, sessoes.palavra-de-estado-do-cartao
test('filha arquivada: o que ficou aberto fica interrompido, e o pai com filha concluída aguarda', async ($: any, on: any) => {
  const pai = tarefa('P', 'Pai da filha', 'aberta', [tarefa('P/1', 'Feita', 'feita'), tarefa('P/2', 'Aberta')])
  await abrir($, on, { rodando: false, arquivada: true, painel: { tasks: [pai] } })
  const p = await painel($)
  esperarPalavra(p, 'filha-um', 'arquivada')
  esperarEstado(p, 'Aberta', 'interrompida')
  esperarEstado(p, 'Pai da filha', 'aguardando')
})

// Regra: sessoes.busto-so-no-pai
test('o busto da sessão só na tarefa de que o cartão pende', async ($: any, on: any) => {
  await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }, '2.1')
  const p = await painel($)
  expect(temBusto(p, 'Dois.um'), emTexto(p)).toBe(true)
  for (const titulo of ['Dois', 'Plano A', 'Pedido um']) expect(temBusto(p, titulo), `${titulo}:\n${emTexto(p)}`).toBe(false)
})

// Regra: sessoes.pasta-sem-git
test('sessão numa pasta sem git mostra a pasta, sem branch', async ($: any, on: any) => {
  await abrir($, on, { git: { kind: 'folder', repo: 'C:/projetos/solto' }, painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  const p = await painel($)
  esperarPalavra(p, 'filha-um', '▭')
  esperarPalavra(p, 'filha-um', 'solto')
  expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain('⑂')
})

// Regra: sessoes.toks-e-repo-branch-no-cartao
test('o cartão mostra toks/s e repositório com branch', async ($: any, on: any) => {
  await abrir($, on, { git: { repo: 'meu-repo', branch: 'minha-branch' }, rate: { toks: 42, live: true }, painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  const p = await painel($)
  esperarPalavra(p, 'filha-um', '42 toks/s')
  esperarPalavra(p, 'filha-um', 'meu-repo ⑂ minha-branch')
})

// Regra: sessoes.cartao-sob-a-tarefa-de-origem
test('com duas tarefas em andamento, cada sessão aberta vai a uma tarefa diferente', async ($: any, on: any) => {
  fixar(on)
  const K2 = 'local_22222222-2222-2222-2222-222222222222'
  host(on, [
    { id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } },
    { id: K2, nome: 'filha-dois', painel: { tasks: [tarefa('1', 'Tarefa da filha dois', 'iniciada')] } },
  ])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await start($, ['2.1'])
  await abrirSessao($)
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(p.indexOf(linha(p, 'filha-um')), emTexto(p)).toBe(p.indexOf(linha(p, 'Um')) + 1)
  expect(p.indexOf(linha(p, 'filha-dois')), emTexto(p)).toBe(p.indexOf(linha(p, 'Dois.um')) + 1)
})

// ---- Rodadas: um cartão por mensagem, mensagens juntas, rodada descartada, cadeia de irmãs.

const IRMA = 'local_22222222-2222-2222-2222-222222222222'
const A3: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }]
// Uma tarefa da filha num turno dela.
const noTurno = (turn: number, id: string, title: string, estado: 'aberta' | 'iniciada' | 'feita') => ({ ...tarefa(id, title, estado), turn })
const turno = (id: number, at: number) => ({ id, title: `turno ${id}`, at })

// A mãe abre K1 sob "Um" (o turno 1 da filha, com `f1`) e manda uma mensagem de "Dois"; a filha abre
// o turno 2 depois dela, com `f2`.
async function duasRodadas($: any, on: any, f1: any[], f2Estado: 'iniciada' | 'feita' = 'iniciada') {
  const { relogio } = fixar(on)
  responderEnvio(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: f1, turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await start($, ['2'])
  await relogio.advance(1000)
  await envio($, K1)
  await relogio.advance(1000)
  h.recebeu(K1, AGORA + 1500)
  h.filha(K1).painel = { tasks: [...f1, noTurno(2, '2', 'f2', f2Estado)], turns: [turno(1, AGORA + 10), turno(2, AGORA + 1800)] }
  await aviso($)
  return painel($)
}

// Regra: sessoes.um-cartao-por-mensagem
test('cada mensagem à filha, em turnos diferentes, tem o seu cartão sob a tarefa da mensagem', async ($: any, on: any) => {
  const p = await duasRodadas($, on, [noTurno(1, '1', 'f1', 'feita')])
  expect(cartoes(p, 'filha-um').map(c => ({ sob: c.sob, tarefas: c.tarefas })), emTexto(p)).toEqual([
    { sob: 'Um', tarefas: ['f1'] },
    { sob: 'Dois', tarefas: ['f2'] },
  ])
})

// Regra: sessoes.mensagens-juntas-vao-a-ultima
test('mensagens entregues juntas: o cartão do turno vai à tarefa da última', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderEnvio(on)
  const f1 = noTurno(1, '1', 'f1', 'feita')
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [f1], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await start($, ['2', '3'])
  await relogio.advance(1000)
  await envio($, K1)
  await relogio.advance(1000)
  await envio($, K1)
  await relogio.advance(1000)
  h.recebeu(K1, AGORA + 1500)
  h.recebeu(K1, AGORA + 2500)
  h.filha(K1).painel = { tasks: [f1, noTurno(2, '2', 'f2', 'iniciada')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 2800)] }
  await aviso($)
  const p = await painel($)
  const cs = cartoes(p, 'filha-um')
  expect(cs.filter(c => c.tarefas.includes('f2')).map(c => c.sob), emTexto(p)).toEqual(['Três'])
  expect(cs.filter(c => c.sob === 'Dois' && c.tarefas.length > 0), emTexto(p)).toEqual([])
})

// Regra: sessoes.rodada-descartada-fora-da-contagem
test('a rodada anterior deixada com tarefa aberta sai da contagem, ✓ inclusive, e continua desenhada', async ($: any, on: any) => {
  // A rodada 1 com uma ✓ e uma aberta; a rodada 2 com f2. Contam Um, Três e f2 (Dois é tarefa de mensagem).
  const p = await duasRodadas($, on, [noTurno(1, '1', 'f1', 'feita'), noTurno(1, '1b', 'f1b', 'iniciada')])
  const c = cabecalho(p)
  expect(c.total, emTexto(p)).toBe(3)
  expect(cartoes(p, 'filha-um')[0]?.tarefas, emTexto(p)).toEqual(expect.arrayContaining(['f1', 'f1b']))
})

// Regra: sessoes.rodada-descartada-fora-da-contagem
test('a sessão parada com Esc e tarefa aberta sai da contagem; parada normal, a tarefa aguarda e conta', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [noTurno(1, '1', 'f1', 'iniciada')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  await aviso($)
  let p = await painel($)
  esperarEstado(p, 'f1', 'aguardando')
  expect(cabecalho(p).total, emTexto(p)).toBe(4)
  h.filha(K1).aborted = true
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'f1', 'interrompida')
  expect(cabecalho(p).total, emTexto(p)).toBe(3)
})

// K1 sob "Um" e K2 sob "Dois"; K1 manda uma mensagem a K2 da tarefa "Avisar K2", e K2 abre o turno 2
// depois dela, com "d2".
async function cadeia($: any, on: any, tomada: boolean) {
  const { relogio } = fixar(on)
  const h = host(on, [
    {
      id: K1,
      nome: 'filha-um',
      painel: { tasks: [{ ...noTurno(1, '1', 'Avisar K2', 'feita'), msg: true }], turns: [turno(1, AGORA + 10)] },
      envios: [{ to: IRMA, anchor: '1', at: AGORA + 3000, ...(tomada ? { taken: true } : {}) }],
    },
    {
      id: IRMA,
      nome: 'filha-dois',
      painel: { tasks: [noTurno(1, '1', 'd1', 'feita'), noTurno(2, '2', 'd2', 'iniciada')], turns: [turno(1, AGORA + 20), turno(2, AGORA + 3200)] },
      recebidas: [{ from: K1, at: AGORA + 3100 }],
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await start($, ['2'])
  await abrirSessao($)
  await relogio.advance(4000)
  await aviso($)
  return { h, p: await painel($) }
}

// Regra: sessoes.cadeia-sem-cartao-dentro-de-cartao
test('a cadeia de irmãs fica na sequência, sob a tarefa da mãe, sem cartão dentro de cartão', async ($: any, on: any) => {
  const { p } = await cadeia($, on, false)
  const um = cartoes(p, 'filha-um')
  const dois = cartoes(p, 'filha-dois')
  const d2 = dois.filter(c => c.tarefas.includes('d2'))
  expect(d2.map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(d2[0]?.nivel, emTexto(p)).toBe(um[0]?.nivel)
  expect(um.some(c => c.tarefas.includes('d2')), emTexto(p)).toBe(false)
})

// Regra: sessoes.mensagem-entre-filhas-no-cartao-da-remetente
test('a mensagem entre irmãs fica no cartão da remetente, com o ✉ da entrega', async ($: any, on: any) => {
  const { p } = await cadeia($, on, false)
  expect(cartoes(p, 'filha-um')[0]?.tarefas, emTexto(p)).toContain('Avisar K2')
  esperarCarta(p, 'Avisar K2', 'fila')
})

// Regra: sessoes.rodada-descartada-fora-da-contagem-do-pai
test('com a rodada anterior abandonada sob Um, o x/y de Um não a conta, e a rodada nova segue em andamento', async ($: any, on: any) => {
  const p = await duasRodadas($, on, [noTurno(1, '1', 'f1', 'feita'), noTurno(1, '1b', 'f1b', 'iniciada')])
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('0/1')
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([0, 3])
  esperarEstado(p, 'f2', 'andamento')
})