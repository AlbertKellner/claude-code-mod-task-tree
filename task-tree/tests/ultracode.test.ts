import { expect } from 'claude-code/testing'
import { test } from './kit/teste'
import { AGORA, armazem, estado, fixar, host, lancaveis, SESSAO } from './kit/ambiente'
import { abrirSessao, aviso, iniciarSessao, lancar, pedido, plan, retomar, start, type No } from './kit/cenario'
import { emTexto, noApp, painel, primeiraDoApp } from './kit/leitura'

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
const cartao = async ($: any) => primeiraDoApp(await noApp($), 'filha-um')?.texto ?? ''
const topo = async ($: any) => (await noApp($)).cabecalho.texto
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
  expect(alt).toContain('Opus 5.5 · xhigh')
  // À direita do modelo: depois dele no texto do cartão.
  expect(alt.indexOf('ultracode')).toBeGreaterThan(alt.indexOf('Opus 5.5 · xhigh'))
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

// Regra: ultracode.subagente-sem-palavra
test('com a sessão em ultracode, o cartão de subagente não diz "ultracode"', async ($: any, on: any) => {
  fixar(on)
  base(on)
  lancaveis(on, ['sub-1'])
  host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  await lancar($, { descricao: 'ler o kit' })
  const d = await noApp($)
  expect(d.cabecalho.texto).toContain('ultracode')
  const sub = primeiraDoApp(d, 'Explore: ler o kit')?.texto ?? ''
  expect(sub).toContain('ler o kit')
  expect(sub).not.toContain('ultracode')
})

// Só o que o cabeçalho do app desenha: os pedaços de texto, sem os textos alternativos dos Svg.
const desenhadoNoTopo = async ($: any, colunas: number) =>
  (await noApp($, { colunas })).cabecalho.pedacos.filter(p => p.tipo === 'texto').map(p => p.texto).join(' ')

// Regra: ultracode.cabecalho, cabecalho.toks-e-ultracode-em-qualquer-largura
test("com o interruptor ligado, 'ultracode' é desenhado no cabeçalho a 60 e a 100 colunas, não só no texto alternativo", async ($: any, on: any) => {
  fixar(on)
  base(on)
  host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  for (const colunas of [60, 100]) expect(await desenhadoNoTopo($, colunas), `${colunas} colunas`).toContain('ultracode')
  await $.prompt.attachment(anexo('ultra_effort_exit'))
  for (const colunas of [60, 100]) expect(await desenhadoNoTopo($, colunas), `${colunas} colunas`).not.toContain('ultracode')
})

// O interruptor guardado por sessão: os pares "1/2, 2/2" gravam num store do arquivo, e o 2/2 (módulo
// novo, state vazio: outro processo) lê dele.
const ULTRA_LIGADO: Record<string, unknown> = {}
const ULTRA_DESLIGADO: Record<string, unknown> = {}
const ULTRA_RETOMADA: Record<string, unknown> = {}
const guardouUltra = (store: Record<string, unknown>) => typeof store[`ultra:${SESSAO}`] === 'boolean'
const exigirPar = (ok: boolean) => {
  if (!ok) throw new Error('rode o par inteiro: o 1/2 não gravou')
}
async function ligarELigado($: any, on: any, store: Record<string, unknown>, desligar = false) {
  fixar(on)
  armazem(on, store)
  base(on)
  host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  if (desligar) await $.prompt.attachment(anexo('ultra_effort_exit'))
  expect(guardouUltra(store), JSON.stringify(Object.keys(store))).toBe(true)
}

// Regra: ultracode.guardado-por-sessao
test('ultracode no reinício, 1/2: o interruptor liga', async ($: any, on: any) => {
  await ligarELigado($, on, ULTRA_LIGADO)
})

// Regra: ultracode.guardado-por-sessao
test('ultracode no reinício, 2/2: o processo novo já desenha e publica a palavra', async ($: any, on: any) => {
  fixar(on)
  armazem(on, ULTRA_LIGADO)
  base(on)
  const h = host(on, [])
  exigirPar(guardouUltra(ULTRA_LIGADO))
  await iniciarSessao($)
  expect(await topo($)).toContain('ultracode')
  await pedido($, 'Pedido dois')
  await start($, ['1'])
  expect(h.proprio()?.ultracode).toBe(true)
})

