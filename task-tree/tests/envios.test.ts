import { expect, test } from 'claude-code/testing'
import { AGORA, fixar, host, lancaveis, responderDepois, responderEnvio, type Filha } from './kit/ambiente'
import { aviso, done, envio, esc, ferramenta, fimDoSubagente, fimDoSubagenteCom, fimDoTurno, lancar, mensagemDe, pedido, plan, recebidaPeloSubagente, retomadaDoSubagente, start, type No } from './kit/cenario'
import { cabecalho, cartaSob, cartoes, emTexto, esperarCarta, esperarCartaSob, esperarEstado, linha, painel } from './kit/leitura'

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

// Regra: envios.com-andamento-fica-sob-a-tarefa-em-andamento
test('com uma tarefa em andamento e um passo planejado depois, a carta fica sob a tarefa em andamento, e a entrega conclui essa tarefa', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  // A sessão destino parada: uma filha trabalhando manteria a tarefa ◉.
  const h = host(on, [{ id: 'local_x', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await relogio.advance(1000)
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'n', title: 'Novo' }] }])
  await envio($, 'local_x', 'mandada de Um')
  await aviso($)
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  expect(cartasDe(p, 'Novo'), emTexto(p)).toEqual([])
  esperarEstado(p, 'Novo', 'pendente')
  // Recebida depois do envio (o relógio andou 1 s).
  h.recebeu('local_x', AGORA + 2000)
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  esperarEstado(p, 'Novo', 'pendente')
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

// Regra: envios.carta-uma-vez-no-cartao-da-origem, pedidos.replano-mantem-envio-ate-entrega
test('a carta na fila cuja tarefa saiu num replano segue no pedido dela, que fica à vista com o pedido novo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await plan($, [{ ...A[0]!, children: [A[0]!.children![1]!] }])
  await start($, ['2'])
  await done($, ['2'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê um' }] }])
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Plano A'), emTexto(p)).toBe(true)
  esperarCartaSob(p, 'Plano A', 'fila')
  expect(cartasDe(p, 'Plano B'), emTexto(p)).toEqual([])
})

// Regra: envios.carta-uma-vez-no-cartao-da-origem, pedidos.replano-mantem-envio-ate-entrega
test("a carta na fila cuja tarefa saiu num replano não pende de outro pedido quando o dela está em '+N pedidos anteriores'", async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_s')
  await plan($, [{ ...A[0]!, children: [A[0]!.children![1]!] }])
  await start($, ['2'])
  await done($, ['2'])
  await fimDoTurno($)
  for (const n of ['B', 'C', 'D', 'E']) {
    await relogio.advance(1000)
    await pedido($, `Pedido ${n}`)
    await plan($, [{ id: n, title: `Plano ${n}`, children: [{ id: `${n}1`, title: `${n} um` }] }])
    await start($, [`${n}1`])
    await done($, [`${n}1`])
    await fimDoTurno($)
  }
  const p = await painel($)
  expect(p.some(l => l.titulo === 'Plano A'), emTexto(p)).toBe(false)
  expect(p.some(l => l.titulo.startsWith('+') && l.titulo.includes('pedidos anteriores')), emTexto(p)).toBe(true)
  for (const n of ['C', 'D', 'E']) expect(cartasDe(p, `Plano ${n}`), emTexto(p)).toEqual([])
})

// Regra: envios.cor-por-estado
test('a carta já entregue de uma tarefa que fechou ✕ pelo subagente que falhou segue verde', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['f1'])
  host(on, [{ id: 'local_x', rodando: false }])
  const env = responderEnvio(on)
  env.modo = 'entregue'
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await lancar($, { descricao: 'tentar' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Um', 'interrompida')
  expect(linha(p, 'Um').texto, emTexto(p)).toContain('falhou')
  esperarCartaSob(p, 'Um', 'entregue')
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
  // A sessão destino já terminou o turno: trabalhando sob a tarefa, ela poupa a tarefa do Esc
  // (turnos.esc-com-trabalho-delegado-vivo).
  host(on, [{ id: 'local_x', rodando: false }])
  const env = responderEnvio(on)
  env.modo = 'entregue'
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await fimDoTurno($)
  esperarCartaSob(await painel($), 'Um', 'entregue')
  await pedido($, 'segue')
  await start($, ['1'])
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

// Regra: envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
test('sem nada em andamento, três envios e duas pendentes planejadas juntas: a primeira, a segunda e de novo a última', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }, { id: 'local_y' }, { id: 'local_z' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await envio($, 'local_x', 'primeira')
  await envio($, 'local_y', 'segunda')
  await envio($, 'local_z', 'terceira')
  const p = await painel($)
  const um = cartasDe(p, 'Um').join(' | ')
  const dois = cartasDe(p, 'Dois').join(' | ')
  expect(um, emTexto(p)).toContain('primeira')
  expect(dois, emTexto(p)).toContain('segunda')
  expect(dois, emTexto(p)).toContain('terceira')
  expect(um, emTexto(p)).not.toContain('terceira')
})

// Regra: envios.sem-andamento-vai-a-pendente-planejada-por-ultimo
test('sem nada em andamento, o envio vai à pendente do plan mais recente do pedido, não à do primeiro', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await relogio.advance(1000)
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'n', title: 'Novo' }] }])
  await envio($, 'local_x', 'para o novo')
  const p = await painel($)
  expect(cartasDe(p, 'Novo').join(' | '), emTexto(p)).toContain('para o novo')
  expect(cartasDe(p, 'Um'), emTexto(p)).toEqual([])
  expect(cartasDe(p, 'Dois'), emTexto(p)).toEqual([])
})

