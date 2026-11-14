import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host, lancaveis, responderDepois, responderEnvio, type Filha } from './kit/ambiente'
import { aviso, done, envio, esc, ferramenta, fimDoSubagente, fimDoSubagenteCom, fimDoTurno, lancar, mensagemDe, pedido, plan, recebidaPeloSubagente, retomadaDoSubagente, start, type No } from './kit/cenario'
import { cabecalho, cartaSob, emTexto, esperarCarta, esperarCartaSob, esperarEstado, linha, painel } from './kit/leitura'

const A: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }]
const PERGUNTA = {
  questions: [{ question: 'Qual?', header: 'Rumo', multiSelect: false, options: [{ label: 'Opção A', description: 'a' }, { label: 'Opção B', description: 'b' }] }],
}

// Regra: envios.fica-ate-entrega, envios.cor-por-estado
test('o ✉ na fila fica na tarefa, mesmo concluída, até a entrega', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  expect(p.find(l => l.titulo.startsWith('Para '))?.texto).toContain('na fila')
  await done($, ['1'])
  p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  h.recebeu('local_x', AGORA)
  await aviso($)
  p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  expect(p.find(l => l.titulo.startsWith('Para '))?.texto).toContain('entregue')
})

// Regra: envios.cor-por-estado
test('a mensagem de um plano interrompido fica cinza depois da entrega', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ ...A[0]!, title: 'Plano A novo' }])
  h.recebeu('local_x', AGORA)
  await aviso($)
  const p = await painel($)
  const cartas = p.filter(l => l.titulo.startsWith('Para ') && l.carta !== undefined)
  expect(cartas.map(l => l.carta), emTexto(p)).toEqual(['interrompida'])
  expect(cartas[0]!.texto).toContain('interrompida')
})

// Regra: envios.fila-nao-interrompe-no-fim-do-turno
test('o envio na fila não vira interrompido no fim do turno, normal ou com Esc', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await fimDoTurno($)
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  expect(emTexto(p)).not.toContain('✕')
  await esc($)
  p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  expect(emTexto(p)).not.toContain('✕')
})

// Regra: envios.ancora-no-lote-recente
test('cada envio vai a uma tarefa do lote recente de starts ainda sem envio', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }, { id: 'local_y' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await start($, ['2'])
  await envio($, 'local_x')
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  await envio($, 'local_y')
  p = await painel($)
  esperarCartaSob(p, 'Dois', 'fila')
})

// Regra: envios.ancora-no-lote-recente
test('a tarefa iniciada antes do lote recente fica sem o envio', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }])
  await start($, ['1'])
  await relogio.advance(10_000)
  await start($, ['2'])
  await envio($, 'local_x')
  const p = await painel($)
  esperarCartaSob(p, 'Dois', 'fila')
  expect(cartaSob(p, 'Um'), emTexto(p)).toBe(undefined)
})

// Regra: envios.ancora-no-lote-recente
test('o envio nunca vai à tarefa com pergunta aberta', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await start($, ['2'])
  const resp = ferramenta($, 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  await envio($, 'local_x')
  const p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  expect(cartaSob(p, 'Dois'), emTexto(p)).toBe(undefined)
  await relogio.advance(1000)
  await resp
})

// Regra: envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
test('sem tarefa em andamento, o envio vai à pendente planejada por último', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await envio($, 'local_x')
  const p = await painel($)
  esperarCartaSob(p, 'Dois', 'fila')
  esperarEstado(p, 'Um', 'concluida')
})

// Regra: envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
test('sem tarefa em andamento nem pendente, o envio vai à última iniciada', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'C', title: 'Plano C', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await done($, ['1'])
  await envio($, 'local_x')
  esperarCartaSob(await painel($), 'Um', 'fila')
})

