import { expect } from 'claude-code/testing'
import { test } from './kit/teste'
import { AGORA, EU, armazem, fixar, host, type Filha } from './kit/ambiente'
import { abrirSessao, aviso, done, esc, iniciarSessao, pedido, plan, start, type No } from './kit/cenario'
import { fimDoTurno } from './kit/cenario'
import { emTexto, esperarEstado, esperarPalavra, linha, painel, temBusto } from './kit/leitura'
import { responderEnvio } from './kit/ambiente'
import { responderDepois } from './kit/ambiente'
import { envio, ferramenta } from './kit/cenario'
import { cabecalho, cartaSob, cartoes, comHistorico, esperarCartaSob } from './kit/leitura'
import { SESSAO } from './kit/ambiente'
import { passos } from './kit/ambiente'

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

// Regra: sessoes.palavra-de-estado-do-cartao
test('a filha que espera a pessoa: o cartão diz "aguardando", segura a tarefa de origem e não gera o lembrete de fim de turno', async ($: any, on: any) => {
  const tarefas = [tarefa('1', 'Feita', 'feita'), tarefa('2', 'Começada', 'iniciada'), tarefa('3', 'Nunca')]
  const h = await abrir($, on, { painel: { tasks: tarefas } })
  h.filha(K1).rodando = false
  h.filha(K1).aguardando = true
  let r = await aviso($)
  let p = await painel($)
  esperarPalavra(p, 'filha-um', 'aguardando')
  for (const palavra of ['parada', 'encerrada', 'concluída', 'arquivada']) expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain(palavra)
  esperarEstado(p, 'Começada', 'andamento')
  esperarEstado(p, 'Nunca', 'pendente')
  esperarEstado(p, 'Um', 'andamento')
  expect(JSON.stringify(r)).not.toContain('terminou o turno')
  h.filha(K1).aguardando = false
  r = await aviso($)
  p = await painel($)
  esperarPalavra(p, 'filha-um', 'parada')
  esperarEstado(p, 'Começada', 'aguardando')
  expect(JSON.stringify(r)).toContain('terminou o turno')
})

// Regra: sessoes.filha-arquivada-interrompe, sessoes.palavra-de-estado-do-cartao
test('filha arquivada: o que ficou aberto fica interrompido, e o pai com filha concluída fica concluído', async ($: any, on: any) => {
  const pai = tarefa('P', 'Pai da filha', 'aberta', [tarefa('P/1', 'Feita', 'feita'), tarefa('P/2', 'Aberta')])
  await abrir($, on, { rodando: false, arquivada: true, painel: { tasks: [pai] } })
  const p = await painel($)
  esperarPalavra(p, 'filha-um', 'arquivada')
  esperarEstado(p, 'Aberta', 'interrompida')
  esperarEstado(p, 'Pai da filha', 'concluida')
})

// Regra: sessoes.arquivada-nao-e-relida
test('o arquivo de uma filha arquivada não é relido a cada leitura, e o cartão segue igual', async ($: any, on: any) => {
  const pai = tarefa('P', 'Pai da filha', 'aberta', [tarefa('P/1', 'Feita', 'feita'), tarefa('P/2', 'Aberta')])
  const h = await abrir($, on, { rodando: false, arquivada: true, painel: { tasks: [pai] } })
  const antes = await painel($)
  const n = h.leituras(K1)
  expect(n, 'a filha arquivada foi lida uma vez').toBeGreaterThan(0)
  await aviso($)
  await aviso($)
  expect(h.leituras(K1)).toBe(n)
  const depois = await painel($)
  expect(emTexto(depois)).toBe(emTexto(antes))
  esperarPalavra(depois, 'filha-um', 'arquivada')
  h.filha(K1).arquivada = false
  h.filha(K1).rodando = true
  await aviso($)
  expect(h.leituras(K1)).toBeGreaterThan(n)
  const viva = await painel($)
  expect(linha(viva, 'filha-um').texto, emTexto(viva)).not.toContain('arquivada')
})

// Regra: sessoes.publicado-corta-a-profundidade
test('o painel publicado leva três níveis de sessões abaixo desta e corta o resto', async ($: any, on: any) => {
  fixar(on)
  const grupo = (titulo: string) => [{ agent: '', label: '', tasks: [tarefa('1', titulo, 'iniciada')] }]
  const sessao = (id: string, children: any[]): any => ({ id, name: id, title: id, anchor: '1', running: true, archived: false, panel: { groups: grupo(`Tarefa ${id}`), waits: [], children } })
  const c4 = sessao('C4', [])
  const c3 = sessao('C3', [c4])
  const c2 = sessao('C2', [c3])
  const c1 = sessao('C1', [c2])
  const arquivo = { version: 1, waiting: false, waits: [], groups: grupo('Tarefa K1'), children: [c1] }
  const h = host(on, [{ id: K1, nome: 'K1', publicado: JSON.stringify(arquivo) }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const k1 = h.proprio().children[0]
  expect(k1.id).toBe(K1)
  const p1 = k1.panel.children[0]
  expect(p1.id).toBe('C1')
  expect(JSON.stringify(p1.panel.groups)).toContain('Tarefa C1')
  const p2 = p1.panel.children[0]
  expect(p2.id).toBe('C2')
  expect(JSON.stringify(p2.panel.groups)).toContain('Tarefa C2')
  expect(p2.panel.children).toEqual([])
  const p = await painel($)
  for (const nome of ['K1', 'C1', 'C2', 'C3']) expect(emTexto(p)).toContain(nome)
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

// Regra: envios.com-andamento-fica-sob-a-tarefa-em-andamento, sessoes.cartao-sob-a-tarefa-de-origem
test('com uma tarefa em andamento e um passo planejado depois, a sessão aberta fica sob a tarefa em andamento', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await relogio.advance(1000)
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'n', title: 'Novo' }] }])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um')[0]?.sob, emTexto(p)).toBe('Um')
  esperarEstado(p, 'Novo', 'pendente')
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

// Regra: sessoes.sessao-conta-uma-vez-no-chip
test('uma sessão rodando com uma rodada antiga deixada aberta conta uma vez em sessões ativas', async ($: any, on: any) => {
  const p = await duasRodadas($, on, [noTurno(1, '1', 'f1', 'feita'), noTurno(1, '1b', 'f1b', 'iniciada')])
  expect(cabecalho(p).chips.ativas, emTexto(p)).toBe(1)
  expect(cartoes(p, 'filha-um').length, emTexto(p)).toBe(2)
})

// Regra: sessoes.rodada-largada-diz-substituida
test('o cartão da rodada largada diz "substituída", com a filha rodando e parada; o da rodada atual segue como o que vale', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderEnvio(on)
  const f1 = [noTurno(1, '1', 'f1', 'feita'), noTurno(1, '1b', 'f1b', 'iniciada')]
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
  h.filha(K1).painel = { tasks: [...f1, noTurno(2, '2', 'f2', 'iniciada')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 1800)] }
  await aviso($)
  let p = await painel($)
  let cs = p.filter(l => l.sessao && l.titulo === 'filha-um')
  expect(cs.length, emTexto(p)).toBe(2)
  expect(cs[0]!.texto, emTexto(p)).toContain('substituída')
  expect(cs[1]!.texto, emTexto(p)).not.toContain('substituída')
  expect(cs[1]!.texto, emTexto(p)).not.toContain('parada')
  expect(cabecalho(p).chips.ativas, emTexto(p)).toBe(1)
  expect(cartoes(p, 'filha-um')[0]?.tarefas, emTexto(p)).toEqual(expect.arrayContaining(['f1', 'f1b']))
  h.filha(K1).rodando = false
  await aviso($)
  p = await painel($)
  cs = p.filter(l => l.sessao && l.titulo === 'filha-um')
  expect(cs[0]!.texto, emTexto(p)).toContain('substituída')
  expect(cs[0]!.texto, emTexto(p)).not.toContain('parada')
  expect(cs[1]!.texto, emTexto(p)).toContain('parada')
  expect(cabecalho(p).total, emTexto(p)).toBe(4)
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

// Regra: sessoes.filha-parada-com-esc-sem-pendente
test('a filha parada com Esc sem pendente sai da contagem, ✓ inclusive, e o cartão diz "parada"', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [noTurno(1, '1', 'Feita', 'feita'), noTurno(1, '2', 'Começada', 'iniciada')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  h.filha(K1).aborted = true
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Feita', 'concluida')
  esperarEstado(p, 'Começada', 'interrompida')
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([0, 3])
  expect(c.chips.interrompidas, emTexto(p)).toBe(0)
  // O x/y de "Um", de onde a filha foi aberta, só conta a própria "Um".
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('0/1')
  esperarPalavra(p, 'filha-um', 'parada')
  expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain('concluída')
})

// Regra: sessoes.rodada-descartada-fora-da-contagem, sessoes.filha-parada-pendentes-seguem-pendentes
test('a filha parada com Esc com concluídas, uma iniciada e pendentes: tudo desenhado, nada na conta da mãe', async ($: any, on: any) => {
  fixar(on)
  const tarefas = [noTurno(1, '1', 'F1', 'feita'), noTurno(1, '2', 'F2', 'feita'), noTurno(1, '3', 'Começada', 'iniciada'), noTurno(1, '4', 'P1', 'aberta'), noTurno(1, '5', 'P2', 'aberta')]
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: tarefas, turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  h.filha(K1).aborted = true
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'F1', 'concluida')
  esperarEstado(p, 'Começada', 'interrompida')
  esperarEstado(p, 'P1', 'pendente')
  esperarEstado(p, 'P2', 'pendente')
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([0, 3])
  // Só "Dois" e "Três", da mãe: as pendentes da filha ficam fora do chip.
  expect(c.chips.pendentes, emTexto(p)).toBe(2)
  expect(c.chips.interrompidas, emTexto(p)).toBe(0)
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('0/1')
  esperarPalavra(p, 'filha-um', 'parada')
})

// A filha parou "Parada" com Esc, tratou um aviso e nele iniciou "Outra"; o último turno dela terminou
// normalmente (o arquivo não diz `aborted`): a marca vai na tarefa.
// Regra: sessoes.filha-parada-com-esc-segue-descartada-ate-o-start
test('a filha parada com Esc segue rodada descartada depois de outro turno, até dar start na tarefa parada', async ($: any, on: any) => {
  fixar(on)
  const parada = { ...noTurno(1, '2', 'Parada', 'iniciada'), stopped: true, endedAt: AGORA - 500 }
  const tarefas = (p: any) => [noTurno(1, '1', 'Feita', 'feita'), p, noTurno(1, '3', 'Outra', 'iniciada')]
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: tarefas(parada), turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  // Trabalhando (o turno do aviso): a parada já é desenhada ✕ no cartão, fora da contagem dele.
  let p = await painel($)
  esperarEstado(p, 'Parada', 'interrompida')
  esperarEstado(p, 'Outra', 'andamento')
  expect(cabecalho(p).total, emTexto(p)).toBe(5)
  // Parada de novo, o turno terminado normalmente: a rodada segue descartada.
  h.filha(K1).rodando = false
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Feita', 'concluida')
  esperarEstado(p, 'Parada', 'interrompida')
  esperarEstado(p, 'Outra', 'aguardando')
  let c = cabecalho(p)
  expect([c.feitas, c.total, c.chips.interrompidas], emTexto(p)).toEqual([0, 3, 0])
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('0/1')
  esperarPalavra(p, 'filha-um', 'parada')
  // O start na tarefa parada tira a marca: a rodada volta a contar e as iniciadas aguardam.
  h.filha(K1).painel = { tasks: tarefas(noTurno(1, '2', 'Parada', 'iniciada')), turns: [turno(1, AGORA + 10)] }
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Parada', 'aguardando')
  esperarEstado(p, 'Outra', 'aguardando')
  c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 6])
})

