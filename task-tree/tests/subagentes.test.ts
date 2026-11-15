import { expect } from 'claude-code/testing'
import { test } from './kit/teste'
import { AGORA, armazem, estado, fixar, host, lancaveis, responderDepois, responderEnvio } from './kit/ambiente'
import { abrirSessao, aviso, chamadaDoSubagente, done, envio, esc, fimDoSubagente, fimDoSubagenteCom, fimDoTurno, iniciarSessao, lancar, pedido, plan, retomadaDoSubagente, start, type No } from './kit/cenario'
import { cabecalho, comHistorico, emTexto, esperarEstado, estadoGeral, linha, montar, noApp, painel } from './kit/leitura'

// O cartão de subagente (na raiz e dentro de uma filha), lido pela superfície terminal como as outras linhas.

const UM: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }, { id: '2', title: 'Outra' }] }]
// As linhas logo abaixo de uma (mais fundas que ela), até a próxima do mesmo nível.
const abaixo = (p: any[], titulo: string) => {
  const l = linha(p, titulo)
  const out: any[] = []
  for (const x of p.slice(p.indexOf(l) + 1)) {
    if (x.nivel <= l.nivel) break
    out.push(x)
  }
  return out
}

// Regra: subagentes.cartao-desde-o-lancamento, subagentes.cartao-mostra-modelo-e-estado
test('lançado um subagente, o cartão aparece sob a tarefa em andamento, com o modelo e "trabalhando"', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'buscar usos de hover' })
  const p = await painel($)
  const cartao = abaixo(p, 'Investigar').find(l => l.titulo === 'Explore: buscar usos de hover')
  expect(cartao, emTexto(p)).toBeDefined()
  expect(cartao.texto).toContain('Haiku 5.5')
  expect(cartao.texto).toContain('trabalhando')
})

// Regra: subagentes.corpo-e-as-tarefas-ou-a-ferramenta
test('sem usar o painel, o cartão mostra a ferramenta em uso e quantas chamadas fez', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  on('tool.call', { tool: 'Grep' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await chamadaDoSubagente($, 'sub-1', 'Read', { file_path: 'C:/x/kit/leitura.ts' })
  await relogio.advance(1500)
  await chamadaDoSubagente($, 'sub-1', 'Grep', { pattern: 'hover' })
  const p = await painel($)
  const corpo = abaixo(p, 'Explore: ler o kit').map(l => l.texto).join('\n')
  expect(corpo, emTexto(p)).toContain('Grep "hover" · 2 chamadas')
})

// Regra: subagentes.ferramenta-em-uso-com-freio
test('muitas chamadas de ferramenta de subagentes no mesmo segundo gravam o painel uma vez; a linha da ferramenta chega em até 1 s', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1', 'sub-2', 'sub-3'])
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  on('tool.call', { tool: 'Grep' }, () => ({ result: 'ok' }))
  // As gravações dos grupos, contadas pelo teste (o custo que o freio corta).
  let gravacoes = 0
  on('state.set', async (_$: any, e: any, next: any) => {
    if (e.key === 'groups') gravacoes++
    return next(e)
  })
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler um' })
  await lancar($, { descricao: 'ler dois' })
  await lancar($, { descricao: 'ler três' })
  gravacoes = 0
  const quem = ['sub-1', 'sub-2', 'sub-3', 'sub-1', 'sub-2', 'sub-3', 'sub-1', 'sub-2', 'sub-1', 'sub-3']
  for (const [i, a] of quem.entries()) await chamadaDoSubagente($, a, i % 2 ? 'Grep' : 'Read', i % 2 ? { pattern: `p${i}` } : { file_path: `C:/x/a${i}.ts` })
  expect(gravacoes).toBe(1)
  await relogio.advance(1000)
  expect(gravacoes).toBe(2)
  const p = await painel($)
  const corpo = (t: string) => abaixo(p, t).map(l => l.texto).join(' | ')
  expect(corpo('Explore: ler um'), emTexto(p)).toContain('Read a8.ts · 4 chamadas')
  expect(corpo('Explore: ler dois'), emTexto(p)).toContain('Grep "p7" · 3 chamadas')
  expect(corpo('Explore: ler três'), emTexto(p)).toContain('Grep "p9" · 3 chamadas')
})

// Regra: subagentes.ferramenta-em-uso-com-freio
test('a ferramenta pendente de um subagente que terminou não volta ao cartão dele', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler um' })
  await lancar($, { descricao: 'ler dois' })
  await chamadaDoSubagente($, 'sub-1', 'Read', { file_path: 'C:/x/um.ts' })
  await chamadaDoSubagente($, 'sub-2', 'Read', { file_path: 'C:/x/dois.ts' })
  await fimDoSubagente($, 'sub-2')
  await relogio.advance(1000)
  const p = await painel($)
  const dois = abaixo(p, 'Explore: ler dois').map(l => l.texto).join(' | ')
  expect(linha(p, 'Explore: ler dois').texto, emTexto(p)).toContain('concluído')
  expect(dois, emTexto(p)).not.toContain('dois.ts')
  expect(abaixo(p, 'Explore: ler um').map(l => l.texto).join(' | '), emTexto(p)).toContain('Read um.ts')
  expect(pilula(p), emTexto(p)).toContain('▸ 1')
})

// Regra: subagentes.retomado-volta-a-trabalhando
test("o subagente retomado volta a 'trabalhando', conta na pílula e segue a contagem de chamadas; o fim seguinte vale como fim", async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await chamadaDoSubagente($, 'sub-1', 'Read', { file_path: 'C:/x/um.ts' })
  await fimDoSubagente($, 'sub-1')
  let p = await painel($)
  expect(linha(p, 'Explore: ler o kit').texto, emTexto(p)).toContain('concluído')
  await retomadaDoSubagente($, 'sub-1', 'continue')
  p = await painel($)
  expect(linha(p, 'Explore: ler o kit').texto, emTexto(p)).toContain('trabalhando')
  expect(pilula(p), emTexto(p)).toContain('▸ 1')
  await relogio.advance(1500)
  await chamadaDoSubagente($, 'sub-1', 'Read', { file_path: 'C:/x/dois.ts' })
  p = await painel($)
  expect(abaixo(p, 'Explore: ler o kit').map(l => l.texto).join(' | '), emTexto(p)).toContain('Read dois.ts · 2 chamadas')
  await fimDoSubagente($, 'sub-1')
  p = await painel($)
  expect(linha(p, 'Explore: ler o kit').texto, emTexto(p)).toContain('concluído')
  expect(pilula(p), emTexto(p)).not.toContain('▸')
})

// Regra: subagentes.retomado-volta-a-trabalhando, subagentes.um-rodando-mantem-o-pai
test('com o subagente retomado rodando, a tarefa de origem aberta não fecha no fim do turno; a já fechada não reabre', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler um' })
  await fimDoSubagente($, 'sub-1')
  await retomadaDoSubagente($, 'sub-1', 'continue')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).not.toBe('concluida')
  await fimDoSubagente($, 'sub-1')
  p = await painel($)
  esperarEstado(p, 'Investigar', 'concluida')
  await start($, ['2'])
  await lancar($, { descricao: 'ler dois' })
  await fimDoSubagente($, 'sub-2')
  await fimDoTurno($)
  p = await painel($)
  esperarEstado(p, 'Outra', 'concluida')
  await retomadaDoSubagente($, 'sub-2', 'continue')
  p = await painel($)
  esperarEstado(p, 'Outra', 'concluida')
  expect(linha(p, 'Explore: ler dois').texto, emTexto(p)).toContain('trabalhando')
})

// Regra: subagentes.retomado-volta-a-trabalhando
test('as tarefas que o subagente deixou interrompidas só voltam com start dele', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await fimDoSubagente($, 'sub-1')
  let p = await painel($)
  esperarEstado(p, 'Ler os testes', 'interrompida')
  await retomadaDoSubagente($, 'sub-1', 'continue')
  p = await painel($)
  esperarEstado(p, 'Ler os testes', 'interrompida')
  await start($, ['X'], 'sub-1')
  p = await painel($)
  esperarEstado(p, 'Ler os testes', 'andamento')
})

// Regra: subagentes.corpo-e-as-tarefas-ou-a-ferramenta
test('o subagente que usa o painel mostra as tarefas dele no cartão', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  const p = await painel($)
  expect(abaixo(p, 'general-purpose: revisar testes').map(l => l.titulo), emTexto(p)).toContain('Ler os testes')
})

// Regra: subagentes.terminado-segue-cartao, subagentes.cartao-mostra-modelo-e-estado
test('terminado, o cartão segue com "concluído"; com erro, "falhou"; parado, "interrompido"', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2', 'sub-3'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'um' })
  await lancar($, { descricao: 'dois' })
  await lancar($, { descricao: 'tres' })
  await fimDoSubagente($, 'sub-1')
  await fimDoSubagenteCom($, 'sub-2', { erro: true })
  await fimDoSubagenteCom($, 'sub-3', { parado: true })
  const p = await painel($)
  expect(linha(p, 'Explore: um').texto, emTexto(p)).toContain('concluído')
  expect(linha(p, 'Explore: um').estado).toBe('concluida')
  expect(linha(p, 'Explore: dois').texto).toContain('falhou')
  expect(linha(p, 'Explore: tres').texto).toContain('interrompido')
  // Sem linha de resultado: o cartão terminado não tem nada abaixo dele.
  expect(abaixo(p, 'Explore: um').length).toBe(0)
})

