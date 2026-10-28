import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host, responderDepois, responderEnvio } from './kit/ambiente'
import { aviso, done, envio, esc, ferramenta, fimDoTurno, mensagemDe, pedido, plan, start, type No } from './kit/cenario'
import { emTexto, esperarCarta, esperarEstado, linha, painel } from './kit/leitura'

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const PERGUNTA = {
  questions: [{ question: 'Qual?', header: 'Rumo', multiSelect: false, options: [{ label: 'Opção A', description: 'a' }, { label: 'Opção B', description: 'b' }] }],
}

// Regra: envios.fica-ate-entrega, envios.cor-por-estado
test('o ✉ na fila fica na tarefa, mesmo concluída, até a entrega', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  let p = await painel($)
  esperarCarta(p, 'Um', 'fila')
  expect(linha(p, 'Um').texto).toContain('na fila')
  await done($, ['1'])
  p = await painel($)
  esperarCarta(p, 'Um', 'fila')
  h.recebeu('local_x', AGORA)
  await aviso($)
  p = await painel($)
  esperarCarta(p, 'Um', 'entregue')
  expect(linha(p, 'Um').texto).toContain('entregue')
})

// Regra: envios.cor-por-estado
test('a mensagem de um plano interrompido fica cinza depois da entrega', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ ...A[0]!, title: 'Plano A novo' }])
  h.recebeu('local_x', AGORA)
  await aviso($)
  const p = await painel($)
  const cartas = p.filter(l => l.titulo === 'Um' && l.carta !== undefined)
  expect(cartas.map(l => l.carta), emTexto(p)).toEqual(['interrompida'])
  expect(cartas[0]!.texto).toContain('interrompida')
})

// Regra: envios.fila-nao-interrompe-no-fim-do-turno
test('o envio na fila não vira interrompido no fim do turno, normal ou com Esc', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await fimDoTurno($)
  let p = await painel($)
  esperarCarta(p, 'Um', 'fila')
  expect(emTexto(p)).not.toContain('✕')
  await esc($)
  p = await painel($)
  esperarCarta(p, 'Um', 'fila')
  expect(emTexto(p)).not.toContain('✕')
})

// Regra: envios.ancora-no-lote-recente
test('cada envio vai a uma tarefa do lote recente de starts ainda sem envio', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }, { id: 'local_y' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await start($, ['2'])
  await envio($, 'local_x')
  let p = await painel($)
  esperarCarta(p, 'Um', 'fila')
  await envio($, 'local_y')
  p = await painel($)
  esperarCarta(p, 'Dois', 'fila')
})

// Regra: envios.ancora-no-lote-recente
test('a tarefa iniciada antes do lote recente fica sem o envio', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }])
  await start($, ['1'])
  await relogio.advance(10_000)
  await start($, ['2'])
  await envio($, 'local_x')
  const p = await painel($)
  esperarCarta(p, 'Dois', 'fila')
  expect(linha(p, 'Um').carta, emTexto(p)).toBe(undefined)
})

// Regra: envios.ancora-no-lote-recente
test('o envio nunca vai à tarefa com pergunta aberta', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await start($, ['2'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  await envio($, 'local_x')
  const p = await painel($)
  esperarCarta(p, 'Um', 'fila')
  expect(linha(p, 'Dois').carta, emTexto(p)).toBe(undefined)
  await relogio.advance(1000)
  await resp
})

// Regra: envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
test('sem tarefa em andamento, o envio vai à pendente planejada por último', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await envio($, 'local_x')
  const p = await painel($)
  esperarCarta(p, 'Dois', 'fila')
  esperarEstado(p, 'Um', 'concluida')
})

// Regra: envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
test('sem tarefa em andamento nem pendente, o envio vai à última iniciada', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'C', title: 'Plano C', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await done($, ['1'])
  await envio($, 'local_x')
  esperarCarta(await painel($), 'Um', 'fila')
})

// Regra: envios.nivel1-recebido-mostra-carta
test('o nível 1 aberto por mensagem recebida mostra a carta, na cor do seu estado', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  await mensagemDe($, 'local_x', 'Analise isto')
  await plan($, [{ id: 'R', title: 'Plano R', children: [{ id: 'r1', title: 'Erre um' }] }])
  let p = await painel($)
  esperarCarta(p, 'Plano R', 'fila')
  await start($, ['r1'])
  await done($, ['r1'])
  p = await painel($)
  esperarCarta(p, 'Plano R', 'entregue')
})

// Regra: pedidos.replano-mantem-envio-ate-entrega
test('a tarefa de mensagem que o replano tira fica visível até a entrega', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await plan($, [{ ...A[0]!, children: [A[0]!.children![1]!] }])
  let p = await painel($)
  esperarCarta(p, 'Um', 'fila')
  h.recebeu('local_x', AGORA)
  await aviso($)
  p = await painel($)
  expect(p.some(l => l.titulo === 'Um'), emTexto(p)).toBe(false)
})

// Regra: envios.entrega-imediata-fica-verde
test('a entrega imediata aparece entregue na hora e a tarefa segue em andamento até o done', async ($: any, on: any) => {
  fixar(on)
  // A sessão destino já terminou o turno: uma filha trabalhando manteria os pais em andamento.
  host(on, [{ id: 'local_x', rodando: false }])
  const env = responderEnvio(on)
  env.modo = 'entregue'
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'C', title: 'Plano C', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await envio($, 'local_x')
  let p = await painel($)
  esperarCarta(p, 'Um', 'entregue')
  expect(linha(p, 'Um').texto).toContain('entregue')
  expect(emTexto(p)).not.toContain('na fila')
  esperarEstado(p, 'Plano C', 'andamento')
  await done($, ['1'])
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Plano C', 'concluida')
})

// Regra: envios.esc-apos-entrega-imediata
test('depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  const env = responderEnvio(on)
  env.modo = 'entregue'
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await fimDoTurno($)
  esperarCarta(await painel($), 'Um', 'entregue')
  await esc($)
  const p = await painel($)
  esperarCarta(p, 'Um', 'entregue')
  expect(emTexto(p)).not.toContain('interrompida')
  expect(linha(p, 'Plano A').estado, emTexto(p)).not.toBe('interrompida')
  esperarEstado(p, 'Dois', 'pendente')
})

// Regra: envios.fica-ate-entrega, envios.entrega-imediata-fica-verde
test('a entrega imediata e depois uma mensagem na fila à mesma sessão: cada uma no seu estado', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  const env = responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  env.modo = 'entregue'
  await envio($, 'local_x')
  await start($, ['2'])
  env.modo = 'fila'
  await envio($, 'local_x')
  let p = await painel($)
  esperarCarta(p, 'Um', 'entregue')
  esperarCarta(p, 'Dois', 'fila')
  h.recebeu('local_x', AGORA + 1)
  await aviso($)
  p = await painel($)
  esperarCarta(p, 'Um', 'entregue')
  esperarCarta(p, 'Dois', 'entregue')
})
