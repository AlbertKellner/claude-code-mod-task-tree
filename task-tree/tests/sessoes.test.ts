import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host, type Filha } from './kit/ambiente'
import { abrirSessao, aviso, done, pedido, plan, start, type No } from './kit/cenario'
import { fimDoTurno } from './kit/cenario'
import { emTexto, esperarEstado, esperarPalavra, linha, painel, temBusto } from './kit/leitura'
import { responderEnvio } from './kit/ambiente'
import { envio } from './kit/cenario'
import { cabecalho, cartoes, comHistorico, esperarCartaSob } from './kit/leitura'

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
  esperarEstado(p, 'Pai da filha', 'concluida')
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
  // A rodada 1 com uma ✓ e uma aberta; a rodada 2 com f2. Contam Um, Dois, Três e f2 (a tarefa que enviou conta).
  const p = await duasRodadas($, on, [noTurno(1, '1', 'f1', 'feita'), noTurno(1, '1b', 'f1b', 'iniciada')])
  const c = cabecalho(p)
  expect(c.total, emTexto(p)).toBe(4)
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
  esperarCartaSob(p, 'Avisar K2', 'fila')
})

// Regra: sessoes.rodada-descartada-fora-da-contagem-do-pai
test('com a rodada anterior abandonada sob Um, o x/y de Um não a conta, e a rodada nova segue em andamento', async ($: any, on: any) => {
  const p = await duasRodadas($, on, [noTurno(1, '1', 'f1', 'feita'), noTurno(1, '1b', 'f1b', 'iniciada')])
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('0/1')
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 4])
  esperarEstado(p, 'f2', 'andamento')
})

// Regra: sessoes.pedido-recebido-aparece-no-cartao
test('no cartão da filha, o pedido que veio por mensagem tem a sua carta, mesmo com uma tarefa só', async ($: any, on: any) => {
  fixar(on)
  const mensagem = { id: 1, title: 'Governança: push e PR', at: AGORA + 10, msg: true, from: { id: 'local_00000000-0000-0000-0000-00000000e0e0', name: 'orquestradora' } }
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [noTurno(1, '1', 'Conferir e rodar o check', 'feita')], turns: [mensagem] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  const cartao = cartoes(p, 'filha-um')
  expect(cartao.map(c => c.tarefas), emTexto(p)).toEqual([['Governança: push e PR', 'Conferir e rodar o check']])
  expect(linha(p, 'Governança: push e PR').carta, emTexto(p)).toBeDefined()
  esperarEstado(p, 'Conferir e rodar o check', 'concluida')
})

// ---- Turno aberto pelo usuário na filha (own).

const PROPRIO = 'governanca · pedido do usuário na filha'
// A mãe abre a filha no pedido antigo ("Reescrita"); a filha trata a mensagem (turno 1).
async function abrirNoPedidoAntigo($: any, on: any) {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido antigo')
  await plan($, [{ id: 'O', title: 'Reescrita', children: [{ id: 'o1', title: 'Pedir a reescrita' }] }])
  await start($, ['o1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['o1'])
  await fimDoTurno($)
  return { h, relogio }
}
// O usuário digita na filha em `at`: ela planeja e começa uma tarefa desse turno próprio.
const digitouNaFilha = (h: any, at: number) => {
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'Reescrever com filter-repo', 'iniciada')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'pode apagar e reescrever', at, own: true }],
  }
}

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('o turno que o usuário abriu na filha pendura no fim do pedido da mãe vigente quando ele digitou', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }] }])
  await start($, ['v1'])
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  const p = await painel($)
  const cartao = linha(p, PROPRIO)
  // No fim do pedido atual (sob a última tarefa de nível 1 dele), não no pedido antigo.
  const cs = cartoes(p, PROPRIO)
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Limpeza'])
  expect(cs[0]?.tarefas[0], emTexto(p)).toBe('Reescrever com filter-repo')
  expect(p.indexOf(cartao), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Pedido atual')))
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente, cabecalho.limites-de-linhas
test('com o turno próprio da filha trabalhando no pedido antigo, o pedido segue desenhado depois de três pedidos novos', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  digitouNaFilha(h, AGORA + 500)
  for (let i = 3; i <= 5; i++) {
    await relogio.advance(1000)
    await pedido($, `Pedido ${i}`)
    await plan($, [{ id: `P${i}`, title: `Plano ${i}`, children: [{ id: `f${i}`, title: `Folha ${i}` }] }])
    await start($, [`f${i}`])
    await done($, [`f${i}`])
    await fimDoTurno($)
  }
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Reescrita'), emTexto(p)).toBe(true)
  const cs = cartoes(p, PROPRIO)
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Reescrita'])
  expect(cs[0]?.tarefas[0], emTexto(p)).toBe('Reescrever com filter-repo')
  expect(cabecalho(p).chips.ativas, emTexto(p)).toBe(1)
})

// ---- Cartão vivo nunca some.

