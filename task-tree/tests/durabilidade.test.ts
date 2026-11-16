import { expect, mock } from 'claude-code/testing'
import { test } from './kit/teste'
import { LATER_PUBLISHED_FILES, PUBLISHED_FILES } from './fixtures/publicados'
import { ABORTED_ONLY_FILE } from './fixtures/publicados'
import { AGORA, armazem, estado, fixar, host, lancaveis, responderDepois, responderEnvio, SESSAO, subagente, EU, type Host } from './kit/ambiente'
import { chamadaDoSubagente, falha, fimDoSubagente, lancar } from './kit/cenario'
import { abrirSessao, aviso, done, envio, esc, ferramenta, fimDoTurno, iniciarSessao, limpar, mensagemDe, pedido, plan, retomar, start, type No } from './kit/cenario'
import { cartaSob, cartoes, comHistorico, cabecalho, emTexto, emTextoDoApp, esperarEstado, linha, linhaDoApp, montar, noApp, painel, type Linha } from './kit/leitura'

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
test('respawn sem session.start, 1/2: dois pedidos no store', async ($: any, on: any) => {
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
test('respawn sem session.start, 2/2: o painel e o trabalho voltam no primeiro uso, e o store não encolhe', async ($: any, on: any) => {
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

// O que a sessão tinha feito, no grupo principal publicado (o histórico de antes de cada /clear).
const passado = (h: { proprio(): any }) => ((h.proprio()?.groups ?? []).find((g: any) => g.agent === '')?.past ?? []) as any[]
const achatar = (l: any[]): any[] => l.flatMap(t => [t, ...achatar(t.children ?? [])])

// Regra: sessoes.clear-na-filha-mantem-o-historico
test('o /clear guarda no painel publicado o que a sessão tinha feito, e o painel dela fica vazio', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await limpar($)
  const p = await painel($)
  expect(cabecalho(p).vazio, emTexto(p)).toBe(true)
  const main = (h.proprio()?.groups ?? []).find((g: any) => g.agent === '')
  expect(main?.tasks ?? null, JSON.stringify(h.proprio())).toEqual([])
  expect(passado(h).length, JSON.stringify(h.proprio())).toBe(1)
  const tarefas = achatar(passado(h)[0].tasks)
  expect(tarefas.find(t => t.title === 'Um')?.status, JSON.stringify(tarefas)).toBe('done')
  expect(tarefas.find(t => t.title === 'Dois')?.status, JSON.stringify(tarefas)).toBe('interrupted')
})

// Regra: durabilidade.clear-esvazia
test('depois do /clear, o plano que reusa o id de uma tarefa recolhida nasce aberto', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  const m = await montar($)
  await m.recolher('Plano A')
  await m.fim()
  await limpar($)
  await pedido($, 'Pedido dois')
  await plan($, A)
  const p = await painel($)
  expect(tem(p, 'Um') && tem(p, 'Dois'), emTexto(p)).toBe(true)
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

// Um subagente que trabalha sem usar o painel faz três chamadas (o 1/2); o módulo novo, com o state
// mantido, conta a quarta a partir do cartão (o 2/2).
const CHAMADAS: Record<string, unknown> = {}
const UMA: No[] = [{ id: '1', title: 'Investigar' }]

// Regra: subagentes.contagem-de-chamadas-segue-na-recarga
test('recarga com subagente trabalhando, 1/2: três chamadas contadas', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  estado(on, CHAMADAS, 'captura')
  lancaveis(on, ['s1'])
  on('tool.call', { tool: 'Grep' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, UMA)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  for (const n of [1, 2, 3]) {
    await chamadaDoSubagente($, 's1', 'Grep', { pattern: `p${n}` })
    await relogio.advance(1000)
  }
  const p = await painel($)
  expect(emTexto(p)).toContain('Grep "p3" · 3 chamadas')
})

// Regra: subagentes.contagem-de-chamadas-segue-na-recarga
test('recarga com subagente trabalhando, 2/2: a contagem segue de onde estava', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  estado(on, CHAMADAS, 'semear')
  exigir(Object.keys(CHAMADAS).length > 0)
  lancaveis(on, ['s1'])
  on('tool.call', { tool: 'Grep' }, () => ({ result: 'ok' }))
  await chamadaDoSubagente($, 's1', 'Grep', { pattern: 'p4' })
  await relogio.advance(1000)
  const p = await painel($)
  expect(emTexto(p)).toContain('Grep "p4" · 4 chamadas')
})

// Duas mensagens na fila da mesma filha, de duas tarefas; ela toma a primeira (o 1/2). O 2/2 é o módulo
// novo (recarga, o state mantido) ou o processo novo (reinício, tudo do store). A filha segue rodando
// sob a tarefa: o desenho a mostra ◉ mesmo concluída, então o que se lê é a contagem e a carta.
const FILA2: Record<string, unknown> = {}
const FILA2_STORE: Record<string, unknown> = {}
const duasNaFila = async ($: any, on: any) => {
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await start($, ['2.1'])
  await envio($, 'local_x')
  h.recebeu('local_x', AGORA)
  await aviso($)
  const p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  expect(cartaSob(p, 'Um'), emTexto(p)).toBe('entregue')
  expect(cabecalho(p).feitas, emTexto(p)).toBe(1)
  expect(cartaSob(p, 'Dois.um'), emTexto(p)).toBe('fila')
}
// A filha segue publicando só o primeiro recibo.
const soOPrimeiro = (on: any) => {
  const h = host(on, [{ id: 'local_x', recebidas: [{ from: EU, at: AGORA }] }])
  responderEnvio(on)
  return h
}
const segundaSegue = async ($: any, h: Host) => {
  const texto = JSON.stringify((await aviso($))?.context ?? [])
  let p = await painel($)
  expect(cabecalho(p).feitas, emTexto(p)).toBe(1)
  expect(cartaSob(p, 'Dois.um'), emTexto(p)).toBe('fila')
  // O processo novo ainda pode repetir o recebimento da primeira (o lembrete já dado não vai ao store);
  // o da segunda, não.
  expect(texto, 'o aviso ao modelo').not.toMatch(/recebimento confirmado[^"]*Dois.um/)
  h.recebeu('local_x', AGORA + 1)
  await aviso($)
  p = await painel($)
  expect(cabecalho(p).feitas, emTexto(p)).toBe(2)
  expect(cartaSob(p, 'Dois.um'), emTexto(p)).toBe('entregue')
}

// Regra: durabilidade.recibo-usado-sobrevive-a-recarga
test('recarga com duas mensagens na fila, 1/2: a filha toma a primeira', async ($: any, on: any) => {
  fixar(on)
  estado(on, FILA2, 'captura')
  await duasNaFila($, on)
})

// Regra: durabilidade.recibo-usado-sobrevive-a-recarga
test('recarga com duas mensagens na fila, 2/2: o módulo novo não confirma a segunda com o recibo da primeira', async ($: any, on: any) => {
  fixar(on)
  estado(on, FILA2, 'semear')
  exigir(Object.keys(FILA2).length > 0)
  const h = soOPrimeiro(on)
  await segundaSegue($, h)
})

// Regra: durabilidade.recibo-usado-sobrevive-a-recarga
test('reinício com duas mensagens na fila, 1/2: a filha toma a primeira', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FILA2_STORE)
  await duasNaFila($, on)
})

// Regra: durabilidade.recibo-usado-sobrevive-a-recarga
test('reinício com duas mensagens na fila, 2/2: o processo novo não confirma a segunda com o recibo da primeira', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FILA2_STORE)
  exigir(temPainel(FILA2_STORE))
  const h = soOPrimeiro(on)
  await iniciarSessao($)
  await segundaSegue($, h)
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
  expect(PUBLISHED_FILES.length).toBe(8)
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

// Um arquivo de filha com elementos fora do formato: um grupo sem tarefas, uma tarefa sem filhos, um
// nulo, uma neta com tarefa sem filhos e um envio sem destino.
const RUIM = {
  version: 1,
  waiting: false,
  waits: [null],
  groups: [
    { agent: '', label: '', tasks: [{ id: 'b', short: 'b', title: 'Boa', status: 'open', started: 1, startedAt: 1, children: [] }, { id: 'x', short: 'x', title: 'Sem filhos', status: 'open' }, null] },
    { agent: 'sub', label: 'L' },
  ],
  children: [{ id: 'n1', name: 'neta', title: 'neta', running: false, archived: false, panel: { groups: [{ agent: '', label: '', tasks: [{ id: 'q', title: 'Neta ruim', status: 'open' }] }], waits: [], children: [] } }],
  sends: [{ anchor: '1', at: 1 }, { to: 'alguem', at: 2, text: 'oi' }],
}

// Regra: durabilidade.publicado-fora-do-formato-nao-derruba
test('a filha que publica um grupo sem tarefas, uma tarefa sem filhos e um envio sem destino segue com o cartão, e o painel, as ferramentas e a publicação seguem', async ($: any, on: any) => {
  const { log } = fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-ruim', publicado: JSON.stringify(RUIM) }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await aviso($)
  await aviso($)
  const p = await painel($)
  expect(p.filter(l => /erro ao desenhar|indispon/i.test(l.texto)).map(l => l.texto), emTexto(p)).toEqual([])
  expect(linha(p, 'filha-ruim').sessao, emTexto(p)).toBe(true)
  expect(tem(p, 'Boa'), emTexto(p)).toBe(true)
  expect(tem(p, 'Sem filhos'), emTexto(p)).toBe(false)
  expect(tem(p, 'Neta ruim'), emTexto(p)).toBe(false)
  expect((await done($, ['1'])).erro).toBe(false)
  expect((await plan($, B)).erro).toBe(false)
  expect(h.proprio()?.children?.[0]?.id).toBe(K1)
  expect(log.filter(l => l.includes(K1) && l.includes('lido em parte')).length, log.join('\n')).toBe(1)
})

// O id da própria sessão na recarga: o 1/2 grava o state, o 2/2 (módulo novo) o semeia.
const ID_PROPRIO: Record<string, unknown> = {}

// Regra: durabilidade.id-proprio-sobrevive-a-recarga
test('o id da própria sessão volta do estado depois da recarga, 1/2: lido do app', async ($: any, on: any) => {
  fixar(on)
  estado(on, ID_PROPRIO, 'captura')
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  expect(h.proprio(), 'o painel publicado').toBeDefined()
})

// Regra: durabilidade.id-proprio-sobrevive-a-recarga
test('o id da própria sessão volta do estado depois da recarga, 2/2: o app não responde o id, e o painel segue publicado', async ($: any, on: any) => {
  fixar(on)
  estado(on, ID_PROPRIO, 'semear')
  const h = host(on, [], { idFalha: true })
  exigir(ID_PROPRIO.selfId !== undefined && ID_PROPRIO.groups !== undefined)
  await start($, ['1'])
  const meu = h.proprio()
  expect(meu, 'o painel publicado').toBeDefined()
  expect(JSON.stringify(meu.groups)).toContain('"title":"Um"')
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

// O turno que morreu por erro, num processo novo (decisão do usuário de 2026-11-14: "✕ \"falhou\" (Recomendado)").
const FALHA: Record<string, unknown> = {}

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('turno que falhou no reinício, 1/2: o turno morre por erro com uma tarefa iniciada', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FALHA)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await start($, ['2.1'])
  await falha($)
  expect(temPainel(FALHA), JSON.stringify(Object.keys(FALHA))).toBe(true)
})

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('turno que falhou no reinício, 2/2: a iniciada segue ✕ "falhou" e o pedido seguinte pede para replanejar dizendo o erro', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FALHA)
  exigir(temPainel(FALHA))
  await iniciarSessao($)
  const p = await painel($)
  esperarEstado(p, 'Dois.um', 'interrompida')
  expect(linha(p, 'Dois.um').texto, emTexto(p)).toContain('falhou')
  semAndamento(p)
  const r = await pedido($, 'segue')
  expect((r?.context ?? []).join(' | ')).toContain('terminou com erro')
})

// Regra: durabilidade.filha-recem-aberta-ainda-nao-listada
test('a filha recém-aberta que a lista do host ainda não traz segue sob a tarefa de origem quando passa a ser listada', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [
    { id: K1, nome: 'filha-um', listada: false, painel: { tasks: [TAREFA] } },
    { id: K2, nome: 'filha-dois', listada: false, painel: { tasks: [{ ...TAREFA, title: 'Tarefa da segunda' }] } },
  ])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  // A lista vem vazia: a recém-aberta segue como sessão iniciando, sob a tarefa.
  await aviso($)
  let p = await painel($)
  expect(cartoes(p, 'Sessão iniciando…').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  // Uma segunda filha, listada logo: a lista não vem vazia, e a primeira segue fora dela.
  await done($, ['1'])
  await start($, ['2.1'])
  await abrirSessao($)
  h.filha(K2).listada = true
  await aviso($)
  h.filha(K1).listada = true
  await aviso($)
  p = await painel($)
  expect(cartoes(p, 'filha-um').map(c => c.sob), emTexto(p)).toEqual(['Um'])
  expect(cartoes(p, 'filha-dois').map(c => c.sob), emTexto(p)).toEqual(['Dois.um'])
})

