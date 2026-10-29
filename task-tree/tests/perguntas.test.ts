import { expect, test } from 'claude-code/testing'
import { fixar, responderDepois } from './kit/ambiente'
import { ferramenta, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
import { emTexto, esperarEstado, linha, painel } from './kit/leitura'

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const PERGUNTA = {
  questions: [{ question: 'Qual?', header: 'Rumo', multiSelect: false, options: [{ label: 'Opção A', description: 'a' }, { label: 'Opção B', description: 'b' }] }],
}
const RESPOSTA = 'Aguardando sua resposta'

// Regra: perguntas.sem-tarefa-recusada
test('sem tarefa aberta, a pergunta é recusada', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A', 0)
  await pedido($, 'Pedido um')
  expect((await ferramenta($, 'AskUserQuestion', PERGUNTA)).erro).toBe(true)
  const p = await painel($)
  expect(p.some(l => l.titulo === RESPOSTA), emTexto(p)).toBe(false)
})

// Regra: perguntas.espera-sob-a-tarefa
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

// Regra: perguntas.resposta-por-opcao-tira-espera
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

// Regra: perguntas.resposta-pelo-chat-tira-espera
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

// Regra: perguntas.exitplanmode-espera
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

// Regra: perguntas.escolha-do-wrapup-ate-proxima-mensagem
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

// Regra: perguntas.permissao-espera
test('o pedido de permissão aparece como espera; o de pergunta, não', async ($: any, on: any) => {
  fixar(on)
  on('classic.PermissionRequest', () => ({}))
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await $.classic.PermissionRequest({ tool_name: 'AskUserQuestion' })
  let p = await painel($)
  expect(p.some(l => l.texto.includes('Aguardando permissão')), emTexto(p)).toBe(false)
  await $.classic.PermissionRequest({ tool_name: 'Bash' })
  p = await painel($)
  expect(p.some(l => l.texto.includes('Aguardando permissão: Bash')), emTexto(p)).toBe(true)
})