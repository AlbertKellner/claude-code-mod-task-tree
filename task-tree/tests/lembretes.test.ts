import { expect, test } from 'claude-code/testing'
import { fixar } from './kit/ambiente'
import { done, esc, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'

// Lembretes ao modelo na mensagem seguinte. Origem: decisão do usuário de 2026-10-27 ("precisa
// replanejar quando eu interrompo e envio nova mensagem"); a de outra sessão já fazia isso.

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const REPLANEJAR = 'replaneje o painel'
const ABERTAS = 'deixe abertas só as que continuam'

// O contexto que o mod passa adiante ao modelo, numa linha só.
const contexto = (r: any) => (r?.context ?? []).join(' | ')

async function iniciar($: any, on: any) {
  fixar(on)
  await pedido($, 'Primeiro pedido')
  await plan($, A)
  await start($, ['1'])
}

test('depois do Esc, a mensagem da pessoa pede para replanejar o painel', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  const ctx = contexto(await pedido($, 'Agora faça outra coisa'))
  expect(ctx).toContain(REPLANEJAR)
  expect(ctx).toContain('mcp__task-tree__plan')
  expect(ctx).toContain('o usuário interrompeu')
  expect(ctx).toContain('Um')
  expect(ctx).toContain('Dois')
  expect(ctx).not.toContain(ABERTAS)
})

test('depois do fim normal do turno, a mensagem da pessoa só lista o que ficou aberto', async ($: any, on: any) => {
  await iniciar($, on)
  await fimDoTurno($)
  const ctx = contexto(await pedido($, 'Próximo'))
  expect(ctx).toContain(ABERTAS)
  expect(ctx).not.toContain(REPLANEJAR)
})

test('depois do Esc, a mensagem de outra sessão segue com o lembrete dela', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  const ctx = contexto(await pedido($, '<cross-session-message from="local_x" name="X">oi</cross-session-message>'))
  expect(ctx).toContain('esta mensagem de outra sessão')
  expect(ctx).toContain(REPLANEJAR)
})

test('depois do Esc sem nada aberto, não há o que replanejar', async ($: any, on: any) => {
  await iniciar($, on)
  await done($, ['1'])
  await start($, ['2'])
  await done($, ['2'])
  await esc($)
  const ctx = contexto(await pedido($, 'Outro'))
  expect(ctx).not.toContain(REPLANEJAR)
})

test('o lembrete de replanejar vale uma vez só', async ($: any, on: any) => {
  await iniciar($, on)
  await esc($)
  expect(contexto(await pedido($, 'Agora faça outra coisa'))).toContain(REPLANEJAR)
  await fimDoTurno($)
  const ctx = contexto(await pedido($, 'Mais uma'))
  expect(ctx).toContain(ABERTAS)
  expect(ctx).not.toContain(REPLANEJAR)
})
