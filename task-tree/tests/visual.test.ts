import { expect } from 'claude-code/testing'
import { test } from './kit/teste'
import { responderEnvio } from './kit/ambiente'
import { envio } from './kit/cenario'
import { emTexto, painel } from './kit/leitura'
import { AGORA, fixar, host, lancaveis } from './kit/ambiente'
import { abrirSessao, aviso, cancelar, chamadaDoSubagente, done, esc, fimDoSubagente, fimDoSubagenteCom, fimDoTurno, lancar, pedido, plan, start, type No } from './kit/cenario'
import { alfa, alturaDaLinha, cabecalhoDoApp, centrada, respirosDoApp, tom, vaosEntreLinhas, cartoesDoApp, estadoGeral, faixasDoApp, guiasDe, linhaDoApp, montarNoApp, noApp, pedacosDepois, textosComCaixa, tracosDoApp, type CaixaDoApp, type DesenhoDoApp } from './kit/leitura'

// O cabeçalho do app desktop (V4): a faixa de estado geral, lida no texto alternativo do cabeçalho ("estado geral: …").

const UM: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }]
const faixa = async ($: any) => estadoGeral(await noApp($))

// Regra: visual.faixa-de-estado-geral
test('a faixa do cabeçalho: em andamento, aguardando, concluído e interrompido', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, UM)
  // Só pendentes, nada iniciado: âmbar claro, aguardando.
  expect(await faixa($)).toBe('aguardando')
  await start($, ['1'])
  expect(await faixa($)).toBe('em andamento')
  // A pílula de em andamento segue no cabeçalho.
  expect((await noApp($)).cabecalho.texto).toContain('1 em andamento')
  await fimDoTurno($)
  expect(await faixa($)).toBe('aguardando')
  await pedido($, 'Pedido dois')
  await done($, ['1'])
  expect(await faixa($)).toBe('concluído')
})

// Regra: visual.faixa-de-estado-geral
test('a faixa do cabeçalho: interrompido depois do Esc, e sessão ativa com só a filha trabalhando', async ($: any, on: any) => {
  fixar(on)
  // A filha trabalha sem tarefa iniciada (uma iniciada dela já conta "em andamento" no cabeçalho).
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', painel: { tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'done', startedAt: AGORA - 1000, endedAt: AGORA - 500, children: [] }] } }])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['1'])
  expect(await faixa($)).toBe('sessão ativa')
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê' }] }])
  await start($, ['b1'])
  expect(await faixa($)).toBe('em andamento')
  await esc($)
  expect(await faixa($)).not.toBe('em andamento')
})

// Regra: visual.faixa-de-estado-geral
test('a faixa segue em andamento entre o done de uma tarefa e o start da seguinte, com o turno em curso', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [
    { id: 'A', title: 'Um' },
    { id: 'B', title: 'Dois' },
  ])
  expect(await faixa($)).toBe('aguardando')
  await start($, ['A'])
  expect(await faixa($)).toBe('em andamento')
  await done($, ['A'])
  expect(await faixa($)).toBe('em andamento')
  expect((await noApp($)).cabecalho.texto).not.toMatch(/\d+ em andamento/)
  await start($, ['B'])
  expect(await faixa($)).toBe('em andamento')
  await fimDoTurno($)
  expect(await faixa($)).toBe('aguardando')
})

// Regra: visual.faixa-de-estado-geral
test('com tudo desta sessão concluído e a filha trabalhando numa tarefa iniciada dela, a faixa é âmbar, em andamento', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_22222222-2222-2222-2222-222222222222', nome: 'filha', painel: { tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] } }])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['1'])
  expect(await faixa($)).toBe('em andamento')
  const texto = (await noApp($)).cabecalho.texto
  expect(texto).toContain('1 em andamento')
  expect(texto).toContain('1 sessão ativa')
})

const DOIS_PASSOS: No[] = [
  { id: 'A', title: 'Um' },
  { id: 'B', title: 'Dois' },
]

// Regra: visual.faixa-de-estado-geral
test("com tudo fechado e uma tarefa parada com Esc, a faixa é cinza 'interrompido'; os números não mudam", async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, DOIS_PASSOS)
  await start($, ['A'])
  await done($, ['A'])
  await start($, ['B'])
  await esc($)
  const d = await noApp($)
  expect(estadoGeral(d), d.cabecalho.texto).toBe('interrompido')
  expect(d.cabecalho.texto).toContain('1 de 1')
})

// Regra: visual.faixa-de-estado-geral
test("a tarefa tirada com cancel não deixa a faixa cinza: com o resto concluído, verde 'concluído'", async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, DOIS_PASSOS)
  await start($, ['A'])
  await done($, ['A'])
  await cancelar($, ['B'])
  const d = await noApp($)
  expect(estadoGeral(d), d.cabecalho.texto).toBe('concluído')
  expect(d.cabecalho.texto).toContain('1 de 1')
})

// Regra: visual.faixa-de-estado-geral
test("com tudo fechado e a tarefa de um subagente que falhou, a faixa é cinza 'interrompido'", async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, DOIS_PASSOS)
  await start($, ['A'])
  await done($, ['A'])
  await start($, ['B'])
  await lancar($, { descricao: 'revisar' })
  await fimDoSubagenteCom($, 'sub-1', { erro: true })
  await fimDoTurno($)
  const d = await noApp($)
  expect(estadoGeral(d), d.cabecalho.texto).toBe('interrompido')
})