// Regra: subagentes.terminado-com-sobras-segue-concluido
test("o subagente que termina sem erro deixando tarefas abertas: cartão 'concluído', sobras ✕ dentro e a tarefa de origem ✓", async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'X', title: 'Ler os testes' }, { id: 'Y', title: 'Escrever o relato' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await done($, ['X'], undefined, 'sub-1')
  await start($, ['Y'], 'sub-1')
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'general-purpose: revisar testes').texto, emTexto(p)).toContain('concluído')
  const dentro = abaixo(p, 'general-purpose: revisar testes').map(l => l.titulo)
  expect(dentro, emTexto(p)).toContain('Ler os testes')
  expect(dentro).toContain('Escrever o relato')
  esperarEstado(p, 'Ler os testes', 'concluida')
  esperarEstado(p, 'Escrever o relato', 'interrompida')
  esperarEstado(p, 'Investigar', 'concluida')
  // A sobra do subagente concluído não deixa a faixa cinza: o pedido terminou bem (decisão 45).
  expect(estadoGeral(await noApp($)), emTexto(p)).toBe('concluído')
})

// Regra: subagentes.varios-juntos-num-cartao-de-grupo
test('mais de três lançados juntos ficam num cartão de grupo, uma linha por agente; três, cada um no seu', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['s1', 's2', 's3', 's4'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  for (const d of ['a', 'b', 'c']) await lancar($, { descricao: d })
  let p = await painel($)
  expect(p.some(l => l.titulo === 'Explore: a'), emTexto(p)).toBe(true)
  expect(p.some(l => /subagentes$/.test(l.titulo))).toBe(false)
  await lancar($, { descricao: 'd' })
  p = await painel($)
  expect(linha(p, '4 subagentes').texto, emTexto(p)).toContain('4 trabalhando')
  expect(abaixo(p, '4 subagentes').map(l => l.titulo)).toEqual(['Explore: a', 'Explore: b', 'Explore: c', 'Explore: d'])
})

// Regra: subagentes.cartao-de-grupo-diz-a-falha
test("o cartão de grupo diz a falha de um agente, com os outros trabalhando e depois de todos terminarem; parado, diz 'interrompido'", async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['s1', 's2', 's3', 's4', 't1', 't2', 't3', 't4'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }])
  await start($, ['1'])
  for (const d of ['a', 'b', 'c', 'd']) await lancar($, { descricao: d })
  await fimDoSubagenteCom($, 's1', { erro: true })
  let p = await painel($)
  expect(linha(p, '4 subagentes').texto, emTexto(p)).toContain('3 trabalhando')
  expect(linha(p, '4 subagentes').texto, emTexto(p)).toContain('1 falhou')
  for (const s of ['s2', 's3', 's4']) await fimDoSubagente($, s)
  p = await painel($)
  expect(linha(p, '4 subagentes').texto, emTexto(p)).toContain('falhou')
  expect(linha(p, '4 subagentes').texto, emTexto(p)).not.toContain('interrompido')
  await done($, ['1'])
  await start($, ['2'])
  for (const d of ['e', 'f', 'g', 'h']) await lancar($, { descricao: d })
  await fimDoSubagenteCom($, 't1', { parado: true })
  for (const s of ['t2', 't3', 't4']) await fimDoSubagente($, s)
  p = await painel($)
  const grupos = p.filter(l => l.titulo === '4 subagentes')
  expect(grupos.length, emTexto(p)).toBe(2)
  expect(grupos[1]!.texto, emTexto(p)).toContain('interrompido')
  expect(grupos[1]!.texto, emTexto(p)).not.toContain('falhou')
})

// Regra: subagentes.varios-juntos-num-cartao-de-grupo
test('os agentes de um workflow ficam num cartão "Workflow · N agentes"', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['w1', 'w2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o diff', run: 'wf_1' })
  await lancar($, { descricao: 'ler os testes', run: 'wf_1' })
  const p = await painel($)
  expect(abaixo(p, 'Workflow · 2 agentes').map(l => l.titulo), emTexto(p)).toEqual(['Explore: ler o diff', 'Explore: ler os testes'])
})

const DUAS: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }, { id: '2', title: 'Revisar' }] }]

// Regra: subagentes.workflow-fica-junto-na-tarefa-do-primeiro
test('com duas tarefas em andamento, os agentes de um workflow ficam todos na tarefa do primeiro, num cartão só', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['w1', 'w2', 'w3'])
  await pedido($, 'Pedido um')
  await plan($, DUAS)
  await start($, ['1', '2'])
  for (const d of ['ler o diff', 'ler os testes', 'ler o kit']) await lancar($, { descricao: d, run: 'wf_1' })
  const p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Workflow · 3 agentes')
  expect(abaixo(p, 'Workflow · 3 agentes').map(l => l.titulo)).toEqual(['Explore: ler o diff', 'Explore: ler os testes', 'Explore: ler o kit'])
  expect(abaixo(p, 'Revisar')).toEqual([])
})

// Regra: subagentes.workflow-fica-junto-na-tarefa-do-primeiro
test('os agentes de um workflow lançados antes do plan são adotados juntos, pela tarefa do primeiro', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['w1', 'w2', 'w3'])
  await pedido($, 'Pedido um')
  for (const d of ['ler o diff', 'ler os testes', 'ler o kit']) await lancar($, { descricao: d, run: 'wf_1' })
  await plan($, DUAS)
  const p = await painel($)
  const cartao = p.filter(l => l.titulo === 'Workflow · 3 agentes')
  expect(cartao.length, emTexto(p)).toBe(1)
  expect(p.filter(l => l.titulo.startsWith('Workflow ·')).length).toBe(1)
})

// Regra: subagentes.tempo-do-cartao-do-lancamento-ao-fim
test('o tempo do cartão do subagente com tarefas conta do lançamento ao fim', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await relogio.advance(3000)
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await relogio.advance(2000)
  await done($, ['X'], undefined, 'sub-1')
  await fimDoSubagente($, 'sub-1')
  const p = await painel($)
  expect(linha(p, 'Explore: ler o kit').texto, emTexto(p)).toContain('0:05')
})

// Regra: subagentes.fora-da-contagem
test('o subagente não entra no "d de n" e ganha a pílula de subagentes', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  const antes = cabecalho(await painel($))
  await lancar($, { descricao: 'um' })
  await lancar($, { descricao: 'dois' })
  const p = await painel($)
  const depois = cabecalho(p)
  expect([depois.feitas, depois.total], emTexto(p)).toEqual([antes.feitas, antes.total])
  expect(p.filter(l => l.cabecalho).map(l => l.texto).join('\n')).toContain('▸ 2')
})

// Regra: subagentes.na-filha
test('o subagente de uma filha aparece dentro do cartão dela', async ($: any, on: any) => {
  fixar(on)
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha',
      painel: {
        tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
        agentes: [{ agent: 'fs-1', label: 'Explore: achar o teste', parent: '', anchor: '1', tasks: [], sub: { at: AGORA - 500, state: 'running', calls: 3, tool: 'Grep "x"', batch: AGORA - 500, engine: 'Haiku 5.5' } }],
      },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(abaixo(p, 'Da filha').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o teste')
})

// Regra: subagentes.cartao-desde-o-lancamento
test('com duas em andamento, o subagente vai à primeira e a carta seguinte à segunda', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Primeira' }, { id: '2', title: 'Segunda' }] }])
  await start($, ['1', '2'])
  await lancar($, { descricao: 'achar o teste' })
  await envio($, 'local_x', 'oi')
  const p = await painel($)
  expect(abaixo(p, 'Primeira').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o teste')
  expect(abaixo(p, 'Segunda').some(l => l.titulo.startsWith('Para ')), emTexto(p)).toBe(true)
  expect(abaixo(p, 'Primeira').some(l => l.titulo.startsWith('Para '))).toBe(false)
})

// Regra: envios.com-andamento-fica-sob-a-tarefa-em-andamento, subagentes.cartao-desde-o-lancamento
test('com uma tarefa em andamento e um passo planejado depois, o subagente lançado fica sob a tarefa em andamento', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }] }])
  await start($, ['1'])
  await relogio.advance(1000)
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'n', title: 'Novo' }] }])
  await lancar($, { descricao: 'buscar usos de hover' })
  const p = await painel($)
  const titulo = 'Explore: buscar usos de hover'
  expect(abaixo(p, 'Um').some(l => l.titulo === titulo), emTexto(p)).toBe(true)
  expect(abaixo(p, 'Novo').some(l => l.titulo === titulo), emTexto(p)).toBe(false)
})

// Regra: subagentes.cartao-desde-o-lancamento
test('sem nada em andamento, o cartão vai à pendente do pedido atual', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await lancar($, { descricao: 'ler o kit' })
  const p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: ler o kit')
})

// Regra: subagentes.pai-conclui-no-fim-do-turno
test('o subagente concluído fecha a tarefa de onde saiu no fim do turno; o pai e a contagem seguem', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  let p = await painel($)
  // Dentro do turno, nada fecha.
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('andamento')
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Plano A').estado).toBe('concluida')
  expect([cabecalho(p).feitas, cabecalho(p).total]).toEqual([1, 1])
  // Um done do modelo depois só acrescenta o resumo.
  const r = await done($, ['1'], 'Resumo do subagente')
  expect(r.erro).toBe(false)
})

// Regra: subagentes.pai-conclui-no-fim-do-turno
test('lançado de uma pendente (sem start), o subagente concluído fecha a pendente também', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Outra').estado).toBe('pendente')
})

// Regra: subagentes.um-rodando-mantem-o-pai, subagentes.pai-conclui-no-fim-do-turno
test('com um ainda rodando, a tarefa não fecha; o último, terminando depois do turno, a fecha', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'um' })
  await lancar($, { descricao: 'dois', segundoPlano: true })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).not.toBe('concluida')
  expect(cabecalho(p).feitas).toBe(0)
  await fimDoSubagente($, 'sub-2')
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
})