// Regra: envios.pedido-recebido-mostra-carta
test('o nível 1 aberto por mensagem recebida mostra a carta, na cor do seu estado', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  await mensagemDe($, 'local_x', 'Analise isto')
  await plan($, [{ id: 'R', title: 'Plano R', children: [{ id: 'r1', title: 'Erre um' }] }])
  let p = await painel($)
  // A carta é a linha do pedido; o nível 1 tem o ícone de tarefa.
  esperarCarta(p, 'Analise isto', 'fila')
  expect(linha(p, 'Plano R').carta, emTexto(p)).toBeUndefined()
  esperarEstado(p, 'Plano R', 'pendente')
  await start($, ['r1'])
  await done($, ['r1'])
  p = await painel($)
  esperarCarta(p, 'Analise isto', 'entregue')
  esperarEstado(p, 'Plano R', 'concluida')
})

// Regra: pedidos.replano-mantem-envio-ate-entrega
test('a tarefa de mensagem que o replano tira fica visível até a entrega', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await plan($, [{ ...A[0]!, children: [A[0]!.children![1]!] }])
  let p = await painel($)
  // A tarefa saiu do plano; a carta pende do nível 1 do pedido até a entrega.
  expect(p.some(l => l.titulo === 'Um'), emTexto(p)).toBe(false)
  esperarCartaSob(p, 'Plano A', 'fila')
  h.recebeu('local_x', AGORA)
  await aviso($)
  p = await painel($)
  expect(p.some(l => l.titulo === 'Um'), emTexto(p)).toBe(false)
  esperarCartaSob(p, 'Plano A', 'entregue')
})

// Regra: envios.entrega-imediata-fica-verde
test('a entrega imediata aparece entregue na hora e a tarefa segue em andamento até o done', async ($: any, on: any) => {
  fixar(on)
  // A sessão destino já terminou o turno: uma filha trabalhando manteria os pais em andamento.
  host(on, [{ id: 'local_x', rodando: false }])
  const env = responderEnvio(on)
  env.modo = 'entregue'
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'C', title: 'Plano C', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await envio($, 'local_x')
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  expect(p.find(l => l.titulo.startsWith('Para '))?.texto).toContain('entregue')
  expect(emTexto(p)).not.toContain('na fila')
  esperarEstado(p, 'Um', 'andamento')
  esperarEstado(p, 'Plano C', 'andamento')
  await done($, ['1'])
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Plano C', 'concluida')
})

// Regra: envios.esc-apos-entrega-imediata
test('depois de uma entrega imediata, o fim do turno e o Esc não interrompem a mensagem', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  const env = responderEnvio(on)
  env.modo = 'entregue'
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await fimDoTurno($)
  esperarCartaSob(await painel($), 'Um', 'entregue')
  await esc($)
  const p = await painel($)
  // A carta segue verde; a tarefa, entregue a mensagem, é como qualquer outra: o Esc a interrompe.
  esperarCartaSob(p, 'Um', 'entregue')
  esperarEstado(p, 'Um', 'interrompida')
  expect(linha(p, 'Plano A').estado, emTexto(p)).not.toBe('interrompida')
  esperarEstado(p, 'Dois', 'pendente')
})

// Regra: envios.fica-ate-entrega, envios.entrega-imediata-fica-verde
test('a entrega imediata e depois uma mensagem na fila à mesma sessão: cada uma no seu estado', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x' }])
  const env = responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  env.modo = 'entregue'
  await envio($, 'local_x')
  await start($, ['2'])
  env.modo = 'fila'
  await envio($, 'local_x')
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  esperarCartaSob(p, 'Dois', 'fila')
  h.recebeu('local_x', AGORA + 1)
  await aviso($)
  p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  esperarCartaSob(p, 'Dois', 'entregue')
})

// Regra: envios.pedido-recebido-mostra-carta
test('um pedido recebido com quatro tarefas de nível 1 tem uma carta só, no pedido', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  await mensagemDe($, 'local_x', 'Matriz de impacto')
  await plan($, ['Ler', 'Commit 1', 'Commit 2', 'Commit 3'].map((title, i) => ({ id: `${i + 1}`, title })))
  await start($, ['1'])
  await done($, ['1'])
  const p = await painel($)
  expect(p.filter(l => l.carta !== undefined).map(l => l.titulo), emTexto(p)).toEqual(['Matriz de impacto'])
  esperarCarta(p, 'Matriz de impacto', 'fila')
  esperarEstado(p, 'Ler', 'concluida')
  esperarEstado(p, 'Commit 1', 'pendente')
})