// Regra: ultracode.guardado-por-sessao
test('ultracode no respawn sem session.start, 2/2: o primeiro desenho já traz a palavra', async ($: any, on: any) => {
  fixar(on)
  armazem(on, ULTRA_LIGADO)
  base(on)
  host(on, [])
  exigirPar(guardouUltra(ULTRA_LIGADO))
  expect(await topo($)).toContain('ultracode')
})

// Regra: ultracode.guardado-por-sessao
test('o aviso de saída apaga a palavra também para o processo seguinte, 1/2: liga e desliga', async ($: any, on: any) => {
  await ligarELigado($, on, ULTRA_DESLIGADO, true)
})

// Regra: ultracode.guardado-por-sessao
test('o aviso de saída apaga a palavra também para o processo seguinte, 2/2: o processo novo vem sem ela', async ($: any, on: any) => {
  fixar(on)
  armazem(on, ULTRA_DESLIGADO)
  base(on)
  host(on, [])
  exigirPar(guardouUltra(ULTRA_DESLIGADO))
  await iniciarSessao($)
  expect(await topo($)).not.toContain('ultracode')
})

// Regra: ultracode.guardado-por-sessao
test('a palavra guardada segue até o aviso de saída', async ($: any, on: any) => {
  fixar(on)
  armazem(on, ULTRA_LIGADO)
  base(on)
  host(on, [])
  exigirPar(guardouUltra(ULTRA_LIGADO))
  await iniciarSessao($)
  await pedido($, 'Pedido três')
  expect(await topo($)).toContain('ultracode')
  await $.prompt.attachment(anexo('ultra_effort_exit'))
  expect(await topo($)).not.toContain('ultracode')
  expect(ULTRA_LIGADO[`ultra:${SESSAO}`]).toBe(false)
})

// Regra: ultracode.guardado-por-sessao
test('a retomada traz o interruptor da sessão retomada', async ($: any, on: any) => {
  fixar(on)
  armazem(on, ULTRA_RETOMADA)
  base(on)
  host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  expect(await topo($)).toContain('ultracode')
  // Uma sessão sem o interruptor guardado: a retomada vem sem a palavra.
  ULTRA_RETOMADA['session:uuid-sem-ultra'] = ULTRA_RETOMADA[`session:${SESSAO}`]
  await retomar($, 'uuid-sem-ultra')
  expect(await topo($)).not.toContain('ultracode')
  // A que ligou: volta com ela.
  ULTRA_RETOMADA['session:uuid-com-ultra'] = ULTRA_RETOMADA['session:uuid-sem-ultra']
  ULTRA_RETOMADA['ultra:uuid-com-ultra'] = true
  await retomar($, 'uuid-com-ultra')
  expect(await topo($)).toContain('ultracode')
})

// Os textos desenhados da linha do cartão da filha (sem o texto alternativo do ícone), e os alts dos ícones.
const desenhadosDoCartao = async ($: any, colunas: number) => {
  const l = primeiraDoApp(await noApp($, { colunas }), 'filha-um')
  return {
    textos: (l?.pedacos ?? []).filter(p => p.tipo === 'texto').map(p => p.texto),
    alts: (l?.pedacos ?? []).filter(p => p.tipo === 'svg').map(p => p.texto).join('\n'),
  }
}

// Regra: ultracode.sai-junto-com-o-modelo
test("no cartão largo o modelo e 'ultracode' são desenhados, nessa ordem; no estreito os dois saem juntos e ficam só no texto alternativo", async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', publicado: publicado(true) }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const largo = await desenhadosDoCartao($, 100)
  const modelo = largo.textos.findIndex(t => t.includes('Opus 5.5 · xhigh'))
  const palavra = largo.textos.findIndex(t => t.includes('ultracode'))
  expect(modelo, largo.textos.join(' | ')).toBeGreaterThanOrEqual(0)
  expect(palavra, largo.textos.join(' | ')).toBeGreaterThan(modelo)
  const estreito = await desenhadosDoCartao($, 30)
  expect(estreito.textos.some(t => t.includes('Opus 5.5')), estreito.textos.join(' | ')).toBe(false)
  expect(estreito.textos.some(t => t.includes('ultracode')), estreito.textos.join(' | ')).toBe(false)
  expect(estreito.textos.some(t => t.includes('filha-um')), estreito.textos.join(' | ')).toBe(true)
  expect(estreito.alts).toContain('Opus 5.5 · xhigh')
  expect(estreito.alts).toContain('ultracode')
})