const VELHA = 'local_44444444-4444-4444-4444-444444444444'
// Pedido antigo com duas filhas: a viva (parada com tarefa aberta) e a velha (parada, tudo feito); depois,
// três pedidos novos, e o antigo sai de vista.
async function filhasNoPedidoAntigo($: any, on: any) {
  const { relogio } = fixar(on)
  const h = host(on, [
    { id: K1, nome: 'viva', painel: { tasks: [noTurno(1, '1', 'Ainda aberta', 'aberta')], turns: [turno(1, AGORA + 10)] } },
    { id: VELHA, nome: 'velha', painel: { tasks: [noTurno(1, '1', 'Já feita', 'feita')], turns: [turno(1, AGORA + 10)] } },
  ])
  await pedido($, 'Pedido antigo')
  await plan($, [{ id: 'O', title: 'Antigo', children: [{ id: 'o1', title: 'Abrir as filhas' }] }])
  await start($, ['o1'])
  await abrirSessao($)
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  h.filha(VELHA).rodando = false
  await aviso($)
  await done($, ['o1'])
  await fimDoTurno($)
  for (let i = 2; i <= 4; i++) {
    await relogio.advance(1000)
    await pedido($, `Pedido ${i}`)
    await plan($, [{ id: `P${i}`, title: `Plano ${i}`, children: [{ id: `f${i}`, title: `Folha ${i}` }] }])
    await start($, [`f${i}`])
    await done($, [`f${i}`])
    await fimDoTurno($)
  }
  await aviso($)
}

// Regra: sessoes.cartao-vivo-nunca-some
test('o cartão vivo de um pedido cortado é desenhado solto no fim, nas duas visões; o parado e concluído segue cortado', async ($: any, on: any) => {
  await filhasNoPedidoAntigo($, on)
  const p = await painel($)
  const solto = 'viva · do pedido "Pedido antigo"'
  expect(p.some(l => l.titulo === solto), emTexto(p)).toBe(true)
  // Solto no fim: depois do último pedido, e o pedido antigo não volta.
  expect(p.indexOf(linha(p, solto)), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Folha 4')))
  expect(p.some(l => l.titulo === 'Antigo'), emTexto(p)).toBe(false)
  expect(p.some(l => l.titulo === 'velha' || l.titulo.startsWith('velha ·')), emTexto(p)).toBe(false)
  esperarEstado(p, 'Ainda aberta', 'pendente')
})

// Regra: cabecalho.historico-guarda-o-que-saiu
test('o pedido que saiu do trabalho volta com o cartão da filha ao abrir "+N pedidos anteriores"', async ($: any, on: any) => {
  await abrir($, on, { rodando: false, painel: { tasks: [tarefa('1', 'Da filha', 'feita')] } })
  await done($, ['1', '2.1'])
  await fimDoTurno($)
  await pedido($, 'Pedido novo')
  await plan($, [{ id: 'N', title: 'Plano novo', children: [{ id: 'n1', title: 'Novo um' }] }])
  await start($, ['n1'])
  await aviso($)
  let p = await painel($)
  expect(p.some(l => l.titulo === 'Da filha'), emTexto(p)).toBe(false)
  p = await comHistorico($, 1)
  expect(cartoes(p, 'filha-um').length, emTexto(p)).toBe(1)
  esperarEstado(p, 'Da filha', 'concluida')
})

// ---- Cartão parado: a filha para com pendentes e a tarefa de origem fecha na mãe.
const deTurno = (turn: number, id: string, title: string, estado: 'aberta' | 'iniciada' | 'feita') => ({ ...tarefa(id, title, estado), turn })
const turnoDe = (id: number, at: number) => ({ id, title: `turno ${id}`, at })

// A filha fez duas e deixou `resto`; a mãe fecha a origem (`fechar`) e termina o turno.
async function parada($: any, on: any, resto: 'aberta' | 'iniciada' = 'aberta', fechar = true) {
  const r = fixar(on)
  responderEnvio(on)
  const tarefas = [deTurno(1, 'a', 'f1', 'feita'), deTurno(1, 'b', 'f2', 'feita'), deTurno(1, 'c', 'Colapso', resto)]
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: tarefas, turns: [turnoDe(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }, { id: '9', title: 'Outra' }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  await aviso($)
  if (fechar) await done($, ['1', '9'])
  await fimDoTurno($)
  return { h, tarefas, ...r }
}

// Regra: pedidos.rodada-descartada-nao-segura-a-visao
test('a rodada descartada não segura a visão no pedido seguinte', async ($: any, on: any) => {
  const { h, tarefas, relogio } = await parada($, on)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '2', title: 'Dois' }])
  await start($, ['2'])
  await relogio.advance(1000)
  await envio($, K1)
  await relogio.advance(1000)
  h.recebeu(K1, AGORA + 1500)
  h.filha(K1).rodando = true
  h.filha(K1).painel = { tasks: [...tarefas, deTurno(2, 'd', 'nova', 'feita')], turns: [turnoDe(1, AGORA + 10), turnoDe(2, AGORA + 1800)] }
  await aviso($)
  h.filha(K1).rodando = false
  await aviso($)
  await done($, ['2'])
  await fimDoTurno($)
  await pedido($, 'Pedido tres')
  await plan($, [{ id: '3', title: 'Tres' }])
  const p = await painel($)
  expect([p.some(l => l.titulo === 'Um'), cabecalho(p).total], emTexto(p)).toEqual([false, 1])
})

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem, sessoes.palavra-de-estado-do-cartao
test('filha parada só com pendentes e origem fechada: encerrada, fora da contagem, ✓ contam', async ($: any, on: any) => {
  await parada($, on)
  const p = await painel($)
  const c = cabecalho(p)
  esperarPalavra(p, 'filha-um', 'encerrada')
  esperarEstado(p, 'Colapso', 'pendente')
  expect([c.feitas, c.total, c.pct, c.chips.pendentes], emTexto(p)).toEqual([4, 4, 100, 0])
})

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('com a origem aberta, a filha segue parada e as pendentes contam', async ($: any, on: any) => {
  await parada($, on, 'aberta', false)
  const p = await painel($)
  esperarPalavra(p, 'filha-um', 'parada')
  expect(cabecalho(p).chips.pendentes, emTexto(p)).toBeGreaterThan(0)
})

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('com algo iniciado, a filha segue parada mesmo com a origem fechada', async ($: any, on: any) => {
  await parada($, on, 'iniciada')
  const p = await painel($)
  esperarPalavra(p, 'filha-um', 'parada')
  expect(cabecalho(p).total, emTexto(p)).toBe(5)
})

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('a filha que volta a trabalhar volta a contar', async ($: any, on: any) => {
  const { h } = await parada($, on)
  h.filha(K1).rodando = true
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.texto.includes('encerrada')), emTexto(p)).toBe(false)
  expect(cabecalho(p).total, emTexto(p)).toBe(5)
})

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('com mensagem da mãe na fila, a filha segue parada', async ($: any, on: any) => {
  await parada($, on)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '2', title: 'Dois' }])
  await start($, ['2'])
  await envio($, K1)
  const p = await painel($)
  expect(p.some(l => l.texto.includes('encerrada')), emTexto(p)).toBe(false)
})

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('a filha encerrada não segura a visão no pedido novo', async ($: any, on: any) => {
  await parada($, on)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '2', title: 'Dois' }])
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Um'), emTexto(p)).toBe(false)
  // O cartão fica, solto no fim; a pendente do chip é só "Dois", a do pedido novo.
  expect(p.some(l => l.texto.includes('filha-um') && l.texto.includes('encerrada')), emTexto(p)).toBe(true)
  expect(cabecalho(p).chips.pendentes, emTexto(p)).toBe(1)
})

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('a mãe é avisada de que a filha parou com pendentes', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [deTurno(1, 'c', 'Colapso', 'aberta')], turns: [turnoDe(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }, { id: '9', title: 'Outra' }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['1'])
  h.filha(K1).rodando = false
  const r = [await aviso($), await pedido($, 'Pedido dois')]
  expect(JSON.stringify(r)).toContain('1 pendentes')
})

