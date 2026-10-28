import { expect, test } from 'claude-code/testing'
import { fixar, host, responderEnvio } from './kit/ambiente'
import { done, envio, fimDoTurno, pedido, plan, start, visao, type No } from './kit/cenario'
import { cabecalho, emTexto, esperarEstado, montar, painel } from './kit/leitura'

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
  // A dobra fica guardada entre as visões: na completa as linhas são recolhidas, na resumida reabertas.
  const ordem = { completa: ['Dois', 'Plano A', 'Pedido um'], resumida: ['Pedido um', 'Plano A', 'Dois'] }
  for (const v of ['completa', 'resumida'] as const) {
    await visao($, v)
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
  await visao($, 'completa')
  let p = await painel($)
  expect(tem(p, 'Plano A') && tem(p, 'Plano B'), emTexto(p)).toBe(true)
  let c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([3, 5])
  await visao($, 'resumida')
  p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([0, 2])
  expect(c.inteira, emTexto(p)).toEqual({ feitas: 3, total: 5 })
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
  await visao($, 'resumida')
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
  await visao($, 'completa')
  const p = await painel($)
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
  expect([c.chips.andamento, c.chips.sessao, c.chips.pendentes], emTexto(p)).toEqual([0, 1, 2])
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
  await visao($, 'completa')
  const p = await painel($)
  expect(p.some(l => l.texto.includes('+2 pedidos anteriores')), emTexto(p)).toBe(true)
  expect(tem(p, 'Plano 1') || tem(p, 'Plano 2'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano 3') && tem(p, 'Plano 5'), emTexto(p)).toBe(true)
  // Os números somam o que a completa desenha (os três pedidos); a sessão inteira conta os cinco.
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([3, 3])
  expect(c.inteira, emTexto(p)).toEqual({ feitas: 5, total: 5 })
})