// Três filhas paradas, cada uma com um turno só: K1 com um pai aberto (só pendente embaixo), K2 com
// uma folha iniciada, K3 com um pai aberto e parada com Esc. Nada delas está fora do desenho.
// Regra: sessoes.cartao-parado-sem-pedidos-anteriores-a-mais
test('o cartão da filha parada não mostra "+N pedidos anteriores" sem nada fora do desenho', async ($: any, on: any) => {
  fixar(on)
  const K2 = 'local_22222222-2222-2222-2222-222222222222'
  const K3 = 'local_33333333-3333-3333-3333-333333333333'
  const pai = (id: string, titulo: string, filho: string) => ({ ...tarefa(id, titulo, 'aberta', [tarefa(`${id}.1`, filho)]), turn: 1 })
  const h = host(on, [
    { id: K1, nome: 'filha-um', painel: { tasks: [pai('P', 'Pai um', 'Filho um')], turns: [turno(1, AGORA + 10)] } },
    { id: K2, nome: 'filha-dois', painel: { tasks: [noTurno(1, '1', 'Começada', 'iniciada')], turns: [turno(1, AGORA + 20)] } },
    { id: K3, nome: 'filha-tres', painel: { tasks: [pai('P', 'Pai três', 'Filho três')], turns: [turno(1, AGORA + 30)] } },
  ])
  await pedido($, 'Pedido um')
  await plan($, A3)
  for (const de of ['1', '2', '3']) {
    await start($, [de])
    await abrirSessao($)
  }
  await aviso($)
  for (const k of [K1, K2, K3]) h.filha(k).rodando = false
  h.filha(K3).aborted = true
  await aviso($)
  const p = await painel($)
  expect(p.filter(l => l.texto.includes('pedidos anteriores')).map(l => l.texto), emTexto(p)).toEqual([])
  expect(cartoes(p, 'filha-um').map(c => c.tarefas), emTexto(p)).toEqual([['Pai um', 'Filho um']])
  expect(cartoes(p, 'filha-dois').map(c => c.tarefas), emTexto(p)).toEqual([['Começada']])
  expect(cartoes(p, 'filha-tres').map(c => c.tarefas), emTexto(p)).toEqual([['Pai três', 'Filho três']])
  for (const nome of ['filha-um', 'filha-dois', 'filha-tres']) esperarPalavra(p, nome, 'parada')
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

// Regra: envios.carta-uma-vez-no-cartao-da-origem
test('a carta da filha com dois cartões aparece uma vez, no cartão da tarefa de origem', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderEnvio(on)
  const f1 = [noTurno(1, '1', 'f1', 'feita')]
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
  h.filha(K1).painel = { tasks: [...f1, noTurno(2, '2', 'f2', 'iniciada')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 1800)] }
  h.filha(K1).envios = [{ to: 'local_y', anchor: '2', at: AGORA + 1900 }]
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um').length, emTexto(p)).toBe(2)
  expect(p.filter(l => l.titulo.startsWith('Para y')).length, emTexto(p)).toBe(1)
  esperarCartaSob(p, 'f2', 'fila')
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(1)
})

// Regra: envios.esc-apos-entrega-imediata
test('no cartão da filha parada com Esc, a carta já entregue segue verde', async ($: any, on: any) => {
  const h = await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] }, envios: [{ to: 'local_y', anchor: '1', at: AGORA + 20, taken: true }] })
  h.filha(K1).rodando = false
  h.filha(K1).aborted = true
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Tarefa da filha', 'interrompida')
  esperarCartaSob(p, 'Tarefa da filha', 'entregue')
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
  // Sob a tarefa da mãe em andamento quando ele digitou ("Limpar refs"), não no pedido antigo.
  const cs = cartoes(p, PROPRIO)
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  expect(cs[0]?.tarefas[0], emTexto(p)).toBe('Reescrever com filter-repo')
  expect(p.indexOf(cartao), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Pedido atual')))
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('dois turnos digitados na filha com o mesmo pedido da mãe em curso ficam num cartão só, com uma linha de pedido por turno', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }] }])
  await start($, ['v1'])
  await relogio.advance(1000)
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'A2', 'feita'), noTurno(3, '3', 'A3', 'iniciada')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'primeiro pedido', at: AGORA + 1500, own: true }, { id: 3, title: 'segundo pedido', at: AGORA + 1800, own: true }],
  }
  await aviso($)
  // O turno concluído sai do trabalho atual e fica em "+1 pedidos anteriores" do cartão: aberto, ele volta.
  const p = await comHistorico($, 1)
  const cs = cartoes(p, PROPRIO)
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  expect(cs[0]?.tarefas.filter(t => !t.startsWith('+')).slice(0, 4), emTexto(p)).toEqual(['primeiro pedido', 'A2', 'segundo pedido', 'A3'])
  expect(cabecalho(p).chips.ativas, emTexto(p)).toBe(1)
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('turnos digitados com pedidos diferentes da mãe em curso ficam em cartões diferentes', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }] }])
  await start($, ['v1'])
  await relogio.advance(1000)
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'A2', 'iniciada'), noTurno(3, '3', 'A3', 'iniciada')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'primeiro pedido', at: AGORA + 500, own: true }, { id: 3, title: 'segundo pedido', at: AGORA + 1800, own: true }],
  }
  await aviso($)
  const p = await painel($)
  // O primeiro turno, com a mãe parada: sob a tarefa da filha, "Pedir a reescrita", do pedido vigente.
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Pedir a reescrita', 'Limpar refs'])
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('sem tarefa em andamento na mãe quando ele digitou, o cartão do pedido do usuário na filha fecha o pedido, depois das subtarefas', async ($: any, on: any) => {
  // A filha é de um pedido antigo: a tarefa dela não está no pedido vigente quando ele digita.
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }, { id: 'v2', title: 'Conferir refs' }] }])
  await start($, ['v1'])
  await done($, ['v1'])
  await start($, ['v2'])
  await done($, ['v2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpeza'])
  const i = p.indexOf(linha(p, PROPRIO))
  expect(i, emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Conferir refs')))
  expect(p[i + 1]?.titulo, emTexto(p)).toBe('Reescrever com filter-repo')
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
  // Com a mãe parada, sob a tarefa da filha no pedido vigente quando ele digitou.
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Pedir a reescrita'])
  expect(cs[0]?.tarefas[0], emTexto(p)).toBe('Reescrever com filter-repo')
  expect(cabecalho(p).chips.ativas, emTexto(p)).toBe(1)
})

// Regra: sessoes.rodada-da-frente-e-a-mais-recente
test('o turno digitado na filha depois da rodada da mãe é a rodada atual: conta no cabeçalho, parado ou entre um done e o start seguinte', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido antigo')
  await plan($, [{ id: 'O', title: 'Reescrita', children: [{ id: 'o1', title: 'Pedir a reescrita' }, { id: 'o2', title: 'Conferir a reescrita' }] }])
  await start($, ['o1'])
  await done($, ['o1'])
  // A filha abre da segunda, que fica aberta: o cartão do turno digitado vai para baixo dela.
  await start($, ['o2'])
  await abrirSessao($)
  await aviso($)
  await fimDoTurno($)
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'Feita na filha', 'feita'), noTurno(2, '3', 'Pendente na filha', 'aberta')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'pode reescrever', at: AGORA + 500, own: true }],
  }
  h.filha(K1).rodando = false
  await aviso($)
  let p = await painel($)
  let c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([3, 5])
  // A pendente da filha; "Conferir a reescrita", iniciada, aguarda.
  expect(c.chips.pendentes, emTexto(p)).toBe(1)
  esperarPalavra(p, PROPRIO, 'parada')
  h.filha(K1).rodando = true
  await aviso($)
  p = await painel($)
  c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([3, 5])
  expect(c.chips.ativas, emTexto(p)).toBe(1)
  esperarEstado(p, 'Reescrita', 'andamento')
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('o cartão do pedido do usuário na filha fica onde o primeiro turno digitado aconteceu, não onde o mais recente', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }, { id: 'v2', title: 'Conferir refs' }] }])
  await start($, ['v1'])
  await relogio.advance(1000)
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'A2', 'iniciada')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'primeiro pedido', at: AGORA + 1500, own: true }],
  }
  await aviso($)
  await done($, ['v1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'A2', 'feita'), noTurno(3, '3', 'A3', 'iniciada')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'primeiro pedido', at: AGORA + 1500, own: true }, { id: 3, title: 'segundo pedido', at: AGORA + 2500, own: true }],
  }
  await aviso($)
  const p = await comHistorico($, 1)
  const cs = cartoes(p, PROPRIO)
  // O primeiro turno foi digitado com "Limpar refs" em andamento; o segundo, com a mãe parada.
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  expect(cs[0]?.tarefas.filter(t => t === 'primeiro pedido' || t === 'segundo pedido'), emTexto(p)).toEqual(['primeiro pedido', 'segundo pedido'])
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('com várias tarefas em andamento na mãe, o cartão do pedido do usuário na filha fica sob a iniciada por último', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }, { id: 'v2', title: 'Conferir refs' }] }])
  await start($, ['v2'])
  await relogio.advance(500)
  await start($, ['v1'])
  await relogio.advance(500)
  digitouNaFilha(h, AGORA + 1800)
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Conferir refs', 'andamento')
  esperarEstado(p, 'Limpar refs', 'andamento')
  // A iniciada por último, embora seja a primeira na ordem do plano.
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('turno digitado na filha antes do primeiro plan da mãe e outro depois ficam num cartão só', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await abrirSessao($)
  await aviso($)
  await relogio.advance(500)
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'B2', 'iniciada')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'antes do plan', at: AGORA + 500, own: true }],
  }
  await aviso($)
  await relogio.advance(500)
  await plan($, [{ id: 'N', title: 'Plano N', children: [{ id: 'n1', title: 'Escrever o código' }, { id: 'n2', title: 'Rodar a bateria' }] }])
  await relogio.advance(500)
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'B2', 'iniciada'), noTurno(3, '3', 'B3', 'iniciada')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'antes do plan', at: AGORA + 500, own: true }, { id: 3, title: 'depois do plan', at: AGORA + 1500, own: true }],
  }
  await aviso($)
  // O turno mais antigo do cartão fica em "+1 pedidos anteriores": aberto, ele volta.
  const p = await comHistorico($, 1)
  const cs = cartoes(p, PROPRIO)
  expect(cs.length, emTexto(p)).toBe(1)
  expect(cs[0]?.tarefas.filter(t => t === 'antes do plan' || t === 'depois do plan'), emTexto(p)).toEqual(['antes do plan', 'depois do plan'])
  // Dentro do pedido, não solto no fim.
  expect(['Plano N', 'Escrever o código', 'Rodar a bateria'], emTexto(p)).toContain(cs[0]?.sob)
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('turno digitado publicado sem hora por versão antiga e outro com hora, no pedido de origem, ficam num cartão só', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await relogio.advance(1000)
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'C2', 'iniciada'), noTurno(3, '3', 'C3', 'iniciada')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'sem hora', own: true }, { id: 3, title: 'com hora', at: AGORA + 500, own: true }],
  }
  await aviso($)
  // O turno mais antigo do cartão fica em "+1 pedidos anteriores": aberto, ele volta.
  const p = await comHistorico($, 1)
  const cs = cartoes(p, PROPRIO)
  expect(cs.length, emTexto(p)).toBe(1)
  expect(cs[0]?.tarefas.filter(t => t === 'sem hora' || t === 'com hora'), emTexto(p)).toEqual(['sem hora', 'com hora'])
})

