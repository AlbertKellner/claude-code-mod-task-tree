import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host } from './kit/ambiente'
import { abrirSessao, aviso, done, esc, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { estadoGeral, montarNoApp, noApp, pedacosDepois, svgs } from './kit/leitura'

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

// O título de uma linha do app desktop: o texto inteiro, que o CSS corta com "…" na largura real.
const LONGO = 'Um título bem comprido que não cabe inteiro na linha do painel de tarefas, de jeito nenhum'
const desenhado = (fonte: string) => /<foreignObject [^>]*><div [^>]*>([^<]*)<\/div>/.exec(fonte)?.[1] ?? ''
// O que o título deixa à direita, na largura real: calc(100% - N px), menos onde ele começa.
const aDireita = (fonte: string) => {
  const m = /<foreignObject x="([\d.]+)"[^>]*calc\(100% - ([\d.]+)px\)/.exec(fonte)
  return Number(m?.[2]) - Number(m?.[1])
}

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
  const folha = (await svgs($)).find(s => !s.isInteractive && desenhado(s.source).startsWith('Um título'))!.source
  // Onde o título termina, na largura do harness (432 px): o que ele deixa à direita, descontado.
  const fim = 432 - aDireita(folha)
  const tempo = Number(/<text [^>]*x="([\d.]+)"[^>]*tabular-nums">0:00</.exec(folha)?.[1])
  // A coluna da contagem termina 12 px antes de TIME_W (≈ 46 px) à esquerda do fim do tempo.
  expect(fim).toBeGreaterThan(tempo - 46)
  // E o título cortado não entra no tempo ("0:00" ≈ 24 px).
  expect(fim).toBeLessThan(tempo - 24)
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
  const respostas = (await svgs($)).filter(s => !s.isInteractive && desenhado(s.source).startsWith('Folha cortava'))
  expect(respostas.length).toBe(1)
  for (const r of respostas) {
    // O corte é o da borda: o recorte só desconta o que fica à direita da borda (≤ 12 px), não a folga de 10 px.
    const recorte = aDireita(r.source)
    expect(recorte).toBeLessThanOrEqual(12)
  }
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
