import { expect, test } from 'claude-code/testing'
import { fixar } from './kit/ambiente'
import { aviso, done, esc, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { emTexto, esperarEstado, linha, painel, type Linha } from './kit/leitura'

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const B: No[] = [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê um' }] }]

const indice = (p: Linha[], titulo: string) => p.indexOf(linha(p, titulo))

// Origem: o request do plan dá o título do pedido.
test('o título do pedido vem do request do plan', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'uma mensagem bem comprida da pessoa')
  await plan($, A, 'Título curto')
  const p = await painel($)
  esperarEstado(p, 'Título curto', 'pendente')
  expect(p.some(l => l.titulo === 'uma mensagem bem comprida da pessoa'), emTexto(p)).toBe(false)
})

// Origem: o painel agrupa as tarefas pela mensagem do usuário em que foram planejadas.
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

// Origem: avisos do app não abrem pedido (prompts sem turno).
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

// Origem: plan com o mesmo id; o usuário confirmou que o plano substituído por pedido novo segue ✕.
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
  p = await painel($)
  esperarEstado(p, 'Plano A revisto', 'interrompida')
  esperarEstado(p, 'Plano A novo', 'pendente')
  expect(indice(p, 'Plano A revisto'), emTexto(p)).toBeLessThan(indice(p, 'Pedido dois'))
  expect(indice(p, 'Plano A novo'), emTexto(p)).toBeGreaterThan(indice(p, 'Pedido dois'))
})

// Origem: "se existem tarefas concluidas como filhas, o pai nunca pode ficar como interrompido".
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
  esperarEstado(p, 'Plano C', 'aguardando')
  esperarEstado(p, 'Pedido um', 'aguardando')
})

// Replano no mesmo pedido. Origem: decisão do usuário de 2026-10-27, replano preserva o estado.
const A2: No[] = [
  { id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }, { id: '2.2', title: 'Dois.dois' }] }] },
]
const comTres = (title = 'Plano A'): No[] => [{ ...A2[0]!, title, children: [...A2[0]!.children!, { id: '3', title: 'Três' }] }]

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

// Origem: regra do plan, um nível 1 já concluído fica como histórico e não é replanejado.
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