// A mãe abre a filha de "Pedir a reescrita" e termina o turno com ela iniciada (a filha com uma
// tarefa feita e uma pendente).
async function abrirEParar($: any, on: any) {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(1, '1b', 'Pendente da filha', 'aberta')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido antigo')
  await plan($, [{ id: 'O', title: 'Reescrita', children: [{ id: 'o1', title: 'Pedir a reescrita' }, { id: 'o2', title: 'Conferir a reescrita' }] }])
  await start($, ['o1'])
  await abrirSessao($)
  await aviso($)
  await fimDoTurno($)
  return { h, relogio }
}
const sobAOrigem = (p: any[]) => {
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Pedir a reescrita'])
  const i = p.indexOf(linha(p, PROPRIO))
  expect(i, emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Pedir a reescrita')))
  expect(i, emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Conferir a reescrita')))
}

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('com a mãe parada e a filha trabalhando sob a tarefa, o cartão do pedido do usuário na filha fica sob essa tarefa', async ($: any, on: any) => {
  const { h, relogio } = await abrirEParar($, on)
  let p = await painel($)
  esperarEstado(p, 'Pedir a reescrita', 'andamento')
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  sobAOrigem(await painel($))
  await start($, ['o1'])
  await aviso($)
  sobAOrigem(await painel($))
  await done($, ['o1'])
  await aviso($)
  p = await painel($)
  sobAOrigem(p)
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('com a mãe e a filha paradas, o cartão do pedido do usuário na filha fica sob a tarefa de onde ela foi aberta', async ($: any, on: any) => {
  const { h, relogio } = await abrirEParar($, on)
  h.filha(K1).rodando = false
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Pedir a reescrita', 'aguardando')
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  h.filha(K1).rodando = true
  await aviso($)
  sobAOrigem(await painel($))
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('a filha de um pedido antigo, com a mãe parada num pedido novo: o cartão fecha o pedido vigente', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }] }])
  await start($, ['v1'])
  await done($, ['v1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpeza'])
  expect(p.indexOf(linha(p, PROPRIO)), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Limpar refs')))
})

const KB = 'local_33333333-3333-3333-3333-333333333333'
const PROPRIO_A = 'filha-a · pedido do usuário na filha'
const digitouNaA = (h: any) => {
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Da filha a', 'feita'), noTurno(1, '1b', 'Pendente da filha a', 'aberta'), noTurno(2, '2', 'Pedido digitado na a', 'feita')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'pedido na a', at: AGORA + 1500, own: true }],
  }
}

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('a tarefa acesa por outra filha não leva o cartão do pedido digitado na filha parada', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [
    { id: K1, nome: 'filha-a', painel: { tasks: [noTurno(1, '1', 'Da filha a', 'feita'), noTurno(1, '1b', 'Pendente da filha a', 'aberta')], turns: [turno(1, AGORA + 10)] } },
    { id: KB, nome: 'filha-b', painel: { tasks: [tarefa('1', 'Da filha b', 'iniciada')] } },
  ])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await start($, ['2'])
  await abrirSessao($)
  await aviso($)
  await fimDoTurno($)
  h.filha(K1).rodando = false
  await aviso($)
  const p0 = await painel($)
  esperarEstado(p0, 'Dois', 'andamento')
  await relogio.advance(1000)
  digitouNaA(h)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO_A).map(c => c.sob), emTexto(p)).toEqual(['Um'])
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('com a filha fora do pedido vigente, a tarefa acesa por outra filha também não leva o cartão: ele fecha o pedido', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const b: any = { id: KB, nome: 'filha-b', listada: false, painel: { tasks: [tarefa('1', 'Da filha b', 'iniciada')] } }
  const h = host(on, [{ id: K1, nome: 'filha-a', painel: { tasks: [noTurno(1, '1', 'Da filha a', 'feita'), noTurno(1, '1b', 'Pendente da filha a', 'aberta')], turns: [turno(1, AGORA + 10)] } }, b])
  await pedido($, 'Pedido antigo')
  await plan($, [{ id: 'O', title: 'Reescrita', children: [{ id: 'o1', title: 'Pedir a reescrita' }] }])
  await start($, ['o1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['o1'])
  await fimDoTurno($)
  h.filha(K1).rodando = false
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }, { id: 'v2', title: 'Conferir refs' }] }])
  await start($, ['v1'])
  b.listada = true
  await abrirSessao($)
  await aviso($)
  await fimDoTurno($)
  const p0 = await painel($)
  esperarEstado(p0, 'Limpar refs', 'andamento')
  await relogio.advance(1000)
  digitouNaA(h)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO_A).map(c => c.sob), emTexto(p)).toEqual(['Limpeza'])
  expect(p.indexOf(linha(p, PROPRIO_A)), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Conferir refs')))
})

