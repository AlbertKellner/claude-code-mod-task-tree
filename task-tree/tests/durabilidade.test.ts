import { expect, test } from 'claude-code/testing'
import { PUBLISHED_FILES } from './fixtures/publicados'
import { AGORA, armazem, estado, fixar, host, responderDepois, responderEnvio, SESSAO, subagente } from './kit/ambiente'
import { abrirSessao, aviso, done, envio, esc, ferramenta, fimDoTurno, iniciarSessao, limpar, mensagemDe, pedido, plan, retomar, start, type No } from './kit/cenario'
import { cartaSob, cartoes, comHistorico, cabecalho, emTexto, esperarEstado, linha, painel, type Linha } from './kit/leitura'

// Os pares "1/2, 2/2" dependem de o kit rodar os testes deste arquivo em ordem, no mesmo processo:
// o 1/2 grava nos objetos abaixo e o 2/2 (módulo novo, state vazio) lê deles.

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois', children: [{ id: '2.1', title: 'Dois.um' }, { id: '2.2', title: 'Dois.dois' }] }] }]
const B: No[] = [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'b1' }, { id: 'b2', title: 'b2' }] }]
const K1 = 'local_11111111-1111-1111-1111-111111111111'
const K2 = 'local_22222222-2222-2222-2222-222222222222'
const TAREFA = { id: '1', short: '1', title: 'Tarefa da filha', status: 'open', started: 1, startedAt: 1, children: [] }

const tem = (p: Linha[], titulo: string) => p.some(l => l.titulo === titulo)
// A resposta do turno (o ↩ do cartão desta sessão na mãe) no arquivo que ela publica.
const resposta = (h: { proprio(): any }, texto: string) =>
  ((h.proprio()?.groups ?? []).find((g: any) => g.agent === '')?.turns ?? []).some((u: any) => u.brief === texto || u.reply === texto)
const temPainel = (store: Record<string, unknown>) => Object.keys(store).some(k => k.startsWith('session:'))
// O 2/2 sem o que o 1/2 gravou falha com motivo, nunca passa vazio.
const exigir = (ok: boolean) => {
  if (!ok) throw new Error('rode o par inteiro: o 1/2 não gravou')
}
const debaixo = (p: Linha[], titulo: string, de: string) => p.indexOf(linha(p, titulo)) === p.indexOf(linha(p, de)) + 1

const REINICIO: Record<string, unknown> = {}
const RESPAWN: Record<string, unknown> = {}
const OUTRO: Record<string, unknown> = {}
const RECARGA: Record<string, unknown> = {}
const RECAP: Record<string, unknown> = {}
const LIGACOES: Record<string, unknown> = {}

// Regra: durabilidade.reinicio-restaura-do-store
test('reinício com session.start, 1/2: o painel vai ao store', async ($: any, on: any) => {
  fixar(on)
  armazem(on, REINICIO)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'], 'Resumo um')
  await fimDoTurno($)
  expect(temPainel(REINICIO), JSON.stringify(Object.keys(REINICIO))).toBe(true)
})

// Regra: durabilidade.reinicio-restaura-do-store
test('reinício com session.start, 2/2: outro processo desenha o mesmo painel e segue dele', async ($: any, on: any) => {
  fixar(on)
  armazem(on, REINICIO)
  exigir(temPainel(REINICIO))
  await iniciarSessao($)
  let p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  expect(tem(p, 'Plano A') && tem(p, 'Dois.dois'), emTexto(p)).toBe(true)
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 3])
  await start($, ['2.1'])
  p = await painel($)
  esperarEstado(p, 'Dois.um', 'andamento')
  esperarEstado(p, 'Um', 'concluida')
})

// Regra: durabilidade.respawn-sem-session-start
test('respawn sem session.start, 1/2: dois pedidos e a visão resumida no store', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, RESPAWN)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1', '2.1', '2.2'])
  await done($, ['1', '2.1', '2.2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, B)
  await start($, ['b1'])
  await fimDoTurno($)
  expect(temPainel(RESPAWN), JSON.stringify(Object.keys(RESPAWN))).toBe(true)
})

// Regra: durabilidade.respawn-sem-session-start
test('respawn sem session.start, 2/2: o painel, a visão e o trabalho voltam no primeiro uso, e o store não encolhe', async ($: any, on: any) => {
  fixar(on)
  armazem(on, RESPAWN)
  exigir(temPainel(RESPAWN))
  // Sem session.start: o primeiro desenho já traz o painel, na visão resumida (só o pedido dois).
  let p = await painel($)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(false)
  await done($, ['b1'])
  await start($, ['b2'])
  p = await painel($)
  esperarEstado(p, 'b1', 'concluida')
  esperarEstado(p, 'b2', 'andamento')
  // O que o respawn gravou não apagou o pedido um.
  p = await comHistorico($, 1)
  esperarEstado(p, 'Um', 'concluida')
  esperarEstado(p, 'Dois.dois', 'concluida')
})

