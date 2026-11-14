import { expect, test } from 'claude-code/testing'
import { AGORA } from './kit/ambiente'
import { aviso } from './kit/cenario'
import { fixar, host, responderEnvio } from './kit/ambiente'
import { done, envio, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { comHistorico, cabecalho, emTexto, esperarEstado, montar, noApp, painel } from './kit/leitura'
import { linha, linhaDoApp, montarNoApp } from './kit/leitura'

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }, { id: '2.2', title: 'Dois.dois' }] }] }]
const B: No[] = [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'b1' }, { id: 'b2', title: 'b2' }] }]
const tem = (linhas: { titulo: string }[], titulo: string) => linhas.some(l => l.titulo === titulo)

// Regra: cabecalho.numeros-somam-o-desenhado
test('os números somam o que a visão desenha, e recolher não muda nada', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  // A dobra fica guardada: as linhas são recolhidas e depois reabertas.
  const ordem = { recolhendo: ['Dois', 'Plano A', 'Pedido um'], reabrindo: ['Pedido um', 'Plano A', 'Dois'] }
  for (const v of ['recolhendo', 'reabrindo'] as const) {
    const m = await montar($)
    let c = cabecalho(await m.linhas())
    expect([c.feitas, c.total], `${v}:\n${emTexto(await m.linhas())}`).toEqual([1, 3])
    for (const titulo of ordem[v]) {
      await m.recolher(titulo)
      const p = await m.linhas()
      c = cabecalho(p)
      expect([c.feitas, c.total], `${v}, recolhido ${titulo}:\n${emTexto(p)}`).toEqual([1, 3])
    }
    await m.fim()
  }
})

// Regra: cabecalho.resumida-exclui-pedido-finalizado, cabecalho.resumida-limpa-so-com-tudo-concluido
test('o pedido finalizado sai da resumida quando um pedido novo começa trabalho; a completa o mantém', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1', '2.1', '2.2'])
  await done($, ['1', '2.1', '2.2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, B)
  await start($, ['b1'])
  let p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  let c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([0, 2])
  expect(c.inteira, emTexto(p)).toEqual({ feitas: 3, total: 5 })
  // O que saiu fica a um clique: aberto, volta a ser desenhado e contado.
  p = await comHistorico($, 1)
  expect(tem(p, 'Plano A') && tem(p, 'Plano B'), emTexto(p)).toBe(true)
  c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([3, 5])
})

// Regra: pedidos.resumida-mantem-anteriores-com-algo-aberto
test('com algo aberto à vista, a resumida mantém o pedido anterior', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, B)
  await start($, ['b1'])
  const p = await painel($)
  expect(tem(p, 'Plano A') && tem(p, 'Plano B'), emTexto(p)).toBe(true)
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 5])
})

// Regra: cabecalho.interrompida-fora-do-total
test('a interrompida sai do total e entra no chip', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ ...A[0]!, title: 'Plano A novo' }])
  const p = await comHistorico($, 1)
  // Só as folhas (os pais ✕ não contam).
  const folhas = p.filter(l => ['Um', 'Dois.um', 'Dois.dois'].includes(l.titulo))
  const x = folhas.filter(l => l.estado === 'interrompida').length
  const c = cabecalho(p)
  expect(x, emTexto(p)).toBe(3)
  expect(c.chips.interrompidas, emTexto(p)).toBe(x)
  expect(c.total, emTexto(p)).toBe(folhas.length - x)
})

// Regra: cabecalho.chips-contam-folhas
test('os chips contam só folhas, nunca pais nem tarefas de mensagem', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  let p = await painel($)
  let c = cabecalho(p)
  expect([c.chips.andamento, c.chips.pendentes], emTexto(p)).toEqual([1, 2])
  await envio($, 'local_x')
  p = await painel($)
  c = cabecalho(p)
  // A tarefa que enviou conta pelo ícone (em andamento); a carta na fila, em "aguardando sessão".
  expect([c.chips.andamento, c.chips.sessao, c.chips.pendentes], emTexto(p)).toEqual([1, 1, 2])
})