// O pedido novo da mãe, "Limpeza", com duas subtarefas, depois de abrir a filha no pedido antigo.
async function pedidoLimpeza($: any, relogio: any, segundo = false) {
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [
    { id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }, { id: 'v2', title: 'Conferir refs' }] },
    ...(segundo ? [{ id: 'W', title: 'Segundo bloco', children: [{ id: 'w1', title: 'Passo do segundo' }] }] : []),
  ])
}

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o cartão do pedido do usuário na filha que fechava o pedido não salta quando a mãe inicia de novo a tarefa que aguardava', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoLimpeza($, relogio)
  await start($, ['v1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  const confere = async () => {
    const p = await painel($)
    expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpeza'])
    expect(p.indexOf(linha(p, PROPRIO)), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Conferir refs')))
  }
  await confere()
  await relogio.advance(1000)
  await start($, ['v1'])
  await aviso($)
  await confere()
  await done($, ['v1'])
  await aviso($)
  await confere()
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o cartão do pedido do usuário na filha segue sob a tarefa onde estava quando a mãe a reabre com start', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoLimpeza($, relogio)
  await start($, ['v1'])
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  await done($, ['v1'])
  await relogio.advance(1000)
  await start($, ['v1'])
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Limpar refs', 'andamento')
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda, pedidos.replano-leva-o-cartao-ao-nivel-1
test('o replano que tira a tarefa onde estava o cartão do pedido do usuário na filha leva o cartão ao nível 1 que a continha', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoLimpeza($, relogio, true)
  await start($, ['v1'])
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  await plan($, [
    { id: 'V', title: 'Limpeza', children: [{ id: 'v2', title: 'Conferir refs' }] },
    { id: 'W', title: 'Segundo bloco', children: [{ id: 'w1', title: 'Passo do segundo' }] },
  ])
  await aviso($)
  p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpeza'])
  const i = p.indexOf(linha(p, PROPRIO))
  expect(i, emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Limpeza')))
  expect(i, emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Conferir refs')))
})

// O lugar guardado no store, lido por um processo novo (os testes rodam em ordem, no mesmo processo).
const LUGAR: Record<string, unknown> = {}

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o lugar do cartão do pedido do usuário na filha sobrevive a um processo novo', async ($: any, on: any) => {
  armazem(on, LUGAR)
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoLimpeza($, relogio)
  await start($, ['v1'])
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  await done($, ['v1'])
  await relogio.advance(1000)
  await start($, ['v1'])
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o lugar do cartão do pedido do usuário na filha sobrevive a um processo novo: o processo novo o lê do store', async ($: any, on: any) => {
  fixar(on)
  armazem(on, LUGAR)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  digitouNaFilha(h, AGORA + 1500)
  if (!Object.keys(LUGAR).some(k => k.startsWith('links:'))) throw new Error('rode o par inteiro: o primeiro não gravou')
  await iniciarSessao($)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
})

// A filha com uma tarefa em andamento e a neta com um turno digitado nela, publicada pela filha.
const netaDigitada = (extra: object = {}) => ({
  id: NETA,
  name: 'neta',
  title: 'neta',
  running: true,
  archived: false,
  anchor: 'o1',
  panel: {
    groups: [{ agent: '', label: '', tasks: [noTurno(2, 'n2', 'Neta digitada', 'iniciada')], turns: [turno(1, AGORA + 20), { id: 2, title: 'digitei na neta', at: AGORA + 500, own: true }] }],
    waits: [],
    children: [],
  },
  ...extra,
})
async function filhaComNeta($: any, on: any, neta: object) {
  fixar(on)
  const filha = { tasks: [noTurno(1, 'o1', 'Origem da neta', 'feita'), noTurno(1, 'o2', 'Outra da filha', 'feita'), noTurno(1, 'o3', 'Em andamento na filha', 'iniciada')], turns: [turno(1, AGORA + 10)], filhas: [neta] }
  host(on, [{ id: K1, nome: 'filha-um', painel: filha }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  return painel($)
}

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('a neta com o lugar guardado no arquivo publicado da filha fica onde a filha o guardou', async ($: any, on: any) => {
  const p = await filhaComNeta($, on, netaDigitada({ places: [{ at: AGORA + 500, anchor: 'o2' }] }))
  expect(cartoes(p, 'neta · pedido do usuário na filha').map(c => c.sob), emTexto(p)).toEqual(['Outra da filha'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('a neta com turno digitado publicada sem o lugar guardado segue desenhada pelo relógio das tarefas da filha', async ($: any, on: any) => {
  const p = await filhaComNeta($, on, netaDigitada())
  expect(cartoes(p, 'neta · pedido do usuário na filha').map(c => c.sob), emTexto(p)).toEqual(['Em andamento na filha'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('a neta com dois turnos digitados no mesmo pedido da filha, publicada só com o segundo, fica onde a filha guardou', async ($: any, on: any) => {
  const neta = netaDigitada({ places: [{ at: AGORA + 500, anchor: 'o2' }] }) as any
  neta.panel.groups[0].tasks = [noTurno(3, 'n3', 'Neta de novo', 'iniciada')]
  neta.panel.groups[0].turns = [turno(1, AGORA + 20), { id: 3, title: 'digitei de novo na neta', at: AGORA + 800, own: true }]
  const p = await filhaComNeta($, on, neta)
  expect(cartoes(p, 'neta · pedido do usuário na filha').map(c => c.sob), emTexto(p)).toEqual(['Outra da filha'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o lugar guardado numa tarefa que não existe mais não vale: a neta fica no lugar derivado', async ($: any, on: any) => {
  const p = await filhaComNeta($, on, netaDigitada({ places: [{ at: AGORA + 500, anchor: 'sumiu' }] }))
  expect(cartoes(p, 'neta · pedido do usuário na filha').map(c => c.sob), emTexto(p)).toEqual(['Em andamento na filha'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o cartão que fecha o pedido segue nele quando o último nível 1 foi planejado depois de ele digitar e reusa o id de um nível 1 antigo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, [
    { id: '1', title: 'Primeiro antigo', children: [{ id: '1a', title: 'Abrir a filha' }] },
    { id: '2', title: 'Segundo antigo', children: [{ id: '2a', title: 'Passo antigo' }] },
  ])
  await start($, ['1a'])
  await abrirSessao($)
  await aviso($)
  await done($, ['1a'])
  await start($, ['2a'])
  await done($, ['2a'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '1', title: 'Primeiro novo', children: [{ id: '1b', title: 'Folha nova' }] }])
  await start($, ['1b'])
  await done($, ['1b'])
  await fimDoTurno($)
  await relogio.advance(1000)
  // O aviso do app não abre pedido: o nível 1 "2" novo entra no pedido dois, planejado depois do turno digitado.
  await aviso($)
  await plan($, [{ id: '2', title: 'Segundo novo', children: [{ id: '2b', title: 'Passo novo' }] }])
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Segundo novo'])
  expect(p.indexOf(linha(p, PROPRIO)), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Passo novo')))
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('vinte e um cartões de pedido digitado na filha: nenhum lugar sai e a leitura sem novidade não regrava', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  const tarefasDigitadas: any[] = [noTurno(1, '1', 'Reescrever autoria', 'feita')]
  const turnosDigitados: any[] = [turno(1, AGORA + 10)]
  for (let i = 1; i <= 21; i++) {
    if (i > 1) await relogio.advance(1000)
    await pedido($, `Pedido ${i}`)
    await plan($, [{ id: `Q${i}`, title: `Bloco ${i}`, children: [{ id: `q${i}`, title: `Folha ${i}` }] }])
    await start($, [`q${i}`])
    if (i === 1) {
      await abrirSessao($)
      await aviso($)
      // Parada, com tudo feito: não segura os pedidos antigos à vista.
      h.filha(K1).rodando = false
    }
    await done($, [`q${i}`])
    await fimDoTurno($)
    tarefasDigitadas.push(noTurno(i + 1, `d${i}`, `Digitada ${i}`, 'feita'))
    turnosDigitados.push({ id: i + 1, title: `digitei ${i}`, at: AGORA + 1000 * (i - 1) + 500, own: true })
  }
  h.filha(K1).painel = { tasks: tarefasDigitadas, turns: turnosDigitados }
  await aviso($)
  const lugaresDe = () => (h.proprio()?.children ?? []).find((c: any) => c.id === K1)?.places ?? []
  const antes = lugaresDe()
  const p0 = await painel($)
  expect(antes.length, JSON.stringify(antes)).toBe(21)
  await aviso($)
  await aviso($)
  expect(lugaresDe(), JSON.stringify(lugaresDe())).toEqual(antes)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(cartoes(p0, PROPRIO).map(c => c.sob))
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('outra mensagem da mãe à filha não tira do lugar o cartão do pedido digitado nela', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderEnvio(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido antigo')
  await plan($, [{ id: 'O', title: 'Reescrita', children: [{ id: 'o1', title: 'Pedir a reescrita' }, { id: 'o2', title: 'Conferir a reescrita' }] }])
  await start($, ['o1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['o1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Pedir a reescrita'])
  await relogio.advance(1000)
  await aviso($)
  await start($, ['o2'])
  await envio($, K1)
  await aviso($)
  p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Pedir a reescrita'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o pedido novo que reusa o id do nível 1 não puxa o cartão que fechava o pedido antigo', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido B')
  await plan($, [{ id: '1', title: 'Bloco B', children: [{ id: 'b1', title: 'Passo B' }] }])
  await start($, ['b1'])
  await done($, ['b1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Bloco B'])
  await relogio.advance(1000)
  await pedido($, 'Pedido C')
  await plan($, [{ id: '1', title: 'Bloco C', children: [{ id: 'c1', title: 'Passo C' }] }])
  await aviso($)
  p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Bloco B'])
  expect(p.indexOf(linha(p, PROPRIO)), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Passo B')))
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('com dois starts da mãe no mesmo instante, o cartão do pedido do usuário na filha fica sob a iniciada por último', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }, { id: 'v2', title: 'Conferir refs' }] }])
  await start($, ['v2'])
  await start($, ['v1'])
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Conferir refs', 'andamento')
  esperarEstado(p, 'Limpar refs', 'andamento')
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
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

// Regra: sessoes.palavra-de-estado-do-cartao, sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('a filha que espera a pessoa só com pendentes e a origem fechada segue "aguardando", contando', async ($: any, on: any) => {
  fixar(on)
  responderEnvio(on)
  const tarefas = [deTurno(1, 'a', 'f1', 'feita'), deTurno(1, 'b', 'f2', 'feita'), deTurno(1, 'c', 'Colapso', 'aberta')]
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: tarefas, turns: [turnoDe(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }, { id: '9', title: 'Outra' }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  h.filha(K1).aguardando = true
  await aviso($)
  await done($, ['1', '9'])
  await fimDoTurno($)
  let p = await painel($)
  esperarPalavra(p, 'filha-um', 'aguardando')
  expect(p.filter(l => l.texto.includes('encerrada')).map(l => l.titulo), emTexto(p)).toEqual([])
  esperarEstado(p, 'Colapso', 'pendente')
  esperarEstado(p, 'Um', 'andamento')
  expect([cabecalho(p).total, cabecalho(p).chips.pendentes], emTexto(p)).toEqual([5, 1])
  h.filha(K1).aguardando = false
  await aviso($)
  p = await painel($)
  esperarPalavra(p, 'filha-um', 'encerrada')
  expect(cabecalho(p).total, emTexto(p)).toBe(4)
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

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('a filha para primeiro com pendentes: o lembrete diz quantas, e o done que fecha a origem avisa que saíram da contagem', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [deTurno(1, 'c', 'Colapso', 'aberta')], turns: [turnoDe(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }, { id: '9', title: 'Outra' }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  const lembrete = JSON.stringify(await aviso($))
  expect(lembrete).toContain('terminou o turno')
  expect(lembrete).toContain('1 pendentes')
  const r = await done($, ['1'])
  expect(r.texto).toContain('Avisos')
  expect(r.texto).toContain('1 pendentes')
  expect(r.texto).toContain('saíram da contagem')
})

// Regra: sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('o done que fecha a origem de uma filha sem pendentes não avisa', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [deTurno(1, 'c', 'Colapso', 'feita')], turns: [turnoDe(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }, { id: '9', title: 'Outra' }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  await aviso($)
  const r = await done($, ['1'])
  expect(r.texto).not.toContain('pendentes')
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

// Regra: pedidos.id-reusado-segura-pedido-com-sessao-viva
test('plan que reusa o id do nível 1 num pedido novo deixa sob a tarefa de origem o cartão da sessão trabalhando sem tarefa própria, com o pedido antigo à vista', async ($: any, on: any) => {
  await abrir($, on, {})
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'A', title: 'Plano A de novo', children: [{ id: '1', title: 'Um de novo' }] }])
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.titulo.startsWith('filha-um · do pedido')), emTexto(p)).toBe(false)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(false)
  expect(p.indexOf(linha(p, 'Pedido um')), emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Pedido dois')))
  esperarEstado(p, 'Um de novo', 'pendente')
  esperarEstado(p, 'Plano A de novo', 'pendente')
})

// Regra: pedidos.id-reusado-segura-pedido-com-sessao-viva
test('só a carta na fila, com a sessão parada: o id reusado num pedido novo deixa o pedido antigo à vista, com a carta sob a tarefa de origem', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, K1)
  await aviso($)
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'A', title: 'Plano A de novo', children: [{ id: '1', title: 'Um de novo' }] }])
  await aviso($)
  const p = await painel($)
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(false)
  expect(p.indexOf(linha(p, 'Pedido um')), emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Pedido dois')))
  expect(cartaSob(p, 'Um'), emTexto(p)).not.toBe(undefined)
  esperarEstado(p, 'Um de novo', 'pendente')
})

// Regra: pedidos.id-reusado-segura-pedido-com-sessao-viva
test('depois que a sessão para e a carta é entregue, o pedido seguinte leva o pedido de id reusado para "+N pedidos anteriores"', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um' }])
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
  await plan($, [{ id: 'A', title: 'Plano A de novo', children: [{ id: '1', title: 'Um de novo' }] }])
  await start($, ['1'])
  await done($, ['1'])
  let p = await painel($)
  expect(p.some(l => l.titulo === 'Pedido um'), emTexto(p)).toBe(true)
  h.recebeu(K1, AGORA + 1500)
  h.filha(K1).rodando = false
  await aviso($)
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido três')
  await plan($, [{ id: 'C', title: 'Plano C', children: [{ id: 'c1', title: 'Cê um' }] }])
  p = await painel($)
  expect(p.some(l => l.titulo === 'Pedido um' || l.titulo === 'Pedido dois' || l.sessao === true), emTexto(p)).toBe(false)
  expect(p.some(l => l.titulo === '+2 pedidos anteriores'), emTexto(p)).toBe(true)
  esperarEstado(p, 'Cê um', 'pendente')
})

// O turno 1 como a filha o publica quando o texto do start_session chega como prompt próprio
// (os arquivos publicados reais trazem a marca).
const abertura = (at: number) => ({ id: 1, title: 'Texto do start_session', at, own: true })

// Regra: sessoes.turno-de-abertura-da-filha-sob-a-origem
test('o turno de abertura que a filha publica como próprio fica sob a tarefa de origem, sem "pedido do usuário na filha"', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'iniciada')], turns: [abertura(AGORA + 10)] } }])
  await pedido($, 'Pedido antigo')
  await plan($, [{ id: 'O', title: 'Reescrita', children: [{ id: 'o1', title: 'Pedir a reescrita' }, { id: 'o2', title: 'Conferir a reescrita' }] }])
  await start($, ['o1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.titulo === PROPRIO), emTexto(p)).toBe(false)
  const cs = cartoes(p, 'governanca')
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Pedir a reescrita'])
  expect(cs[0]?.tarefas, emTexto(p)).toEqual(['Reescrever autoria'])
})

// Regra: sessoes.turno-de-abertura-da-filha-sob-a-origem, sessoes.turno-proprio-da-filha-no-pedido-vigente
test('o turno 1 próprio que começa bem depois da abertura (a filha limpa com /clear) segue como pedido do usuário na filha', async ($: any, on: any) => {
  const { h } = await abrirNoPedidoAntigo($, on)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }] }])
  await start($, ['v1'])
  h.filha(K1).painel = { tasks: [noTurno(1, '1', 'Reescrever com filter-repo', 'iniciada')], turns: [{ id: 1, title: 'pode apagar e reescrever', at: AGORA + 20 * 60_000, own: true }] }
  await aviso($)
  const p = await painel($)
  const cs = cartoes(p, PROPRIO)
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  expect(cs[0]?.tarefas[0], emTexto(p)).toBe('Reescrever com filter-repo')
})


// Regra: sessoes.publicado-enxuto
test('o arquivo publicado não leva a cópia antiga das tarefas', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const f = h.proprio()
  expect(Array.isArray(f?.groups), JSON.stringify(f)).toBe(true)
  expect(f?.tasks, JSON.stringify(f)).toBeUndefined()
})

// A filha com dois pedidos: o primeiro concluído, o segundo em andamento (o trabalho dela).
const doisPedidos = { tasks: [noTurno(1, 'v', 'Velha', 'feita'), noTurno(2, 'n', 'Nova', 'iniciada')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 20)], work: ['n'] }

// Regra: sessoes.publicado-enxuto
test('a filha vai ao arquivo publicado cortada ao trabalho atual dela', async ($: any, on: any) => {
  const h = await abrir($, on, { painel: doisPedidos })
  const f = h.proprio()
  const main = f.children[0].panel.groups.find((g: any) => g.agent === '')
  expect(main.tasks.map((t: any) => t.id), JSON.stringify(main)).toEqual(['n'])
  expect(main.turns.map((u: any) => u.id), JSON.stringify(main)).toEqual([2])
  expect(main.whole, JSON.stringify(main)).toBeUndefined()
  // O state segue com a filha inteira: o cartão dela aqui mostra o pedido anterior.
  const p = await painel($)
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(true)
})

const NETA = 'local_22222222-2222-2222-2222-222222222222'
// A neta como a filha a publica (já cortada ao trabalho atual dela).
const neta = (extra: object = {}) => ({
  id: NETA,
  name: 'neta',
  title: 'neta',
  running: true,
  archived: false,
  panel: { groups: [{ agent: '', label: '', tasks: [noTurno(2, 'm', 'Neta nova', 'iniciada')], turns: [turno(2, AGORA + 20)] }], waits: [], children: [], work: ['m'] },
  ...extra,
})

// Regra: sessoes.publicado-enxuto
test('na avó, o cartão da neta não tem "+N pedidos anteriores"', async ($: any, on: any) => {
  await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')], filhas: [neta({ anchor: '1' })] } })
  const p = await painel($)
  expect(p.filter(l => l.texto.includes('pedidos anteriores')).map(l => l.texto), emTexto(p)).toEqual([])
  expect(cartoes(p, 'neta').flatMap(c => c.tarefas), emTexto(p)).toContain('Neta nova')
})

