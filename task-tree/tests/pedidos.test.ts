import { expect } from 'claude-code/testing'
import { test } from './kit/teste'
import { AGORA, fixar, host, lancaveis } from './kit/ambiente'
import { abrirSessao, aviso, done, esc, falha, fimDoSubagenteCom, fimDoTurno, lancar, pedido, plan, start, type No } from './kit/cenario'
import { cabecalho } from './kit/leitura'
import { cartoes, comHistorico, emTexto, esperarCarta, esperarEstado, esperarPalavra, linha, montar, painel, temBusto, type Linha } from './kit/leitura'

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

// Regra: pedidos.titulo-vem-do-request
test('o request de outro plan do mesmo pedido não muda o título; o pedido seguinte ganha o seu', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'uma mensagem')
  await plan($, A, 'Auditar o mod')
  await plan($, B, 'Relato da auditoria')
  let p = await painel($)
  esperarEstado(p, 'Auditar o mod', 'pendente')
  expect(p.some(l => l.titulo === 'Relato da auditoria'), emTexto(p)).toBe(false)
  expect(indice(p, 'Plano B'), emTexto(p)).toBeGreaterThan(indice(p, 'Auditar o mod'))
  expect(linha(p, 'Plano B').nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Auditar o mod').nivel)
  await fimDoTurno($)
  await aviso($)
  await plan($, [{ id: 'C', title: 'Plano C', children: [{ id: 'c1', title: 'Cê um' }] }], 'Conferir o relato')
  p = await painel($)
  esperarEstado(p, 'Auditar o mod', 'pendente')
  expect(p.some(l => l.titulo === 'Conferir o relato'), emTexto(p)).toBe(false)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'D', title: 'Plano D', children: [{ id: 'd1', title: 'Dê um' }] }])
  await plan($, [{ id: 'E', title: 'Plano E', children: [{ id: 'e1', title: 'É um' }] }], 'Título dois')
  p = await painel($)
  expect(p.some(l => l.titulo === 'Título dois'), emTexto(p)).toBe(true)
  expect(p.some(l => l.titulo === 'Pedido dois'), emTexto(p)).toBe(false)
  expect(p.some(l => l.titulo === 'Auditar o mod'), emTexto(p)).toBe(true)
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

// Regra: pedidos.replano-mantem-o-falhou
test('o replano no mesmo pedido mantém o ✕ "falhou" da tarefa que o turno com erro parou', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await falha($)
  await aviso($)
  await plan($, comTres())
  const p = await painel($)
  esperarEstado(p, 'Um', 'interrompida')
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('falhou')
  esperarEstado(p, 'Três', 'pendente')
  expect(p.filter(l => l.titulo === 'Plano A').length, emTexto(p)).toBe(1)
})

// Regra: pedidos.replano-mantem-o-falhou
test('o replano mantém o ✕ "falhou" da tarefa cujo subagente falhou', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagenteCom($, 'sub-1', { erro: true })
  await fimDoTurno($)
  await aviso($)
  let p = await painel($)
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('falhou')
  await plan($, comTres())
  p = await painel($)
  esperarEstado(p, 'Um', 'interrompida')
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('falhou')
})