// Regra: durabilidade.status-nao-segura-a-gravacao
test('com a linha de status falhando, o plan responde, o painel vai ao store e é publicado', async ($: any, on: any) => {
  // Como fixar, mas o app recusa a linha de status (o motor engole essa falha: "$.ui.status dropped").
  // A conta que lança não tem dado real que a reproduza; o teste trava a ordem e a proteção.
  mock.clock(on, { now: AGORA })
  on('ui.status', () => ({ deny: 'status quebrado' }))
  on('ui.log', () => ({ value: undefined }))
  on('prompt.submit', (_$: any, e: any) => e)
  on('turn.complete', () => ({ text: '' }))
  on('session.start', () => ({ cwd: '.' }))
  on('command.register', () => ({ value: {} }))
  on('tool.register', () => ({ value: {} }))
  on('classic.SessionStart', () => ({}))
  const dados: Record<string, unknown> = {}
  armazem(on, dados)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  const p = await plan($, [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }])
  expect(p.erro, p.texto).toBe(false)
  expect(p.texto).toContain('Plano exibido')
  const s = await start($, ['1'])
  expect(s.texto).toContain('Em andamento: Um')
  expect(JSON.stringify(dados[`session:${SESSAO}`] ?? null)).toContain('Um')
  expect(JSON.stringify(h.proprio()?.groups ?? null)).toContain('Um')
})