// Regra: subagentes.um-rodando-mantem-o-pai
test('com uma carta na fila na mesma tarefa, o subagente concluído não a fecha', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  host(on, [{ id: 'local_x' }])
  responderEnvio(on)
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'um' })
  await envio($, 'local_x', 'oi')
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).not.toBe('concluida')
})

// Regra: subagentes.pai-reflete-falha-ou-interrupcao
test('o subagente que falhou deixa a tarefa ✕ "falhou"; o interrompido, ✕ "interrompida"; misto, o pior', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['f1', 'i1', 'm1', 'm2'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Falha' }, { id: '2', title: 'Parada' }, { id: '3', title: 'Mista' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'f' })
  await start($, ['2'])
  await lancar($, { descricao: 'i' })
  await start($, ['3'])
  await lancar($, { descricao: 'm1' })
  await lancar($, { descricao: 'm2' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await fimDoSubagenteCom($, 'i1', { parado: true })
  await fimDoSubagente($, 'm1')
  await fimDoSubagenteCom($, 'm2', { erro: true })
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Falha').estado, emTexto(p)).toBe('interrompida')
  expect(linha(p, 'Falha').texto).toContain('falhou')
  expect(linha(p, 'Parada').estado).toBe('interrompida')
  expect(linha(p, 'Parada').texto).toContain('interrompida')
  expect(linha(p, 'Mista').texto).toContain('falhou')
})

// Regra: subagentes.id-reusado-nao-herda-cartao
test('plan de um pedido novo que reusa o id não herda o cartão do subagente antigo, e o fim do turno não fecha a tarefa nova', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'A', title: 'Plano B', children: [{ id: '1', title: 'Corrigir' }, { id: '2', title: 'Revisar' }] }])
  p = await painel($)
  expect(abaixo(p, 'Corrigir').map(l => l.titulo), emTexto(p)).not.toContain('Explore: ler o kit')
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Corrigir').estado, emTexto(p)).toBe('pendente')
  expect(linha(p, 'Plano B').estado).not.toBe('concluida')
  expect(abaixo(p, 'Corrigir').map(l => l.titulo)).not.toContain('Explore: ler o kit')
})

// Regra: subagentes.id-reusado-nao-herda-cartao
test('o replano de um subagente que reusa o id não deixa o subagente que ele lançou fechar a tarefa nova', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes', segundoPlano: true })
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  await fimDoSubagente($, 'neto-1')
  await done($, ['X'], undefined, 'sub-1')
  await plan($, [{ id: 'X', title: 'Corrigir os testes' }], undefined, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Ler os testes').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Corrigir os testes').estado, emTexto(p)).toBe('pendente')
})

// Regra: subagentes.cartao-fica-com-a-origem-fechada
test('a tarefa que fecha sozinha no fim do turno, ou pelo done do modelo, segue com o cartão "concluído" embaixo', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: ler o kit')
  expect(linha(p, 'Explore: ler o kit').texto).toContain('concluído')
  expect([cabecalho(p).feitas, cabecalho(p).total]).toEqual([1, 2])
  await pedido($, 'Pedido dois')
  await start($, ['2'])
  await lancar($, { descricao: 'achar o teste' })
  await fimDoSubagente($, 'sub-2')
  await done($, ['2'], 'Resumo')
  p = await painel($)
  expect(linha(p, 'Outra').estado, emTexto(p)).toBe('concluida')
  expect(abaixo(p, 'Outra').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o teste')
})

// Regra: turnos.esc-com-trabalho-delegado-vivo
test('no Esc, a tarefa com subagente em segundo plano aguarda enquanto ele roda', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await esc($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('aguardando')
  expect(linha(p, 'Explore: varrer o repo').texto, emTexto(p)).toContain('em segundo plano')
  expect(cabecalho(p).chips.interrompidas, emTexto(p)).toBe(0)
})

// Regra: subagentes.fim-depois-do-esc-fecha-a-tarefa
test('depois do Esc, o fim do subagente em segundo plano fecha a tarefa que ele deixou: ✓ se concluiu', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await esc($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('aguardando')
  expect(cabecalho(p).feitas, emTexto(p)).toBe(0)
  await fimDoSubagente($, 'sub-1')
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Outra').estado, emTexto(p)).toBe('pendente')
  expect([cabecalho(p).feitas, cabecalho(p).total], emTexto(p)).toEqual([1, 2])
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('concluído')
})

// Regra: subagentes.fim-depois-do-esc-fecha-a-tarefa
test("depois do Esc, o subagente em segundo plano que falha deixa a tarefa ✕ 'falhou'", async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await esc($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('aguardando')
  await fimDoSubagenteCom($, 'sub-1', { erro: true })
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('interrompida')
  expect(linha(p, 'Investigar').texto).toContain('falhou')
})

// Regra: subagentes.fim-depois-do-esc-fecha-a-tarefa
test('depois do Esc, o fim do subagente em segundo plano fecha também a parada cujo subagente terminou antes do Esc', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-0', 'sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['2'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-0')
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await esc($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('aguardando')
  expect(linha(p, 'Outra').estado, emTexto(p)).toBe('interrompida')
  await fimDoSubagente($, 'sub-1')
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Outra').estado, emTexto(p)).toBe('concluida')
})

// Regra: subagentes.cartao-fica-com-a-origem-fechada
test('com a tarefa fechada pelo done, o subagente em segundo plano segue no cartão e na pílula até terminar', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await done($, ['1'], 'Lançado em segundo plano')
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('em segundo plano')
  expect(p.filter(l => l.cabecalho).map(l => l.texto).join('\n')).toContain('▸ 1')
  await fimDoSubagente($, 'sub-1')
  p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('concluído')
})

// A regra mudou em 2026-11-14 ("Sim, o plan adota (Recomendado)"): num pedido sem plano o cartão termina a lista.
// Regra: subagentes.cartao-fica-com-a-origem-fechada
test('lançado num pedido sem plano, o cartão termina a lista e não vai a tarefa do pedido anterior', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await done($, ['1'], 'Feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await lancar($, { descricao: 'conferir o diff' })
  const p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).not.toContain('Explore: conferir o diff')
  expect(p.indexOf(linha(p, 'Explore: conferir o diff')), emTexto(p)).toBeGreaterThan(p.indexOf(linha(p, 'Investigar')))
  expect(linha(p, 'Explore: conferir o diff').texto).toContain('trabalhando')
})

// Regra: subagentes.cartao-fica-com-a-origem-fechada
test('no mesmo pedido, com tudo concluído, o lançamento vai à última tarefa iniciada, já fechada', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await done($, ['1'], 'Feito')
  await lancar($, { descricao: 'conferir o diff' })
  const p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: conferir o diff')
  expect(linha(p, 'Explore: conferir o diff').texto).toContain('trabalhando')
})

// Regra: subagentes.lancado-antes-do-plan-e-adotado
test('o subagente lançado antes do plan do pedido termina a lista, o plan o adota e o fim dele não fecha a tarefa que o adotou', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await done($, ['1'], 'Feito')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await lancar($, { descricao: 'conferir o diff' })
  await fimDoSubagente($, 'sub-1')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Conferir' }] }])
  await fimDoTurno($)
  const p = await painel($)
  expect(abaixo(p, 'Conferir').map(l => l.titulo), emTexto(p)).toContain('Explore: conferir o diff')
  expect(linha(p, 'Conferir').estado, emTexto(p)).toBe('pendente')
  // O pedido um (com "Investigar") fica atrás do "+1 pedidos anteriores": o cartão é só o de "Conferir".
  expect(p.filter(l => l.titulo === 'Explore: conferir o diff').length, emTexto(p)).toBe(1)
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo
test('reaberta com start depois de fechar pelo subagente, a tarefa aguarda no fim do turno seguinte; o subagente antigo não a fecha de novo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await start($, ['1'])
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('aguardando')
  expect(cabecalho(p).feitas).toBe(0)
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo
test('fechada pelo done e reaberta com start no mesmo pedido, mesmo replanejada, a tarefa não fecha pelo subagente que terminou antes', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await done($, ['1'], 'Lido')
  await relogio.advance(1000)
  await start($, ['1'])
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }, { id: '2', title: 'Outra' }, { id: '3', title: 'Revisar' }] }])
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('aguardando')
  expect(linha(p, 'Revisar').estado).toBe('pendente')
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, subagentes.pai-reflete-falha-ou-interrupcao
test('a tarefa ✕ "falhou" reaberta com start e refeita por outro subagente que conclui fica ✓', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['f1', 's2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'tentar' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('interrompida')
  expect(linha(p, 'Investigar').texto).toContain('falhou')
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await start($, ['1'])
  await lancar($, { descricao: 'tentar de novo' })
  await fimDoSubagente($, 's2')
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Investigar').texto).not.toContain('falhou')
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, turnos.esc-interrompe-so-a-iniciada
test('reaberta com start, a tarefa que tinha falhado e é parada com Esc diz "interrompida", não "falhou"', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['f1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'tentar' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await start($, ['1'])
  await esc($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('interrompida')
  expect(linha(p, 'Investigar').texto).toContain('interrompida')
  expect(linha(p, 'Investigar').texto).not.toContain('falhou')
})

// Regra: subagentes.reaberta-nao-fecha-pelo-subagente-antigo, subagentes.pai-conclui-no-fim-do-turno
test('lançado da pendente, o subagente que termina antes do primeiro start ainda fecha a tarefa no fim do turno', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await relogio.advance(1000)
  await start($, ['1'])
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Outra').estado).toBe('pendente')
})

// O state de uma versão anterior à âncora renomeada com a tarefa (o par abaixo).
const ANTIGO: Record<string, unknown> = {}

// Regra: subagentes.lancado-antes-da-tarefa-nao-conta
test('âncora gravada por versão anterior, 1/2: o pedido dois reusa o id da tarefa de onde saiu o subagente do pedido um', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  estado(on, ANTIGO, 'captura')
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  await relogio.advance(1000)
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'A', title: 'Plano B', children: [{ id: '1', title: 'Corrigir' }, { id: '2', title: 'Revisar' }] }])
  const p = await painel($)
  expect(linha(p, 'Corrigir').estado, emTexto(p)).toBe('pendente')
  // O subagente do pedido um, terminado sem tarefas, já saiu com o pedido (subagentes.terminado-sem-
  // tarefas-sai-com-o-pedido): o teste monta ele mesmo o grupo como uma versão anterior o deixava
  // gravado (decisão do usuário, 2026-11-14: "Sim, ajustar a preparação (Recomendado)").
  const grupos = ((ANTIGO.groups ??= []) as any[])
  if (!grupos.some(g => g.agent === 'sub-1')) {
    grupos.push({ agent: 'sub-1', label: 'Explore: ler o kit', parent: '', anchor: 'mdcl:A/1', tasks: [], sub: { at: AGORA, state: 'done', calls: 0, batch: AGORA, engine: 'Haiku 5.5', end: AGORA } })
  }
  // Como uma versão anterior deixava o grupo: a âncora no id reusado, não na cópia antiga.
  const sub = grupos.find(g => g.agent === 'sub-1')
  expect(sub?.anchor).not.toBe('A/1')
  sub.anchor = 'A/1'
})