// Regra: durabilidade.reinicio-restaura-do-store
test('retomada, 1/2: um painel diferente no state (o plano B)', async ($: any, on: any) => {
  fixar(on)
  estado(on, OUTRO, 'captura')
  await pedido($, 'Outro pedido')
  await plan($, B)
  const p = await painel($)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.reinicio-restaura-do-store
test('retomada, 2/2: o state passa a ser o painel do store da sessão retomada', async ($: any, on: any) => {
  fixar(on)
  armazem(on, REINICIO)
  estado(on, OUTRO, 'semear')
  exigir(temPainel(REINICIO) && Object.keys(OUTRO).length > 0)
  let p = await painel($)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  await retomar($, SESSAO)
  p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(false)
})

// Regra: durabilidade.clear-esvazia
test('/clear esvazia o painel', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await limpar($)
  const p = await painel($)
  expect(cabecalho(p).vazio, emTexto(p)).toBe(true)
})

// Regra: durabilidade.clear-publica-limpo
test('/clear com espera e carta: o arquivo publicado sai sem espera e sem cartas', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  responderDepois(on, relogio, 'mcp__ccd_turn__wrap_up', 'ok', 0)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await ferramenta($, 'mcp__ccd_turn__wrap_up', { recap: 'feito', ask: 'Seguir?' })
  expect(h.proprio()?.waiting, JSON.stringify(h.proprio())).toBe(true)
  await limpar($)
  const pub = h.proprio()
  expect(pub?.waiting, JSON.stringify(pub)).toBe(false)
  expect(pub?.waits ?? [], JSON.stringify(pub)).toEqual([])
  expect(pub?.sends ?? [], JSON.stringify(pub)).toEqual([])
  const p = await painel($)
  expect(cabecalho(p).vazio, emTexto(p)).toBe(true)
})

const SEM_COPIA: Record<string, unknown> = {}
const ESPERA: Record<string, unknown> = {}