// Regra: cabecalho.titulo-e-a-ultima-iniciada
test('o título é o nível 1 da tarefa iniciada por último', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await plan($, B)
  await start($, ['b1'])
  await done($, ['b1'])
  await relogio.advance(1000)
  await start($, ['1'])
  await done($, ['1'])
  let p = await painel($)
  expect(cabecalho(p).titulo, emTexto(p)).toBe('Plano A')
  esperarEstado(p, 'Plano A', 'andamento')
  esperarEstado(p, 'Plano B', 'aguardando')
  await relogio.advance(1000)
  await start($, ['b2'])
  p = await painel($)
  expect(cabecalho(p).titulo, emTexto(p)).toBe('Plano B')
})

// Regra: cabecalho.titulo-desempata-pela-ordem-do-start
test('dois starts no mesmo instante: o título é o do último da lista do start', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await plan($, B)
  await start($, ['b1', '1'])
  await done($, ['b1'])
  await done($, ['1'])
  const p = await painel($)
  expect(cabecalho(p).titulo, emTexto(p)).toBe('Plano A')
  esperarEstado(p, 'Plano A', 'andamento')
})

// Regra: cabecalho.limites-de-linhas
test('só os três últimos pedidos aparecem na completa; os outros viram "+N pedidos anteriores"', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  for (let i = 1; i <= 5; i++) {
    await pedido($, `Pedido ${i}`)
    await plan($, [{ id: `P${i}`, title: `Plano ${i}`, children: [{ id: `f${i}`, title: `Folha ${i}` }] }])
    await start($, [`f${i}`])
    await done($, [`f${i}`])
    await fimDoTurno($)
    await relogio.advance(1000)
  }
  const p = await painel($)
  expect(p.some(l => l.texto.includes('+4 pedidos anteriores')), emTexto(p)).toBe(true)
  expect(tem(p, 'Plano 1') || tem(p, 'Plano 4'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano 5'), emTexto(p)).toBe(true)
  // Os números somam o que está desenhado (o último pedido); a sessão inteira conta os cinco.
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 1])
  expect(c.inteira, emTexto(p)).toEqual({ feitas: 5, total: 5 })
})

// Regra: cabecalho.limite-de-cartoes-antigos
test('o cartão parado, sem tarefa de origem e de antes dos três últimos pedidos vira "+1 cartões antigos de sessões"', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const antiga = { id: '1', short: '1', title: 'Tarefa antiga', status: 'done', startedAt: AGORA - 5000, endedAt: AGORA - 4000, turn: 1, children: [] }
  host(on, [{ id: 'local_33333333-3333-3333-3333-333333333333', nome: 'filha-antiga', rodando: false, painel: { tasks: [antiga], turns: [{ id: 1, title: 't', at: AGORA - 5000 }] } }])
  for (let i = 1; i <= 4; i++) {
    await relogio.advance(1000)
    await pedido($, `Pedido ${i}`)
    await plan($, [{ id: `P${i}`, title: `Plano ${i}`, children: [{ id: `f${i}`, title: `Folha ${i}` }] }])
    await start($, [`f${i}`])
    await done($, [`f${i}`])
    await fimDoTurno($)
  }
  await aviso($)
  // Fechada, a linha dos pedidos anteriores guarda também os cartões antigos.
  const fechado = await painel($)
  expect(fechado.some(l => l.texto.includes('cartões antigos')), emTexto(fechado)).toBe(false)
  const p = await comHistorico($, 3)
  expect(p.some(l => l.texto.includes('+1 cartões antigos de sessões')), emTexto(p)).toBe(true)
  expect(p.some(l => l.titulo === 'filha-antiga'), emTexto(p)).toBe(false)
})

// Um plano de a × b × c tarefas (níveis 1, 2 e 3), com títulos `${prefixo}a.b.c`.
const grande = (prefixo: string, a: number, b: number, c: number): No[] =>
  Array.from({ length: a }, (_, i) => ({
    id: `${i}`,
    title: `${prefixo}${i}`,
    children: Array.from({ length: b }, (_, j) => ({ id: `${i}.${j}`, title: `${prefixo}${i}.${j}`, children: Array.from({ length: c }, (_, k) => ({ id: `${i}.${j}.${k}`, title: `${prefixo}${i}.${j}.${k}` })) })),
  }))