// Regra: pedidos.id-reusado-segura-pedido-com-cartao-aberto
test('plan que reusa o id do nível 1 num pedido novo deixa o cartão com tarefa aberta sob a tarefa de origem, com o pedido antigo à vista', async ($: any, on: any) => {
  await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, [
    { id: 'A', title: 'Plano A de novo', children: [{ id: '1', title: 'Um de novo' }, { id: '2', title: 'Dois de novo', children: [{ id: '2.1', title: 'Dois.um de novo' }] }] },
    { id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê um' }] },
  ])
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.titulo.startsWith('filha-um · do pedido')), emTexto(p)).toBe(false)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(p.some(l => l.titulo === 'Pedido um'), emTexto(p)).toBe(true)
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(false)
  expect(p.indexOf(linha(p, 'Pedido um')), emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Pedido dois')))
  esperarEstado(p, 'Um de novo', 'pendente')
  esperarEstado(p, 'Plano A de novo', 'pendente')
})

// Regra: pedidos.id-reusado-segura-pedido-com-cartao-aberto
test('com carta: o id reusado num pedido novo deixa cartão e carta sob a tarefa de origem, e a carta fica cinza depois da entrega', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await envio($, K1)
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ ...A[0]!, title: 'Plano A novo' }])
  h.recebeu(K1, AGORA + 1500)
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.titulo.startsWith('filha-um · do pedido')), emTexto(p)).toBe(false)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(false)
  const cartas = p.filter(l => l.titulo.startsWith('Para ') && l.carta !== undefined)
  expect(cartas.map(l => l.carta), emTexto(p)).toEqual(['interrompida'])
})