// Regra: envios.aviso-da-entrega-diz-o-que-o-painel-fez
test('a entrega de uma carta cuja tarefa um plano novo interrompeu não diz que o painel concluiu a tarefa', async ($: any, on: any) => {
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
  const texto = await contexto(aviso($))
  expect(texto, 'o aviso da entrega').toContain('recebimento confirmado')
  expect(texto).not.toContain('já concluiu a tarefa do envio')
  expect(texto).toContain('não concluiu a tarefa do envio')
})

// Regra: envios.aviso-da-entrega-diz-o-que-o-painel-fez
test('a entrega que conclui a tarefa diz que o painel a concluiu', async ($: any, on: any) => {
  fixar(on)
  // A sessão destino parada: uma filha trabalhando manteria a tarefa ◉.
  const h = host(on, [{ id: 'local_x', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  await aviso($)
  h.recebeu('local_x', AGORA)
  const texto = await contexto(aviso($))
  const p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  expect(texto, 'o aviso da entrega').toContain('já concluiu a tarefa do envio')
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

// Regra: sessoes.destino-que-nao-e-filha-nao-vira-cartao
test('a mensagem a uma sessão que esta não abriu deixa só a carta: sem cartão e sem sessão ativa', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_99999999-9999-9999-9999-999999999999')
  const p = await painel($)
  expect(cartaSob(p, 'Um'), emTexto(p)).toBe('fila')
  expect(p.some(l => l.sessao), emTexto(p)).toBe(false)
  expect(cabecalho(p).chips.ativas, emTexto(p)).toBe(0)
  expect(h.proprio()?.children ?? []).toEqual([])
})

// Regra: envios.envio-que-falha-nao-deixa-rastro
test('o envio que falha não grava rodada: o turno seguinte da filha segue no cartão dela', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  on('tool.call', { tool: 'SendMessage' }, () => ({ result: '{"success":false,"message":"no such session"}' }))
  const K1 = 'local_11111111-1111-1111-1111-111111111111'
  const tarefaDoTurno = (turn: number, id: string, title: string) => ({ id, short: id, title, status: 'open', started: 1, startedAt: AGORA, children: [], turn })
  const h = host(on, [{ id: K1, nome: 'filha-um', painel: { tasks: [tarefaDoTurno(1, '1', 'f1')], turns: [{ id: 1, title: 'turno 1', at: AGORA + 10 }] } }])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }, { id: '3', title: 'Três' }] }])
  await start($, ['1'])
  await ferramenta($, 'mcp__ccd_session__start_session', { title: 'filha' })
  await aviso($)
  await start($, ['2'])
  await relogio.advance(1000)
  await envio($, K1)
  await relogio.advance(1000)
  h.filha(K1).painel = {
    tasks: [tarefaDoTurno(1, '1', 'f1'), tarefaDoTurno(2, '2', 'f2')],
    turns: [{ id: 1, title: 'turno 1', at: AGORA + 10 }, { id: 2, title: 'turno 2', at: AGORA + 1500 }],
  }
  await aviso($)
  const p = await painel($)
  const cs = cartoes(p, 'filha-um')
  expect(cs.map(c => c.sob), emTexto(p)).toEqual(['Um'])
  // O turno 1 da filha fica dobrado em "+1 pedidos anteriores" no mesmo cartão; o 2 vem aberto nele.
  expect(cs[0]?.tarefas, emTexto(p)).toContain('f2')
  expect(cs[0]?.tarefas.some(t => t.startsWith('+1 pedidos anteriores')), emTexto(p)).toBe(true)
  expect(cartaSob(p, 'Dois'), emTexto(p)).toBeUndefined()
})

