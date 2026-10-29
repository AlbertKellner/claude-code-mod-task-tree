import { expect, test } from 'claude-code/testing'
import { PUBLISHED_FILES } from './fixtures/publicados'
import { armazem, estado, fixar, host, SESSAO } from './kit/ambiente'
import { abrirSessao, aviso, done, esc, ferramenta, fimDoTurno, iniciarSessao, limpar, pedido, plan, retomar, start, visao, type No } from './kit/cenario'
import { cabecalho, emTexto, esperarEstado, linha, painel, type Linha } from './kit/leitura'

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
  await visao($, 'resumida')
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
  await visao($, 'completa')
  p = await painel($)
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
    const primeira = (doc.groups?.find((g: any) => g.agent === '')?.tasks ?? doc.tasks ?? [])[0]
    if (primeira) expect(tem(p, primeira.title), `${f.label}:\n${emTexto(p)}`).toBe(true)
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