// Regra: durabilidade.retomada-nao-herda-a-sessao-anterior
test('retomada sem painel guardado, 1/2: um painel no state', async ($: any, on: any) => {
  fixar(on)
  estado(on, SEM_COPIA, 'captura')
  await pedido($, 'Outro pedido')
  await plan($, B)
  await start($, ['b1'])
  expect(Object.keys(SEM_COPIA).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: durabilidade.retomada-nao-herda-a-sessao-anterior
test('retomada sem painel guardado, 2/2: a retomada esvazia o painel', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  estado(on, SEM_COPIA, 'semear')
  exigir(Object.keys(SEM_COPIA).length > 0)
  let p = await painel($)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  await retomar($, 'uuid-sem-copia')
  p = await painel($)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(false)
  expect(cabecalho(p).vazio, emTexto(p)).toBe(true)
})

// Regra: durabilidade.retomada-nao-herda-a-sessao-anterior
test('retomada com espera da sessão anterior, 1/2: uma escolha do wrap_up e um resumo no state', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  estado(on, ESPERA, 'captura')
  responderDepois(on, relogio, 'mcp__ccd_turn__wrap_up', 'ok', 0)
  await pedido($, 'Outro pedido')
  await plan($, B)
  await start($, ['b1'])
  await done($, ['b1'], 'Resumo antigo')
  await ferramenta($, 'mcp__ccd_turn__wrap_up', { recap: 'Recap antigo', ask: 'Seguir?' })
  const p = await painel($)
  esperarEstado(p, 'Aguardando sua escolha', 'aguardando')
})

// Regra: durabilidade.retomada-nao-herda-a-sessao-anterior
test('retomada com espera da sessão anterior, 2/2: a espera e o resumo da anterior não passam', async ($: any, on: any) => {
  fixar(on)
  armazem(on, REINICIO)
  estado(on, ESPERA, 'semear')
  const h = host(on, [])
  exigir(temPainel(REINICIO) && Object.keys(ESPERA).length > 0)
  await retomar($, SESSAO)
  let p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(p.some(l => l.titulo === 'Aguardando sua escolha'), emTexto(p)).toBe(false)
  await fimDoTurno($)
  p = await painel($)
  expect(p.some(l => l.texto.includes('Resumo antigo') || l.texto.includes('Recap antigo')), emTexto(p)).toBe(false)
  expect(resposta(h, 'Resumo antigo') || resposta(h, 'Recap antigo'), JSON.stringify(h.proprio())).toBe(false)
})

// Regra: durabilidade.recarga-mantem-painel-ligacoes-e-resumo
test('recarga a quente, 1/2: o painel no state', async ($: any, on: any) => {
  fixar(on)
  estado(on, RECARGA, 'captura')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'], 'Resumo X')
  expect(Object.keys(RECARGA).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: durabilidade.recarga-mantem-painel-ligacoes-e-resumo
test('recarga a quente, 2/2: módulo novo com o state mantido desenha o painel', async ($: any, on: any) => {
  fixar(on)
  estado(on, RECARGA, 'semear')
  exigir(Object.keys(RECARGA).length > 0)
  const p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  esperarEstado(p, 'Plano A', 'andamento')
  esperarEstado(p, 'Dois.um', 'pendente')
})

// Regra: durabilidade.recarga-mantem-painel-ligacoes-e-resumo
test('recarga a quente, 1/2: o recap do wrap_up no state', async ($: any, on: any) => {
  fixar(on)
  estado(on, RECAP, 'captura')
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await ferramenta($, 'mcp__ccd_turn__wrap_up', { recap: 'Recap Y' })
  expect(Object.keys(RECAP).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: durabilidade.recarga-mantem-painel-ligacoes-e-resumo
test('recarga a quente, 2/2: o fim do turno mostra o recap gravado antes da recarga', async ($: any, on: any) => {
  fixar(on)
  estado(on, RECAP, 'semear')
  const h = host(on, [])
  exigir(Object.keys(RECAP).length > 0)
  await fimDoTurno($)
  expect(resposta(h, 'Recap Y'), JSON.stringify(h.proprio())).toBe(true)
})

// Regra: durabilidade.recarga-mantem-painel-ligacoes-e-resumo
test('recarga a quente, 1/2: a filha aberta sob uma tarefa', async ($: any, on: any) => {
  fixar(on)
  estado(on, LIGACOES, 'captura')
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(debaixo(p, 'filha-um', 'Um'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.recarga-mantem-painel-ligacoes-e-resumo
test('recarga a quente, 2/2: o cartão da filha segue sob a mesma tarefa', async ($: any, on: any) => {
  fixar(on)
  estado(on, LIGACOES, 'semear')
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }])
  exigir(Object.keys(LIGACOES).length > 0)
  await aviso($)
  const p = await painel($)
  expect(debaixo(p, 'filha-um', 'Um'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.ligacoes-com-lista-parcial-do-host
test('a lista do host deixa uma filha de fora e depois a lista de novo: o cartão volta sob a mesma tarefa', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  const h = host(on, [
    { id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } },
    { id: K2, nome: 'filha-dois', painel: { tasks: [{ ...TAREFA, title: 'Tarefa da filha dois' }] } },
  ])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await done($, ['1'])
  await start($, ['2.1'])
  await abrirSessao($)
  await aviso($)
  let p = await painel($)
  expect(debaixo(p, 'filha-dois', 'Dois.um'), emTexto(p)).toBe(true)
  h.filha(K2).listada = false
  await aviso($)
  p = await painel($)
  expect(tem(p, 'filha-dois'), emTexto(p)).toBe(false)
  h.filha(K2).listada = true
  await aviso($)
  p = await painel($)
  expect(debaixo(p, 'filha-dois', 'Dois.um'), emTexto(p)).toBe(true)
  expect(debaixo(p, 'filha-um', 'Um'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.formatos-antigos-do-publicado
test('os 8 formatos do arquivo publicado: cada filha aparece, com as tarefas do formato', async ($: any, on: any) => {
  fixar(on)
  const id = (i: number) => `local_0000000${i}-0000-0000-0000-000000000000`
  host(on, PUBLISHED_FILES.map((f, i) => ({ id: id(i), nome: `formato-${i}`, publicado: f.file })))
  await pedido($, 'Pedido um')
  await plan($, A)
  await aviso($)
  const p = await painel($)
  expect(p.filter(l => /indispon|erro/i.test(l.texto)).map(l => l.texto), emTexto(p)).toEqual([])
  PUBLISHED_FILES.forEach((f, i) => {
    expect(linha(p, `formato-${i}`).sessao, `${f.label}:\n${emTexto(p)}`).toBe(true)
    const doc = JSON.parse(f.file)
    // O cartão desenha o trabalho do formato: ao menos uma das tarefas dele.
    const tarefas: any[] = doc.groups?.find((g: any) => g.agent === '')?.tasks ?? doc.tasks ?? []
    if (tarefas.length > 0) expect(tarefas.some(t => tem(p, t.title)), `${f.label}:\n${emTexto(p)}`).toBe(true)
  })
})

// O fim do turno nos três casos: reinício com session.start, respawn sem ele, e o turno parado com Esc.
const FIM: Record<string, unknown> = {}
const FIM_RESPAWN: Record<string, unknown> = {}
const FIM_ESC: Record<string, unknown> = {}
async function terminarTurno($: any, on: any, store: Record<string, unknown>, parar = false) {
  fixar(on)
  armazem(on, store)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2.1'])
  if (parar) await esc($)
  else await fimDoTurno($)
  expect(temPainel(store), JSON.stringify(Object.keys(store))).toBe(true)
}
const semAndamento = (p: Linha[]) => {
  expect(p.filter(l => !l.cabecalho && l.estado === 'andamento').map(l => l.titulo), emTexto(p)).toEqual([])
  expect(cabecalho(p).chips.andamento, emTexto(p)).toBe(0)
}

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('fim do turno no reinício, 1/2: o turno termina com uma tarefa iniciada', async ($: any, on: any) => {
  await terminarTurno($, on, FIM)
})

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('fim do turno no reinício, 2/2: o processo novo desenha o turno parado, e o pedido seguinte volta ao trabalho', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FIM)
  exigir(temPainel(FIM))
  await iniciarSessao($)
  let p = await painel($)
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Dois.um', 'aguardando')
  semAndamento(p)
  await pedido($, 'Pedido dois')
  await start($, ['2.2'])
  p = await painel($)
  esperarEstado(p, 'Dois.dois', 'andamento')
})

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('fim do turno no respawn, 1/2: o turno termina com uma tarefa iniciada', async ($: any, on: any) => {
  await terminarTurno($, on, FIM_RESPAWN)
})

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('fim do turno no respawn, 2/2: sem session.start, o primeiro desenho já mostra o turno parado', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FIM_RESPAWN)
  exigir(temPainel(FIM_RESPAWN))
  const p = await painel($)
  esperarEstado(p, 'Plano A', 'aguardando')
  esperarEstado(p, 'Dois.um', 'aguardando')
  semAndamento(p)
})

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('fim do turno com Esc no reinício, 1/2: o turno é parado com uma tarefa iniciada', async ($: any, on: any) => {
  await terminarTurno($, on, FIM_ESC, true)
})

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('fim do turno com Esc no reinício, 2/2: a iniciada segue interrompida', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FIM_ESC)
  exigir(temPainel(FIM_ESC))
  await iniciarSessao($)
  const p = await painel($)
  esperarEstado(p, 'Dois.um', 'interrompida')
  esperarEstado(p, 'Dois.dois', 'pendente')
  semAndamento(p)
})

// A parada com Esc, depois de um aviso tratado até o fim (o último turno terminou normalmente).
const PARADA: Record<string, unknown> = {}

// Regra: durabilidade.parada-com-esc-sobrevive-ao-reinicio
test('parada com Esc no reinício, 1/2: o Esc para a tarefa e um aviso é tratado até o fim', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, PARADA)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['2.1'])
  await esc($)
  await relogio.advance(1000)
  await aviso($)
  await fimDoTurno($)
  esperarEstado(await painel($), 'Dois.um', 'interrompida')
  expect(temPainel(PARADA), JSON.stringify(Object.keys(PARADA))).toBe(true)
})

// Regra: durabilidade.parada-com-esc-sobrevive-ao-reinicio
test('parada com Esc no reinício, 2/2: o processo novo a desenha interrompida até o start nela', async ($: any, on: any) => {
  fixar(on)
  armazem(on, PARADA)
  exigir(temPainel(PARADA))
  await iniciarSessao($)
  let p = await painel($)
  esperarEstado(p, 'Dois.um', 'interrompida')
  semAndamento(p)
  await pedido($, 'Pedido dois')
  await start($, ['2.2'])
  p = await painel($)
  esperarEstado(p, 'Dois.dois', 'andamento')
  esperarEstado(p, 'Dois.um', 'interrompida')
  await start($, ['2.1'])
  p = await painel($)
  esperarEstado(p, 'Dois.um', 'andamento')
})

// O resumo do done, gravado antes de uma recarga, chega à linha ↩ e ao arquivo publicado.
const RESUMO: Record<string, unknown> = {}

// Regra: durabilidade.resumo-do-done-na-recarga
test('recarga a quente, 1/2: o resumo do done no state', async ($: any, on: any) => {
  fixar(on)
  estado(on, RESUMO, 'captura')
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await done($, ['1'], 'Resumo X')
  expect(Object.keys(RESUMO).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: durabilidade.resumo-do-done-na-recarga
test('recarga a quente, 2/2: o resumo do done chega ao ↩ e ao publicado', async ($: any, on: any) => {
  fixar(on)
  estado(on, RESUMO, 'semear')
  const h = host(on, [])
  exigir(Object.keys(RESUMO).length > 0)
  await fimDoTurno($, 'Resposta final')
  const p = await painel($)
  expect(p.some(l => l.texto.includes('↩') && l.texto.includes('Resumo X')), emTexto(p)).toBe(true)
  expect(resposta(h, 'Resumo X'), JSON.stringify(h.proprio())).toBe(true)
})


// O processo morre no meio do turno (o app fechado, o processo morto): nada grava o fim do turno.
const MORTO: Record<string, unknown> = {}
const MORTO_SEGUINTE: Record<string, unknown> = {}
const MORTO_RESPAWN: Record<string, unknown> = {}
const MORTO_REPLAN: Record<string, unknown> = {}
async function morrerNoTurno($: any, on: any, store: Record<string, unknown>, antes = false) {
  fixar(on)
  armazem(on, store)
  if (antes) {
    await pedido($, 'Pedido zero')
    await plan($, B)
    await start($, ['b1'])
    await done($, ['b1', 'b2'])
    await fimDoTurno($)
  }
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2.1'])
  esperarEstado(await painel($), 'Dois.um', 'andamento')
  expect(temPainel(store), JSON.stringify(Object.keys(store))).toBe(true)
}
const contexto = (r: any) => (r?.context ?? []).join(' | ')
async function reabrirMorto($: any, on: any, store: Record<string, unknown>) {
  fixar(on)
  armazem(on, store)
  exigir(temPainel(store))
  await iniciarSessao($)
  let p = await painel($)
  esperarEstado(p, 'Dois.um', 'interrompida')
  esperarEstado(p, 'Dois.dois', 'pendente')
  semAndamento(p)
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 2])
  const ctx = contexto(await pedido($, 'Pedido dois'))
  await start($, ['2.2'])
  p = await painel($)
  esperarEstado(p, 'Dois.dois', 'andamento')
  esperarEstado(p, 'Dois.um', 'interrompida')
  await start($, ['2.1'])
  p = await painel($)
  esperarEstado(p, 'Dois.um', 'andamento')
  return ctx
}

// Regra: durabilidade.turno-em-curso-no-reinicio-fica-interrompido
test('processo morto no meio do primeiro turno, 1/2: a tarefa fica em andamento no store', async ($: any, on: any) => {
  await morrerNoTurno($, on, MORTO)
})

// Regra: durabilidade.turno-em-curso-no-reinicio-fica-interrompido
test('processo morto no meio do primeiro turno, 2/2: o processo novo a desenha interrompida até o start nela', async ($: any, on: any) => {
  await reabrirMorto($, on, MORTO)
})

// Regra: durabilidade.turno-em-curso-no-reinicio-fica-interrompido
test('processo morto num turno seguinte, 1/2: a tarefa fica em andamento no store', async ($: any, on: any) => {
  await morrerNoTurno($, on, MORTO_SEGUINTE, true)
})

// Regra: durabilidade.turno-em-curso-no-reinicio-fica-interrompido
test('processo morto num turno seguinte, 2/2: o processo novo a desenha interrompida até o start nela', async ($: any, on: any) => {
  await reabrirMorto($, on, MORTO_SEGUINTE)
})

// Regra: durabilidade.turno-em-curso-no-reinicio-fica-interrompido
test('processo morto no meio do turno, 1/2: a tarefa fica em andamento no store', async ($: any, on: any) => {
  await morrerNoTurno($, on, MORTO_REPLAN)
})

// Regra: durabilidade.turno-em-curso-no-reinicio-fica-interrompido
test('processo morto no meio do turno, 2/2: a mensagem seguinte pede para replanejar', async ($: any, on: any) => {
  const ctx = await reabrirMorto($, on, MORTO_REPLAN)
  expect(ctx).toContain('replaneje o painel')
  expect(ctx).toContain('o usuário interrompeu')
})

// Regra: durabilidade.turno-em-curso-no-reinicio-fica-interrompido
test('respawn sem session.start com o turno em curso, 1/2: a tarefa fica em andamento no store', async ($: any, on: any) => {
  await morrerNoTurno($, on, MORTO_RESPAWN)
})

// Regra: durabilidade.turno-em-curso-no-reinicio-fica-interrompido
test('respawn sem session.start com o turno em curso, 2/2: segue em andamento', async ($: any, on: any) => {
  fixar(on)
  armazem(on, MORTO_RESPAWN)
  exigir(temPainel(MORTO_RESPAWN))
  let p = await painel($)
  esperarEstado(p, 'Dois.um', 'andamento')
  await start($, ['2.2'])
  p = await painel($)
  esperarEstado(p, 'Dois.dois', 'andamento')
  esperarEstado(p, 'Dois.um', 'andamento')
})

// As ligações depois de uma recarga: o state que sobreviveu é a verdade; o store só entra num processo novo.
const P_UM: No[] = [{ id: '1', title: 'Um' }]
const P_NOVO: No[] = [{ id: '1', title: 'Novo um' }]
const AVISADA: Record<string, unknown> = {}
const AVISADA_STORE: Record<string, unknown> = {}
const REUSO: Record<string, unknown> = {}
const REUSO_STORE: Record<string, unknown> = {}
const NOVO_PROCESSO: Record<string, unknown> = {}
const ctxDe = (r: any) => (r?.context ?? []).join(' | ')
const cartas = (p: Linha[]) => p.filter(l => l.carta !== undefined && l.titulo.startsWith('Para '))

// Regra: durabilidade.recarga-nao-funde-as-ligacoes
test('recarga com a carta já avisada, 1/2: a carta entregue e o lembrete dado', async ($: any, on: any) => {
  fixar(on)
  estado(on, AVISADA, 'captura')
  armazem(on, AVISADA_STORE)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, K1)
  h.recebeu(K1, AGORA)
  const ctx = ctxDe(await aviso($))
  expect(ctx).toContain('recebimento confirmado')
  const p = await painel($)
  expect(cartas(p).length, emTexto(p)).toBe(1)
})

// Regra: durabilidade.recarga-nao-funde-as-ligacoes
test('recarga com a carta já avisada, 2/2: o módulo novo não repete a carta nem o lembrete', async ($: any, on: any) => {
  fixar(on)
  estado(on, AVISADA, 'semear')
  armazem(on, AVISADA_STORE)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }])
  exigir(Object.keys(AVISADA).length > 0)
  h.recebeu(K1, AGORA)
  const ctx = ctxDe(await aviso($))
  expect(ctx).not.toContain('recebimento confirmado')
  const p = await painel($)
  expect(cartas(p).length, emTexto(p)).toBe(1)
})

// Regra: durabilidade.recarga-nao-funde-as-ligacoes
test('recarga depois de um plan que reusou o id da tarefa da carta, 1/2: o plan renomeia a tarefa antiga', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  estado(on, REUSO, 'captura')
  armazem(on, REUSO_STORE)
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, P_UM)
  await start($, ['1'])
  await envio($, K1)
  h.recebeu(K1, AGORA)
  await aviso($)
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, P_NOVO)
  expect(Object.keys(REUSO).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: durabilidade.recarga-nao-funde-as-ligacoes
test('recarga depois de um plan que reusou o id da tarefa da carta, 2/2: a carta não aparece sob a tarefa nova', async ($: any, on: any) => {
  fixar(on)
  estado(on, REUSO, 'semear')
  armazem(on, REUSO_STORE)
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }])
  exigir(Object.keys(REUSO).length > 0)
  await start($, ['1'])
  const p = await painel($)
  esperarEstado(p, 'Novo um', 'andamento')
  expect(cartaSob(p, 'Novo um'), emTexto(p)).toBeUndefined()
})