// Regra: envios.pedido-recebido-mostra-carta
test('o mesmo plano num pedido da pessoa não mostra carta nenhuma', async ($: any, on: any) => {
  fixar(on)
  await pedido($, 'Matriz de impacto')
  await plan($, ['Ler', 'Commit 1', 'Commit 2', 'Commit 3'].map((title, i) => ({ id: `${i + 1}`, title })))
  await start($, ['1'])
  await done($, ['1'])
  const p = await painel($)
  expect(p.filter(l => l.carta !== undefined).map(l => l.titulo), emTexto(p)).toEqual([])
  esperarEstado(p, 'Ler', 'concluida')
})

// Regra: envios.carta-sob-a-tarefa
test('a carta de envio é uma linha sob a tarefa; a tarefa conta e o painel a conclui na entrega', async ($: any, on: any) => {
  fixar(on)
  // A sessão destino parada: só a carta fala da mensagem (uma filha trabalhando manteria a tarefa ◉).
  const h = host(on, [{ id: 'local_x', nome: 'outra', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x', 'Revise o PR')
  await aviso($)
  let p = await painel($)
  const carta = p.find(l => l.titulo === 'Para outra: Revise o PR')
  expect(carta?.carta, emTexto(p)).toBe('fila')
  expect(p.indexOf(carta!), emTexto(p)).toBe(p.indexOf(linha(p, 'Um')) + 1)
  esperarEstado(p, 'Um', 'andamento')
  expect(cabecalho(p).total, emTexto(p)).toBe(2)
  h.recebeu('local_x', AGORA)
  await aviso($)
  p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  esperarEstado(p, 'Um', 'concluida')
  expect([cabecalho(p).feitas, cabecalho(p).total], emTexto(p)).toEqual([1, 2])
})

// Regra: envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila
test('com a carta na fila, o Esc deixa a tarefa aguardando; a entrega a conclui', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x', nome: 'outra', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await aviso($)
  await esc($)
  let p = await painel($)
  esperarEstado(p, 'Um', 'aguardando')
  esperarCartaSob(p, 'Um', 'fila')
  h.recebeu('local_x', AGORA)
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  esperarCartaSob(p, 'Um', 'entregue')
})


// As cartas sob uma tarefa: os títulos das linhas "Para …" logo abaixo dela.
const cartasDe = (linhas: any[], titulo: string): string[] => {
  const l = linha(linhas, titulo)
  const out: string[] = []
  for (const x of linhas.slice(linhas.indexOf(l) + 1)) {
    if (x.nivel <= l.nivel) break
    if (x.titulo.startsWith('Para ')) out.push(x.titulo)
  }
  return out
}
const DUAS: No[] = [{ id: 'A', title: 'Investigar', children: [{ id: '1', title: 'Pesquisa web: changelog' }, { id: '2', title: 'Implementação: ler o código' }] }]

// Regra: envios.carta-pelo-nome-da-sessao
test('sem nada em andamento, cada envio vai à pendente cujo título casa com o nome da sessão', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }, { id: 'local_y' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, DUAS)
  // Fora da ordem do plano: a implementação primeiro.
  await envio($, 'implementacao-hover', 'para a implementação')
  await envio($, 'pesquisa-web', 'para a pesquisa')
  await start($, ['1', '2'])
  const p = await painel($)
  expect(cartasDe(p, 'Pesquisa web: changelog').join(' | '), emTexto(p)).toContain('para a pesquisa')
  expect(cartasDe(p, 'Implementação: ler o código').join(' | '), emTexto(p)).toContain('para a implementação')
  expect(cartasDe(p, 'Pesquisa web: changelog').join(' | ')).not.toContain('para a implementação')
})

// Regra: envios.carta-pelo-nome-da-sessao
test('sem casamento pelo nome, os envios vão às pendentes planejadas juntas, pela ordem', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }, { id: 'local_y' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await envio($, 'local_x', 'primeira')
  await envio($, 'local_y', 'segunda')
  const p = await painel($)
  expect(cartasDe(p, 'Um').join(' | '), emTexto(p)).toContain('primeira')
  expect(cartasDe(p, 'Dois').join(' | '), emTexto(p)).toContain('segunda')
})

