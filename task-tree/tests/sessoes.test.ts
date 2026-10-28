import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host, type Filha } from './kit/ambiente'
import { abrirSessao, aviso, done, pedido, plan, start, type No } from './kit/cenario'
import { emTexto, esperarEstado, esperarPalavra, linha, painel, temBusto } from './kit/leitura'

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