// O título de uma linha do app desktop: o texto inteiro, que o app corta com "…" na largura real.
const LONGO = 'Um título bem comprido que não cabe inteiro na linha do painel de tarefas, de jeito nenhum'

// Regra: visual.titulo-sem-contagem-vai-ate-o-tempo
test('o título de uma linha sem contagem vai até o tempo; a com contagem corta antes da barra', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: 'P', title: LONGO, children: [{ id: '1', title: LONGO }, { id: '2', title: 'Curta' }] }] }])
  await start($, ['1'])
  const d = await noApp($)
  // O título vai inteiro a um Text, e o app o corta na largura real (onde o corte cai é do app).
  const titulo = (p: { tipo: string; texto: string }) => p.tipo === 'texto' && p.texto === LONGO
  // O pai (com contagem e barra) vem antes da folha (sem contagem), com o mesmo título.
  const comLongo = d.linhas.filter(l => l.pedacos.some(titulo))
  expect(comLongo.length, d.textos.join('\n')).toBe(2)
  const [pai, folha] = comLongo as [(typeof comLongo)[number], (typeof comLongo)[number]]
  // Na folha, depois do título só vem o tempo.
  const depois = pedacosDepois(folha, LONGO).filter(p => p.tipo === 'texto')
  expect(depois.length, folha.texto).toBe(1)
  expect(depois[0]?.texto ?? '', folha.texto).toMatch(/^\d+:\d\d/)
  // No pai, a contagem vem depois do título.
  expect(pedacosDepois(pai, LONGO).some(p => p.tipo === 'texto' && /^\d+\/\d+$/.test(p.texto)), pai.texto).toBe(true)
  expect(folha.pedacos.find(titulo)?.props.wrap).toBe('truncate-end')
  expect(d.linhas.some(l => l.pedacos.some(p => p.tipo === 'texto' && p.texto === 'Curta'))).toBe(true)
})

// Regra: visual.tooltip
test('texto cortado não tem tooltip: nenhuma camada interativa e nenhum <title>', async ($: any, on: any) => {
  fixar(on)
  const BRANCH = 'feat/uma-branch-com-um-nome-muito-comprido-que-nao-cabe-no-cartao-da-sessao-filha'
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', git: { repo: 'meu-repo', branch: BRANCH }, painel: { tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: LONGO, children: [{ id: '1', title: LONGO }, { id: '2', title: 'Curta' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const d = await noApp($)
  // O título inteiro vai a um Text do desenho (o app o corta com …).
  expect(d.linhas.some(l => l.pedacos.some(p => p.tipo === 'texto' && p.texto === LONGO))).toBe(true)
  expect(d.svgs.filter(s => s.isInteractive).length).toBe(0)
  expect(d.svgs.some(s => s.source.includes('<title'))).toBe(false)
  // Nenhum cartão de hover: nenhum elemento com hover nem escondido.
  expect(d.revelados).toBe(0)
})

// Regra: visual.titulo-sem-contagem-vai-ate-o-tempo
test('no cartão da filha, o título da folha passa da coluna da contagem e corta junto do tempo', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', painel: { tasks: [{ id: 'T', short: 'T', title: 'Pai', status: 'open', started: 1, startedAt: AGORA - 1000, children: [
    { id: 'T/1', short: '1', title: LONGO, status: 'done', startedAt: AGORA - 900, endedAt: AGORA - 800, children: [] },
    { id: 'T/2', short: '2', title: 'Outra', status: 'open', children: [] }] }] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const d = await noApp($)
  const folha = d.linhas.find(l => l.pedacos.some(p => p.tipo === 'texto' && p.texto === LONGO))
  expect(folha, d.textos.join('\n')).toBeDefined()
  // Depois do título só vem o tempo: nenhuma coluna de contagem entre os dois; o app corta o título
  // junto do tempo (onde o corte cai é do app).
  const depois = pedacosDepois(folha!, LONGO).filter(p => p.tipo === 'texto')
  expect(depois.length, folha!.texto).toBe(1)
  expect(depois[0]?.texto ?? '', folha!.texto).toMatch(/^\d+:\d\d/)
  expect(depois.some(p => /^\d+\/\d+$/.test(p.texto)), folha!.texto).toBe(false)
})

// Regra: visual.titulo-sem-contagem-vai-ate-o-tempo
test('a linha ↩ do cartão, sem tempo, vai até a borda do cartão antes de cortar', async ($: any, on: any) => {
  fixar(on)
  const B = 'Folha cortava na coluna N/N por 22 px de folga fixa; agora corta a 8 px do tempo, sem commit (golden)'
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', painel: { tasks: [{ id: 'T', short: 'T', title: 'Pai', status: 'done', startedAt: AGORA - 1000, endedAt: AGORA - 10, children: [] }], turns: [{ id: 'u1', at: AGORA - 1100, endedAt: AGORA - 5, brief: B, reply: B } as any] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const d = await noApp($)
  const respostas = d.linhas.filter(l => l.pedacos.some(p => p.tipo === 'texto' && p.texto.startsWith('Folha cortava')))
  expect(respostas.length, d.textos.join('\n')).toBe(1)
  // Sem tempo, nada vem depois do título (nem tempo, nem contagem, nem Svg): o app o corta na borda
  // do cartão.
  expect(pedacosDepois(respostas[0]!, /^Folha cortava/), respostas[0]!.texto).toEqual([])
})