// Regra: durabilidade.recarga-nao-funde-as-ligacoes
test('processo novo sem session.start, 1/2: a filha aberta sob a tarefa e a carta na fila', async ($: any, on: any) => {
  fixar(on)
  armazem(on, NOVO_PROCESSO)
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await envio($, K1)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(cartaSob(p, 'Um'), emTexto(p)).toBe('fila')
})

// Regra: durabilidade.recarga-nao-funde-as-ligacoes
test('processo novo sem session.start, 2/2: as ligações voltam antes da primeira escrita', async ($: any, on: any) => {
  fixar(on)
  armazem(on, NOVO_PROCESSO)
  host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }])
  exigir(temPainel(NOVO_PROCESSO))
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(cartaSob(p, 'Um'), emTexto(p)).toBe('fila')
})

// O /clear numa sessão que abriu filhas: os cartões delas somem na hora e não voltam.
const P_UM_CLEAR: No[] = [{ id: '1', title: 'Um' }]
const P_OUTRA: No[] = [{ id: '1', title: 'Outra um' }]
const FILHA_UM = { id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }
const FILHA_DOIS = { id: K2, nome: 'filha-dois', painel: { tasks: [{ ...TAREFA, title: 'Tarefa da filha dois' }] } }
const CLEAR_RECARGA: Record<string, unknown> = {}
const CLEAR_RECARGA_STORE: Record<string, unknown> = {}
async function abrirELimpar($: any) {
  await pedido($, 'Pedido um')
  await plan($, P_UM_CLEAR)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  await limpar($)
  await aviso($)
  p = await painel($)
  expect(tem(p, 'filha-um'), emTexto(p)).toBe(false)
  await pedido($, 'Pedido dois')
  await plan($, P_OUTRA)
  await start($, ['1'])
}