// Regra: sessoes.publicado-enxuto
test('uma rodada antiga da neta, de pedido cortado, não quebra o cartão', async ($: any, on: any) => {
  const filha = { tasks: [noTurno(2, 'n', 'Nova', 'iniciada')], turns: [turno(2, AGORA + 20)], work: ['n'] }
  await abrir($, on, { painel: { ...filha, filhas: [neta({ anchor: 'n', lastAnchor: 'v', rounds: [{ at: AGORA - 500, anchor: 'v' }, { at: AGORA - 100, anchor: 'n' }] })] } })
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Velha'), emTexto(p)).toBe(false)
  expect(cartoes(p, 'neta').flatMap(c => c.tarefas), emTexto(p)).toContain('Neta nova')
})

// Uma neta como a filha a publica, com o grupo principal dela.
const netaCom = (tasks: any[], extra: object = {}) => ({
  id: NETA,
  name: 'neta',
  title: 'neta',
  running: true,
  archived: false,
  panel: { groups: [{ agent: '', label: '', tasks, turns: [turno(1, AGORA + 20)] }], waits: [], children: [] },
  ...extra,
})

// Regra: sessoes.regras-de-cartao-valem-para-netas
test('a neta parada só com pendentes e origem fechada fica "encerrada" e sai da contagem da orquestradora', async ($: any, on: any) => {
  fixar(on)
  const filhas = [netaCom([noTurno(1, 'n1', 'Neta feita', 'feita'), noTurno(1, 'n2', 'Neta pendente', 'aberta')], { running: false, anchor: 'o' })]
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [noTurno(1, 'o', 'Origem da neta', 'feita')], turns: [turno(1, AGORA + 10)], filhas } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  esperarPalavra(p, 'neta', 'encerrada')
  esperarEstado(p, 'Neta pendente', 'pendente')
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([2, 5])
})

// Regra: sessoes.regras-de-cartao-valem-para-netas
test('a neta que trabalha sob um pedido da filha fora do trabalho aparece solta no fim do cartão da filha', async ($: any, on: any) => {
  fixar(on)
  const filhas = [netaCom([noTurno(1, 'n1', 'Neta trabalhando', 'iniciada')], { anchor: 'a1' })]
  host(on, [
    {
      id: K1,
      nome: 'filha-um',
      painel: { tasks: [noTurno(1, 'a1', 'Antiga', 'feita'), noTurno(2, 'a2', 'Atual', 'iniciada')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 30)], work: ['a2'], filhas },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  const i = p.findIndex(l => l.sessao === true && l.titulo.startsWith('neta'))
  expect(i, emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Atual')))
  expect(i, emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Dois')))
  esperarEstado(p, 'Neta trabalhando', 'andamento')
})

// Regra: sessoes.regras-de-cartao-valem-para-netas
test('a filha parada com Esc com carta na fila mostra a tarefa do envio aguardando', async ($: any, on: any) => {
  // Vista rodando primeiro (deixa de ser recém-aberta); depois para com Esc.
  const h = await abrir($, on, {
    painel: { tasks: [{ ...tarefa('1', 'Avisar', 'iniciada'), stopped: true }] },
    envios: [{ to: 'local_z', anchor: '1', at: AGORA }],
  })
  h.filha(K1).rodando = false
  h.filha(K1).aborted = true
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Avisar', 'aguardando')
})

// Regra: turnos.esc-com-trabalho-delegado-vivo
test('no Esc, a tarefa com a filha trabalhando embaixo segue em andamento; quando a filha para, fica interrompida até o start', async ($: any, on: any) => {
  const h = await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  await esc($)
  let p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  expect(cabecalho(p).chips.interrompidas, emTexto(p)).toBe(0)
  expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain('parada')
  h.filha(K1).rodando = false
  h.filha(K1).painel = { tasks: [tarefa('1', 'Tarefa da filha', 'feita')] }
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Um', 'interrompida')
  await pedido($, 'segue')
  await start($, ['1'])
  p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
})

// Regra: turnos.esc-com-trabalho-delegado-vivo
test('no cartão de uma filha parada com Esc, a tarefa com neta trabalhando segue em andamento', async ($: any, on: any) => {
  const filhas = [netaCom([noTurno(1, 'n1', 'Neta trabalhando', 'iniciada')], { anchor: 'd' })]
  const h = await abrir($, on, { painel: { tasks: [{ ...tarefa('d', 'Delegada', 'iniciada'), stopped: true }], filhas } })
  h.filha(K1).rodando = false
  h.filha(K1).aborted = true
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Delegada', 'andamento')
})

// Regra: sessoes.cartao-parado-mostra-o-tempo-do-turno
test('no cartão da filha parada, a tarefa que aguardava mostra o tempo até o fim do turno dela', async ($: any, on: any) => {
  const longa = { id: '1', short: '1', title: 'Longa', status: 'open', startedAt: AGORA - 1_200_000, endedAt: AGORA - 1000, children: [] }
  const curta = { id: '2', short: '2', title: 'Curta', status: 'done', startedAt: AGORA - 1_200_000, endedAt: AGORA - 900_000, children: [] }
  const h = await abrir($, on, { painel: { tasks: [longa, curta] } })
  h.filha(K1).rodando = false
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Longa', 'aguardando')
  expect(linha(p, 'Longa').texto, emTexto(p)).toContain('19:59')
})

// Regra: sessoes.palavra-de-estado-do-cartao
test('a filha cujo turno morreu por erro: o cartão diz "falhou", a tarefa fica ✕ "falhou" e a rodada sai da contagem', async ($: any, on: any) => {
  fixar(on)
  const comecada = { ...noTurno(1, '2', 'Começada', 'iniciada'), stopped: true, failed: true, endedAt: AGORA - 500 }
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [noTurno(1, '1', 'Feita', 'feita'), comecada], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  h.filha(K1).aborted = true
  await aviso($)
  const p = await painel($)
  esperarPalavra(p, 'filha-um', 'falhou')
  expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain('parada')
  esperarEstado(p, 'Começada', 'interrompida')
  expect(linha(p, 'Começada').texto, emTexto(p)).toContain('falhou')
  expect([cabecalho(p).feitas, cabecalho(p).total], emTexto(p)).toEqual([0, 3])
})

// Regra: sessoes.leitura-das-filhas-uma-por-vez
test('leituras pedidas ao mesmo tempo rodam uma de cada vez', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um' }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const antes = h.pedidosAoApp().filter(t => t === 'list_sessions').length
  await Promise.all([aviso($), aviso($), aviso($)])
  expect(h.pedidosAoApp().filter(t => t === 'list_sessions').length - antes).toBeLessThanOrEqual(2)
})

// O roteiro dos cartões abertos antes do plan: pedido um todo concluído, pedido dois e a sessão aberta nele.
async function antesDoPlan($: any, on: any, nome: string) {
  const { relogio } = fixar(on)
  host(on, [{ id: K1, nome, rodando: false, painel: { tasks: [tarefa('1', 'Tarefa da filha', 'feita')] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }])
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await abrirSessao($)
  await aviso($)
}

// Regra: sessoes.aberta-antes-do-plan-e-adotada
test('a sessão aberta antes do plan do pedido fica solta no fim, mesmo concluída, e o plan a adota pelo nome', async ($: any, on: any) => {
  await antesDoPlan($, on, 'pesquisa-web')
  let p = await painel($)
  const antes = cartoes(p, 'pesquisa-web')
  expect(antes.length, emTexto(p)).toBe(1)
  for (const t of ['Um', 'Dois', 'Três']) expect(antes[0]!.sob, emTexto(p)).not.toBe(t)
  const ultimoPedido = Math.max(...p.map((l, i) => (l.titulo.startsWith('Pedido ') ? i : -1)))
  expect(p.indexOf(linha(p, 'pesquisa-web')), emTexto(p)).toBeGreaterThan(ultimoPedido)
  await plan($, [{ id: 'N', title: 'Plano N', children: [{ id: 'n1', title: 'Implementação' }, { id: 'n2', title: 'Pesquisa web: changelog' }] }])
  await aviso($)
  p = await painel($)
  expect(cartoes(p, 'pesquisa-web').map(c => c.sob), emTexto(p)).toEqual(['Pesquisa web: changelog'])
})

// Regra: sessoes.aberta-antes-do-plan-e-adotada
test('sem nome que case, a sessão aberta antes do plan vai à primeira pendente do plan', async ($: any, on: any) => {
  await antesDoPlan($, on, 'filha-um')
  await plan($, [{ id: 'N', title: 'Plano N', children: [{ id: 'n1', title: 'Escrever o código' }, { id: 'n2', title: 'Rodar a bateria' }] }])
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Escrever o código'])
})

// ---- Tempo da tarefa concluída com a filha trabalhando embaixo.

// Regra: sessoes.tempo-da-tarefa-concluida-com-filha
test('a tarefa concluída com a filha trabalhando embaixo mostra só o tempo próprio, que não corre nem regride', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await relogio.advance(3000)
  await done($, ['1'])
  await relogio.advance(600_000)
  await aviso($)
  let p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('0:03')
  expect(linha(p, 'Um').texto, emTexto(p)).not.toContain('10:0')
  h.filha(K1).rodando = false
  h.filha(K1).painel = { tasks: [tarefa('1', 'Tarefa da filha', 'feita')] }
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('0:03')
})

// Regra: sessoes.tempo-da-tarefa-concluida-com-filha
test('o pedido com tudo concluído e a filha trabalhando embaixo mostra o tempo das tarefas dele, parado', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await relogio.advance(3000)
  await done($, ['1'])
  await relogio.advance(600_000)
  await aviso($)
  const p = await painel($)
  for (const t of ['Plano A', 'Pedido um']) {
    expect(linha(p, t).texto, emTexto(p)).toContain('0:03')
    expect(linha(p, t).texto, emTexto(p)).not.toContain('10:0')
  }
})

// O arquivo de uma filha depois de um /clear: o grupo principal vazio (ou com o que veio depois) e,
// em `past`, as cinco tarefas que ela tinha feito antes.
const limpa = (depois: { tasks: any[]; turns?: any[] } = { tasks: [] }) =>
  JSON.stringify({
    version: 1,
    waiting: false,
    waits: [],
    children: [],
    groups: [
      {
        agent: '',
        label: '',
        ...depois,
        past: [{ at: AGORA + 5000, tasks: ['p1', 'p2', 'p3', 'p4', 'p5'].map(id => noTurno(1, id, id, 'feita')), turns: [turno(1, AGORA + 10)] }],
      },
    ],
  })

// Regra: sessoes.clear-na-filha-mantem-o-historico
test('depois do /clear na filha, o cartão dela na mãe mantém as tarefas feitas e a contagem', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', rodando: false, publicado: limpa() }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um').map(k => ({ sob: k.sob, tarefas: k.tarefas.filter(t => t !== 'turno 1') })), emTexto(p)).toEqual([{ sob: 'Um', tarefas: ['p1', 'p2', 'p3', 'p4', 'p5'] }])
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('5/6')
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([5, 8])
})