// Regra: cabecalho.limite-de-linhas-do-desenho
test('um pedido grande demais é desenhado até o limite e fecha com "+N linhas"', { timeoutMs: 15000 }, async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido grande')
  await plan($, grande('T', 8, 8, 7))
  const p = await painel($)
  const desenho = p.filter(l => !l.cabecalho)
  expect(desenho.length, emTexto(p).slice(-500)).toBeLessThanOrEqual(400)
  // O pedido tem 1 + 8 + 64 + 448 = 521 linhas; as que não couberam viram a última.
  expect(desenho[desenho.length - 1]?.texto, emTexto(p).slice(-500)).toMatch(new RegExp(`\\+${521 - (desenho.length - 1)} linhas$`))
  expect(p.some(l => l.texto.includes('linhas anteriores')), emTexto(p).slice(0, 500)).toBe(false)
  expect(p.some(l => l.titulo === 'T0.0.0'), emTexto(p).slice(0, 500)).toBe(true)
})

// Regra: cabecalho.limite-de-linhas-do-desenho
test('pedidos antigos saem inteiros do começo, contados em "+N linhas anteriores"', { timeoutMs: 15000 }, async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, grande('U', 8, 8, 4))
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, grande('D', 8, 8, 4))
  await relogio.advance(1000)
  await pedido($, 'Pedido três')
  await plan($, [{ id: 'P', title: 'Plano pequeno', children: [{ id: 'p1', title: 'Pequeno um' }, { id: 'p2', title: 'Pequeno dois' }] }])
  const p = await comHistorico($, 1)
  const desenho = p.filter(l => !l.cabecalho)
  expect(desenho.length, emTexto(p).slice(0, 500)).toBeLessThanOrEqual(400)
  expect(desenho[0]?.texto, emTexto(p).slice(0, 500)).toMatch(/^\+\d+ linhas anteriores$/)
  for (const titulo of ['Pedido três', 'Plano pequeno', 'Pequeno um', 'Pequeno dois']) expect(p.some(l => l.titulo === titulo), titulo).toBe(true)
  expect(p.some(l => /\+\d+ linhas$/.test(l.texto.trim())), emTexto(p).slice(-500)).toBe(false)
})

// Regra: cabecalho.historico-abre-com-clique
test('"+N pedidos anteriores" abre com um clique, fechado por padrão, e fecha de novo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  for (let i = 1; i <= 5; i++) {
    await pedido($, `Pedido ${i}`)
    await plan($, [{ id: `P${i}`, title: `Plano ${i}`, children: [{ id: `f${i}`, title: `Folha ${i}` }] }])
    await start($, [`f${i}`])
    await done($, [`f${i}`])
    await fimDoTurno($)
    await relogio.advance(1000)
  }
  const m = await montar($)
  let p = await m.linhas()
  expect(tem(p, 'Plano 1') || tem(p, 'Plano 2'), emTexto(p)).toBe(false)
  await m.recolher('+4 pedidos anteriores')
  p = await m.linhas()
  expect(tem(p, 'Plano 1') && tem(p, 'Plano 2') && tem(p, 'Plano 5'), emTexto(p)).toBe(true)
  expect(p.filter(l => l.titulo === '+4 pedidos anteriores').length, emTexto(p)).toBe(1)
  await m.recolher('+4 pedidos anteriores')
  p = await m.linhas()
  expect(tem(p, 'Plano 1'), emTexto(p)).toBe(false)
  await m.fim()
})