// Regra: durabilidade.fim-do-turno-registrado-mesmo-com-falha
test('com a lista de agentes falhando, o fim do subagente ainda interrompe o que ele deixou aberto', async ($: any, on: any) => {
  const { log } = fixar(on)
  let quebrar = false
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'sub-1' }))
  on('agent.list', () => (quebrar ? { deny: 'lista quebrada' } : { value: [{ id: 'sub-1', type: 'general-purpose', description: 'subagente sub-1' }] }))
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await plan($, [{ id: 'S', title: 'Do subagente' }], undefined, 'sub-1')
  await start($, ['S'], 'sub-1')
  quebrar = true
  await fimDoSubagente($, 'sub-1')
  quebrar = false
  const p = await painel($)
  esperarEstado(p, 'Do subagente', 'interrompida')
  expect(linha(p, 'Explore: ler o kit').texto, emTexto(p)).not.toContain('trabalhando')
  expect(log.some(l => l.includes('fim do turno')), log.join('\n')).toBe(true)
})

// O arquivo que esta sessão publica (o cartão dela na sessão que a abriu), logo depois de um plan ou
// de um start: já com o trabalho e as ligações novas.
const tarefaPublicada = (h: { proprio(): any }, titulo: string): any => {
  const achar = (l: any[]): any => {
    for (const t of l) {
      if (t.title === titulo) return t
      const x = achar(t.children ?? [])
      if (x) return x
    }
  }
  return achar(((h.proprio()?.groups ?? []).find((g: any) => g.agent === '')?.tasks ?? []))
}

// Regra: durabilidade.plan-publica-o-trabalho-novo
test('numa sessão sem filhas, o que ela publica logo depois do plan já traz o trabalho novo', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1', '2'], 'Feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, B)
  expect(h.proprio()?.work).toEqual(['B'])
  expect(JSON.stringify(h.proprio()?.groups ?? [])).toContain('Plano B')
})

// Regra: durabilidade.plan-publica-o-trabalho-novo
test('o plan que reusa o id de uma tarefa com sessão aberta publica a sessão sob a tarefa antiga', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: K1, nome: 'filha-um' }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await done($, ['1', '2'], 'Feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, A)
  const publicado = JSON.stringify(h.proprio()?.children ?? [])
  expect(publicado).toContain(':A/1"')
  expect(publicado).not.toContain('"A/1"')
})

// Regra: durabilidade.plan-publica-o-trabalho-novo
test('o start numa tarefa antiga, em pedido novo, publica o trabalho com ela', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await done($, ['1'], 'Feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, B)
  await start($, ['b1'])
  await done($, ['b1', 'b2'], 'Feito')
  await fimDoTurno($)
  // Pedido três: retoma a tarefa do pedido um, já concluída (com tudo fechado, é trabalho novo).
  await pedido($, 'Pedido três')
  await start($, ['A/1'])
  expect(h.proprio()?.work ?? []).toEqual(['A'])
})

// Regra: durabilidade.publicacoes-em-ordem
test('uma publicação atrasada não grava por cima da mais nova', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [])
  on('prompt.attachment', (_$: any, e: any) => ({ text: e.text }))
  // Armado uma vez: a leitura do uso do contexto fica presa até o relógio andar 1 s.
  let armado = false
  let alcancado = false
  on('session.usage', async (_$: any, e: any, next: any) => {
    if (armado) {
      armado = false
      alcancado = true
      await relogio.sleep(1000)
    }
    return next(e)
  })
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  armado = true
  await $.prompt.attachment({ type: 'ultra_effort_enter', text: 'x', origin: { kind: 'engine' } })
  await painel($)
  expect(alcancado, 'a publicação do ultracode não chegou à leitura do uso').toBe(true)
  const fechou = done($, ['1'])
  await relogio.advance(1000)
  await fechou
  expect(tarefaPublicada(h, 'Um')?.status).toBe('done')
  expect(h.proprio()?.ultracode).toBe(true)
})

