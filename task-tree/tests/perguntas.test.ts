import { expect, test } from 'claude-code/testing'
import { fixar, responderDepois } from './kit/ambiente'
import { done, ferramenta, fimDoTurno, pedido, plan, start, type No } from './kit/cenario'
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

// Regra: perguntas.sem-tarefa-recusada
test('no pedido novo sem plano, um passo pendente do pedido anterior não libera a pergunta', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A', 0)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'], 'Um feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  const r = await ferramenta($, 'AskUserQuestion', PERGUNTA)
  expect(r.erro).toBe(true)
  expect(r.texto).toContain('deste pedido')
  const p = await painel($)
  expect(p.some(l => l.titulo === RESPOSTA), emTexto(p)).toBe(false)
})

// Regra: perguntas.sem-tarefa-recusada
test('uma tarefa em andamento de um pedido anterior libera a pergunta', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await start($, ['1'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  const p = await painel($)
  esperarEstado(p, RESPOSTA, 'aguardando')
  esperarEstado(p, 'Um', 'andamento')
  expect(p.indexOf(linha(p, RESPOSTA)), emTexto(p)).toBe(p.indexOf(linha(p, 'Um')) + 1)
  await relogio.advance(1000)
  expect((await resp).erro).toBe(false)
})

// Regra: perguntas.sem-tarefa-recusada
test('depois do plan do pedido novo, a pergunta passa', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'], 'Um feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B' }])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  const p = await painel($)
  esperarEstado(p, RESPOSTA, 'aguardando')
  await relogio.advance(1000)
  expect((await resp).erro).toBe(false)
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

// Regra: perguntas.espera-sob-a-pendente
test('pergunta com tarefa pendente e nenhuma em andamento: a espera fica sob a pendente', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  const p = await painel($)
  esperarEstado(p, RESPOSTA, 'aguardando')
  esperarEstado(p, 'Um', 'pendente')
  expect(p.indexOf(linha(p, RESPOSTA)), emTexto(p)).toBe(p.indexOf(linha(p, 'Um')) + 1)
  expect(linha(p, RESPOSTA).nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Um').nivel)
  await relogio.advance(1000)
  await resp
})

// Regra: perguntas.espera-sob-a-pendente
test('a escolha do wrap_up com tudo concluído fica sob a última tarefa trabalhada', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'mcp__ccd_turn__wrap_up', 'ok', 0)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2'])
  await done($, ['2'], 'Feito')
  await ferramenta($, 'mcp__ccd_turn__wrap_up', { recap: 'feito', ask: 'Seguir?' })
  const p = await painel($)
  const espera = linha(p, 'Aguardando sua escolha')
  esperarEstado(p, 'Dois', 'concluida')
  expect(p.indexOf(espera), emTexto(p)).toBe(p.indexOf(linha(p, 'Dois')) + 1)
  expect(espera.nivel, emTexto(p)).toBeGreaterThan(linha(p, 'Dois').nivel)
})

// Regra: perguntas.espera-sob-a-pendente
test('com uma tarefa em andamento, a espera segue sob ela mesmo havendo pendente', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  const p = await painel($)
  esperarEstado(p, 'Um', 'pendente')
  expect(p.indexOf(linha(p, RESPOSTA)), emTexto(p)).toBe(p.indexOf(linha(p, 'Dois')) + 1)
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

// Regra: perguntas.mensagem-no-meio-do-turno-mantem-espera
test('mensagem entregue no meio do turno não tira a espera da pergunta nem a do plano ainda abertas', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  responderDepois(on, relogio, 'ExitPlanMode', 'aprovado')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  const de = 'local_11111111-1111-1111-1111-111111111111'
  await $.prompt.submit({ text: `<cross-session-message from="${de}" name="outra">relato</cross-session-message>`, turnId: 't', origin: { kind: 'peer', from: de } })
  let p = await painel($)
  esperarEstado(p, RESPOSTA, 'aguardando')
  esperarEstado(p, 'Um', 'andamento')
  await relogio.advance(1000)
  await resp
  p = await painel($)
  expect(p.some(l => l.titulo === RESPOSTA), emTexto(p)).toBe(false)
  const aprovar = ferramenta($, 'ExitPlanMode', { plan: 'o plano' })
  await relogio.settle()
  await $.prompt.submit({ text: 'mais uma coisa', turnId: 't', origin: { kind: 'composer' }, wait: true })
  p = await painel($)
  esperarEstado(p, 'Aguardando aprovação do plano', 'aguardando')
  await relogio.advance(1000)
  await aprovar
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
// Regra: perguntas.permissao-sai-com-a-ultima-chamada
test('com duas chamadas da mesma ferramenta em curso, o aviso de permissão fica até a última terminar', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  on('classic.PermissionRequest', () => ({}))
  on('tool.call', { tool: 'Bash' }, async (_$: any, e: any) => {
    await relogio.sleep(((e.input ?? e) as { command?: string }).command === 'rápido' ? 500 : 2000)
    return { result: 'ok' }
  })
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const rapida = ferramenta($, 'Bash', { command: 'rápido' })
  const lenta = ferramenta($, 'Bash', { command: 'lento' })
  await relogio.settle()
  await $.classic.PermissionRequest({ tool_name: 'Bash' })
  await relogio.advance(500)
  await rapida
  let p = await painel($)
  expect(p.some(l => l.texto.includes('Aguardando permissão: Bash')), emTexto(p)).toBe(true)
  await relogio.advance(1500)
  await lenta
  p = await painel($)
  expect(p.some(l => l.texto.includes('Aguardando permissão')), emTexto(p)).toBe(false)
})

// Regra: perguntas.permissao-sai-com-a-ultima-chamada
test('o fim do turno tira o aviso de permissão que sobrou', async ($: any, on: any) => {
  fixar(on)
  on('classic.PermissionRequest', () => ({}))
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await $.classic.PermissionRequest({ tool_name: 'Bash' })
  let p = await painel($)
  expect(p.some(l => l.texto.includes('Aguardando permissão: Bash')), emTexto(p)).toBe(true)
  await fimDoTurno($)
  p = await painel($)
  expect(p.some(l => l.texto.includes('Aguardando permissão')), emTexto(p)).toBe(false)
})

// Regra: perguntas.wrapup-que-falha-nao-espera
test('o wrap_up com pergunta que falha não deixa "Aguardando sua escolha"', async ($: any, on: any) => {
  fixar(on)
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, () => ({ result: 'erro', isError: true }))
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await ferramenta($, 'mcp__ccd_turn__wrap_up', { recap: 'feito', ask: 'Seguir?' })
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Aguardando sua escolha'), emTexto(p)).toBe(false)
})

// Regra: perguntas.sem-tarefa-recusada, perguntas.falha-de-um-passo-nao-pula-a-recusa
test('a pergunta sem tarefa é recusada mesmo com a falha de outro passo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A', 0)
  // Armado, a leitura do fim do turno (wake) falha antes da pergunta; a recusa não a lê.
  let armado = false
  on('state.get', async (_$: any, e: any, next: any) => (armado && e?.key === 'turnEnded' ? { deny: 'estouro de teste' } : next(e)))
  await pedido($, 'Pedido um')
  armado = true
  const r = await ferramenta($, 'AskUserQuestion', PERGUNTA)
  armado = false
  expect(r.erro, r.texto).toBe(true)
  expect(r.texto).toContain('plan')
})
