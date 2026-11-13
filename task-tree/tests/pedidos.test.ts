import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host } from './kit/ambiente'
import { abrirSessao, aviso, done, esc, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { cartoes, comHistorico, emTexto, esperarCarta, esperarEstado, esperarPalavra, linha, painel, type Linha } from './kit/leitura'

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const B: No[] = [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê um' }] }]

const indice = (p: Linha[], titulo: string) => p.indexOf(linha(p, titulo))

// Regra: pedidos.titulo-vem-do-request
test('o título do pedido vem do request do plan', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'uma mensagem bem comprida da pessoa')
  await plan($, A, 'Título curto')
  const p = await painel($)
  esperarEstado(p, 'Título curto', 'pendente')
  expect(p.some(l => l.titulo === 'uma mensagem bem comprida da pessoa'), emTexto(p)).toBe(false)
})

// Regra: pedidos.uma-mensagem-um-pedido
test('cada mensagem abre o seu pedido, com o seu plano embaixo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, B)
  const p = await painel($)
  const ordem = ['Pedido um', 'Plano A', 'Pedido dois', 'Plano B'].map(t => indice(p, t))
  expect(ordem, emTexto(p)).toEqual([...ordem].sort((x, y) => x - y))
  expect(linha(p, 'Plano B').nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Pedido dois').nivel)
})

// Regra: pedidos.aviso-do-app-nao-abre-pedido
test('um aviso do app não abre pedido', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  await aviso($)
  await plan($, [...A, ...B])
  const p = await painel($)
  expect(p.filter(l => l.titulo.startsWith('Pedido')).map(l => l.titulo), emTexto(p)).toEqual(['Pedido um'])
  expect(indice(p, 'Plano B'), emTexto(p)).toBeGreaterThan(indice(p, 'Pedido um'))
  expect(linha(p, 'Plano B').nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Pedido um').nivel)
})

// Regra: pedidos.replano-no-lugar, pedidos.plano-anterior-vira-historico
test('plan com o mesmo id substitui no lugar no mesmo pedido e interrompe o anterior em pedido novo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await plan($, [{ ...A[0]!, title: 'Plano A revisto' }])
  let p = await painel($)
  esperarEstado(p, 'Plano A revisto', 'pendente')
  expect(p.some(l => l.titulo === 'Plano A'), emTexto(p)).toBe(false)
  expect(emTexto(p)).not.toContain('✕')

  await start($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ ...A[0]!, title: 'Plano A novo' }])
  p = await comHistorico($, 1)
  esperarEstado(p, 'Plano A revisto', 'concluida')
  esperarEstado(p, 'Plano A novo', 'pendente')
  expect(indice(p, 'Plano A revisto'), emTexto(p)).toBeLessThan(indice(p, 'Pedido dois'))
  expect(indice(p, 'Plano A novo'), emTexto(p)).toBeGreaterThan(indice(p, 'Pedido dois'))
})

// Regra: turnos.pai-com-filha-concluida-nunca-interrompido
test('no Esc, pai com filha concluída fica aguardando, nunca interrompido', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'C', title: 'Plano C', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2'])
  await esc($)
  const p = await painel($)
  esperarEstado(p, 'Dois', 'interrompida')
  esperarEstado(p, 'Plano C', 'concluida')
  esperarEstado(p, 'Pedido um', 'concluida')
})

// Regra: arvore.pai-fecha-com-nada-aberto-embaixo
test('pai e pedido com ✓ e ✕ embaixo ficam concluídos, com as ✕ fora do x/y', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }])
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2'])
  await done($, ['2'])
  await start($, ['3'])
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'A', title: 'Plano novo', children: [{ id: '1', title: 'Xis' }] }])
  const p = await comHistorico($, 1)
  esperarEstado(p, 'Pedido um', 'concluida')
  esperarEstado(p, 'Plano A', 'concluida')
  esperarEstado(p, 'Três', 'interrompida')
  esperarPalavra(p, 'Plano A', '2/2')
})