// Regra: durabilidade.clear-tira-os-cartoes-das-filhas
test('/clear numa sessão com filha: o cartão some e não volta sob a tarefa nova de mesmo id', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  host(on, [FILHA_UM])
  await abrirELimpar($)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um'), emTexto(p)).toEqual([])
  esperarEstado(p, 'Outra um', 'andamento')
  const c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([0, 1])
  expect(c.chips.ativas, emTexto(p)).toBe(0)
})

// Regra: durabilidade.clear-tira-os-cartoes-das-filhas
test('uma sessão aberta depois do /clear aparece sob a tarefa dela', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  // A segunda só entra na lista do host quando é aberta, depois do /clear.
  const h = host(on, [FILHA_UM, { ...FILHA_DOIS, listada: false }])
  await abrirELimpar($)
  h.filha(K2).listada = true
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(cartoes(p, 'filha-um'), emTexto(p)).toEqual([])
  expect(cartoes(p, 'filha-dois').map(c => c.sob), emTexto(p)).toEqual(['Outra um'])
})

// Regra: durabilidade.clear-tira-os-cartoes-das-filhas
test('depois de uma recarga, a filha de antes do /clear segue sem cartão, 1/2: o /clear com a filha trabalhando', async ($: any, on: any) => {
  fixar(on)
  estado(on, CLEAR_RECARGA, 'captura')
  armazem(on, CLEAR_RECARGA_STORE)
  host(on, [FILHA_UM])
  await abrirELimpar($)
  expect(Object.keys(CLEAR_RECARGA).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: durabilidade.clear-tira-os-cartoes-das-filhas
test('depois de uma recarga, a filha de antes do /clear segue sem cartão, 2/2: o módulo novo não a traz de volta', async ($: any, on: any) => {
  fixar(on)
  estado(on, CLEAR_RECARGA, 'semear')
  armazem(on, CLEAR_RECARGA_STORE)
  host(on, [FILHA_UM])
  exigir(Object.keys(CLEAR_RECARGA).length > 0)
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Outra um', 'andamento')
  expect(cartoes(p, 'filha-um'), emTexto(p)).toEqual([])
})

// Regra: durabilidade.clear-tira-os-cartoes-das-filhas
test('uma mensagem nova à filha de antes do /clear mostra a carta, sem cartão', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  host(on, [FILHA_UM])
  responderEnvio(on)
  await abrirELimpar($)
  await envio($, K1)
  await aviso($)
  const p = await painel($)
  expect(cartaSob(p, 'Outra um'), emTexto(p)).toBe('fila')
  expect(cartoes(p, 'filha-um'), emTexto(p)).toEqual([])
})

const SOBRAS = ['asks:x', 'view:x', 'work:velha', 'turn:velha', 'links:velha']
const naoGravado = (log: string[]) => log.filter(l => l.includes('store não gravado'))
// O /task-tree: o app põe o painel na tela e não lista outros painéis.
const comandoNaTela = (on: any) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
}
const comando = async ($: any): Promise<string> => String((await $.command.run({ command: 'task-tree' }))?.text ?? '')
const CHEIO: Record<string, unknown> = {}

// Regra: durabilidade.store-cheio-nao-perde-em-silencio
test('store cheio: a gravação que falha apaga as sobras e tenta de novo', async ($: any, on: any) => {
  const { log } = fixar(on)
  comandoNaTela(on)
  for (const k of SOBRAS) CHEIO[k] = { x: 1 }
  CHEIO['sessions'] = ['outra']
  CHEIO['session:outra'] = []
  armazem(on, CHEIO, { recusar: d => SOBRAS.some(k => k in d) })
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  expect(SOBRAS.filter(k => k in CHEIO), JSON.stringify(Object.keys(CHEIO))).toEqual([])
  expect('session:outra' in CHEIO, JSON.stringify(Object.keys(CHEIO))).toBe(true)
  expect([`session:${SESSAO}`, `work:${SESSAO}`, `links:${SESSAO}`].filter(k => !(k in CHEIO)), JSON.stringify(Object.keys(CHEIO))).toEqual([])
  expect(naoGravado(log).length, JSON.stringify(log)).toBe(1)
  // Gravou na segunda tentativa: o /task-tree não fala do store.
  expect(await comando($)).not.toContain('Store:')
})

// Regra: durabilidade.store-cheio-nao-perde-em-silencio
test('store que não aceita nada: o painel segue na tela e o log diz', async ($: any, on: any) => {
  const { log } = fixar(on)
  comandoNaTela(on)
  armazem(on, {}, { recusar: () => true })
  await pedido($, 'Pedido um')
  const r = await plan($, A)
  expect(r.erro, r.texto).toBe(false)
  expect(r.texto).toContain('Plano exibido')
  await start($, ['1'])
  const p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  expect(naoGravado(log).length > 0, JSON.stringify(log)).toBe(true)
  expect(await comando($)).toContain('o painel na tela está certo, mas não está sendo salvo')
})

// Regra: durabilidade.store-cheio-nao-perde-em-silencio
test('a sessão que volta à lista regrava trabalho, fim do turno e ligações', async ($: any, on: any) => {
  fixar(on)
  const dados: Record<string, unknown> = {}
  armazem(on, dados)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, B)
  const minhas = [`session:${SESSAO}`, `work:${SESSAO}`, `turn:${SESSAO}`, `links:${SESSAO}`]
  expect(minhas.filter(k => !(k in dados)), JSON.stringify(Object.keys(dados))).toEqual([])
  // A poda de outra sessão: os registros desta saem, e ela sai da lista.
  for (const k of minhas) delete dados[k]
  dados['sessions'] = ['outra']
  await start($, ['b1'])
  expect(minhas.filter(k => !(k in dados)), JSON.stringify(Object.keys(dados))).toEqual([])
})