// Regra: subagentes.lancado-antes-da-tarefa-nao-conta
test('âncora gravada por versão anterior, 2/2: o fim do turno não fecha a tarefa nova pelo subagente lançado antes dela', async ($: any, on: any) => {
  fixar(on, { agora: AGORA + 1000 })
  estado(on, ANTIGO, 'semear')
  if (((ANTIGO.groups ?? []) as any[]).every(g => g.anchor !== 'A/1')) throw new Error('rode o par inteiro: o 1/2 não montou o subagente antigo')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Corrigir').estado, emTexto(p)).toBe('pendente')
  expect(linha(p, 'Plano B').estado).not.toBe('concluida')
})

// Lançamentos que correm juntos, como os de uma mensagem com várias chamadas a Agent: o host devolve
// cada id alguns ms depois do anterior (o relógio anda 10 ms a cada um), e as primeiras leituras dos
// grupos depois dos lançamentos ficam presas até chegarem tantas quantos os lançamentos (cada um lê o
// painel antes de outro gravar, como no app). `presas()`: quantas leituras ficaram presas juntas.
// Chamar antes da primeira chamada a $.
const tique = (ms: number) => new Promise(r => (globalThis as any).setTimeout(r, ms))
function juntos(on: any, relogio: any, ids: string[]) {
  let i = 0
  let lancando = false
  let fila: (() => void)[] | undefined = []
  let presas = 0
  on('agent.spawn', async () => {
    const n = i++
    lancando = true
    await tique(n * 5)
    await relogio.advance(10)
    return { model: 'claude-haiku-5-5', agentId: ids[n] }
  })
  on('agent.list', () => ({ value: ids.map(id => ({ id, type: 'general-purpose', description: `subagente ${id}` })) }))
  on('state.get', async (_$: any, e: any, next: any) => {
    const f = fila
    if (e.key === 'groups' && lancando && f) {
      await new Promise<void>(solta => {
        f.push(solta)
        if (f.length === ids.length) {
          fila = undefined
          presas = f.length
          for (const s of f) s()
        }
      })
    }
    return next(e)
  })
  return { presas: () => presas }
}