// Regra: arvore.pai-fecha-com-nada-aberto-embaixo
test('pai e pedido com só ✕ embaixo ficam concluídos, e a folha segue interrompida', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await esc($)
  const p = await painel($)
  esperarEstado(p, 'Um', 'interrompida')
  esperarEstado(p, 'Plano A', 'concluida')
  esperarEstado(p, 'Pedido um', 'concluida')
})

// Regra: arvore.pai-fecha-com-nada-aberto-embaixo
test('pai com concluída e pendente embaixo segue aguardando', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Pedido um', 'aguardando')
})

// Replano no mesmo pedido. Origem: decisão do usuário de 2026-10-27, replano preserva o estado.
const A2: No[] = [
  { id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }, { id: '2.2', title: 'Dois.dois' }] }] },
]
const comTres = (title = 'Plano A'): No[] => [{ ...A2[0]!, title, children: [...A2[0]!.children!, { id: '3', title: 'Três' }] }]

// Regra: pedidos.replano-preserva-estado
test('replano no mesmo pedido mantém a tarefa em andamento', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await plan($, [{ ...A2[0]!, title: 'Plano A revisto' }])
  const p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Plano A revisto', 'andamento')
  expect(p.some(l => l.titulo === 'Plano A'), emTexto(p)).toBe(false)
})

// Regra: pedidos.replano-preserva-estado
test('replano mantém o concluído e acrescenta a nova pendente', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await done($, ['1'])
  await plan($, comTres())
  const p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  esperarEstado(p, 'Três', 'pendente')
  expect(emTexto(p)).toContain('1 de 4')
})

// Regra: pedidos.replano-preserva-estado
test('replano sem uma tarefa a tira do painel e mantém o resto', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await plan($, [{ ...A2[0]!, children: [A2[0]!.children![0]!] }])
  const p = await painel($)
  for (const t of ['Dois', 'Dois.um', 'Dois.dois']) expect(p.some(l => l.titulo === t), emTexto(p)).toBe(false)
  esperarEstado(p, 'Um', 'andamento')
})

// Regra: pedidos.replano-preserva-estado
test('pai abaixo do nível 1 concluído que ganha filha nova no replano volta a aberto', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  for (const id of ['2.1', '2.2']) {
    await start($, [id])
    await done($, [id])
  }
  esperarEstado(await painel($), 'Dois', 'concluida')
  const dois = A2[0]!.children![1]!
  await plan($, [{ ...A2[0]!, children: [A2[0]!.children![0]!, { ...dois, children: [...dois.children!, { id: '2.3', title: 'Dois.três' }] }] }])
  const p = await painel($)
  expect(['andamento', 'aguardando'], emTexto(p)).toContain(linha(p, 'Dois').estado)
  esperarEstado(p, 'Dois.três', 'pendente')
  esperarEstado(p, 'Dois.um', 'concluida')
  esperarEstado(p, 'Dois.dois', 'concluida')
  esperarEstado(p, 'Um', 'pendente')
})

// Regra: pedidos.nivel1-concluido-e-historico
test('plan com o id de um nível 1 concluído deixa o concluído como histórico e põe um plano novo ao lado', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  for (const id of ['1', '2.1', '2.2']) {
    await start($, [id])
    await done($, [id])
  }
  await plan($, A2)
  const p = await painel($)
  const planos = p.filter(l => l.titulo === 'Plano A')
  expect(planos.map(l => l.estado), emTexto(p)).toEqual(['concluida', 'pendente'])
})