// A pasta dos arquivos publicados: o de uma sessão que não existe mais, o de uma listada, o de uma
// arquivada e o de uma não listada gravado há pouco (todos com mais de 1 KB).
const DIA = 24 * 3600 * 1000
const SUMIU = 'local_99999999-9999-9999-9999-999999999999'
const VIVA = 'local_11111111-1111-1111-1111-111111111111'
const ARQUIVADA = 'local_22222222-2222-2222-2222-222222222222'
const RECENTE = 'local_33333333-3333-3333-3333-333333333333'
const PASTA = [
  { name: `${SUMIU}.json`, size: 5000, mtimeMs: DIA },
  { name: `${VIVA}.json`, size: 5000, mtimeMs: DIA },
  { name: `${ARQUIVADA}.json`, size: 5000, mtimeMs: DIA },
  { name: `${RECENTE}.json`, size: 5000, mtimeMs: 10 * DIA - 3600 * 1000 },
]

// Regra: durabilidade.publicado-de-sessao-que-nao-existe-e-esvaziado
test('o arquivo de uma sessão que o app não lista mais é esvaziado, e o de uma listada não', async ($: any, on: any) => {
  fixar(on, { agora: 10 * DIA })
  armazem(on, {})
  const h = host(on, [{ id: VIVA }, { id: ARQUIVADA, arquivada: true, rodando: false }], { pasta: PASTA })
  await iniciarSessao($)
  await new Promise(r => (globalThis as any).setTimeout(r, 100))
  const g = h.gravados()
  expect(JSON.parse(g[SUMIU] ?? 'null'), JSON.stringify(g)).toEqual({ version: 1, waiting: false, waits: [], children: [] })
  for (const id of [VIVA, ARQUIVADA, RECENTE]) expect(g[id], id).toBeUndefined()
})