// Regra: envios.carta-pelo-nome-da-sessao
test('com duas em andamento, a carta vai à tarefa com uma palavra do nome da sessão; palavra das duas, pela ordem', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }, { id: 'local_y' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Investigar', children: [{ id: '1', title: 'Subagente da hora na orquestradora' }, { id: '2', title: 'Subagente da hora na análise' }] }])
  await start($, ['1', '2'])
  await envio($, 'analise-plano', 'para a análise')
  await envio($, 'hora-extra', 'para a hora')
  const p = await painel($)
  expect(cartasDe(p, 'Subagente da hora na análise').join(' | '), emTexto(p)).toContain('para a análise')
  // "hora" está nas duas: decide a ordem, a primeira ainda sem carta.
  expect(cartasDe(p, 'Subagente da hora na orquestradora').join(' | '), emTexto(p)).toContain('para a hora')
})

// Regra: envios.entrega-com-lista-de-sessoes-em-erro
test('com a lista de sessões em erro, a entrega publicada pela sessão deixa a carta verde e conclui a tarefa', async ($: any, on: any) => {
  fixar(on)
  const lista = { falha: false }
  on('mcp.call', { tool: 'list_sessions' }, (_$: any, e: any, next: any) =>
    lista.falha ? { value: { content: [{ type: 'text', text: 'list_sessions indisponível' }], isError: true } } : next(e),
  )
  const h = host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  lista.falha = true
  h.recebeu('local_x', AGORA)
  await aviso($)
  const p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  // O cartão da sessão, que a lista em erro deixa abrindo, segura "Um" ◉; o painel já a concluiu.
  expect([cabecalho(p).feitas, cabecalho(p).total], emTexto(p)).toEqual([1, 2])
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(0)
})

// A linha da carta ("Para <sessão>: …") sob a tarefa.
const cartaDe = (linhas: any[]) => linhas.find(l => l.titulo.startsWith('Para '))
const NAO_ENTREGUE = 'mensagem não entregue'
const contexto = async (r: Promise<any>) => JSON.stringify((await r)?.context ?? [])

// Regra: envios.destino-arquivado-nao-entregue
test('a sessão destino arquivada com a carta na fila: carta cinza não entregue, sem tempo e fora do chip; o modelo é avisado uma vez e o Esc interrompe a tarefa', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const x: Filha = { id: 'local_x', nome: 'outra', rodando: false }
  host(on, [x])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await relogio.advance(1000)
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  expect(cartaDe(p)?.texto, emTexto(p)).toContain('na fila')
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(1)
  x.arquivada = true
  expect(await contexto(aviso($)), 'o aviso ao modelo').toContain(NAO_ENTREGUE)
  p = await painel($)
  esperarCartaSob(p, 'Um', 'interrompida')
  expect(cartaDe(p)?.texto, emTexto(p)).toContain('não entregue')
  expect(cartaDe(p)?.texto, emTexto(p)).not.toMatch(/\d:\d\d/)
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(0)
  // A tarefa segue uma tarefa comum, em andamento e na contagem.
  esperarEstado(p, 'Um', 'andamento')
  expect(cabecalho(p).total, emTexto(p)).toBe(2)
  expect(await contexto(aviso($)), 'o aviso vai uma vez só').not.toContain(NAO_ENTREGUE)
  // Sem a carta na fila, o Esc trata a tarefa como qualquer outra.
  await esc($)
  p = await painel($)
  esperarEstado(p, 'Um', 'interrompida')
  esperarCartaSob(p, 'Um', 'interrompida')
  expect(cartaDe(p)?.texto, emTexto(p)).toContain('não entregue')
})