// Regra: visual.botoes-por-chave
test('no app, o ícone da linha que recolhe e o anel do cartão são botões com chave', async ($: any, on: any) => {
  fixar(on)
  const K = 'local_11111111-1111-1111-1111-111111111111'
  const h = host(on, [{ id: K, nome: 'filha-um', contexto: 42, painel: { tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Tarefa única' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const m = await montarNoApp($)
  let d = await m.desenho()
  // O anel do cartão abre a sessão: pede ao app que a mostre.
  const cartao = d.linhas.find(l => l.botoes.includes(`open:${K}`))
  expect(cartao?.texto ?? '', d.textos.join('\n')).toContain('filha-um')
  await m.apertar(`open:${K}`)
  d = await m.desenho()
  expect(h.pedidosAoApp()).toContain('open_session_in')
  // O ícone da linha com algo embaixo recolhe a linha.
  const fold = d.linhas.find(l => l.texto.includes('Plano A'))?.botoes.find(b => b.startsWith('fold:'))
  expect(fold, d.textos.join('\n')).toBeDefined()
  expect(d.linhas.some(l => l.texto.includes('Tarefa única'))).toBe(true)
  await m.apertar(fold!)
  d = await m.desenho()
  expect(d.linhas.some(l => l.texto.includes('Tarefa única')), d.textos.join('\n')).toBe(false)
  await m.fim()
})

// O roteiro dos dois testes abaixo: uma filha de nome próprio com uma tarefa aberta e, se pedido, um
// subagente lançado com uma descrição própria.
async function comCartoes($: any, on: any, subagente: boolean) {
  fixar(on)
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha-destacada', painel: { tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] } }])
  if (subagente) lancaveis(on, ['s1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  if (subagente) await lancar($, { descricao: 'subagente destacado' })
  return noApp($)
}
// Fundo e borda em cor crua translúcida, a borda mais forte que o fundo.
function destacada(c: CaixaDoApp | undefined, onde: string) {
  expect(c, onde).toBeDefined()
  expect(c!.estilo, onde).toBe('round')
  const f = alfa(c!.fundo)
  const b = alfa(c!.borda)
  expect(f, `${onde}: fundo ${c!.fundo}`).toBeDefined()
  expect(b, `${onde}: borda ${c!.borda}`).toBeDefined()
  expect(f!, onde).toBeGreaterThan(0)
  expect(f!, onde).toBeLessThan(1)
  expect(b!, onde).toBeGreaterThan(0)
  expect(b!, onde).toBeLessThan(1)
  expect(b!, onde).toBeGreaterThan(f!)
}

// Regra: visual.cartao-e-cabecalho-destacados
test('no app, o cartão de sessão e o de subagente têm fundo e borda próprios', async ($: any, on: any) => {
  const d = await comCartoes($, on, true)
  const cartoes = cartoesDoApp(d)
  const quais = JSON.stringify(cartoes)
  destacada(cartoes.find(c => c.primeira.includes('filha-destacada')), `cartão da filha: ${quais}`)
  destacada(cartoes.find(c => c.primeira.includes('subagente destacado')), `cartão do subagente: ${quais}`)
})

// Regra: visual.cartao-e-cabecalho-destacados
test('no app, o cabeçalho tem o mesmo fundo e a mesma borda do cartão', async ($: any, on: any) => {
  const d = await comCartoes($, on, false)
  const cab = cabecalhoDoApp(d)
  destacada(cab, `cabeçalho: ${JSON.stringify(cab)}`)
  const filha = cartoesDoApp(d).find(c => c.dentro === 0 && c.primeira.includes('filha-destacada'))
  expect(filha, JSON.stringify(cartoesDoApp(d))).toBeDefined()
  expect(cab.fundo).toBe(filha!.fundo)
  expect(cab.borda).toBe(filha!.borda)
})

// As guias de uma linha do app, pelo título (pedaço de texto igual).
const guiasDaLinha = (d: DesenhoDoApp, titulo: string) => guiasDe(linhaDoApp(d, titulo))
const umaCor = (d: DesenhoDoApp) => {
  const tracos = tracosDoApp(d)
  expect(tracos.length, 'traços das guias').toBeGreaterThan(0)
  expect(new Set(tracos.map(t => t.cor)).size, JSON.stringify(tracos)).toBe(1)
}

// Regra: visual.guias-em-caixas-nativas
test('no app, as guias da árvore são caixas com fundo, sem caracteres de caixa', async ($: any, on: any) => {
  fixar(on)
  host(on, [])
  await pedido($, 'Pedido das guias')
  await plan($, [
    { id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um', children: [{ id: '1.1', title: 'Um.um' }, { id: '1.2', title: 'Um.dois' }] }, { id: '2', title: 'Dois' }] },
    { id: 'B', title: 'Plano B' },
  ])
  await start($, ['1.1'])
  const d = await noApp($)
  expect(guiasDaLinha(d, 'Plano A')).toEqual(['ramo'])
  expect(guiasDaLinha(d, 'Um')).toEqual(['barra', 'ramo'])
  expect(guiasDaLinha(d, 'Um.um')).toEqual(['barra', 'barra', 'ramo'])
  expect(guiasDaLinha(d, 'Um.dois')).toEqual(['barra', 'barra', 'fim'])
  expect(guiasDaLinha(d, 'Dois')).toEqual(['barra', 'fim'])
  expect(guiasDaLinha(d, 'Plano B')).toEqual(['fim'])
  expect(guiasDaLinha(d, 'Pedido das guias')).toEqual([])
  umaCor(d)
  expect(textosComCaixa(d)).toBe(0)
  expect(linhaDoApp(d, 'Um.um').pedacos.filter(p => p.tipo === 'svg').length).toBe(1)
})

// Regra: visual.guias-na-faixa-do-cartao
test('no app, a faixa à esquerda do cartão tem uma célula de guia por coluna, com ramo ou fim', async ($: any, on: any) => {
  fixar(on)
  host(on, [])
  lancaveis(on, ['s1', 's2'])
  on('tool.call', { tool: 'Grep' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }, { id: '2', title: 'Revisar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'buscar usos de hover' })
  await chamadaDoSubagente($, 's1', 'Grep', { pattern: 'hover' })
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 's2')
  const d = await noApp($)
  const faixas = faixasDoApp(d)
  const quais = JSON.stringify(faixas)
  expect(faixas.find(f => f.primeira.includes('buscar usos de hover'))?.celulas, quais).toEqual(['vazio', 'barra', 'ramo'])
  expect(faixas.find(f => f.primeira.includes('ler o kit'))?.celulas, quais).toEqual(['vazio', 'barra', 'fim'])
  const i = d.linhas.findIndex(l => l.texto.includes('buscar usos de hover'))
  expect(guiasDe(d.linhas[i + 1]!), d.linhas[i + 1]?.texto).toEqual(['fim'])
  expect(guiasDaLinha(d, 'Investigar')).toEqual(['vazio', 'ramo'])
  expect(guiasDaLinha(d, 'Revisar')).toEqual(['vazio', 'fim'])
  expect(textosComCaixa(d)).toBe(0)
})

// Regra: visual.guias-na-faixa-do-cartao
test('no app, o cartão da filha tem a faixa de guias e as tarefas dela começam sem guia', async ($: any, on: any) => {
  fixar(on)
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha-um',
      painel: { tasks: [{ id: '1', short: '1', title: 'Tarefa da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const d = await noApp($)
  const faixas = faixasDoApp(d)
  expect(faixas.find(f => f.primeira.includes('filha-um'))?.celulas, JSON.stringify(faixas)).toEqual(['vazio', 'barra', 'fim'])
  expect(guiasDaLinha(d, 'Tarefa da filha')).toEqual([])
  expect(guiasDaLinha(d, 'Dois')).toEqual(['vazio', 'fim'])
  umaCor(d)
})

// Três cartões, um dentro do outro: o da filha, o do subagente dela e o do subagente que ele lançou.
const tresNiveis = async ($: any, on: any): Promise<DesenhoDoApp> => {
  fixar(on)
  const fim = { at: AGORA - 500, state: 'done', calls: 2, batch: AGORA - 500, engine: 'Haiku 5.5', end: AGORA - 100 }
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha',
      painel: {
        tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
        agentes: [
          {
            agent: 'fs-1',
            label: 'general-purpose: revisar testes',
            parent: '',
            anchor: '1',
            tasks: [{ id: 'X', short: 'X', title: 'Ler os testes', status: 'done', startedAt: AGORA - 400, endedAt: AGORA - 200, children: [] }],
            sub: { ...fim, state: 'running', end: undefined },
          },
          { agent: 'fs-2', label: 'Explore: achar o kit', parent: 'fs-1', anchor: 'X', tasks: [], sub: fim },
        ],
      },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  return noApp($)
}

// Regra: visual.cartao-dentro-de-cartao-um-degrau
test('no app, cada cartão dentro de outro tem o fundo e a borda um degrau além, o mesmo a cada nível', async ($: any, on: any) => {
  const d = await tresNiveis($, on)
  const todos = cartoesDoApp(d)
  const quais = JSON.stringify(todos)
  const nivel = [0, 1, 2].map(n => todos.find(c => c.dentro === n))
  nivel.forEach((c, n) => expect(c, `nível ${n}: ${quais}`).toBeDefined())
  const cs = nivel as CaixaDoApp[]
  const t = tom(cs[0]!.fundo)
  expect(t, quais).toBeDefined()
  for (const c of cs) {
    expect(tom(c.fundo), quais).toBe(t)
    expect(tom(c.borda), quais).toBe(t)
    expect(alfa(c.borda)!, quais).toBeGreaterThan(alfa(c.fundo)!)
  }
  const f = cs.map(c => alfa(c.fundo)!)
  const b = cs.map(c => alfa(c.borda)!)
  expect(f[1]!, quais).toBeGreaterThan(f[0]!)
  expect(f[2]!, quais).toBeGreaterThan(f[1]!)
  expect(b[1]!, quais).toBeGreaterThan(b[0]!)
  expect(b[2]!, quais).toBeGreaterThan(b[1]!)
  // O quanto cada cartão anda em direção ao cinza: o alfa dele vezes o que os de fora deixaram.
  const degrau = f.map((a, n) => a * f.slice(0, n).reduce((s, x) => s * (1 - x), 1))
  for (const g of degrau) expect(Math.abs(g - degrau[0]!) / degrau[0]!, JSON.stringify(degrau)).toBeLessThan(0.02)
  const cab = cabecalhoDoApp(d)
  expect(cab.fundo).toBe(cs[0]!.fundo)
  expect(cab.borda).toBe(cs[0]!.borda)
})

// Regra: visual.linhas-com-respiro
test('no app, toda linha tem a mesma altura, maior que a do texto, com o conteúdo centrado e sem vão entre linhas', async ($: any, on: any) => {
  const d = await tresNiveis($, on)
  expect(d.linhas.length).toBeGreaterThan(5)
  const h = alturaDaLinha(d.linhas[0]!)
  expect(typeof h, String(h)).toBe('number')
  expect(h as number).toBeGreaterThan(1)
  for (const l of d.linhas) {
    expect(alturaDaLinha(l), l.texto).toBe(h)
    expect(centrada(l), `centrada: ${l.texto}`).toBe(true)
  }
  expect(vaosEntreLinhas(d)).toBe(0)
})

// Regra: visual.cartao-com-respiro
test('no app, o cartão tem respiro nos quatro lados, e o conector da faixa desce com o cabeçalho', async ($: any, on: any) => {
  const d = await tresNiveis($, on)
  const rs = respirosDoApp(d)
  const quais = JSON.stringify(rs)
  expect(rs.length, quais).toBeGreaterThanOrEqual(3)
  const r0 = rs[0]!
  expect(r0.cima, quais).toBeGreaterThan(0)
  expect(r0.esquerda, quais).toBeGreaterThan(1)
  for (const r of rs) {
    expect(r.baixo, quais).toBe(r.cima)
    expect(r.cima, quais).toBe(r0.cima)
    expect(r.direita, quais).toBe(r.esquerda)
    expect(r.esquerda, quais).toBe(r0.esquerda)
  }
  const altura = alturaDaLinha(d.linhas[0]!)
  const comFaixa = rs.filter(r => r.conector)
  expect(comFaixa.some(r => r.primeira.includes('filha')), quais).toBe(true)
  for (const r of comFaixa) {
    expect(r.conector!.antes, quais).toBe(r.cima)
    expect(r.conector!.bloco, quais).toBe(altura)
  }
})

// Um pedido cujo corte de hoje (59 unidades) cai no meio do par do emoji.
const COM_EMOJI = `${'a'.repeat(58)}😀 e mais um pouco de texto`

// Regra: visual.corte-de-texto-inteiro-e-limpo
test('o título do pedido e a carta são cortados sem partir um emoji e sem caractere de controle', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, COM_EMOJI)
  await plan($, UM)
  await start($, ['1'])
  await envio($, 'local_x', 'antes\u001b[31mdepois')
  const p = await painel($)
  const doPedido = p.find(l => l.titulo.startsWith('aaaa'))
  expect(doPedido?.titulo, emTexto(p)).toBe(`${'a'.repeat(58)}😀…`)
  expect(/[\ud800-\udbff](?![\udc00-\udfff])/.test(doPedido?.titulo ?? ''), emTexto(p)).toBe(false)
  const carta = p.find(l => l.titulo.startsWith('Para '))
  expect(carta?.titulo, emTexto(p)).toContain('antesdepois')
  expect(carta?.titulo ?? '', emTexto(p)).not.toContain('\u001b')
})

// Regra: visual.tempo-nunca-negativo
test('um tempo com a hora à frente do relógio é desenhado 0:00, nunca negativo', async ($: any, on: any) => {
  fixar(on)
  const futuro = AGORA + 60000
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha',
      painel: {
        tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
        agentes: [{ agent: 'fs-1', label: 'Explore: lançado no futuro', parent: '', anchor: '1', tasks: [], sub: { at: futuro, state: 'running', calls: 1, batch: futuro, engine: 'Haiku 5.5' } }],
      },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  const sub = p.find(l => l.titulo.includes('lançado no futuro'))
  expect(sub?.texto, emTexto(p)).toContain('0:00')
  expect(sub?.texto ?? '', emTexto(p)).not.toMatch(/-\d/)
})

// As caixas da coluna da contagem (key "count") de um desenho do app, em qualquer profundidade.
function colunasDaContagem(raiz: any): { width: unknown; texto: string }[] {
  const achadas: { width: unknown; texto: string }[] = []
  const texto = (x: any): string => (typeof x === 'string' ? x : typeof x !== 'object' || x === null ? '' : (x.children ?? []).map(texto).join(''))
  const andar = (x: any) => {
    if (typeof x !== 'object' || x === null) return
    if (x.type === 'Box' && (x.key ?? x.props?.key) === 'count') achadas.push({ width: x.props?.width, texto: texto(x) })
    for (const c of x.children ?? []) andar(c)
  }
  andar(raiz)
  return achadas
}

// Regra: visual.coluna-da-contagem-cabe-a-maior
test('a coluna da contagem tem a largura da maior contagem, igual em todas as linhas', async ($: any, on: any) => {
  fixar(on)
  const tarefas = Array.from({ length: 120 }, (_, k) => ({
    id: String(k + 1),
    short: String(k + 1),
    title: `Tarefa ${k + 1}`,
    status: k < 100 ? 'done' : 'open',
    ...(k < 100 ? { startedAt: AGORA - 1000, endedAt: AGORA - 500 } : {}),
    children: [],
  }))
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', painel: { tasks: tarefas } }])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const d = await noApp($)
  const colunas = colunasDaContagem(d.raiz)
  const quais = JSON.stringify(colunas)
  expect(colunas.some(c => /^100\/\d{3}$/.test(c.texto)), quais).toBe(true)
  const maior = Math.max(...colunas.map(c => c.texto.length))
  const larguras = new Set(colunas.map(c => c.width))
  expect(larguras.size, quais).toBe(1)
  expect(Number(colunas[0]?.width), quais).toBeGreaterThanOrEqual(maior)
})

// Uma tarefa publicada por uma sessão filha, com as subtarefas dadas.
const estreitoTarefa = (id: string, title: string, children: any[] = []) => ({ id, short: id, title, status: 'open', ...(children.length === 0 ? { started: 1, startedAt: AGORA - 1000 } : {}), children })
// Um Box de key `k` em qualquer profundidade de um elemento do desenho do app.
function estreitoCaixa(el: any, k: string): boolean {
  if (typeof el !== 'object' || el === null) return false
  if (el.type === 'Box' && (el.key ?? el.props?.key) === k) return true
  return ((el.children ?? []) as any[]).some(c => estreitoCaixa(c, k))
}

// Regra: visual.titulo-legivel-no-painel-estreito
test('em painel estreito, a linha com colunas perde a barra e depois a contagem; em painel largo, tem as duas', async ($: any, on: any) => {
  fixar(on)
  const pai = estreitoTarefa('P', 'Pai da filha', [estreitoTarefa('P1', 'Primeira da filha'), estreitoTarefa('P2', 'Segunda da filha')])
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', painel: { tasks: [pai] } }])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const caixas = async (colunas: number) => {
    const d = await noApp($, { colunas })
    const l = linhaDoApp(d, 'Pai da filha')
    return { bar: estreitoCaixa(l.el, 'bar'), count: estreitoCaixa(l.el, 'count'), time: estreitoCaixa(l.el, 'time'), titulo: l.texto.includes('Pai da filha') }
  }
  expect(await caixas(100)).toEqual({ bar: true, count: true, time: true, titulo: true })
  expect(await caixas(50)).toEqual({ bar: false, count: true, time: true, titulo: true })
  expect(await caixas(40)).toEqual({ bar: false, count: false, time: true, titulo: true })
})

// Regra: visual.titulo-legivel-no-painel-estreito
test('do 8º nível em diante a linha tem as guias do 8º nível', async ($: any, on: any) => {
  fixar(on)
  const tres = (p: string) => [estreitoTarefa(`${p}a`, `${p} nível um`, [estreitoTarefa(`${p}b`, `${p} nível dois`, [estreitoTarefa(`${p}c`, `${p} nível três`), estreitoTarefa(`${p}d`, `${p} nível três bis`)])])]
  const neta = { id: 'local_22222222-2222-2222-2222-222222222222', name: 'neta', title: 'neta', running: true, archived: false, anchor: 'Fc', panel: { groups: [{ agent: '', label: '', tasks: tres('N') }], waits: [], children: [] } }
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', painel: { tasks: tres('F'), filhas: [neta] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um', children: [{ id: '1.1', title: 'Um.um' }] }] }])
  await start($, ['1.1'])
  await abrirSessao($)
  await aviso($)
  const d = await noApp($, { colunas: 100 })
  // Cada linha com as células das faixas dos cartões em volta dela somadas às guias dela.
  const somas: { texto: string; celulas: number }[] = []
  const linhas = new Map(d.linhas.map(l => [l.el, l]))
  const andar = (x: any, antes: number) => {
    if (typeof x !== 'object' || x === null) return
    const l = linhas.get(x)
    if (l) return void somas.push({ texto: l.texto, celulas: antes + guiasDe(l).length })
    const k = x.key ?? x.props?.key
    let soma = antes
    if (x.type === 'Box' && typeof k === 'string' && /^c\d+$/.test(k)) {
      const strip = ((x.children ?? []) as any[]).find(c => c?.type === 'Box' && (c.key ?? c.props?.key) === 'strip')
      soma += ((strip?.children ?? []) as any[]).filter(c => typeof c === 'object' && c !== null).length
    }
    for (const c of x.children ?? []) andar(c, soma)
  }
  andar(d.raiz, 0)
  const quais = JSON.stringify(somas)
  const de = (titulo: string) => somas.find(s => s.texto.includes(titulo))?.celulas
  // A neta começa no 7º; o 8º e o 9º nível dela ficam na mesma coluna.
  expect(de('N nível um'), quais).toBe(7)
  expect(de('N nível dois'), quais).toBe(8)
  expect(de('N nível três'), quais).toBe(8)
  expect(Math.max(...somas.map(s => s.celulas)), quais).toBe(8)
})

// Um comando em várias linhas, com FF e VT ao lado de espaços e espaços repetidos.
const COMANDO_EM_LINHAS = 'git status\r\n\fgit diff\u000b  --stat'
// Algum caractere de controle (C0, DEL, C1).
const CONTROLE = /[\u0000-\u001f\u007f-\u009f]/

// Regra: visual.corte-de-texto-inteiro-e-limpo
test('a linha da ferramenta do subagente sai numa linha só, sem quebra de linha nem caractere de controle', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'rodar o git' })
  await chamadaDoSubagente($, 'sub-1', 'Bash', { command: COMANDO_EM_LINHAS })
  const p = await painel($)
  const corpo = p.map(l => l.texto).join('\n')
  expect(corpo, emTexto(p)).toContain('Bash git status git diff --stat')
  for (const l of p) expect(CONTROLE.test(l.texto), JSON.stringify(l.texto)).toBe(false)
  const linha = p.find(l => l.texto.includes('Bash git'))
  expect(linha?.texto ?? '', emTexto(p)).not.toMatch(/Bash git.* {2}/)
})