// Regra: sessoes.clear-na-filha-mantem-o-historico
test('o trabalho da filha depois do /clear aparece num cartão novo, e o histórico segue no dele', async ($: any, on: any) => {
  fixar(on)
  const depois = { tasks: [noTurno(1, 'n1', 'n1', 'iniciada')], turns: [{ id: 1, title: 'pedido novo', at: AGORA + 20 * 60_000, own: true }] }
  host(on, [{ id: K1, nome: 'filha-um', rodando: false, publicado: limpa(depois) }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  const nomes = p.filter(l => l.sessao).map(l => l.titulo)
  const meus = nomes.filter(n => n.startsWith('filha-um'))
  expect(meus.length, emTexto(p)).toBe(2)
  const todos = meus.flatMap(n => cartoes(p, n))
  const sem = (l: string[]) => l.filter(t => t !== 'turno 1' && t !== 'pedido novo').join()
  expect(todos.some(k => k.sob === 'Um' && sem(k.tarefas) === 'p1,p2,p3,p4,p5'), emTexto(p)).toBe(true)
  const novo = p.find(l => l.sessao && l.titulo.startsWith('filha-um') && l.titulo !== 'filha-um')
  expect(novo !== undefined && p[p.indexOf(novo) + 1]?.titulo === 'n1', emTexto(p)).toBe(true)
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([5, 9])
})

// A filha arquivada do pedido um, e o pedido novo que tira esse pedido do trabalho.
async function arquivadaAntiga($: any, on: any) {
  const pai = tarefa('P', 'Pai da filha', 'aberta', [tarefa('P/1', 'Feita', 'feita'), tarefa('P/2', 'Aberta')])
  const h = await abrir($, on, { rodando: false, arquivada: true, painel: { tasks: [pai] } })
  const antes = await painel($)
  expect(antes.some(l => l.titulo === 'Feita') && antes.some(l => l.titulo === 'Aberta'), emTexto(antes)).toBe(true)
  await done($, ['1', '2.1'])
  await fimDoTurno($)
  await pedido($, 'Pedido novo')
  await plan($, [{ id: 'N', title: 'N', children: [{ id: 'n1', title: 'n1' }] }])
  await start($, ['n1'])
  await aviso($)
  return h
}

// Regra: sessoes.arquivada-antiga-vira-linha
test('a filha arquivada cujo pedido saiu do trabalho vira uma linha com nome e contagem', async ($: any, on: any) => {
  const h = await arquivadaAntiga($, on)
  const p = await comHistorico($, 1)
  const l = linha(p, 'filha-um')
  expect(l.sessao, emTexto(p)).toBe(true)
  expect(l.texto, emTexto(p)).toContain('arquivada')
  expect(l.texto, emTexto(p)).toContain('1/1')
  for (const t of ['Feita', 'Aberta', 'Pai da filha']) expect(p.some(x => x.titulo === t), emTexto(p)).toBe(false)
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('2/2')
  const pub = (h.proprio()?.children ?? [])[0]
  expect(pub?.panel, JSON.stringify(pub)).toBeUndefined()
  expect(pub?.summary, JSON.stringify(pub)).toBeDefined()
  const n = h.leituras(K1)
  await aviso($)
  await aviso($)
  expect(h.leituras(K1), 'a filha resumida não é relida').toBe(n)
})

// Regra: sessoes.arquivada-antiga-vira-linha
test('desarquivada, a filha resumida volta ao cartão inteiro', async ($: any, on: any) => {
  const h = await arquivadaAntiga($, on)
  h.filha(K1).arquivada = false
  await aviso($)
  const p = await comHistorico($, 1)
  expect(p.some(x => x.titulo === 'Feita'), emTexto(p)).toBe(true)
})

// Duas tarefas em andamento, iniciadas juntas, e uma sessão aberta dali com este nome e título.
async function abertaEntre($: any, on: any, args: { name: string; title: string }) {
  fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Pesquisa web: changelog' }, { id: '2', title: 'Implementação: ler o código' }] }])
  await start($, ['1', '2'])
  await ferramenta($, 'mcp__ccd_session__start_session', args)
  await aviso($)
  return painel($)
}

// Regra: envios.carta-pelo-nome-da-sessao, sessoes.cartao-sob-a-tarefa-de-origem
test('o título da sessão nova com só uma palavra em comum com uma tarefa não decide: o cartão segue a ordem', async ($: any, on: any) => {
  const p = await abertaEntre($, on, { name: 'sessao-um', title: 'Conferir o código gerado' })
  expect(cartoes(p, 'filha-um')[0]?.sob, emTexto(p)).toBe('Pesquisa web: changelog')
})

// Regra: envios.carta-pelo-nome-da-sessao, sessoes.cartao-sob-a-tarefa-de-origem
test('o nome da sessão nova com uma palavra em comum com uma só tarefa leva o cartão a ela', async ($: any, on: any) => {
  const p = await abertaEntre($, on, { name: 'revisao-codigo', title: 'x' })
  expect(cartoes(p, 'filha-um')[0]?.sob, emTexto(p)).toBe('Implementação: ler o código')
})

// Regra: cabecalho.status-igual-a-sessao-inteira, sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('filha encerrada: o status sob a caixa de mensagem conta como a sessão inteira', async ($: any, on: any) => {
  const { status } = await parada($, on)
  const p = await painel($)
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([4, 4])
  expect(status(), emTexto(p)).toBeUndefined()
})

// Regra: cabecalho.status-igual-a-sessao-inteira, sessoes.filha-parada-com-origem-fechada-sai-da-contagem
test('com a origem aberta, o status conta as pendentes da filha', async ($: any, on: any) => {
  const { status } = await parada($, on, 'aberta', false)
  const p = await painel($)
  const c = cabecalho(p)
  expect(status(), emTexto(p)).toBe(`Tarefas ${c.feitas}/${c.total}`)
})

// Regra: envios.carta-mostra-o-nome-do-destino
test('no cartão da filha, a carta para a própria mãe mostra o nome da mãe quando o app o informa', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] }, envios: [{ to: EU, anchor: '1', at: AGORA + 20 }] }], { nome: 'orquestradora' })
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  const carta = p.find(l => l.titulo.startsWith('Para '))
  expect(carta?.titulo, emTexto(p)).toBe('Para orquestradora')
})

// Regra: sessoes.rodada-a-vista-nao-sai-pelo-teto
test('na 21ª mensagem à mesma filha, o cartão da primeira rodada segue sob a tarefa dela', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderEnvio(on)
  const f1 = [noTurno(1, '1', 'f1', 'feita')]
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
  h.filha(K1).painel = { tasks: [...f1, noTurno(2, '2', 'f2', 'iniciada')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 1800)] }
  await aviso($)
  await start($, ['3'])
  for (let i = 1; i <= 20; i++) {
    await relogio.advance(1000)
    await envio($, K1, `mensagem ${i}`)
  }
  const p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => ({ sob: c.sob, tarefas: c.tarefas })), emTexto(p)).toContainEqual({ sob: 'Dois', tarefas: ['f2'] })
})

// Regra: sessoes.id-proprio-nao-lido-avisa
test('sem o id da própria sessão, o painel avisa depois de 10 s, o log diz uma vez, e os cartões voltam quando o id vem', async ($: any, on: any) => {
  const { relogio, log } = fixar(on)
  const op = { idFalha: true }
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }], op)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  let p = await painel($)
  expect(p.some(l => l.texto.includes('Sessões indisponíveis')), emTexto(p)).toBe(false)
  await relogio.advance(11_000)
  await aviso($)
  p = await painel($)
  expect(p.some(l => l.texto.includes('Sessões indisponíveis') && l.texto.includes('id da sessão')), emTexto(p)).toBe(true)
  expect(log.filter(l => l.includes('get_session falhou')).length, log.join('\n')).toBe(1)
  op.idFalha = false
  await aviso($)
  p = await painel($)
  expect(p.some(l => l.texto.includes('Sessões indisponíveis')), emTexto(p)).toBe(false)
  expect(linha(p, 'filha-um').sessao, emTexto(p)).toBe(true)
})

// Regra: sessoes.lista-vazia-refaz-o-status
test('a filha que some da lista sai também da linha de status', async ($: any, on: any) => {
  const { status } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Feita', 'feita'), tarefa('2', 'Nunca')] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  expect(status()).toBe('Tarefas 1/3')
  h.filha(K1).listada = false
  await aviso($)
  const p = await painel($)
  expect(p.some(l => l.sessao && l.titulo === 'filha-um'), emTexto(p)).toBe(false)
  expect(status()).toBe('Tarefas 0/1')
})