// Regra: envios.destino-arquivado-nao-entregue
test('a sessão destino desarquivada antes de tomar a mensagem: a carta volta a azul, na fila, a tarefa volta a esperar e a entrega a conclui', async ($: any, on: any) => {
  fixar(on)
  const x: Filha = { id: 'local_x', nome: 'outra', rodando: false }
  const h = host(on, [x])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  x.arquivada = true
  await aviso($)
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'interrompida')
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(0)
  x.arquivada = false
  expect(await contexto(aviso($)), 'desarquivada, nada a avisar').not.toContain(NAO_ENTREGUE)
  p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  expect(cartaDe(p)?.texto, emTexto(p)).toContain('na fila')
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(1)
  // Com a carta de novo na fila, a tarefa volta a esperar a sessão: no Esc fica ◷, não ✕.
  await esc($)
  p = await painel($)
  esperarEstado(p, 'Um', 'aguardando')
  esperarCartaSob(p, 'Um', 'fila')
  h.recebeu('local_x', AGORA)
  expect(await contexto(aviso($)), 'o aviso da entrega').toContain('recebimento confirmado')
  p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  esperarEstado(p, 'Um', 'concluida')
})

// Regra: envios.destino-arquivado-nao-entregue
test('carta não entregue: o done da tarefa não avisa de fila; tomada mesmo assim, fica verde e o modelo é avisado da entrega', async ($: any, on: any) => {
  fixar(on)
  const x: Filha = { id: 'local_x', nome: 'outra', rodando: false }
  const h = host(on, [x])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  x.arquivada = true
  expect(await contexto(aviso($)), 'o aviso ao modelo').toContain(NAO_ENTREGUE)
  const r = await done($, ['1'])
  expect(r.texto, 'o done de uma tarefa cuja carta não foi entregue').not.toContain('na fila')
  let p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  esperarCartaSob(p, 'Um', 'interrompida')
  // A sessão arquivada publica que recebeu: a mensagem foi tomada, como em qualquer entrega.
  h.recebeu('local_x', AGORA)
  expect(await contexto(aviso($)), 'o aviso da entrega').toContain('recebimento confirmado')
  p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  expect(cartaDe(p)?.texto, emTexto(p)).toContain('entregue')
  expect(cartaDe(p)?.texto, emTexto(p)).not.toContain('não entregue')
})

// Regra: envios.destino-arquivado-nao-entregue
test('carta não entregue não segura o pedido à vista: com tudo concluído, o pedido novo fica só', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const x: Filha = { id: 'local_x', nome: 'outra', rodando: false }
  host(on, [x])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await done($, ['1'])
  await start($, ['2'])
  await done($, ['2'])
  x.arquivada = true
  await aviso($)
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'b1' }] }])
  const p = await painel($)
  expect(p.some(l => ['Pedido um', 'Plano A', 'Um'].includes(l.titulo)), emTexto(p)).toBe(false)
  expect(p.some(l => l.titulo.startsWith('Para ')), emTexto(p)).toBe(false)
  expect(p.some(l => l.titulo === '+1 pedidos anteriores'), emTexto(p)).toBe(true)
  esperarEstado(p, 'b1', 'pendente')
})

// O motor responde o SendMessage a um subagente que roda: na fila até a rodada seguinte dele.
function filaDoSubagente(on: any) {
  on('tool.call', { tool: 'SendMessage' }, (_$: any, e: any) => ({
    result: `{"success":true,"message":"Message queued for delivery to ${e.to} at its next tool round. If it finishes first, it is resumed with the message and notifies again."}`,
  }))
}
// Um subagente em segundo plano lançado de "Um", e a carta mandada a ele na fila.
async function cartaAoSubagente($: any, para = 'sub-1', texto = 'olhe também o kit') {
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await envio($, para, texto)
}

// Regra: envios.subagente-parado-nao-entregue
test('a carta para um subagente parado com Esc antes de recebê-la fica cinza não entregue, sem tempo e fora do chip; o modelo é avisado uma vez; a tarefa fica interrompida', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  filaDoSubagente(on)
  await cartaAoSubagente($)
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(1)
  await esc($)
  await fimDoSubagenteCom($, 'sub-1', { parado: true })
  await relogio.advance(3000)
  expect(await contexto(aviso($)), 'o aviso ao modelo').toContain(NAO_ENTREGUE)
  p = await painel($)
  esperarCartaSob(p, 'Um', 'interrompida')
  expect(cartaDe(p)?.texto, emTexto(p)).toContain('não entregue')
  expect(cartaDe(p)?.texto, emTexto(p)).not.toMatch(/\d:\d\d/)
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(0)
  esperarEstado(p, 'Um', 'interrompida')
  expect(await contexto(aviso($)), 'o aviso vai uma vez só').not.toContain(NAO_ENTREGUE)
})

