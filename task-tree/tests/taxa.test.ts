import { expect, test } from 'claude-code/testing'
import { fixar, lancaveis, passos } from './kit/ambiente'
import { fimDoTurno, lancar, pedido, plan, start } from './kit/cenario'
import { emTexto, painel, svgs } from './kit/leitura'

const UM = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }]
const topo = async ($: any) => (await painel($)).filter(l => l.cabecalho).map(l => l.texto).join('\n')
const altTopo = async ($: any) => (await svgs($))[0]?.alt ?? ''

// Regra: taxa.velocidade-de-geracao
test('o toks/s conta só do primeiro chunk ao stop', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const passo = passos(on, relogio)
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  // 200 tokens em 2 s de escrita, depois de 0,8 s até o primeiro chunk: 100, não 71.
  await passo($, { antes: 800, geracao: 2000, tokens: 200 })
  expect(await topo($), emTexto(await painel($))).toContain('100 toks/s')
})

// Regra: taxa.velocidade-de-geracao, taxa.filtros
test('o número é o do último passo válido; poucos tokens, pouco tempo ou rápido demais não o mudam', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const passo = passos(on, relogio)
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await passo($, { geracao: 2000, tokens: 200 })
  await passo($, { geracao: 1000, tokens: 50 })
  expect(await topo($)).toContain('50 toks/s')
  await passo($, { geracao: 2000, tokens: 10 })
  await passo($, { geracao: 100, tokens: 300 })
  await passo($, { geracao: 500, tokens: 900 })
  expect(await topo($)).toContain('50 toks/s')
})

// Regra: taxa.fim-do-turno-fica-aceso
test('no fim do turno o último número fica aceso, sem "(último turno)"', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const passo = passos(on, relogio)
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await passo($, { geracao: 2000, tokens: 200 })
  await fimDoTurno($)
  expect(await altTopo($)).toContain('100 toks/s')
  expect(await altTopo($)).not.toContain('último turno')
})

// Regra: taxa.subagente-mesma-medida
test('o cartão de subagente mostra a velocidade dele pela mesma regra', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const passo = passos(on, relogio)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await passo($, { geracao: 2000, tokens: 120, agente: 'sub-1' })
  const p = await painel($)
  expect(p.find(l => l.titulo === 'Explore: ler o kit')?.texto, emTexto(p)).toContain('60 toks/s')
})
