import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host } from './kit/ambiente'
import { abrirSessao, aviso, pedido, plan, start, type No } from './kit/cenario'
import { svgs } from './kit/leitura'

const K1 = 'local_11111111-1111-1111-1111-111111111111'
const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }]
// O arquivo que a filha publica, com o modelo e, se `ultra`, o interruptor de ultracode ligado.
const publicado = (ultra: boolean) =>
  JSON.stringify({
    version: 1,
    waiting: false,
    at: AGORA,
    tasks: [{ id: '1', short: '1', title: 'Tarefa da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
    waits: [],
    children: [],
    engine: 'Opus 5.5 · xhigh',
    ...(ultra ? { ultracode: true } : {}),
  })
const cartao = async ($: any) => (await svgs($)).slice(1).map(s => s.alt).find(a => a.includes('filha-um')) ?? ''
const topo = async ($: any) => (await svgs($))[0]?.alt ?? ''
// O que está abaixo do mod devolve o texto do attachment como veio.
const base = (on: any) => on('prompt.attachment', (_$: any, e: any) => ({ text: e.text }))
const anexo = (type: string, agentId?: string) => ({ type, text: 'x', origin: { kind: 'engine' }, ...(agentId ? { agentId } : {}) })

// Regra: ultracode.cartao-da-filha
test('o cartão da filha diz "ultracode" depois do modelo enquanto ela publica o interruptor ligado', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', publicado: publicado(true) }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const alt = await cartao($)
  expect(alt).toContain('Opus 5.5 · xhigh, ultracode')
  h.filha(K1).publicado = publicado(false)
  await aviso($)
  const depois = await cartao($)
  expect(depois).toContain('Opus 5.5 · xhigh')
  expect(depois).not.toContain('ultracode')
})

// Regra: ultracode.so-o-interruptor-real, ultracode.cabecalho
test('ultra_effort_enter acende a palavra no cabeçalho e no arquivo publicado; ultra_effort_exit apaga', async ($: any, on: any) => {
  fixar(on)
  base(on)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  expect(await topo($)).not.toContain('ultracode')
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  expect(await topo($)).toContain('ultracode')
  await start($, ['1'])
  expect(h.proprio()?.ultracode).toBe(true)
  await $.prompt.attachment(anexo('ultra_effort_exit'))
  expect(await topo($)).not.toContain('ultracode')
  await start($, ['1'])
  expect(h.proprio()?.ultracode).toBeUndefined()
})

// Regra: ultracode.so-o-interruptor-real
test('a palavra digitada num prompt e o attachment de um subagente não acendem', async ($: any, on: any) => {
  fixar(on)
  base(on)
  host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await $.prompt.attachment(anexo('workflow_keyword_request'))
  await $.prompt.attachment(anexo('ultra_effort_enter', 'sub-1'))
  await pedido($, 'ative o modo ultracode')
  expect(await topo($)).not.toContain('ultracode')
})