// Uma gravação do state que o host recusa (o stub devolve deny: a chamada do mod rejeita), enquanto
// `quebrar` disser que sim para a chave.
const recusarGravacao = (on: any, quebrar: (chave: string) => boolean) =>
  on('state.set', (_$: any, e: any, next: any) => (quebrar(String(e.key)) ? { deny: 'gravação recusada' } : next(e)))

// Regra: durabilidade.fim-do-turno-registrado-mesmo-com-falha
test('a mensagem de outra sessão cujo nome não pôde ser guardado ainda abre o pedido', async ($: any, on: any) => {
  const { log } = fixar(on)
  recusarGravacao(on, k => k === 'names')
  const ctx = ((await mensagemDe($, 'local_x', 'Faça o relatório'))?.context ?? []).join(' | ')
  expect(ctx).toContain('A PRIMEIRA chamada')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  const p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(emTexto(p)).toContain('Faça o relatório')
  expect(log.some(l => l.includes('passo learnNames')), log.join('\n')).toBe(true)
})

// Regra: durabilidade.fim-do-turno-registrado-mesmo-com-falha
test('o fim do turno do loop principal é gravado mesmo se limpar o resumo falhar', async ($: any, on: any) => {
  const { log } = fixar(on)
  const h = host(on, [])
  let quebrar = false
  recusarGravacao(on, k => quebrar && k === 'brief')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['2'], 'Feito')
  quebrar = true
  await fimDoTurno($)
  quebrar = false
  const p = await painel($)
  esperarEstado(p, 'Um', 'aguardando')
  expect(typeof h.proprio()?.turn?.ended, JSON.stringify(h.proprio()?.turn)).toBe('number')
  expect(resposta(h, 'Feito'), JSON.stringify(h.proprio())).toBe(true)
  expect(log.some(l => l.includes('fim do turno, passo limpar o resumo')), log.join('\n')).toBe(true)
})