// Regra: durabilidade.publicado-de-sessao-que-nao-existe-e-esvaziado
test('com a lista do app em erro, nada é esvaziado', async ($: any, on: any) => {
  fixar(on, { agora: 10 * DIA })
  armazem(on, {})
  const h = host(on, [{ id: VIVA }], { pasta: PASTA, listaFalha: true })
  await iniciarSessao($)
  await new Promise(r => (globalThis as any).setTimeout(r, 100))
  expect(h.gravados()[SUMIU], JSON.stringify(h.gravados())).toBeUndefined()
})

// O painel que saiu do store volta do arquivo que a sessão publicou: o 1/2 publica, os seguintes
// (processo novo, store sem o painel) servem esse arquivo como o da própria sessão.
const PUBLICADO: { texto?: string } = {}
const FILHA_X = { id: K1, nome: 'filha-um', painel: { tasks: [TAREFA] } }
// A filha parada: a tarefa de onde ela foi aberta mostra o fim do turno desta sessão, não o dela.
const FILHA_PARADA = { ...FILHA_X, rodando: false }
const PRIMEIRO: No[] = [{ id: 'p', title: 'Primeira' }]
const SEGUNDO: No[] = [{ id: 'x', title: 'Tarefa x' }, { id: 'y', title: 'Tarefa y' }]