// O painel do app desktop montado (o kit diz se virou o aviso de painel grande, o tamanho do desenho e o
// texto de cada linha; o harness não vê a pintura: checklist do app), com a linha que conta o que o corte
// tirou do começo e a que conta o que tirou do fim do último pedido.
const LIMITE = 600 * 1024
// Títulos longos (≈ 250 caracteres), para o desenho passar de 600 KB com linhas mais leves; não mais,
// porque o harness só desenha os primeiros 100.000 caracteres de texto (o resto sai como "not drawn").
const LONGO = 'com um título comprido, como os de uma sessão real, que passa da largura do painel; '.repeat(3).trim()
async function cortado($: any) {
  const d = await noApp($)
  return { ...d, antes: d.textos.find(t => /\+\d+ linhas anteriores$/.test(t)), depois: d.textos.find(t => /\+\d+ linhas$/.test(t)) }
}
const kb = (d: { bytes: number }) => `${Math.round(d.bytes / 1024)} KB`
// "Pedido um": 1 + 8 + 64 + 320 linhas de títulos longos, todas as folhas iniciadas e com tempo; `abertas`
// delas ficam abertas, as outras concluídas. São menos de 400 linhas e mais de 600 KB no app desktop (no
// SVG por linha e no nativo): o corte que os testes abaixo veem é o do tamanho, não o das 400 linhas.
async function pedidoPesado($: any, relogio: any, abertas: number) {
  const plano: No[] = grande('U', 8, 8, 5).map(a => ({ ...a, children: (a.children ?? []).map(b => ({ ...b, title: `${b.title} ${LONGO}`, children: (b.children ?? []).map(c => ({ ...c, title: `${c.title} ${LONGO}` })) })) }))
  const folhas = plano.flatMap(a => (a.children ?? []).flatMap(b => (b.children ?? []).map(c => c.id)))
  await pedido($, 'Pedido um')
  await plan($, plano)
  await start($, folhas)
  await relogio.advance(65000)
  await done($, folhas.slice(0, folhas.length - abertas))
}
// "Pedido dois", pequeno, depois do fim do turno do pedido um.
async function pedidoPequeno($: any, relogio: any) {
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'P', title: 'Plano pequeno', children: [{ id: 'p1', title: 'Pequeno um' }, { id: 'p2', title: 'Pequeno dois' }] }])
  await start($, ['p1'])
}

// Regra: cabecalho.limite-de-linhas-do-desenho
test('sem nada aberto, um desenho acima de 600 KB perde os pedidos mais antigos até caber, sem aviso', { timeoutMs: 15000 }, async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  // Uma folha do pedido um segue aberta: os dois pedidos ficam à vista, sem a pessoa abrir nada.
  await pedidoPesado($, relogio, 1)
  await pedidoPequeno($, relogio)
  let d = await cortado($)
  expect(d.aviso, kb(d)).toBe(false)
  expect(d.bytes, kb(d)).toBeLessThanOrEqual(LIMITE)
  expect(d.antes, d.textos.slice(0, 3).join('\n')).toBeDefined()
  expect(d.textos.some(a => a.includes('Pequeno um')), d.textos.slice(-5).join('\n')).toBe(true)
  // Um segundo depois (o relógio redesenha o painel), o corte é o mesmo.
  const antes = d.antes
  await relogio.advance(1000)
  d = await cortado($)
  expect(d.aviso, kb(d)).toBe(false)
  expect(d.antes, d.textos.slice(0, 3).join('\n')).toBe(antes)
  // O terminal, bem abaixo do limite, segue com o desenho inteiro.
  const p = await painel($)
  expect(p.some(l => l.texto.includes('linhas anteriores')), emTexto(p).slice(0, 300)).toBe(false)
})

// Regra: cabecalho.limite-de-linhas-do-desenho
test('com "+N pedidos anteriores" aberto, o desenho acima de 600 KB corta os mais antigos, sem aviso, e volta inteiro quando ela fecha', { timeoutMs: 15000 }, async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  await pedidoPesado($, relogio, 0)
  await pedidoPequeno($, relogio)
  let d = await cortado($)
  expect(d.antes, d.textos.slice(0, 3).join('\n')).toBeUndefined()
  // A linha é aberta e fechada pelo terminal, que a desenha inteira; a escolha vale para os dois desenhos.
  const m = await montar($)
  await m.recolher('+1 pedidos anteriores')
  d = await cortado($)
  expect(d.aviso, kb(d)).toBe(false)
  expect(d.bytes, kb(d)).toBeLessThanOrEqual(LIMITE)
  expect(d.antes, d.textos.slice(0, 3).join('\n')).toBeDefined()
  expect(d.textos.some(a => a.includes('Pequeno um')), d.textos.slice(-5).join('\n')).toBe(true)
  await m.recolher('+1 pedidos anteriores')
  await m.fim()
  d = await cortado($)
  expect(d.antes, d.textos.slice(0, 3).join('\n')).toBeUndefined()
  expect(d.textos.some(a => a.includes('Pequeno um')), d.textos.slice(-5).join('\n')).toBe(true)
})