// Regra: sessoes.leitura-falha-nao-apaga-a-espera
test('uma leitura do arquivo que falha não apaga o "aguardando" nem gera o lembrete de fim de turno; depois de várias, volta a valer o que o app diz', async ($: any, on: any) => {
  const h = await abrir($, on, { painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  h.filha(K1).rodando = false
  h.filha(K1).aguardando = true
  await aviso($)
  esperarPalavra(await painel($), 'filha-um', 'aguardando')
  h.filha(K1).publicado = '{quebrado'
  const r = await aviso($)
  let p = await painel($)
  esperarPalavra(p, 'filha-um', 'aguardando')
  expect(JSON.stringify(r)).not.toContain('terminou o turno')
  for (let i = 0; i < 5; i++) await aviso($)
  p = await painel($)
  expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain('aguardando')
  h.filha(K1).publicado = undefined
  await aviso($)
  esperarPalavra(await painel($), 'filha-um', 'aguardando')
})

// Regra: sessoes.recem-aberta-sem-tarefas-trabalha
test('a sessão recém-aberta que o app lista parada e ainda sem tarefas é desenhada trabalhando; passado o prazo, vale o que o app diz', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', rodando: false }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['1'])
  let p = await painel($)
  for (const w of ['concluída', 'parada', 'encerrada']) expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain(w)
  esperarEstado(p, 'Um', 'andamento')
  expect(cabecalho(p).chips.ativas, emTexto(p)).toBe(1)
  await relogio.advance(121_000)
  await aviso($)
  p = await painel($)
  esperarPalavra(p, 'filha-um', 'concluída')
  esperarEstado(p, 'Um', 'concluida')
  expect(cabecalho(p).chips.ativas, emTexto(p)).toBe(0)
  h.filha(K1).rodando = true
  await aviso($)
  p = await painel($)
  expect(linha(p, 'filha-um').texto, emTexto(p)).not.toContain('concluída')
  esperarEstado(p, 'Um', 'andamento')
})

// Regra: sessoes.abriu-e-parou-sem-ser-vista-rodando
test('a sessão que abre, trabalha e para sem ser vista rodando gera o lembrete de fim de turno e, com a origem fechada, fica encerrada', async ($: any, on: any) => {
  fixar(on)
  responderEnvio(on)
  host(on, [{ id: K1, nome: 'filha-um', rodando: false, painel: { tasks: [deTurno(1, 'a', 'f1', 'feita'), deTurno(1, 'c', 'Colapso', 'aberta')], turns: [turnoDe(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }, { id: '9', title: 'Outra' }])
  await start($, ['1'])
  const a = await $.tool.call({ tool: 'mcp__ccd_session__start_session', tool_use_id: 's1', title: 'filha' })
  const b = await aviso($)
  const juntos = JSON.stringify([a, b])
  let p = await painel($)
  for (const t of ['terminou o turno', 'Um', '1 pendentes']) expect(juntos, emTexto(p)).toContain(t)
  esperarPalavra(p, 'filha-um', 'parada')
  const r = await done($, ['1', '9'])
  expect(JSON.stringify(r), emTexto(p)).toContain('saíram da contagem')
  await fimDoTurno($)
  p = await painel($)
  esperarPalavra(p, 'filha-um', 'encerrada')
  expect([cabecalho(p).feitas, cabecalho(p).total], emTexto(p)).toEqual([3, 3])
})

// Regra: taxa.troca-de-modelo-apaga, sessoes.toks-e-repo-branch-no-cartao
test('no cartão da filha que trocou de modelo, o toks/s antigo some', async ($: any, on: any) => {
  const h = await abrir($, on, { modelo: 'Opus 5.5 · high', rate: { toks: 90, live: true }, painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } })
  esperarPalavra(await painel($), 'filha-um', '90 toks/s')
  h.filha(K1).rate = undefined
  h.filha(K1).modelo = 'Sonnet 5.5 · high'
  await aviso($)
  const p = await painel($)
  expect(linha(p, 'filha-um')?.texto, emTexto(p)).not.toContain('toks/s')
  h.filha(K1).rate = { toks: 40, live: true }
  await aviso($)
  esperarPalavra(await painel($), 'filha-um', '40 toks/s')
})

// A filha aberta de "Um" (plano de duas tarefas), o turno da mãe encerrado; a filha passa a publicar
// `painel` e, com `parar`, para.
const DUAS: No[] = [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }]
async function filhaQueTermina($: any, on: any, filha: Omit<Filha, 'id'> = {}) {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Da filha', 'iniciada')] }, ...filha }])
  await pedido($, 'Pedido um')
  await plan($, DUAS)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await fimDoTurno($)
  return h
}

// Regra: sessoes.filha-que-conclui-tudo-fecha-a-origem
test('a filha que termina o turno com tudo concluído fecha a tarefa de origem, com a mãe parada, e o modelo é avisado uma vez', async ($: any, on: any) => {
  const h = await filhaQueTermina($, on)
  esperarEstado(await painel($), 'Um', 'andamento')
  h.filha(K1).painel = { tasks: [tarefa('1', 'Da filha', 'feita')] }
  h.filha(K1).rodando = false
  const r = JSON.stringify(await aviso($))
  const p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  for (const t of ['concluiu sozinho a tarefa de origem', 'filha-um', 'Um']) expect(r, r).toContain(t)
  expect(r).not.toContain('continua aberta')
  expect(JSON.stringify(await aviso($))).not.toContain('concluiu sozinho')
})

// Regra: sessoes.filha-que-conclui-tudo-fecha-a-origem
test('a filha que para com uma tarefa aberta não fecha a tarefa de origem, e vale o lembrete', async ($: any, on: any) => {
  const h = await filhaQueTermina($, on)
  h.filha(K1).painel = { tasks: [tarefa('1', 'Da filha', 'feita'), tarefa('2', 'Outra da filha')] }
  h.filha(K1).rodando = false
  const r = JSON.stringify(await aviso($))
  esperarEstado(await painel($), 'Um', 'aguardando')
  for (const t of ['terminou o turno', 'continua aberta']) expect(r, r).toContain(t)
  expect(r).not.toContain('concluiu sozinho')
})

// Regra: sessoes.filha-que-conclui-tudo-fecha-a-origem
test('a filha parada com Esc, mesmo com tudo concluído, não fecha a tarefa de origem', async ($: any, on: any) => {
  const h = await filhaQueTermina($, on)
  h.filha(K1).painel = { tasks: [tarefa('1', 'Da filha', 'feita')] }
  h.filha(K1).aborted = true
  h.filha(K1).rodando = false
  const r = JSON.stringify(await aviso($))
  esperarEstado(await painel($), 'Um', 'aguardando')
  expect(r).not.toContain('concluiu sozinho')
})

// Regra: sessoes.filha-que-conclui-tudo-fecha-a-origem
test('a filha que para sem tarefas publicadas não fecha a tarefa de origem', async ($: any, on: any) => {
  const h = await filhaQueTermina($, on)
  h.filha(K1).painel = { tasks: [] }
  h.filha(K1).rodando = false
  const r = JSON.stringify(await aviso($))
  esperarEstado(await painel($), 'Um', 'aguardando')
  expect(r).not.toContain('concluiu sozinho')
})

// Regra: sessoes.filha-que-conclui-tudo-fecha-a-origem
test('com uma carta saída da tarefa de origem ainda na fila, a filha que conclui tudo não a fecha', async ($: any, on: any) => {
  fixar(on)
  responderEnvio(on)
  const K2 = 'local_22222222-2222-2222-2222-222222222222'
  const h = host(on, [
    { id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Da filha', 'iniciada')] } },
    { id: K2, nome: 'outra', iniciadaPor: 'local_99999999-9999-9999-9999-999999999999' },
  ])
  await pedido($, 'Pedido um')
  await plan($, DUAS)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await envio($, K2)
  await fimDoTurno($)
  h.filha(K1).painel = { tasks: [tarefa('1', 'Da filha', 'feita')] }
  h.filha(K1).rodando = false
  const r = JSON.stringify(await aviso($))
  const p = await painel($)
  expect(linha(p, 'Um').estado, emTexto(p)).not.toBe('concluida')
  expect(r).not.toContain('concluiu sozinho')
})

// Regra: sessoes.filha-que-conclui-tudo-fecha-a-origem
test('a tarefa de origem com subtarefa aberta não é fechada pela filha que conclui tudo', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Da filha', 'iniciada')] } }])
  await pedido($, 'Pedido um')
  await plan($, DUAS)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  // A tarefa de onde a filha foi aberta ganha uma subtarefa, aberta.
  await plan($, [{ id: '1', title: 'Um', children: [{ id: '1.1', title: 'Um.um' }] }, { id: '2', title: 'Dois' }])
  await fimDoTurno($)
  h.filha(K1).painel = { tasks: [tarefa('1', 'Da filha', 'feita')] }
  h.filha(K1).rodando = false
  const r = JSON.stringify(await aviso($))
  const p = await painel($)
  expect(linha(p, 'Um').estado, emTexto(p)).not.toBe('concluida')
  expect(r).not.toContain('concluiu sozinho')
})

// O painel da filha "governanca" com o turno 2 (o da mensagem da mãe, com `tarefa2`) e o turno 3, que o
// usuário abriu digitando nela em `at`, com uma tarefa iniciada.
const digitouDepoisDaMensagem = (h: any, tarefa2: string, at2: number, at: number) => {
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', tarefa2, 'feita'), noTurno(3, '3', 'Pedido digitado depois da mensagem', 'iniciada')],
    turns: [turno(1, AGORA + 10), turno(2, at2), { id: 3, title: 'pedido digitado', at, own: true }],
  }
}

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('com a mãe parada, o cartão do pedido do usuário na filha fica sob a tarefa da última mensagem que a mãe lhe mandou, não sob a de onde ela foi aberta', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderEnvio(on)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'R', title: 'Reescrita', children: [{ id: 'r1', title: 'Pedir a reescrita' }, { id: 'r2', title: 'Conferir a reescrita' }] }])
  await start($, ['r1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['r1'])
  await start($, ['r2'])
  await relogio.advance(1000)
  await envio($, K1)
  await relogio.advance(1000)
  h.recebeu(K1, AGORA + 1500)
  h.filha(K1).painel = { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'Tratar a mensagem', 'feita')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 1800)] }
  await aviso($)
  await done($, ['r2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  digitouDepoisDaMensagem(h, 'Tratar a mensagem', AGORA + 1800, AGORA + 2500)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Conferir a reescrita'])
})

// Regra: sessoes.turno-proprio-da-filha-no-pedido-vigente
test('a filha aberta num pedido antigo que recebeu mensagem de uma tarefa do pedido vigente: o cartão do pedido do usuário nela fica sob essa tarefa, não fecha o pedido', async ($: any, on: any) => {
  responderEnvio(on)
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'V', title: 'Limpeza', children: [{ id: 'v1', title: 'Limpar refs' }, { id: 'v2', title: 'Conferir refs' }] }])
  await start($, ['v1'])
  await relogio.advance(1000)
  await envio($, K1)
  await relogio.advance(1000)
  h.recebeu(K1, AGORA + 2500)
  h.filha(K1).painel = { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'Limpar as refs', 'feita')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 2600)] }
  await aviso($)
  await done($, ['v1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  digitouDepoisDaMensagem(h, 'Limpar as refs', AGORA + 2600, AGORA + 3500)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  expect(p.indexOf(linha(p, PROPRIO)), emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Conferir refs')))
})

const PERGUNTA_NA_CONTINUACAO = {
  questions: [{ question: 'Qual?', header: 'Rumo', multiSelect: false, options: [{ label: 'Opção A', description: 'a' }, { label: 'Opção B', description: 'b' }] }],
}

// Regra: sessoes.filha-que-conclui-tudo-fecha-a-origem
test('num pedido sem plano, com a pergunta aberta na tarefa em andamento, a filha aberta na pendente do plano anterior que conclui tudo não a fecha', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Da filha', 'iniciada')] } }])
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'continue')
  await start($, ['1'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA_NA_CONTINUACAO)
  await relogio.settle()
  await abrirSessao($)
  await aviso($)
  await relogio.advance(1000)
  await resp
  await fimDoTurno($)
  h.filha(K1).painel = { tasks: [tarefa('1', 'Da filha', 'feita')] }
  h.filha(K1).rodando = false
  const r = JSON.stringify(await aviso($))
  const p = await painel($)
  expect(linha(p, 'Dois').estado, emTexto(p)).not.toBe('concluida')
  expect(r, r).not.toContain('concluiu sozinho')
})

// Regra: sessoes.mensagem-entre-filhas-no-cartao-da-remetente, sessoes.cadeia-sem-cartao-dentro-de-cartao
test('com a carta entre irmãs já tomada, a carta fica verde e os cartões seguem na sequência', async ($: any, on: any) => {
  const { p } = await cadeia($, on, true)
  esperarCartaSob(p, 'Avisar K2', 'entregue')
  const um = cartoes(p, 'filha-um')
  const d2 = cartoes(p, 'filha-dois').filter(c => c.tarefas.includes('d2'))
  expect(d2.map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(d2[0]?.nivel, emTexto(p)).toBe(um[0]?.nivel)
  expect(um.some(c => c.tarefas.includes('d2')), emTexto(p)).toBe(false)
})

// Regra: envios.carta-pelo-nome-da-sessao, sessoes.cartao-sob-a-tarefa-de-origem
test('abrirSessao com nome abre a sessão como a chamada direta: o nome leva o cartão à tarefa', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Pesquisa web: changelog' }, { id: '2', title: 'Implementação: ler o código' }] }])
  await start($, ['1', '2'])
  await abrirSessao($, 'revisao-codigo')
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um')[0]?.sob, emTexto(p)).toBe('Implementação: ler o código')
})

// ---- O lugar do cartão do pedido digitado na filha: pedido apagado sem cartão, /clear, lugar em
// tarefa que sumiu e a leitura das sessões no meio do replano.

// A filha publica o turno 2 digitado em `at` sem nenhuma tarefa dele (Esc antes do plan): sem cartão.
const digitouEApagou = (h: any, at: number) => {
  h.filha(K1).painel = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'digitei e apertei Esc', at, own: true }],
  }
}
// O pedido novo da mãe, "Entrega", com as folhas dadas (ids e1, e2…), a primeira iniciada.
async function pedidoEntrega($: any, relogio: any, folhas: string[]) {
  await relogio.advance(1000)
  await pedido($, 'Pedido atual')
  await plan($, [{ id: 'E', title: 'Entrega', children: folhas.map((t, i) => ({ id: `e${i + 1}`, title: t })) }])
  await start($, ['e1'])
  await relogio.advance(1000)
}
// A filha sem o turno 2 (ela o apagou no prompt seguinte) e com o turno 3 digitado em `at`, com uma tarefa.
const digitouDeNovo = (at: number) => ({
  tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(3, '3', 'Revisar o que fiz', 'iniciada')],
  turns: [turno(1, AGORA + 10), { id: 3, title: 'agora revise', at, own: true }],
})
// O arquivo de uma filha depois de um /clear: em `past`, o que ela tinha antes; no grupo, o que veio depois.
const limpaCom = (antes: { tasks: any[]; turns: any[] }, depois: { tasks: any[]; turns: any[] }, at: number) =>
  JSON.stringify({ version: 1, waiting: false, waits: [], children: [], groups: [{ agent: '', label: '', ...depois, past: [{ at, ...antes }] }] })