// Regra: visual.corte-de-texto-inteiro-e-limpo
test("o pedido só com sequência de controle se chama 'Pedido', e os espaços em volta de uma sequência não dobram", async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, '\u001b[0m')
  await plan($, UM)
  await start($, ['1'])
  await envio($, 'local_x', 'antes \u001b[31m depois')
  await fimDoTurno($)
  await pedido($, 'erro \u001b[31m vermelho')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: '2', title: 'Dois' }] }])
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Pedido'), emTexto(p)).toBe(true)
  expect(p.some(l => /^[◉○✓✕◷] {2}/.test(l.texto)), emTexto(p)).toBe(false)
  const carta = p.find(l => l.titulo.startsWith('Para '))
  expect(carta?.titulo ?? '', emTexto(p)).toContain('antes depois')
  expect(p.some(l => l.titulo === 'erro vermelho'), emTexto(p)).toBe(true)
})

// Regra: visual.coluna-da-contagem-cabe-a-maior
test('a contagem do cartão de sessão solto não alarga a coluna da contagem das outras linhas', async ($: any, on: any) => {
  fixar(on)
  const muitas = Array.from({ length: 120 }, (_, k) => ({
    id: String(k + 1),
    short: String(k + 1),
    title: `Tarefa ${k + 1}`,
    status: k < 100 ? 'done' : 'open',
    ...(k < 100 ? { startedAt: AGORA - 1000, endedAt: AGORA - 500 } : {}),
    children: [],
  }))
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', painel: { tasks: muitas } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await abrirSessao($)
  await aviso($)
  const d = await noApp($)
  const colunas = colunasDaContagem(d.raiz)
  const quais = JSON.stringify(colunas)
  expect(colunas.length, quais).toBeGreaterThan(0)
  const larguras = new Set(colunas.map(c => c.width))
  expect(larguras.size, quais).toBe(1)
  expect(Number(colunas[0]?.width), quais).toBe(Math.max(5, ...colunas.map(c => c.texto.length)))
})