// Regra: durabilidade.painel-volta-do-arquivo-publicado
test('painel fora do store, 1/2: a sessão publica o painel', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  const h = host(on, [FILHA_X])
  await pedido($, 'Pedido um')
  await plan($, PRIMEIRO)
  await start($, ['p'])
  await done($, ['p'], 'feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, SEGUNDO)
  await start($, ['x'])
  await abrirSessao($)
  await aviso($)
  await fimDoTurno($)
  const f = h.proprio()
  expect(typeof f?.turn?.ended, JSON.stringify(f?.turn)).toBe('number')
  PUBLICADO.texto = JSON.stringify(f)
})

// Regra: durabilidade.painel-volta-do-arquivo-publicado
test('painel fora do store, 2/2: o processo novo o traz do arquivo publicado', async ($: any, on: any) => {
  fixar(on)
  const dados: Record<string, unknown> = {}
  armazem(on, dados)
  host(on, [FILHA_PARADA], { arquivoProprio: PUBLICADO.texto })
  await iniciarSessao($)
  // Antes de qualquer turno novo: o fim do turno voltou com o painel.
  const p = await painel($)
  esperarEstado(p, 'Tarefa x', 'aguardando')
  esperarEstado(p, 'Tarefa y', 'pendente')
  expect(tem(p, '+1 pedidos anteriores'), emTexto(p)).toBe(true)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Tarefa x'])
  expect(temPainel(dados), JSON.stringify(Object.keys(dados))).toBe(true)
})

// Regra: durabilidade.painel-volta-do-arquivo-publicado
test('painel fora do store, sem session.start: o primeiro uso o traz do arquivo', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  host(on, [FILHA_PARADA], { arquivoProprio: PUBLICADO.texto })
  await aviso($)
  const p = await painel($)
  // O fim do turno deixou a tarefa ◷, e o aviso não a reacende (decisão de 2026-11-14).
  esperarEstado(p, 'Tarefa x', 'aguardando')
  expect(tem(p, '+1 pedidos anteriores'), emTexto(p)).toBe(true)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Tarefa x'])
})

// Regra: durabilidade.painel-volta-do-arquivo-publicado
test('com o painel no store, o arquivo não é lido como painel', async ($: any, on: any) => {
  fixar(on)
  armazem(on, { [`session:${SESSAO}`]: [{ agent: '', label: '', tasks: [{ id: 'A', short: 'A', title: 'Plano A', status: 'open', children: [] }] }], sessions: [SESSAO] })
  host(on, [FILHA_PARADA], { arquivoProprio: PUBLICADO.texto })
  await iniciarSessao($)
  const p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(tem(p, 'Tarefa x'), emTexto(p)).toBe(false)
})

// Regra: durabilidade.painel-volta-do-arquivo-publicado
test('fora do app, sem painel no store, o painel volta vazio', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  await iniciarSessao($)
  const p = await painel($)
  expect(p.some(l => l.estado !== undefined), emTexto(p)).toBe(false)
})

// As aberturas do painel ($.ui.open) e se ele está colocado na tela ($.ui.panes). Antes da primeira chamada a $.
function janela(on: any) {
  const j = { aberturas: 0, colocado: false }
  on('ui.open', () => {
    j.aberturas++
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: [{ id: 'task-tree', isPlaced: j.colocado, isShown: j.colocado }] }))
  return j
}
const SUB: No[] = [{ id: 's', title: 'Do subagente' }]

// Regra: durabilidade.painel-fechado-reabre-so-na-mensagem
test('o plan não reabre o painel que a pessoa fechou; a mensagem seguinte dela reabre', async ($: any, on: any) => {
  fixar(on)
  subagente(on, 'sub-1')
  const j = janela(on)
  await pedido($, 'Pedido um')
  expect(j.aberturas).toBe(1)
  j.colocado = true
  await plan($, A)
  await start($, ['1'])
  j.colocado = false
  await plan($, B)
  await plan($, SUB, undefined, 'sub-1')
  expect(j.aberturas).toBe(1)
  await pedido($, 'Pedido dois')
  expect(j.aberturas).toBe(2)
})

const JANELA_RECARGA: Record<string, unknown> = {}
// Regra: durabilidade.painel-fechado-reabre-so-na-mensagem
test('a recarga do mod não reabre o painel, 1/2: o processo abre', async ($: any, on: any) => {
  fixar(on)
  estado(on, JANELA_RECARGA, 'captura')
  armazem(on, {})
  const j = janela(on)
  await iniciarSessao($)
  expect(j.aberturas).toBe(1)
})

// Regra: durabilidade.painel-fechado-reabre-so-na-mensagem
test('a recarga do mod não reabre o painel, 2/2: o módulo novo com o state mantido não abre', async ($: any, on: any) => {
  exigir(Object.keys(JANELA_RECARGA).length > 0)
  fixar(on)
  estado(on, JANELA_RECARGA, 'semear')
  armazem(on, {})
  const j = janela(on)
  await iniciarSessao($)
  expect(j.aberturas).toBe(0)
})

// Regra: durabilidade.painel-fechado-reabre-so-na-mensagem
test('o processo novo abre o painel', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  const j = janela(on)
  await iniciarSessao($)
  expect(j.aberturas).toBe(1)
})

// Regra: durabilidade.painel-fechado-reabre-so-na-mensagem
test('a mensagem de outra sessão e o aviso do app não reabrem', async ($: any, on: any) => {
  fixar(on)
  const j = janela(on)
  await mensagemDe($, K1, 'oi')
  await aviso($)
  expect(j.aberturas).toBe(0)
})