// Regra: pedidos.replano-pai-que-vira-folha
test('no replano, o pai que vira folha nasce pendente, sem relógio, e segue pendente no fim do turno e no Esc', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['2.1'])
  await relogio.advance(2000)
  await done($, ['2.1'])
  await relogio.advance(3000)
  await plan($, [{ ...A2[0]!, children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await relogio.advance(4000)
  let p = await painel($)
  esperarEstado(p, 'Dois', 'pendente')
  expect([cabecalho(p).chips.andamento, cabecalho(p).chips.pendentes], emTexto(p)).toEqual([0, 2])
  expect(linha(p, 'Dois').texto, emTexto(p)).not.toMatch(/\d:\d\d/)
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Dois', 'pendente')
  expect(cabecalho(p).chips.aguardando, emTexto(p)).toBe(0)
  await pedido($, 'segue')
  await esc($)
  p = await painel($)
  esperarEstado(p, 'Dois', 'pendente')
  expect(p.filter(l => l.estado === 'interrompida').map(l => l.titulo), emTexto(p)).toEqual([])
})

// Regra: pedidos.replano-folha-que-ganha-subtarefas
test('no replano, a folha em andamento que ganha subtarefas passa o andamento à primeira', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await relogio.advance(5000)
  const ganha = (): No[] => [{ ...A2[0]!, children: [{ id: '1', title: 'Um', children: [{ id: '1.1', title: 'Um.um' }, { id: '1.2', title: 'Um.dois' }] }, A2[0]!.children![1]!] }]
  await plan($, ganha())
  let p = await painel($)
  esperarEstado(p, 'Um.um', 'andamento')
  esperarEstado(p, 'Um.dois', 'pendente')
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Plano A', 'andamento')
  expect(cabecalho(p).chips.andamento, emTexto(p)).toBe(1)
  expect(linha(p, 'Um.um').texto, emTexto(p)).toContain('0:05')
  await done($, ['1.1'])
  esperarEstado(await painel($), 'Um.dois', 'pendente')
  await start($, ['1.2'])
  await fimDoTurno($)
  esperarEstado(await painel($), 'Um.dois', 'aguardando')
})

// Regra: pedidos.replano-folha-que-ganha-subtarefas
test('no replano, a folha parada com Esc que ganha subtarefas não deixa a marca de parada no pai', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await esc($)
  await aviso($)
  await plan($, [{ ...A2[0]!, children: [{ id: '1', title: 'Um', children: [{ id: '1.1', title: 'Um.um' }, { id: '1.2', title: 'Um.dois' }] }, A2[0]!.children![1]!] }])
  let p = await painel($)
  esperarEstado(p, 'Um.um', 'pendente')
  esperarEstado(p, 'Um.dois', 'pendente')
  expect(p.filter(l => l.estado === 'interrompida').map(l => l.titulo), emTexto(p)).toEqual([])
  for (const id of ['1.1', '1.2']) {
    await start($, [id])
    await done($, [id])
  }
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  expect(cabecalho(p).chips.interrompidas, emTexto(p)).toBe(0)
  const principal = (h.proprio()?.groups ?? []).find((g: any) => g.agent === '')
  expect(JSON.stringify(principal?.tasks ?? []), JSON.stringify(principal)).not.toContain('"stopped":true')
})

// Regra: pedidos.nivel1-concluido-e-historico
test('plan com o id de um nível 1 concluído deixa o concluído como histórico e põe um plano novo ao lado', async ($: any, on: any) => {
  // No pedido seguinte (no mesmo pedido, o concluído reabre: decisão do usuário, 2026-11-14,
  // "Reabre mantendo os ✓ (Recomendado)").
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  for (const id of ['1', '2.1', '2.2']) {
    await start($, [id])
    await done($, [id])
  }
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, A2)
  const p = await comHistorico($, 1)
  const planos = p.filter(l => l.titulo === 'Plano A')
  expect(planos.map(l => l.estado), emTexto(p)).toEqual(['concluida', 'pendente'])
  const dois = p.findIndex(l => l.titulo === 'Pedido dois')
  expect(p.indexOf(planos[0]!), emTexto(p)).toBeLessThan(dois)
  expect(p.indexOf(planos[1]!), emTexto(p)).toBeGreaterThan(dois)
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

// Regra: pedidos.replano-aceita-o-id-completo
test('replano com os ids completos que os lembretes mostram mantém a concluída e a em andamento', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2.1'])
  await plan($, [
    {
      id: 'A',
      title: 'Plano A',
      children: [
        { id: 'A/1', title: 'Um' },
        { id: 'A/2', title: 'Dois', children: [{ id: 'A/2.1', title: 'Dois.um' }, { id: 'A/2.2', title: 'Dois.dois' }] },
        { id: 'A/3', title: 'Três' },
      ],
    },
  ])
  const p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  esperarEstado(p, 'Dois.um', 'andamento')
  esperarEstado(p, 'Três', 'pendente')
  expect(p.filter(l => l.titulo === 'Um').length, emTexto(p)).toBe(1)
  expect(emTexto(p)).toContain('1 de 4')
  expect((await start($, ['3'])).texto).toContain('Em andamento: Três')
})