// As dobras da pessoa num processo novo: um store por par, e o da retomada.
const DOBRAS: Record<string, unknown> = {}
const DOBRAS_CLEAR: Record<string, unknown> = {}
const DOBRAS_RETOMADA: Record<string, unknown> = {}
const temDobras = (store: Record<string, unknown>) => Object.keys(store).some(k => k.startsWith('folds:'))

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('dobras no reinício, 1/2: a pessoa recolhe uma tarefa e abre o histórico', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, DOBRAS)
  await pedido($, 'Pedido um')
  await plan($, B)
  await start($, ['b1', 'b2'])
  await done($, ['b1', 'b2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, A)
  await start($, ['1'])
  const m = await montar($)
  await m.recolher('Plano A')
  await m.recolher('+1 pedidos anteriores')
  await m.fim()
  const p = await painel($)
  expect(tem(p, 'Um') || tem(p, 'Dois'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  expect(temPainel(DOBRAS) && temDobras(DOBRAS), JSON.stringify(Object.keys(DOBRAS))).toBe(true)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('dobras no reinício, 2/2: o processo novo desenha como ela deixou', async ($: any, on: any) => {
  fixar(on)
  armazem(on, DOBRAS)
  exigir(temPainel(DOBRAS))
  await iniciarSessao($)
  const p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(tem(p, 'Um') || tem(p, 'Dois'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('dobras no respawn sem session.start, 2/2: o primeiro desenho já vem como ela deixou', async ($: any, on: any) => {
  fixar(on)
  armazem(on, DOBRAS)
  exigir(temPainel(DOBRAS))
  let p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(tem(p, 'Um') || tem(p, 'Dois'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  // A primeira escrita guarda as dobras trazidas, não as perde.
  await start($, ['2.1'])
  p = await painel($)
  expect(tem(p, 'Dois.um'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo, durabilidade.clear-esvazia
test('/clear e reinício, 1/2: recolhe, limpa e planeja de novo', async ($: any, on: any) => {
  fixar(on)
  armazem(on, DOBRAS_CLEAR)
  await pedido($, 'Pedido um')
  await plan($, A)
  const m = await montar($)
  await m.recolher('Plano A')
  await m.fim()
  await limpar($)
  await pedido($, 'Pedido dois')
  await plan($, A)
  const p = await painel($)
  expect(tem(p, 'Um') && tem(p, 'Dois'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo, durabilidade.clear-esvazia
test('/clear e reinício, 2/2: o processo novo não traz a dobra de antes do /clear', async ($: any, on: any) => {
  fixar(on)
  armazem(on, DOBRAS_CLEAR)
  exigir(temPainel(DOBRAS_CLEAR))
  await iniciarSessao($)
  const p = await painel($)
  expect(tem(p, 'Um') && tem(p, 'Dois'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('a retomada traz as dobras da sessão retomada', async ($: any, on: any) => {
  fixar(on)
  armazem(on, DOBRAS_RETOMADA)
  await pedido($, 'Pedido um')
  await plan($, A)
  const m = await montar($)
  await m.recolher('Plano A')
  await m.fim()
  const dobra = DOBRAS_RETOMADA[`folds:${SESSAO}`]
  expect(dobra, JSON.stringify(Object.keys(DOBRAS_RETOMADA))).toBeDefined()
  // Uma sessão sem dobras guardadas: a retomada vem toda aberta, sem a dobra de antes.
  DOBRAS_RETOMADA['session:uuid-aberta'] = DOBRAS_RETOMADA[`session:${SESSAO}`]
  await retomar($, 'uuid-aberta')
  let p = await painel($)
  expect(tem(p, 'Plano A') && tem(p, 'Um'), emTexto(p)).toBe(true)
  // Uma sessão que a pessoa deixou com o plano recolhido: volta recolhido.
  DOBRAS_RETOMADA['session:uuid-recolhida'] = DOBRAS_RETOMADA['session:uuid-aberta']
  DOBRAS_RETOMADA['folds:uuid-recolhida'] = dobra
  await retomar($, 'uuid-recolhida')
  p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(tem(p, 'Um'), emTexto(p)).toBe(false)
})

// O painel guardado com versão: o registro do store e o grupo do state que atravessou uma recarga.
const VELHA = [{ agent: '', label: '', tasks: [{ id: 'V', short: 'V', title: 'Velha', status: 'done', children: [] }] }]
const lojaCom = (registro: unknown): Record<string, unknown> => ({ [`session:${SESSAO}`]: registro, sessions: [SESSAO] })
// O registro guardado é ignorado: o painel começa vazio, o log diz o motivo e as ferramentas seguem.
async function painelGuardadoIgnorado($: any, on: any, registro: unknown) {
  const { log } = fixar(on)
  armazem(on, lojaCom(registro))
  host(on, [])
  await iniciarSessao($)
  let p = await painel($)
  expect(cabecalho(p).vazio, emTexto(p)).toBe(true)
  expect(log.some(l => l.includes('painel guardado ignorado')), log.join('\n')).toBe(true)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
}
const FORMA_NOVA: Record<string, unknown> = {}
const RECARGA_RUIM: Record<string, unknown> = {}

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('o painel guardado de uma versão desconhecida é ignorado, com aviso no log', async ($: any, on: any) => {
  await painelGuardadoIgnorado($, on, { version: 99, groups: VELHA })
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('o painel guardado fora do formato é ignorado, e as ferramentas seguem: um texto', async ($: any, on: any) => {
  await painelGuardadoIgnorado($, on, 'painel')
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('o painel guardado fora do formato é ignorado, e as ferramentas seguem: um grupo com tasks que não é lista', async ($: any, on: any) => {
  await painelGuardadoIgnorado($, on, [{ agent: '', label: '', tasks: 'quebrado' }])
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('o painel guardado fora do formato é ignorado, e as ferramentas seguem: uma tarefa sem children', async ($: any, on: any) => {
  await painelGuardadoIgnorado($, on, [{ agent: '', label: '', tasks: [{ id: 'V', short: 'V', title: 'Velha', status: 'done' }] }])
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('o painel guardado sem versão, da forma anterior, é lido', async ($: any, on: any) => {
  fixar(on)
  armazem(on, lojaCom(VELHA))
  host(on, [])
  await iniciarSessao($)
  const p = await painel($)
  expect(tem(p, 'Velha'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('o painel guardado na forma nova volta num processo novo, 1/2: o painel vai ao store com a versão', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FORMA_NOVA)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const guardado = FORMA_NOVA[`session:${SESSAO}`] as { version?: unknown; groups?: unknown } | undefined
  expect(guardado?.version, JSON.stringify(guardado)).toBe(1)
  expect(Array.isArray(guardado?.groups), JSON.stringify(guardado)).toBe(true)
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('o painel guardado na forma nova volta num processo novo, 2/2: o processo novo o lê', async ($: any, on: any) => {
  fixar(on)
  armazem(on, FORMA_NOVA)
  host(on, [])
  exigir(temPainel(FORMA_NOVA))
  await iniciarSessao($)
  const p = await painel($)
  expect(tem(p, 'Plano A') && tem(p, 'Um') && tem(p, 'Dois.dois'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('recarga com o painel do state fora do formato: o painel volta do store', async ($: any, on: any) => {
  const { log } = fixar(on)
  armazem(on, lojaCom(VELHA))
  RECARGA_RUIM.groups = [{ agent: '', label: '', tasks: [{ id: 'Q', short: 'Q', title: 'Quebrada', status: 'talvez', children: [] }] }]
  estado(on, RECARGA_RUIM, 'semear')
  let p = await painel($)
  expect(tem(p, 'Velha'), emTexto(p)).toBe(true)
  expect(tem(p, 'Quebrada'), emTexto(p)).toBe(false)
  expect(log.some(l => l.includes('painel guardado ignorado')), log.join('\n')).toBe(true)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  expect(tem(p, 'Quebrada'), emTexto(p)).toBe(false)
})

// Regra: durabilidade.comando-diz-o-que-o-app-respondeu
test('/task-tree com o painel na tela diz os painéis do app e o tamanho do desenho', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  let foco: unknown
  on('ui.open', (_$: any, e: any) => {
    foco = e?.focus
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: [{ id: 'task-tree', isShown: true, isPlaced: true }, { id: 'outro', isShown: false, isPlaced: true }] }))
  await pedido($, 'Pedido um')
  await plan($, A)
  const t = await comando($)
  expect(foco).toBe(true)
  expect(t).toContain('Painel de tarefas aberto')
  expect(t).toContain('task-tree (na frente)')
  expect(t).toContain('outro (aba atrás de outra)')
  expect(t).toMatch(/Desenho: \d+ KB de \d+ KB/)
  expect(t).not.toContain('Store:')
})

// Regra: durabilidade.comando-diz-o-que-o-app-respondeu
test('/task-tree com o painel fora da tela diz o motivo do app', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'largura' } }))
  on('ui.panes', () => ({ value: [] }))
  await pedido($, 'Pedido um')
  const t = await comando($)
  expect(t).toContain('O app não pôs o painel na tela: largura')
  expect(t).toContain('Painéis: nenhum')
  expect(t).not.toContain('Store:')
})

// Regra: durabilidade.comando-diz-o-que-o-app-respondeu
test('/task-tree com a abertura do painel em erro diz o erro no motivo', async ($: any, on: any) => {
  fixar(on)
  armazem(on, {})
  on('ui.open', () => ({ deny: 'painel recusado pelo teste' }))
  on('ui.panes', () => ({ value: [] }))
  await pedido($, 'Pedido um')
  const t = await comando($)
  expect(t).toContain('O app não pôs o painel na tela:')
  expect(t).toContain('painel recusado pelo teste')
  expect(t).not.toContain('Store:')
})

// A recarga a quente no meio do turno (os pares 1/2 e 2/2 com o state mantido): uma tarefa em
// andamento, um subagente vivo e uma pergunta aberta. A espera é copiada no instante em que está
// aberta (o fim da chamada a apaga do state capturado), uma cópia para cada 2/2.
const RECARGA_TEMPO: Record<string, unknown> = {}
const RECARGA_SUB: Record<string, unknown> = {}
const RECARGA_ESPERA: Record<string, unknown> = {}
const ESPERA_PELA_MENSAGEM: Record<string, unknown> = {}
const ESPERA_PELO_FIM: Record<string, unknown> = {}
const PERGUNTA_NA_RECARGA = {
  questions: [{ question: 'Qual?', header: 'Rumo', multiSelect: false, options: [{ label: 'Opção A', description: 'a' }, { label: 'Opção B', description: 'b' }] }],
}
const ESPERANDO = 'Aguardando sua resposta'

// Regra: durabilidade.recarga-no-meio-do-turno-mantem-o-tempo
test('recarga no meio do turno, 1/2: uma tarefa em andamento no state', async ($: any, on: any) => {
  fixar(on)
  estado(on, RECARGA_TEMPO, 'captura')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  esperarEstado(await painel($), 'Um', 'andamento')
  expect(Object.keys(RECARGA_TEMPO).length, 'state capturado').toBeGreaterThan(0)
})

// Regra: durabilidade.recarga-no-meio-do-turno-mantem-o-tempo
test('recarga no meio do turno, 2/2: a tarefa segue em andamento e o tempo conta do start', async ($: any, on: any) => {
  fixar(on, { agora: AGORA + 10_000 })
  estado(on, RECARGA_TEMPO, 'semear')
  exigir(Object.keys(RECARGA_TEMPO).length > 0)
  const p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Plano A', 'andamento')
  esperarEstado(p, 'Pedido um', 'andamento')
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('0:10')
})

// Regra: durabilidade.recarga-com-subagente-vivo
test('recarga com subagente vivo, 1/2: o cartão trabalhando sob a tarefa', async ($: any, on: any) => {
  fixar(on)
  estado(on, RECARGA_SUB, 'captura')
  lancaveis(on, ['sub-r'])
  on('tool.call', { tool: 'Grep' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o código' })
  await chamadaDoSubagente($, 'sub-r', 'Grep', { pattern: 'x' })
  const p = await painel($)
  expect(linha(p, 'Explore: ler o código').texto, emTexto(p)).toContain('trabalhando')
  expect(debaixo(p, 'Explore: ler o código', 'Um'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.recarga-com-subagente-vivo
test('recarga com subagente vivo, 2/2: o cartão segue trabalhando sob a mesma tarefa e o fim dele diz concluído', async ($: any, on: any) => {
  fixar(on)
  estado(on, RECARGA_SUB, 'semear')
  exigir(Object.keys(RECARGA_SUB).length > 0)
  lancaveis(on, ['sub-r'])
  let p = await painel($)
  expect(linha(p, 'Explore: ler o código').texto, emTexto(p)).toContain('trabalhando')
  expect(debaixo(p, 'Explore: ler o código', 'Um'), emTexto(p)).toBe(true)
  await fimDoSubagente($, 'sub-r')
  p = await painel($)
  expect(linha(p, 'Explore: ler o código').texto, emTexto(p)).toContain('concluído')
  expect(debaixo(p, 'Explore: ler o código', 'Um'), emTexto(p)).toBe(true)
})

// Regra: durabilidade.recarga-com-espera-aberta
test('recarga com espera aberta, 1/2: a pergunta aberta sob a tarefa em andamento', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  estado(on, RECARGA_ESPERA, 'captura')
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA_NA_RECARGA)
  await relogio.settle()
  const p = await painel($)
  esperarEstado(p, ESPERANDO, 'aguardando')
  Object.assign(ESPERA_PELA_MENSAGEM, JSON.parse(JSON.stringify(RECARGA_ESPERA)))
  Object.assign(ESPERA_PELO_FIM, JSON.parse(JSON.stringify(RECARGA_ESPERA)))
  await relogio.advance(1000)
  await resp
})

// Regra: durabilidade.recarga-com-espera-aberta
test('recarga com espera aberta, 2/2: a espera segue sob a tarefa e sai com a mensagem seguinte', async ($: any, on: any) => {
  fixar(on)
  estado(on, ESPERA_PELA_MENSAGEM, 'semear')
  exigir(Object.keys(ESPERA_PELA_MENSAGEM).length > 0)
  let p = await painel($)
  esperarEstado(p, ESPERANDO, 'aguardando')
  esperarEstado(p, 'Um', 'andamento')
  expect(debaixo(p, ESPERANDO, 'Um'), emTexto(p)).toBe(true)
  await pedido($, 'sim')
  p = await painel($)
  expect(tem(p, ESPERANDO), emTexto(p)).toBe(false)
})

// Regra: durabilidade.recarga-com-espera-aberta
test('recarga com espera aberta, 2/2: a espera segue sob a tarefa e sai com o fim do turno', async ($: any, on: any) => {
  fixar(on)
  estado(on, ESPERA_PELO_FIM, 'semear')
  exigir(Object.keys(ESPERA_PELO_FIM).length > 0)
  let p = await painel($)
  esperarEstado(p, ESPERANDO, 'aguardando')
  expect(debaixo(p, ESPERANDO, 'Um'), emTexto(p)).toBe(true)
  await fimDoTurno($)
  p = await painel($)
  expect(tem(p, ESPERANDO), emTexto(p)).toBe(false)
})

// A retomada de uma sessão cujo turno terminou, e o store com um trabalho que aponta para tarefas que
// não existem (os pares 1/2 e 2/2 pelo store).
const RETOMADA_PARADA: Record<string, unknown> = {}
const TRABALHO_SUMIDO: Record<string, unknown> = {}

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('retomada com o turno terminado, 1/2: o painel e o fim do turno no store', async ($: any, on: any) => {
  fixar(on)
  armazem(on, RETOMADA_PARADA)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await fimDoTurno($)
  expect(temPainel(RETOMADA_PARADA), JSON.stringify(Object.keys(RETOMADA_PARADA))).toBe(true)
})

// Regra: durabilidade.fim-do-turno-sobrevive-ao-reinicio
test('retomada com o turno terminado, 2/2: a iniciada aguarda e o relógio não anda', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, RETOMADA_PARADA)
  exigir(temPainel(RETOMADA_PARADA))
  await retomar($, SESSAO)
  let p = await painel($)
  esperarEstado(p, 'Um', 'aguardando')
  semAndamento(p)
  const antes = linha(p, 'Um').texto
  await relogio.advance(5000)
  p = await painel($)
  expect(linha(p, 'Um').texto, emTexto(p)).toBe(antes)
})

// Regra: durabilidade.reinicio-restaura-do-store
test('trabalho sem tarefa presente, 1/2: dois pedidos no store', async ($: any, on: any) => {
  fixar(on)
  armazem(on, TRABALHO_SUMIDO)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'], 'Um feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, B)
  expect(Array.isArray(TRABALHO_SUMIDO[`work:${SESSAO}`]), JSON.stringify(TRABALHO_SUMIDO[`work:${SESSAO}`])).toBe(true)
})

// Regra: durabilidade.reinicio-restaura-do-store
test('trabalho sem tarefa presente, 2/2: o trabalho que aponta para tarefas que não existem não vale', async ($: any, on: any) => {
  fixar(on)
  exigir(temPainel(TRABALHO_SUMIDO))
  TRABALHO_SUMIDO[`work:${SESSAO}`] = ['nao-existe']
  armazem(on, TRABALHO_SUMIDO)
  await iniciarSessao($)
  let p = await painel($)
  expect(cabecalho(p).vazio, emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  await start($, ['b1'])
  p = await painel($)
  esperarEstado(p, 'b1', 'andamento')
})

// Regra: durabilidade.formatos-antigos-do-publicado
test('os formatos que entraram depois (taxa do último turno, pasta, parada com Esc, ultracode com subagente e o de hoje): cada filha aparece com o que o formato traz', async ($: any, on: any) => {
  fixar(on)
  expect(LATER_PUBLISHED_FILES.length).toBe(5)
  const id = (i: number) => `local_1000000${i}-0000-0000-0000-000000000000`
  // A do formato de hoje parou: o turno dela terminou (`turn`).
  host(on, LATER_PUBLISHED_FILES.map((f, i) => ({ id: id(i), nome: `depois-${i}`, publicado: f.file, ...(i === 4 ? { rodando: false } : {}) })))
  await pedido($, 'Pedido um')
  await plan($, A)
  await aviso($)
  const p = await painel($)
  const app = emTextoDoApp(await noApp($, { colunas: 100 }))
  expect(p.filter(l => /indispon|\berro\b/i.test(l.texto)).map(l => l.texto), emTexto(p)).toEqual([])
  LATER_PUBLISHED_FILES.forEach((f, i) => {
    expect(linha(p, `depois-${i}`).sessao, `${f.label}:\n${emTexto(p)}`).toBe(true)
    const doc = JSON.parse(f.file)
    expect(doc.tasks, f.label).toBeUndefined()
    const tarefas: any[] = doc.groups.find((g: any) => g.agent === '').tasks
    expect(tarefas.some(t => tem(p, t.title)), `${f.label}:\n${emTexto(p)}`).toBe(true)
  })
  // 1: a taxa do arquivo, acesa, sem "(último turno)".
  expect(linhaDoApp(await noApp($, { colunas: 100 }), 'depois-0').texto, app).toContain('87 toks/s')
  expect(app).not.toContain('último turno')
  // 2: o caminho da pasta, sem branch.
  const pasta = linha(p, 'depois-1').texto
  expect(pasta, emTexto(p)).toContain('pasta-sem-git')
  expect(pasta, emTexto(p)).not.toContain('⑂')
  // 3: a tarefa parada com Esc aparece ✕.
  esperarEstado(p, 'Texto 104', 'interrompida')
  // 4: no app, o cartão diz "ultracode", e a linha do subagente aparece dentro dele.
  expect(linhaDoApp(await noApp($, { colunas: 100 }), 'depois-3').texto, app).toContain('ultracode')
  expect(cartoes(p, 'depois-3')[0]?.tarefas ?? [], emTexto(p)).toContain('Explore: Texto 106')
  // 5: as tarefas vêm de groups, e com o turno terminado nada no cartão está em andamento.
  const hoje = cartoes(p, 'depois-4')[0]?.tarefas ?? []
  expect(hoje, emTexto(p)).toContain('Texto 108')
  expect(hoje.filter(t => linha(p, t).estado === 'andamento'), emTexto(p)).toEqual([])
})

// ---- A versão do painel do state: gravada antes dos grupos, e conferida no /clear.

const FUTURA = [{ agent: '', label: '', tasks: [{ id: 'F', short: 'F', title: 'Futura', status: 'done', children: [] }] }]
const RECARGA_VERSAO: Record<string, unknown> = {}
const RECARGA_CLEAR: Record<string, unknown> = {}
const STATE_VISTO: Record<string, unknown> = {}

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('recarga com o painel do state numa versão desconhecida: o painel volta do store', async ($: any, on: any) => {
  const { log } = fixar(on)
  armazem(on, lojaCom(VELHA))
  RECARGA_VERSAO.groups = FUTURA
  RECARGA_VERSAO.groupsVersion = 99
  estado(on, RECARGA_VERSAO, 'semear')
  let p = await painel($)
  expect(tem(p, 'Velha'), emTexto(p)).toBe(true)
  expect(tem(p, 'Futura'), emTexto(p)).toBe(false)
  expect(log.some(l => l.includes('painel guardado ignorado')), log.join('\n')).toBe(true)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  p = await painel($)
  esperarEstado(p, 'Um', 'andamento')
  expect(tem(p, 'Futura'), emTexto(p)).toBe(false)
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('/clear logo depois de uma recarga com o painel do state numa versão desconhecida: as tarefas ignoradas não vão ao histórico', async ($: any, on: any) => {
  const { log } = fixar(on)
  const h = host(on, [])
  armazem(on, lojaCom(VELHA))
  RECARGA_CLEAR.groups = FUTURA
  RECARGA_CLEAR.groupsVersion = 99
  estado(on, RECARGA_CLEAR, 'semear')
  await limpar($)
  expect(log.some(l => l.includes('painel guardado ignorado')), log.join('\n')).toBe(true)
  const publicado = JSON.stringify(h.proprio() ?? {})
  expect(publicado, publicado).not.toContain('Futura')
  expect(passado(h).flatMap((x: any) => x.tasks.map((t: any) => t.title)), publicado).toContain('Velha')
  await pedido($, 'Pedido um')
  await plan($, A)
  const p = await painel($)
  expect(tem(p, 'Futura'), emTexto(p)).toBe(false)
})

// Regra: durabilidade.painel-guardado-de-forma-desconhecida-e-ignorado
test('o primeiro uso sem session.start guarda a versão junto com o painel trazido do store', async ($: any, on: any) => {
  fixar(on)
  armazem(on, lojaCom(VELHA))
  estado(on, STATE_VISTO, 'captura')
  await fimDoTurno($)
  expect(Array.isArray(STATE_VISTO.groups), JSON.stringify(STATE_VISTO)).toBe(true)
  expect(STATE_VISTO.groupsVersion, JSON.stringify(STATE_VISTO)).toBe(1)
})

// ---- A primeira escrita das dobras depois de um respawn (o plan que reusa um id, o clique) e a
// gravação das dobras que o store recusou.

const DOBRAS_PLANO: Record<string, unknown> = {}
const DOBRAS_CLIQUE: Record<string, unknown> = {}
const DOBRAS_RECUSADAS: Record<string, unknown> = {}
const A_DE_NOVO: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: 'n1', title: 'Novo um' }] }]

// O roteiro do "dobras no reinício, 1/2": Plano A recolhido e o histórico aberto, guardados no store.
async function deixarDobrasEm($: any, on: any, store: Record<string, unknown>) {
  const { relogio } = fixar(on)
  armazem(on, store)
  await pedido($, 'Pedido um')
  await plan($, B)
  await start($, ['b1', 'b2'])
  await done($, ['b1', 'b2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, A)
  await start($, ['1'])
  const m = await montar($)
  await m.recolher('Plano A')
  await m.recolher('+1 pedidos anteriores')
  await m.fim()
  expect(temPainel(store) && temDobras(store), JSON.stringify(Object.keys(store))).toBe(true)
}

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('dobras e plan no respawn, 1/2: a pessoa recolhe uma tarefa e abre o histórico', async ($: any, on: any) => {
  await deixarDobrasEm($, on, DOBRAS_PLANO)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('dobras e plan no respawn, 2/2: o plan que reusa o id, antes de qualquer desenho, não perde o que ela deixou', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, DOBRAS_PLANO)
  exigir(temPainel(DOBRAS_PLANO) && temDobras(DOBRAS_PLANO))
  await relogio.advance(1000)
  await pedido($, 'Pedido três')
  await plan($, A_DE_NOVO)
  const p = await painel($)
  expect(tem(p, 'Novo um'), emTexto(p)).toBe(true)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  expect(tem(p, 'Um') || tem(p, 'Dois'), emTexto(p)).toBe(false)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('dobras e clique no respawn, 1/2: a pessoa recolhe uma tarefa e abre o histórico', async ($: any, on: any) => {
  await deixarDobrasEm($, on, DOBRAS_CLIQUE)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('dobras e clique no respawn, 2/2: recolher mais uma linha não reabre as que ela tinha recolhido', async ($: any, on: any) => {
  fixar(on)
  armazem(on, DOBRAS_CLIQUE)
  exigir(temPainel(DOBRAS_CLIQUE) && temDobras(DOBRAS_CLIQUE))
  const m = await montar($)
  await m.recolher('Plano B')
  await m.fim()
  const p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(tem(p, 'Um') || tem(p, 'Dois'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  expect(tem(p, 'b1') || tem(p, 'b2'), emTexto(p)).toBe(false)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('dobras e clique no respawn, 3/3: o processo seguinte desenha as antigas e a nova', async ($: any, on: any) => {
  fixar(on)
  armazem(on, DOBRAS_CLIQUE)
  exigir(temPainel(DOBRAS_CLIQUE) && temDobras(DOBRAS_CLIQUE))
  await iniciarSessao($)
  const p = await painel($)
  expect(tem(p, 'Plano A'), emTexto(p)).toBe(true)
  expect(tem(p, 'Um') || tem(p, 'Dois'), emTexto(p)).toBe(false)
  expect(tem(p, 'Plano B'), emTexto(p)).toBe(true)
  expect(tem(p, 'b1') || tem(p, 'b2'), emTexto(p)).toBe(false)
})

// Regra: durabilidade.dobras-voltam-no-processo-novo
test('as dobras que o store recusou são guardadas na publicação seguinte', async ($: any, on: any) => {
  fixar(on)
  let cheio = false
  armazem(on, DOBRAS_RECUSADAS, { recusar: () => cheio })
  await pedido($, 'Pedido um')
  await plan($, A)
  cheio = true
  const m = await montar($)
  await m.recolher('Plano A')
  await m.fim()
  expect(temDobras(DOBRAS_RECUSADAS), JSON.stringify(Object.keys(DOBRAS_RECUSADAS))).toBe(false)
  cheio = false
  await start($, ['1'])
  expect(temDobras(DOBRAS_RECUSADAS), JSON.stringify(Object.keys(DOBRAS_RECUSADAS))).toBe(true)
})

// Regra: durabilidade.formatos-antigos-do-publicado
test('a filha parada com Esc numa versão de antes da marca stopped (só aborted): a tarefa iniciada aparece ✕', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_10000009-0000-0000-0000-000000000000', nome: 'so-aborted', publicado: ABORTED_ONLY_FILE.file, rodando: false }])
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(linha(p, 'so-aborted').sessao, emTexto(p)).toBe(true)
  expect(p.filter(l => /indispon|\berro\b/i.test(l.texto)).map(l => l.texto), emTexto(p)).toEqual([])
  esperarEstado(p, 'Texto 109', 'interrompida')
})