// Regra: subagentes.lancados-juntos-se-veem, subagentes.varios-juntos-num-cartao-de-grupo
test('quatro lançados juntos da mesma tarefa, com o relógio andando, ficam num cartão de grupo', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const corrida = juntos(on, relogio, ['s1', 's2', 's3', 's4'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await Promise.all(['a', 'b', 'c', 'd'].map(d => lancar($, { descricao: d })))
  // Os quatro leram o painel antes de qualquer um gravar.
  expect(corrida.presas()).toBe(4)
  const p = await painel($)
  expect(linha(p, '4 subagentes').texto, emTexto(p)).toContain('4 trabalhando')
  expect(abaixo(p, 'Investigar')[0].titulo).toBe('4 subagentes')
  expect(abaixo(p, '4 subagentes').map(l => l.titulo).sort()).toEqual(['Explore: a', 'Explore: b', 'Explore: c', 'Explore: d'])
})

// Regra: subagentes.lancados-juntos-se-veem, subagentes.cartao-desde-o-lancamento
test('com duas em andamento, dois lançados juntos vão um a cada tarefa, como em série', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  const corrida = juntos(on, relogio, ['s1', 's2'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Primeira' }, { id: '2', title: 'Segunda' }] }])
  await start($, ['1', '2'])
  await Promise.all(['achar o teste', 'ler o kit'].map(d => lancar($, { descricao: d })))
  expect(corrida.presas()).toBe(2)
  const p = await painel($)
  const cartoes = (titulo: string) => abaixo(p, titulo).filter(l => l.titulo.startsWith('Explore: '))
  expect(cartoes('Primeira').length, emTexto(p)).toBe(1)
  expect(cartoes('Segunda').length).toBe(1)
})

// Regra: subagentes.lancados-juntos-se-veem, subagentes.na-filha
test('o cartão de uma filha publicado com um lote por lançamento junta os quatro lançados juntos num cartão de grupo', async ($: any, on: any) => {
  fixar(on)
  // Como uma versão anterior publicava: quatro lançamentos a 10 ms um do outro, cada um com o seu lote.
  const sub = (n: number) => ({
    agent: `fs-${n}`,
    label: `Explore: parte ${n}`,
    parent: '',
    anchor: '1',
    tasks: [],
    sub: { at: AGORA - 500 + n * 10, state: 'running', calls: 0, batch: AGORA - 500 + n * 10, engine: 'Haiku 5.5' },
  })
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha',
      painel: {
        tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
        agentes: [1, 2, 3, 4].map(sub),
      },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(abaixo(p, 'Da filha').map(l => l.titulo), emTexto(p)).toContain('4 subagentes')
  expect(abaixo(p, '4 subagentes').map(l => l.titulo)).toEqual(['Explore: parte 1', 'Explore: parte 2', 'Explore: parte 3', 'Explore: parte 4'])
})

// Regra: subagentes.neto-segue-o-cartao-de-quem-o-lancou
test('terminado, o subagente lançado por outro subagente segue com o cartão "concluído" sob a tarefa de quem o lançou', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  let p = await painel($)
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o kit')
  expect(linha(p, 'Explore: achar o kit').texto).toContain('trabalhando')
  await fimDoSubagente($, 'neto-1')
  p = await painel($)
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o kit')
  expect(linha(p, 'Explore: achar o kit').texto).toContain('concluído')
  expect(linha(p, 'Explore: achar o kit').estado).toBe('concluida')
  // O subagente que o lançou fecha a tarefa e termina, e o turno acaba: os dois cartões seguem.
  await done($, ['X'], undefined, 'sub-1')
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('general-purpose: revisar testes')
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o kit')
  expect(linha(p, 'Explore: achar o kit').texto).toContain('concluído')
})

// Regra: subagentes.fim-do-turno-nao-fecha-tarefa-de-subagente-vivo
test('o fim do turno da sessão não fecha a tarefa de um subagente que ainda trabalha, mesmo com o subagente que ele lançou concluído', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes', segundoPlano: true })
  await plan($, [{ id: 'X', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  await fimDoSubagente($, 'neto-1')
  await fimDoTurno($)
  let p = await painel($)
  expect(['concluida', 'interrompida'], emTexto(p)).not.toContain(linha(p, 'Ler os testes').estado)
  expect(linha(p, 'general-purpose: revisar testes').texto, emTexto(p)).toContain('em segundo plano')
  expect(linha(p, 'Investigar').estado, emTexto(p)).not.toBe('concluida')
  await done($, ['X'], undefined, 'sub-1')
  p = await painel($)
  esperarEstado(p, 'Ler os testes', 'concluida')
})

// Um subagente com duas tarefas, "Ler os testes" iniciada e "Corrigir" pendente, que lança outro de
// "Ler os testes".
async function subComNeto($: any, on: any, segundoPlano = false) {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes', segundoPlano })
  await plan($, [{ id: 'X', title: 'Ler os testes' }, { id: 'Y', title: 'Corrigir' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
}

// Regra: subagentes.tarefa-do-subagente-reflete-o-lancado
test('o subagente termina com o turno da sessão em curso: a tarefa de onde ele lançou outro, já concluído, fica ✓; o resto, ✕', async ($: any, on: any) => {
  await subComNeto($, on)
  await fimDoSubagente($, 'neto-1')
  await fimDoSubagente($, 'sub-1')
  const p = await painel($)
  esperarEstado(p, 'Ler os testes', 'concluida')
  esperarEstado(p, 'Corrigir', 'interrompida')
  expect(linha(p, 'general-purpose: revisar testes').texto, emTexto(p)).toContain('concluído')
})

// Regra: subagentes.tarefa-do-subagente-reflete-o-lancado
test('o subagente termina com o turno da sessão já terminado: a tarefa de onde ele lançou outro, já concluído, fica ✓; o resto, ✕', async ($: any, on: any) => {
  await subComNeto($, on, true)
  await fimDoSubagente($, 'neto-1')
  await fimDoTurno($)
  await fimDoSubagente($, 'sub-1')
  const p = await painel($)
  esperarEstado(p, 'Ler os testes', 'concluida')
  esperarEstado(p, 'Corrigir', 'interrompida')
  expect(linha(p, 'general-purpose: revisar testes').texto, emTexto(p)).toContain('concluído')
})

// Regra: subagentes.tarefa-do-subagente-reflete-o-lancado
test('o lançado pelo subagente falhou: a tarefa de onde saiu fica ✕ "falhou" quando o subagente termina', async ($: any, on: any) => {
  await subComNeto($, on)
  await fimDoSubagenteCom($, 'neto-1', { erro: true })
  await fimDoSubagente($, 'sub-1')
  const p = await painel($)
  esperarEstado(p, 'Ler os testes', 'interrompida')
  expect(linha(p, 'Ler os testes').texto, emTexto(p)).toContain('falhou')
  esperarEstado(p, 'Corrigir', 'interrompida')
})

// Regra: subagentes.tarefa-do-subagente-reflete-o-lancado
test('o lançado ainda roda quando o subagente termina: a tarefa de onde saiu fica ✕ com o resto', async ($: any, on: any) => {
  await subComNeto($, on)
  await fimDoSubagente($, 'sub-1')
  const p = await painel($)
  esperarEstado(p, 'Ler os testes', 'interrompida')
  expect(linha(p, 'Ler os testes').texto, emTexto(p)).not.toContain('falhou')
  esperarEstado(p, 'Corrigir', 'interrompida')
})

// Regra: subagentes.neto-segue-o-cartao-de-quem-o-lancou, subagentes.na-filha
test('numa filha, o subagente terminado que outro subagente lançou segue no cartão dele', async ($: any, on: any) => {
  fixar(on)
  const fim = { at: AGORA - 500, state: 'done', calls: 2, batch: AGORA - 500, engine: 'Haiku 5.5', end: AGORA - 100 }
  host(on, [
    {
      id: 'local_11111111-1111-1111-1111-111111111111',
      nome: 'filha',
      painel: {
        tasks: [{ id: '1', short: '1', title: 'Da filha', status: 'open', started: 1, startedAt: AGORA - 1000, children: [] }],
        agentes: [
          {
            agent: 'fs-1',
            label: 'general-purpose: revisar testes',
            parent: '',
            anchor: '1',
            tasks: [{ id: 'X', short: 'X', title: 'Ler os testes', status: 'done', startedAt: AGORA - 400, endedAt: AGORA - 200, children: [] }],
            sub: { ...fim, state: 'running', end: undefined },
          },
          { agent: 'fs-2', label: 'Explore: achar o kit', parent: 'fs-1', anchor: 'X', tasks: [], sub: fim },
        ],
      },
    },
  ])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  const p = await painel($)
  expect(abaixo(p, 'Da filha').map(l => l.titulo), emTexto(p)).toContain('general-purpose: revisar testes')
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toContain('Explore: achar o kit')
  expect(linha(p, 'Explore: achar o kit').texto).toContain('concluído')
})

// Regra: subagentes.neto-segue-o-cartao-de-quem-o-lancou
test('lançado por um subagente sem tarefas, o cartão fica no fim do cartão dele e sai com ele, sem ficar solto no fim do painel', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  await fimDoSubagente($, 'neto-1')
  await fimDoSubagente($, 'sub-1')
  await done($, ['1', '2'], 'Feito')
  await fimDoTurno($)
  let p = await painel($)
  expect(abaixo(p, 'general-purpose: revisar testes').map(l => l.titulo), emTexto(p)).toEqual(['Explore: achar o kit'])
  expect(linha(p, 'Explore: achar o kit').texto).toContain('concluído')
  // O pedido sai do trabalho: o cartão do subagente sai com ele, e o do que ele lançou também.
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B', children: [{ id: '1', title: 'Corrigir' }] }])
  await start($, ['B/1'])
  p = await painel($)
  expect(p.map(l => l.titulo), emTexto(p)).not.toContain('general-purpose: revisar testes')
  expect(p.map(l => l.titulo), emTexto(p)).not.toContain('Explore: achar o kit')
})

// Regra: subagentes.neto-segue-o-cartao-de-quem-o-lancou
test('o cartão do subagente lançado por outro não vai para uma tarefa da sessão que tem o mesmo id da tarefa de quem o lançou', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1', 'neto-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'B', title: 'Ler os testes' }], undefined, 'sub-1')
  await start($, ['B'], 'sub-1')
  await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  await fimDoSubagente($, 'neto-1')
  await done($, ['B'], undefined, 'sub-1')
  await fimDoSubagente($, 'sub-1')
  await done($, ['1', '2'], 'Feito')
  await fimDoTurno($)
  let p = await painel($)
  expect(abaixo(p, 'Ler os testes').map(l => l.titulo), emTexto(p)).toEqual(['Explore: achar o kit'])
  await pedido($, 'Pedido dois')
  await plan($, [{ id: 'B', title: 'Plano B' }])
  await start($, ['B'])
  p = await painel($)
  expect(abaixo(p, 'Plano B').length, emTexto(p)).toBe(0)
  expect(p.map(l => l.titulo), emTexto(p)).not.toContain('Explore: achar o kit')
})

// O cartão vivo conferido com a lista de agentes do app (agent.list), a cada releitura de 3 s.
// `app.lista`: o que o app lista, com o estado de cada um; o teste a muda (o app deixa de listar um
// subagente, ou passa a dizê-lo terminado) e pode fazê-la falhar (`app.falha`). Os lançamentos
// devolvem os ids na ordem. Chamar antes da primeira chamada a $.
type DoApp = { lista: { id: string; type: string; description: string; status?: string }[]; falha: boolean }
function listaDoApp(on: any, ids: string[] = []): DoApp {
  const app: DoApp = { lista: [], falha: false }
  let i = 0
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: ids[i++] }))
  on('agent.list', () => {
    if (app.falha) throw new Error('lista indisponível')
    return { value: app.lista }
  })
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  return app
}
const listado = (id: string, status?: string) => ({ id, type: 'Explore', description: `subagente ${id}`, ...(status !== undefined ? { status } : {}) })
const pilula = (p: any[]) => p.filter(l => l.cabecalho).map(l => l.texto).join('\n')
// O trio "1/3, 2/3, 3/3" depende de o kit rodar os testes deste arquivo em ordem, no mesmo processo:
// o 1/3 grava no store abaixo e os seguintes (módulo novo, state vazio: outro processo) leem dele.
const SEM_FIM: Record<string, unknown> = {}
const gravou = (store: Record<string, unknown>) => Object.keys(store).some(k => k.startsWith('session:'))

// Regra: subagentes.sem-fim-vira-interrompido
test('subagente em segundo plano e o processo novo, 1/3: o cartão vivo vai ao store', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, SEM_FIM)
  const app = listaDoApp(on, ['sub-1'])
  app.lista = [listado('sub-1', 'running')]
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await relogio.advance(2000)
  await chamadaDoSubagente($, 'sub-1', 'Read', { file_path: 'C:/x/kit/leitura.ts' })
  await done($, ['1'], 'Lançado em segundo plano')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('em segundo plano')
  expect(gravou(SEM_FIM), JSON.stringify(Object.keys(SEM_FIM))).toBe(true)
})

// Regra: subagentes.vivo-de-verdade-segue-vivo
test('subagente em segundo plano e o processo novo, 2/3: o worker de hooks volta com ele ainda listado como rodando, e o cartão segue vivo', async ($: any, on: any) => {
  const { relogio } = fixar(on, { agora: AGORA + 60_000 })
  armazem(on, SEM_FIM)
  host(on, [])
  const app = listaDoApp(on)
  app.lista = [listado('sub-1', 'running')]
  if (!gravou(SEM_FIM)) throw new Error('rode o trio inteiro: o 1/3 não gravou')
  // Sem session.start: o painel volta do store no primeiro uso, e a releitura recomeça com o desenho.
  let p = await painel($)
  expect(linha(p, 'Explore: varrer o repo').texto, emTexto(p)).toContain('em segundo plano')
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('em segundo plano')
  expect(pilula(p)).toContain('▸ 1')
})

// Regra: subagentes.sem-fim-vira-interrompido
test('subagente em segundo plano e o processo novo, 3/3: o app reiniciado não o lista mais, e o cartão fica "interrompido", com o tempo parado e fora da pílula', async ($: any, on: any) => {
  const { relogio } = fixar(on, { agora: AGORA + 3_600_000 })
  armazem(on, SEM_FIM)
  host(on, [])
  listaDoApp(on)
  if (!gravou(SEM_FIM)) throw new Error('rode o trio inteiro: o 1/3 não gravou')
  await iniciarSessao($)
  await relogio.advance(3000)
  let p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: varrer o repo')
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('interrompido')
  expect(linha(p, 'Explore: varrer o repo').texto).not.toContain('em segundo plano')
  expect(linha(p, 'Explore: varrer o repo').estado).toBe('interrompida')
  // O tempo para no último sinal dele (a chamada, 2 s depois do lançamento), não na hora do reinício.
  expect(linha(p, 'Explore: varrer o repo').texto).toContain('0:02')
  expect(pilula(p)).not.toContain('▸')
  expect(linha(p, 'Investigar').estado).toBe('concluida')
  await relogio.advance(5000)
  p = await painel($)
  expect(linha(p, 'Explore: varrer o repo').texto, emTexto(p)).toContain('0:02')
})