// Regra: pedidos.id-reusado-nao-segura-pedido-concluido
test('plan que reusa o id de um nível 1 concluído num pedido novo não segura o pedido anterior todo concluído', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Primeira' }, { id: '2', title: 'Segunda' }])
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2'])
  await done($, ['2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '1', title: 'Primeira de novo' }, { id: '3', title: 'Terceira' }])
  await start($, ['3'])
  const p = await painel($)
  expect(p.some(l => ['Pedido um', 'Primeira', 'Segunda'].includes(l.titulo)), emTexto(p)).toBe(false)
  expect(p.some(l => l.titulo === '+1 pedidos anteriores'), emTexto(p)).toBe(true)
  esperarEstado(p, 'Primeira de novo', 'pendente')
  esperarEstado(p, 'Terceira', 'andamento')
})

// Regra: pedidos.resumida-mantem-anteriores-com-algo-aberto
test('o pedido concluído cujo id o pedido novo reusa segue à vista enquanto outro pedido do trabalho tem algo aberto', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, B)
  await start($, ['b1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '1', title: 'Primeira' }])
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido três')
  await plan($, [{ id: '1', title: 'Primeira de novo' }])
  const p = await painel($)
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(false)
  expect(indice(p, 'Pedido um'), emTexto(p)).toBeLessThan(indice(p, 'Pedido dois'))
  expect(indice(p, 'Pedido dois'), emTexto(p)).toBeLessThan(indice(p, 'Pedido três'))
  esperarEstado(p, 'Primeira', 'concluida')
  esperarEstado(p, 'Primeira de novo', 'pendente')
})

// A mensagem entregue com o turno em curso (o `turnId` do turno que rodava): a de outra sessão e a
// que a pessoa digita por cima do turno. K1 é uma sessão que esta abriu; MAE, uma que não.
const K1 = 'local_11111111-1111-1111-1111-111111111111'
const MAE = 'local_22222222-2222-2222-2222-222222222222'
const relatoNoMeio = ($: any, de: string, texto: string) =>
  $.prompt.submit({ text: `<cross-session-message from="${de}" name="outra">${texto}</cross-session-message>`, turnId: 't', origin: { kind: 'peer', from: de } })
const digitadaNoMeio = ($: any, texto: string) => $.prompt.submit({ text: texto, turnId: 't', origin: { kind: 'composer' }, wait: false })
// As linhas de pedido e as cartas do painel, pelos títulos.
const pedidosECartas = (p: Linha[]) => p.filter(l => l.titulo.startsWith('Pedido') || l.carta !== undefined).map(l => l.titulo)

// Regra: pedidos.mensagem-no-meio-do-turno-continua-o-pedido
test('mensagem entregue no meio do turno continua o pedido em curso: sem pedido novo, e o replano guarda o estado', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [{ id: '1', short: '1', title: 'Tarefa da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }] } }])
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await relogio.advance(1000)
  // O relato da filha chega com o turno em curso, e o modelo replaneja o nível 1 em que trabalha.
  await relatoNoMeio($, K1, 'Relato da filha')
  await plan($, comTres())
  let p = await painel($)
  expect(pedidosECartas(p), emTexto(p)).toEqual(['Pedido um'])
  expect(p.some(l => / pedidos anteriores$/.test(l.titulo)), emTexto(p)).toBe(false)
  expect(emTexto(p)).not.toContain('✕')
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Três', 'pendente')
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  // A filha confirma a entrega por esta mensagem: ela segue publicada como recebida.
  expect((h.proprio()?.received ?? []).map((r: any) => r.from)).toEqual([K1])
  // A mensagem que a pessoa digita por cima do turno: o mesmo.
  await digitadaNoMeio($, 'Pedido no meio: mais uma coisa')
  await plan($, comTres('Plano A revisto'))
  p = await painel($)
  expect(pedidosECartas(p), emTexto(p)).toEqual(['Pedido um'])
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Plano A revisto', 'andamento')
  // A mensagem de uma sessão que esta não abriu (a que a abriu, uma irmã) segue abrindo o seu pedido,
  // com a carta, mesmo no meio do turno.
  await relatoNoMeio($, MAE, 'Recado de outra sessão')
  await plan($, B)
  p = await painel($)
  expect(pedidosECartas(p), emTexto(p)).toEqual(['Pedido um', 'Recado de outra sessão'])
  esperarCarta(p, 'Recado de outra sessão', 'fila')
  expect(linha(p, 'Plano B').nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Recado de outra sessão').nivel)
  esperarEstado(p, 'Um', 'andamento')
  // Com o turno terminado, a mensagem seguinte abre o seu pedido, como antes.
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'C', title: 'Plano C', children: [{ id: 'c1', title: 'Cê um' }] }])
  p = await painel($)
  expect(pedidosECartas(p), emTexto(p)).toEqual(['Pedido um', 'Recado de outra sessão', 'Pedido dois'])
  expect(linha(p, 'Plano C').nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Pedido dois').nivel)
})