// Regra: envios.antes-do-plan-fica-solta-e-o-plan-adota
test('a carta enviada antes do plan do pedido novo fica solta no fim, não fecha tarefa do pedido anterior, e o plan do pedido a adota', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: 'local_x', nome: 'outra', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await done($, ['1'])
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await envio($, 'local_x', 'Revise')
  await aviso($)
  let p = await painel($)
  expect(cartaSob(p, 'Dois'), emTexto(p)).toBeUndefined()
  expect(cartaSob(p, 'Um'), emTexto(p)).toBeUndefined()
  const carta = linha(p, 'Para outra: Revise')
  expect(carta.carta, emTexto(p)).toBe('fila')
  const ultimoPedido = Math.max(...p.map((l, i) => (l.titulo.startsWith('Pedido ') ? i : -1)))
  expect(p.indexOf(carta), emTexto(p)).toBeGreaterThan(ultimoPedido)
  esperarEstado(p, 'Dois', 'pendente')
  h.recebeu('local_x', AGORA + 1000)
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Dois', 'pendente')
  expect(linha(p, 'Para outra: Revise').carta, emTexto(p)).toBe('entregue')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Bê um' }, { id: 'b2', title: 'Bê dois' }] }])
  p = await painel($)
  esperarCartaSob(p, 'Bê um', 'entregue')
  esperarEstado(p, 'Bê um', 'pendente')
})

// Regra: envios.entrega-espera-o-que-ainda-roda-na-tarefa, subagentes.um-rodando-mantem-o-pai
test('com um subagente da tarefa ainda rodando, a entrega da carta não conclui a tarefa; o fim dele, sim', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  // A sessão destino parada: ela não segura a tarefa depois da entrega.
  const h = host(on, [{ id: 'local_x', nome: 'outra', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await lancar($, { descricao: 'um', segundoPlano: true })
  await envio($, 'local_x', 'Revise o PR')
  await fimDoTurno($)
  h.recebeu('local_x', AGORA)
  await aviso($)
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'entregue')
  expect(linha(p, 'Um').estado, emTexto(p)).not.toBe('concluida')
  expect(cabecalho(p).feitas, emTexto(p)).toBe(0)
  await fimDoSubagente($, 'sub-1')
  // O aviso abriu um turno: o fechamento pelos subagentes roda com o turno terminado.
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
})

// Regra: envios.entrega-espera-o-que-ainda-roda-na-tarefa, envios.tarefa-aguarda-a-sessao-enquanto-a-carta-esta-na-fila
test('duas cartas na fila da mesma tarefa: a primeira entrega não a conclui; a segunda, sim', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x', nome: 'outra', rodando: false }, { id: 'local_y', nome: 'mais', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x', 'Revise o PR')
  await envio($, 'local_y', 'Rode os testes')
  h.recebeu('local_x', AGORA)
  await aviso($)
  let p = await painel($)
  esperarCarta(p, 'Para outra: Revise o PR', 'entregue')
  esperarCarta(p, 'Para mais: Rode os testes', 'fila')
  expect(linha(p, 'Um').estado, emTexto(p)).not.toBe('concluida')
  h.recebeu('local_y', AGORA)
  await aviso($)
  p = await painel($)
  esperarCarta(p, 'Para outra: Revise o PR', 'entregue')
  esperarCarta(p, 'Para mais: Rode os testes', 'entregue')
  esperarEstado(p, 'Um', 'concluida')
})

const MAE = 'local_aaaaaaaa-1111-2222-3333-444444444444'
const IRMA_DOCS = 'local_bbbbbbbb-1111-2222-3333-444444444444'

// Regra: envios.carta-mostra-o-nome-do-destino
test('a carta para uma sessão que não é filha mostra o nome que veio na mensagem dela', async ($: any, on: any) => {
  fixar(on)
  host(on, [])
  responderEnvio(on)
  await mensagemDe($, MAE, 'faça X')
  await plan($, A)
  await start($, ['1'])
  await envio($, MAE, 'feito')
  const p = await painel($)
  const carta = p.find(l => l.titulo.startsWith('Para '))
  expect(carta?.titulo, emTexto(p)).toBe('Para outra: feito')
})

// Regra: envios.carta-mostra-o-nome-do-destino
test('a carta para uma irmã listada pelo app mostra o nome dela', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: IRMA_DOCS, nome: 'irma-docs', iniciadaPor: MAE }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await aviso($)
  let p = await painel($)
  expect(p.some(l => l.titulo === 'irma-docs'), emTexto(p)).toBe(false)
  await envio($, IRMA_DOCS, 'veja a doc')
  p = await painel($)
  const carta = p.find(l => l.titulo.startsWith('Para '))
  expect(carta?.titulo, emTexto(p)).toBe('Para irma-docs: veja a doc')
})

// ---- Um cenário por texto ao modelo (decisão do usuário de 2026-11-14: "Cenário por texto (Recomendado)").
const NA_FILA = 'ficou na fila'