// Regra: subagentes.sem-fim-vira-interrompido, subagentes.pai-reflete-falha-ou-interrupcao, subagentes.pai-conclui-no-fim-do-turno
test('com o turno terminado, o subagente que o app passa a listar como parado ou concluído encerra o cartão, e a tarefa de origem reflete o fim', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  const app = listaDoApp(on, ['s1', 's2'])
  app.lista = [listado('s1', 'running'), listado('s2', 'running')]
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1', '2'])
  await lancar($, { descricao: 'um', segundoPlano: true })
  await lancar($, { descricao: 'dois', segundoPlano: true })
  await fimDoTurno($)
  let p = await painel($)
  expect(abaixo(p, 'Investigar').map(l => l.titulo), emTexto(p)).toContain('Explore: um')
  expect(abaixo(p, 'Outra').map(l => l.titulo), emTexto(p)).toContain('Explore: dois')
  // O fim de nenhum dos dois chega ao painel; o app passa a listá-los como parado e como concluído.
  app.lista = [listado('s1', 'killed'), listado('s2', 'completed')]
  await relogio.advance(3000)
  await relogio.advance(3000)
  p = await painel($)
  expect(linha(p, 'Explore: um').texto, emTexto(p)).toContain('interrompido')
  expect(linha(p, 'Explore: dois').texto).toContain('concluído')
  expect(linha(p, 'Investigar').estado).toBe('interrompida')
  expect(linha(p, 'Investigar').texto).toContain('interrompida')
  expect(linha(p, 'Outra').estado).toBe('concluida')
  expect(pilula(p)).not.toContain('▸')
})

// Regra: subagentes.vivo-de-verdade-segue-vivo
test('o cartão vivo não é encerrado quando a lista do app falha, vem sem o estado, ou uma só releitura deu pela falta dele', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  const app = listaDoApp(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo' })
  const vivo = async (caso: string) => {
    const p = await painel($)
    expect(linha(p, 'Explore: varrer o repo').texto, `${caso}\n${emTexto(p)}`).toContain('trabalhando')
    expect(pilula(p), caso).toContain('▸ 1')
  }
  // A lista falha: nada é encerrado, por mais releituras que passem.
  app.falha = true
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  await vivo('a lista falha')
  // A lista não diz o estado (um app anterior): listado é vivo.
  app.falha = false
  app.lista = [listado('sub-1')]
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  await vivo('lista sem estado')
  // Uma só releitura sem ele (recém-lançado, lista lida na hora errada), e ele volta a ser listado.
  app.lista = []
  await relogio.advance(3000)
  await vivo('uma releitura sem ele')
  app.lista = [listado('sub-1', 'running')]
  await relogio.advance(3000)
  app.lista = []
  await relogio.advance(3000)
  await vivo('a falta não foi seguida')
  // Só a falta vista em duas releituras seguidas encerra.
  await relogio.advance(3000)
  const p = await painel($)
  expect(linha(p, 'Explore: varrer o repo').texto, emTexto(p)).toContain('interrompido')
})

// Regra: subagentes.vivo-de-verdade-segue-vivo
test('os agentes de um workflow e o que um deles lança, que o app não lista, não são encerrados pela lista', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  host(on, [])
  listaDoApp(on, ['w1', 'w2', 'n1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o diff', run: 'wf_1' })
  await lancar($, { descricao: 'ler os testes', run: 'wf_1' })
  await lancar($, { descricao: 'achar o kit', pai: 'w1' })
  for (let i = 0; i < 4; i++) await relogio.advance(3000)
  // A linha do agente que lançou outro, aberta: o cartão dele, com o do que ele lançou.
  const m = await montar($)
  await m.recolher('Explore: ler o diff')
  const p = await m.linhas()
  await m.fim()
  expect(linha(p, 'Workflow · 2 agentes').texto, emTexto(p)).toContain('2 trabalhando')
  expect(linha(p, 'Explore: achar o kit').texto, emTexto(p)).toContain('trabalhando')
})

// O trio do workflow: como o de cima, com o store abaixo.
const WF_SEM_SINAL: Record<string, unknown> = {}

// Regra: subagentes.workflow-sem-sinal-vira-interrompido
test('agentes de workflow e o processo novo, 1/3: os cartões vivos vão ao store', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  armazem(on, WF_SEM_SINAL)
  listaDoApp(on, ['w1', 'w2'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o diff', run: 'wf_1' })
  await lancar($, { descricao: 'ler os testes', run: 'wf_1' })
  await relogio.advance(2000)
  await chamadaDoSubagente($, 'w1', 'Read', { file_path: 'C:/x/kit/leitura.ts' })
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Workflow · 2 agentes').texto, emTexto(p)).toContain('2 trabalhando')
  expect(gravou(WF_SEM_SINAL), JSON.stringify(Object.keys(WF_SEM_SINAL))).toBe(true)
})

// Regra: subagentes.workflow-sem-sinal-vira-interrompido, subagentes.vivo-de-verdade-segue-vivo
test('agentes de workflow e o processo novo, 2/3: com sinal há 20 minutos, os cartões seguem vivos', async ($: any, on: any) => {
  const { relogio } = fixar(on, { agora: AGORA + 20 * 60_000 })
  armazem(on, WF_SEM_SINAL)
  host(on, [])
  listaDoApp(on)
  if (!gravou(WF_SEM_SINAL)) throw new Error('rode o trio inteiro: o 1/3 não gravou')
  await iniciarSessao($)
  await relogio.advance(3000)
  await relogio.advance(3000)
  const p = await painel($)
  expect(linha(p, 'Workflow · 2 agentes').texto, emTexto(p)).toContain('2 trabalhando')
  expect(pilula(p)).toContain('▸ 2')
})

// Regra: subagentes.workflow-sem-sinal-vira-interrompido
test('agentes de workflow e o processo novo, 3/3: sem sinal há mais de 30 minutos, os cartões ficam "interrompido" e a tarefa de origem reflete o fim', async ($: any, on: any) => {
  const { relogio } = fixar(on, { agora: AGORA + 31 * 60_000 })
  armazem(on, WF_SEM_SINAL)
  host(on, [])
  listaDoApp(on)
  if (!gravou(WF_SEM_SINAL)) throw new Error('rode o trio inteiro: o 1/3 não gravou')
  await iniciarSessao($)
  await relogio.advance(3000)
  const p = await painel($)
  expect(linha(p, 'Workflow · 2 agentes').texto, emTexto(p)).toContain('interrompido')
  expect(linha(p, 'Workflow · 2 agentes').texto).not.toContain('trabalhando')
  expect(pilula(p)).not.toContain('▸')
  expect(linha(p, 'Investigar').estado).toBe('interrompida')
})

const SO_UM: No[] = [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }]
const DEPOIS: No[] = [{ id: 'B', title: 'Plano B', children: [{ id: 'b1', title: 'Depois' }] }]
const TERCEIRO: No[] = [{ id: 'C', title: 'Plano C', children: [{ id: 'c1', title: 'Mais tarde' }] }]
// Os agentes dos grupos no arquivo que esta sessão publica ('' é o loop principal).
const publicados = (h: { proprio(): any }): string[] => ((h.proprio()?.groups ?? []) as any[]).map(g => String(g.agent))
// O pedido um com um subagente que termina (e, com `tarefa`, planeja uma tarefa própria antes), fechado;
// depois o pedido dois, que começa trabalho novo.
async function doisPedidos($: any, tarefa = false) {
  await pedido($, 'Pedido um')
  await plan($, SO_UM)
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  if (tarefa) await plan($, [{ id: 's', title: 'Tarefa do sub' }], undefined, 'sub-1')
  await fimDoSubagente($, 'sub-1')
  await done($, ['1'], 'Resumo um')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, DEPOIS)
}

// Regra: subagentes.terminado-sem-tarefas-sai-com-o-pedido
test('o subagente terminado sem tarefas sai quando o pedido dele sai do trabalho', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  const h = host(on, [])
  await doisPedidos($)
  const p = await comHistorico($, 1)
  expect(p.some(l => l.titulo === 'Investigar'), emTexto(p)).toBe(true)
  expect(p.some(l => l.titulo === 'Explore: ler o kit'), emTexto(p)).toBe(false)
  expect(publicados(h)).toEqual([''])
})

// Regra: subagentes.terminado-sem-tarefas-sai-com-o-pedido
test('o subagente com tarefas próprias fica no histórico', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  const h = host(on, [])
  await doisPedidos($, true)
  // O grupo dele segue guardado e publicado com o pedido um, com a tarefa dele.
  const sub = ((h.proprio()?.groups ?? []) as any[]).find(g => g.agent === 'sub-1')
  expect(sub?.tasks?.map((t: any) => t.title), JSON.stringify(h.proprio()?.groups)).toEqual(['Tarefa do sub'])
})

// Regra: subagentes.terminado-sem-tarefas-sai-com-o-pedido
test('o subagente ainda em segundo plano não sai com o pedido', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  const h = host(on, [])
  await pedido($, 'Pedido um')
  await plan($, SO_UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await done($, ['1'], 'Lançado em segundo plano')
  await fimDoTurno($)
  await pedido($, 'Pedido dois')
  await plan($, DEPOIS)
  await start($, ['b1'])
  expect(publicados(h)).toContain('sub-1')
  await fimDoSubagente($, 'sub-1')
  await done($, ['b1'], 'Resumo dois')
  await fimDoTurno($)
  expect(publicados(h)).toContain('sub-1')
  await pedido($, 'Pedido três')
  await plan($, TERCEIRO)
  expect(publicados(h)).toEqual([''])
})