// Regra: ultracode.sai-junto-com-o-modelo
test("no terminal, nem o cartão nem o cabeçalho escrevem 'ultracode'", async ($: any, on: any) => {
  fixar(on)
  base(on)
  host(on, [{ id: K1, nome: 'filha-um', publicado: publicado(true) }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  await abrirSessao($)
  await aviso($)
  // No app a palavra está no cabeçalho e no cartão: o roteiro acendeu os dois.
  expect(await topo($)).toContain('ultracode')
  expect(await cartao($)).toContain('ultracode')
  const p = await painel($)
  expect(p.some(l => l.texto.includes('filha-um')), emTexto(p)).toBe(true)
  expect(p.filter(l => l.texto.includes('ultracode')), emTexto(p)).toEqual([])
})

// ---- O interruptor de uma sessão que já estava ligada quando o mod recarregou, e a gravação recusada.

// Um store com a sessão já na lista e um painel válido: a primeira gravação do painel não regrava tudo.
const storeComPainel = (): Record<string, unknown> => ({
  sessions: [SESSAO],
  [`session:${SESSAO}`]: { version: 1, groups: [{ agent: '', label: '', tasks: [{ id: 'V', short: 'V', title: 'Velha', status: 'done', children: [] }] }] },
})
const ULTRA_JA_LIGADA: Record<string, unknown> = storeComPainel()
const ULTRA_PUBLICADA: Record<string, unknown> = storeComPainel()
const ULTRA_RECUSADA: Record<string, unknown> = {}

// Regra: ultracode.guardado-por-sessao
test('ultracode já ligado na recarga, 1/2: o aviso de entrada repetido guarda o interruptor', async ($: any, on: any) => {
  fixar(on)
  armazem(on, ULTRA_JA_LIGADA)
  estado(on, { ultracode: true }, 'semear')
  base(on)
  host(on, [])
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  expect(guardouUltra(ULTRA_JA_LIGADA), JSON.stringify(Object.keys(ULTRA_JA_LIGADA))).toBe(true)
  expect(ULTRA_JA_LIGADA[`ultra:${SESSAO}`]).toBe(true)
})

// Regra: ultracode.guardado-por-sessao
test('ultracode já ligado na recarga, 2/2: o processo novo já desenha a palavra', async ($: any, on: any) => {
  fixar(on)
  armazem(on, ULTRA_JA_LIGADA)
  base(on)
  host(on, [])
  exigirPar(guardouUltra(ULTRA_JA_LIGADA))
  await iniciarSessao($)
  expect(await topo($)).toContain('ultracode')
})

// Regra: ultracode.guardado-por-sessao
test('com o interruptor ligado no state e nada no store, a publicação seguinte o guarda, sem aviso do motor', async ($: any, on: any) => {
  fixar(on)
  armazem(on, ULTRA_PUBLICADA)
  estado(on, { ultracode: true }, 'semear')
  base(on)
  host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  expect(guardouUltra(ULTRA_PUBLICADA), JSON.stringify(Object.keys(ULTRA_PUBLICADA))).toBe(true)
  expect(ULTRA_PUBLICADA[`ultra:${SESSAO}`]).toBe(true)
})

// Regra: ultracode.guardado-por-sessao
test('a gravação do interruptor que o store recusou é tentada de novo', async ($: any, on: any) => {
  fixar(on)
  let cheio = false
  armazem(on, ULTRA_RECUSADA, { recusar: () => cheio })
  base(on)
  host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  cheio = true
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  expect(guardouUltra(ULTRA_RECUSADA), JSON.stringify(Object.keys(ULTRA_RECUSADA))).toBe(false)
  cheio = false
  await $.prompt.attachment(anexo('ultra_effort_enter'))
  expect(guardouUltra(ULTRA_RECUSADA), JSON.stringify(Object.keys(ULTRA_RECUSADA))).toBe(true)
  expect(ULTRA_RECUSADA[`ultra:${SESSAO}`]).toBe(true)
})