// Regra: pedidos.nivel1-concluido-e-historico
test('no mesmo pedido, o plan com o id de um nível 1 concluído e um passo a mais o reabre mantendo os concluídos', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A2)
  for (const id of ['1', '2.1', '2.2']) {
    await start($, [id])
    await done($, [id])
  }
  await plan($, comTres())
  const p = await painel($)
  expect(p.filter(l => l.titulo === 'Plano A').length, emTexto(p)).toBe(1)
  expect(['andamento', 'aguardando']).toContain(linha(p, 'Plano A').estado)
  for (const t of ['Um', 'Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'concluida')
  esperarEstado(p, 'Três', 'pendente')
  expect(emTexto(p)).toContain('3 de 4')
})

// Regra: pedidos.nivel1-concluido-e-historico
test('no mesmo pedido, o cartão da filha segue sob a tarefa quando o nível 1 concluído é replanejado', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: K1, nome: 'filha-um', rodando: false, painel: { tasks: [{ id: '1', short: '1', title: 'Tarefa da filha', status: 'done', children: [] }] } }])
  await pedido($, 'Pedido um')
  await plan($, A2)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  for (const id of ['1', '2.1', '2.2']) {
    if (id !== '1') await start($, [id])
    await done($, [id])
  }
  await plan($, comTres())
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(p.filter(l => l.titulo === 'Um').length, emTexto(p)).toBe(1)
  esperarEstado(p, 'Um', 'concluida')
})

// Regra: pedidos.marca-so-no-comeco-do-prompt
test('o texto colado com a tag de outra sessão no meio abre pedido da pessoa e não grava recebimento', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  await pedido($, 'no log apareceu isto: <cross-session-message from="local_99999999-9999-9999-9999-999999999999" name="X">oi</cross-session-message> e mais texto')
  await plan($, A)
  const p = await painel($)
  const l = p.find(x => x.titulo.startsWith('no log apareceu isto'))
  expect(l, emTexto(p)).toBeDefined()
  expect(l?.carta, emTexto(p)).toBeUndefined()
  expect(p.some(x => x.titulo === 'oi'), emTexto(p)).toBe(false)
  expect(h.proprio()?.received ?? []).toEqual([])
})

// Regra: pedidos.marca-so-no-comeco-do-prompt
test('o texto com a marca de retorno de subagente no meio abre pedido da pessoa', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await fimDoTurno($)
  const r = await pedido($, 'o que significa [Subagent hand-back] nesse log?')
  await plan($, B)
  expect((r?.context ?? []).join(' | ')).toContain('A PRIMEIRA chamada')
  const p = await painel($)
  expect(indice(p, 'Plano B'), emTexto(p)).toBeGreaterThan(indice(p, 'o que significa [Subagent hand-back] nesse log?'))
})

// Regra: pedidos.marca-so-no-comeco-do-prompt
test('as formas reais seguem valendo: a linha de abertura do app antes da tag, o retorno de subagente e duas mensagens juntas', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  await pedido($, `Another Claude session sent a message:\n<cross-session-message from="${K1}" from-name="filha">relato</cross-session-message>`)
  await plan($, A)
  let p = await painel($)
  expect(linha(p, 'relato').carta, emTexto(p)).toBeDefined()
  expect((h.proprio()?.received ?? []).map((r: any) => r.from)).toEqual([K1])
  await $.prompt.submit({ text: 'Another Claude session sent a message:\n<agent-message from="sub-1">\n[Subagent hand-back] pronto</agent-message>' })
  await plan($, B)
  p = await painel($)
  expect(indice(p, 'Plano B'), emTexto(p)).toBeGreaterThan(indice(p, 'relato'))
  expect(p.some(x => x.titulo.startsWith('Another')), emTexto(p)).toBe(false)
  await pedido($, `<cross-session-message from="${K1}" name="filha">um</cross-session-message>\n\n<cross-session-message from="${MAE}" name="mae">dois</cross-session-message>`)
  expect((h.proprio()?.received ?? []).map((r: any) => r.from)).toEqual([K1, K1, MAE])
})

