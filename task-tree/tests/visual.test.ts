import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host } from './kit/ambiente'
import { abrirSessao, aviso, done, esc, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { svgs } from './kit/leitura'

// O cabeçalho do app desktop (V4): a faixa de estado geral, lida pela classe dela no SVG do cabeçalho.

const UM: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }]
const faixa = async ($: any) => {
  const cabecalho = (await svgs($))[0]?.source ?? ''
  return /class="fx fx-([a-z]+)"/.exec(cabecalho)?.[1]
}

// Regra: visual.faixa-de-estado-geral
test('a faixa do cabeçalho: em andamento, aguardando, concluído e interrompido', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, UM)
  // Só pendentes, nada iniciado: âmbar claro, aguardando.
  expect(await faixa($)).toBe('paused')
  await start($, ['1'])
  expect(await faixa($)).toBe('current')
  // As pílulas seguem nos grupos que a animação lê.
  expect((await svgs($))[0]?.source).toContain('class="ch-current"')
  await fimDoTurno($)
  expect(await faixa($)).toBe('paused')
  await pedido($, 'Pedido dois')
  await done($, ['1'])
  expect(await faixa($)).toBe('done')
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
  expect(await faixa($)).toBe('running')
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê' }] }])
  await start($, ['b1'])
  expect(await faixa($)).toBe('current')
  await esc($)
  expect(await faixa($)).not.toBe('current')
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
  const fontes = (await svgs($)).filter(s => !s.isInteractive).map(s => s.source)
  // O pai (com contagem e barra) vem antes da filha (sem contagem), com o mesmo título.
  const [pai, filha] = fontes.filter(f => desenhado(f) === LONGO) as [string, string]
  // A filha deixa à direita só o tempo e a folga; o pai, também a contagem, a barra e o ramo.
  expect(aDireita(filha)).toBeLessThan(aDireita(pai) - 60)
  expect(fontes.some(f => desenhado(f) === 'Curta')).toBe(true)
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
  const todas = await svgs($)
  expect(todas.some(s => desenhado(s.source) === LONGO)).toBe(true)
  expect(todas.filter(s => s.isInteractive).length).toBe(0)
  expect(todas.some(s => s.source.includes('<title'))).toBe(false)
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
