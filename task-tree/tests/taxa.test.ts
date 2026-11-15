import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host, lancaveis, passos } from './kit/ambiente'
import { abrirSessao, aviso, fimDoTurno, lancar, pedido, plan, start } from './kit/cenario'
import { emTexto, emTextoDoApp, noApp, painel, primeiraDoApp } from './kit/leitura'

const UM = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }]
const topo = async ($: any) => (await painel($)).filter(l => l.cabecalho).map(l => l.texto).join('\n')
const altTopo = async ($: any) => (await noApp($)).cabecalho.texto

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

// Só o que o cabeçalho do app desenha: os pedaços de texto, sem os textos alternativos dos Svg.
const desenhadoNoTopo = async ($: any, colunas: number) =>
  (await noApp($, { colunas })).cabecalho.pedacos.filter(p => p.tipo === 'texto').map(p => p.texto).join(' ')

// Regra: taxa.velocidade-de-geracao, cabecalho.toks-e-ultracode-em-qualquer-largura
test('o toks/s do cabeçalho é desenhado a 60 e a 100 colunas', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const passo = passos(on, relogio)
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await passo($, { antes: 800, geracao: 2000, tokens: 200 })
  for (const colunas of [60, 100]) expect(await desenhadoNoTopo($, colunas), `${colunas} colunas`).toContain('100 toks/s')
})

// Regra: taxa.fim-do-turno-fica-aceso
test("a taxa de uma filha em versão anterior do mod (publicada como do último turno) aparece acesa, sem '(último turno)'", async ($: any, on: any) => {
  fixar(on)
  const tarefa = { id: 'f1', short: 'f1', title: 'Tarefa da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }
  host(on, [{ id: 'local_51515151-5151-5151-5151-515151515151', nome: 'filha-velha', rate: { toks: 42, live: false }, painel: { tasks: [tarefa] } }])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const d = await noApp($)
  // Os nós de texto do desenho com "42 toks/s": nenhum esmaecido.
  const achados: any[] = []
  const buscar = (x: any) => {
    if (typeof x !== 'object' || x === null) return
    if (x.type === 'Text' && JSON.stringify(x.children ?? []).includes('42 toks/s')) achados.push(x)
    for (const c of x.children ?? []) buscar(c)
  }
  buscar(d.raiz)
  expect(achados.length, emTextoDoApp(d)).toBeGreaterThan(0)
  for (const x of achados) expect(x.props?.dimColor, emTextoDoApp(d)).toBeFalsy()
  const cartao = primeiraDoApp(d, 'filha-velha')
  expect(cartao?.texto, emTextoDoApp(d)).toContain('42 toks/s')
  expect(cartao?.texto, emTextoDoApp(d)).not.toContain('último turno')
})

// Regra: taxa.passo-nao-cai-com-o-painel
test('uma falha de estado antes do stream não derruba o passo do modelo, e o passo seguinte mede', async ($: any, on: any) => {
  const { relogio, log } = fixar(on)
  const passo = passos(on, relogio)
  let quebrar = false
  on('state.get', async (_$: any, e: any, next: any) => (quebrar && e?.key === 'engine' ? { deny: 'estouro de teste' } : next(e)))
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  quebrar = true
  await passo($, { geracao: 2000, tokens: 200 })
  quebrar = false
  expect(log.some(l => l.includes('estouro')), log.join('\n')).toBe(true)
  await passo($, { geracao: 1000, tokens: 50 })
  expect(await topo($), emTexto(await painel($))).toContain('50 toks/s')
})

// Regra: taxa.fluxo-encerrado-quando-o-consumo-para
test('quem consome o stream para no meio: o fluxo de baixo é encerrado', async ($: any, on: any) => {
  fixar(on)
  let fechado = false
  on('turn.step', async function* () {
    try {
      yield { kind: 'text', index: 0, text: 'a' }
      yield { kind: 'text', index: 0, text: 'b' }
    } finally {
      fechado = true
    }
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' }
  })
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  const s = $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5' })
  for await (const _ of s) break
  expect(fechado).toBe(true)
})