// Regra: envios.aviso-de-envio-na-fila
test('o envio que fica na fila pede para manter a tarefa em andamento; a entrega imediata, não', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  const modo = responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  const fila = await contexto($.tool.call({ tool: 'SendMessage', tool_use_id: 's1', to: 'local_x', message: 'oi' }))
  expect(fila).toContain(NA_FILA)
  expect(fila).toContain('Um')
  modo.modo = 'entregue'
  await start($, ['2'])
  expect(await contexto($.tool.call({ tool: 'SendMessage', tool_use_id: 's2', to: 'local_x', message: 'oi' }))).not.toContain(NA_FILA)
})

// Regra: envios.aviso-de-envio-na-fila
test('o envio na fila para um subagente diz que é para o subagente', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  filaDoSubagente(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  const ctx = await contexto($.tool.call({ tool: 'SendMessage', tool_use_id: 's1', to: 'sub-1', message: 'oi' }))
  expect(ctx).toContain('para o subagente')
  expect(ctx).toContain(NA_FILA)
})

// Regra: envios.done-com-carta-na-fila
test('o done que fecha a tarefa de uma carta ainda na fila avisa; com a carta entregue, não', async ($: any, on: any) => {
  fixar(on)
  host(on, [{ id: 'local_x' }])
  const modo = responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x')
  expect((await done($, ['1'])).texto).toContain('ainda está na fila')
  modo.modo = 'entregue'
  await start($, ['2'])
  await envio($, 'local_x')
  expect((await done($, ['2'])).texto).not.toContain('ainda está na fila')
})

// Regra: turnos.concluida-sem-start-sem-tempo, envios.fica-ate-entrega
test('a tarefa fechada pela entrega da carta sem ter recebido start não mostra tempo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: 'local_x', rodando: false }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }])
  await envio($, 'local_x')
  await done($, ['1'])
  let p = await painel($)
  esperarCartaSob(p, 'Um', 'fila')
  await relogio.advance(60_000)
  h.recebeu('local_x', AGORA + 60_000)
  await aviso($)
  p = await painel($)
  esperarEstado(p, 'Um', 'concluida')
  const texto = linha(p, 'Um').texto
  expect(/\d+:\d{2}\s*$/.test(texto), emTexto(p)).toBe(false)
  expect(texto, emTexto(p)).toContain('—')
})

// Regra: envios.carta-na-fila-nao-sai-pelo-teto
test('com 20 envios mais novos já entregues, a carta na fila segue sob a tarefa', async ($: any, on: any) => {
  fixar(on)
  const h = host(on, [{ id: 'local_x', nome: 'outra', rodando: false }])
  const env = responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'local_x', 'Revise o PR')
  env.modo = 'entregue'
  for (let i = 1; i <= 20; i++) await envio($, `destino-${i}`, `mensagem ${i}`)
  let p = await painel($)
  expect(p.find(l => l.titulo === 'Para outra: Revise o PR')?.carta, emTexto(p)).toBe('fila')
  expect(cabecalho(p).chips.sessao, emTexto(p)).toBe(1)
  h.recebeu('local_x', AGORA)
  await aviso($)
  p = await painel($)
  expect(p.find(l => l.titulo === 'Para outra: Revise o PR')?.carta, emTexto(p)).toBe('entregue')
})

// Regra: envios.marca-de-entrega-na-carta-certa
test('um envio no meio da releitura das sessões não recebe a marca de outro envio', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const h = host(on, [{ id: 'local_x', nome: 'outra', rodando: false }])
  responderEnvio(on)
  // Armado, a gravação seguinte dos envios cruza com outra: a mensagem "segunda", da mesma tarefa à
  // mesma sessão, entra no lugar da primeira (como o SendMessage a grava), e a gravação da releitura
  // tem de reler a lista (o stub não pode chamar a ferramenta do mod).
  let armado = false
  on('state.set', async (_$: any, e: any, next: any) => {
    if (!armado || e?.key !== 'sends') return next(e)
    armado = false
    const r = await next({ ...e, value: [{ to: 'outra', anchor: '1', at: AGORA + 1000, text: 'segunda' }] })
    return { ...r, value: { ...r?.value, isSet: false } }
  })
  await pedido($, 'Pedido um')
  await plan($, A)
  await start($, ['1'])
  await envio($, 'outra', 'primeira')
  h.recebeu('local_x', AGORA)
  await relogio.advance(1000)
  armado = true
  await aviso($)
  const p = await painel($)
  expect(p.find(l => l.titulo === 'Para outra: segunda')?.carta, emTexto(p)).toBe('fila')
  expect(linha(p, 'Um').estado, emTexto(p)).not.toBe('concluida')
})