// Regra: visual.titulo-sem-contagem-vai-ate-o-tempo
test('na folha parada, a palavra de estado vem logo antes do tempo, sem nada entre os dois', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Parada aqui' }, { id: '2', title: 'Outra' }] }])
  await start($, ['1'])
  await esc($)
  const d = await noApp($)
  const folha = linhaDoApp(d, 'Parada aqui')
  const depois = pedacosDepois(folha, 'Parada aqui')
  expect(depois.map(p => p.tipo), folha.texto).toEqual(['texto', 'texto'])
  expect(depois[0]?.texto.trim(), folha.texto).toBe('interrompida')
  expect(depois[1]?.texto ?? '', folha.texto).toMatch(/^\d+:\d\d/)
})

// Regra: visual.faixa-de-estado-geral
test("com tudo fechado e a tarefa de um subagente parado depois do turno, a faixa é cinza 'interrompido'", async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, DOIS_PASSOS)
  await start($, ['A'])
  await done($, ['A'])
  await start($, ['B'])
  await lancar($, { descricao: 'revisar', segundoPlano: true })
  await fimDoTurno($)
  await fimDoSubagenteCom($, 'sub-1', { parado: true })
  const d = await noApp($)
  expect(estadoGeral(d), d.cabecalho.texto).toBe('interrompido')
  expect(d.cabecalho.texto).toContain('1 de 1')
})

