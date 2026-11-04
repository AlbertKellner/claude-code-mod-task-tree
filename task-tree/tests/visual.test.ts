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
