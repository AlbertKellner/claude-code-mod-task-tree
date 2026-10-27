import { expect, test } from 'claude-code/testing'
import { fixar, responderDepois } from './kit/ambiente'
import { ferramenta, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { emTexto, esperarEstado, linha, painel } from './kit/leitura'

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const PERGUNTA = {
  questions: [{ question: 'Qual?', header: 'Rumo', multiSelect: false, options: [{ label: 'Opção A', description: 'a' }, { label: 'Opção B', description: 'b' }] }],
}
const RESPOSTA = 'Aguardando sua resposta'

// Origem: regra do painel, AskUserQuestion sem tarefa aberta é recusado.
test('sem tarefa aberta, a pergunta é recusada', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A', 0)
  await pedido($, 'Pedido um')
  expect((await ferramenta($, 'AskUserQuestion', PERGUNTA)).erro).toBe(true)
  const p = await painel($)
  expect(p.some(l => l.titulo === RESPOSTA), emTexto(p)).toBe(false)
})

// Origem: a pergunta aberta aparece numa linha ◷ sob a tarefa, que segue em andamento.
test('com a pergunta aberta, aparece a espera sob a tarefa, que segue em andamento', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  const p = await painel($)
  esperarEstado(p, RESPOSTA, 'aguardando')
  esperarEstado(p, 'Um', 'andamento')
  expect(p.indexOf(linha(p, RESPOSTA)), emTexto(p)).toBe(p.indexOf(linha(p, 'Um')) + 1)
  expect(linha(p, RESPOSTA).nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Um').nivel)
  await relogio.advance(1000)
  await resp
})

// Origem: a pergunta respondida por opção não deixa espera no painel.
test('respondida por opção, a espera some e a tarefa segue em andamento', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  await relogio.advance(1000)
  expect((await resp).erro).toBe(false)
  const p = await painel($)
  expect(p.some(l => l.titulo === RESPOSTA), emTexto(p)).toBe(false)
  esperarEstado(p, 'Um', 'andamento')
})

// Origem: decisão do usuário de 2026-10-27, a resposta pelo chat tira a espera na hora, antes de
// a mensagem dele chegar. O texto é o que o app devolve nesse caso.
test('respondida pelo chat, a espera some na hora e a tarefa segue em andamento', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'User did not answer this question — they sent a message instead.')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  let p = await painel($)
  esperarEstado(p, RESPOSTA, 'aguardando')
  await relogio.advance(1000)
  await resp
  p = await painel($)
  expect(p.some(l => l.titulo === RESPOSTA), emTexto(p)).toBe(false)
  esperarEstado(p, 'Um', 'andamento')
})

// Origem: ExitPlanMode espera a aprovação do plano, como a pergunta.
test('ExitPlanMode mostra a espera da aprovação do plano até a resposta', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'ExitPlanMode', 'aprovado')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const resp = ferramenta($, 'ExitPlanMode', { plan: 'o plano' })
  await relogio.settle()
  let p = await painel($)
  esperarEstado(p, 'Aguardando aprovação do plano', 'aguardando')
  await relogio.advance(1000)
  await resp
  p = await painel($)
  expect(p.some(l => l.titulo === 'Aguardando aprovação do plano'), emTexto(p)).toBe(false)
})

// Origem: a escolha do wrap_up com ask espera a próxima mensagem do usuário.
test('a escolha do wrap_up fica até a próxima mensagem', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'mcp__ccd_turn__wrap_up', 'ok', 0)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await ferramenta($, 'mcp__ccd_turn__wrap_up', { recap: 'feito', ask: 'Seguir?' })
  let p = await painel($)
  esperarEstado(p, 'Aguardando sua escolha', 'aguardando')
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Aguardando sua escolha', 'aguardando')
  await pedido($, 'sim')
  p = await painel($)
  expect(p.some(l => l.titulo === 'Aguardando sua escolha'), emTexto(p)).toBe(false)
})