// A mãe com plano de 3 níveis e start no nível 3, a filha de três níveis aberta ali e a neta ancorada
// no nível 3 da filha (as faixas em volta das linhas da neta somam 7 células), com as tarefas dadas à
// neta e as sessões publicadas por ela; o desenho no app a 100 colunas.
async function netaNoTeto($: any, on: any, tarefasDaNeta: any[], sessoesDaNeta: any[] = []) {
  fixar(on)
  const tresDoTeto = (p: string) => [estreitoTarefa(`${p}a`, `${p} nível um`, [estreitoTarefa(`${p}b`, `${p} nível dois`, [estreitoTarefa(`${p}c`, `${p} nível três`), estreitoTarefa(`${p}d`, `${p} nível três bis`)])])]
  const netaDoTeto = { id: 'local_22222222-2222-2222-2222-222222222222', name: 'neta', title: 'neta', running: true, archived: false, anchor: 'Fc', panel: { groups: [{ agent: '', label: '', tasks: tarefasDaNeta }], waits: [], children: sessoesDaNeta } }
  host(on, [{ id: 'local_11111111-1111-1111-1111-111111111111', nome: 'filha', painel: { tasks: tresDoTeto('F'), filhas: [netaDoTeto] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um', children: [{ id: '1.1', title: 'Um.um' }] }] }])
  await start($, ['1.1'])
  await abrirSessao($)
  await aviso($)
  return await noApp($, { colunas: 100 })
}
// As células de guia próprias da linha do app cujo título é exatamente `titulo`.
const guiasDoTitulo = (d: DesenhoDoApp, titulo: string) => {
  const l = d.linhas.find(x => x.pedacos.some(p => p.tipo === 'texto' && p.texto === titulo))
  return l === undefined ? undefined : guiasDe(l)
}
// A última célula (o conector) das guias da linha de título `titulo`.
const conectorDoTitulo = (d: DesenhoDoApp, titulo: string) => {
  const g = guiasDoTitulo(d, titulo)
  return g === undefined ? undefined : g[g.length - 1]
}
const NETA_COM_IRMA = [
  estreitoTarefa('Na', 'N um', [
    estreitoTarefa('Nb', 'N dois', [estreitoTarefa('Nc', 'N tres a'), estreitoTarefa('Nd', 'N tres b')]),
    estreitoTarefa('Ne', 'N outro'),
  ]),
]

// Regra: visual.titulo-legivel-no-painel-estreito
test('do 8º nível em diante, a guia da 8ª coluna não tem falha: ramo enquanto a linha seguinte desenha nela, fim na última', async ($: any, on: any) => {
  const d = await netaNoTeto($, on, NETA_COM_IRMA)
  const todas = JSON.stringify(d.linhas.map(l => [l.texto, guiasDe(l)]))
  // As quatro na mesma coluna, a do teto.
  const tamanhos = ['N dois', 'N tres a', 'N tres b', 'N outro'].map(t => guiasDoTitulo(d, t)?.length)
  expect(tamanhos.every(n => n !== undefined && n > 0), todas).toBe(true)
  expect(new Set(tamanhos).size, todas).toBe(1)
  expect(conectorDoTitulo(d, 'N dois'), todas).toBe('ramo')
  expect(conectorDoTitulo(d, 'N tres a'), todas).toBe('ramo')
  expect(conectorDoTitulo(d, 'N tres b'), todas).toBe('ramo')
  expect(conectorDoTitulo(d, 'N outro'), todas).toBe('fim')
})

// Regra: visual.titulo-legivel-no-painel-estreito
test('na 8ª coluna, a última irmã com filhas além do teto sai ramo, e a última filha, fim', async ($: any, on: any) => {
  const tresDaNeta = [estreitoTarefa('Na', 'N nível um', [estreitoTarefa('Nb', 'N nível dois', [estreitoTarefa('Nc', 'N nível três'), estreitoTarefa('Nd', 'N nível três bis')])])]
  const d = await netaNoTeto($, on, tresDaNeta)
  const todas = JSON.stringify(d.linhas.map(l => [l.texto, guiasDe(l)]))
  expect(conectorDoTitulo(d, 'N nível dois'), todas).toBe('ramo')
  expect(conectorDoTitulo(d, 'N nível três'), todas).toBe('ramo')
  expect(conectorDoTitulo(d, 'N nível três bis'), todas).toBe('fim')
})

// Regra: visual.titulo-legivel-no-painel-estreito, visual.guias-na-faixa-do-cartao
test('a faixa de um cartão cortada pelo teto leva a barra até o pé quando há linha depois dele', async ($: any, on: any) => {
  const bisneta = { id: 'local_33333333-3333-3333-3333-333333333333', name: 'bisneta', title: 'bisneta', running: true, archived: false, anchor: 'Nc', panel: { groups: [{ agent: '', label: '', tasks: [estreitoTarefa('Ba', 'B única')] }], waits: [], children: [] } }
  const d = await netaNoTeto($, on, NETA_COM_IRMA, [bisneta])
  const faixas = faixasDoApp(d)
  const todas = JSON.stringify({ faixas, linhas: d.linhas.map(l => [l.texto, guiasDe(l)]) })
  const daBisneta = faixas.find(f => f.primeira.includes('bisneta'))
  expect(daBisneta?.celulas, todas).toEqual(['ramo'])
  expect(conectorDoTitulo(d, 'N tres a'), todas).toBe('ramo')
  expect(conectorDoTitulo(d, 'N tres b'), todas).toBe('ramo')
  expect(conectorDoTitulo(d, 'N outro'), todas).toBe('fim')
})

// Regra: visual.titulo-legivel-no-painel-estreito
test('dentro de um cartão cujas faixas em volta já somam 8 células, cada linha e cada cartão mantêm o conector', async ($: any, on: any) => {
  const trineta = { id: 'local_44444444-4444-4444-4444-444444444444', name: 'trineta', title: 'trineta', running: true, archived: false, anchor: 'Bd', panel: { groups: [{ agent: '', label: '', tasks: [estreitoTarefa('Ta', 'T única')] }], waits: [], children: [] } }
  const tarefasDaBisneta = [estreitoTarefa('Ba', 'B um', [estreitoTarefa('Bb', 'B um a'), estreitoTarefa('Bc', 'B um b')]), estreitoTarefa('Bd', 'B dois')]
  const bisneta = { id: 'local_33333333-3333-3333-3333-333333333333', name: 'bisneta', title: 'bisneta', running: true, archived: false, anchor: 'Nc', panel: { groups: [{ agent: '', label: '', tasks: tarefasDaBisneta }], waits: [], children: [trineta] } }
  const d = await netaNoTeto($, on, NETA_COM_IRMA, [bisneta])
  const faixas = faixasDoApp(d)
  const todas = JSON.stringify({ faixas, linhas: d.linhas.map(l => [l.texto, guiasDe(l)]) })
  // A faixa da bisneta fecha as 8 células: dentro dela, só o conector de cada linha do 2º nível (as
  // do 1º nível de uma sessão começam sem guia, até o rótulo, como em qualquer cartão de sessão).
  expect(faixas.find(f => f.primeira.includes('bisneta'))?.celulas, todas).toEqual(['ramo'])
  expect(guiasDoTitulo(d, 'B um'), todas).toEqual([])
  expect(guiasDoTitulo(d, 'B um a'), todas).toEqual(['ramo'])
  expect(guiasDoTitulo(d, 'B um b'), todas).toEqual(['fim'])
  expect(guiasDoTitulo(d, 'B dois'), todas).toEqual([])
  // O cartão aberto ali dentro, o último, mantém a faixa de uma célula, o fim.
  expect(faixas.find(f => f.primeira.includes('trineta'))?.celulas, todas).toEqual(['fim'])
})