// Regra: subagentes.terminado-sem-tarefas-sai-com-o-pedido
test('start numa tarefa antiga não traz o cartão de volta', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  const h = host(on, [])
  await doisPedidos($)
  await start($, ['1'])
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('andamento')
  expect(p.some(l => l.titulo === 'Explore: ler o kit'), emTexto(p)).toBe(false)
  expect(publicados(h)).toEqual([''])
})

// Regra: pedidos.replano-leva-o-cartao-ao-nivel-1
test('o cartão do subagente cuja tarefa de origem sai do plano fica sob o nível 1 depois de terminar', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }, { id: '2', title: 'Outra' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'ler o kit' })
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '2', title: 'Outra' }, { id: '3', title: 'Revisar' }] }])
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(abaixo(p, 'Plano A').map(l => l.titulo), emTexto(p)).toContain('Explore: ler o kit')
  expect(linha(p, 'Explore: ler o kit').texto, emTexto(p)).toContain('concluído')
  expect(linha(p, 'Plano A').estado, emTexto(p)).not.toBe('concluida')
})

// Duas tarefas em andamento, iniciadas juntas: o cartão de um subagente lançado dali.
async function lancadoEntre($: any, on: any, segunda: string, args: { tipo?: string; descricao: string }) {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Ler o kit' }, { id: '2', title: segunda }] }])
  await start($, ['1', '2'])
  await lancar($, args)
  return painel($)
}

// Regra: envios.carta-pelo-nome-da-sessao, subagentes.cartao-desde-o-lancamento
test('a descrição do subagente com só uma palavra em comum com uma tarefa não decide: o cartão segue a ordem', async ($: any, on: any) => {
  const p = await lancadoEntre($, on, 'Descobrir como o hover funciona', { descricao: 'ver como ficou' })
  expect(abaixo(p, 'Ler o kit').map(l => l.titulo), emTexto(p)).toContain('Explore: ver como ficou')
  expect(abaixo(p, 'Descobrir como o hover funciona').map(l => l.titulo), emTexto(p)).not.toContain('Explore: ver como ficou')
})

// Regra: envios.carta-pelo-nome-da-sessao, subagentes.cartao-desde-o-lancamento
test('o tipo do subagente que é só um trecho de uma palavra do título não decide', async ($: any, on: any) => {
  const p = await lancadoEntre($, on, 'Planejar a migração', { tipo: 'Plan', descricao: 'x' })
  expect(abaixo(p, 'Ler o kit').map(l => l.titulo), emTexto(p)).toContain('Plan: x')
  expect(abaixo(p, 'Planejar a migração').map(l => l.titulo), emTexto(p)).not.toContain('Plan: x')
})

// Regra: envios.carta-pelo-nome-da-sessao, subagentes.cartao-desde-o-lancamento
test('a descrição inteira dentro do título leva o cartão a essa tarefa', async ($: any, on: any) => {
  const p = await lancadoEntre($, on, 'Revisar testes do hover', { descricao: 'revisar testes' })
  expect(abaixo(p, 'Revisar testes do hover').map(l => l.titulo), emTexto(p)).toContain('Explore: revisar testes')
  expect(abaixo(p, 'Ler o kit').map(l => l.titulo), emTexto(p)).not.toContain('Explore: revisar testes')
})

const K1 = 'local_11111111-1111-1111-1111-111111111111'
const PERGUNTA = {
  questions: [{ question: 'Qual?', header: 'Rumo', multiSelect: false, options: [{ label: 'Opção A', description: 'a' }, { label: 'Opção B', description: 'b' }] }],
}

// Regra: subagentes.pai-conclui-no-fim-do-turno
test('com a sessão aberta na tarefa esperando a pessoa, o subagente concluído não a fecha no fim do turno', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  const h = host(on, [{ id: K1, nome: 'filha-um' }])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  h.filha(K1).rodando = false
  h.filha(K1).aguardando = true
  await aviso($)
  await lancar($, { descricao: 'um' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).not.toBe('concluida')
  expect(cabecalho(p).feitas, emTexto(p)).toBe(0)
})

// Regra: subagentes.pai-conclui-no-fim-do-turno
test('com a sessão trabalhando na rodada dela nessa tarefa, o subagente concluído não a fecha no fim do turno', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  host(on, [{ id: K1, nome: 'filha-um' }])
  const envios = responderEnvio(on)
  envios.modo = 'entregue'
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Um' }, { id: '2', title: 'Dois' }] }])
  await start($, ['1'])
  await abrirSessao($)
  await aviso($)
  await done($, ['1'])
  await start($, ['2'])
  await envio($, K1, 'agora a parte dois')
  await lancar($, { descricao: 'dois' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  // O desenho mantém a linha ◉ enquanto a sessão trabalha: a conta diz se a tarefa fechou.
  expect(linha(p, 'Dois').estado, emTexto(p)).not.toBe('concluida')
  expect(cabecalho(p).feitas, emTexto(p)).toBe(1)
})

// Regra: subagentes.pai-conclui-no-fim-do-turno
test('a pergunta aberta de um subagente, numa tarefa dele de mesmo id, não segura a tarefa da sessão', async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['sub-1', 'sub-2'])
  responderDepois(on, relogio, 'AskUserQuestion', 'Opção A')
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'um', segundoPlano: true })
  await start($, ['2'])
  await lancar($, { descricao: 'dois', segundoPlano: true })
  // O sub-2 tem uma tarefa de mesmo id completo que a folha "Investigar" e abre uma pergunta nela.
  await plan($, [{ id: 'A', title: 'Plano do sub', children: [{ id: '1', title: 'Folha do sub' }] }], undefined, 'sub-2')
  await start($, ['1'], 'sub-2')
  const resp = chamadaDoSubagente($, 'sub-2', 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Investigar', 'concluida')
  await relogio.advance(1000)
  await resp
})

// Regra: subagentes.pai-reflete-falha-ou-interrupcao
test("o subagente falha e outro, lançado depois da mesma tarefa, conclui: a tarefa fica ✓ e o cartão do primeiro segue 'falhou'", async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['f1', 'r1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'primeira' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await relogio.advance(1000)
  await lancar($, { descricao: 'segunda' })
  await fimDoSubagente($, 'r1')
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Investigar', 'concluida')
  expect([cabecalho(p).feitas, cabecalho(p).total], emTexto(p)).toEqual([1, 1])
  expect(linha(p, 'Explore: primeira').texto, emTexto(p)).toContain('falhou')
  const r = await done($, ['1'], 'resumo')
  expect(r.erro, r.texto).toBe(false)
  expect(r.texto).not.toContain('foi interrompida')
})

// Regra: subagentes.pai-reflete-falha-ou-interrupcao
test("a nova tentativa decide também quando termina mal: parada, a tarefa fica ✕ 'interrompida'", async ($: any, on: any) => {
  const { relogio } = fixar(on)
  lancaveis(on, ['f1', 'r1'])
  await pedido($, 'Pedido um')
  await plan($, [{ id: 'A', title: 'Plano A', children: [{ id: '1', title: 'Investigar' }] }])
  await start($, ['1'])
  await lancar($, { descricao: 'primeira' })
  await fimDoSubagenteCom($, 'f1', { erro: true })
  await relogio.advance(1000)
  await lancar($, { descricao: 'segunda' })
  await fimDoSubagenteCom($, 'r1', { parado: true })
  await fimDoTurno($)
  const p = await painel($)
  esperarEstado(p, 'Investigar', 'interrompida')
  expect(linha(p, 'Investigar').texto, emTexto(p)).toContain('interrompida')
  expect(linha(p, 'Investigar').texto, emTexto(p)).not.toContain('falhou')
})

// Regra: subagentes.espera-no-cartao-de-grupo, perguntas.permissao-espera
test("no cartão de grupo, o agente que pede permissão mostra a espera na linha dele e conta no chip 'aguardando', também com o cartão recolhido", async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['g1', 'g2', 'g3', 'g4'])
  on('classic.PermissionRequest', () => ({}))
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  for (const d of ['a', 'b', 'c', 'd']) await lancar($, { descricao: d })
  await $.classic.PermissionRequest({ tool_name: 'Bash', agent_id: 'g2' })
  const m = await montar($)
  let p = await m.linhas()
  expect(linha(p, 'Explore: b').texto, emTexto(p)).toContain('Aguardando permissão: Bash')
  esperarEstado(p, 'Explore: b', 'aguardando')
  for (const outro of ['Explore: a', 'Explore: c', 'Explore: d']) {
    expect(linha(p, outro).texto, emTexto(p)).not.toContain('Aguardando')
    expect(linha(p, outro).estado, emTexto(p)).not.toBe('aguardando')
  }
  expect(cabecalho(p).chips.aguardando, emTexto(p)).toBe(1)
  await m.recolher('4 subagentes')
  p = await m.linhas()
  expect(cabecalho(p).chips.aguardando, emTexto(p)).toBe(1)
  await m.fim()
})

const INVESTIGA: No[] = [
  { id: '1', title: 'Investigar' },
  { id: '2', title: 'Outra' },
]
const DO_SUB: No[] = [
  { id: 'x1', title: 'X1' },
  { id: 'x2', title: 'X2' },
]