// Regra: envios.subagente-parado-nao-entregue
test('carta para subagente que falha antes de recebê-la: não entregue, e o done da tarefa não avisa de fila', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  filaDoSubagente(on)
  await cartaAoSubagente($)
  await fimDoSubagenteCom($, 'sub-1', { erro: true })
  await relogio.advance(3000)
  await aviso($)
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'interrompida')
  const r = await done($, ['1'])
  expect(r.texto, 'o done de uma tarefa cuja carta não foi entregue').not.toContain('na fila')
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
})

// Regra: envios.subagente-recebe-fica-verde
test('subagente que termina antes da rodada seguinte e é retomado com a mensagem: a carta fica verde, sem passar por não entregue', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  filaDoSubagente(on)
  await cartaAoSubagente($, 'sub-1', 'olhe também o kit')
  await fimDoSubagente($, 'sub-1')
  await relogio.advance(1000)
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  await retomadaDoSubagente($, 'sub-1', 'olhe também o kit')
  p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  await relogio.advance(3000)
  await relogio.advance(3000)
  expect(await contexto(aviso($)), 'o aviso da entrega').toContain('recebimento confirmado')
  p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  expect(cartaDe(p)?.texto, emTexto(p)).not.toContain('não entregue')
})

// Regra: envios.subagente-parado-nao-entregue
test('subagente que termina sem ser retomado: depois da conferência a carta fica não entregue e a tarefa de onde ele saiu fecha pelo fim dele', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  filaDoSubagente(on)
  await cartaAoSubagente($)
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  await relogio.advance(3000)
  await relogio.advance(3000)
  const p = await painel($)
  esperarCartaSob(p, 'Um', 'interrompida')
  expect(cartaDe(p)?.texto, emTexto(p)).toContain('não entregue')
  esperarEstado(p, 'Um', 'concluida')
})

// Regra: envios.subagente-parado-nao-entregue
test('subagente parado sem o fim chegar (some da lista do app): o cartão fica interrompido e a carta não entregue', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const app: { lista: any[] } = { lista: [{ id: 'sub-1', name: 'revisor', type: 'Explore', description: 'subagente sub-1', status: 'running' }] }
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'sub-1' }))
  on('agent.list', () => ({ value: app.lista }))
  filaDoSubagente(on)
  await cartaAoSubagente($, 'revisor')
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  app.lista = []
  await fimDoTurno($)
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  p = await painel($)
  expect(linha(p, 'Explore: varrer o repo').texto, emTexto(p)).toContain('interrompido')
  esperarCartaSob(p, 'Um', 'interrompida')
  expect(cartaDe(p)?.texto, emTexto(p)).toContain('não entregue')
  esperarEstado(p, 'Um', 'interrompida')
})

// Regra: envios.subagente-recebe-fica-verde
test('o subagente recebe a mensagem na rodada seguinte: a carta fica verde; a tarefa de onde ela saiu conclui sozinha, e a que lançou o subagente espera o fim dele', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  filaDoSubagente(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await start($, ['2'])
  await envio($, 'sub-1', 'primeira')
  let p = await painel($)
  esperarCartaSob(p, 'Dois', 'fila')
  await recebidaPeloSubagente($, 'sub-1', 'primeira')
  expect(await contexto(aviso($)), 'o aviso da entrega').toContain('recebimento confirmado')
  p = await painel($)
  esperarCartaSob(p, 'Dois', 'entregue')
  esperarEstado(p, 'Dois', 'concluida')
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(0)
  await envio($, 'sub-1', 'segunda')
  p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  await recebidaPeloSubagente($, 'sub-1', 'segunda')
  p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  esperarEstado(p, 'Um', 'andamento')
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
})
