import { expect, test } from 'claude-code/testing'
import { fixar } from './kit/ambiente'
import { done, esc, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { emTexto, esperarEstado, painel } from './kit/leitura'

// Pai aberto no meio e no fim do turno. Origem: decisão do usuário de 2026-10-27 (◉ só no caminho
// da última tarefa iniciada no turno atual) sobre a regra "Pai aguardando" de 2026-10-20.

const A: No[] = [
  { id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }, { id: '2.2', title: 'Dois.dois' }] }] },
]
const B: No[] = [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê um' }, { id: 'b2', title: 'Bê dois' }] }]

// Regra: arvore.sem-start-nada-acende
test('sem start, plano novo fica todo pendente', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  const p = await painel($)
  for (const t of ['Pedido um', 'Plano A', 'Um', 'Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
})

// Regra: turnos.pai-e-pedido-aguardam-no-fim, turnos.pendentes-seguem-pendentes
test('no fim do turno o pai aberto e o pedido ficam aguardando', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Pedido um', 'aguardando')
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Dois', 'pendente')
  esperarEstado(p, 'Dois.um', 'pendente')
  esperarEstado(p, 'Dois.dois', 'pendente')
  expect(emTexto(p)).toContain('1 de 3')
  expect(emTexto(p)).not.toContain('interrompida')
})

// Regra: turnos.iniciada-aguarda-no-fim
test('no fim do turno a tarefa iniciada e aberta fica aguardando, e o pai também', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Dois.um', 'aguardando')
  esperarEstado(p, 'Dois', 'aguardando')
  esperarEstado(p, 'Plano A', 'aguardando')
})

// Regra: turnos.pedido-anterior-parado-aguarda
test('pedido anterior parado segue aguardando enquanto o pedido novo está em andamento', async ($: any, on: any) => {
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
  esperarEstado(p, 'Pedido dois', 'andamento')
  esperarEstado(p, 'Plano B', 'andamento')
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Pedido um', 'aguardando')
})

// Regra: turnos.continuacao-sem-start-aguarda
test('prompt novo que continua o plano, antes do start, deixa o pai aguardando', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'continua')
  const p = await painel($)
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Pedido um', 'aguardando')
})

// Pendentes nunca ✕ no fim do turno. Origem: decisão do usuário de 2026-10-27, que desfaz
// "reaproveitar o interrompida" (2026-10-24).

// Regra: turnos.pendentes-seguem-pendentes
test('fim do turno sem nenhum start deixa tudo pendente, sem nada interrompido', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await fimDoTurno($)
  const p = await painel($)
  for (const t of ['Pedido um', 'Plano A', 'Um', 'Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
})

// Regra: turnos.iniciada-aguarda-no-fim, turnos.pendentes-seguem-pendentes
test('fim do turno com uma tarefa iniciada: ela aguarda e as outras seguem pendentes', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Um', 'aguardando')
  for (const t of ['Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Pedido um', 'aguardando')
})

// Regra: turnos.esc-interrompe-so-a-iniciada
test('Esc interrompe só a tarefa iniciada; as pendentes seguem pendentes', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await esc($)
  const p = await painel($)
  esperarEstado(p, 'Um', 'interrompida')
  for (const t of ['Dois', 'Dois.um', 'Dois.dois']) esperarEstado(p, t, 'pendente')
  // Sem nada feito nem aguardando embaixo, o pai e o pedido ficam abertos (○).
  esperarEstado(p, 'Plano A', 'pendente')
  esperarEstado(p, 'Pedido um', 'pendente')
})

// Regra: turnos.prompt-seguinte-retoma
test('o prompt seguinte ao fim do turno volta ao trabalho e o start acende a tarefa', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await esc($)
  await relogio.advance(1000)
  await pedido($, 'segue')
  await start($, ['2.1'])
  const p = await painel($)
  esperarEstado(p, 'Dois.um', 'andamento')
  expect(emTexto(p)).not.toContain('✕')
})