// Regra: cabecalho.limite-de-linhas-do-desenho
test('um pedido só acima de 600 KB é desenhado até caber e fecha com "+N linhas", sem aviso', { timeoutMs: 15000 }, async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  await pedidoPesado($, relogio, 1)
  const d = await cortado($)
  expect(d.aviso, kb(d)).toBe(false)
  expect(d.bytes, kb(d)).toBeLessThanOrEqual(LIMITE)
  expect(d.antes, d.textos.slice(0, 3).join('\n')).toBeUndefined()
  expect(d.textos[d.textos.length - 1], d.textos.slice(-3).join('\n')).toBe(d.depois)
  expect(d.depois, d.textos.slice(-3).join('\n')).toBeDefined()
  expect(d.textos.some(a => a.includes('U0.0.0')), d.textos.slice(0, 6).join('\n')).toBe(true)
})

// Regra: cabecalho.corte-preserva-historico-aberto
test('com "+N pedidos anteriores" aberto, o corte por tamanho deixa a linha à vista, e um clique nela fecha o histórico', { timeoutMs: 15000 }, async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  await pedidoPesado($, relogio, 0)
  await pedidoPequeno($, relogio)
  const m = await montarNoApp($)
  await m.apertar('fold:sec:turns')
  let d = await m.desenho()
  expect(d.aviso, kb(d)).toBe(false)
  expect(d.bytes, kb(d)).toBeLessThanOrEqual(LIMITE)
  const antes = d.textos.findIndex(t => /\+\d+ linhas anteriores$/.test(t))
  expect(antes, d.textos.slice(0, 3).join('\n')).toBeGreaterThanOrEqual(0)
  expect(d.textos[antes + 1], d.textos.slice(0, 3).join('\n')).toContain('+1 pedidos anteriores')
  expect(linhaDoApp(d, '+1 pedidos anteriores').botoes).toContain('fold:sec:turns')
  expect(d.textos.some(a => a.includes('Pequeno um')), d.textos.slice(-5).join('\n')).toBe(true)
  await m.apertar('fold:sec:turns')
  d = await m.desenho()
  expect(d.textos.some(t => /\+\d+ linhas anteriores$/.test(t)), d.textos.slice(0, 3).join('\n')).toBe(false)
  expect(d.textos.some(a => a.includes('Pequeno um')), d.textos.slice(-5).join('\n')).toBe(true)
  expect(d.textos.some(a => a.includes('U0')), d.textos.slice(0, 5).join('\n')).toBe(false)
  await m.fim()
})

// Regra: cabecalho.corte-preserva-historico-aberto
test('com "+N pedidos anteriores" aberto, o corte das 400 linhas deixa a linha à vista, logo depois de "+N linhas anteriores"', { timeoutMs: 15000 }, async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, grande('U', 8, 8, 4))
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, grande('D', 8, 8, 4))
  await relogio.advance(1000)
  await pedido($, 'Pedido três')
  await plan($, [{ id: 'P', title: 'Plano pequeno', children: [{ id: 'p1', title: 'Pequeno um' }, { id: 'p2', title: 'Pequeno dois' }] }])
  const m = await montar($)
  await m.recolher('+1 pedidos anteriores')
  let p = await m.linhas()
  const desenho = p.filter(l => !l.cabecalho)
  expect(desenho.length, emTexto(p).slice(0, 500)).toBeLessThanOrEqual(400)
  expect(desenho[0]?.texto, emTexto(p).slice(0, 500)).toMatch(/^\+\d+ linhas anteriores$/)
  expect(desenho[1]?.titulo, emTexto(p).slice(0, 500)).toBe('+1 pedidos anteriores')
  expect(desenho[1]?.texto, emTexto(p).slice(0, 500)).toContain('▾')
  expect(p.some(l => l.titulo === 'Pequeno um'), emTexto(p).slice(-300)).toBe(true)
  await m.recolher('+1 pedidos anteriores')
  p = await m.linhas()
  expect(linha(p, '+1 pedidos anteriores').texto, emTexto(p).slice(0, 300)).toContain('▸')
  await m.fim()
})