// Regra: subagentes.tarefas-do-subagente-contam-acima
test('as tarefas que o subagente planeja contam no cabeçalho e no x/y da tarefa de origem e do pedido, com o cartão aberto ou a tarefa recolhida', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, INVESTIGA)
  await start($, ['1'])
  await lancar($, { descricao: 'um' })
  await plan($, DO_SUB, undefined, 'sub-1')
  await start($, ['x1'], 'sub-1')
  await done($, ['x1'], undefined, 'sub-1')
  const m = await montar($)
  let p = await m.linhas()
  let c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 4])
  expect(linha(p, 'Investigar').texto, emTexto(p)).toContain('1/3')
  expect(linha(p, 'Pedido um').texto, emTexto(p)).toContain('1/4')
  for (const titulo of ['Investigar', 'Pedido um']) {
    await m.recolher(titulo)
    p = await m.linhas()
    c = cabecalho(p)
    expect([c.feitas, c.total], `recolhido ${titulo}:\n${emTexto(p)}`).toEqual([1, 4])
  }
  await m.fim()
})

// Regra: subagentes.tarefas-do-subagente-contam-acima
test('num cartão de grupo, as tarefas de um agente contam com a linha dele fechada', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['g1', 'g2', 'g3', 'g4'])
  await pedido($, 'Pedido um')
  await plan($, INVESTIGA)
  await start($, ['1'])
  for (const d of ['a', 'b', 'c', 'd']) await lancar($, { descricao: d })
  await plan($, DO_SUB, undefined, 'g2')
  await start($, ['x1'], 'g2')
  await done($, ['x1'], undefined, 'g2')
  const m = await montar($)
  let p = await m.linhas()
  expect(linha(p, '4 subagentes').titulo, emTexto(p)).toBe('4 subagentes')
  let c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 4])
  expect(linha(p, 'Investigar').texto, emTexto(p)).toContain('1/3')
  await m.recolher('4 subagentes')
  p = await m.linhas()
  c = cabecalho(p)
  expect([c.feitas, c.total], emTexto(p)).toEqual([1, 4])
  await m.fim()
})

// Regra: subagentes.tarefa-em-andamento-com-subagente-rodando
test('lançado de uma tarefa sem start, o subagente rodando deixa a tarefa, o pai e o pedido em andamento', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await lancar($, { descricao: 'ler o kit' })
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('andamento')
  expect(linha(p, 'Plano A').estado, emTexto(p)).toBe('andamento')
  expect(linha(p, 'Pedido um').estado, emTexto(p)).toBe('andamento')
  expect(linha(p, 'Outra').estado, emTexto(p)).toBe('pendente')
  await fimDoSubagente($, 'sub-1')
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('pendente')
  await fimDoTurno($)
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
})

// Regra: subagentes.tarefa-em-andamento-com-subagente-rodando, turnos.iniciada-aguarda-no-fim
test('a tarefa iniciada com subagente em segundo plano segue em andamento depois do fim do turno', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'varrer o repo', segundoPlano: true })
  await fimDoTurno($)
  let p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('andamento')
  expect(linha(p, 'Plano A').estado, emTexto(p)).toBe('andamento')
  expect(linha(p, 'Pedido um').estado, emTexto(p)).toBe('andamento')
  await fimDoSubagente($, 'sub-1')
  p = await painel($)
  expect(linha(p, 'Investigar').estado, emTexto(p)).toBe('concluida')
})

// Regra: subagentes.modelo-avisado-do-fechamento
test('quando os subagentes fecham a tarefa no fim do turno, o modelo é avisado uma vez', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'um' })
  await fimDoSubagente($, 'sub-1')
  await fimDoTurno($)
  const primeiro = JSON.stringify(await pedido($, 'Pedido dois'))
  expect(primeiro).toContain('concluiu sozinho')
  expect(primeiro).toContain('Investigar')
  expect(JSON.stringify(await pedido($, 'Pedido três'))).not.toContain('concluiu sozinho')
})

// Regra: subagentes.modelo-avisado-do-fechamento
test('o subagente em segundo plano que falha depois do turno: o prompt seguinte diz que a tarefa ficou interrompida e como refazer', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'um', segundoPlano: true })
  await fimDoTurno($)
  await fimDoSubagenteCom($, 'sub-1', { erro: true })
  const r = JSON.stringify(await aviso($))
  expect(r).toContain('falhou')
  expect(r).toContain('mcp__task-tree__start')
})

// Regra: subagentes.modelo-avisado-do-fechamento
test('a nota sai também no resultado da ferramenta seguinte, com o turno em curso', async ($: any, on: any) => {
  fixar(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'um', segundoPlano: true })
  await fimDoTurno($)
  await fimDoSubagente($, 'sub-1')
  const r = await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'ls' })
  expect(JSON.stringify(r?.context ?? [])).toContain('concluiu sozinho')
  const r2 = await $.tool.call({ tool: 'Bash', tool_use_id: 'b2', command: 'ls' })
  expect(JSON.stringify(r2?.context ?? [])).not.toContain('concluiu sozinho')
})

// Regra: arvore.done-em-interrompida-indica-o-start
test('o done numa tarefa interrompida diz que o start a reabre', async ($: any, on: any) => {
  fixar(on)
  lancaveis(on, ['sub-1'])
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { descricao: 'um', segundoPlano: true })
  await fimDoTurno($)
  await fimDoSubagenteCom($, 'sub-1', { erro: true })
  const r = await done($, ['1'])
  expect(r.texto).toContain('foi interrompida')
  expect(r.texto).toContain('start')
})

// O sub-1, conferido pela lista do app, planeja "Ler os testes" e "Corrigir" e dá start na primeira;
// com `neto`, lança dela o neto-1. A lista começa com os dois rodando. `stubs`: os do teste, antes da
// primeira chamada a $.
async function subPelaLista($: any, on: any, neto: boolean, stubs?: (relogio: any) => void) {
  const { relogio, log } = fixar(on)
  host(on, [])
  const app = listaDoApp(on, ['sub-1', 'neto-1'])
  stubs?.(relogio)
  app.lista = [listado('sub-1', 'running'), listado('neto-1', 'running')]
  await pedido($, 'Pedido um')
  await plan($, UM)
  await start($, ['1'])
  await lancar($, { tipo: 'general-purpose', descricao: 'revisar testes' })
  await plan($, [{ id: 'X', title: 'Ler os testes' }, { id: 'Y', title: 'Corrigir' }], undefined, 'sub-1')
  await start($, ['X'], 'sub-1')
  if (neto) await lancar($, { descricao: 'achar o kit', pai: 'sub-1' })
  return { relogio, log, app }
}

// Regra: subagentes.sem-fim-vira-interrompido
test('o subagente com tarefas que some da lista do app deixa interrompido o que deixou aberto', async ($: any, on: any) => {
  const { relogio, app } = await subPelaLista($, on, false)
  app.lista = []
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  const p = await painel($)
  expect(linha(p, 'general-purpose: revisar testes').texto, emTexto(p)).toContain('interrompido')
  esperarEstado(p, 'Ler os testes', 'interrompida')
  esperarEstado(p, 'Corrigir', 'interrompida')
})

// Regra: subagentes.tarefa-do-subagente-reflete-o-lancado, subagentes.sem-fim-vira-interrompido
test('encerrado pela lista do app, o subagente deixa ✓ a tarefa de onde lançou outro já concluído, e ✕ o resto', async ($: any, on: any) => {
  const { relogio, app } = await subPelaLista($, on, true)
  await fimDoSubagente($, 'neto-1')
  app.lista = [listado('neto-1', 'completed')]
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  const p = await painel($)
  expect(linha(p, 'general-purpose: revisar testes').texto, emTexto(p)).toContain('interrompido')
  esperarEstado(p, 'Ler os testes', 'concluida')
  esperarEstado(p, 'Corrigir', 'interrompida')
})

// Regra: subagentes.tarefa-do-subagente-reflete-o-lancado
test('encerrado pela lista do app com uma pergunta dele ainda aberta, o subagente deixa ✓ a tarefa de onde lançou outro já concluído', async ($: any, on: any) => {
  // A resposta só chega bem depois das releituras que encerram o cartão.
  const { relogio, app } = await subPelaLista($, on, true, r => responderDepois(on, r, 'AskUserQuestion', 'Opção A', 60000))
  await fimDoSubagente($, 'neto-1')
  const resp = chamadaDoSubagente($, 'sub-1', 'AskUserQuestion', PERGUNTA)
  await relogio.settle()
  app.lista = [listado('neto-1', 'completed')]
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  const p = await painel($)
  esperarEstado(p, 'Ler os testes', 'concluida')
  esperarEstado(p, 'Corrigir', 'interrompida')
  const cartao = abaixo(p, 'general-purpose: revisar testes')
  expect(cartao.some(l => l.estado === 'aguardando' || /aguardando|pergunta/i.test(l.texto)), emTexto(p)).toBe(false)
  await relogio.advance(60000)
  await resp
})

// Regra: subagentes.sem-fim-vira-interrompido
test('na releitura que encerra o cartão, uma falha ao refletir os lançados não impede a interrupção do que o subagente deixou aberto', async ($: any, on: any) => {
  let armado = false
  // Armado, a leitura das sessões filhas falha: o reflexo dos lançados a lê, o encerramento do cartão não.
  const { relogio, log, app } = await subPelaLista($, on, false, () =>
    on('state.get', async (_$: any, e: any, next: any) => (armado && e?.key === 'children' ? { deny: 'estouro de teste' } : next(e))),
  )
  app.lista = []
  armado = true
  for (let i = 0; i < 3; i++) await relogio.advance(3000)
  armado = false
  const p = await painel($)
  expect(linha(p, 'general-purpose: revisar testes').texto, emTexto(p)).toContain('interrompido')
  esperarEstado(p, 'Ler os testes', 'interrompida')
  esperarEstado(p, 'Corrigir', 'interrompida')
  expect(log.some(l => l.includes('releitura dos subagentes, passo') && l.includes('estouro de teste')), log.join('\n')).toBe(true)
})