// Um turno 1 digitado depois do /clear, mais de 10 minutos depois da abertura, com uma tarefa iniciada.
const DEPOIS_DO_CLEAR = 12 * 60_000
const turnoDepoisDoClear = { tasks: [noTurno(1, 'n1', 'Trabalho depois do clear', 'iniciada')], turns: [{ id: 1, title: 'pedido depois do clear', at: AGORA + DEPOIS_DO_CLEAR, own: true }] }

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o pedido digitado na filha e apagado sem cartão não dá o lugar ao pedido digitado depois', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoEntrega($, relogio, ['Implementar', 'Revisar'])
  digitouEApagou(h, AGORA + 1500)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, PROPRIO), emTexto(p)).toEqual([])
  await done($, ['e1'])
  await start($, ['e2'])
  await relogio.advance(1000)
  h.filha(K1).painel = digitouDeNovo(AGORA + 2500)
  await aviso($)
  p = await painel($)
  const cs = cartoes(p, PROPRIO)
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Revisar'])
  expect(cs[0]?.tarefas, emTexto(p)).toContain('Revisar o que fiz')
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o pedido apagado sem cartão, outro com cartão, um /clear na filha e mais um pedido: cada cartão fica onde o seu pedido aconteceu', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoEntrega($, relogio, ['Implementar', 'Revisar', 'Publicar'])
  digitouEApagou(h, AGORA + 1500)
  await aviso($)
  await done($, ['e1'])
  await start($, ['e2'])
  await relogio.advance(1000)
  h.filha(K1).painel = digitouDeNovo(AGORA + 2500)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Revisar'])
  await done($, ['e2'])
  await start($, ['e3'])
  await relogio.advance(20 * 60_000)
  h.filha(K1).publicado = limpaCom(digitouDeNovo(AGORA + 2500), turnoDepoisDoClear, AGORA + DEPOIS_DO_CLEAR - 60_000)
  await aviso($)
  p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Revisar', 'Publicar'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('depois de um /clear na filha, o pedido digitado de novo no mesmo pedido da mãe tem cartão próprio, não no lugar do cartão de antes', async ($: any, on: any) => {
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoLimpeza($, relogio)
  await start($, ['v1'])
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  await done($, ['v1'])
  await start($, ['v2'])
  await relogio.advance(20 * 60_000)
  const antes = {
    tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita'), noTurno(2, '2', 'Reescrever com filter-repo', 'feita')],
    turns: [turno(1, AGORA + 10), { id: 2, title: 'pode apagar e reescrever', at: AGORA + 1500, own: true }],
  }
  h.filha(K1).publicado = limpaCom(antes, turnoDepoisDoClear, AGORA + DEPOIS_DO_CLEAR - 60_000)
  await aviso($)
  p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs', 'Conferir refs'])
})

// A filha com um nível 1 só ("Bloco da filha") e três subtarefas: a de origem da neta (feita), uma
// iniciada e uma aberta; a neta aberta da primeira, publicada pela filha.
async function filhaComBloco($: any, on: any, neta: object) {
  fixar(on)
  const bloco = {
    ...noTurno(1, 'F', 'Bloco da filha', 'aberta'),
    children: [tarefa('f1', 'Origem da neta', 'feita'), tarefa('f2', 'Em andamento na filha', 'iniciada'), tarefa('f3', 'Pendente na filha')],
  }
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [bloco], turns: [turno(1, AGORA + 10)], filhas: [neta] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  return painel($)
}
const NETA_PROPRIO = 'neta · pedido do usuário na filha'

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('a neta que levou /clear, publicada sem lugar para o cartão novo: ele não herda o lugar do cartão de antes do /clear', async ($: any, on: any) => {
  const neta = netaDigitada({
    anchor: 'f1',
    places: [{ at: AGORA + 500, anchor: 'f1' }],
    panel: {
      groups: [
        {
          agent: '',
          label: '',
          tasks: [noTurno(2, 'n3', 'Neta depois do clear', 'iniciada')],
          turns: [turno(1, AGORA + 600), { id: 2, title: 'digitei depois do clear', at: AGORA + 800, own: true }],
          past: [{ at: AGORA + 550, tasks: [noTurno(2, 'n2', 'Neta digitada', 'feita')], turns: [turno(1, AGORA + 20), { id: 2, title: 'digitei na neta', at: AGORA + 500, own: true }] }],
        },
      ],
      waits: [],
      children: [],
    },
  })
  const p = await filhaComBloco($, on, neta)
  expect(cartoes(p, NETA_PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Origem da neta', 'Em andamento na filha'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o lugar guardado numa tarefa que não existe mais não vale: a neta sob um bloco com subtarefas fica sob a tarefa em andamento, não fechando o bloco', async ($: any, on: any) => {
  const p = await filhaComBloco($, on, netaDigitada({ anchor: 'f1', places: [{ at: AGORA + 500, anchor: 'sumiu' }] }))
  expect(cartoes(p, NETA_PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Em andamento na filha'])
  expect(p.indexOf(linha(p, NETA_PROPRIO)), emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Pendente na filha')))
})

// O lugar guardado no store pelo primeiro teste do par, lido (com a tarefa trocada) pelo segundo.
const LUGAR_SUMIDO: Record<string, unknown> = {}

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o lugar da filha direta guardado numa tarefa que sumiu é decidido de novo', async ($: any, on: any) => {
  armazem(on, LUGAR_SUMIDO)
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoLimpeza($, relogio)
  await start($, ['v1'])
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  await done($, ['v1'])
  await fimDoTurno($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
})

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda
test('o lugar da filha direta guardado numa tarefa que sumiu é decidido de novo: o processo novo o decide e o guarda', async ($: any, on: any) => {
  const chave = Object.keys(LUGAR_SUMIDO).find(k => k.startsWith('links:'))
  if (chave === undefined) throw new Error('rode o par inteiro: o primeiro não gravou')
  const cru = LUGAR_SUMIDO[chave]
  const registro: any = typeof cru === 'string' ? JSON.parse(cru) : cru
  let trocados = 0
  for (const c of registro?.children ?? []) for (const x of c?.places ?? []) if (x?.at === AGORA + 1500) (x.anchor = 'nao-existe'), trocados++
  if (trocados === 0) throw new Error('o primeiro do par não guardou o lugar: ' + JSON.stringify(registro))
  LUGAR_SUMIDO[chave] = typeof cru === 'string' ? JSON.stringify(registro) : registro
  fixar(on, { agora: AGORA + 5000 })
  armazem(on, LUGAR_SUMIDO)
  const h = host(on, [{ id: K1, nome: 'governanca', painel: { tasks: [noTurno(1, '1', 'Reescrever autoria', 'feita')], turns: [turno(1, AGORA + 10)] } }])
  digitouNaFilha(h, AGORA + 1500)
  await iniciarSessao($)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  const lugares = (h.proprio()?.children ?? []).find((c: any) => c.id === K1)?.places ?? []
  const limpar = flatTarefas(h.proprio()?.groups ?? []).find((t: any) => t.title === 'Limpar refs')?.id
  expect(limpar, JSON.stringify(h.proprio()?.groups)).toBeDefined()
  expect(lugares.find((x: any) => x.at === AGORA + 1500)?.anchor, JSON.stringify(lugares)).toBe(limpar)
})
const flatTarefas = (groups: any[]): any[] => {
  const todas = (ts: any[]): any[] => ts.flatMap(t => [t, ...todas(t.children ?? [])])
  return groups.flatMap(g => todas(g.tasks ?? []))
}

// O store do teste da leitura no meio do replano, e a leitura armada para a próxima gravação do painel.
const LOJA_DO_REPLANO: Record<string, unknown> = {}

// Regra: sessoes.lugar-do-cartao-digitado-nao-muda, pedidos.replano-leva-o-cartao-ao-nivel-1
test('a leitura das sessões no meio do replano não tira do nível 1 o cartão do pedido do usuário na filha', async ($: any, on: any) => {
  // O store do armazem, com a leitura armada na gravação do painel (o harness não deixa dois store.set).
  let armada = false
  let leu = false
  on('session.id', () => ({ value: SESSAO }))
  on('store.get', (_$: any, e: any) => ({ value: LOJA_DO_REPLANO[e.key] }))
  on('store.delete', (_$: any, e: any) => {
    delete LOJA_DO_REPLANO[e.key]
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(LOJA_DO_REPLANO) }))
  on('store.set', async (_$: any, e: any) => {
    LOJA_DO_REPLANO[e.key] = e.value === undefined ? undefined : JSON.parse(JSON.stringify(e.value))
    const r = { value: undefined }
    if (armada && e.value?.groups !== undefined) {
      armada = false
      await aviso($)
      leu = true
    }
    return r
  })
  const { h, relogio } = await abrirNoPedidoAntigo($, on)
  await pedidoLimpeza($, relogio, true)
  await start($, ['v1'])
  await relogio.advance(1000)
  digitouNaFilha(h, AGORA + 1500)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpar refs'])
  armada = true
  await plan($, [
    { id: 'V', title: 'Limpeza', children: [{ id: 'v2', title: 'Conferir refs' }] },
    { id: 'W', title: 'Segundo bloco', children: [{ id: 'w1', title: 'Passo do segundo' }] },
  ])
  expect(leu).toBe(true)
  await aviso($)
  p = await painel($)
  expect(cartoes(p, PROPRIO).map(c => c.sob), emTexto(p)).toEqual(['Limpeza'])
  const i = p.indexOf(linha(p, PROPRIO))
  expect(i, emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Limpeza')))
  expect(i, emTexto(p)).toBeLessThan(p.indexOf(linha(p, 'Conferir refs')))
})

// Regra: sessoes.modelo-e-esforco-publicados
test('a sessão publica o modelo, e o esforço quando o passo o traz', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [])
  const passo = passos(on, relogio)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await passo($)
  await start($, ['1'])
  expect(h.proprio()?.engine).toBe('Opus 5.5')
  await passo($, { esforco: 'high' })
  await start($, ['1'])
  expect(h.proprio()?.engine).toBe('Opus 5.5 · high')
  await passo($, { agente: 'sub-1', esforco: 'low' })
  await start($, ['1'])
  expect(h.proprio()?.engine).toBe('Opus 5.5 · high')
})

// Regra: sessoes.lista-em-erro-diz-sessoes-indisponiveis
test('com a lista do app em erro, o painel diz "Sessões indisponíveis" e o cartão fica; com a lista de volta, a linha some', async ($: any, on: any) => {
  fixar(on)
  const op = { listaFalha: false }
  on('mcp.call', { tool: 'list_sessions' }, (_$: any, e: any, next: any) =>
    op.listaFalha ? { value: { content: [{ type: 'text', text: 'list_sessions indisponível' }], isError: true } } : next(e),
  )
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefa('1', 'Tarefa da filha', 'iniciada')] } }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  let p = await painel($)
  expect(linha(p, 'filha-um').sessao, emTexto(p)).toBe(true)
  expect(p.some(l => l.texto.includes('Sessões indisponíveis')), emTexto(p)).toBe(false)
  op.listaFalha = true
  await aviso($)
  p = await painel($)
  expect(p.some(l => l.texto.includes('Sessões indisponíveis')), emTexto(p)).toBe(true)
  expect(linha(p, 'filha-um').sessao, emTexto(p)).toBe(true)
  linha(p, 'Tarefa da filha')
  op.listaFalha = false
  await aviso($)
  p = await painel($)
  expect(p.some(l => l.texto.includes('Sessões indisponíveis')), emTexto(p)).toBe(false)
  expect(linha(p, 'filha-um').sessao, emTexto(p)).toBe(true)
})

// Regra: sessoes.mensagem-recebida-sem-rodada-abre-cartao
test('a mensagem que a filha recebeu sem envio visto abre um cartão próprio sob a tarefa aberta naquela hora', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const f1 = [noTurno(1, '1', 'f1', 'feita')]
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: f1, turns: [turno(1, AGORA + 10)] } }])
  await pedido($, 'Pedido um')
  await plan($, A3)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await relogio.advance(1000)
  await start($, ['2'])
  await relogio.advance(1000)
  h.recebeu(K1, AGORA + 1500)
  h.filha(K1).painel = { tasks: [...f1, noTurno(2, '2', 'f2', 'iniciada')], turns: [turno(1, AGORA + 10), turno(2, AGORA + 1800)] }
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => ({ sob: c.sob, tarefas: c.tarefas })), emTexto(p)).toEqual([
    { sob: 'Um', tarefas: ['f1'] },
    { sob: 'Dois', tarefas: ['f2'] },
  ])
})