// Regra: pedidos.replano-leva-o-cartao-ao-nivel-1
test('o cartão da filha cuja tarefa de origem sai do plano fica sob o nível 1, vivo ou concluído, e segue contando', async ($: any, on: any) => {
  fixar(on)
  const K1 = 'local_11111111-1111-1111-1111-111111111111'
  const t = (id: string, title: string, feita: boolean, iniciada = false) => ({ id, short: id, title, status: feita ? 'done' : 'open', ...(iniciada ? { started: 1, startedAt: AGORA - 1000 } : {}), children: [] })
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [t('f1', 'Efe um', true), t('f2', 'Efe dois', false, true)] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }, { id: '2.2', title: 'Dois.dois' }] }] }])
  await start($, ['2.1'])
  await abrirSessao($)
  await aviso($)
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '3', title: 'Três' }] }])
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Plano A'])
  expect(p.some(l => l.titulo.startsWith('filha-um · do pedido')), emTexto(p)).toBe(false)
  expect(linha(p, 'Plano A').texto, emTexto(p)).toContain('1/4')
  expect(temBusto(p, 'Plano A'), emTexto(p)).toBe(true)
  esperarEstado(p, 'Plano A', 'andamento')
  h.filha(K1).rodando = false
  h.filha(K1).painel = { tasks: [t('f1', 'Efe um', true), t('f2', 'Efe dois', true)] }
  await aviso($)
  p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Plano A'])
  esperarPalavra(p, 'filha-um', 'concluída')
  expect(linha(p, 'Plano A').texto, emTexto(p)).toContain('2/4')
})

// Regra: pedidos.dobra-nao-passa-ao-id-reusado
test('a dobra do nível 1 antigo não passa ao nível 1 novo que reusa o id', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Antigo', children: [{ id: '1.1', title: 'Antiga um' }] }])
  await start($, ['1.1'])
  await done($, ['1.1'])
  const m = await montar($)
  await m.recolher('Antigo')
  await m.fim()
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: '1', title: 'Novo', children: [{ id: '1.1', title: 'Nova um' }] }])
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Nova um'), emTexto(p)).toBe(true)
  const h = await comHistorico($, 1)
  expect(h.some(l => l.titulo === 'Antigo'), emTexto(h)).toBe(true)
  expect(h.some(l => l.titulo === 'Antiga um'), emTexto(h)).toBe(false)
})

// Regra: pedidos.resumida-mantem-anteriores-com-algo-aberto, cabecalho.limites-de-linhas
test("com mais de três pedidos, o pedido antigo com algo aberto fica inteiro e não entra em '+N pedidos anteriores'", async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido 1')
  await plan($, [{ id: 'F', title: 'Fechada' }, { id: 'G', title: 'Aberta' }])
  await start($, ['F'])
  await done($, ['F'])
  await fimDoTurno($)
  for (let i = 2; i <= 5; i++) {
    await relogio.advance(1000)
    await pedido($, `Pedido ${i}`)
    await plan($, [{ id: `P${i}`, title: `Plano ${i}` }])
    await start($, [`P${i}`])
    await done($, [`P${i}`])
    await fimDoTurno($)
  }
  const p = await painel($)
  esperarEstado(p, 'Fechada', 'concluida')
  esperarEstado(p, 'Aberta', 'pendente')
  expect(linha(p, 'Pedido 1').texto, emTexto(p)).toContain('1/2')
  expect(p.filter(l => l.texto.includes('+1 pedidos anteriores')).length, emTexto(p)).toBe(1)
  expect(p.some(l => l.texto.includes('+2 pedidos anteriores')), emTexto(p)).toBe(false)
})

// Regra: pedidos.plan-avisa-o-que-fez-as-tarefas-antigas
test('o plan avisa o nível 1 de pedido anterior que ficou como histórico, com as abertas interrompidas', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  const r = await plan($, [{ ...A[0]!, title: 'Plano A novo' }])
  expect(r.texto).toContain('Plano exibido')
  expect(r.texto).toContain('Avisos')
  expect(r.texto).toContain('pedido anterior')
  expect(r.texto).toContain('histórico')
  expect(r.texto).toContain('2 tarefas abertas interrompidas')
})

// Regra: pedidos.plan-avisa-o-que-fez-as-tarefas-antigas
test('o plan avisa o nível 1 fechado que ficou como histórico', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await done($, ['1', '2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  const r = await plan($, A)
  expect(r.texto).toContain('Plano exibido')
  expect(r.texto).toContain('já estava fechada')
})

// Regra: pedidos.plan-avisa-o-que-fez-as-tarefas-antigas
test('o replano no mesmo pedido diz quantas tarefas mantiveram o estado', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2'])
  const r = await plan($, [{ ...A[0]!, children: [...A[0]!.children!, { id: '3', title: 'Três' }] }])
  expect(r.texto).toContain('Plano exibido')
  expect(r.texto).toContain('2 tarefas mantiveram o estado')
  expect(r.texto).toContain('1 concluída, 1 em andamento')
})

// Regra: pedidos.plan-avisa-o-que-fez-as-tarefas-antigas
test('um plano sem ids repetidos não traz avisos', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  const r = await plan($, B)
  expect(r.texto).toContain('Plano exibido')
  expect(r.texto).not.toContain('Avisos')
})

// Regra: pedidos.plan-decide-com-o-estado-da-gravacao
test('uma tarefa fechada por outra escrita no meio do plan vira histórico com o cartão, e o plan avisa', async ($: any, on: any) => {
  fixar(on)
  const K1 = 'local_41414141-4141-4141-4141-414141414141'
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [] } }])
  // Armado, a próxima gravação do painel dá lugar a outra escrita (a tarefa antiga interrompida, como um
  // cancel de outra chamada a faria) e volta como perdida: o plan relê e decide de novo sobre o painel
  // já mudado (o harness não deixa o stub chamar a ferramenta).
  let armado = false
  const parar = (t: any): any => ({ ...t, status: t.status === 'open' ? 'interrupted' : t.status, started: undefined, children: t.children.map(parar) })
  on('state.set', async (_s: any, e: any, next: any) => {
    if (!armado || e.key !== 'groups') return next(e)
    armado = false
    const outra = (e.previous as any[]).map(g => (g.agent === '' ? { ...g, tasks: g.tasks.map((t: any) => (t.id === '1' ? parar(t) : t)) } : g))
    const r = await next({ ...e, value: outra })
    return { ...r, value: { ...r.value, isSet: false } }
  })
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Antiga', children: [{ id: '1.1', title: 'Passo' }] }])
  await start($, ['1.1'])
  await abrirSessao($)
  await aviso($)
  armado = true
  const r = await plan($, [{ id: '1', title: 'Nova', children: [{ id: '1.1', title: 'Passo novo' }] }])
  expect(r.texto).toContain('ficou como histórico')
  const p = await painel($)
  esperarEstado(p, 'Passo', 'interrompida')
  esperarEstado(p, 'Passo novo', 'pendente')
  expect(cartoes(p, 'filha-um')[0]?.sob, emTexto(p)).toBe('Passo')
  expect(p.some(l => l.titulo === 'Antiga'), emTexto(p)).toBe(true)
  expect(p.some(l => l.titulo === 'Nova'), emTexto(p)).toBe(true)
})
